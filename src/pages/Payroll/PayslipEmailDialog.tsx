import React, { useEffect, useState } from "react";
import axios from "axios";
import { RefreshCw, X } from "lucide-react";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";

type PasswordFormat = "DOB" | "NAME_DOB" | "CODE_DOB" | "EMPLOYEE_CODE";

interface RunSettings {
  approvalRequired: boolean;
  varianceThresholdPercent: number;
  payslipPasswordProtected: boolean;
  payslipPasswordFormat: PasswordFormat;
  payslipAutoEmail: boolean;
}

interface EmailRow {
  id: number; employeeId: number; payrollMonth: string; sentTo?: string | null;
  status: "QUEUED" | "SENT" | "FAILED" | "SKIPPED"; failure?: string | null; passwordProtected?: boolean | null;
  requestedBy?: string | null; requestedAt?: string | null; sentAt?: string | null;
}

const FORMATS: Record<PasswordFormat, string> = {
  DOB: "Date of birth (DDMMYYYY), e.g. 15081990",
  NAME_DOB: "First 4 letters of first name + DDMM, e.g. PRIY1508",
  CODE_DOB: "Employee code + DDMMYYYY, e.g. EMP001215081990",
  EMPLOYEE_CODE: "Employee code, e.g. EMP0012",
};

const STATUS_STYLE: Record<EmailRow["status"], string> = {
  QUEUED: "text-slate-500",
  SENT: "text-emerald-600",
  FAILED: "text-rose-600",
  SKIPPED: "text-amber-600",
};

/** Payslips → Email: how emailed payslips are protected, sending a month's payslips, and what happened to each. */
const PayslipEmailDialog: React.FC<{ month: string; names: Record<number, string>; onClose: () => void }> = ({ month, names, onClose }) => {
  const [settings, setSettings] = useState<RunSettings | null>(null);
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [busy, setBusy] = useState(false);
  // Employees ticked for "Email selected"
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const loadLog = async () => {
    try {
      const res = await axios.get<EmailRow[]>(`/v1/api/payroll/payslips/email-log`, { params: { month } });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "The email log could not be loaded"));
    }
  };

  useEffect(() => {
    axios.get<RunSettings>(`/v1/api/payroll/run-settings`).then((res) => setSettings(res.data)).catch(() => setSettings(null));
    loadLog();
  }, [month]);

  const save = async (change: Partial<RunSettings>) => {
    try {
      const res = await axios.put<RunSettings>(`/v1/api/payroll/run-settings`, change);
      setSettings(res.data);
      ToasterService.success("Payslip email settings saved");
    } catch (err) {
      ToasterService.error(apiError(err, "The settings were not saved"));
    }
  };

  const send = async (employeeIds?: number[]) => {
    const who = employeeIds ? `${employeeIds.length} employee(s)` : "everyone with a payslip";
    if (!window.confirm(`Email the ${month} payslips to ${who}?`)) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ month });
      (employeeIds || []).forEach((id) => params.append("employeeIds", String(id)));
      const { data } = await axios.post(`/v1/api/payroll/payslips/email?${params.toString()}`);
      ToasterService.success(`${data.queued} payslip email(s) on their way`, data.skipped ? `${data.skipped} without a payslip were skipped` : undefined);
      if (employeeIds) setSelected(new Set());
      setTimeout(loadLog, 1500);
    } catch (err) {
      ToasterService.error(apiError(err, "The payslips were not emailed"));
    } finally {
      setBusy(false);
    }
  };

  // The latest attempt per employee
  const latest = Object.values(rows.reduce<Record<number, EmailRow>>((acc, r) => {
    if (!acc[r.employeeId] || acc[r.employeeId].id < r.id) acc[r.employeeId] = r;
    return acc;
  }, {}));
  const failed = latest.filter((r) => r.status === "FAILED").map((r) => r.employeeId);
  const count = (s: EmailRow["status"]) => latest.filter((r) => r.status === s).length;

  // Everyone paid in the month (from the page), with their latest email attempt if any
  const lastByEmployee = Object.fromEntries(latest.map((r) => [r.employeeId, r]));
  const people = Object.entries(names)
    .map(([id, name]) => ({ id: Number(id), name, last: lastByEmployee[Number(id)] as EmailRow | undefined }))
    .concat(latest.filter((r) => !(r.employeeId in names)).map((r) => ({ id: r.employeeId, name: `#${r.employeeId}`, last: r })))
    .filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const allShownSelected = people.length > 0 && people.every((p) => selected.has(p.id));
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllShown = () => setSelected((prev) => {
    const next = new Set(prev);
    people.forEach((p) => (allShownSelected ? next.delete(p.id) : next.add(p.id)));
    return next;
  });

  return (
    <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div data-overlay-panel className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#191919]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("Email payslips")} · {month}</h3>
            <p className="text-xs text-gray-500">{t("Sent to each employee's official email (else personal). Only payslips of approved runs are made.")}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}><X size={18} /></button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-xs">
          {settings && (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-[#2a2a2a]">
              <label className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={settings.payslipPasswordProtected} onChange={(e) => save({ payslipPasswordProtected: e.target.checked })} />
                {t("Password-protect emailed payslips")}
              </label>
              {settings.payslipPasswordProtected && (
                <select className="h-8 w-full rounded-lg border border-gray-300 px-2 dark:border-gray-700 dark:bg-[#222222] dark:text-white"
                  value={settings.payslipPasswordFormat} onChange={(e) => save({ payslipPasswordFormat: e.target.value as PasswordFormat })}>
                  {(Object.keys(FORMATS) as PasswordFormat[]).map((f) => <option key={f} value={f}>{t(FORMATS[f])}</option>)}
                </select>
              )}
              {settings.payslipPasswordProtected && (
                <p className="text-[11px] text-gray-500">{t("The email tells the employee how to form the password, never the password itself. Without a date of birth on record, it is the employee code.")}</p>
              )}
              <label className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={settings.payslipAutoEmail} onChange={(e) => save({ payslipAutoEmail: e.target.checked })} />
                {t("Email each run's payslips automatically once they are made")}
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-gray-600 dark:text-gray-300">
              <span className="text-emerald-600">{count("SENT")} {t("sent")}</span> · <span className="text-rose-600">{count("FAILED")} {t("failed")}</span> ·{" "}
              <span className="text-amber-600">{count("SKIPPED")} {t("skipped")}</span> · {count("QUEUED")} {t("waiting")}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={loadLog} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 dark:border-[#2a2a2a] dark:text-gray-300">
                <RefreshCw className="h-3.5 w-3.5" /> {t("Refresh")}
              </button>
              {failed.length > 0 && (
                <button type="button" disabled={busy} onClick={() => send(failed)} className="rounded-lg border border-rose-200 px-3 py-1.5 font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                  {t("Resend failed")} ({failed.length})
                </button>
              )}
              <button type="button" disabled={busy || selected.size === 0} onClick={() => send([...selected])}
                className="rounded-lg border border-cyan-300 px-3 py-1.5 font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50">
                {t("Email selected")} ({selected.size})
              </button>
              <button type="button" disabled={busy} onClick={() => send()} className="rounded-lg bg-cyan-600 px-3 py-1.5 font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
                {t(busy ? "Sending..." : "Email everyone")}
              </button>
            </div>
          </div>

          <input className="h-8 w-full rounded-lg border border-gray-300 px-2 dark:border-gray-700 dark:bg-[#222222] dark:text-white"
            placeholder={t("Search employee")} value={search} onChange={(e) => setSearch(e.target.value)} />

          <table className="w-full">
            <thead className="text-left text-[10px] uppercase text-gray-500">
              <tr>
                <th className="w-8 py-1">
                  <input type="checkbox" aria-label={t("Select all shown")} checked={allShownSelected} disabled={people.length === 0} onChange={toggleAllShown} />
                </th>
                <th>{t("Employee")}</th><th>{t("Sent to")}</th><th>{t("Status")}</th><th>{t("When")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
              {people.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-400">{t("No employees for this month")}</td></tr>}
              {people.map((p) => (
                <tr key={p.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-[#222222]" onClick={() => toggle(p.id)}>
                  <td className="py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`${t("Select")} ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                  <td>{p.name}</td>
                  <td>{p.last?.sentTo || "—"}{p.last?.passwordProtected ? ` · ${t("protected")}` : ""}</td>
                  <td className={p.last ? STATUS_STYLE[p.last.status] : "text-gray-400"}>
                    {!p.last ? t("Not emailed")
                      : t(p.last.status === "QUEUED" ? "Waiting" : p.last.status === "SENT" ? "Sent" : p.last.status === "FAILED" ? "Failed" : "Skipped")}
                    {p.last?.failure && <span className="block text-[10px] text-gray-500">{p.last.failure}</span>}
                  </td>
                  <td>{p.last ? (p.last.sentAt || p.last.requestedAt || "").replace("T", " ").slice(0, 16) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayslipEmailDialog;
