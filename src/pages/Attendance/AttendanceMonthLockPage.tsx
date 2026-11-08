import React, { useEffect, useState } from "react";
import axios from "axios";
import { Lock, LockOpen, RefreshCw } from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError, ATTENDANCE_API } from "./attendanceApi";
import { t } from "../../i18n/i18n";

const API = `${ATTENDANCE_API}/month-locks`;

interface Readiness {
  month: string; locked: boolean; earliestLock: string; openDays: number; pendingLeave: number;
  pendingRegularizations: number; pendingOnDuty: number; problems: string[];
}

interface LockView {
  month: string; status: "LOCKED" | "UNLOCKED"; recordsLocked?: number | null; lockedBy?: string | null; lockedAt?: string | null;
  unlockedBy?: string | null; unlockedAt?: string | null; unlockReason?: string | null;
}

const card = "rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-transparent dark:bg-[#191919]";
const when = (iso?: string | null) => (iso ? iso.replace("T", " ").slice(0, 16) : "—");
const lastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Attendance → Month Close: lock a month once it is over (after its last night shift), every day is closed and
 * nothing waits for approval. A locked month takes no punches, regularizations, on-duty or leave changes.
 */
const AttendanceMonthLockPage: React.FC = () => {
  const { canApprove } = usePermissions("ATTENDANCE");
  const [month, setMonth] = useState(lastMonth());
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [locks, setLocks] = useState<LockView[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async (m = month) => {
    try {
      const [r, l] = await Promise.all([axios.get<Readiness>(`${API}/${m}/readiness`), axios.get<LockView[]>(API)]);
      setReadiness(r.data);
      setLocks(Array.isArray(l.data) ? l.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the month's status."));
    }
  };

  useEffect(() => { if (canApprove) load(month); }, [month, canApprove]);

  const lock = async () => {
    if (!window.confirm(`Lock attendance for ${month}? Punches, regularizations, on-duty and leave for its days are refused until it is unlocked.`)) return;
    setBusy(true);
    try {
      const { data } = await axios.post<LockView>(`${API}/${month}/lock`);
      ToasterService.success(`${month} locked`, `${data.recordsLocked ?? 0} day record(s) locked`);
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "The month was not locked."));
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (m: string) => {
    const reason = window.prompt(`Unlock ${m}? Why?`);
    if (!reason || !reason.trim()) return;
    setBusy(true);
    try {
      await axios.post(`${API}/${m}/unlock`, null, { params: { reason: reason.trim() } });
      ToasterService.success(`${m} unlocked`);
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "The month was not unlocked."));
    } finally {
      setBusy(false);
    }
  };

  if (!canApprove) {
    return <div className="px-0 py-8 text-sm text-slate-500">{t("You need attendance approve permission to close months.")}</div>;
  }

  return (
    <>
      <PageMeta title={t("Month Close")} description="Lock an attendance month once it is reviewed" />
      <PageBreadcrumb pageTitle="Month Close" />
      <div className="grid w-full grid-cols-1 gap-4 px-0 py-8 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("Lock a month")}</h3>
            <div className="flex items-center gap-2">
              <input type="month" className="h-8 rounded-lg border border-slate-300 px-2 text-xs dark:border-gray-700 dark:bg-[#222222] dark:text-white"
                value={month} onChange={(e) => setMonth(e.target.value)} />
              <button type="button" onClick={() => load()} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label={t("Refresh")}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {readiness && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {([
                  ["Open days", readiness.openDays],
                  ["Leave waiting", readiness.pendingLeave],
                  ["Regularizations waiting", readiness.pendingRegularizations],
                  ["On-duty / WFH waiting", readiness.pendingOnDuty],
                ] as const).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-[#2a2a2a] dark:bg-[#222222]">
                    <span className="block text-[10px] font-semibold uppercase text-slate-500">{t(k)}</span>
                    <span className={`text-sm font-semibold ${v > 0 ? "text-amber-600" : "text-slate-900 dark:text-white"}`}>{v}</span>
                  </div>
                ))}
              </div>
              {readiness.problems.length > 0 ? (
                <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                  {readiness.problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-emerald-700">{t("Ready to lock: every day is closed and nothing waits for approval.")}</p>
              )}
              <div className="mt-3 flex justify-end">
                <button type="button" disabled={busy || readiness.problems.length > 0} onClick={lock}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                  <Lock className="h-4 w-4" /> {t("Lock")} {month}
                </button>
              </div>
            </>
          )}
        </div>

        <div className={card}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{t("Closed months")}</h3>
          {locks.length === 0 ? (
            <p className="text-xs text-slate-400">{t("No month has been locked yet.")}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-[10px] uppercase text-slate-500">
                <tr><th className="py-1">{t("Month")}</th><th>{t("Status")}</th><th>{t("By / when")}</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                {locks.map((l) => (
                  <tr key={l.month}>
                    <td className="py-1.5 font-semibold">{l.month}</td>
                    <td className={l.status === "LOCKED" ? "text-emerald-600" : "text-slate-500"}>
                      {t(l.status === "LOCKED" ? "Locked" : "Unlocked")}
                      {l.unlockReason && l.status === "UNLOCKED" && <span className="block text-[10px] text-slate-500">{l.unlockReason}</span>}
                    </td>
                    <td>{l.status === "LOCKED" ? `${l.lockedBy || "—"} · ${when(l.lockedAt)}` : `${l.unlockedBy || "—"} · ${when(l.unlockedAt)}`}</td>
                    <td className="text-right">
                      {l.status === "LOCKED" && (
                        <button type="button" disabled={busy} onClick={() => unlock(l.month)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
                          <LockOpen className="h-3 w-3" /> {t("Unlock")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default AttendanceMonthLockPage;
