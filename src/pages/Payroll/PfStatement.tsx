import React, { useEffect, useState } from "react";
import axios from "axios";
import { ArrowDownTrayIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";
import { CARD, CARD_TITLE, TOOL_BUTTON } from "./hrmsUi";
import { money, monthLabel } from "./taxTracker";

type MonthStatus = "PAID" | "OLD_SYSTEM" | "AWAITING_APPROVAL" | "NOT_PAID";

interface PfMonth {
  month: string;
  status: MonthStatus;
  pfWage?: number | null;
  employee?: number | null;
  employerEpf?: number | null;
  pension?: number | null;
  total?: number | null;
  pensionWorkedOut: boolean;
}

interface PfStatementData {
  employee: { employeeName: string; uan?: string | null; pfNumber?: string | null; joiningDate?: string | null };
  financialYear: string;
  financialYears: string[];
  months: PfMonth[];
  pfWage: number;
  employeePf: number;
  employerEpf: number;
  pension: number;
  total: number;
  monthsWithPf: number;
}

const API = "/v1/api/payroll/statements/pf";
// Your share, the employer's EPF, the pension: the same three colours on the bars and in the table
export const PF_COLORS = { employee: "#2563eb", epf: "#0d9488", pension: "#f59e0b" };

const Metric: React.FC<{ label: string; value: string; note?: React.ReactNode; dot?: string }> = ({ label, value, note, dot }) => (
  <div className={`${CARD} p-3`}>
    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden="true" />}{label}
    </div>
    <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
    {note && <div className="text-[11px] text-slate-500 dark:text-gray-400">{note}</div>}
  </div>
);

/** A stacked bar per month: your share, employer EPF, pension; the highest month fills the height. */
export const PfBars: React.FC<{ months: { month: string; employee?: number | null; employerEpf?: number | null; pension?: number | null }[] }> = ({ months }) => {
  const max = Math.max(1, ...months.map((m) => (m.employee ?? 0) + (m.employerEpf ?? 0) + (m.pension ?? 0)));
  return (
    <div className="flex h-36 items-end gap-2 px-1" role="img" aria-label={t("PF by month")}>
      {months.map((m) => {
        const parts = [
          { v: m.employee ?? 0, c: PF_COLORS.employee },
          { v: m.employerEpf ?? 0, c: PF_COLORS.epf },
          { v: m.pension ?? 0, c: PF_COLORS.pension },
        ];
        const total = parts.reduce((s, p) => s + p.v, 0);
        return (
          <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${monthLabel(m.month)}: ${money(total)}`}>
            <div className="flex w-full max-w-[28px] flex-col-reverse overflow-hidden rounded-sm" style={{ height: `${(total / max) * 112}px` }}>
              {parts.map((p, i) => <div key={i} style={{ height: total ? `${(p.v / total) * 100}%` : 0, background: p.c }} />)}
            </div>
            <span className={`text-[10px] ${total ? "text-slate-500 dark:text-gray-400" : "text-slate-300 dark:text-gray-600"}`}>{monthLabel(m.month, true).split(" ")[0]}</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * The PF statement (docs/PAYROLL-STATEMENTS.md §3.2): what went to the provident fund each wage month (March to
 * February, as on the EPFO passbook) — the employee's 12%, and the employer's 12% split into EPF and pension.
 */
const PfStatement: React.FC<{ employeeId: string; fy: string }> = ({ employeeId, fy }) => {
  const [data, setData] = useState<PfStatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get<PfStatementData>(`${API}/${employeeId}`, { params: fy ? { fy } : {} })
      .then((res) => setData(res.data && Array.isArray(res.data.months) ? res.data : null))
      .catch((err) => {
        setData(null);
        setError(apiError(err, "The PF statement could not be loaded"));
      })
      .finally(() => setLoading(false));
  }, [employeeId, fy]);

  const download = async () => {
    try {
      const res = await axios.get<Blob>(`${API}/${employeeId}/export`, { params: fy ? { fy } : {}, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pf-statement-${data?.financialYear ?? fy}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(apiError(err, "The PF statement could not be downloaded"));
    }
  };

  if (loading && !data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Loading…")}</div>;
  if (!data) return <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{error ?? t("The PF statement could not be loaded.")}</div>;

  const paid = data.months.filter((m) => m.total != null);
  const first = data.months[0]?.month;
  const last = data.months[data.months.length - 1]?.month;
  const anyWorkedOut = paid.some((m) => m.pensionWorkedOut);
  const td = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
  const th = "px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className={`${CARD} flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-xs text-slate-600 dark:text-gray-300`}>
        <span><span className="text-slate-400">UAN</span> <span className="font-mono">{data.employee.uan ?? t("not recorded")}</span></span>
        <span><span className="text-slate-400">{t("PF number")}</span> <span className="font-mono">{data.employee.pfNumber ?? t("not recorded")}</span></span>
        <span className="text-slate-400">{t("Wage months")} {first ? monthLabel(first) : ""} – {last ? monthLabel(last) : ""}</span>
        <button type="button" className="ml-auto inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300" onClick={() => setReveal((r) => !r)}
          aria-pressed={reveal} title={t("The PF wage is the pay PF is worked out on (the basic, capped where the company chose the cap)")}>
          {reveal ? <EyeSlashIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}{reveal ? t("Hide PF wage") : t("Show PF wage")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label={t("Your PF")} value={money(data.employeePf)} dot={PF_COLORS.employee} note={t("12% of your PF wage")} />
        <Metric label={t("Employer EPF")} value={money(data.employerEpf)} dot={PF_COLORS.epf} />
        <Metric label={t("Pension (EPS)")} value={money(data.pension)} dot={PF_COLORS.pension} note={t("8.33% of up to ₹15,000")} />
        <Metric label={t("Total this year")} value={money(data.total)} note={`${data.monthsWithPf} ${t(data.monthsWithPf === 1 ? "month" : "months")}`} />
      </div>

      <div className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
          <div className={CARD_TITLE}>{t("PF statement")} · {data.financialYear}</div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-3 text-[11px] text-slate-500 sm:inline-flex dark:text-gray-400">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: PF_COLORS.employee }} />{t("Your share")}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: PF_COLORS.epf }} />{t("Employer EPF")}</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: PF_COLORS.pension }} />{t("Pension")}</span>
            </span>
            <button type="button" className={TOOL_BUTTON} onClick={download}><ArrowDownTrayIcon className="h-3.5 w-3.5" />{t("Download Excel")}</button>
          </div>
        </div>
        {paid.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">{t("No PF in this year yet.")}</div>
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 pt-4 pb-2 dark:border-gray-800"><PfBars months={data.months} /></div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 dark:bg-[#222]">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-gray-400 whitespace-nowrap">{t("Wage month")}</th>
                    {reveal && <th className={th}>{t("PF wage")}</th>}
                    <th className={th}>{t("Your PF")}</th>
                    <th className={th}>{t("Employer EPF")}</th>
                    <th className={th}>{t("Pension")}</th>
                    <th className={th}>{t("Total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {data.months.filter((m) => m.status !== "NOT_PAID").map((m) => (
                    <tr key={m.month} className="text-slate-700 dark:text-gray-300">
                      <td className="px-3 py-2 text-left">
                        <span className="font-medium text-slate-900 dark:text-white">{monthLabel(m.month)}</span>
                        {m.status === "OLD_SYSTEM" && <span className="ml-1.5 rounded bg-slate-100 px-1 text-[10px] text-slate-600 dark:bg-gray-800 dark:text-gray-300">{t("Old system")}</span>}
                        {m.status === "AWAITING_APPROVAL" && <span className="ml-1.5 rounded bg-amber-50 px-1 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{t("Awaiting approval")}</span>}
                        {m.pensionWorkedOut && <span className="ml-1 text-amber-600" title={t("Pension and EPF worked out from the employer's total")}>*</span>}
                      </td>
                      {reveal && <td className={td}>{m.pfWage == null ? "—" : money(m.pfWage)}</td>}
                      <td className={td}>{m.employee == null ? "—" : money(m.employee)}</td>
                      <td className={td}>{m.employerEpf == null ? "—" : money(m.employerEpf)}</td>
                      <td className={td}>{m.pension == null ? "—" : money(m.pension)}</td>
                      <td className={`${td} font-semibold text-slate-900 dark:text-white`}>{m.total == null ? "—" : money(m.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 font-semibold text-slate-900 dark:border-gray-700 dark:text-white">
                    <td className="px-3 py-2 text-left">{t("Total")}</td>
                    {reveal && <td className={td}>{money(data.pfWage)}</td>}
                    <td className={td}>{money(data.employeePf)}</td>
                    <td className={td}>{money(data.employerEpf)}</td>
                    <td className={td}>{money(data.pension)}</td>
                    <td className={`${td} text-cyan-700 dark:text-cyan-300`}>{money(data.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {t("The PF year runs March to February in wage months (the March salary is paid in April), as on the EPFO passbook.")}
          {anyWorkedOut && ` * ${t("Pension and EPF worked out from the employer's total for that month.")}`}
          {` ${t("Your PF balance and interest are on the EPFO member passbook.")}`}
        </div>
      </div>
    </div>
  );
};

export default PfStatement;
