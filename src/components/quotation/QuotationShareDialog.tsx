import { useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  ShareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { companyDisplayName, currentCompanyCountry } from "../../company/companyApi";
import { formatDate } from "../../company/format";
import { formatPrice } from "../../pages/Sales/QuotationItemsEditor";
import { apiError } from "../../utils/apiError";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../../pages/Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

// Lists the quotations to pick one or more, then prints, downloads, emails (one mail with every PDF) or sends them by
// WhatsApp together. The page makes the PDFs, as for the single download.

const API_URL = "/v1/api/sales/quotations";
// The sales service takes at most this many quotations in one email
const MAX_EMAIL = 20;
const EMAILABLE = ["DRAFT", "SENT", "VIEWED", "ACCEPTED"];
const NOT_SENDABLE = ["REJECTED", "EXPIRED"];
const EMAIL = /^[^\s@]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

export interface ShareableQuotation {
  id: number;
  quoteNumber?: string;
  customerName: string;
  status: string;
  quoteDate?: string;
  grandTotal?: number;
  currencyCode?: string;
  email?: string;
  phone?: string | null;
}

interface Props {
  quotations: ShareableQuotation[];
  companyName: string;
  // Print and download (export permission)
  canPrint: boolean;
  // Email and WhatsApp (create permission)
  canSend: boolean;
  // One PDF with the given quotations, in that order
  combinedPdf: (ids: number[]) => Promise<Blob>;
  // One quotation's PDF, as the single download
  singlePdf: (id: number) => Promise<Blob>;
  print: (blob: Blob) => void;
  // Quotations as the server returned them after a send (status may now be SENT)
  onUpdated: (updated: Record<string, unknown>[]) => void;
  onClose: () => void;
}

type Mode = "select" | "email" | "whatsapp";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";

const numberOf = (q: ShareableQuotation) => q.quoteNumber || `#${q.id}`;
const fileNameOf = (q: ShareableQuotation) => `${numberOf(q).replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
const statusOf = (q: ShareableQuotation) => String(q.status || "DRAFT").trim().toUpperCase();
/** The one value every selected quotation shares (an email, a phone), else empty. */
const shared = (values: (string | null | undefined)[]) => {
  const distinct = Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
  return distinct.length === 1 && values.every((v) => String(v || "").trim()) ? distinct[0] : "";
};

export default function QuotationShareDialog({
  quotations, companyName, canPrint, canSend, combinedPdf, singlePdf, print, onUpdated, onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("select");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Email / WhatsApp form
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [markSent, setMarkSent] = useState(true);

  const statuses = useMemo(() => Array.from(new Set(quotations.map(statusOf))).sort(), [quotations]);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((q) =>
      (!statusFilter || statusOf(q) === statusFilter) &&
      (!term || [numberOf(q), q.customerName, q.email].some((v) => String(v || "").toLowerCase().includes(term))));
  }, [quotations, search, statusFilter]);
  // In the list's order, so the combined PDF and the attachments follow it
  const selected = useMemo(() => quotations.filter((q) => selectedIds.includes(q.id)), [quotations, selectedIds]);
  const allVisibleSelected = visible.length > 0 && visible.every((q) => selectedIds.includes(q.id));
  const hasDrafts = selected.some((q) => statusOf(q) === "DRAFT");
  const notEmailable = selected.filter((q) => !EMAILABLE.includes(statusOf(q)));
  const notSendable = selected.filter((q) => NOT_SENDABLE.includes(statusOf(q)));
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File(["%PDF"], "q.pdf", { type: "application/pdf" })] });

  const toggle = (id: number) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const toggleAllVisible = () =>
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visible.some((q) => q.id === id))
        : Array.from(new Set([...current, ...visible.map((q) => q.id)])));

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setProblem(null);
    try {
      await work();
    } catch (err) {
      setProblem(apiError(err, t("The quotations could not be shared")).replace(/^(ids|files|to|cc|phone|file): /, ""));
    } finally {
      setBusy(null);
    }
  };

  const ids = () => selected.map((q) => q.id);

  const printSelected = () => run("print", async () => print(await combinedPdf(ids())));

  const downloadSelected = () => run("download", async () => {
    const blob = await combinedPdf(ids());
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = selected.length === 1 ? fileNameOf(selected[0]) : `quotations-${selected.length}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // The device's share sheet (mail, chat apps), one file per quotation
  const shareFromDevice = () => run("device", async () => {
    const files: File[] = [];
    for (const q of selected) files.push(new File([await singlePdf(q.id)], fileNameOf(q), { type: "application/pdf" }));
    try {
      await navigator.share({ files, title: t("Quotations"), text: selected.map(numberOf).join(", ") });
    } catch (err) {
      // Closing the share sheet is not an error
      if ((err as DOMException)?.name !== "AbortError") throw err;
    }
  });

  const openEmail = () => {
    const numbers = selected.map(numberOf).join(", ");
    setTo(shared(selected.map((q) => q.email)));
    setCc("");
    setSubject(`${selected.length === 1 ? "Quotation" : "Quotations"} ${numbers} from ${companyName}`.slice(0, 300));
    setMessage(
      `Dear ${shared(selected.map((q) => q.customerName)) || "Sir/Madam"},\n\n` +
      `Please find attached our ${selected.length === 1 ? "quotation" : "quotations"} ${numbers}. ` +
      "Let us know if you have any questions.\n\nRegards,\n" + companyName);
    setMarkSent(true);
    setProblem(null);
    setMode("email");
  };

  const openWhatsApp = () => {
    setPhone(shared(selected.map((q) => q.phone)));
    setMarkSent(true);
    setProblem(null);
    setMode("whatsapp");
  };

  const sendEmail = () => {
    const bad = [to, cc].flatMap((v) => v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)).filter((s) => !EMAIL.test(s));
    if (!to.trim()) return setProblem(t("Enter the customer's email address."));
    if (bad.length) return setProblem(`${t("Not a valid email address:")} ${bad.join(", ")}`);
    return run("email", async () => {
      const form = new FormData();
      for (const q of selected) {
        form.append("ids", String(q.id));
        form.append("files", new File([await singlePdf(q.id)], fileNameOf(q), { type: "application/pdf" }));
      }
      form.append("to", to.trim());
      if (cc.trim()) form.append("cc", cc.trim());
      form.append("subject", subject.trim());
      form.append("message", message);
      form.append("markSent", String(markSent && hasDrafts));
      const res = await axios.post<{ quotations?: Record<string, unknown>[] }>(`${API_URL}/email`, form, { quiet: true } as object);
      onUpdated(res.data?.quotations ?? []);
      ToasterService.success(t("{n} quotations emailed").replace("{n}", String(selected.length)), `${t("To")} ${to.trim()}`);
      onClose();
    });
  };

  // One WhatsApp document per quotation, through the same endpoint as the single send
  const sendWhatsApp = () => {
    if (!phone.trim()) return setProblem(t("Enter the customer's mobile number"));
    return run("whatsapp", async () => {
      const updated: Record<string, unknown>[] = [];
      const failed: string[] = [];
      for (const q of selected) {
        try {
          const form = new FormData();
          form.append("file", new File([await singlePdf(q.id)], fileNameOf(q), { type: "application/pdf" }));
          form.append("phone", phone.trim());
          const country = currentCompanyCountry();
          if (country) form.append("country", country);
          form.append("companyName", companyDisplayName());
          form.append("markSent", String(markSent && statusOf(q) === "DRAFT"));
          const res = await axios.post<{ quotation?: Record<string, unknown> }>(`${API_URL}/${q.id}/whatsapp`, form, { quiet: true } as object);
          if (res.data?.quotation) updated.push(res.data.quotation);
        } catch (err) {
          failed.push(`${numberOf(q)}: ${apiError(err, t("not sent")).replace(/^(phone|file): /, "")}`);
        }
      }
      onUpdated(updated);
      const sent = selected.length - failed.length;
      if (sent > 0) ToasterService.success(t("{n} quotations sent by WhatsApp").replace("{n}", String(sent)));
      if (failed.length) {
        setProblem(failed.join("\n"));
        return;
      }
      onClose();
    });
  };

  const header = (
    <div data-overlay-header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600"><ShareIcon className="h-4 w-4" /></span>
        <div>
          <h3 id="quotation-share-title" className="text-sm font-semibold text-slate-900 dark:text-white">
            {mode === "email" ? t("Email quotations") : mode === "whatsapp" ? t("Send quotations by WhatsApp") : t("Share quotations")}
          </h3>
          <p className="text-[11px] text-slate-500">
            {mode === "select"
              ? t("Pick one or more quotations to print or send together.")
              : `${selected.length} ${t("selected")}: ${selected.map(numberOf).join(", ")}`}
          </p>
        </div>
      </div>
      <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label={t("Close")}>
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );

  const problemBox = problem && (
    <p role="alert" className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{problem}</p>
  );

  const markSentBox = hasDrafts && (
    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-300">
      <input type="checkbox" checked={markSent} onChange={(e) => setMarkSent(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-cyan-600" />
      {t("Mark the draft quotations as Sent")}
    </label>
  );

  return (
    <div data-overlay data-overlay-dim className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div data-overlay-panel role="dialog" aria-labelledby="quotation-share-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-transparent dark:bg-[#191919]">
        {header}

        {mode === "select" && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-gray-800">
              <div className="relative min-w-[12rem] flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className={INPUT} style={{ paddingInlineStart: "2rem" }} value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search by number or customer")} aria-label={t("Search by number or customer")} />
              </div>
              <select className={`${INPUT} sm:w-44`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t("Status")}>
                <option value="">{t("All statuses")}</option>
                {statuses.map((status) => <option key={status} value={status}>{t(status)}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between px-5 py-2 text-xs text-slate-600 dark:text-gray-300">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={visible.length === 0}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600" />
                {t("Select all")} ({visible.length})
              </label>
              <span>
                {selected.length} {t("selected")}
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelectedIds([])} className="ms-2 font-medium text-cyan-600 hover:text-cyan-700">
                    {t("Clear")}
                  </button>
                )}
              </span>
            </div>
            <ul className="min-h-[8rem] flex-1 overflow-y-auto border-y border-slate-100 dark:border-gray-800">
              {visible.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-slate-500">{t("No quotations found")}</li>
              )}
              {visible.map((q) => (
                <li key={q.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-2 hover:bg-slate-50 dark:hover:bg-[#222222]">
                    <input type="checkbox" checked={selectedIds.includes(q.id)} onChange={() => toggle(q.id)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{numberOf(q)}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {q.customerName}{q.quoteDate ? ` · ${formatDate(new Date(`${q.quoteDate}T00:00:00`), q.quoteDate)}` : ""}
                      </span>
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
                      {t(statusOf(q))}
                    </span>
                    <span className="w-28 text-right text-sm font-semibold text-slate-900 dark:text-white">
                      {formatPrice(Number(q.grandTotal || 0), q.currencyCode)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="space-y-2 px-5 py-3">
              {problemBox}
              {canSend && notSendable.length > 0 && (
                <p className="text-[11px] text-amber-700">
                  {t("Rejected or expired quotations can't be sent:")} {notSendable.map(numberOf).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canPrint && (
                  <>
                    <button type="button" className={SECONDARY_BUTTON} onClick={printSelected} disabled={!selected.length || !!busy}>
                      <PrinterIcon className="h-4 w-4" />{busy === "print" ? t("Preparing…") : t("Print")}
                    </button>
                    <button type="button" className={SECONDARY_BUTTON} onClick={downloadSelected} disabled={!selected.length || !!busy}>
                      <ArrowDownTrayIcon className="h-4 w-4" />{busy === "download" ? t("Preparing…") : t("Download PDF")}
                    </button>
                    {canShareFiles && (
                      <button type="button" className={SECONDARY_BUTTON} onClick={shareFromDevice} disabled={!selected.length || !!busy}>
                        <ShareIcon className="h-4 w-4" />{busy === "device" ? t("Preparing…") : t("Share…")}
                      </button>
                    )}
                  </>
                )}
                {canSend && (
                  <>
                    <button type="button" className={SECONDARY_BUTTON} onClick={openWhatsApp}
                      disabled={!selected.length || notSendable.length > 0 || !!busy}>
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />{t("WhatsApp")}
                    </button>
                    <button type="button" className={PRIMARY_BUTTON} onClick={openEmail}
                      disabled={!selected.length || notEmailable.length > 0 || selected.length > MAX_EMAIL || !!busy}
                      title={selected.length > MAX_EMAIL ? t("At most {n} quotations in one email").replace("{n}", String(MAX_EMAIL)) : undefined}>
                      <EnvelopeIcon className="h-4 w-4" />{t("Email")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {mode === "email" && (
          <div className="space-y-3 overflow-y-auto px-5 py-4">
            <div>
              <label className={LABEL} htmlFor="qs-to">{t("To")}</label>
              <input id="qs-to" dir="ltr" className={INPUT} value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
              <p className="mt-1 text-[11px] text-slate-500">{t("Separate several addresses with commas.")}</p>
            </div>
            <div>
              <label className={LABEL} htmlFor="qs-cc">{t("Cc")}</label>
              <input id="qs-cc" dir="ltr" className={INPUT} value={cc} onChange={(e) => setCc(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="qs-subject">{t("Subject")}</label>
              <input id="qs-subject" className={INPUT} value={subject} maxLength={300} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="qs-message">{t("Message")}</label>
              <textarea id="qs-message" rows={6} className={INPUT} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200">
              {t("One email goes with every selected quotation's PDF attached. Each quotation lists it in its email history.")}
            </p>
            {markSentBox}
            {problemBox}
          </div>
        )}

        {mode === "whatsapp" && (
          <div className="space-y-3 px-5 py-4">
            <div>
              <label className={LABEL} htmlFor="qs-phone">{t("Customer's mobile number")}</label>
              <input id="qs-phone" dir="ltr" className={INPUT} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" />
              <p className="mt-1 text-[11px] text-slate-500">{t("A local number gets your company's country code.")}</p>
            </div>
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              {t("Each quotation's PDF goes as its own WhatsApp document, with your company's document template.")}
            </p>
            {markSentBox}
            {problemBox}
          </div>
        )}

        {mode !== "select" && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-gray-800">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => { setProblem(null); setMode("select"); }} disabled={!!busy}>
              {t("Back")}
            </button>
            <button type="button" className={PRIMARY_BUTTON} onClick={mode === "email" ? sendEmail : sendWhatsApp} disabled={!!busy}>
              {mode === "email" ? <EnvelopeIcon className="h-4 w-4" /> : <ChatBubbleLeftRightIcon className="h-4 w-4" />}
              {busy ? t("Sending…") : t("Send")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
