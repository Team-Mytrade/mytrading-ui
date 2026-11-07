import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, CheckCircle2, FileScan, Sparkles, Upload } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { formatDate, formatMoney } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const API = "/v1/api/invoice";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/jpeg,image/png,image/webp,image/gif";
const INPUT =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:bg-[#222222] dark:text-white";
const NORMAL = "border-slate-200 dark:border-gray-700";
const CHECK = "border-amber-400 dark:border-amber-500";
const TH = "px-2 py-1.5 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-2 py-1.5 align-top text-xs text-slate-700 dark:text-gray-200";

interface Status { configured: boolean; enabled: boolean; usedThisMonth: number; monthlyLimit: number | null; resetsOn: string | null; model: string; message: string | null }
interface Line { description: string | null; quantity: number | null; unitPrice: number | null; taxRate: number | null; taxAmount: number | null; lineTotal: number | null }
interface VendorMatch { id: number; code: string; name: string; currency: string | null; taxNumber: string | null; matchedBy: "TAX_NUMBER" | "NAME" }
interface GrnMatch { grnId: number; grnNumber: string; poNumber: string | null; receiptDate: string | null; totalAmount: number | null; currency: string | null; matchedBy: string }
interface Duplicate { id: number; invoiceNumber: string; invoiceDate: string | null; totalAmount: number | null }
interface Draft { vendorId: number | null; invoiceNumber: string | null; invoiceDate: string | null; dueDate: string | null; currency: string | null;
  taxableAmount: number | null; taxAmount: number | null; totalAmount: number | null; referenceNumber: string | null; notes: string | null }
interface Reading {
  fileName: string; isBill: boolean; vendorName: string | null; vendorTaxNumber: string | null; vendorAddress: string | null; buyerName: string | null;
  buyerTaxNumber: string | null; billNumber: string | null; billDate: string | null; dueDate: string | null; currency: string | null;
  purchaseOrderNumber: string | null; paymentTerms: string | null; lines: Line[]; subtotal: number | null; discount: number | null; taxTotal: number | null;
  total: number | null; notes: string | null; unreadable: string[]; warnings: string[]; vendor: VendorMatch | null; duplicate: Duplicate | null;
  suggestedGrn: GrnMatch | null; draft: Draft; model: string; inputTokens: number; outputTokens: number; usedThisMonth: number; monthlyLimit: number | null;
}
interface Vendor { id: number; name: string; currency?: string | null; active?: boolean }
interface Form { vendorId: string; invoiceNumber: string; invoiceDate: string; dueDate: string; currency: string; taxAmount: string; totalAmount: string;
  referenceNumber: string; notes: string }

// Which reading field each form box comes from (to mark the ones that couldn't be read)
const SOURCE: Record<keyof Form, string> = {
  vendorId: "vendorName", invoiceNumber: "billNumber", invoiceDate: "billDate", dueDate: "dueDate", currency: "currency",
  taxAmount: "taxTotal", totalAmount: "total", referenceNumber: "purchaseOrderNumber", notes: "notes",
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/**
 * Read a vendor bill (backlog 7.2.3 step 1): upload the bill's PDF or a photo, Claude reads it, and the bill form comes
 * back filled in with the vendor found, the amounts checked and anything doubtful marked. Nothing is saved until the
 * person creates the bill (or bills the goods receipt it matches).
 */
export default function BillReader() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const canCreate = hasPermission(access, "INVOICE:CREATE");
  const [status, setStatus] = useState<Status | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  const loadStatus = useCallback(() => {
    axios.get<Status>(`${API}/bill-reader/status`).then((r) => setStatus(r.data)).catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    loadStatus();
    axios.get("/v1/api/common/vendors").then((r) => {
      const rows: Vendor[] = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.content) ? r.data.content : [];
      setVendors(rows.filter((v) => v.active !== false));
    }).catch(() => setVendors([]));
  }, [loadStatus]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const choose = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) {
      ToasterService.error(t("The file is too large"), t("Upload a file of 10 MB or less: a smaller scan or only the bill's pages."));
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setReading(null);
    setForm(null);
  };

  const read = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await axios.post<Reading>(`${API}/bill-reader/read`, body, { headers: { "Content-Type": "multipart/form-data" } });
      setReading(data);
      const d = data.draft;
      setForm({
        vendorId: str(d.vendorId), invoiceNumber: str(d.invoiceNumber), invoiceDate: str(d.invoiceDate), dueDate: str(d.dueDate),
        currency: str(d.currency), taxAmount: str(d.taxAmount), totalAmount: str(d.totalAmount), referenceNumber: str(d.referenceNumber), notes: str(d.notes),
      });
      loadStatus();
    } catch (err) {
      ToasterService.error(t("The bill could not be read"), apiError(err, t("Please try again.")));
      loadStatus();
    } finally {
      setBusy(false);
    }
  };

  // After a bill is created: ready for the next one
  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setReading(null);
    setForm(null);
  };

  const unreadable = useMemo(() => new Set(reading?.unreadable ?? []), [reading]);
  const marked = (field: keyof Form) => unreadable.has(SOURCE[field]) || (field === "vendorId" && !reading?.vendor);
  const set = (change: Partial<Form>) => setForm((f) => (f ? { ...f, ...change } : f));

  const createBill = async () => {
    if (!form || !reading) return;
    const total = Number(form.totalAmount);
    const tax = form.taxAmount === "" ? 0 : Number(form.taxAmount);
    if (!form.vendorId) return ToasterService.error(t("Choose the vendor"));
    if (!form.invoiceNumber.trim()) return ToasterService.error(t("Enter the vendor's invoice number"));
    if (!(total > 0)) return ToasterService.error(t("Enter the bill amount"));
    if (!(tax >= 0) || tax >= total) return ToasterService.error(t("The VAT must be less than the bill amount, which includes it"));
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/purchase-invoices`, {
        invoiceNumber: form.invoiceNumber.trim(), invoiceDate: form.invoiceDate || undefined, dueDate: form.dueDate || undefined,
        totalAmount: total, taxAmount: tax, reverseCharge: false, currency: form.currency.trim() || undefined,
        referenceNumber: form.referenceNumber.trim() || undefined, notes: form.notes.trim() || undefined, vendor: { id: Number(form.vendorId) },
      });
      ToasterService.success(t("Bill created"), t("Bill {number} is in the books.", { number: data?.invoiceNumber ?? form.invoiceNumber }));
      clear();
    } catch (err) {
      ToasterService.error(t("The bill could not be created"), apiError(err, t("Please try again.")));
    } finally {
      setSaving(false);
    }
  };

  const billGrn = async () => {
    if (!form || !reading?.suggestedGrn) return;
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/purchase-invoices/from-grn`, {
        grnId: reading.suggestedGrn.grnId, invoiceNumber: form.invoiceNumber.trim(), invoiceDate: form.invoiceDate || null,
        dueDate: form.dueDate || null, vendorInvoiceAmount: form.totalAmount === "" ? null : Number(form.totalAmount), notes: form.notes.trim() || null,
      });
      ToasterService.success(t("Bill created"), t("Bill {number} is in the books for goods receipt {grn}.", { number: data?.invoiceNumber ?? form.invoiceNumber, grn: reading.suggestedGrn.grnNumber }));
      clear();
    } catch (err) {
      ToasterService.error(t("The bill could not be created"), apiError(err, t("Please try again.")));
    } finally {
      setSaving(false);
    }
  };

  const ready = status?.configured && status.enabled && !status.message;
  const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
  const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatMoney(v, { currency: reading?.currency ?? undefined }));
  const field = (key: keyof Form, label: string, type = "text") => form && (
    <label className="block text-xs font-semibold text-slate-600 dark:text-gray-300">
      {t(label)}{marked(key) && <span className="ms-1 font-normal text-amber-600">· {t("check")}</span>}
      <input className={`${INPUT} ${marked(key) ? CHECK : NORMAL} mt-1`} type={type} value={form[key]} disabled={!canCreate}
        onChange={(e) => set({ [key]: e.target.value } as Partial<Form>)} />
    </label>
  );

  return (
    <>
      <PageMeta title={t("Read a Vendor Bill")} description="A vendor bill read with AI into the bill form" />
      <PageBreadcrumb pageTitle="Read a Vendor Bill" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          {t("Upload a vendor's bill as a PDF or a photo. Claude (Anthropic's AI) reads it in English or Arabic and fills in the bill: the vendor is found by its tax number, the amounts are checked and anything doubtful is marked. Nothing is saved until you create the bill.")}
        </p>

        {status && (
          <div className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${ready
            ? "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-200"
            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"}`}>
            {ready ? <Sparkles className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {ready
              ? status.monthlyLimit != null
                ? t("{used} of {limit} AI uses this month.", { used: status.usedThisMonth, limit: status.monthlyLimit })
                : t("{used} AI uses this month.", { used: status.usedThisMonth })
              : t(status.message ?? "AI bill reading isn't available.")}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className={`${CARD} space-y-3 p-4`}>
            <h2 className={`${CARD_TITLE} flex items-center gap-1.5`}><FileScan className="h-4 w-4 text-slate-400" />{t("The bill")}</h2>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm ${dragging
                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20" : "border-slate-200 text-slate-500 dark:border-gray-700 dark:text-gray-400"}`}>
              <Upload className="h-5 w-5" />
              <span>{file ? file.name : t("Drop the PDF or photo here, or choose a file")}</span>
              <span className="text-xs text-slate-400">{t("PDF, JPG, PNG or WebP, up to 10 MB")}</span>
              <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
            </label>
            {preview && (isPdf
              ? <iframe title={t("The bill")} src={preview} className="h-[28rem] w-full rounded-lg border border-slate-200 dark:border-gray-700" />
              : <img src={preview} alt={t("The bill")} className="max-h-[28rem] w-full rounded-lg border border-slate-200 object-contain dark:border-gray-700" />)}
            <div className="flex justify-end">
              <button type="button" className={PRIMARY_BUTTON} disabled={!file || busy || !ready || !canCreate} onClick={read}>
                <Sparkles className={`h-4 w-4 ${busy ? "animate-pulse" : ""}`} /> {busy ? t("Reading...") : t("Read the bill")}
              </button>
            </div>
            <p className="text-xs text-slate-400">{t("The file is sent to Anthropic to be read and isn't kept in MyTrade.")}</p>
          </section>

          <section className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t("What was read")}</h2>
            {!reading || !form ? (
              <p className="text-sm text-slate-500">{t("The reading appears here: check it, then create the bill.")}</p>
            ) : (
              <>
                {reading.warnings.length > 0 && (
                  <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {reading.warnings.map((w) => <li key={w} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />{w}</li>)}
                  </ul>
                )}
                {reading.vendor && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {reading.vendor.matchedBy === "TAX_NUMBER"
                      ? t("Vendor {name} found by its tax number.", { name: reading.vendor.name })
                      : t("Vendor {name} found by its name; check it's the right one.", { name: reading.vendor.name })}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-gray-300 sm:col-span-2">
                    {t("Vendor")}{marked("vendorId") && <span className="ms-1 font-normal text-amber-600">· {t("check")}</span>}
                    <select className={`${INPUT} ${marked("vendorId") ? CHECK : NORMAL} mt-1`} value={form.vendorId} disabled={!canCreate}
                      onChange={(e) => set({ vendorId: e.target.value, currency: form.currency || (vendors.find((v) => String(v.id) === e.target.value)?.currency ?? "") })}>
                      <option value="">{t("Choose the vendor")}</option>
                      {vendors.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                    </select>
                    {reading.vendorName && <span className="mt-0.5 block font-normal text-slate-400" dir="auto">{t("On the bill")}: {reading.vendorName}{reading.vendorTaxNumber ? ` · ${reading.vendorTaxNumber}` : ""}</span>}
                  </label>
                  {field("invoiceNumber", "Vendor's invoice number")}
                  {field("currency", "Currency")}
                  {field("invoiceDate", "Bill date", "date")}
                  {field("dueDate", "Due date", "date")}
                  {field("totalAmount", "Bill amount (with VAT)", "number")}
                  {field("taxAmount", "VAT on the bill", "number")}
                  {field("referenceNumber", "Reference (PO number)")}
                  {field("notes", "Notes")}
                </div>

                {reading.lines.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                    <table className="w-full min-w-[30rem] divide-y divide-slate-100 dark:divide-gray-800">
                      <thead className="bg-slate-50 dark:bg-[#222222]">
                        <tr><th className={TH}>{t("Line")}</th><th className={`${TH} text-end`}>{t("Qty")}</th><th className={`${TH} text-end`}>{t("Unit price")}</th>
                          <th className={`${TH} text-end`}>{t("VAT %")}</th><th className={`${TH} text-end`}>{t("Line total")}</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                        {reading.lines.map((l, i) => (
                          <tr key={i}>
                            <td className={TD} dir="auto">{l.description ?? "—"}</td>
                            <td className={`${TD} text-end`}>{l.quantity ?? "—"}</td>
                            <td className={`${TD} text-end`}>{l.unitPrice ?? "—"}</td>
                            <td className={`${TD} text-end`}>{l.taxRate ?? "—"}</td>
                            <td className={`${TD} text-end`}>{l.lineTotal ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  {t("Subtotal {subtotal}, VAT {tax}, total {total}", { subtotal: money(reading.subtotal), tax: money(reading.taxTotal), total: money(reading.total) })}
                  {reading.paymentTerms ? ` · ${reading.paymentTerms}` : ""}
                </p>

                {reading.duplicate ? (
                  <p className="text-sm text-rose-700 dark:text-rose-300">
                    {t("Bill {number} from this vendor is already in the books ({date}).", { number: reading.duplicate.invoiceNumber, date: formatDate(reading.duplicate.invoiceDate) })}{" "}
                    <button type="button" className="underline decoration-dotted" onClick={() => navigate("/purchaseInvoices")}>{t("Purchase Invoices")}</button>
                  </p>
                ) : canCreate && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-gray-800">
                    {reading.suggestedGrn && (
                      <span className="me-auto text-xs text-slate-500">
                        {t("Goods receipt {grn} ({po}) matches this bill.", { grn: reading.suggestedGrn.grnNumber, po: reading.suggestedGrn.poNumber ?? "—" })}
                      </span>
                    )}
                    {reading.suggestedGrn && (
                      <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={billGrn}>
                        {t("Bill goods receipt {grn}", { grn: reading.suggestedGrn.grnNumber })}
                      </button>
                    )}
                    <button type="button" className={reading.suggestedGrn ? SECONDARY_BUTTON : PRIMARY_BUTTON} disabled={saving} onClick={createBill}>
                      {t("Create the bill")}
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">{t("Read by {model}; {used} of {limit} readings this month.", {
                  model: reading.model, used: reading.usedThisMonth, limit: reading.monthlyLimit ?? "∞" })}</p>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
