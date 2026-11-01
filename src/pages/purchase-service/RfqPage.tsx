import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Ban, Eye, Mail, MessageSquarePlus, Pencil, Plus, Printer, Send, Trash2, Trophy } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DocumentEmailDialog from "../../components/common/DocumentEmailDialog";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import { companyDisplayName } from "../../company/companyApi";
import { companyCurrency, formatDate, formatMoney, todayIso } from "../../company/format";
import { currencies } from "../../company/regional";
import { RFQ_BASE, Rfq, RfqVendor, rfqApi } from "../../purchase/rfqApi";
import { VendorRecord } from "./purchaseOrderPdf";
import { printRfq, rfqPdf } from "./rfqPdf";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Vendor extends VendorRecord { active?: boolean; currency?: string }
interface Product { id: number; productCode?: string; productName?: string; active?: boolean }
interface Requisition {
  id: number; requisitionNumber?: string; status?: string;
  items?: { productId?: number; quantity?: number; remarks?: string }[];
}
type LineRow = { key: string; productId: string; quantity: string; remarks: string };
type Form = { id: number | null; title: string; rfqDate: string; responseDueDate: string; requisitionId: string; notes: string; lines: LineRow[]; vendorIds: number[] };
type QuoteRow = { rfqLineId: number; unitPrice: string; leadTimeDays: string; remarks: string };
type QuoteForm = { vendor: RfqVendor; quoteReference: string; quoteDate: string; validUntil: string; currency: string; notes: string; lines: QuoteRow[] };

let seq = 0;
const lineRow = (productId = "", quantity = "", remarks = ""): LineRow => ({ key: `l${seq++}`, productId, quantity, remarks });
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const money = (value: number | null | undefined, currency?: string | null) =>
  (value == null ? "—" : formatMoney(value, { currency: currency || companyCurrency() }));

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300",
  SENT: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  AWARDED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  INVITED: "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300",
  QUOTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  DECLINED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", SENT: "Waiting for quotes", AWARDED: "Awarded", CANCELLED: "Cancelled", INVITED: "Asked", QUOTED: "Quoted", DECLINED: "Declined",
};
const Status = ({ value }: { value: string }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[value] ?? ""}`}>{t(STATUS_LABEL[value] ?? value)}</span>
);

/**
 * Requests for quotation: items asked of several vendors, each vendor's quote entered, compared side by side in the
 * company's currency and awarded per line. The award makes one purchase order per winning vendor, pending approval.
 */
export default function RfqPage() {
  const currencyList = useMemo(() => currencies(), []);
  const { canCreate, canUpdate } = usePermissions("PURCHASE");
  const [rfqs, setRfqs] = useState<Rfq[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [shown, setShown] = useState<Rfq | null>(null);
  const [quote, setQuote] = useState<QuoteForm | null>(null);
  const [emailing, setEmailing] = useState<RfqVendor | null>(null);
  const [awards, setAwards] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    rfqApi.list().then(setRfqs).catch((err) => {
      setRfqs([]);
      ToasterService.error("Requests for quotation could not be loaded", errorText(err, "Is the purchase service running?"));
    });
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/vendors").then((r) => setVendors(asArray<Vendor>(r.data))).catch(() => undefined);
    axios.get("/v1/api/common/products").then((r) => setProducts(asArray<Product>(r.data))).catch(() => undefined);
    axios.get("/v1/api/purchase/purchase-requisitions").then((r) =>
      setRequisitions(asArray<Requisition>(r.data).filter((q) => q.status === "APPROVED" || q.status === "ORDERED"))).catch(() => undefined);
  }, [load]);

  const vendorRecord = (row: RfqVendor) => vendors.find((v) => v.id === row.vendorId) ?? null;

  const show = (rfq: Rfq) => {
    setForm(null);
    setQuote(null);
    setShown(rfq);
    setAwards({});
  };

  const startNew = () => {
    setShown(null);
    setForm({ id: null, title: "", rfqDate: todayIso(), responseDueDate: "", requisitionId: "", notes: "", lines: [lineRow()], vendorIds: [] });
  };

  const edit = (rfq: Rfq) => {
    setShown(null);
    setForm({
      id: rfq.id, title: rfq.title ?? "", rfqDate: rfq.rfqDate, responseDueDate: rfq.responseDueDate ?? "",
      requisitionId: rfq.requisitionId ? String(rfq.requisitionId) : "", notes: rfq.notes ?? "",
      lines: rfq.lines.map((l) => lineRow(String(l.productId), String(l.quantity), l.remarks ?? "")),
      vendorIds: rfq.vendors.map((v) => v.vendorId),
    });
  };

  const chooseRequisition = (value: string) => {
    if (!form) return;
    const requisition = requisitions.find((q) => String(q.id) === value);
    setForm({
      ...form, requisitionId: value,
      lines: requisition?.items?.length
        ? requisition.items.map((i) => lineRow(String(i.productId ?? ""), String(i.quantity ?? ""), i.remarks ?? ""))
        : form.lines,
    });
  };

  const setLine = (key: string, patch: Partial<LineRow>) =>
    setForm((f) => (f ? { ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : f));

  const save = async () => {
    if (!form) return;
    if (form.lines.length === 0 || form.lines.some((l) => !l.productId || !(Number(l.quantity) > 0))) {
      ToasterService.error("Each item needs a product and a quantity above zero.");
      return;
    }
    if (form.vendorIds.length === 0) {
      ToasterService.error("Choose the vendors to ask.");
      return;
    }
    setBusy(true);
    try {
      const saved = await rfqApi.save(form.id, {
        title: form.title.trim() || null, rfqDate: form.rfqDate || null, responseDueDate: form.responseDueDate || null,
        requisitionId: form.requisitionId ? Number(form.requisitionId) : null, notes: form.notes.trim() || null,
        lines: form.lines.map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity), remarks: l.remarks.trim() || null })),
        vendorIds: form.vendorIds,
      });
      ToasterService.success(form.id ? "Request for quotation saved." : "Request for quotation drafted: send it to the vendors.");
      show(saved);
      load();
    } catch (err) {
      ToasterService.error("The request for quotation could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  // Runs an action on the shown RFQ and shows its new state
  const act = async (action: () => Promise<Rfq>, failure: string) => {
    setBusy(true);
    try {
      const next = await action();
      show(next);
      load();
      return next;
    } catch (err) {
      ToasterService.error(failure, errorText(err, "Please try again."));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const startQuote = (rfq: Rfq, vendor: RfqVendor) => {
    setQuote({
      vendor, quoteReference: vendor.quoteReference ?? "", quoteDate: vendor.quoteDate ?? todayIso(), validUntil: vendor.validUntil ?? "",
      currency: vendor.currency ?? companyCurrency(), notes: vendor.notes ?? "",
      lines: rfq.lines.map((line) => {
        const offer = line.offers.find((o) => o.rfqVendorId === vendor.id);
        return { rfqLineId: line.id, unitPrice: offer ? String(offer.unitPrice) : "", leadTimeDays: offer?.leadTimeDays != null ? String(offer.leadTimeDays) : "", remarks: offer?.remarks ?? "" };
      }),
    });
  };

  const saveQuote = async (declined: boolean) => {
    if (!shown || !quote) return;
    if (!declined && !quote.lines.some((l) => l.unitPrice !== "")) {
      ToasterService.error("Enter a price for at least one item, or mark the vendor as declined.");
      return;
    }
    const saved = await act(() => rfqApi.quote(shown.id, quote.vendor.id, {
      quoteReference: quote.quoteReference.trim() || null, quoteDate: quote.quoteDate || null, validUntil: quote.validUntil || null,
      currency: quote.currency.trim() || null, notes: quote.notes.trim() || null, declined,
      lines: declined ? [] : quote.lines.map((l) => ({
        rfqLineId: l.rfqLineId, unitPrice: l.unitPrice === "" ? null : Number(l.unitPrice),
        leadTimeDays: l.leadTimeDays === "" ? null : Number(l.leadTimeDays), remarks: l.remarks.trim() || null,
      })),
    }), "The quote could not be saved");
    if (saved) ToasterService.success(declined ? "Marked as declined." : "Quote saved.");
  };

  const pickBest = () => {
    if (!shown) return;
    const picks: Record<number, number> = {};
    shown.lines.forEach((line) => {
      const best = line.offers.find((o) => o.best);
      if (best) picks[line.id] = best.rfqVendorId;
    });
    setAwards(picks);
  };

  const award = async () => {
    if (!shown) return;
    const lines = Object.entries(awards).map(([rfqLineId, rfqVendorId]) => ({ rfqLineId: Number(rfqLineId), rfqVendorId }));
    if (lines.length === 0) {
      ToasterService.error("Choose the vendor for at least one item.");
      return;
    }
    const vendorCount = new Set(lines.map((l) => l.rfqVendorId)).size;
    if (!window.confirm(t("Award {items} item(s) of {total}? This makes {orders} purchase order(s) pending approval and closes the RFQ.", { items: lines.length, total: shown.lines.length, orders: vendorCount }))) return;
    const saved = await act(() => rfqApi.award(shown.id, lines), "The award could not be made");
    if (saved) ToasterService.success(`${t("Purchase orders raised")}: ${saved.purchaseOrders.join(", ")}`);
  };

  const cancel = async () => {
    if (!shown || !window.confirm(t("Cancel {number}?", { number: shown.rfqNumber }))) return;
    await act(() => rfqApi.cancel(shown.id), "The request for quotation could not be cancelled");
  };

  const open = shown != null && (shown.status === "DRAFT" || shown.status === "SENT");
  const quotedVendors = useMemo(() => shown?.vendors.filter((v) => v.status === "QUOTED") ?? [], [shown]);
  const today = todayIso();
  const company = companyDisplayName();

  return (
    <>
      <PageMeta title={t("Requests for Quotation")} description="Ask several vendors, compare the quotes, award per item" />
      <PageBreadcrumb pageTitle="Requests for Quotation" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {!form && !shown && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Requests for Quotation")}</h2>
              {canCreate && (
                <button type="button" className={PRIMARY_BUTTON} onClick={startNew}>
                  <Plus className="h-4 w-4" /> {t("New request")}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("RFQ")}</th>
                    <th className={TH}>{t("Date")}</th>
                    <th className={TH}>{t("Subject")}</th>
                    <th className={TH}>{t("Reply by")}</th>
                    <th className={`${TH} text-end`}>{t("Items")}</th>
                    <th className={`${TH} text-end`}>{t("Quotes")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH}>{t("Purchase orders")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {rfqs === null ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : rfqs.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">{t("No requests for quotation yet.")}</td></tr>
                  ) : rfqs.map((r) => (
                    <tr key={r.id}>
                      <td className={`${TD} font-medium`}>{r.rfqNumber}</td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(r.rfqDate)}</td>
                      <td className={TD}>{r.title ?? r.requisitionNumber ?? "—"}</td>
                      <td className={`${TD} whitespace-nowrap`}>{r.responseDueDate ? formatDate(r.responseDueDate) : "—"}</td>
                      <td className={`${TD} text-end`}>{r.lines.length}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>{r.vendors.filter((v) => v.status === "QUOTED").length} / {r.vendors.length}</td>
                      <td className={TD}><Status value={r.status} /></td>
                      <td className={TD}>{r.purchaseOrders.join(", ") || "—"}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        <button type="button" className={ROW_ICON_BUTTON} title={t("Open")} aria-label={t("Open")} onClick={() => show(r)}>
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <h2 className={CARD_TITLE}>{form.id ? t("Edit request for quotation") : t("New request for quotation")}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={LABEL} htmlFor="rfq-title">{t("Subject")}</label>
                <input id="rfq-title" className={INPUT} value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="rfq-date">{t("Date")}</label>
                <input id="rfq-date" type="date" className={INPUT} value={form.rfqDate} onChange={(e) => setForm({ ...form, rfqDate: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="rfq-due">{t("Reply by")}</label>
                <input id="rfq-due" type="date" className={INPUT} value={form.responseDueDate} min={form.rfqDate} onChange={(e) => setForm({ ...form, responseDueDate: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="rfq-req">{t("From requisition (optional)")}</label>
                <select id="rfq-req" className={INPUT} value={form.requisitionId} onChange={(e) => chooseRequisition(e.target.value)}>
                  <option value="">—</option>
                  {requisitions.map((q) => <option key={q.id} value={String(q.id)}>{q.requisitionNumber}</option>)}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={CARD_TITLE}>{t("Items")}</span>
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm({ ...form, lines: [...form.lines, lineRow()] })}>
                  <Plus className="h-4 w-4" /> {t("Add item")}
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Product")}</th>
                      <th className={`${TH} w-32`}>{t("Quantity")}</th>
                      <th className={TH}>{t("Remarks")}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {form.lines.map((l) => (
                      <tr key={l.key}>
                        <td className={TD}>
                          <select className={INPUT} value={l.productId} aria-label={t("Product")} onChange={(e) => setLine(l.key, { productId: e.target.value })}>
                            <option value="">—</option>
                            {products.filter((p) => p.active !== false || String(p.id) === l.productId).map((p) => (
                              <option key={p.id} value={String(p.id)}>{`${p.productCode ?? ""} ${p.productName ?? ""}`.trim()}</option>
                            ))}
                          </select>
                        </td>
                        <td className={TD}><input type="number" min="1" step="1" className={INPUT} value={l.quantity} aria-label={t("Quantity")} onChange={(e) => setLine(l.key, { quantity: e.target.value })} /></td>
                        <td className={TD}><input className={INPUT} value={l.remarks} maxLength={500} aria-label={t("Remarks")} onChange={(e) => setLine(l.key, { remarks: e.target.value })} /></td>
                        <td className={TD}>
                          <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")}
                            onClick={() => setForm({ ...form, lines: form.lines.filter((x) => x.key !== l.key) })}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <span className={CARD_TITLE}>{t("Vendors to ask")} ({form.vendorIds.length})</span>
              <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-800">
                {vendors.filter((v) => v.active !== false || form.vendorIds.includes(Number(v.id))).map((v) => (
                  <label key={v.id} className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
                    <input type="checkbox" checked={form.vendorIds.includes(Number(v.id))}
                      onChange={(e) => setForm({ ...form, vendorIds: e.target.checked ? [...form.vendorIds, Number(v.id)] : form.vendorIds.filter((id) => id !== v.id) })} />
                    {v.name || v.vendorCode}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL} htmlFor="rfq-notes">{t("Notes to the vendors")}</label>
              <textarea id="rfq-notes" rows={2} className={INPUT} value={form.notes} maxLength={1000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>{t("Save")}</button>
            </div>
          </div>
        )}

        {shown && !form && (
          <>
            <div className={`${CARD} space-y-3 p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={`${CARD_TITLE} flex items-center gap-2`}>{shown.rfqNumber} <Status value={shown.status} /></h2>
                <div className="flex flex-wrap gap-2">
                  {open && canUpdate && quotedVendors.length === 0 && (
                    <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => edit(shown)}><Pencil className="h-4 w-4" /> {t("Edit")}</button>
                  )}
                  {open && canUpdate && (
                    <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={cancel}><Ban className="h-4 w-4" /> {t("Cancel RFQ")}</button>
                  )}
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => setShown(null)}>{t("Back to the list")}</button>
                </div>
              </div>
              <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-200">
                <div><span className={LABEL}>{t("Subject")}</span>{shown.title ?? "—"}</div>
                <div><span className={LABEL}>{t("Date")}</span>{formatDate(shown.rfqDate)}</div>
                <div><span className={LABEL}>{t("Reply by")}</span>{shown.responseDueDate ? formatDate(shown.responseDueDate) : "—"}</div>
                <div><span className={LABEL}>{t("Requisition")}</span>{shown.requisitionNumber ?? "—"}</div>
                {shown.notes && <div className="sm:col-span-2 lg:col-span-4"><span className={LABEL}>{t("Notes")}</span>{shown.notes}</div>}
                {shown.purchaseOrders.length > 0 && (
                  <div className="sm:col-span-2 lg:col-span-4"><span className={LABEL}>{t("Purchase orders")}</span>{shown.purchaseOrders.join(", ")}{shown.awardedBy ? ` · ${shown.awardedBy}` : ""}</div>
                )}
              </div>
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <h3 className={`${CARD_TITLE} border-b border-slate-100 px-4 py-3 dark:border-gray-800`}>{t("Vendors")}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Vendor")}</th>
                      <th className={TH}>{t("Status")}</th>
                      <th className={TH}>{t("Sent")}</th>
                      <th className={TH}>{t("Quote")}</th>
                      <th className={TH}>{t("Valid until")}</th>
                      <th className={`${TH} text-end`}>{t("Quoted total")}</th>
                      <th className={TH} aria-label={t("Actions")} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {shown.vendors.map((v) => (
                      <tr key={v.id}>
                        <td className={`${TD} font-medium`}>{v.vendorName}</td>
                        <td className={TD}><Status value={v.status} /></td>
                        <td className={`${TD} whitespace-nowrap`}>{v.sentAt ? `${formatDate(v.sentAt)}${v.sentTo ? ` · ${v.sentTo}` : ""}` : "—"}</td>
                        <td className={TD}>{v.quoteReference ?? (v.status === "QUOTED" && v.quoteDate ? formatDate(v.quoteDate) : "—")}</td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {v.validUntil ? formatDate(v.validUntil) : "—"}
                          {v.validUntil && v.validUntil < today && <span className="ms-2 text-xs font-semibold text-rose-600">{t("Expired")}</span>}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-end`}>
                          {money(v.quotedTotal, v.currency)}
                          {v.quotedTotalCompany != null && v.currency !== shown.companyCurrency && <div className="text-xs text-slate-500">{money(v.quotedTotalCompany, shown.companyCurrency)}</div>}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-end`}>
                          <button type="button" className={ROW_ICON_BUTTON} title={t("Print")} aria-label={t("Print")}
                            onClick={() => void printRfq(shown, v, vendorRecord(v))}><Printer className="h-4 w-4" /></button>
                          {open && canCreate && (
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Email to vendor")} aria-label={t("Email to vendor")} onClick={() => setEmailing(v)}><Mail className="h-4 w-4" /></button>
                          )}
                          {open && canUpdate && !v.sentAt && (
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Mark as sent")} aria-label={t("Mark as sent")} disabled={busy}
                              onClick={() => void act(() => rfqApi.markSent(shown.id, v.id), "Could not mark it as sent")}><Send className="h-4 w-4" /></button>
                          )}
                          {open && canCreate && (
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Enter quote")} aria-label={t("Enter quote")} onClick={() => startQuote(shown, v)}><MessageSquarePlus className="h-4 w-4" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {quote && (
              <div className={`${CARD} space-y-3 p-4`}>
                <h3 className={CARD_TITLE}>{t("Quote from {vendor}", { vendor: quote.vendor.vendorName ?? "" })}</h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                  <div><label className={LABEL} htmlFor="q-ref">{t("Vendor's quote no.")}</label><input id="q-ref" className={INPUT} value={quote.quoteReference} maxLength={100} onChange={(e) => setQuote({ ...quote, quoteReference: e.target.value })} /></div>
                  <div><label className={LABEL} htmlFor="q-date">{t("Quote date")}</label><input id="q-date" type="date" className={INPUT} value={quote.quoteDate} onChange={(e) => setQuote({ ...quote, quoteDate: e.target.value })} /></div>
                  <div><label className={LABEL} htmlFor="q-valid">{t("Valid until")}</label><input id="q-valid" type="date" className={INPUT} value={quote.validUntil} min={quote.quoteDate} onChange={(e) => setQuote({ ...quote, validUntil: e.target.value })} /></div>
                  <div><label className={LABEL} htmlFor="q-cur">{t("Currency")}</label><select id="q-cur" className={INPUT} value={quote.currency} onChange={(e) => setQuote({ ...quote, currency: e.target.value })}>
                    {!currencyList.some((c) => c.code === quote.currency) && <option value={quote.currency}>{quote.currency}</option>}
                    {currencyList.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                  </select></div>
                  <div><label className={LABEL} htmlFor="q-notes">{t("Notes")}</label><input id="q-notes" className={INPUT} value={quote.notes} maxLength={1000} onChange={(e) => setQuote({ ...quote, notes: e.target.value })} /></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr>
                        <th className={TH}>{t("Product")}</th>
                        <th className={`${TH} text-end`}>{t("Quantity")}</th>
                        <th className={`${TH} w-36`}>{t("Unit price")}</th>
                        <th className={`${TH} w-32`}>{t("Lead time (days)")}</th>
                        <th className={TH}>{t("Remarks")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {quote.lines.map((row, i) => {
                        const line = shown.lines.find((l) => l.id === row.rfqLineId);
                        const patch = (p: Partial<QuoteRow>) => setQuote({ ...quote, lines: quote.lines.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                        return (
                          <tr key={row.rfqLineId}>
                            <td className={TD}>{`${line?.productCode ?? ""} ${line?.productName ?? ""}`.trim()}</td>
                            <td className={`${TD} text-end`}>{line?.quantity} {line?.uom ?? ""}</td>
                            <td className={TD}><input type="number" min="0" step="any" className={INPUT} value={row.unitPrice} aria-label={t("Unit price")} onChange={(e) => patch({ unitPrice: e.target.value })} /></td>
                            <td className={TD}><input type="number" min="0" step="1" className={INPUT} value={row.leadTimeDays} aria-label={t("Lead time (days)")} onChange={(e) => patch({ leadTimeDays: e.target.value })} /></td>
                            <td className={TD}><input className={INPUT} value={row.remarks} maxLength={300} aria-label={t("Remarks")} onChange={(e) => patch({ remarks: e.target.value })} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">{t("Leave the price empty for items the vendor did not quote.")}</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setQuote(null)}>{t("Close")}</button>
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => void saveQuote(true)}>{t("Vendor declined")}</button>
                  <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => void saveQuote(false)}>{t("Save quote")}</button>
                </div>
              </div>
            )}

            <div className={`${CARD} overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                <h3 className={CARD_TITLE}>{t("Comparison")}</h3>
                {open && canCreate && quotedVendors.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={SECONDARY_BUTTON} onClick={pickBest}><Trophy className="h-4 w-4" /> {t("Pick the best prices")}</button>
                    <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={award}>{t("Award and raise purchase orders")}</button>
                  </div>
                )}
              </div>
              {quotedVendors.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">{t("No quotes yet. Enter each vendor's quote to compare them here.")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr>
                        <th className={TH}>{t("Item")}</th>
                        <th className={`${TH} text-end`}>{t("Quantity")}</th>
                        {quotedVendors.map((v) => <th key={v.id} className={TH}>{v.vendorName}</th>)}
                        {!open && <th className={TH}>{t("Purchase order")}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {shown.lines.map((line) => (
                        <tr key={line.id}>
                          <td className={TD}>
                            <div className="font-medium">{line.productCode}</div>
                            <div className="text-xs text-slate-500">{line.productName}</div>
                          </td>
                          <td className={`${TD} whitespace-nowrap text-end`}>{line.quantity} {line.uom ?? ""}</td>
                          {quotedVendors.map((v) => {
                            const offer = line.offers.find((o) => o.rfqVendorId === v.id);
                            const won = line.awardedRfqVendorId === v.id;
                            return (
                              <td key={v.id} className={`${TD} ${won ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                                {!offer ? <span className="text-slate-400">{t("Not quoted")}</span> : (
                                  <label className="flex items-start gap-2">
                                    {open && canCreate && (
                                      <input type="radio" name={`award-${line.id}`} className="mt-1" aria-label={`${line.productCode} ${v.vendorName}`}
                                        checked={awards[line.id] === v.id} onChange={() => setAwards({ ...awards, [line.id]: v.id })} />
                                    )}
                                    <span>
                                      <span className="font-medium">{money(offer.unitPrice, offer.currency)}</span>
                                      {offer.best && <span className="ms-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{t("Best")}</span>}
                                      {offer.currency !== shown.companyCurrency && (
                                        <span className="block text-xs text-slate-500">{offer.companyPrice == null ? t("No exchange rate") : money(offer.companyPrice, shown.companyCurrency)}</span>
                                      )}
                                      {offer.leadTimeDays != null && <span className="block text-xs text-slate-500">{t("{days} days", { days: offer.leadTimeDays })}</span>}
                                      {offer.remarks && <span className="block text-xs text-slate-500">{offer.remarks}</span>}
                                    </span>
                                  </label>
                                )}
                              </td>
                            );
                          })}
                          {!open && <td className={TD}>{line.purchaseOrderNumber ?? "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {shown && emailing && (
        <DocumentEmailDialog
          documentLabel="Request for quotation"
          number={shown.rfqNumber}
          endpoint={`${RFQ_BASE}/${shown.id}/vendors/${emailing.id}`}
          recipient="vendor"
          defaultTo={vendorRecord(emailing)?.contactEmail || ""}
          defaultSubject={`Request for quotation ${shown.rfqNumber} from ${company}`}
          defaultMessage={
            `Dear ${vendorRecord(emailing)?.contactName || emailing.vendorName || "Sir/Madam"},\n\n` +
            `Please quote your best price and delivery time for the items in the attached request for quotation ${shown.rfqNumber}` +
            (shown.responseDueDate ? `, by ${formatDate(shown.responseDueDate)}` : "") +
            `.\n\nRegards,\n${company}`
          }
          markSent
          hint="The PDF is attached, as in the print."
          sendLabel="Send to vendor"
          getPdf={() => rfqPdf(shown, emailing, vendorRecord(emailing))}
          onClose={() => setEmailing(null)}
          onSent={(response) => { setEmailing(null); show(response as unknown as Rfq); load(); }}
        />
      )}
    </>
  );
}
