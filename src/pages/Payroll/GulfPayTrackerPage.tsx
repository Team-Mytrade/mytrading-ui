import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { usePermissions } from "../../access/usePermissions";
import { CHART_TOOLTIP } from "../Dashboard/dashboardKit";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, PAGE_BODY } from "./hrmsUi";
import { HeadlineCard } from "./TaxTrackerPage";
import { chartColors, initials, isDarkTheme, money, monthLabel } from "./taxTracker";
import { GULF_PAY_API, GulfEmployeePay, GulfSummary } from "./gulfPay";

const PersonCard: React.FC<{ person: GulfEmployeePay; onOpen: () => void }> = ({ person, onOpen }) => {
  const months = person.monthsPaid + person.monthsForecast;
  const monthly = person.monthsForecast > 0 ? person.netForecast / person.monthsForecast : person.monthsPaid > 0 ? person.netPaid / person.monthsPaid : 0;
  return (
    <button type="button" onClick={onOpen}
      className={`${CARD} p-4 text-left transition hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          {initials(person.employeeName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900 dark:text-white">{person.employeeName}</div>
          <div className="truncate text-xs text-slate-500 dark:text-gray-400">{[person.employeeCode, person.designation].filter(Boolean).join(" · ")}</div>
        </div>
        {person.scheme && <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-gray-700 dark:text-gray-300">{person.scheme}</span>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div><div className="text-slate-500 dark:text-gray-400">{t("Net paid")}</div><div className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(person.netPaid)}</div></div>
        <div><div className="text-slate-500 dark:text-gray-400">{t("Forecast")}</div><div className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(person.netForecast)}</div></div>
        <div><div className="text-slate-500 dark:text-gray-400">{t("Gratuity")}</div><div className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(person.gratuityAccrued)}</div></div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-gray-800">
        <span className="text-slate-500 dark:text-gray-400">{t("Take-home / month")} · {months} {t("months")}</span>
        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{money(monthly)}</span>
      </div>
    </button>
  );
};

/** HR's view of Gulf payroll over the calendar year: net pay paid and forecast, pension shares and gratuity. */
const GulfPayTrackerPage: React.FC = () => {
  const navigate = useNavigate();
  const { canApprove } = usePermissions();
  const [params, setParams] = useSearchParams();
  const year = params.get("year") ?? "";
  const [summary, setSummary] = useState<GulfSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!canApprove) navigate("/mySalary", { replace: true });
  }, [canApprove, navigate]);

  useEffect(() => {
    if (!canApprove) return;
    setLoading(true);
    axios.get<GulfSummary>(GULF_PAY_API, { params: year ? { year } : {} })
      .then((res) => setSummary(res.data))
      .catch((error) => { setSummary(null); ToasterService.error(apiError(error, "The pay tracker could not be loaded")); })
      .finally(() => setLoading(false));
  }, [year, canApprove]);

  const colors = chartColors(isDarkTheme());
  const chartData = useMemo(() => (summary?.months ?? []).map((m) => ({
    month: monthLabel(m.month, true), fullMonth: monthLabel(m.month), paid: Number(m.netPaid) || 0, forecast: Number(m.netForecast) || 0,
  })), [summary]);
  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (summary?.people ?? []).filter((p) => !q || [p.employeeName, p.employeeCode, p.designation, p.department].some((v) => v?.toLowerCase().includes(q)));
  }, [summary, search]);
  const lastPaid = summary?.months.filter((m) => m.status === "ACTUAL").map((m) => m.month).pop();

  return (
    <>
      <PageMeta title={t("Pay Tracker")} description="Net pay, pension and gratuity over the year on Gulf payroll" />
      <PageBreadcrumb
        pageTitle="Pay Tracker"
        actions={summary && (
          <ToolbarSelect aria-label={t("Year")} value={String(summary.year)} onChange={(e) => setParams({ year: e.target.value })}>
            {summary.years.map((y) => <option key={y} value={y}>{y}</option>)}
          </ToolbarSelect>
        )}
      />
      <div className={PAGE_BODY}>
        {loading && !summary ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>
        ) : !summary ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("The pay tracker could not be loaded.")}</div>
        ) : (
          <>
            <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HeadlineCard label={t("Net pay paid")} value={money(summary.netPaid)} band="bg-[#2a78d6] dark:bg-[#3987e5]"
                note={lastPaid ? `${t("Up to")} ${monthLabel(lastPaid)}` : t("No payroll run this year yet")} />
              <HeadlineCard label={t("Forecast, rest of year")} value={money(summary.netForecast)} band="bg-[#eb6834] dark:bg-[#d95926]"
                note={t("At today's salaries")} />
              <HeadlineCard label={t("Employer pension paid")} value={money(summary.employerContributionPaid)} band="bg-slate-400 dark:bg-gray-500"
                note={`${summary.year} · ${summary.employees} ${t("employees")}`} />
              <HeadlineCard label={t("Gratuity provision")} value={money(summary.gratuityAccrued)} band="bg-slate-400 dark:bg-gray-500"
                note={t("built up this year (end of service)")} />
            </div>

            <div className={`${CARD} mb-[17px] p-4`}>
              <div className="mb-2">
                <div className={CARD_TITLE}>{t("Net pay by month")}</div>
                <div className="text-xs text-slate-500 dark:text-gray-400">{summary.year} · {t("January to December · no income tax on Gulf payroll")}</div>
              </div>
              <div className="h-64" role="img" aria-label={t("Net pay paid and forecast by month")}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke={colors.grid} />
                    <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: colors.grid }} tick={{ fontSize: 11, fill: colors.axis }} />
                    <YAxis tickLine={false} axisLine={false} width={72} tick={{ fontSize: 11, fill: colors.axis }} tickFormatter={(v) => money(v)} />
                    <Tooltip contentStyle={CHART_TOOLTIP} cursor={{ fill: colors.grid, opacity: 0.4 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullMonth ?? ""}
                      formatter={(value, name) => [money(Number(value)), String(name)]} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="paid" name={t("Paid")} stackId="net" fill={colors.paid} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="forecast" name={t("Forecast")} stackId="net" fill={colors.forecast} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
              <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("No employees on Gulf payroll for this year.")}</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {people.map((p) => <PersonCard key={p.employeeId} person={p} onOpen={() => navigate(`/taxTracker/${p.employeeId}?year=${summary.year}`)} />)}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default GulfPayTrackerPage;
