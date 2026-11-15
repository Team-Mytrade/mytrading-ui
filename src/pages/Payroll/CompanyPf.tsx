import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE } from "./hrmsUi";
import { money, monthLabel } from "./taxTracker";
import { PF_COLORS, PfBars } from "./PfStatement";

interface CompanyMonth {
  month: string;
  employees: number;
  awaitingApproval: number;
  pfWage: number;
  employee: number;
  employerEpf: number;
  pension: number;
  total: number;
  dueDate: string;
}

export interface CompanyPfData {
  financialYear: string;
  financialYears: string[];
  departments: string[];
  months: CompanyMonth[];
  employee: number;
  employerEpf: number;
  pension: number;
  total: number;
  employeesCovered: number;
  employeesWithoutUan: number;
  warnings: string[];
}

interface EmployeeMonth {
  employeeId: number;
  employeeCode?: string | null;
  employeeName: string;
  department?: string | null;
  uan?: string | null;
  employee: number;
  employerEpf: number;
  pension: number;
  total: number;
  pensionWorkedOut: boolean;
}

interface MonthDetail {
  month: string;
  dueDate: string;
  employees: EmployeeMonth[];
  total: number;
}

const API = "/v1/api/payroll/statements/company/pf";
const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const Metric: React.FC<{ label: string; value: string; note?: string; dot?: string; tone?: "red" }> = ({ label, value, note, dot, tone }) => (
  <div className={`${CARD} p-3`}>
    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden="true" />}{label}
    </div>
    <div className={`mt-0.5 text-xl font-semibold tabular-nums ${tone === "red" ? "text-red-600" : "text-slate-900 dark:text-white"}`}>{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
  </div>
);

/**
 * The company's PF (docs/PAYROLL-STATEMENTS.md §4.2): by wage month, the employees covered, their share and the
 * employer's EPF and pension, the total due to EPFO and its due date (the 15th of the next month); a month opens its
 * employees (the ECR's lines).
 */
const CompanyPf: React.FC<{ fy: string; department: string; onLoaded?: (d: CompanyPfData) => void }> = ({ fy, department, onLoaded }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<CompanyPfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ month: string; detail: MonthDetail | null } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOpen(null);
    axios.get<CompanyPfData>(API, { params: { fy: fy || undefined, department: department || undefined } })
      .then((res) => {
        const d = res.data && Array.isArray(res.data.months) ? res.data : null;
        setData(d);
        if (d && onLoaded) onLoaded(d);
      })
      .catch((err) => {
        setData(null);
        setError(apiError(err, "The company's PF could not be loaded"));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fy, department]);

  const openMonth = async (month: string) => {
    setOpen({ month, detail: null });
    try {
      const res = await axios.get<MonthDetail>(`${API}/month`, { params: { month, department: department || undefined } });
      setOpen({ month, detail: res.data });
    } catch (err) {
      setOpen(null);
      ToasterService.error(apiError(err, "The month's PF could not be loaded"));
    }
  };

  if (loading && !data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>;
  if (!data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{error ?? t("The company's PF could not be loaded.")}</div>;

  const months = data.months.filter((m) => m.employees > 0 || m.awaitingApproval > 0);
  const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
  const th = "px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Metric label={t("Employee PF")} value={money(data.employee)} dot={PF_COLORS.employee} />
        <Metric label={t("Employer EPF")} value={money(data.employerEpf)} dot={PF_COLORS.epf} />
        <Metric label={t("Pension (EPS)")} value={money(data.pension)} dot={PF_COLORS.pension} />
        <Metric label={t("Due to EPFO")} value={money(data.total)} note={`${data.employeesCovered} ${t(data.employeesCovered === 1 ? "employee" : "employees")} ${t("covered")}`} />
        <Metric label={t("Without UAN")} value={String(data.employeesWithoutUan)} tone={data.employeesWithoutUan > 0 ? "red" : undefined} note={t("The ECR needs one each")} />
      </div>

      {data.warnings.length > 0 && (
        <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-[#222] dark:text-gray-300">
          {data.warnings.map((w) => <div key={w}>{w}</div>)}
        </div>
      )}

      <div className={`grid gap-4 ${open ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className={`${CARD} min-w-0 overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
            <div className={CARD_TITLE}>{t("Company PF")} · {data.financialYear}</div>
            <span className="text-[11px] text-slate-500 dark:text-gray-400">{t("Click a month to see its employees")}</span>
          </div>
          {months.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">{t("No PF in this year yet.")}</div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-4 pt-4 pb-2 dark:border-gray-800"><PfBars months={data.months} /></div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-[#222]">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap">{t("Wage month")}</th>
                      <th className={th}>{t("Employees")}</th>
                      <th className={th}>{t("Employee PF")}</th>
                      <th className={th}>{t("Employer EPF")}</th>
                      <th className={th}>{t("Pension")}</th>
                      <th className={th}>{t("Due to EPFO")}</th>
                      <th className={th}>{t("Due by")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {months.map((m) => (
                      <tr key={m.month} className={`cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-[#222] ${open?.month === m.month ? "bg-cyan-50/60 dark:bg-cyan-950/30" : ""}`}
                        onClick={() => openMonth(m.month)}>
                        <td className="px-3 py-2 text-left">
                          <button type="button" className="font-medium text-cyan-700 hover:underline dark:text-cyan-300" onClick={(e) => { e.stopPropagation(); openMonth(m.month); }}>
                            {monthLabel(m.month)}
                          </button>
                          {m.awaitingApproval > 0 && <span className="ml-1.5 rounded bg-amber-50 px-1 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{m.awaitingApproval} {t("awaiting")}</span>}
                        </td>
                        <td className={td}>{m.employees}</td>
                        <td className={td}>{money(m.employee)}</td>
                        <td className={td}>{money(m.employerEpf)}</td>
                        <td className={td}>{money(m.pension)}</td>
                        <td className={`${td} font-semibold text-slate-900 dark:text-white`}>{money(m.total)}</td>
                        <td className={`${td} text-slate-500`}>{day(m.dueDate)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 font-semibold text-slate-900 dark:border-gray-700 dark:text-white">
                      <td className="px-3 py-2 text-left">{t("Total")}</td>
                      <td className={td}>{data.employeesCovered}</td>
                      <td className={td}>{money(data.employee)}</td>
                      <td className={td}>{money(data.employerEpf)}</td>
                      <td className={td}>{money(data.pension)}</td>
                      <td className={`${td} text-cyan-700 dark:text-cyan-300`}>{money(data.total)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
            {t("Wage months March to February. Each month's ECR and challan are due by the 15th of the next month; the ECR file is on Statutory Compliances. EPFO admin and EDLI charges are not included.")}
          </div>
        </div>

        {open && (
          <aside className={`${CARD} h-fit overflow-hidden xl:sticky xl:top-4`} aria-label={t("The month's employees")}>
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <div>
                <div className={CARD_TITLE}>{t("PF")} · {monthLabel(open.month)}</div>
                {open.detail && (
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    {open.detail.employees.length} {t(open.detail.employees.length === 1 ? "employee" : "employees")} · {money(open.detail.total)} · {t("due by")} {day(open.detail.dueDate)}
                  </div>
                )}
              </div>
              <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800" onClick={() => setOpen(null)} aria-label={t("Close")}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            {!open.detail ? (
              <div className="p-6 text-center text-sm text-slate-500">{t("Loading…")}</div>
            ) : (
              <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-gray-800">
                {open.detail.employees.map((r) => (
                  <li key={r.employeeId}>
                    <button type="button" className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#222]"
                      onClick={() => navigate(`/taxTracker/${r.employeeId}?tab=pf&fy=${data.financialYear}`)}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-gray-200">{r.employeeName}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{money(r.total)}</span>
                      </span>
                      <span className="mt-0.5 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-gray-400">
                        <span className="truncate">{[r.employeeCode, r.uan ? `UAN ${r.uan}` : t("No UAN")].filter(Boolean).join(" · ")}</span>
                        <span className="shrink-0 tabular-nums">{money(r.employee)} / {money(r.employerEpf)} / {money(r.pension)}{r.pensionWorkedOut ? " *" : ""}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500 dark:border-gray-800 dark:text-gray-400">{t("Employee / employer EPF / pension")}</div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default CompanyPf;
