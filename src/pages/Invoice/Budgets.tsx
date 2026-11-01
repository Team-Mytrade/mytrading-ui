import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BarChart3, Pencil, Plus, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { useCompany } from "../../company/companyApi";
import { formatMoney, todayIso } from "../../company/format";
import { CostCentre, GeneralAccount, INVOICE_API, accountLabel, apiError, costCentreLabel } from "./invoiceShared";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const API_URL = `${INVOICE_API}/budgets`;
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const CELL = "w-24 rounded border border-slate-200 bg-white px-2 py-1 text-end text-xs text-slate-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 text-sm text-slate-700 dark:text-gray-200";

interface BudgetLine { accountId: number; accountCode: string; accountName: string; accountType: string; amounts: number[]; total: number }
interface Budget {
  id: number; name: string; startMonth: string; costCentreId: number | null; costCentreCode: string | null; costCentreName: string | null;
  notes: string | null; months: string[]; lines: BudgetLine[]; totalIncome: number; totalExpenses: number;
}
interface ReportLine { accountId: number; accountCode: string; accountName: string; budget: number; actual: number; variance: number }
interface Report {
  name: string; fromMonth: string; toMonth: string; income: ReportLine[]; expenses: ReportLine[];
  budgetIncome: number; actualIncome: number; budgetExpenses: number; actualExpenses: number; budgetNet: number; actualNet: number;
}
type Row = { key: string; accountId: string; amounts: string[] };
type Form = { id: number | null; name: string; startMonth: string; costCentreId: string; notes: string; rows: Row[] };

let seq = 0;
const blankRow = (accountId = "", amounts: string[] = Array(12).fill("")): Row => ({ key: `r${seq++}`, accountId, amounts });
const money = (value: number) => formatMoney(value);
const monthsFrom = (start: string) => {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
};
// A year's amount over twelve months; the last takes the rounding
const spread = (year: number) => {
  const part = Math.floor((year / 12) * 100) / 100;
  const last = Math.round((year - part * 11) * 100) / 100;
  return [...Array(11).fill(String(part)), String(last)];
};

/** Budgets by account and month, for the company or a cost centre, and how the ledger compares. */
export default function Budgets() {
  const { access } = useContext(AuthContext);
  const editable = hasPermission(access, "INVOICE:ADMIN");
  const { company } = useCompany();
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [centres, setCentres] = useState<CostCentre[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [shown, setShown] = useState<Budget | null>(null);
  const [range, setRange] = useState<[string, string]>(["", ""]);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Budget[]>(API_URL).then((r) => setBudgets(Array.isArray(r.data) ? r.data : [])).catch((err) => {
      setBudgets([]);
      ToasterService.error(apiError(err, "Failed to load budgets"));
    });
  }, []);

  useEffect(() => {
    load();
    axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`).then((r) => setAccounts(Array.isArray(r.data) ? r.data : [])).catch(() => setAccounts([]));
    axios.get<CostCentre[]>(`${INVOICE_API}/cost-centres`).then((r) => setCentres(Array.isArray(r.data) ? r.data : [])).catch(() => setCentres([]));
  }, [load]);

  useEffect(() => {
    if (!shown || !range[0] || !range[1]) return;
    setReport(null);
    axios.get<Report>(`${API_URL}/${shown.id}/report`, { params: { from: range[0], to: range[1] } })
      .then((r) => setReport(r.data))
      .catch((err) => ToasterService.error(apiError(err, "Could not work out the report")));
  }, [shown, range]);

  const budgetAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === "INCOME" || a.accountType === "EXPENSE").sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
    [accounts]
  );

  const startNew = () => {
    // This financial year: the latest start of the company's year not after today
    const today = todayIso();
    const fy = company?.financialYearStartMonth || 1;
    const year = Number(today.slice(5, 7)) >= fy ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
    setShown(null);
    setForm({ id: null, name: "", startMonth: `${year}-${String(fy).padStart(2, "0")}`, costCentreId: "", notes: "", rows: [blankRow()] });
  };

  const edit = (b: Budget) => {
    setShown(null);
    setForm({
      id: b.id, name: b.name, startMonth: b.startMonth, costCentreId: b.costCentreId ? String(b.costCentreId) : "", notes: b.notes ?? "",
      rows: b.lines.map((l) => blankRow(String(l.accountId), l.amounts.map((a) => (Number(a) ? String(a) : "")))),
    });
  };

  const show = (b: Budget) => {
    setForm(null);
    setRange([b.months[0], b.months[11]]);
    setShown(b);
  };

  const setRow = (key: string, patch: Partial<Row>) =>
    setForm((f) => (f ? { ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) } : f));

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      ToasterService.error("Enter the budget's name.");
      return;
    }
    if (form.rows.some((r) => !r.accountId)) {
      ToasterService.error("Choose the account on every line.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name, startMonth: form.startMonth, costCentreId: form.costCentreId ? Number(form.costCentreId) : null, notes: form.notes || null,
        lines: form.rows.map((r) => ({ accountId: Number(r.accountId), amounts: r.amounts.map((a) => (a === "" ? null : Number(a))) })),
      };
      const saved = (await (form.id ? axios.put<Budget>(`${API_URL}/${form.id}`, body) : axios.post<Budget>(API_URL, body))).data;
      ToasterService.success("Budget saved.");
      load();
      show(saved);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the budget"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: Budget) => {
    if (!window.confirm(t("Delete the budget {name}?", { name: b.name }))) return;
    try {
      await axios.delete(`${API_URL}/${b.id}`);
      load();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the budget"));
    }
  };

  const months = form ? monthsFrom(form.startMonth) : [];
  const section = (title: string, lines: ReportLine[], budget: number, actual: number, income: boolean) => (
    <>
      <tr className="bg-slate-50 dark:bg-[#222222]"><td colSpan={4} className={`${TD} font-semibold`}>{t(title)}</td></tr>
      {lines.map((l) => (
        <tr key={l.accountId}>
          <td className={TD}>{l.accountCode} · {l.accountName}{!l.budget && <span className="ms-2 text-xs text-amber-600">{t("Not budgeted")}</span>}</td>
          <td className={`${TD} text-end`}>{money(l.budget)}</td>
          <td className={`${TD} text-end`}>{money(l.actual)}</td>
          <td className={`${TD} text-end font-medium ${l.variance < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(l.variance)}</td>
        </tr>
      ))}
      <tr className="font-semibold">
        <td className={TD}>{t("Total")}</td>
        <td className={`${TD} text-end`}>{money(budget)}</td>
        <td className={`${TD} text-end`}>{money(actual)}</td>
        <td className={`${TD} text-end`}>{money(income ? actual - budget : budget - actual)}</td>
      </tr>
    </>
  );

  return (
    <>
      <PageMeta title={t("Budgets")} description="Planned income and expenses against the ledger" />
      <PageBreadcrumb pageTitle="Budgets" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {!form && !shown && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Budgets")}</h2>
              {editable && <button type="button" className={PRIMARY_BUTTON} onClick={startNew}><Plus className="h-4 w-4" /> {t("New budget")}</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Name")}</th>
                    <th className={TH}>{t("First month")}</th>
                    <th className={TH}>{t("Cost centre")}</th>
                    <th className={`${TH} text-end`}>{t("Income")}</th>
                    <th className={`${TH} text-end`}>{t("Expenses")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {budgets === null ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : budgets.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">{t("No budgets yet.")}</td></tr>
                  ) : budgets.map((b) => (
                    <tr key={b.id}>
                      <td className={`${TD} font-medium`}>{b.name}</td>
                      <td className={TD}>{b.startMonth}</td>
                      <td className={TD}>{b.costCentreCode ? `${b.costCentreCode} · ${b.costCentreName}` : t("Whole company")}</td>
                      <td className={`${TD} text-end`}>{money(b.totalIncome)}</td>
                      <td className={`${TD} text-end`}>{money(b.totalExpenses)}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        <button type="button" className={ROW_ICON_BUTTON} title={t("Budget against actual")} aria-label={t("Budget against actual")} onClick={() => show(b)}><BarChart3 className="h-4 w-4" /></button>
                        {editable && <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => edit(b)}><Pencil className="h-4 w-4" /></button>}
                        {editable && <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => remove(b)}><Trash2 className="h-4 w-4" /></button>}
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
            <h2 className={CARD_TITLE}>{form.id ? t("Edit budget") : t("New budget")}</h2>
            <div className="grid gap-3 md:grid-cols-4">
              <div><label className={LABEL} htmlFor="b-name">{t("Name")}</label><input id="b-name" className={INPUT} value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="b-start">{t("First month")}</label><input id="b-start" type="month" className={INPUT} value={form.startMonth} onChange={(e) => e.target.value && setForm({ ...form, startMonth: e.target.value })} /></div>
              <div>
                <label className={LABEL} htmlFor="b-centre">{t("Cost centre")}</label>
                <select id="b-centre" className={INPUT} value={form.costCentreId} onChange={(e) => setForm({ ...form, costCentreId: e.target.value })}>
                  <option value="">{t("Whole company")}</option>
                  {centres.filter((c) => c.active || String(c.id) === form.costCentreId).map((c) => <option key={c.id} value={String(c.id)}>{costCentreLabel(c)}</option>)}
                </select>
              </div>
              <div><label className={LABEL} htmlFor="b-notes">{t("Notes")}</label><input id="b-notes" className={INPUT} value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={`${TH} min-w-56`}>{t("Account")}</th>
                    <th className={TH}>{t("Year (spread evenly)")}</th>
                    {months.map((m) => <th key={m} className={`${TH} text-end`}>{m}</th>)}
                    <th className={`${TH} text-end`}>{t("Total")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {form.rows.map((row) => (
                    <tr key={row.key}>
                      <td className={TD}>
                        <select className={INPUT} value={row.accountId} aria-label={t("Account")} onChange={(e) => setRow(row.key, { accountId: e.target.value })}>
                          <option value="">—</option>
                          {budgetAccounts.map((a) => <option key={a.id} value={String(a.id)}>{accountLabel(a)}</option>)}
                        </select>
                      </td>
                      <td className={TD}>
                        <input type="number" min="0" step="any" className={CELL} aria-label={t("Year (spread evenly)")}
                          onChange={(e) => e.target.value && setRow(row.key, { amounts: spread(Number(e.target.value)) })} />
                      </td>
                      {months.map((m, i) => (
                        <td key={m} className="px-1 py-2">
                          <input type="number" min="0" step="any" className={CELL} aria-label={m} value={row.amounts[i]}
                            onChange={(e) => setRow(row.key, { amounts: row.amounts.map((a, j) => (j === i ? e.target.value : a)) })} />
                        </td>
                      ))}
                      <td className={`${TD} whitespace-nowrap text-end font-medium`}>{money(row.amounts.reduce((s, a) => s + (Number(a) || 0), 0))}</td>
                      <td className={TD}>
                        <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")}
                          onClick={() => setForm({ ...form, rows: form.rows.filter((r) => r.key !== row.key) })}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm({ ...form, rows: [...form.rows, blankRow()] })}><Plus className="h-4 w-4" /> {t("Add account")}</button>
              <div className="flex gap-2">
                <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setForm(null)}>{t("Close")}</button>
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>{t("Save")}</button>
              </div>
            </div>
          </div>
        )}

        {shown && !form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={CARD_TITLE}>{shown.name} · {shown.costCentreCode ? `${shown.costCentreCode} · ${shown.costCentreName}` : t("Whole company")}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select className={INPUT + " w-auto"} value={range[0]} aria-label={t("From")} onChange={(e) => setRange([e.target.value, e.target.value > range[1] ? e.target.value : range[1]])}>
                  {shown.months.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className={INPUT + " w-auto"} value={range[1]} aria-label={t("To")} onChange={(e) => setRange([e.target.value < range[0] ? e.target.value : range[0], e.target.value])}>
                  {shown.months.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setShown(null)}>{t("Back to the list")}</button>
              </div>
            </div>
            {!report ? <p className="py-6 text-center text-sm text-slate-400">{t("Loading...")}</p> : (
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Account")}</th>
                      <th className={`${TH} text-end`}>{t("Budget")}</th>
                      <th className={`${TH} text-end`}>{t("Actual")}</th>
                      <th className={`${TH} text-end`}>{t("Better / worse")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {section("Income", report.income, report.budgetIncome, report.actualIncome, true)}
                    {section("Expenses", report.expenses, report.budgetExpenses, report.actualExpenses, false)}
                    <tr className="bg-slate-50 font-semibold dark:bg-[#222222]">
                      <td className={TD}>{t("Net profit")}</td>
                      <td className={`${TD} text-end`}>{money(report.budgetNet)}</td>
                      <td className={`${TD} text-end`}>{money(report.actualNet)}</td>
                      <td className={`${TD} text-end ${report.actualNet < report.budgetNet ? "text-rose-600" : "text-emerald-700"}`}>{money(report.actualNet - report.budgetNet)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
