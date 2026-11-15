import { useEffect, useState } from "react";
import axios from "axios";
import { ClipboardDocumentIcon, CreditCardIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError, money } from "./invoiceShared";
import { formatDateTime } from "../../company/format";
import { t } from "../../i18n/i18n";

// An invoice's pay-online link (backlog 7.1.3): made on opening, copied to send, checked or stopped here.

interface Attempt { id: number; provider: string; amount: number; currency: string; status: string; detail: string | null; createdAt: string }
interface Link { id: number; url: string; status: string; paidAmount: number | null; paidAt: string | null; receiptId: number | null; attempts: Attempt[] }

const STATUS_TONE: Record<string, string> = {
  OPEN: "bg-cyan-50 text-cyan-700", PAID: "bg-emerald-50 text-emerald-700", CANCELLED: "bg-slate-100 text-slate-600",
  FAILED: "bg-red-50 text-red-700", EXPIRED: "bg-slate-100 text-slate-600",
};
const STATUS_LABEL: Record<string, string> = { OPEN: "Open", PAID: "Paid", CANCELLED: "Cancelled", FAILED: "Not completed", EXPIRED: "Expired" };

export default function PaymentLinkDialog({ invoiceId, invoiceNumber, canCancel, onClose, onPaid }: {
  invoiceId: number;
  invoiceNumber: string;
  canCancel: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const api = `${INVOICE_API}/invoices/${invoiceId}/payment-link`;
  const [link, setLink] = useState<Link | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    // The open link, made the first time
    axios.post<Link>(api, undefined, { quiet: true } as object)
      .then((r) => setLink(r.data))
      .catch(async (err) => {
        // Nothing left to pay (or online payments off): show the latest link if there is one, else why not
        const last = await axios.get<Link>(api).then((r) => (r.status === 204 ? null : r.data)).catch(() => null);
        if (last) setLink(last);
        setProblem(apiError(err, "Couldn't make a payment link"));
      })
      .finally(() => setBusy(false));
  }, [api]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      ToasterService.success(t("Link copied"));
    } catch {
      ToasterService.info(t("Select the text and copy it"));
    }
  };

  const check = async () => {
    setBusy(true);
    try {
      const res = await axios.post<Link>(`${api}/check`);
      setLink(res.data);
      if (res.data.status === "PAID") {
        ToasterService.success(t("Paid online: the receipt is recorded"));
        onPaid();
      } else {
        ToasterService.info(t("No completed payment yet"));
      }
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't check with the gateway"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await axios.delete<Link>(api);
      setLink(res.data);
      ToasterService.success(t("The payment link no longer takes payments"));
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't stop the payment link"));
    } finally {
      setBusy(false);
    }
  };

  const tone = (status: string) => `inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-600"}`;

  return (
    <div data-overlay data-overlay-dim className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div data-overlay-panel role="dialog" aria-labelledby="pay-link-title" className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-transparent dark:bg-[#191919]">
        <div data-overlay-header className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-cyan-600"><CreditCardIcon className="h-4 w-4" /></span>
            <div>
              <h3 id="pay-link-title" className="text-sm font-semibold text-slate-900 dark:text-white">{t("Pay link")}</h3>
              <p className="text-[11px] text-slate-500">{t("Invoice")} {invoiceNumber}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label={t("Close")}><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5 py-4">
          {busy && !link && <p className="text-sm text-slate-500">{t("Loading…")}</p>}
          {problem && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{problem}</p>}
          {link && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className={tone(link.status)}>{t(STATUS_LABEL[link.status] ?? link.status)}</span>
                {link.status === "PAID" && link.paidAmount != null && (
                  <span className="text-xs text-emerald-700">{t("Paid")} {money(link.paidAmount)}{link.paidAt ? ` · ${formatDateTime(link.paidAt)}` : ""}</span>
                )}
              </div>
              {link.status === "OPEN" && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Send this address to the customer")}</span>
                    <button type="button" onClick={copy} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
                      <ClipboardDocumentIcon className="h-4 w-4" /> {t("Copy")}
                    </button>
                  </div>
                  <code dir="ltr" className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:bg-gray-900 dark:text-gray-200">{link.url}</code>
                  <p className="mt-1 text-[11px] text-slate-500">{t("It asks for what is still due when it is opened, so it stays right after part payments.")}</p>
                </div>
              )}
              {link.attempts.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Payments started")}</p>
                  <ul className="space-y-1">
                    {link.attempts.slice(0, 6).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] dark:bg-[#222222]">
                        <span className="text-slate-700 dark:text-gray-300">{formatDateTime(a.createdAt)} · {a.currency} {money(a.amount)}</span>
                        <span className={tone(a.status)} title={a.detail ?? undefined}>{t(STATUS_LABEL[a.status] ?? a.status)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-gray-800">
          {link?.status === "OPEN" && canCancel && (
            <button type="button" onClick={cancel} disabled={busy} className="me-auto text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
              {t("Stop this link")}
            </button>
          )}
          {link?.status === "OPEN" && link.attempts.length > 0 && (
            <button type="button" onClick={check} disabled={busy}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
              {t("Check payment")}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">{t("Done")}</button>
        </div>
      </div>
    </div>
  );
}
