import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE } from "./hrmsUi";
import { TAX_TRACKER_API, TaxSummary, money } from "./taxTracker";
import { RegimePill } from "./TaxTrackerPage";

interface TdsYear {
  deducted: number;
  deposited: number;
  outstanding: number;
  employeesWithoutPan: number;
}

/**
 * The company's income tax (docs/PAYROLL-STATEMENTS.md §4.2): the year's tax deducted, paid to the department and
 * still to pay (from the TDS register), then each employee's year — regime, deducted, forecast, the year's tax, how
 * much is done — each opening their own income tax statement.
 */
const CompanyTax: React.FC<{ fy: string; department: string }> = ({ fy, department }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [tds, setTds] = useState<TdsYear | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get<TaxSummary>(TAX_TRACKER_API, { params: fy ? { fy } : {} })
      .then((res) => {
        setSummary(res.data ?? null);
        return axios.get<TdsYear>("/v1/api/payroll/tds/year", { params: { year: res.data?.financialYear } }).then((r) => setTds(r.data ?? null)).catch(() => setTds(null));
      })
      .catch((err) => {
        setSummary(null);
        setError(apiError(err, "The company's income tax could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [fy]);

  const people = useMemo(() => (summary?.people ?? [])
    .filter((p) => !department || (p.department ?? "No department") === department)
    .sort((a, b) => b.projectedAnnualTax - a.projectedAnnualTax), [summary, department]);

  if (loading && !summary) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>;
  if (!summary) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{error ?? t("The company's income tax could not be loaded.")}</div>;

  const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
  const th = "px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap";
  const card = (label: string, value: string, note?: string, tone?: string) => (
    <div className={`${CARD} p-3`}>
      <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tabular-nums ${tone ?? "text-slate-900 dark:text-white"}`}>{value}</div>
      {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {card(t("Tax for the year"), money(summary.projectedAnnualTax), `${summary.employees} ${t("employees")}`)}
        {card(t("Deducted"), money(summary.taxPaid), summary.projectedAnnualTax > 0 ? `${Math.round((summary.taxPaid / summary.projectedAnnualTax) * 100)}% ${t("done")}` : undefined)}
        {card(t("Paid to the department"), tds ? money(tds.deposited) : "—", t("Challans in the TDS register"), "text-green-700 dark:text-green-400")}
        {card(t("Deducted, not yet paid"), tds ? money(tds.outstanding) : "—", undefined, tds && tds.outstanding > 0 ? "text-red-600" : undefined)}
        {card(t("Without a valid PAN"), tds ? String(tds.employeesWithoutPan) : "—", undefined, tds && tds.employeesWithoutPan > 0 ? "text-red-600" : undefined)}
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className={CARD_TITLE}>{t("Income tax by employee")} · FY {summary.financialYear}{department ? ` · ${department}` : ""}</div>
          <button type="button" className="text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-300" onClick={() => navigate(`/reports/tds-register?year=${summary.financialYear}`)}>
            {t("TDS register: months, challans")} →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 dark:bg-[#222]">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-gray-400">{t("Employee")}</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-gray-400">{t("Regime")}</th>
                <th className={th}>{t("Deducted")}</th>
                <th className={th}>{t("Forecast")}</th>
                <th className={th}>{t("Tax for the year")}</th>
                <th className={th} style={{ minWidth: 120 }}>{t("Done")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {people.map((p) => {
                const share = p.projectedAnnualTax > 0 ? Math.min(100, Math.round((p.taxPaid / p.projectedAnnualTax) * 100)) : 100;
                return (
                  <tr key={p.employeeId} className="cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-[#222]"
                    onClick={() => navigate(`/taxTracker/${p.employeeId}?tab=tax&fy=${summary.financialYear}`)}>
                    <td className="px-3 py-2">
                      <span className="block font-medium text-slate-900 dark:text-white">{p.employeeName}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-gray-400">{[p.employeeCode, p.department].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-3 py-2"><RegimePill regime={p.regime} /></td>
                    <td className={td}>{money(p.taxPaid)}</td>
                    <td className={`${td} text-orange-600 dark:text-orange-400`}>{money(p.taxForecast)}</td>
                    <td className={`${td} font-semibold text-slate-900 dark:text-white`}>{money(p.projectedAnnualTax)}</td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-2">
                        <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800"><span className="absolute inset-y-0 left-0 rounded-full bg-cyan-600" style={{ width: `${share}%` }} /></span>
                        {share}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {t("Forecast: the rest of the year at today's salaries and approved declarations. Click an employee for how their tax is worked out.")}
        </div>
      </div>
    </div>
  );
};

export default CompanyTax;
