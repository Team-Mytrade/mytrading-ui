import { useEffect, useState } from "react";
import axios from "axios";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { CARD, CARD_TITLE } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";
interface AccountLine {
  accountId: number;
  accountCode: string;
  accountName: string;
  // On its natural side: income as credit, expenses as debit
  amount: number;
}

interface Preview {
  yearEnd: string;
  // The day after the previous close; none: from the start of the books
  from?: string | null;
  income: AccountLine[];
  totalIncome: number;
  expenses: AccountLine[];
  totalExpenses: number;
  netProfit: number;
  retainedEarningsAccount: string;
  closed: boolean;
  lockDate?: string | null;
}

interface ClosedYear {
  yearEnd: string;
  entryNumber: string;
  netProfit: number;
}

const API = `${INVOICE_API}/accounting/year-end-close`;
const INPUT =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

// 31 December of last year, the usual year end
const lastYearEnd = () => `${Number(todayInput().slice(0, 4)) - 1}-12-31`;

const yesterday = () => {
  const d = new Date(`${todayInput()}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Year-end close: the year's income and expenses move to retained earnings in one closing entry and the books are
 * locked up to the year end. The P&L still shows a closed year's result. Undoing reopens the year (with a reason).
 */
export default function YearEndCloseCard({ editable, onLockChanged }: { editable: boolean; onLockChanged: () => void }) {
  const [yearEnd, setYearEnd] = useState(lastYearEnd);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [closed, setClosed] = useState<ClosedYear[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [undoing, setUndoing] = useState<ClosedYear | null>(null);
  const [reason, setReason] = useState("");

  const loadClosed = () =>
    axios.get<ClosedYear[]>(API).then(
      (res) => setClosed(Array.isArray(res.data) ? res.data : []),
      (err) => ToasterService.error(apiError(err, "Could not load the closed years")),
    );

  const loadPreview = (on: string) => {
    if (!on) return setPreview(null);
    axios.get<Preview>(`${API}/preview`, { params: { yearEnd: on } }).then(
      (res) => setPreview(res.data),
      (err) => {
        setPreview(null);
        ToasterService.error(apiError(err, "Could not work out the year-end close"));
      },
    );
  };

  useEffect(() => {
    void loadClosed();
  }, []);

  useEffect(() => {
    loadPreview(yearEnd);
  }, [yearEnd]);

  const close = async () => {
    setConfirming(false);
    setBusy(true);
    try {
      const { data } = await axios.post<Preview>(API, { yearEnd });
      setPreview(data);
      ToasterService.success(`Year to ${dateLabel(yearEnd)} closed`, `Books locked up to ${dateLabel(yearEnd)}.`);
      void loadClosed();
      onLockChanged();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not close the year"));
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    const year = undoing;
    if (!year) return;
    if (!reason.trim()) return ToasterService.error("Say why the closed year is being opened again");
    setUndoing(null);
    setBusy(true);
    try {
      await axios.post(`${API}/${year.yearEnd}/undo`, { reason: reason.trim() });
      setReason("");
      ToasterService.success(`Year to ${dateLabel(year.yearEnd)} reopened`);
      void loadClosed();
      loadPreview(yearEnd);
      onLockChanged();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not reopen the year"));
    } finally {
      setBusy(false);
    }
  };

  const nothing = !!preview && preview.income.length === 0 && preview.expenses.length === 0;
  // Locked on or after the year end: closing (again) needs the year reopened first
  const lockedAlready = !!preview?.lockDate && preview.lockDate >= yearEnd;
  const loss = (preview?.netProfit ?? 0) < 0;

  const section = (title: string, lines: AccountLine[], total: number) => (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t(title)}</p>
      <ul className="divide-y divide-slate-100 text-xs dark:divide-gray-800">
        {lines.map((line) => (
          <li key={line.accountId} className="flex justify-between gap-3 py-1 text-slate-700 dark:text-gray-200">
            <span>{line.accountCode} · {line.accountName}</span>
            <span>{money(line.amount)}</span>
          </li>
        ))}
        <li className="flex justify-between gap-3 py-1 font-semibold text-slate-800 dark:text-gray-100">
          <span>{t("Total")}</span>
          <span>{money(total)}</span>
        </li>
      </ul>
    </div>
  );

  return (
    <section className={`${CARD} p-5`}>
      <h3 className={`${CARD_TITLE} mb-2 flex items-center gap-2`}>
        <CalendarDaysIcon className="h-4 w-4 text-cyan-600" /> {t("Year-end close")}
      </h3>
      <p className="mb-3 text-xs text-slate-600 dark:text-gray-300">
        {t("Closing a year moves its income and expenses to retained earnings in one entry dated the year end, and locks the books up to that date. The P&L still shows the closed year's result; the balance sheet shows it as retained earnings. Reopening a year needs a reason.")}
        {!editable && ` ${t("Only a finance administrator can close or reopen a year.")}`}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          {t("Last day of the year")}
          <input type="date" className={`${INPUT} mt-1 block`} value={yearEnd} max={yesterday()} onChange={(e) => setYearEnd(e.target.value)} />
        </label>
        {editable && (
          <button type="button" disabled={busy || !preview || lockedAlready || (nothing && !preview.closed)}
            onClick={() => setConfirming(true)}
            className="h-[38px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
            {t(busy ? "Closing..." : preview?.closed ? "Close again" : "Close the year")}
          </button>
        )}
        {preview?.closed && <span className="text-xs text-emerald-700">{t("This year is closed")}</span>}
      </div>

      {lockedAlready && !preview?.closed && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {t("The books are locked up to")} <b>{dateLabel(preview?.lockDate)}</b>
          {t(": move the lock date back before closing this year.")}
        </p>
      )}

      {preview && (nothing ? (
        <p className="mt-3 text-sm text-slate-400">{t("No income or expenses to close for this year.")}</p>
      ) : (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            {preview.from ? `${t("From")} ${dateLabel(preview.from)}` : t("From the start of the books")} {t("to")} {dateLabel(preview.yearEnd)}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {section("Income", preview.income, preview.totalIncome)}
            {section("Expenses", preview.expenses, preview.totalExpenses)}
          </div>
          <p className="mt-2 text-right text-xs text-slate-600 dark:text-gray-300">
            <b className={loss ? "text-rose-600" : "text-emerald-700"}>
              {t(loss ? "Loss for the year" : "Profit for the year")} {money(Math.abs(preview.netProfit))}
            </b>{" "}
            → {preview.retainedEarningsAccount}
          </p>
        </div>
      ))}

      {closed.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {closed.map((year) => (
            <li key={year.yearEnd} className="flex flex-wrap items-center gap-2">
              <span>
                {t("Year to")} {dateLabel(year.yearEnd)} · {year.entryNumber} · {t(year.netProfit < 0 ? "loss" : "profit")} {money(Math.abs(year.netProfit))}
              </span>
              {editable && (
                <button type="button" disabled={busy} onClick={() => { setReason(""); setUndoing(year); }}
                  className="text-rose-600 hover:underline disabled:opacity-50">{t("Reopen")}</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {undoing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-rose-200 p-3 dark:border-rose-900">
          <label className="min-w-[240px] flex-1 text-xs text-slate-500">
            {t("Why reopen the year to")} {dateLabel(undoing.yearEnd)}?
            <input className={`${INPUT} mt-1 block w-full`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
              placeholder={t("e.g. auditor's adjustments")} />
          </label>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => void undo()}
            className="h-[38px] rounded-lg bg-rose-600 px-4 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            {t("Reopen the year")}
          </button>
          <button type="button" onClick={() => setUndoing(null)}
            className="h-[38px] rounded-lg border border-slate-200 px-3 text-sm text-slate-600 hover:bg-slate-50">
            {t("Cancel")}
          </button>
          <p className="w-full text-[11px] text-slate-500">
            {t("The closing entry is reversed and the lock date goes back to the previous close (or is removed), so the whole year can be corrected.")}
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirming}
        title={t("Close the year")}
        message={preview ? `${t(loss ? "Loss for the year" : "Profit for the year")} ${money(Math.abs(preview.netProfit))} → ${preview.retainedEarningsAccount}. ${t("The books will be locked up to")} ${dateLabel(yearEnd)}.${preview.closed ? ` ${t("It replaces the closing entry already posted for this year.")}` : ""}` : ""}
        confirmLabel={t("Close the year")}
        onConfirm={() => void close()}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
}
