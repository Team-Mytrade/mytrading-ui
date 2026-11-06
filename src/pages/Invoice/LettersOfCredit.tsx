import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { Banknote, CheckCircle2, Eye, FilePen, Lock, Pencil, Plus, Save, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { companyCurrency, formatNumber } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { type BankAccount, bankAccountLabel, useBankAccounts } from "./bankShared";
import { t } from "../../i18n/i18n";

const API = `${INVOICE_API}/letters-of-credit`;
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

const DOCUMENT_TYPES: Record<string, string> = {
  BILL_OF_LADING: "Bill of lading",
  AIRWAY_BILL: "Airway bill",
  COMMERCIAL_INVOICE: "Commercial invoice",
  PACKING_LIST: "Packing list",
  CERTIFICATE_OF_ORIGIN: "Certificate of origin",
  INSURANCE: "Insurance certificate",
  INSPECTION: "Inspection certificate",
  OTHER: "Other document",
};
const STATUS_TONES: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-700",
  OPEN: "bg-cyan-50 text-cyan-700",
  CLOSED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};
const STATUS_LABELS: Record<string, string> = { DRAFT: "Draft", OPEN: "Open", CLOSED: "Closed", CANCELLED: "Cancelled" };
const DOC_STATUS: Record<string, string> = { REQUIRED: "Awaited", RECEIVED: "Received in order", DISCREPANT: "Discrepant" };

interface LcDocument { documentType: string; description: string | null; originals: number | null; copies: number | null; status: string; receivedOn: string | null; discrepancy: string | null }
interface Drawing { number: number; presentedOn: string; maturityDate: string | null; paidOn: string; amount: number; marginUsed: number; charges: number; reference: string | null; billNumbers: string | null }
interface Lc {
  id: number; lcNumber: string; status: string; expired: boolean; lcType: string; usanceDays: number | null; purchaseOrderId: number; poNumber: string | null;
  vendorId: number | null; vendorName: string | null; bankAccountId: number; issuingBank: string | null; advisingBank: string | null; currency: string;
  amount: number; tolerancePercent: number; maximumAmount: number; drawnAmount: number; availableAmount: number; issueDate: string; expiryDate: string;
  latestShipmentDate: string | null; expiryPlace: string | null; incoterm: string | null; partialShipments: boolean; transhipment: boolean;
  exchangeRate: number | null; marginPercent: number; marginAmount: number; marginReleased: number; marginHeld: number; openingCharges: number;
  amendments: number; closedOn: string | null; closeReason: string | null; notes: string | null; documents: LcDocument[]; drawings: Drawing[];
}
interface Order { id: number; poNumber: string; status: string; totalAmount: number | null; currency: string | null; vendor?: { id: number; name?: string } }
interface Payable { id: number; balance: number; purchaseInvoice?: { id: number; invoiceNumber?: string; currency?: string; poNumber?: string | null }; vendor?: { id: number } }

type DocRow = { documentType: string; description: string; originals: string; copies: string; status: string; receivedOn: string; discrepancy: string };
type Form = {
  id: number | null; lcNumber: string; lcType: string; usanceDays: string; purchaseOrderId: string; bankAccountId: string; advisingBank: string; amount: string;
  tolerancePercent: string; issueDate: string; expiryDate: string; latestShipmentDate: string; expiryPlace: string; incoterm: string;
  partialShipments: boolean; transhipment: boolean; marginPercent: string; openingCharges: string; notes: string; documents: DocRow[];
};
type Action = { kind: "pay" | "amend" | "close"; lc: Lc };

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const docRow = (d?: LcDocument): DocRow => ({
  documentType: d?.documentType ?? "BILL_OF_LADING", description: d?.description ?? "", originals: d?.originals != null ? String(d.originals) : "",
  copies: d?.copies != null ? String(d.copies) : "", status: d?.status ?? "REQUIRED", receivedOn: d?.receivedOn ?? "", discrepancy: d?.discrepancy ?? "",
});
const docBody = (rows: DocRow[]) => rows.map((d) => ({
  documentType: d.documentType, description: d.description.trim() || null, originals: num(d.originals), copies: num(d.copies),
  status: d.status, receivedOn: d.receivedOn || null, discrepancy: d.discrepancy.trim() || null,
}));
const STARTER_DOCS: DocRow[] = [
  { ...docRow(), documentType: "BILL_OF_LADING", description: "Full set, clean on board", originals: "3", copies: "3" },
  { ...docRow(), documentType: "COMMERCIAL_INVOICE", originals: "1", copies: "3" },
  { ...docRow(), documentType: "PACKING_LIST", originals: "1", copies: "3" },
  { ...docRow(), documentType: "CERTIFICATE_OF_ORIGIN", originals: "1", copies: "1" },
];

/**
 * Letters of credit (backlog 7.2.1 step 3): one per approved purchase order, opened by the company's bank. Opening it
 * holds the margin from the bank account; each payment the bank makes under it pays the order's bills and brings its
 * share of the margin back; closing it releases the rest. The documents the vendor must present are tracked on it.
 */
export default function LettersOfCredit() {
  const [params, setParams] = useSearchParams();
  const { canCreate, canUpdate, canDelete, canApprove } = usePermissions("INVOICE");
  const banks = useBankAccounts();
  const [rows, setRows] = useState<Lc[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [shown, setShown] = useState<Lc | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Lc[]>(API).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setRows([]);
      ToasterService.error("Letters of credit could not be loaded", apiError(err, "Is the finance service running?"));
    });
  }, []);

  useEffect(() => {
    load();
    axios.get<Order[]>("/v1/api/purchase/purchase-orders").then((r) => setOrders(Array.isArray(r.data) ? r.data : [])).catch(() => setOrders([]));
  }, [load]);

  const bankList = useMemo(() => (banks ?? []).filter((b) => b.kind === "BANK"), [banks]);
  const eligible = useMemo(() => orders.filter((o) => ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(o.status)), [orders]);

  const blank = useCallback((poId = ""): Form => {
    const po = orders.find((o) => String(o.id) === poId);
    const bank = bankList.find((b) => b.active && b.defaultAccount) ?? bankList.find((b) => b.active);
    return {
      id: null, lcNumber: "", lcType: "SIGHT", usanceDays: "", purchaseOrderId: poId, bankAccountId: bank ? String(bank.id) : "", advisingBank: "",
      amount: po?.totalAmount != null ? String(po.totalAmount) : "", tolerancePercent: "", issueDate: todayInput(), expiryDate: "", latestShipmentDate: "",
      expiryPlace: "", incoterm: "", partialShipments: true, transhipment: true, marginPercent: "", openingCharges: "", notes: "", documents: STARTER_DOCS,
    };
  }, [orders, bankList]);

  // ?po= starts an LC for that order (from the purchase order)
  const fromOrder = params.get("po");
  useEffect(() => {
    if (!fromOrder || orders.length === 0) return;
    setShown(null);
    setForm(blank(fromOrder));
    setParams({}, { replace: true });
  }, [fromOrder, orders.length, blank, setParams]);

  const edit = (lc: Lc) => {
    setShown(null);
    setForm({
      id: lc.id, lcNumber: lc.lcNumber, lcType: lc.lcType, usanceDays: lc.usanceDays != null ? String(lc.usanceDays) : "", purchaseOrderId: String(lc.purchaseOrderId),
      bankAccountId: String(lc.bankAccountId), advisingBank: lc.advisingBank ?? "", amount: String(lc.amount), tolerancePercent: String(lc.tolerancePercent),
      issueDate: lc.issueDate, expiryDate: lc.expiryDate, latestShipmentDate: lc.latestShipmentDate ?? "", expiryPlace: lc.expiryPlace ?? "", incoterm: lc.incoterm ?? "",
      partialShipments: lc.partialShipments, transhipment: lc.transhipment, marginPercent: String(lc.marginPercent), openingCharges: String(lc.openingCharges),
      notes: lc.notes ?? "", documents: lc.documents.map(docRow),
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.lcNumber.trim() || !form.purchaseOrderId || !form.bankAccountId || !form.amount || !form.expiryDate) {
      ToasterService.error("Enter the LC number, order, bank, amount and expiry date.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        lcNumber: form.lcNumber.trim(), lcType: form.lcType, usanceDays: form.lcType === "USANCE" ? num(form.usanceDays) : null,
        purchaseOrderId: Number(form.purchaseOrderId), bankAccountId: Number(form.bankAccountId), advisingBank: form.advisingBank.trim() || null,
        amount: Number(form.amount), tolerancePercent: num(form.tolerancePercent), issueDate: form.issueDate || null, expiryDate: form.expiryDate,
        latestShipmentDate: form.latestShipmentDate || null, expiryPlace: form.expiryPlace.trim() || null, incoterm: form.incoterm.trim() || null,
        partialShipments: form.partialShipments, transhipment: form.transhipment, marginPercent: num(form.marginPercent),
        openingCharges: num(form.openingCharges), notes: form.notes.trim() || null, documents: docBody(form.documents),
      };
      const res = form.id ? await axios.put<Lc>(`${API}/${form.id}`, body) : await axios.post<Lc>(API, body);
      ToasterService.success(form.id ? "Letter of credit saved." : "Draft saved: open it once the bank has issued it.");
      setForm(null);
      setShown(res.data);
      load();
    } catch (err) {
      ToasterService.error("The letter of credit could not be saved", apiError(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const run = async (request: () => Promise<{ data: Lc }>, done: string, failed: string) => {
    setBusy(true);
    try {
      const res = await request();
      ToasterService.success(done);
      setShown(res.data);
      setAction(null);
      load();
    } catch (err) {
      ToasterService.error(failed, apiError(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const openLc = (lc: Lc) => {
    if (!window.confirm(t("The bank has issued LC {number}? Its margin of {margin} and charges of {charges} leave {bank}.", {
      number: lc.lcNumber, margin: money(lc.marginAmount, companyCurrency()), charges: money(lc.openingCharges, companyCurrency()), bank: lc.issuingBank ?? "",
    }))) return;
    run(() => axios.post<Lc>(`${API}/${lc.id}/open`), "Letter of credit opened.", "The letter of credit could not be opened");
  };

  const remove = async (lc: Lc) => {
    if (!window.confirm(t("Delete the draft LC {number}?", { number: lc.lcNumber }))) return;
    try {
      await axios.delete(`${API}/${lc.id}`);
      setShown(null);
      load();
    } catch (err) {
      ToasterService.error("The letter of credit could not be deleted", apiError(err, "Please try again."));
    }
  };

  const saveDocuments = (lc: Lc, docs: DocRow[]) =>
    run(() => axios.put<Lc>(`${API}/${lc.id}`, { lcNumber: lc.lcNumber, purchaseOrderId: lc.purchaseOrderId, documents: docBody(docs) }),
      "Documents updated.", "The documents could not be saved");

  return (
    <>
      <PageMeta title={t("Letters of Credit")} description="Letters of credit for purchase orders" />
      <PageBreadcrumb pageTitle="Letters of Credit" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {!form && !shown && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <div>
                <h2 className={CARD_TITLE}>{t("Letters of credit")}</h2>
                <p className="text-xs text-slate-500">{t("Opened by your bank for a purchase order: the margin is held from the bank account and released as the bank pays the vendor.")}</p>
              </div>
              {canCreate && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm(blank())}><Plus className="h-4 w-4" /> {t("New letter of credit")}</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("LC no.")}</th>
                    <th className={TH}>{t("Order")}</th>
                    <th className={TH}>{t("Vendor")}</th>
                    <th className={TH}>{t("Bank")}</th>
                    <th className={`${TH} text-end`}>{t("Amount")}</th>
                    <th className={`${TH} text-end`}>{t("Paid")}</th>
                    <th className={`${TH} text-end`}>{t("Margin held")}</th>
                    <th className={TH}>{t("Expiry")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {rows === null ? (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-400">{t("No letters of credit yet.")}</td></tr>
                  ) : rows.map((lc) => (
                    <tr key={lc.id}>
                      <td className={`${TD} font-medium`}>{lc.lcNumber}</td>
                      <td className={TD}>{lc.poNumber}</td>
                      <td className={TD}>{lc.vendorName}</td>
                      <td className={TD}>{lc.issuingBank}</td>
                      <td className={`${TD} text-end whitespace-nowrap`}>{money(lc.amount, lc.currency)}</td>
                      <td className={`${TD} text-end whitespace-nowrap`}>{money(lc.drawnAmount, lc.currency)}</td>
                      <td className={`${TD} text-end whitespace-nowrap`}>{money(lc.marginHeld, companyCurrency())}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {dateLabel(lc.expiryDate)}
                        {lc.expired && <span className="ms-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t("Expired")}</span>}
                      </td>
                      <td className={TD}><StatusPill status={lc.status} /></td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        <button type="button" className={ROW_ICON_BUTTON} title={t("View")} aria-label={t("View")} onClick={() => setShown(lc)}><Eye className="h-4 w-4" /></button>
                        {lc.status === "DRAFT" && canUpdate && <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => edit(lc)}><Pencil className="h-4 w-4" /></button>}
                        {lc.status === "DRAFT" && canDelete && <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => remove(lc)}><Trash2 className="h-4 w-4" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {form && (
          <LcForm form={form} setForm={setForm} orders={eligible} allOrders={orders} banks={bankList} busy={busy} onSave={save}
            onClose={() => setForm(null)} />
        )}

        {!form && shown && (
          <LcDetail lc={shown} busy={busy} canUpdate={canUpdate} canApprove={canApprove} canDelete={canDelete}
            onBack={() => setShown(null)} onEdit={() => edit(shown)} onOpen={() => openLc(shown)} onDelete={() => remove(shown)}
            onAction={(kind) => setAction({ kind, lc: shown })} onSaveDocuments={(docs) => saveDocuments(shown, docs)} />
        )}

        {action && (
          <ActionDialog action={action} busy={busy} onCancel={() => setAction(null)}
            onSubmit={(path, body, done, failed) => run(() => axios.post<Lc>(`${API}/${action.lc.id}/${path}`, body), done, failed)} />
        )}
      </div>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONES[status] ?? "bg-slate-100 text-slate-600"}`}>{t(STATUS_LABELS[status] ?? status)}</span>;
}

/** The draft: terms, order, bank, margin and the documents the vendor must present. */
function LcForm({ form, setForm, orders, allOrders, banks, busy, onSave, onClose }: {
  form: Form; setForm: (f: Form) => void; orders: Order[]; allOrders: Order[]; banks: BankAccount[]; busy: boolean;
  onSave: () => void; onClose: () => void;
}) {
  const po = allOrders.find((o) => String(o.id) === form.purchaseOrderId);
  const currency = po?.currency || companyCurrency();
  const margin = form.amount && form.marginPercent ? (Number(form.amount) * Number(form.marginPercent)) / 100 : null;
  const setDoc = (i: number, patch: Partial<DocRow>) => setForm({ ...form, documents: form.documents.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  return (
    <div className={`${CARD} space-y-4 p-4`}>
      <h2 className={CARD_TITLE}>{form.id ? `${t("Letter of credit")} ${form.lcNumber} (${t("Draft")})` : t("New letter of credit")}</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="lc-number">{t("LC number (from the bank)")} *</label>
          <input id="lc-number" className={`${INPUT} uppercase`} maxLength={40} value={form.lcNumber} onChange={(e) => setForm({ ...form, lcNumber: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-po">{t("Purchase order")} *</label>
          <select id="lc-po" className={INPUT} value={form.purchaseOrderId} onChange={(e) => {
            const next = allOrders.find((o) => String(o.id) === e.target.value);
            setForm({ ...form, purchaseOrderId: e.target.value, amount: next?.totalAmount != null ? String(next.totalAmount) : form.amount });
          }}>
            <option value="">{t("Choose…")}</option>
            {orders.map((o) => <option key={o.id} value={String(o.id)}>{o.poNumber} · {o.vendor?.name ?? ""} · {money(o.totalAmount, o.currency)}</option>)}
            {form.purchaseOrderId && !orders.some((o) => String(o.id) === form.purchaseOrderId) && <option value={form.purchaseOrderId}>{po?.poNumber ?? `#${form.purchaseOrderId}`}</option>}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-bank">{t("Issuing bank (your account)")} *</label>
          <select id="lc-bank" className={INPUT} value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
            <option value="">{t("Choose…")}</option>
            {banks.filter((b) => b.active || String(b.id) === form.bankAccountId).map((b) => <option key={b.id} value={String(b.id)}>{bankAccountLabel(b)}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-type">{t("Payable")}</label>
          <select id="lc-type" className={INPUT} value={form.lcType} onChange={(e) => setForm({ ...form, lcType: e.target.value })}>
            <option value="SIGHT">{t("At sight")}</option>
            <option value="USANCE">{t("Usance (days after presentation)")}</option>
          </select>
        </div>
        {form.lcType === "USANCE" && (
          <div>
            <label className={LABEL} htmlFor="lc-days">{t("Usance days")} *</label>
            <input id="lc-days" type="number" min="1" max="360" className={INPUT} value={form.usanceDays} onChange={(e) => setForm({ ...form, usanceDays: e.target.value })} />
          </div>
        )}
        <div>
          <label className={LABEL} htmlFor="lc-advising">{t("Advising bank (vendor's side)")}</label>
          <input id="lc-advising" className={INPUT} maxLength={150} value={form.advisingBank} onChange={(e) => setForm({ ...form, advisingBank: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-amount">{t("Amount")} ({currency}) *</label>
          <input id="lc-amount" type="number" min="0" step="any" className={INPUT} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-tol">{t("Tolerance ± %")}</label>
          <input id="lc-tol" type="number" min="0" max="100" step="any" className={INPUT} placeholder="0" value={form.tolerancePercent}
            onChange={(e) => setForm({ ...form, tolerancePercent: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-margin">{t("Margin %")}</label>
          <input id="lc-margin" type="number" min="0" max="100" step="any" className={INPUT} placeholder="0" value={form.marginPercent}
            onChange={(e) => setForm({ ...form, marginPercent: e.target.value })} />
          {margin != null && <p className="mt-1 text-[11px] text-slate-500">{t("Held by the bank: {amount}, at the rate on the issue date", { amount: money(margin, currency) })}</p>}
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-charges">{t("Opening charges")} ({companyCurrency()})</label>
          <input id="lc-charges" type="number" min="0" step="any" className={INPUT} value={form.openingCharges} onChange={(e) => setForm({ ...form, openingCharges: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-issue">{t("Issue date")}</label>
          <input id="lc-issue" type="date" className={INPUT} value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-expiry">{t("Expiry date")} *</label>
          <input id="lc-expiry" type="date" className={INPUT} min={form.issueDate} value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-ship">{t("Latest shipment date")}</label>
          <input id="lc-ship" type="date" className={INPUT} min={form.issueDate} max={form.expiryDate || undefined} value={form.latestShipmentDate}
            onChange={(e) => setForm({ ...form, latestShipmentDate: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-place">{t("Place of expiry")}</label>
          <input id="lc-place" className={INPUT} maxLength={100} value={form.expiryPlace} onChange={(e) => setForm({ ...form, expiryPlace: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="lc-inco">{t("Incoterm")}</label>
          <input id="lc-inco" className={`${INPUT} uppercase`} maxLength={10} placeholder="CFR" value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })} />
        </div>
        <div className="flex flex-col justify-end gap-1 text-sm text-slate-700 dark:text-gray-200">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.partialShipments} onChange={(e) => setForm({ ...form, partialShipments: e.target.checked })} /> {t("Partial shipments allowed")}</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.transhipment} onChange={(e) => setForm({ ...form, transhipment: e.target.checked })} /> {t("Transhipment allowed")}</label>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">{t("Documents the vendor must present")}</h3>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm({ ...form, documents: [...form.documents, docRow({ documentType: "OTHER" } as LcDocument)] })}>
            <Plus className="h-4 w-4" /> {t("Add a document")}
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
          <table className="w-full min-w-[40rem] divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr><th className={TH}>{t("Document")}</th><th className={TH}>{t("Details")}</th><th className={`${TH} w-24`}>{t("Originals")}</th><th className={`${TH} w-24`}>{t("Copies")}</th><th className={TH} /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {form.documents.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-400">{t("No documents listed yet.")}</td></tr>}
              {form.documents.map((d, i) => (
                <tr key={i}>
                  <td className={TD}>
                    <select className={INPUT} aria-label={t("Document")} value={d.documentType} onChange={(e) => setDoc(i, { documentType: e.target.value })}>
                      {Object.entries(DOCUMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                    </select>
                  </td>
                  <td className={TD}><input className={INPUT} aria-label={t("Details")} maxLength={200} value={d.description} onChange={(e) => setDoc(i, { description: e.target.value })} /></td>
                  <td className={TD}><input type="number" min="0" className={INPUT} aria-label={t("Originals")} value={d.originals} onChange={(e) => setDoc(i, { originals: e.target.value })} /></td>
                  <td className={TD}><input type="number" min="0" className={INPUT} aria-label={t("Copies")} value={d.copies} onChange={(e) => setDoc(i, { copies: e.target.value })} /></td>
                  <td className={`${TD} text-end`}>
                    <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")}
                      onClick={() => setForm({ ...form, documents: form.documents.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="lc-notes">{t("Notes")}</label>
        <textarea id="lc-notes" rows={2} className={INPUT} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={onClose}>{t("Close")}</button>
        <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={onSave}><Save className="h-4 w-4" /> {t("Save draft")}</button>
      </div>
    </div>
  );
}

/** One LC: its terms, money, documents (tracked while it is open) and the payments made under it. */
function LcDetail({ lc, busy, canUpdate, canApprove, canDelete, onBack, onEdit, onOpen, onDelete, onAction, onSaveDocuments }: {
  lc: Lc; busy: boolean; canUpdate: boolean; canApprove: boolean; canDelete: boolean; onBack: () => void; onEdit: () => void; onOpen: () => void;
  onDelete: () => void; onAction: (kind: Action["kind"]) => void; onSaveDocuments: (docs: DocRow[]) => void;
}) {
  const [docs, setDocs] = useState<DocRow[]>(lc.documents.map(docRow));
  useEffect(() => setDocs(lc.documents.map(docRow)), [lc]);
  const tracking = lc.status === "OPEN" && canUpdate;
  const changed = JSON.stringify(docs) !== JSON.stringify(lc.documents.map(docRow));
  const setDoc = (i: number, patch: Partial<DocRow>) => setDocs(docs.map((d, j) => (j === i ? { ...d, ...patch, receivedOn: patch.status && patch.status !== "REQUIRED" && !d.receivedOn ? todayInput() : (patch.receivedOn ?? d.receivedOn) } : d)));
  const base = companyCurrency();
  return (
    <div className={`${CARD} space-y-4 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${CARD_TITLE} flex items-center gap-2`}>{t("Letter of credit")} {lc.lcNumber} <StatusPill status={lc.status} />
          {lc.expired && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t("Expired")}</span>}
        </h2>
        <div className="flex flex-wrap gap-2">
          {lc.status === "DRAFT" && canUpdate && <button type="button" className={SECONDARY_BUTTON} onClick={onEdit}><Pencil className="h-4 w-4" /> {t("Edit")}</button>}
          {lc.status === "DRAFT" && canDelete && <button type="button" className={SECONDARY_BUTTON} onClick={onDelete}><Trash2 className="h-4 w-4" /> {t("Delete")}</button>}
          {lc.status === "DRAFT" && canApprove && <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={onOpen}><CheckCircle2 className="h-4 w-4" /> {t("Issued by the bank")}</button>}
          {lc.status === "OPEN" && canApprove && (
            <>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => onAction("pay")}><Banknote className="h-4 w-4" /> {t("Record a payment")}</button>
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => onAction("amend")}><FilePen className="h-4 w-4" /> {t("Amend")}</button>
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => onAction("close")}><Lock className="h-4 w-4" /> {t("Close")}</button>
            </>
          )}
          <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>{t("Back to the list")}</button>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-200">
        <Field label="Order">{lc.poNumber}</Field>
        <Field label="Vendor (beneficiary)">{lc.vendorName}</Field>
        <Field label="Issuing bank">{lc.issuingBank}</Field>
        <Field label="Advising bank">{lc.advisingBank ?? "—"}</Field>
        <Field label="Payable">{lc.lcType === "USANCE" ? t("{days} days after presentation", { days: lc.usanceDays ?? 0 }) : t("At sight")}</Field>
        <Field label="Amount">{money(lc.amount, lc.currency)}{Number(lc.tolerancePercent) > 0 && <span className="text-xs text-slate-500"> ± {formatNumber(lc.tolerancePercent, 3)}%</span>}</Field>
        <Field label="Paid under it">{money(lc.drawnAmount, lc.currency)}</Field>
        <Field label="Still available">{money(lc.availableAmount, lc.currency)}</Field>
        <Field label="Issue date">{dateLabel(lc.issueDate)}</Field>
        <Field label="Expiry">{dateLabel(lc.expiryDate)}{lc.expiryPlace ? ` · ${lc.expiryPlace}` : ""}</Field>
        <Field label="Latest shipment date">{lc.latestShipmentDate ? dateLabel(lc.latestShipmentDate) : "—"}</Field>
        <Field label="Shipment terms">{[lc.incoterm, t(lc.partialShipments ? "Partial shipments allowed" : "No partial shipments"), t(lc.transhipment ? "Transhipment allowed" : "No transhipment")].filter(Boolean).join(" · ")}</Field>
        <Field label="Margin">{money(lc.marginAmount, base)} ({formatNumber(lc.marginPercent, 3)}%)</Field>
        <Field label="Margin held">{money(lc.marginHeld, base)}</Field>
        <Field label="Opening charges">{money(lc.openingCharges, base)}</Field>
        <Field label="Amendments">{lc.amendments}</Field>
        {lc.closedOn && <Field label={lc.status === "CANCELLED" ? "Cancelled" : "Closed"}>{dateLabel(lc.closedOn)} · {lc.closeReason}</Field>}
      </div>
      {lc.notes && <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-[#222222] dark:text-gray-300">{lc.notes}</p>}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-gray-200">{t("Documents")}</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
          <table className="w-full min-w-[44rem] divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr><th className={TH}>{t("Document")}</th><th className={TH}>{t("Originals / copies")}</th><th className={`${TH} w-44`}>{t("Status")}</th><th className={`${TH} w-40`}>{t("Received on")}</th><th className={TH}>{t("Discrepancy")}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {docs.map((d, i) => (
                <tr key={i}>
                  <td className={TD}>{t(DOCUMENT_TYPES[d.documentType] ?? d.documentType)}{d.description && <span className="block text-xs text-slate-400">{d.description}</span>}</td>
                  <td className={TD}>{d.originals || "—"} / {d.copies || "—"}</td>
                  <td className={TD}>
                    {tracking ? (
                      <select className={INPUT} aria-label={t("Status")} value={d.status} onChange={(e) => setDoc(i, { status: e.target.value })}>
                        {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                      </select>
                    ) : <span className={d.status === "DISCREPANT" ? "font-semibold text-red-600" : d.status === "RECEIVED" ? "text-emerald-700" : ""}>{t(DOC_STATUS[d.status] ?? d.status)}</span>}
                  </td>
                  <td className={TD}>
                    {tracking && d.status !== "REQUIRED" ? <input type="date" className={INPUT} aria-label={t("Received on")} max={todayInput()} value={d.receivedOn} onChange={(e) => setDoc(i, { receivedOn: e.target.value })} />
                      : d.receivedOn ? dateLabel(d.receivedOn) : "—"}
                  </td>
                  <td className={TD}>
                    {tracking && d.status === "DISCREPANT" ? <input className={INPUT} aria-label={t("Discrepancy")} maxLength={300} value={d.discrepancy} onChange={(e) => setDoc(i, { discrepancy: e.target.value })} />
                      : d.discrepancy ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tracking && changed && (
          <div className="mt-2 flex justify-end"><button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => onSaveDocuments(docs)}><Save className="h-4 w-4" /> {t("Save documents")}</button></div>
        )}
        {lc.status === "OPEN" && <p className="mt-1 text-xs text-slate-500">{t("A discrepant document stops payments until the discrepancy is cleared or waived.")}</p>}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-gray-200">{t("Payments under the LC")}</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
          <table className="w-full min-w-[48rem] divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr><th className={TH}>#</th><th className={TH}>{t("Presented")}</th><th className={TH}>{t("Paid")}</th><th className={TH}>{t("Bills")}</th>
                <th className={`${TH} text-end`}>{t("Amount")}</th><th className={`${TH} text-end`}>{t("Margin released")}</th><th className={`${TH} text-end`}>{t("Charges")}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {lc.drawings.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-slate-400">{t("Nothing paid under it yet.")}</td></tr>}
              {lc.drawings.map((d) => (
                <tr key={d.number}>
                  <td className={TD}>{d.number}</td>
                  <td className={`${TD} whitespace-nowrap`}>{dateLabel(d.presentedOn)}{d.maturityDate && <span className="block text-xs text-slate-400">{t("Matures")} {dateLabel(d.maturityDate)}</span>}</td>
                  <td className={`${TD} whitespace-nowrap`}>{dateLabel(d.paidOn)}{d.reference && <span className="block text-xs text-slate-400">{d.reference}</span>}</td>
                  <td className={TD}>{d.billNumbers}</td>
                  <td className={`${TD} text-end whitespace-nowrap`}>{money(d.amount, lc.currency)}</td>
                  <td className={`${TD} text-end whitespace-nowrap`}>{money(d.marginUsed, base)}</td>
                  <td className={`${TD} text-end whitespace-nowrap`}>{money(d.charges, base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><span className={LABEL}>{t(label)}</span>{children}</div>;
}

/** Record a payment, amend or close: each moves bank money, so each is its own dialog. */
function ActionDialog({ action, busy, onCancel, onSubmit }: {
  action: Action; busy: boolean; onCancel: () => void;
  onSubmit: (path: string, body: unknown, done: string, failed: string) => void;
}) {
  const { kind, lc } = action;
  const [payables, setPayables] = useState<Payable[] | null>(null);
  const [f, setF] = useState({
    presentedOn: todayInput(), paidOn: todayInput(), reference: "", charges: "", amounts: {} as Record<string, string>,
    amount: String(lc.amount), tolerancePercent: String(lc.tolerancePercent), expiryDate: lc.expiryDate, latestShipmentDate: lc.latestShipmentDate ?? "",
    amendedOn: todayInput(), note: "", closedOn: todayInput(), reason: lc.expired ? "Expired unused" : "",
  });

  useEffect(() => {
    if (kind !== "pay") return;
    axios.get<Payable[]>(`${INVOICE_API}/accounts-payable`).then((r) => setPayables(Array.isArray(r.data) ? r.data : [])).catch(() => setPayables([]));
  }, [kind]);

  const bills = useMemo(() => (payables ?? []).filter((p) => p.vendor?.id === lc.vendorId && Number(p.balance || 0) > 0 && p.purchaseInvoice
    && (p.purchaseInvoice.currency || companyCurrency()) === lc.currency && (!p.purchaseInvoice.poNumber || p.purchaseInvoice.poNumber === lc.poNumber)), [payables, lc]);
  const total = Object.values(f.amounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const marginBack = lc.amount > 0 ? Math.min(lc.marginHeld, (lc.marginAmount * total) / lc.amount) : 0;

  const submit = () => {
    if (kind === "pay") {
      const list = Object.entries(f.amounts).filter(([, v]) => Number(v) > 0).map(([id, v]) => ({ invoiceId: Number(id), amount: Number(v) }));
      if (list.length === 0) return ToasterService.error("Enter what the bank paid on each bill.");
      onSubmit("payments", { presentedOn: f.presentedOn, paidOn: f.paidOn, reference: f.reference.trim() || null, charges: num(f.charges), bills: list },
        "Payment recorded and the bills paid.", "The payment could not be recorded");
    } else if (kind === "amend") {
      onSubmit("amend", { amount: num(f.amount), tolerancePercent: num(f.tolerancePercent), expiryDate: f.expiryDate || null,
        latestShipmentDate: f.latestShipmentDate || null, amendedOn: f.amendedOn, charges: num(f.charges), note: f.note.trim() || null },
        "Amendment recorded.", "The amendment could not be recorded");
    } else {
      if (!f.reason.trim()) return ToasterService.error("Say why the LC is closed.");
      onSubmit("close", { closedOn: f.closedOn, reason: f.reason.trim() }, "Letter of credit closed; the margin is back in the bank.", "The letter of credit could not be closed");
    }
  };

  const title = kind === "pay" ? "Record a payment under LC {number}" : kind === "amend" ? "Amend LC {number}" : "Close LC {number}";
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t(title, { number: lc.lcNumber })}>
      <div className={`${CARD} max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto p-4`}>
        <h2 className={CARD_TITLE}>{t(title, { number: lc.lcNumber })}</h2>
        {kind === "pay" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={LABEL} htmlFor="lp-presented">{t("Documents presented on")}</label>
                <input id="lp-presented" type="date" className={INPUT} min={lc.issueDate} max={lc.expiryDate} value={f.presentedOn} onChange={(e) => setF({ ...f, presentedOn: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="lp-paid">{t("Paid by the bank on")}</label>
                <input id="lp-paid" type="date" className={INPUT} max={todayInput()} value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="lp-ref">{t("Bank reference")}</label>
                <input id="lp-ref" className={INPUT} maxLength={60} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="lp-charges">{t("Bank charges")} ({companyCurrency()})</label>
                <input id="lp-charges" type="number" min="0" step="any" className={INPUT} value={f.charges} onChange={(e) => setF({ ...f, charges: e.target.value })} /></div>
            </div>
            <table className="w-full divide-y divide-slate-100 text-sm dark:divide-gray-800">
              <thead><tr><th className={TH}>{t("Bill")}</th><th className={`${TH} text-end`}>{t("Due")}</th><th className={`${TH} w-40 text-end`}>{t("Paid under the LC")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {payables === null ? <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">{t("Loading...")}</td></tr>
                  : bills.length === 0 ? <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">{t("No open bills from {vendor} in {currency} for this order. Make the bill from the goods receipt first.", { vendor: lc.vendorName ?? "", currency: lc.currency })}</td></tr>
                  : bills.map((p) => {
                    const id = String(p.purchaseInvoice!.id);
                    return (
                      <tr key={id}>
                        <td className={TD}>{p.purchaseInvoice!.invoiceNumber}</td>
                        <td className={`${TD} text-end`}>{money(p.balance, lc.currency)}</td>
                        <td className={TD}><input type="number" min="0" max={p.balance} step="any" className={`${INPUT} text-end`} aria-label={t("Paid under the LC")}
                          value={f.amounts[id] ?? ""} onChange={(e) => setF({ ...f, amounts: { ...f.amounts, [id]: e.target.value } })} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            <p className="text-xs text-slate-600 dark:text-gray-300">
              {t("Total {total} of {available} still available; about {margin} of margin comes back into {bank}.", {
                total: money(total, lc.currency), available: money(lc.availableAmount, lc.currency), margin: money(marginBack, companyCurrency()), bank: lc.issuingBank ?? "",
              })}
            </p>
          </>
        )}
        {kind === "amend" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={LABEL} htmlFor="la-amount">{t("Amount")} ({lc.currency})</label>
              <input id="la-amount" type="number" min="0" step="any" className={INPUT} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="la-tol">{t("Tolerance ± %")}</label>
              <input id="la-tol" type="number" min="0" max="100" step="any" className={INPUT} value={f.tolerancePercent} onChange={(e) => setF({ ...f, tolerancePercent: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="la-expiry">{t("Expiry date")}</label>
              <input id="la-expiry" type="date" className={INPUT} value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="la-ship">{t("Latest shipment date")}</label>
              <input id="la-ship" type="date" className={INPUT} value={f.latestShipmentDate} onChange={(e) => setF({ ...f, latestShipmentDate: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="la-on">{t("Amended on")}</label>
              <input id="la-on" type="date" className={INPUT} max={todayInput()} value={f.amendedOn} onChange={(e) => setF({ ...f, amendedOn: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="la-charges">{t("Amendment charges")} ({companyCurrency()})</label>
              <input id="la-charges" type="number" min="0" step="any" className={INPUT} value={f.charges} onChange={(e) => setF({ ...f, charges: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={LABEL} htmlFor="la-note">{t("What changed and why")}</label>
              <input id="la-note" className={INPUT} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
            <p className="text-xs text-slate-500 sm:col-span-2">{t("The margin follows the new amount: more is held, or the difference comes back into the bank.")}</p>
          </div>
        )}
        {kind === "close" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={LABEL} htmlFor="lx-on">{t("Closed on")}</label>
              <input id="lx-on" type="date" className={INPUT} min={lc.issueDate} max={todayInput()} value={f.closedOn} onChange={(e) => setF({ ...f, closedOn: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="lx-reason">{t("Reason")} *</label>
              <input id="lx-reason" className={INPUT} maxLength={300} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
            <p className="text-xs text-slate-500 sm:col-span-2">{t("{margin} of margin comes back into {bank}. Nothing more can be paid under it.", { margin: money(lc.marginHeld, companyCurrency()), bank: lc.issuingBank ?? "" })}</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={onCancel}>{t("Cancel")}</button>
          <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={submit}>{t(kind === "pay" ? "Record payment" : kind === "amend" ? "Save amendment" : "Close the LC")}</button>
        </div>
      </div>
    </div>
  );
}
