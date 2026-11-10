import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { ChevronDownIcon, ChevronRightIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import MonthSwitcher from "../../components/common/MonthSwitcher";
import ToolbarSelect from "../../components/common/ToolbarSelect";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { todayIso } from "../../utils/localDate";
import { CARD, CARD_TITLE, PAGE_BODY, TOOL_BUTTON } from "./hrmsUi";
import { t } from "../../i18n/i18n";
import { money, monthLabel } from "./taxTracker";
import DepartmentDonut from "./DepartmentDonut";

interface Amounts {
  gross: number;
  incomeTax: number;
  otherDeductions: number;
  netPaid: number;
  employerContributions: number;
  costToCompany: number;
}
interface EmployeeRow {
  employeeId: number;
  employeeCode?: string;
  employeeName: string;
  designation?: string;
  yearlyCtc?: number | null;
  monthsPaid: number;
  amounts: Amounts;
}
interface DepartmentRow {
  department: string;
  employees: number;
  averageCtc: number;
  amounts: Amounts;
  people: EmployeeRow[];
}
interface Report {
  month: string;
  period: "MONTH" | "YTD";
  from: string;
  to: string;
  department?: string | null;
  employees: number;
  totals: Amounts;
  departments: DepartmentRow[];
  allDepartments: string[];
}

/** Compact rupees for headline figures: ₹16.8 L, ₹1.2 Cr. */
const lakhs = (value: number) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return money(n);
};

const Metric: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className={`${CARD} p-3`}>
    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-gray-400">{label}</div>
    <div className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-white tabular-nums">{value}</div>
    <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>
  </div>
);

const NUM = "px-3 py-2 text-right tabular-nums";
const rowId = (department: string) => `dept-row-${department.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

/** Salary cost by department for finance: a month or the year to date, all departments or one. */
const DepartmentSalaryPage: React.FC = () => {
  const thisMonth = todayIso().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [period, setPeriod] = useState<"MONTH" | "YTD">("MONTH");
  const [department, setDepartment] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    axios.get<Report>("/v1/api/payroll/department-salary", { params: { month, period, ...(department ? { department } : {}) } })
      .then((res) => {
        setReport(res.data);
        // One department chosen: show its people straight away
        setOpen(new Set(department ? [department] : []));
      })
      .catch((error) => {
        setReport(null);
        ToasterService.error(apiError(error, "Department salaries could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [month, period, department]);

  const periodLabel = report ? (report.period === "YTD" ? `${monthLabel(report.from)} – ${monthLabel(report.to)}` : monthLabel(report.to)) : "";

  // A slice (or legend row) clicked: open that department's people below, bring the row into view and flash it
  const [flash, setFlash] = useState<string | null>(null);
  const showDepartment = (name: string) => {
    setOpen(new Set([name])); // only the chosen department stays open; the one shown before closes
    setFlash(name);
    window.setTimeout(() => setFlash((current) => (current === name ? null : current)), 1600);
    window.setTimeout(() => document.getElementById(rowId(name))?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const toggle = (name: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const exportExcel = () => {
    if (!report) return;
    const rows: (string | number)[][] = [["Department", "Employee code", "Employee", "Designation", "Months paid", "Gross", "Income tax",
      "Other deductions", "Net paid", "Employer PF/ESI", "Cost to company", "Yearly CTC"]];
    for (const d of report.departments) {
      for (const p of d.people) {
        rows.push([d.department, p.employeeCode ?? "", p.employeeName, p.designation ?? "", p.monthsPaid, p.amounts.gross, p.amounts.incomeTax,
          p.amounts.otherDeductions, p.amounts.netPaid, p.amounts.employerContributions, p.amounts.costToCompany, p.yearlyCtc ?? ""]);
      }
      rows.push([`${d.department} total`, "", "", "", d.employees, d.amounts.gross, d.amounts.incomeTax, d.amounts.otherDeductions,
        d.amounts.netPaid, d.amounts.employerContributions, d.amounts.costToCompany, d.averageCtc]);
    }
    rows.push(["Total", "", "", "", report.employees, report.totals.gross, report.totals.incomeTax, report.totals.otherDeductions,
      report.totals.netPaid, report.totals.employerContributions, report.totals.costToCompany, ""]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Department salary");
    XLSX.writeFile(wb, `Department_Salary_${report.period === "YTD" ? `${report.from}_to_${report.to}` : report.to}.xlsx`);
  };

  return (
    <>
      <PageMeta title={t("Department Salary")} description="Salary cost by department for a month or the financial year to date" />
      <PageBreadcrumb
        pageTitle="Department Salary"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MonthSwitcher value={month} onChange={setMonth} max={thisMonth} ariaLabel={t("Month")} />
            <div role="radiogroup" aria-label={t("Period")} className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white/80 p-0.5 text-xs font-semibold dark:border-gray-700 dark:bg-[#191919]">
              {(["MONTH", "YTD"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                  className={`h-7 rounded-full px-3 transition ${period === p ? "bg-cyan-600 text-white" : "text-slate-600 hover:text-slate-900 dark:text-gray-300"}`}>
                  {p === "MONTH" ? t("Month") : t("Year to date")}
                </button>
              ))}
            </div>
            <ToolbarSelect aria-label={t("Department")} value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">{t("All departments")}</option>
              {(report?.allDepartments ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
            </ToolbarSelect>
            <button type="button" className={TOOL_BUTTON} onClick={exportExcel} disabled={!report || report.departments.length === 0}>
              <DocumentArrowDownIcon className="h-3.5 w-3.5" />{t("Export")}
            </button>
          </div>
        }
      />
      <div className={PAGE_BODY}>
        {loading && !report ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>
        ) : !report ? (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Department salaries could not be loaded.")}</div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric label={t("Employees paid")} value={String(report.employees)}
                note={`${report.departments.length} ${report.departments.length === 1 ? t("department") : t("departments")} · ${periodLabel}`} />
              <Metric label={t("Gross pay")} value={lakhs(report.totals.gross)} note={t("before deductions")} />
              <Metric label={t("Net paid")} value={lakhs(report.totals.netPaid)} note={`${t("income tax")} ${lakhs(report.totals.incomeTax)}`} />
              <Metric label={t("Cost to company")} value={lakhs(report.totals.costToCompany)} note={t("gross + employer PF/ESI")} />
            </div>

            {report.departments.length === 0 ? (
              <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>
                {t("No payroll has been run for")} {periodLabel}{department ? ` (${department})` : ""}.
              </div>
            ) : (
              <>
                <div className={`${CARD} mb-4 p-4`}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className={CARD_TITLE}>{t("Cost to company by department")}</div>
                    <span className="text-xs text-slate-500 dark:text-gray-400">{periodLabel}</span>
                  </div>
                  <DepartmentDonut totalLabel={t("Total")} onSelect={showDepartment}
                    slices={report.departments.map((d) => ({
                      name: d.department,
                      value: Number(d.amounts.costToCompany) || 0,
                      colorIndex: Math.max(0, report.allDepartments.findIndex((n) => n.toLowerCase() === d.department.toLowerCase())),
                    }))} />
                </div>

                <div className={`${CARD} overflow-x-auto`}>
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-gray-800 dark:text-gray-400">
                        <th className="px-3 py-2 text-left font-medium">{t("Department")}</th>
                        <th className={`${NUM} font-medium`}>{t("People")}</th>
                        <th className={`${NUM} font-medium`}>{t("Gross")}</th>
                        <th className={`${NUM} font-medium`}>{t("Income tax")}</th>
                        <th className={`${NUM} font-medium`}>{t("Net paid")}</th>
                        <th className={`${NUM} font-medium`}>{t("Cost to company")}</th>
                        <th className={`${NUM} font-medium`}>{t("Avg yearly CTC")}</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-800 dark:text-gray-200">
                      {report.departments.map((d) => {
                        const expanded = open.has(d.department);
                        return (
                          <React.Fragment key={d.department}>
                            <tr id={rowId(d.department)}
                              className={`border-b border-slate-100 transition-colors duration-700 dark:border-gray-800 ${flash === d.department ? "bg-cyan-100/70 dark:bg-cyan-900/40" : ""}`}>
                              <td className="px-3 py-2">
                                <button type="button" onClick={() => toggle(d.department)} aria-expanded={expanded}
                                  className="inline-flex items-center gap-1.5 font-medium text-slate-900 hover:text-cyan-700 dark:text-white">
                                  {expanded ? <ChevronDownIcon className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                                  {d.department}
                                </button>
                              </td>
                              <td className={NUM}>{d.employees}</td>
                              <td className={NUM}>{money(d.amounts.gross)}</td>
                              <td className={NUM}>{money(d.amounts.incomeTax)}</td>
                              <td className={NUM}>{money(d.amounts.netPaid)}</td>
                              <td className={NUM}>{money(d.amounts.costToCompany)}</td>
                              <td className={NUM}>{d.averageCtc ? lakhs(d.averageCtc) : "–"}</td>
                            </tr>
                            {expanded && d.people.map((p) => (
                              <tr key={p.employeeId} className="border-b border-slate-100 bg-slate-50/70 text-[13px] dark:border-gray-800 dark:bg-[#1f1f1f]">
                                <td className="py-1.5 pl-9 pr-3">
                                  <div className="text-slate-800 dark:text-gray-200">{p.employeeName}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-gray-400">
                                    {[p.employeeCode, p.designation, report.period === "YTD" ? `${p.monthsPaid} ${t("months")}` : ""].filter(Boolean).join(" · ")}
                                  </div>
                                </td>
                                <td className={NUM}></td>
                                <td className={NUM}>{money(p.amounts.gross)}</td>
                                <td className={NUM}>{money(p.amounts.incomeTax)}</td>
                                <td className={NUM}>{money(p.amounts.netPaid)}</td>
                                <td className={NUM}>{money(p.amounts.costToCompany)}</td>
                                <td className={NUM}>{p.yearlyCtc ? lakhs(p.yearlyCtc) : "–"}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      <tr className="font-semibold text-slate-900 dark:text-white">
                        <td className="px-3 py-2">{t("Total")}</td>
                        <td className={NUM}>{report.employees}</td>
                        <td className={NUM}>{money(report.totals.gross)}</td>
                        <td className={NUM}>{money(report.totals.incomeTax)}</td>
                        <td className={NUM}>{money(report.totals.netPaid)}</td>
                        <td className={NUM}>{money(report.totals.costToCompany)}</td>
                        <td className={NUM}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">
                  {t("Each salary counts in the department it was paid under. Cost to company is gross pay plus the employer's PF and ESI.")}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default DepartmentSalaryPage;
