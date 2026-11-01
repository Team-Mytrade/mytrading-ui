import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { usePermissions } from "../../access/usePermissions";
import { formatDate, formatMoney, todayIso } from "../../company/format";
import { CostCentre, INVOICE_API, apiError, costCentreLabel } from "./invoiceShared";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const API_URL = `${INVOICE_API}/fixed-assets`;
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 text-sm text-slate-700 dark:text-gray-200";

interface Asset {
  id: number; assetNumber: string; name: string; category: string | null; acquisitionDate: string; depreciationStart: string;
  cost: number; salvageValue: number; usefulLifeMonths: number; depreciationMethod: string; annualRate: number | null;
  acquisitionSource: string; billReference: string | null; openingDepreciation: number; accumulatedDepreciation: number;
  netBookValue: number; depreciatedThrough: string | null; costCentreId: number | null; status: "ACTIVE" | "DISPOSED";
  disposalDate: string | null; disposalProceeds: number | null; disposalGain: number | null; notes: string | null;
  depreciations: { month: string; amount: number; entryNumber: string | null }[];
}
interface Preview { throughMonth: string; assets: { assetId: number; assetNumber: string; name: string; months: number; amount: number }[]; total: number }
interface Bank { id: number; name?: string; accountName?: string; active?: boolean }
type Form = {
  id: number | null; locked: boolean; name: string; category: string; acquisitionDate: string; depreciationStart: string; cost: string; salvageValue: string;
  usefulLifeMonths: string; depreciationMethod: string; annualRate: string; acquisitionSource: string; billReference: string;
  openingDepreciation: string; costCentreId: string; notes: string;
};

const money = (value: number | null | undefined) => (value == null ? "—" : formatMoney(value));
const blank = (): Form => ({
  id: null, locked: false, name: "", category: "", acquisitionDate: todayIso(), depreciationStart: todayIso().slice(0, 7), cost: "", salvageValue: "",
  usefulLifeMonths: "60", depreciationMethod: "STRAIGHT_LINE", annualRate: "", acquisitionSource: "BILL", billReference: "",
  openingDepreciation: "", costCentreId: "", notes: "",
});

/** The asset register: what the company owns, depreciated by a monthly run, and disposals with their gain or loss. */
export default function FixedAssets() {
  const { access } = useContext(AuthContext);
  const admin = hasPermission(access, "INVOICE:ADMIN");
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [centres, setCentres] = useState<CostCentre[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [shown, setShown] = useState<Asset | null>(null);
  const [runMonth, setRunMonth] = useState(todayIso().slice(0, 7));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [disposal, setDisposal] = useState<{ date: string; proceeds: string; bankAccountId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Asset[]>(API_URL).then((r) => setAssets(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setAssets([]);
      ToasterService.error(apiError(err, "Failed to load fixed assets"));
    });
  }, []);

  const loadPreview = useCallback(() => {
    if (!runMonth) return;
    axios.get<Preview>(`${API_URL}/depreciation/preview`, { params: { month: runMonth } })
      .then((r) => setPreview(r.data))
      .catch(() => setPreview(null));
  }, [runMonth]);

  useEffect(() => {
    load();
    axios.get<CostCentre[]>(`${INVOICE_API}/cost-centres`).then((r) => setCentres(Array.isArray(r.data) ? r.data : [])).catch(() => setCentres([]));
    axios.get<Bank[]>(`${INVOICE_API}/bank-accounts`).then((r) => setBanks(Array.isArray(r.data) ? r.data : [])).catch(() => setBanks([]));
  }, [load]);

  useEffect(loadPreview, [loadPreview]);

  const refresh = () => {
    load();
    loadPreview();
  };

  const edit = (a: Asset) => {
    setShown(null);
    setForm({
      id: a.id, locked: a.depreciations.length > 0, name: a.name, category: a.category ?? "", acquisitionDate: a.acquisitionDate, depreciationStart: a.depreciationStart,
      cost: String(a.cost), salvageValue: Number(a.salvageValue) ? String(a.salvageValue) : "", usefulLifeMonths: String(a.usefulLifeMonths),
      depreciationMethod: a.depreciationMethod, annualRate: a.annualRate != null ? String(a.annualRate) : "", acquisitionSource: a.acquisitionSource,
      billReference: a.billReference ?? "", openingDepreciation: Number(a.openingDepreciation) ? String(a.openingDepreciation) : "",
      costCentreId: a.costCentreId ? String(a.costCentreId) : "", notes: a.notes ?? "",
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !(Number(form.cost) > 0) || !(Number(form.usefulLifeMonths) > 0)) {
      ToasterService.error("Enter the name, the cost and the useful life.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name, category: form.category || null, acquisitionDate: form.acquisitionDate, depreciationStart: form.depreciationStart || null,
        cost: Number(form.cost), salvageValue: Number(form.salvageValue) || 0, usefulLifeMonths: Number(form.usefulLifeMonths),
        depreciationMethod: form.depreciationMethod, annualRate: form.annualRate === "" ? null : Number(form.annualRate),
        acquisitionSource: form.acquisitionSource, billReference: form.billReference || null, openingDepreciation: Number(form.openingDepreciation) || 0,
        costCentreId: form.costCentreId ? Number(form.costCentreId) : null, notes: form.notes || null,
      };
      await (form.id ? axios.put(`${API_URL}/${form.id}`, body) : axios.post(API_URL, body));
      ToasterService.success("Asset saved.");
      setForm(null);
      refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the asset"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Asset) => {
    if (!window.confirm(t("Remove {number}? Its posting is reversed.", { number: a.assetNumber }))) return;
    try {
      await axios.delete(`${API_URL}/${a.id}`);
      refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not remove the asset"));
    }
  };

  const run = async () => {
    if (!preview || preview.assets.length === 0) return;
    if (!window.confirm(t("Post depreciation of {amount} up to {month}? Posted months can't be undone.", { amount: money(preview.total), month: preview.throughMonth }))) return;
    setBusy(true);
    try {
      await axios.post(`${API_URL}/depreciation/run`, null, { params: { month: runMonth } });
      ToasterService.success("Depreciation posted.");
      refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not post the depreciation"));
    } finally {
      setBusy(false);
    }
  };

  const dispose = async () => {
    if (!shown || !disposal) return;
    if (!window.confirm(t("Dispose of {number}? This can't be undone.", { number: shown.assetNumber }))) return;
    setBusy(true);
    try {
      const saved = await axios.post<Asset>(`${API_URL}/${shown.id}/dispose`, {
        date: disposal.date, proceeds: Number(disposal.proceeds) || 0, bankAccountId: disposal.bankAccountId ? Number(disposal.bankAccountId) : null,
      });
      ToasterService.success("Asset disposed of.");
      setShown(saved.data);
      setDisposal(null);
      refresh();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not dispose of the asset"));
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => {
    const active = (assets ?? []).filter((a) => a.status === "ACTIVE");
    return {
      cost: active.reduce((s, a) => s + Number(a.cost), 0),
      accumulated: active.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0),
      book: active.reduce((s, a) => s + Number(a.netBookValue), 0),
    };
  }, [assets]);

  const centreName = (id: number | null) => {
    const c = centres.find((x) => x.id === id);
    return c ? costCentreLabel(c) : "—";
  };

  return (
    <>
      <PageMeta title={t("Fixed Assets")} description="Asset register, depreciation and disposals" />
      <PageBreadcrumb pageTitle="Fixed Assets" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {!form && !shown && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["Cost", totals.cost], ["Accumulated depreciation", totals.accumulated], ["Book value", totals.book]].map(([label, value]) => (
                <div key={label as string} className={`${CARD} p-4`}>
                  <div className="text-xs font-semibold text-slate-500">{t(label as string)}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-white">{money(value as number)}</div>
                </div>
              ))}
            </div>

            <div className={`${CARD} space-y-3 p-4`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className={CARD_TITLE}>{t("Run depreciation")}</h2>
                  <p className="text-xs text-slate-500">{t("Posts every month not posted yet, up to the month chosen. Run it at each month's end.")}</p>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className={LABEL} htmlFor="fa-month">{t("Up to")}</label>
                    <input id="fa-month" type="month" className={INPUT} value={runMonth} max={todayIso().slice(0, 7)} onChange={(e) => setRunMonth(e.target.value)} />
                  </div>
                  {admin && (
                    <button type="button" className={PRIMARY_BUTTON} disabled={busy || !preview || preview.assets.length === 0} onClick={run}>
                      {t("Post {amount}", { amount: money(preview?.total ?? 0) })}
                    </button>
                  )}
                </div>
              </div>
              {preview && preview.assets.length > 0 ? (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-gray-800">
                  {preview.assets.map((d) => (
                    <li key={d.assetId} className="flex justify-between py-1.5 text-slate-700 dark:text-gray-200">
                      <span>{d.assetNumber} · {d.name} <span className="text-xs text-slate-500">({t("{count} month(s)", { count: d.months })})</span></span>
                      <span>{money(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-400">{t("Nothing to post up to this month.")}</p>}
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                <h2 className={CARD_TITLE}>{t("Asset register")}</h2>
                {canCreate && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm(blank())}><Plus className="h-4 w-4" /> {t("New asset")}</button>}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Asset")}</th>
                      <th className={TH}>{t("Category")}</th>
                      <th className={TH}>{t("Acquired")}</th>
                      <th className={`${TH} text-end`}>{t("Cost")}</th>
                      <th className={`${TH} text-end`}>{t("Accumulated depreciation")}</th>
                      <th className={`${TH} text-end`}>{t("Book value")}</th>
                      <th className={TH}>{t("Depreciated to")}</th>
                      <th className={TH}>{t("Status")}</th>
                      <th className={TH} aria-label={t("Actions")} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {assets === null ? (
                      <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                    ) : assets.length === 0 ? (
                      <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">{t("No fixed assets yet.")}</td></tr>
                    ) : assets.map((a) => (
                      <tr key={a.id}>
                        <td className={TD}><div className="font-medium">{a.assetNumber}</div><div className="text-xs text-slate-500">{a.name}</div></td>
                        <td className={TD}>{a.category ?? "—"}</td>
                        <td className={`${TD} whitespace-nowrap`}>{formatDate(a.acquisitionDate)}</td>
                        <td className={`${TD} whitespace-nowrap text-end`}>{money(a.cost)}</td>
                        <td className={`${TD} whitespace-nowrap text-end`}>{money(a.accumulatedDepreciation)}</td>
                        <td className={`${TD} whitespace-nowrap text-end font-medium`}>{money(a.netBookValue)}</td>
                        <td className={TD}>{a.depreciatedThrough ?? "—"}</td>
                        <td className={TD}>{t(a.status === "ACTIVE" ? "Active" : "Disposed")}</td>
                        <td className={`${TD} whitespace-nowrap text-end`}>
                          <button type="button" className={ROW_ICON_BUTTON} title={t("View")} aria-label={t("View")} onClick={() => setShown(a)}><Eye className="h-4 w-4" /></button>
                          {canUpdate && a.status === "ACTIVE" && <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => edit(a)}><Pencil className="h-4 w-4" /></button>}
                          {canDelete && a.status === "ACTIVE" && a.depreciations.length === 0 && (
                            <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <h2 className={CARD_TITLE}>{form.id ? t("Edit asset") : t("New asset")}</h2>
            {form.locked && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("Depreciation has been posted, so only the name, category, cost centre and notes can change.")}</p>}
            <div className="grid gap-3 md:grid-cols-3">
              <div><label className={LABEL} htmlFor="fa-name">{t("Name")}</label><input id="fa-name" className={INPUT} value={form.name} maxLength={200} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="fa-cat">{t("Category")}</label><input id="fa-cat" className={INPUT} value={form.category} maxLength={100} placeholder={t("e.g. Vehicles")} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div>
                <label className={LABEL} htmlFor="fa-centre">{t("Cost centre")}</label>
                <select id="fa-centre" className={INPUT} value={form.costCentreId} onChange={(e) => setForm({ ...form, costCentreId: e.target.value })}>
                  <option value="">—</option>
                  {centres.filter((c) => c.active || String(c.id) === form.costCentreId).map((c) => <option key={c.id} value={String(c.id)}>{costCentreLabel(c)}</option>)}
                </select>
              </div>
              <fieldset disabled={form.locked} className="contents">
                <div>
                  <label className={LABEL} htmlFor="fa-source">{t("How it was acquired")}</label>
                  <select id="fa-source" className={INPUT} value={form.acquisitionSource} onChange={(e) => setForm({ ...form, acquisitionSource: e.target.value, openingDepreciation: "" })}>
                    <option value="BILL">{t("On a bill entered here")}</option>
                    <option value="OPENING">{t("Owned before go-live")}</option>
                  </select>
                </div>
                {form.acquisitionSource === "BILL" ? (
                  <div><label className={LABEL} htmlFor="fa-bill">{t("Bill no.")}</label><input id="fa-bill" className={INPUT} value={form.billReference} maxLength={100} onChange={(e) => setForm({ ...form, billReference: e.target.value })} /></div>
                ) : (
                  <div><label className={LABEL} htmlFor="fa-open">{t("Depreciation before go-live")}</label><input id="fa-open" type="number" min="0" step="any" className={INPUT} value={form.openingDepreciation} onChange={(e) => setForm({ ...form, openingDepreciation: e.target.value })} /></div>
                )}
                <div><label className={LABEL} htmlFor="fa-date">{t("Acquisition date")}</label><input id="fa-date" type="date" className={INPUT} value={form.acquisitionDate} max={todayIso()} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value, depreciationStart: e.target.value.slice(0, 7) })} /></div>
                <div><label className={LABEL} htmlFor="fa-cost">{t("Cost")}</label><input id="fa-cost" type="number" min="0" step="any" className={INPUT} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
                <div><label className={LABEL} htmlFor="fa-salvage">{t("Salvage value")}</label><input id="fa-salvage" type="number" min="0" step="any" className={INPUT} value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} /></div>
                <div><label className={LABEL} htmlFor="fa-start">{t("Depreciate from")}</label><input id="fa-start" type="month" className={INPUT} value={form.depreciationStart} onChange={(e) => setForm({ ...form, depreciationStart: e.target.value })} /></div>
                <div><label className={LABEL} htmlFor="fa-life">{t("Useful life (months from then)")}</label><input id="fa-life" type="number" min="1" step="1" className={INPUT} value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} /></div>
                <div>
                  <label className={LABEL} htmlFor="fa-method">{t("Method")}</label>
                  <select id="fa-method" className={INPUT} value={form.depreciationMethod} onChange={(e) => setForm({ ...form, depreciationMethod: e.target.value })}>
                    <option value="STRAIGHT_LINE">{t("Straight line")}</option>
                    <option value="REDUCING_BALANCE">{t("Reducing balance")}</option>
                  </select>
                </div>
                {form.depreciationMethod === "REDUCING_BALANCE" && (
                  <div><label className={LABEL} htmlFor="fa-rate">{t("Yearly rate (%)")}</label><input id="fa-rate" type="number" min="0" max="100" step="any" className={INPUT} value={form.annualRate} onChange={(e) => setForm({ ...form, annualRate: e.target.value })} /></div>
                )}
              </fieldset>
              <div className="md:col-span-3"><label className={LABEL} htmlFor="fa-notes">{t("Notes")}</label><input id="fa-notes" className={INPUT} value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <p className="text-xs text-slate-500">
              {t(form.acquisitionSource === "BILL"
                ? "Enter the vendor's bill as usual; this moves its cost from purchases and expenses to fixed assets. Use the same cost centre as the bill."
                : "Posts the cost against opening balance equity. For an older asset, enter the life it has left.")}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>{t("Save")}</button>
            </div>
          </div>
        )}

        {shown && !form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={CARD_TITLE}>{shown.assetNumber} · {shown.name}</h2>
              <div className="flex gap-2">
                {admin && shown.status === "ACTIVE" && !disposal && (
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => setDisposal({ date: todayIso(), proceeds: "", bankAccountId: "" })}>{t("Dispose")}</button>
                )}
                <button type="button" className={SECONDARY_BUTTON} onClick={() => { setShown(null); setDisposal(null); }}>{t("Back to the list")}</button>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-200">
              <div><span className={LABEL}>{t("Cost")}</span>{money(shown.cost)}</div>
              <div><span className={LABEL}>{t("Salvage value")}</span>{money(shown.salvageValue)}</div>
              <div><span className={LABEL}>{t("Accumulated depreciation")}</span>{money(shown.accumulatedDepreciation)}</div>
              <div><span className={LABEL}>{t("Book value")}</span>{money(shown.netBookValue)}</div>
              <div><span className={LABEL}>{t("Method")}</span>{t(shown.depreciationMethod === "STRAIGHT_LINE" ? "Straight line" : "Reducing balance")}{shown.annualRate != null ? ` · ${shown.annualRate}%` : ""}</div>
              <div><span className={LABEL}>{t("Depreciate from")}</span>{shown.depreciationStart} · {t("{count} month(s)", { count: shown.usefulLifeMonths })}</div>
              <div><span className={LABEL}>{t("Cost centre")}</span>{centreName(shown.costCentreId)}</div>
              <div><span className={LABEL}>{t("Acquired")}</span>{formatDate(shown.acquisitionDate)}</div>
              {shown.status === "DISPOSED" && (
                <div className="sm:col-span-2 lg:col-span-4">
                  <span className={LABEL}>{t("Disposed")}</span>
                  {formatDate(shown.disposalDate)} · {money(shown.disposalProceeds)} · {t(Number(shown.disposalGain) < 0 ? "Loss" : "Gain")} {money(Math.abs(Number(shown.disposalGain)))}
                </div>
              )}
            </div>

            {disposal && (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-gray-700">
                <p className="text-xs text-slate-500">{t("The month of disposal isn't depreciated; months before it must be posted first. VAT on a sale is not included: invoice it separately if it applies.")}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><label className={LABEL} htmlFor="fd-date">{t("Date")}</label><input id="fd-date" type="date" className={INPUT} value={disposal.date} max={todayIso()} onChange={(e) => setDisposal({ ...disposal, date: e.target.value })} /></div>
                  <div><label className={LABEL} htmlFor="fd-proceeds">{t("Proceeds (empty if scrapped)")}</label><input id="fd-proceeds" type="number" min="0" step="any" className={INPUT} value={disposal.proceeds} onChange={(e) => setDisposal({ ...disposal, proceeds: e.target.value })} /></div>
                  <div>
                    <label className={LABEL} htmlFor="fd-bank">{t("Deposit to")}</label>
                    <select id="fd-bank" className={INPUT} value={disposal.bankAccountId} onChange={(e) => setDisposal({ ...disposal, bankAccountId: e.target.value })}>
                      <option value="">{t("Default bank account")}</option>
                      {banks.filter((b) => b.active !== false).map((b) => <option key={b.id} value={String(b.id)}>{b.name ?? b.accountName}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setDisposal(null)}>{t("Close")}</button>
                  <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={dispose}>{t("Dispose")}</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr><th className={TH}>{t("Month")}</th><th className={`${TH} text-end`}>{t("Depreciation")}</th><th className={TH}>{t("Entry")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {shown.depreciations.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-400">{t("No depreciation posted yet.")}</td></tr>
                  ) : shown.depreciations.map((d) => (
                    <tr key={d.month}><td className={TD}>{d.month}</td><td className={`${TD} text-end`}>{money(d.amount)}</td><td className={TD}>{d.entryNumber ?? "—"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
