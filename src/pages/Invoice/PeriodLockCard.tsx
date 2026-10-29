import { useEffect, useState } from "react";
import axios from "axios";
import { LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { formatDateTime } from "../../company/format";
import { INVOICE_API, apiError, dateLabel, todayInput } from "./invoiceShared";
import { CARD, CARD_TITLE } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
interface LockChange {
  lockDate?: string | null;
  previousLockDate?: string | null;
  changedBy?: string | null;
  changedAt?: string | null;
  reason?: string | null;
}

interface PeriodLock {
  lockDate?: string | null;
  changedBy?: string | null;
  changedAt?: string | null;
  history: LockChange[];
}

const API = `${INVOICE_API}/accounting/period-lock`;
const INPUT =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

const yesterday = () => {
  const d = new Date(`${todayInput()}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The lock date: once a month or year is closed, nothing dated on or before it can be posted, changed or removed.
 * Finance administrators move it; opening a closed period again needs a reason, kept in the history.
 */
export default function PeriodLockCard({ editable }: { editable: boolean }) {
  const [lock, setLock] = useState<PeriodLock | null>(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get<PeriodLock>(API).then(
      (res) => {
        setLock(res.data);
        setDate(res.data.lockDate ?? "");
      },
      (err) => ToasterService.error(apiError(err, "Could not load the lock date")),
    );
  }, []);

  const current = lock?.lockDate ?? null;
  // An earlier date (or none) opens a closed period again
  const reopening = !!current && (!date || date < current);

  const save = async (next: string | null) => {
    if (current && (!next || next < current) && !reason.trim()) {
      return ToasterService.error("Say why the closed period is being opened again");
    }
    setSaving(true);
    try {
      const { data } = await axios.put<PeriodLock>(API, { lockDate: next, reason: reason.trim() || null });
      setLock(data);
      setDate(data.lockDate ?? "");
      setReason("");
      ToasterService.success(data.lockDate ? `Books locked up to ${dateLabel(data.lockDate)}` : "All periods are open");
    } catch (err) {
      ToasterService.error(apiError(err, "Could not change the lock date"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${CARD} p-5`}>
      <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
        {current ? <LockClosedIcon className="h-4 w-4 text-amber-600" /> : <LockOpenIcon className="h-4 w-4 text-cyan-600" />} Lock the books
      </h3>
      <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
        {current ? (
          <>Locked up to <b>{dateLabel(current)}</b>: nothing dated on or before it can be posted, changed, cancelled or deleted. </>
        ) : (
          <>No period is locked. </>
        )}
        Lock a month once its VAT return is filed or its accounts are closed; corrections then go in an open period.
        {!editable && " Only a finance administrator can move the date."}
      </p>
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-500">
            {t("Lock up to")}
            <input type="date" className={`${INPUT} mt-1 block`} value={date} max={yesterday()} onChange={(e) => setDate(e.target.value)} />
          </label>
          {reopening && (
            <label className="min-w-[240px] flex-1 text-xs text-slate-500">
              {t("Why open the period again?")}
              <input className={`${INPUT} mt-1 block w-full`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
                placeholder={t("e.g. correcting a bill entered in the wrong month")} />
            </label>
          )}
          <button type="button" disabled={saving || !date || date === current}
            onClick={() => void save(date)}
            className="h-[38px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            {t(saving ? "Saving..." : "Save lock date")}
          </button>
          {current && (
            <button type="button" disabled={saving} onClick={() => { setDate(""); void save(null); }}
              className="h-[38px] rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {t("Open all periods")}
            </button>
          )}
        </div>
      )}
      {lock && lock.history.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {lock.history.map((change, index) => (
            <li key={index}>
              {formatDateTime(change.changedAt)} · {change.changedBy ?? "—"}:{" "}
              {change.previousLockDate ? dateLabel(change.previousLockDate) : "open"} → {change.lockDate ? dateLabel(change.lockDate) : "open"}
              {change.reason ? ` — ${change.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
