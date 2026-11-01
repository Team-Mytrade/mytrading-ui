import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import { CHARGE_TYPES, LandedCostReceipt, LandedCostVoucher, landedCostApi } from "../../purchase/landedCostApi";
import { companyCurrency, formatDate, formatDateTime, formatMoney, formatNumber, todayIso } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Vendor { id: number; vendorCode?: string; name?: string; active?: boolean }
type ChargeRow = { key: string; chargeType: string; description: string; amount: string; taxAmount: string; vendorId: string; billNumber: string; billDate: string };
type Form = { id: number | null; voucherDate: string; allocationMethod: "VALUE" | "QUANTITY"; notes: string; grnIds: number[]; charges: ChargeRow[] };

let seq = 0;
const chargeRow = (type = "FREIGHT"): ChargeRow => ({ key: `c${seq++}`, chargeType: type, description: "", amount: "", taxAmount: "", vendorId: "", billNumber: "", billDate: "" });
const typeLabel = (type: string) => t(type.charAt(0) + type.slice(1).toLowerCase());
const money = (value: number | null | undefined) => (value == null ? "—" : formatMoney(value, { currency: companyCurrency() }));
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];

/**
 * Landed costs: freight, duty, insurance and other costs of bringing goods in, spread over goods receipts by value or
 * quantity. Posting raises the items' average cost (goods sold since go to cost of sales), books the charges as
 * accrued landed costs, and makes a bill in finance for each charge with a vendor and bill number.
 */
export default function LandedCostsPage() {
  const { canCreate, canUpdate, canDelete, canApprove } = usePermissions("PURCHASE");
  const [vouchers, setVouchers] = useState<LandedCostVoucher[] | null>(null);
  const [receipts, setReceipts] = useState<LandedCostReceipt[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [shown, setShown] = useState<LandedCostVoucher | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    landedCostApi.list().then(setVouchers).catch((err) => {
      setVouchers([]);
      ToasterService.error("Landed costs could not be loaded", errorText(err, "Is the purchase service running?"));
    });
    landedCostApi.receipts().then(setReceipts).catch(() => setReceipts([]));
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/vendors").then((r) => setVendors(asArray<Vendor>(r.data))).catch(() => undefined);
  }, [load]);

  const startNew = () => {
    setShown(null);
    setForm({ id: null, voucherDate: todayIso(), allocationMethod: "VALUE", notes: "", grnIds: [], charges: [chargeRow("FREIGHT")] });
  };

  const edit = (v: LandedCostVoucher) => {
    setShown(v);
    setForm({
      id: v.id, voucherDate: v.voucherDate, allocationMethod: v.allocationMethod, notes: v.notes ?? "",
      grnIds: v.receipts.map((r) => r.id),
      charges: v.charges.map((c) => ({ key: `c${seq++}`, chargeType: c.chargeType, description: c.description ?? "", amount: String(c.amount),
        taxAmount: c.taxAmount == null ? "" : String(c.taxAmount), vendorId: c.vendorId ? String(c.vendorId) : "", billNumber: c.billNumber ?? "",
        billDate: c.billDate ?? "" })),
    });
  };

  const setCharge = (key: string, patch: Partial<ChargeRow>) =>
    setForm((f) => (f ? { ...f, charges: f.charges.map((c) => (c.key === key ? { ...c, ...patch } : c)) } : f));

  const save = async () => {
    if (!form) return;
    if (form.grnIds.length === 0) {
      ToasterService.error("Choose at least one goods receipt.");
      return;
    }
    if (form.charges.length === 0 || form.charges.some((c) => !(Number(c.amount) > 0))) {
      ToasterService.error("Each charge needs an amount above zero.");
      return;
    }
    if (form.charges.some((c) => c.billNumber.trim() && !c.vendorId)) {
      ToasterService.error("Choose who billed a charge that has a bill number.");
      return;
    }
    setBusy(true);
    try {
      const saved = await landedCostApi.save(form.id, {
        voucherDate: form.voucherDate || null, allocationMethod: form.allocationMethod, notes: form.notes || null, grnIds: form.grnIds,
        charges: form.charges.map((c) => ({
          chargeType: c.chargeType, description: c.description || null, amount: Number(c.amount),
          taxAmount: c.taxAmount === "" ? null : Number(c.taxAmount), vendorId: c.vendorId ? Number(c.vendorId) : null,
          billNumber: c.billNumber.trim() || null, billDate: c.billDate || null,
        })),
      });
      ToasterService.success(form.id ? "Landed cost saved." : "Landed cost drafted: check the split, then post it.");
      edit(saved);
      load();
    } catch (err) {
      ToasterService.error("The landed cost could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const post = async (v: LandedCostVoucher) => {
    if (!window.confirm(t("Post {number}? It raises the stock's cost, books the charges and makes the bills; it can't be changed afterwards.", { number: v.voucherNumber }))) return;
    setBusy(true);
    try {
      const posted = await landedCostApi.post(v.id);
      ToasterService.success(`${posted.voucherNumber}: ${t("posted")}.`);
      setForm(null);
      setShown(posted);
      load();
    } catch (err) {
      ToasterService.error("The landed cost could not be posted", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (v: LandedCostVoucher) => {
    if (!window.confirm(t("Delete the draft {number}?", { number: v.voucherNumber }))) return;
    try {
      await landedCostApi.remove(v.id);
      if (shown?.id === v.id) {
        setShown(null);
        setForm(null);
      }
      load();
    } catch (err) {
      ToasterService.error("The landed cost could not be deleted", errorText(err, "Please try again."));
    }
  };

  const total = form ? form.charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) : 0;
  // A draft's split is the saved one; edits since then show after saving
  const split = shown && form && shown.id === form.id ? shown : shown && !form ? shown : null;

  return (
    <>
      <PageMeta title={t("Landed Costs")} description="Freight, duty and insurance on goods receipts" />
      <PageBreadcrumb pageTitle="Landed Costs" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} p-4 text-sm text-slate-600 dark:text-gray-300`}>
          {t("Put freight, duty, insurance and other costs of bringing goods in onto the goods receipts they belong to. Posting raises those items' average cost, books the charges as accrued landed costs, and makes a bill in finance for each charge with a vendor and bill number.")}
        </div>

        {!form && !shown && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Landed cost vouchers")}</h2>
              {canCreate && (
                <button type="button" className={PRIMARY_BUTTON} onClick={startNew}>
                  <Plus className="h-4 w-4" /> {t("New landed cost")}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Voucher")}</th>
                    <th className={TH}>{t("Date")}</th>
                    <th className={TH}>{t("Goods receipts")}</th>
                    <th className={TH}>{t("Spread by")}</th>
                    <th className={`${TH} text-end`}>{t("Charges")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {vouchers === null ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : vouchers.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("No landed costs yet.")}</td></tr>
                  ) : vouchers.map((v) => (
                    <tr key={v.id}>
                      <td className={`${TD} font-medium`}>{v.voucherNumber}</td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(v.voucherDate)}</td>
                      <td className={TD}>{v.receipts.map((r) => r.receiptNumber).join(", ")}</td>
                      <td className={TD}>{t(v.allocationMethod === "VALUE" ? "Value" : "Quantity")}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>{money(v.totalCharges)}</td>
                      <td className={TD}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${v.status === "POSTED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>
                          {t(v.status === "POSTED" ? "Posted" : "Draft")}
                        </span>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        {v.status === "DRAFT" && canUpdate ? (
                          <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => edit(v)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : (
                          <button type="button" className={ROW_ICON_BUTTON} title={t("View")} aria-label={t("View")} onClick={() => setShown(v)}>
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {v.status === "DRAFT" && canDelete && (
                          <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => remove(v)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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
            <h2 className={CARD_TITLE}>{shown ? `${t("Landed cost")} ${shown.voucherNumber} (${t("Draft")})` : t("New landed cost")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="lc-date">{t("Date")}</label>
                <input id="lc-date" type="date" className={INPUT} value={form.voucherDate} max={todayIso()}
                  onChange={(e) => setForm({ ...form, voucherDate: e.target.value })} />
              </div>
              <div>
                <span className={LABEL}>{t("Spread by")}</span>
                <div className="flex gap-4 pt-2 text-sm text-slate-700 dark:text-gray-200">
                  {(["VALUE", "QUANTITY"] as const).map((m) => (
                    <label key={m} className="inline-flex items-center gap-2">
                      <input type="radio" name="lc-method" checked={form.allocationMethod === m} onChange={() => setForm({ ...form, allocationMethod: m })} />
                      {t(m === "VALUE" ? "Value of each line" : "Quantity of each line")}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="lc-notes">{t("Notes")}</label>
                <input id="lc-notes" className={INPUT} value={form.notes} maxLength={500} placeholder={t("e.g. Container MSKU1234567")}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div>
              <span className={CARD_TITLE}>{t("Goods receipts")} ({form.grnIds.length})</span>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {receipts.length === 0 && (
                      <tr><td className="px-3 py-4 text-sm text-slate-400">{t("No goods receipts in stock yet.")}</td></tr>
                    )}
                    {receipts.map((r) => (
                      <tr key={r.id}>
                        <td className={`${TD} w-8`}>
                          <input type="checkbox" aria-label={r.receiptNumber} checked={form.grnIds.includes(r.id)}
                            onChange={(e) => setForm({ ...form, grnIds: e.target.checked ? [...form.grnIds, r.id] : form.grnIds.filter((id) => id !== r.id) })} />
                        </td>
                        <td className={`${TD} font-medium`}>{r.receiptNumber}</td>
                        <td className={`${TD} whitespace-nowrap`}>{r.receiptDate ? formatDate(r.receiptDate) : ""}</td>
                        <td className={TD}>{r.poNumber}</td>
                        <td className={TD}>{r.vendorName}</td>
                        <td className={`${TD} whitespace-nowrap text-end`}>{money(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={CARD_TITLE}>{t("Charges")} · {money(total)}</span>
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm({ ...form, charges: [...form.charges, chargeRow("DUTY")] })}>
                  <Plus className="h-4 w-4" /> {t("Add charge")}
                </button>
              </div>
              <p className="mb-2 text-xs text-slate-500">{t("Amounts in {currency}, without tax (tax is reclaimed, so it doesn't go on the stock). Give the vendor and their bill number to make the bill in finance when posting.", { currency: companyCurrency() })}</p>
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={`${TH} w-36`}>{t("Type")}</th>
                      <th className={TH}>{t("Description")}</th>
                      <th className={`${TH} w-32`}>{t("Amount")}</th>
                      <th className={`${TH} w-28`}>{t("Tax")}</th>
                      <th className={`${TH} w-48`}>{t("Billed by")}</th>
                      <th className={`${TH} w-36`}>{t("Bill no.")}</th>
                      <th className={`${TH} w-40`}>{t("Bill date")}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {form.charges.map((c) => (
                      <tr key={c.key}>
                        <td className={TD}>
                          <select className={INPUT} value={c.chargeType} aria-label={t("Type")} onChange={(e) => setCharge(c.key, { chargeType: e.target.value })}>
                            {CHARGE_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
                          </select>
                        </td>
                        <td className={TD}><input className={INPUT} value={c.description} maxLength={200} aria-label={t("Description")} onChange={(e) => setCharge(c.key, { description: e.target.value })} /></td>
                        <td className={TD}><input type="number" min="0" step="any" className={INPUT} value={c.amount} aria-label={t("Amount")} onChange={(e) => setCharge(c.key, { amount: e.target.value })} /></td>
                        <td className={TD}><input type="number" min="0" step="any" className={INPUT} value={c.taxAmount} aria-label={t("Tax")} onChange={(e) => setCharge(c.key, { taxAmount: e.target.value })} /></td>
                        <td className={TD}>
                          <select className={INPUT} value={c.vendorId} aria-label={t("Billed by")} onChange={(e) => setCharge(c.key, { vendorId: e.target.value })}>
                            <option value="">—</option>
                            {vendors.filter((v) => v.active !== false || String(v.id) === c.vendorId).map((v) => <option key={v.id} value={String(v.id)}>{v.name || v.vendorCode}</option>)}
                          </select>
                        </td>
                        <td className={TD}><input className={INPUT} value={c.billNumber} maxLength={100} aria-label={t("Bill no.")} onChange={(e) => setCharge(c.key, { billNumber: e.target.value })} /></td>
                        <td className={TD}><input type="date" className={INPUT} value={c.billDate} aria-label={t("Bill date")} onChange={(e) => setCharge(c.key, { billDate: e.target.value })} /></td>
                        <td className={TD}>
                          <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")}
                            onClick={() => setForm({ ...form, charges: form.charges.filter((x) => x.key !== c.key) })}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {split && <SplitTable voucher={split} />}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => { setForm(null); setShown(null); }}>{t("Close")}</button>
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={save}>{t(form.id ? "Save and show the split" : "Save draft and show the split")}</button>
              {shown && shown.status === "DRAFT" && canApprove && (
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => post(shown)}>{t("Post")}</button>
              )}
            </div>
          </div>
        )}

        {!form && shown && (
          <div className={`${CARD} space-y-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={CARD_TITLE}>{t("Landed cost")} {shown.voucherNumber}</h2>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setShown(null)}>{t("Back to the list")}</button>
            </div>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-200">
              <div><span className={LABEL}>{t("Date")}</span>{formatDate(shown.voucherDate)}</div>
              <div><span className={LABEL}>{t("Spread by")}</span>{t(shown.allocationMethod === "VALUE" ? "Value" : "Quantity")}</div>
              <div><span className={LABEL}>{t("Added to stock value")}</span>{money(shown.onHandAmount)}</div>
              <div><span className={LABEL}>{t("To cost of sales (already sold)")}</span>{money(shown.soldAmount)}</div>
              {shown.postedAt && <div className="sm:col-span-2"><span className={LABEL}>{t("Posted")}</span>{formatDateTime(shown.postedAt)} · {shown.postedBy}</div>}
              {shown.notes && <div className="sm:col-span-2"><span className={LABEL}>{t("Notes")}</span>{shown.notes}</div>}
            </div>
            <table className="min-w-full divide-y divide-slate-100 rounded-lg border border-slate-100 dark:divide-gray-800 dark:border-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]">
                <tr>
                  <th className={TH}>{t("Charge")}</th>
                  <th className={`${TH} text-end`}>{t("Amount")}</th>
                  <th className={`${TH} text-end`}>{t("Tax")}</th>
                  <th className={TH}>{t("Billed by")}</th>
                  <th className={TH}>{t("Bill")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {shown.charges.map((c, i) => (
                  <tr key={c.id ?? i}>
                    <td className={TD}>{typeLabel(c.chargeType)}{c.description ? ` · ${c.description}` : ""}</td>
                    <td className={`${TD} text-end`}>{money(c.amount)}</td>
                    <td className={`${TD} text-end`}>{c.taxAmount ? money(c.taxAmount) : "—"}</td>
                    <td className={TD}>{c.vendorName ?? "—"}</td>
                    <td className={TD}>{c.billNumber ? `${c.billNumber}${c.billId ? ` · ${t("in finance")}` : ""}` : t("Not billed yet")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SplitTable voucher={shown} />
          </div>
        )}
      </div>
    </>
  );
}

/** How the charges were spread: each receipt line's share and what it adds per unit. */
function SplitTable({ voucher }: { voucher: LandedCostVoucher }) {
  return (
    <div>
      <span className={CARD_TITLE}>{t("Split over the goods")} · {money(voucher.totalCharges)}</span>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
          <thead className="bg-slate-50 dark:bg-[#222222]">
            <tr>
              <th className={TH}>{t("Goods receipt")}</th>
              <th className={TH}>{t("Product")}</th>
              <th className={`${TH} text-end`}>{t("Qty")}</th>
              <th className={`${TH} text-end`}>{t("Line value")}</th>
              <th className={`${TH} text-end`}>{t("Share")}</th>
              <th className={`${TH} text-end`}>{t("Per unit")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
            {voucher.allocations.map((a, i) => (
              <tr key={i}>
                <td className={TD}>{a.grnNumber}</td>
                <td className={TD}>{`${a.productCode ?? ""} ${a.productName ?? ""}`.trim()}</td>
                <td className={`${TD} text-end`}>{a.quantity}</td>
                <td className={`${TD} text-end`}>{money(a.lineValue)}</td>
                <td className={`${TD} text-end font-medium`}>{money(a.amount)}</td>
                <td className={`${TD} text-end`}>{a.perUnit == null ? "—" : formatNumber(a.perUnit, 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
