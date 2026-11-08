import React, { useEffect, useState } from "react";
import axios from "axios";
import { CalendarCheck2, Gift, RefreshCw } from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError, ATTENDANCE_API, formatDays, leaveTypeLabel } from "./attendanceApi";
import { t } from "../../i18n/i18n";

const API = `${ATTENDANCE_API}/leave-lifecycle`;

interface EmployeeOption { id: number; name: string; code: string }

interface CompOffGrant {
  id: number; employeeId: number; workedDate: string; days: number; expiresOn?: string | null;
  status: "GRANTED" | "LAPSED"; lapsedDays?: number | null; reason?: string | null; grantedBy?: string | null;
}

interface YearEndLine { employeeId: number; employeeCode: string; employeeName: string; leaveType: string; leftOver: number; carriedForward: number; encashable: number; lapsed: number }
interface YearEndSkip { employeeId: number; employeeCode: string; employeeName: string; leaveType: string; reason: string }
interface YearEndResult { fromYear: number; closedBalances: number; carriedForward: number; encashable: number; lapsed: number; lines: YearEndLine[]; skipped: YearEndSkip[] }

const showDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-transparent dark:bg-[#191919]";
const input = "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const primary = "inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50";

/**
 * Attendance → Leave Year: compensatory off for weekly offs / holidays worked, running the monthly accrual now
 * (it also runs every night), and the year-end close (carry forward, encashment, lapse).
 */
const LeaveYearPage: React.FC = () => {
  const { canApprove } = usePermissions("ATTENDANCE");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [grant, setGrant] = useState({ employeeId: "", workedDate: "", days: "1", reason: "" });
  const [grants, setGrants] = useState<CompOffGrant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0));
  const [closed, setClosed] = useState<YearEndResult | null>(null);

  useEffect(() => {
    axios.get(`${ATTENDANCE_API}/employees`)
      .then((res) => setEmployees(Array.isArray(res.data) ? res.data.map((e: { id: number; name?: string; employeeCode?: string }) =>
        ({ id: Number(e.id), name: e.name || `Employee #${e.id}`, code: e.employeeCode || "" })) : []))
      .catch((err) => ToasterService.error(apiError(err, "Could not load the employee list.")));
  }, []);

  const loadGrants = async (employeeId: string) => {
    if (!employeeId) return setGrants([]);
    try {
      const res = await axios.get<CompOffGrant[]>(`${API}/comp-offs/employee/${employeeId}`);
      setGrants(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the compensatory offs."));
    }
  };

  const grantCompOff = async () => {
    if (!grant.employeeId || !grant.workedDate) return ToasterService.warning("Choose the employee and the day they worked");
    setBusy("grant");
    try {
      await axios.post(`${API}/comp-offs`, { employeeId: Number(grant.employeeId), workedDate: grant.workedDate, days: Number(grant.days), reason: grant.reason.trim() || null });
      ToasterService.success("Compensatory off granted");
      setGrant((p) => ({ ...p, workedDate: "", reason: "" }));
      await loadGrants(grant.employeeId);
    } catch (err) {
      ToasterService.error(apiError(err, "The compensatory off was not granted."));
    } finally {
      setBusy(null);
    }
  };

  const accrueNow = async () => {
    setBusy("accrue");
    try {
      const res = await axios.post(`${API}/accrue`);
      ToasterService.success("Accrual run", `${formatDays(res.data?.daysCredited)} day(s) credited to ${res.data?.balancesCredited ?? 0} balance(s); ${res.data?.compOffsLapsed ?? 0} compensatory off(s) lapsed`);
    } catch (err) {
      ToasterService.error(apiError(err, "The accrual could not run."));
    } finally {
      setBusy(null);
    }
  };

  const closeYear = async () => {
    if (!window.confirm(`Close the ${year} leave year? Days left over are carried forward to ${year + 1} (up to each policy's limit), marked for encashment where allowed, or lapse. This can't be undone.`)) return;
    setBusy("close");
    try {
      const res = await axios.post<YearEndResult>(`${API}/year-end`, null, { params: { year } });
      setClosed(res.data);
      ToasterService.success(`${year} closed`, `${res.data.closedBalances} balance(s) closed, ${res.data.skipped.length} left open`);
    } catch (err) {
      ToasterService.error(apiError(err, "The year could not be closed."));
    } finally {
      setBusy(null);
    }
  };

  if (!canApprove) {
    return <div className="px-0 py-8 text-sm text-slate-500">{t("You need attendance approve permission for the leave year jobs.")}</div>;
  }

  return (
    <>
      <PageMeta title={t("Leave Year")} description="Compensatory off, accrual and the year-end close" />
      <PageBreadcrumb pageTitle="Leave Year" />
      <div className="grid w-full grid-cols-1 gap-4 px-0 py-8 lg:grid-cols-2">
        <div className={card}>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Gift className="h-4 w-4 text-cyan-600" /> {t("Grant compensatory off")}</h3>
          <p className="mb-3 text-xs text-slate-500">{t("For a weekly off or holiday the employee worked (there must be attendance that day). It lapses after the policy's days if not taken.")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select className={input} value={grant.employeeId} onChange={(e) => { setGrant((p) => ({ ...p, employeeId: e.target.value })); loadGrants(e.target.value); }}>
              <option value="">{t("Employee")}</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.code ? ` (${e.code})` : ""}</option>)}
            </select>
            <input type="date" className={input} value={grant.workedDate} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setGrant((p) => ({ ...p, workedDate: e.target.value }))} />
            <select className={input} value={grant.days} onChange={(e) => setGrant((p) => ({ ...p, days: e.target.value }))}>
              <option value="1">{t("Full day")}</option>
              <option value="0.5">{t("Half day")}</option>
            </select>
            <input className={input} placeholder={t("Reason (e.g. release support)")} maxLength={500} value={grant.reason}
              onChange={(e) => setGrant((p) => ({ ...p, reason: e.target.value }))} />
          </div>
          <div className="mt-3 flex justify-end">
            <button type="button" className={primary} disabled={busy === "grant"} onClick={grantCompOff}>{t(busy === "grant" ? "Granting..." : "Grant")}</button>
          </div>
          {grants.length > 0 && (
            <table className="mt-3 w-full text-xs">
              <thead className="text-left text-[10px] uppercase text-slate-500">
                <tr><th className="py-1">{t("Worked on")}</th><th>{t("Days")}</th><th>{t("Lapses on")}</th><th>{t("Status")}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                {grants.map((g) => (
                  <tr key={g.id}>
                    <td className="py-1">{showDate(g.workedDate)}</td>
                    <td>{formatDays(g.days)}</td>
                    <td>{showDate(g.expiresOn)}</td>
                    <td className={g.status === "LAPSED" ? "text-rose-600" : "text-emerald-600"}>
                      {g.status === "LAPSED" ? `${t("Lapsed")} ${formatDays(g.lapsedDays)}` : t("Granted")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className={card}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><RefreshCw className="h-4 w-4 text-cyan-600" /> {t("Monthly / quarterly accrual")}</h3>
            <p className="mb-3 text-xs text-slate-500">{t("Runs every night: credits the leave of months that have started and lapses expired compensatory offs. Run it now after changing policies.")}</p>
            <button type="button" className={primary} disabled={busy === "accrue"} onClick={accrueNow}>{t(busy === "accrue" ? "Running..." : "Run accrual now")}</button>
          </div>

          <div className={card}>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><CalendarCheck2 className="h-4 w-4 text-cyan-600" /> {t("Year-end close")}</h3>
            <p className="mb-3 text-xs text-slate-500">{t("Assign next year's leave policy first. Days left over are carried forward up to each policy's limit; the rest is marked for encashment where allowed, or lapses. Employees with pending requests or no next-year policy stay open.")}</p>
            <div className="flex items-center gap-2">
              <input type="number" className={`${input} w-28`} value={year} min={2000} max={2100} onChange={(e) => setYear(Number(e.target.value))} />
              <button type="button" className={primary} disabled={busy === "close"} onClick={closeYear}>{t(busy === "close" ? "Closing..." : "Close year")}</button>
            </div>
          </div>
        </div>

        {closed && (
          <div className={`${card} lg:col-span-2`}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              {closed.fromYear}: {closed.closedBalances} {t("closed")} · {formatDays(closed.carriedForward)} {t("carried forward")} · {formatDays(closed.encashable)} {t("for encashment")} · {formatDays(closed.lapsed)} {t("lapsed")}
            </h3>
            {closed.skipped.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <p className="mb-1 font-semibold">{t("Left open")}</p>
                {closed.skipped.map((s, i) => <p key={i}>{s.employeeName} ({s.employeeCode}), {leaveTypeLabel(s.leaveType)}: {s.reason}</p>)}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-[10px] uppercase text-slate-500">
                  <tr><th className="py-1">{t("Employee")}</th><th>{t("Leave type")}</th><th>{t("Left over")}</th><th>{t("Carried forward")}</th><th>{t("For encashment")}</th><th>{t("Lapsed")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                  {closed.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-1">{l.employeeName} <span className="text-slate-400">{l.employeeCode}</span></td>
                      <td>{leaveTypeLabel(l.leaveType)}</td>
                      <td>{formatDays(l.leftOver)}</td>
                      <td>{formatDays(l.carriedForward)}</td>
                      <td>{formatDays(l.encashable)}</td>
                      <td>{formatDays(l.lapsed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LeaveYearPage;
