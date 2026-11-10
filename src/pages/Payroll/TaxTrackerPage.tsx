import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { CHART_TOOLTIP } from "../Dashboard/dashboardKit";
import { usePermissions } from "../../access/usePermissions";
import { CARD, CARD_TITLE, PAGE_BODY } from "./hrmsUi";
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { t } from "../../i18n/i18n";
import {
  TAX_TRACKER_API, TaxSummary, EmployeeTax, chartColors, initials, isDarkTheme, money, monthLabel, paidShare,
} from "./taxTracker";

/** A headline figure with a coloured band on top. */
export const HeadlineCard: React.FC<{ label: string; value: string; note?: string; band: string }> = ({ label, value, note, band }) => (
  <div className={`${CARD} overflow-hidden`}>
    <div className={`h-1.5 ${band}`} />
    <div className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
      {note && <div className="mt-1 text-xs text-slate-500 dark:text-gray-400">{note}</div>}
    </div>
  </div>
);

export const RegimePill: React.FC<{ regime?: string | null }> = ({ regime }) =>
  regime ? (
    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-gray-700 dark:text-gray-300">
      {regime === "OLD" ? t("Old regime") : t("New regime")}
    </span>
  ) : null;

/** Deducted vs projected for the year, as a thin bar. */
export const PaidBar: React.FC<{ paid: number; projected: number }> = ({ paid, projected }) => {
  const colors = chartColors(isDarkTheme());
  const share = paidShare(paid, projected);
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: colors.forecast + "33" }}
        role="img" aria-label={`${share}% of the year's tax deducted`}>
        <div className="h-full rounded-full" style={{ width: `${share}%`, background: colors.paid }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{share}% {t("of the year's tax deducted")}</div>
    </div>
  );
};

const EmployeeCard: React.FC<{ person: EmployeeTax; onOpen: () => void }> = ({ person, onOpen }) => {
  const monthsLeft = person.monthsForecast;
  const monthlyTakeHome = monthsLeft > 0 ? person.takeHomeForecast / monthsLeft : person.monthsPaid > 0 ? person.takeHomePaid / person.monthsPaid : 0;
  return (
    <button type="button" onClick={onOpen}
      className={`${CARD} p-4 text-left transition hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          {initials(person.employeeName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-slate-900 dark:text-white">{person.employeeName}</span>
            {!person.active && <span className="text-[10px] text-slate-400">{t("Left")}</span>}
          </div>
          <div className="truncate text-xs text-slate-500 dark:text-gray-400">
            {[person.employeeCode, person.designation].filter(Boolean).join(" · ")}
          </div>
        </div>
        <RegimePill regime={person.regime} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500 dark:text-gray-400">{t("Deducted")}</div>
          <div className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(person.taxPaid)}</div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-gray-400">{t("Forecast")}</div>
          <div className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(person.taxForecast)}</div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-gray-400">{t("Year")}</div>
          <div className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(person.projectedAnnualTax)}</div>
        </div>
      </div>
      <div className="mt-3"><PaidBar paid={person.taxPaid} projected={person.projectedAnnualTax} /></div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-gray-800">
        <span className="text-slate-500 dark:text-gray-400">{monthsLeft > 0 ? t("Take-home / month (forecast)") : t("Take-home / month")}</span>
        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(monthlyTakeHome)}</span>
      </div>
    </button>
  );
};

/** Income tax across the company for the financial year: deducted so far and forecast for the months left. */
const TaxTrackerPage: React.FC = () => {
  const navigate = useNavigate();
  const { canApprove } = usePermissions();
  const [params, setParams] = useSearchParams();
  const fy = params.get("fy") ?? "";
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showTable, setShowTable] = useState(false);

  // Everyone's tax is for HR and managers; an employee goes straight to their own year (as with payslips)
  useEffect(() => {
    if (!canApprove) navigate(`/mySalary${fy ? `?fy=${fy}` : ""}`, { replace: true });
  }, [canApprove, fy, navigate]);

  useEffect(() => {
    if (!canApprove) return;
    setLoading(true);
    axios.get<TaxSummary>(TAX_TRACKER_API, { params: fy ? { fy } : {} })
      .then((res) => setSummary(res.data))
      .catch((error) => {
        setSummary(null);
        ToasterService.error(apiError(error, "The tax tracker could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [fy, canApprove]);

  const colors = chartColors(isDarkTheme());
  const chartData = useMemo(() => (summary?.months ?? []).map((m) => ({
    month: monthLabel(m.month, true),
    fullMonth: monthLabel(m.month),
    deducted: Number(m.taxPaid) || 0,
    forecast: Number(m.taxForecast) || 0,
  })), [summary]);

  const people = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (summary?.people ?? []).filter((p) => !query
      || [p.employeeName, p.employeeCode, p.designation, p.department].some((v) => v?.toLowerCase().includes(query)));
  }, [summary, search]);

  const lastPaid = summary?.months.filter((m) => m.status === "ACTUAL").map((m) => m.month).pop();
  const fyLabel = summary ? `FY ${summary.financialYear}` : "";

  return (
    <>
      <PageMeta title={t("Tax Tracker")} description="Income tax deducted so far and forecast for the rest of the financial year" />
      <PageBreadcrumb
        pageTitle="Tax Tracker"
        actions={summary && (
          <ToolbarSelect aria-label={t("Financial year")} value={summary.financialYear}
            onChange={(e) => setParams({ fy: e.target.value })}>
            {summary.financialYears.map((year) => <option key={year} value={year}>FY {year}</option>)}
          </ToolbarSelect>
        )}
      />
      <div className={PAGE_BODY}>
        {loading && !summary ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>
        ) : !summary ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("The tax tracker could not be loaded.")}</div>
        ) : (
          <>
            <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HeadlineCard label={t("Tax deducted")} value={money(summary.taxPaid)} band="bg-[#2a78d6] dark:bg-[#3987e5]"
                note={lastPaid ? `${t("Up to")} ${monthLabel(lastPaid)}` : t("No payroll run this year yet")} />
              <HeadlineCard label={t("Forecast, rest of year")} value={money(summary.taxForecast)} band="bg-[#eb6834] dark:bg-[#d95926]"
                note={t("At today's salaries and declarations")} />
              <HeadlineCard label={t("Projected tax for the year")} value={money(summary.projectedAnnualTax)} band="bg-slate-400 dark:bg-gray-500"
                note={`${fyLabel} · ${summary.employees} ${t("employees")}`} />
              <HeadlineCard label={t("Take-home paid")} value={money(summary.takeHomePaid)} band="bg-slate-400 dark:bg-gray-500"
                note={`${money(summary.takeHomeForecast)} ${t("forecast for the rest of the year")}`} />
            </div>

            <div className={`${CARD} mb-[17px] p-4`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className={CARD_TITLE}>{t("Income tax by month")}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">{fyLabel} · {t("April to March")}</div>
                </div>
                <button type="button" className="text-xs text-cyan-700 hover:underline dark:text-cyan-400" onClick={() => setShowTable((v) => !v)}>
                  {showTable ? t("Hide table") : t("Show table")}
                </button>
              </div>
              <div className="h-64" role="img" aria-label={t("Income tax deducted and forecast by month")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: colors.grid }} tick={{ fontSize: 11, fill: colors.axis }} />
                    <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: colors.axis }}
                      tickFormatter={(v) => money(v)} />
                    <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ fill: colors.grid, opacity: 0.4 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullMonth ?? ""}
                      formatter={(value, name) => [money(Number(value)), String(name)]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="deducted" name={t("Deducted")} stackId="tax" fill={colors.paid} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="forecast" name={t("Forecast")} stackId="tax" fill={colors.forecast} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {showTable && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-xs tabular-nums">
                    <thead>
                      <tr className="text-slate-500 dark:text-gray-400">
                        <th className="py-1 pr-2 text-left font-medium">{t("Month")}</th>
                        {summary.months.map((m) => <th key={m.month} className="px-1 py-1 text-right font-medium">{monthLabel(m.month, true)}</th>)}
                        <th className="py-1 pl-2 text-right font-medium">{t("Total")}</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-800 dark:text-gray-200">
                      <tr className="border-t border-slate-100 dark:border-gray-800">
                        <td className="py-1 pr-2">{t("Deducted")}</td>
                        {summary.months.map((m) => <td key={m.month} className="px-1 py-1 text-right">{m.taxPaid ? money(m.taxPaid) : "–"}</td>)}
                        <td className="py-1 pl-2 text-right font-semibold">{money(summary.taxPaid)}</td>
                      </tr>
                      <tr className="border-t border-slate-100 dark:border-gray-800">
                        <td className="py-1 pr-2">{t("Forecast")}</td>
                        {summary.months.map((m) => <td key={m.month} className="px-1 py-1 text-right">{m.taxForecast ? money(m.taxForecast) : "–"}</td>)}
                        <td className="py-1 pl-2 text-right font-semibold">{money(summary.taxForecast)}</td>
                      </tr>
                      <tr className="border-t border-slate-200 font-semibold dark:border-gray-700">
                        <td className="py-1 pr-2">{t("Total")}</td>
                        {summary.months.map((m) => <td key={m.month} className="px-1 py-1 text-right">{money(Number(m.taxPaid) + Number(m.taxForecast))}</td>)}
                        <td className="py-1 pl-2 text-right">{money(summary.projectedAnnualTax)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className={CARD_TITLE}>{t("Employees")} <span className="font-normal text-slate-500">({people.length})</span></div>
              <label className="relative block sm:w-72">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Search name, code, designation")}
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-[#191919] dark:text-gray-200" />
              </label>
            </div>
            {people.length === 0 ? (
              <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>
                {summary.people.length === 0 ? t("No employees on India payroll with a salary for this year.") : t("No employee matches the search.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {people.map((person) => (
                  <EmployeeCard key={person.employeeId} person={person}
                    onOpen={() => navigate(`/taxTracker/${person.employeeId}?fy=${summary.financialYear}`)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default TaxTrackerPage;
