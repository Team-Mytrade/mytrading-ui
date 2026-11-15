import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, TOOL_BUTTON } from "./hrmsUi";
import { money, monthLabel } from "./taxTracker";

type MonthStatus = "PAID" | "OLD_SYSTEM" | "AWAITING_APPROVAL" | "NOT_PAID";

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

interface StatementMonth {
  month: string;
  status: MonthStatus;
  lossOfPayDays: number;
  oneOff: boolean;
}

export interface YtdStatementData {
  financialYear: string;
  financialYears: string[];
  currency?: string | null;
  months: StatementMonth[];
  groups: Group[];
  netPay: Line;
  earned: number;
  deductions: number;
  takeHome: number;
  employerContributions: number;
  monthsPaid: number;
}

const API = "/v1/api/payroll/statements/ytd";
const paidLike = (s: MonthStatus) => s === "PAID" || s === "OLD_SYSTEM";

const Metric: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className={`${CARD} p-3`}>
    <div className="text-xs text-slate-500 dark:text-gray-400">{label}</div>
    <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
  </div>
);

/**
 * The YTD statement (docs/PAYROLL-STATEMENTS.md §3.1): every payslip line by month over the financial year, grouped
 * as earnings, deductions and the employer's contributions, with totals and net pay. Months not paid yet are
 * narrow and grey; a click on a paid month opens its payslip.
 */
const YtdStatement: React.FC<{ employeeId: string; fy: string; onOpenPayslip?: (month: string) => void }> = ({ employeeId, fy, onOpenPayslip }) => {
  const [data, setData] = useState<YtdStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ EMPLOYER: true });

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get<YtdStatementData>(`${API}/${employeeId}`, { params: fy ? { fy } : {} })
      .then((res) => setData(res.data && Array.isArray(res.data.months) ? res.data : null))
      .catch((err) => {
        setData(null);
        setError(apiError(err, "The YTD statement could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [employeeId, fy]);

  const download = async () => {
    try {
      const res = await axios.get<Blob>(`${API}/${employeeId}/export`, { params: fy ? { fy } : {}, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ytd-statement-${data?.financialYear ?? fy}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(apiError(err, "The YTD statement could not be downloaded"));
    }
  };

  // Paid months get full columns; the months not paid yet after the last paid one fold into one grey column
  const { shown, later } = useMemo(() => {
    const months = data?.months ?? [];
    let last = -1;
    months.forEach((m, i) => { if (m.status !== "NOT_PAID") last = i; });
    return { shown: months.slice(0, last + 1), later: months.slice(last + 1) };
  }, [data]);

  if (loading && !data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>;
  if (!data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{error ?? t("The YTD statement could not be loaded.")}</div>;

  const cell = (line: Line, m: StatementMonth) => {
    const v = line.months?.[m.month];
    if (!paidLike(m.status)) return <span className="text-slate-300 dark:text-gray-600">—</span>;
    return v == null ? <span className="text-slate-300 dark:text-gray-600">—</span> : money(v);
  };
  const laterLabel = later.length === 0 ? null
    : later.length === 1 ? monthLabel(later[0].month, true)
    : `${monthLabel(later[0].month, true).split(" ")[0]}–${monthLabel(later[later.length - 1].month, true).split(" ")[0]}`;
  const colCount = 2 + shown.length + (laterLabel ? 1 : 0);
  const th = "px-2 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap";
  const td = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";
  const sticky = "sticky left-0 z-10 bg-inherit";

  const lineRow = (line: Line, kind: "line" | "total" | "net") => (
    <tr key={`${kind}-${line.name}`}
      className={kind === "net" ? "bg-cyan-50 font-semibold text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200"
        : kind === "total" ? "bg-white font-semibold text-slate-900 dark:bg-[#191919] dark:text-white"
        : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-[#191919] dark:text-gray-300 dark:hover:bg-[#222]"}>
      <td className={`${sticky} px-3 py-1.5 text-left ${kind !== "line" ? "border-t border-slate-200 dark:border-gray-700" : "pl-6"}`}>{line.name}</td>
      <td className={`${td} font-semibold ${kind !== "line" ? "border-t border-slate-200 dark:border-gray-700" : ""}`}>{money(line.total)}</td>
      {shown.map((m) => <td key={m.month} className={`${td} ${kind !== "line" ? "border-t border-slate-200 dark:border-gray-700" : ""}`}>{cell(line, m)}</td>)}
      {laterLabel && <td className={`${td} text-slate-300 dark:text-gray-600 ${kind !== "line" ? "border-t border-slate-200 dark:border-gray-700" : ""}`}>—</td>}
    </tr>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label={t("Earned this year")} value={money(data.earned)} note={`${data.monthsPaid} ${t("of 12 months paid")}`} />
        <Metric label={t("Deductions")} value={money(data.deductions)} />
        <Metric label={t("Take-home")} value={money(data.takeHome)} />
        <Metric label={t("Employer contributions")} value={money(data.employerContributions)} note={t("In the CTC, not paid out")} />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className={CARD_TITLE}>{t("YTD statement")} · FY {data.financialYear}</div>
          <button type="button" className={TOOL_BUTTON} onClick={download}>
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />{t("Download Excel")}
          </button>
        </div>
        {data.monthsPaid === 0 && shown.length === 0 ? (
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
                      {paidLike(m.status) && onOpenPayslip ? (
                        <button type="button" className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300" onClick={() => onOpenPayslip(m.month)}
                          title={t("Open the payslip")}>{monthLabel(m.month, true)}</button>
                      ) : monthLabel(m.month, true)}
                      <div className="mt-0.5 flex justify-end gap-1 text-[10px] font-medium">
                        {m.status === "OLD_SYSTEM" && <span className="rounded bg-slate-100 px-1 text-slate-600 dark:bg-gray-800 dark:text-gray-300">{t("Old system")}</span>}
                        {m.status === "AWAITING_APPROVAL" && <span className="rounded bg-amber-50 px-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{t("Awaiting approval")}</span>}
                        {m.lossOfPayDays > 0 && <span className="rounded bg-red-50 px-1 text-red-700 dark:bg-red-950/40 dark:text-red-300">LOP {m.lossOfPayDays}</span>}
                        {m.oneOff && <span className="rounded bg-violet-50 px-1 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{t("Bonus")}</span>}
                      </div>
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
                          {t(g.title)}{g.key === "EMPLOYER" && <span className="normal-case tracking-normal font-normal"> · {t("in the CTC, not paid out")}</span>}
                        </button>
                      </td>
                    </tr>
                    {!collapsed[g.key] && g.lines.map((l) => lineRow(l, "line"))}
                    {lineRow(g.total, "total")}
                  </React.Fragment>
                ))}
                {lineRow(data.netPay, "net")}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {t("From processed payslips, months brought in from the old system included; a run waiting for approval shows once approved.")}
          {onOpenPayslip && ` ${t("Click a month to open its payslip.")}`}
        </div>
      </div>
    </div>
  );
};

export default YtdStatement;
