import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "./hrmsUi";
import { TAX_TRACKER_API, TaxSummary, money, monthLabel } from "./taxTracker";
import CompanyPf from "./CompanyPf";
import CompanyTax from "./CompanyTax";

interface Line {
  name: string;
  months: Record<string, number>;
  total: number;
}

interface Group {
  key: "EARNINGS" | "DEDUCTIONS" | "EMPLOYER";
  title: string;
  lines: Line[];
  total: Line;
}

interface CompanyMonth {
  month: string;
  employees: number;
  awaitingApproval: number;
  fromOldSystem: number;
}

interface CompanyStatement {
  financialYear: string;
  financialYears: string[];
  department?: string | null;
  departments: string[];
  months: CompanyMonth[];
  groups: Group[];
  netPay: Line;
  earned: number;
  deductions: number;
  netPaid: number;
  employerContributions: number;
  employerCost: number;
  employees: number;
  awaitingApproval: number;
  warnings: string[];
}

interface CellRow {
  employeeId: number;
  employeeCode?: string | null;
  employeeName: string;
  department?: string | null;
  amount: number;
}

interface Cell {
  group: string;
  line?: string | null;
  month?: string | null;
  total: number;
  employees: CellRow[];
}

const API = "/v1/api/payroll/statements/company/ytd";

const Metric: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className={`${CARD} p-3`}>
    <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
    <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
  </div>
);

/**
 * Payroll → Statements (docs/PAYROLL-STATEMENTS.md §4): the company's YTD statement — every pay line summed over the
 * employees by month, for one department or all — with the employees behind any figure a click away, and an employee
 * picker that opens one employee's own statement.
 */
const PayrollStatementsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const fy = params.get("fy") ?? "";
  const department = params.get("department") ?? "";
  const viewParam = params.get("view");
  const view = viewParam === "pf" || viewParam === "tax" ? viewParam : "ytd";
  const [data, setData] = useState<CompanyStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ EMPLOYER: true });
  const [people, setPeople] = useState<TaxSummary["people"]>([]);
  const [cell, setCell] = useState<{ title: string; data: Cell | null } | null>(null);

  const setParam = (key: string, value: string) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value); else p.delete(key);
    setParams(p, { replace: true });
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCell(null);
    axios.get<CompanyStatement>(API, { params: { fy: fy || undefined, department: department || undefined } })
      .then((res) => setData(res.data && Array.isArray(res.data.months) ? res.data : null))
      .catch((err) => {
        setData(null);
        setError(apiError(err, "The company's YTD statement could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [fy, department]);

  // Everyone paid this year, for the employee picker (the Tax Tracker's list)
  useEffect(() => {
    axios.get<TaxSummary>(TAX_TRACKER_API, { params: fy ? { fy } : {} })
      .then((res) => setPeople(Array.isArray(res.data?.people) ? res.data.people : []))
      .catch(() => setPeople([]));
  }, [fy]);

  const openCell = async (group: string, line: string | null, month: string | null, title: string) => {
    setCell({ title, data: null });
    try {
      const res = await axios.get<Cell>(`${API}/cell`, {
        params: { fy: data?.financialYear, department: department || undefined, group, line: line || undefined, month: month || undefined },
      });
      setCell({ title, data: res.data });
    } catch (err) {
      setCell(null);
      ToasterService.error(apiError(err, "The employees behind this figure could not be loaded"));
    }
  };

  const download = async () => {
    try {
      const res = await axios.get<Blob>(`${API}/export`, {
        params: { fy: data?.financialYear, department: department || undefined }, responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `company-ytd-${data?.financialYear ?? "year"}${department ? `-${department}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(apiError(err, "The statement could not be downloaded"));
    }
  };

  const { shown, later } = useMemo(() => {
    const months = data?.months ?? [];
    let last = -1;
    months.forEach((m, i) => { if (m.employees > 0 || m.awaitingApproval > 0) last = i; });
    return { shown: months.slice(0, last + 1), later: months.slice(last + 1) };
  }, [data]);

  const sortedPeople = useMemo(() => [...people].sort((a, b) => a.employeeName.localeCompare(b.employeeName)), [people]);
  const laterLabel = later.length === 0 ? null
    : later.length === 1 ? monthLabel(later[0].month, true)
    : `${monthLabel(later[0].month, true).split(" ")[0]}–${monthLabel(later[later.length - 1].month, true).split(" ")[0]}`;
  const colCount = 2 + shown.length + (laterLabel ? 1 : 0);
  const th = "px-2 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap";
  const td = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
  const cellButton = "rounded px-1 -mx-1 hover:bg-cyan-50 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-200";

  const row = (group: string, line: Line, kind: "line" | "total" | "net") => {
    const lineKey = kind === "line" ? line.name : null;
    const drillGroup = kind === "net" ? "NET" : group;
    const canDrill = kind !== "total";
    const border = kind !== "line" ? "border-t border-slate-200 dark:border-gray-700" : "";
    const figure = (value: number | undefined, month: string | null) => {
      if (value == null) return <span className="text-slate-300 dark:text-gray-600">—</span>;
      if (!canDrill) return money(value);
      return (
        <button type="button" className={cellButton} title={t("See the employees")}
          onClick={() => openCell(drillGroup, lineKey, month, `${line.name} · ${month ? monthLabel(month) : `FY ${data?.financialYear}`}`)}>
          {money(value)}
        </button>
      );
    };
    return (
      <tr key={`${group}-${kind}-${line.name}`}
        className={kind === "net" ? "bg-cyan-50 font-semibold text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
          : kind === "total" ? "bg-white font-semibold text-slate-900 dark:bg-[#191919] dark:text-white"
          : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-[#191919] dark:text-gray-300 dark:hover:bg-[#222]"}>
        <td className={`sticky left-0 z-10 bg-inherit px-3 py-1.5 text-left ${kind === "line" ? "pl-6" : border}`}>{line.name}</td>
        <td className={`${td} font-semibold ${border}`}>{figure(line.total, null)}</td>
        {shown.map((m) => <td key={m.month} className={`${td} ${border}`}>{figure(line.months?.[m.month], m.month)}</td>)}
        {laterLabel && <td className={`${td} text-slate-300 dark:text-gray-600 ${border}`}>—</td>}
      </tr>
    );
  };

  return (
    <>
      <PageMeta title={t("Payroll statements")} description="The company's pay lines by month over the financial year, and each employee's statement" />
      <PageBreadcrumb
        pageTitle="Payroll statements"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarSelect aria-label={t("Employee")} value="" onChange={(e) => e.target.value && navigate(`/taxTracker/${e.target.value}?tab=${view}${data ? `&fy=${data.financialYear}` : ""}`)}>
              <option value="">{t("All employees")}</option>
              {sortedPeople.map((p) => <option key={p.employeeId} value={p.employeeId}>{p.employeeName}{p.employeeCode ? ` (${p.employeeCode})` : ""}</option>)}
            </ToolbarSelect>
            <ToolbarSelect aria-label={t("Department")} value={department} onChange={(e) => setParam("department", e.target.value)}>
              <option value="">{t("All departments")}</option>
              {(data?.departments ?? []).map((d) => <option key={d} value={d}>{d === "No department" ? t(d) : d}</option>)}
            </ToolbarSelect>
            {data && (
              <ToolbarSelect aria-label={t("Financial year")} value={data.financialYear} onChange={(e) => setParam("fy", e.target.value)}>
                {Array.from(new Set([data.financialYear, ...data.financialYears])).map((y) => <option key={y} value={y}>FY {y}</option>)}
              </ToolbarSelect>
            )}
            {view === "ytd" && (
              <button type="button" className={TOOL_BUTTON} onClick={download} disabled={!data}>
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />{t("Download Excel")}
              </button>
            )}
          </div>
        }
      />
      <div className={PAGE_BODY}>
        <div className="mb-4 flex gap-5 border-b border-slate-200 dark:border-gray-800" role="tablist">
          {([["ytd", t("YTD statement")], ["pf", t("PF")], ["tax", t("Income tax")]] as const).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setParam("view", key === "ytd" ? "" : key)}
              className={`-mb-px border-b-2 px-0.5 pb-2 text-sm font-medium transition ${view === key
                ? "border-cyan-600 text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400"}`}>
              {label}
            </button>
          ))}
        </div>
        {view === "pf" ? (
          <CompanyPf fy={fy} department={department} />
        ) : view === "tax" ? (
          <CompanyTax fy={fy} department={department} />
        ) : loading && !data ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>
        ) : !data ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{error ?? t("The company's YTD statement could not be loaded.")}</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <Metric label={t("Gross paid")} value={money(data.earned)} note={`${data.employees} ${t(data.employees === 1 ? "employee" : "employees")}`} />
              <Metric label={t("Deductions")} value={money(data.deductions)} />
              <Metric label={t("Net paid")} value={money(data.netPaid)} />
              <Metric label={t("Employer contributions")} value={money(data.employerContributions)} note={t("PF, ESI and benefits")} />
              <Metric label={t("Employer cost")} value={money(data.employerCost)} note={t("Gross plus employer contributions")} />
            </div>

            {data.warnings.length > 0 && (
              <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-[#222] dark:text-gray-300">
                {data.warnings.map((w) => <div key={w}>{w}</div>)}
              </div>
            )}

            <div className={`grid gap-4 ${cell ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
              <div className={`${CARD} min-w-0 overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                  <div className={CARD_TITLE}>
                    {t("Company YTD statement")} · FY {data.financialYear}{data.department ? ` · ${data.department}` : ""}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400">{t("Click a figure to see the employees behind it")}</span>
                </div>
                {shown.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">{t("No salary paid in this financial year yet.")}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-[#222]">
                        <tr>
                          <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:bg-[#222] dark:text-gray-400" style={{ minWidth: 170 }}>{t("Pay line")}</th>
                          <th className={th}>{t("Total")}</th>
                          {shown.map((m) => (
                            <th key={m.month} className={th}>
                              {monthLabel(m.month, true)}
                              <div className="mt-0.5 text-[10px] font-medium text-slate-400">{m.employees} {t("paid")}</div>
                              {(m.fromOldSystem > 0 || m.awaitingApproval > 0) && (
                                <div className="flex justify-end gap-1 text-[10px] font-medium">
                                  {m.fromOldSystem > 0 && <span className="rounded bg-slate-100 px-1 text-slate-600 dark:bg-gray-800 dark:text-gray-300">{t("Old system")}</span>}
                                  {m.awaitingApproval > 0 && <span className="rounded bg-amber-50 px-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{m.awaitingApproval} {t("awaiting")}</span>}
                                </div>
                              )}
                            </th>
                          ))}
                          {laterLabel && <th className={`${th} text-slate-400`}>{laterLabel}<div className="text-[10px] font-medium">{t("not paid yet")}</div></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {data.groups.filter((g) => g.lines.length > 0).map((g) => (
                          <React.Fragment key={g.key}>
                            <tr className="bg-slate-50/70 dark:bg-[#1f1f1f]">
                              <td colSpan={colCount} className="sticky left-0 px-3 py-1.5 text-left">
                                <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400"
                                  onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !c[g.key] }))} aria-expanded={!collapsed[g.key]}>
                                  {collapsed[g.key] ? <ChevronRightIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                                  {t(g.title)}
                                </button>
                              </td>
                            </tr>
                            {!collapsed[g.key] && g.lines.map((l) => row(g.key, l, "line"))}
                            {row(g.key, g.total, "total")}
                          </React.Fragment>
                        ))}
                        {row("NET", data.netPay, "net")}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
                  {t("From processed payslips, months brought in from the old system included; runs waiting for approval show once approved. The department is the one the salary was paid under.")}
                </div>
              </div>

              {cell && (
                <aside className={`${CARD} h-fit overflow-hidden xl:sticky xl:top-4`} aria-label={t("Employees behind the figure")}>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                    <div>
                      <div className={CARD_TITLE}>{cell.title}</div>
                      {cell.data && (
                        <div className="text-xs text-slate-500 dark:text-gray-400">
                          {cell.data.employees.length} {t(cell.data.employees.length === 1 ? "employee" : "employees")} · {money(cell.data.total)}
                        </div>
                      )}
                    </div>
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800" onClick={() => setCell(null)} aria-label={t("Close")}>
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {!cell.data ? (
                    <div className="p-6 text-center text-sm text-slate-500">{t("Loading…")}</div>
                  ) : (
                    <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-gray-800">
                      {cell.data.employees.map((r) => (
                        <li key={r.employeeId}>
                          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#222]"
                            onClick={() => navigate(`/taxTracker/${r.employeeId}?tab=ytd&fy=${data.financialYear}`)}>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-800 dark:text-gray-200">{r.employeeName}</span>
                              <span className="block truncate text-[11px] text-slate-500 dark:text-gray-400">{[r.employeeCode, r.department].filter(Boolean).join(" · ")}</span>
                            </span>
                            <span className="shrink-0 text-sm tabular-nums text-slate-900 dark:text-white">{money(r.amount)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PayrollStatementsPage;
