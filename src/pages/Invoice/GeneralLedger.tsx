import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import {
  GeneralAccount,
  INVOICE_API,
  JournalEntry,
  accountLabel,
  apiError,
  dateLabel,
  isDebitNormal,
  labelOf,
  lineIsFor,
  money,
  todayInput,
} from "./invoiceShared";

type View = "LEDGER" | "TRIAL";

interface LedgerRow {
  key: string;
  entry: JournalEntry;
  narration?: string;
  debit: number;
  credit: number;
}

const startOfYear = () => `${new Date().getFullYear()}-01-01`;

/** Read-only view of the journal: one account's postings with a running balance, and the trial balance. */
const GeneralLedger: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("LEDGER");
  // General Accounts opens an account's ledger by passing its id
  const [accountId, setAccountId] = useState(() => {
    const id = (location.state as { accountId?: number } | null)?.accountId;
    return id != null ? String(id) : "";
  });
  const [from, setFrom] = useState(startOfYear);
  const [to, setTo] = useState(todayInput);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [accountRes, entryRes] = await Promise.all([
        axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`),
        axios.get<JournalEntry[]>(`${INVOICE_API}/journal-entries`),
      ]);
      const accountList = Array.isArray(accountRes.data) ? accountRes.data : [];
      const entryList = Array.isArray(entryRes.data) ? entryRes.data : [];
      setAccounts([...accountList].sort((a, b) => a.accountCode.localeCompare(b.accountCode)));
      setEntries(entryList);
      // Start on the first account that has postings
      setAccountId((current) => {
        if (current) return current;
        const used = accountList.find((account) => entryList.some((entry) => entry.entries?.some((line) => lineIsFor(line, account))));
        return used ? String(used.id) : accountList[0] ? String(accountList[0].id) : "";
      });
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load the ledger"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const account = accounts.find((item) => String(item.id) === accountId);

  // Postings in date order; entries without a date sort as today's
  const ordered = useMemo(
    () =>
      [...entries].sort((a, b) => (a.entryDate ?? todayInput()).localeCompare(b.entryDate ?? todayInput()) || a.id - b.id),
    [entries]
  );

  const ledger = useMemo(() => {
    if (!account) return null;
    const sign = isDebitNormal(account.accountType) ? 1 : -1;
    let opening = Number(account.openingBalance || 0);
    const rows: LedgerRow[] = [];
    for (const entry of ordered) {
      const date = entry.entryDate ?? todayInput();
      if (to && date > to) continue;
      entry.entries?.forEach((line, index) => {
        if (!lineIsFor(line, account)) return;
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (from && date < from) {
          opening += sign * (debit - credit);
        } else {
          rows.push({ key: `${entry.id}-${line.id ?? index}`, entry, narration: line.narration, debit, credit });
        }
      });
    }
    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    return { sign, opening, rows, totalDebit, totalCredit, closing: opening + sign * (totalDebit - totalCredit) };
  }, [account, ordered, from, to]);

  // Balances as at the "to" date, shown on their natural side
  const trial = useMemo(() => {
    const rows = accounts.map((item) => {
      let debitSide = (isDebitNormal(item.accountType) ? 1 : -1) * Number(item.openingBalance || 0);
      for (const entry of ordered) {
        if (to && (entry.entryDate ?? todayInput()) > to) continue;
        entry.entries?.forEach((line) => {
          if (lineIsFor(line, item)) debitSide += Number(line.debit || 0) - Number(line.credit || 0);
        });
      }
      return { account: item, debit: debitSide > 0 ? debitSide : 0, credit: debitSide < 0 ? -debitSide : 0 };
    });
    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    return { rows: rows.filter((row) => row.debit || row.credit), totalDebit, totalCredit };
  }, [accounts, ordered, to]);

  const currency = account?.currency || "INR";
  let running = ledger?.opening ?? 0;

  return (
    <>
      <PageMeta title="General Ledger" description="Account postings and trial balance" />
      <PageBreadcrumb pageTitle="General Ledger" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {([["LEDGER", "Account ledger"], ["TRIAL", "Trial balance"]] as [View, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${view === value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            Postings come from{" "}
            <button type="button" className="text-cyan-700 hover:underline" onClick={() => navigate("/journalEntries")}>journal entries</button>.
          </span>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          {view === "LEDGER" && (
            <FloatingSelect1
              label="Account"
              name="accountId"
              value={accountId}
              options={accounts.map((item) => ({ id: String(item.id), name: accountLabel(item) }))}
              onChange={(event) => setAccountId(event.target.value)}
            />
          )}
          {view === "LEDGER" && <FloatingInput label="From" name="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />}
          <FloatingInput label={view === "LEDGER" ? "To" : "As at"} name="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {!loading && accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-10">
            <BookOpenIcon className="mb-3 h-12 w-12 text-gray-400" />
            <p className="text-sm text-gray-500">No accounts yet</p>
            <button type="button" className="mt-1 text-xs font-medium text-cyan-700 hover:underline" onClick={() => navigate("/generalAccounts")}>
              Set up the chart of accounts
            </button>
          </div>
        )}

        {!loading && view === "LEDGER" && ledger && account && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard label="Opening" value={money(ledger.opening, currency)} gradient="from-slate-50 to-slate-100" borderColor="border-slate-200" labelColor="text-slate-600" />
              <StatsCard label="Debits" value={money(ledger.totalDebit, currency)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
              <StatsCard label="Credits" value={money(ledger.totalCredit, currency)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
              <StatsCard label="Closing" value={money(ledger.closing, currency)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
            </div>
            <p className="text-xs text-slate-500">
              {labelOf(account.accountType)} account: the balance grows with {ledger.sign > 0 ? "debits" : "credits"}.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Entry</th>
                    <th className="px-3 py-2 text-left">Details</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/50">
                    <td className="px-3 py-2" colSpan={5}>Opening balance{from ? ` on ${dateLabel(from)}` : ""}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(ledger.opening, currency)}</td>
                  </tr>
                  {ledger.rows.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-400" colSpan={6}>No postings in this period</td>
                    </tr>
                  )}
                  {ledger.rows.map((row) => {
                    running += ledger.sign * (row.debit - row.credit);
                    return (
                      <tr key={row.key}>
                        <td className="px-3 py-2">{dateLabel(row.entry.entryDate)}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium">{row.entry.entryNumber}</span>
                          {row.entry.sourceModule && <span className="block text-xs text-slate-500">{labelOf(row.entry.sourceModule)}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.entry.description || "—"}
                          {row.narration && <span className="block text-xs text-slate-500">{row.narration}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{row.debit ? money(row.debit, currency) : ""}</td>
                        <td className="px-3 py-2 text-right">{row.credit ? money(row.credit, currency) : ""}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(running, currency)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>Closing balance{to ? ` on ${dateLabel(to)}` : ""}</td>
                    <td className="px-3 py-2 text-right">{money(ledger.totalDebit, currency)}</td>
                    <td className="px-3 py-2 text-right">{money(ledger.totalCredit, currency)}</td>
                    <td className="px-3 py-2 text-right">{money(ledger.closing, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && view === "TRIAL" && accounts.length > 0 && (
          <>
            {Math.abs(trial.totalDebit - trial.totalCredit) > 0.005 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Debits and credits differ by {money(Math.abs(trial.totalDebit - trial.totalCredit))}. Journal entries always balance, so check the accounts' opening balances.
              </p>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Debits equal credits.</p>
            )}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trial.rows.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-400" colSpan={4}>No balances yet</td>
                    </tr>
                  )}
                  {trial.rows.map((row) => (
                    <tr
                      key={row.account.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        setAccountId(String(row.account.id));
                        setView("LEDGER");
                      }}
                    >
                      <td className="px-3 py-2 font-medium text-slate-800">{accountLabel(row.account)}</td>
                      <td className="px-3 py-2 text-slate-600">{labelOf(row.account.accountType)}</td>
                      <td className="px-3 py-2 text-right">{row.debit ? money(row.debit) : ""}</td>
                      <td className="px-3 py-2 text-right">{row.credit ? money(row.credit) : ""}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2" colSpan={2}>Total</td>
                    <td className="px-3 py-2 text-right">{money(trial.totalDebit)}</td>
                    <td className="px-3 py-2 text-right">{money(trial.totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default GeneralLedger;
