import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowUpTrayIcon, LinkIcon, SparklesIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { getRegional } from "../../company/format";
import { GeneralAccount, INVOICE_API, accountLabel, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import {
  BANK_API,
  BookLine,
  DateOrder,
  ParsedStatementLine,
  Reconciliation,
  StatementColumns,
  StatementLine,
  bankAccountLabel,
  findHeaderRow,
  guessColumns,
  readStatementFile,
  toStatementLines,
} from "./bankShared";

import { t } from "../../i18n/i18n";
type LineFilter = "OPEN" | "MATCHED" | "ALL";

const near = (value?: number | null) => value != null && Math.abs(value) < 0.005;
const signed = (value: number, currency?: string | null) => (
  <span className={value < 0 ? "text-rose-700" : "text-emerald-700"}>{value < 0 ? "−" : "+"}{money(Math.abs(value), currency)}</span>
);

// The company's date style decides how "05/10/2026" in a statement is read
const defaultDateOrder = (): DateOrder => {
  const format = (getRegional().dateFormat || "").toUpperCase();
  return format.startsWith("MM") ? "MDY" : format.startsWith("YYYY") ? "YMD" : "DMY";
};

const DATE_ORDER_OPTIONS = [
  { id: "DMY", name: "Day / month / year" },
  { id: "MDY", name: "Month / day / year" },
  { id: "YMD", name: "Year / month / day" },
];

/** One account's bank statement against its ledger account: import, match, post what only the bank did. */
const BankReconciliation: React.FC = () => {
  const { id } = useParams();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [asOf, setAsOf] = useState(todayInput);
  const [data, setData] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<LineFilter>("OPEN");
  const [busy, setBusy] = useState(false);
  const [ledgerAccounts, setLedgerAccounts] = useState<GeneralAccount[]>([]);
  // Dialogs
  const [matching, setMatching] = useState<StatementLine | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [posting, setPosting] = useState<StatementLine | null>(null);
  const [postForm, setPostForm] = useState({ accountId: "", description: "" });
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await axios.get<Reconciliation>(`${BANK_API}/${id}/reconciliation`, { params: { asOf: asOf || undefined } });
      setData(res.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the reconciliation"));
    } finally {
      setLoading(false);
    }
  }, [id, asOf]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`).then(
      (res) => setLedgerAccounts(Array.isArray(res.data) ? res.data : []),
      () => setLedgerAccounts([]),
    );
  }, []);

  const account = data?.account;
  const currency = account?.currency;
  const lines = useMemo(() => {
    const all = data?.statementLines ?? [];
    const shown = filter === "ALL" ? all : all.filter((line) => (filter === "MATCHED" ? line.matched : !line.matched));
    return [...shown].reverse();
  }, [data, filter]);
  const openCount = data?.statementLines.filter((line) => !line.matched).length ?? 0;

  const run = async (work: () => Promise<string | void>, failure: string) => {
    setBusy(true);
    try {
      const message = await work();
      if (message) ToasterService.success(message);
      await load();
      return true;
    } catch (err) {
      ToasterService.error(apiError(err, failure));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const autoMatch = () =>
    run(async () => {
      const res = await axios.post<{ matched: number }>(`${BANK_API}/${id}/auto-match`);
      return res.data.matched ? `${res.data.matched} line(s) matched` : "Nothing more could be matched automatically";
    }, "Could not match automatically");

  const unmatch = (line: StatementLine) =>
    run(async () => {
      await axios.delete(`${BANK_API}/${id}/statement-lines/${line.id}/match`);
      return line.posted ? "Unmatched; the entry made from it was reversed" : "Unmatched";
    }, "Could not unmatch");

  const removeLine = (line: StatementLine) =>
    run(async () => {
      await axios.delete(`${BANK_API}/${id}/statement-lines/${line.id}`);
      return "Statement line removed";
    }, "Could not remove the line");

  // Book lines for the match dialog: same amount first, then the nearest dates
  const candidates = useMemo(() => {
    if (!matching || !data) return [];
    const day = (iso: string) => new Date(`${iso}T00:00:00`).getTime() / 86_400_000;
    return [...data.unmatchedBookLines].sort((a, b) => {
      const sameA = near(a.amount - matching.amount) ? 0 : 1;
      const sameB = near(b.amount - matching.amount) ? 0 : 1;
      return sameA - sameB || Math.abs(day(a.date) - day(matching.date)) - Math.abs(day(b.date) - day(matching.date));
    });
  }, [matching, data]);
  const chosenTotal = candidates.filter((line) => chosen.includes(line.id)).reduce((sum, line) => sum + Number(line.amount), 0);

  const openMatch = (line: StatementLine) => {
    setMatching(line);
    const exact = data?.unmatchedBookLines.filter((book) => near(book.amount - line.amount)) ?? [];
    setChosen(exact.length === 1 ? [exact[0].id] : []);
  };

  const saveMatch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!matching) return;
    const ok = await run(async () => {
      await axios.put(`${BANK_API}/${id}/statement-lines/${matching.id}/match`, { entryLineIds: chosen });
      return "Matched";
    }, "Could not match");
    if (ok) setMatching(null);
  };

  const postOptions = useMemo(
    () =>
      ledgerAccounts
        .filter((a) => a.isActive !== false && a.allowTransactions !== false && a.id !== account?.generalAccountId)
        // Money out is usually an expense, money in an income
        .sort((a, b) => {
          const preferred = posting && posting.amount < 0 ? "EXPENSE" : "INCOME";
          return (a.accountType === preferred ? 0 : 1) - (b.accountType === preferred ? 0 : 1) || a.accountCode.localeCompare(b.accountCode);
        })
        .map((a) => ({ id: String(a.id), name: accountLabel(a) })),
    [ledgerAccounts, account, posting]
  );

  const savePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!posting) return;
    if (!postForm.accountId) return ToasterService.error("Choose the account");
    const ok = await run(async () => {
      await axios.post(`${BANK_API}/${id}/statement-lines/${posting.id}/post`, {
        accountId: Number(postForm.accountId),
        description: postForm.description.trim() || null,
      });
      return "Posted and matched";
    }, "Could not post the line");
    if (ok) setPosting(null);
  };

  const differenceTone = data?.difference == null ? "slate" : near(data.difference) ? "green" : "orange";

  return (
    <>
      <PageMeta title={t("Bank Reconciliation")} description="Bank statement against the books" />
      <PageBreadcrumb pageTitle={account ? `Reconcile ${account.accountName}` : "Bank Reconciliation"} />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="text-sm text-slate-600">
            <Link to="/bankAccounts" className="text-cyan-700 hover:underline">Bank &amp; Cash</Link>
            {account && (
              <span className="text-slate-500"> · {bankAccountLabel(account)} · ledger {account.generalAccountCode} · from {dateLabel(account.openingDate)}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              {t("As at")}
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-cyan-400 focus:outline-none" />
            </label>
            {canCreate && (
              <button type="button" onClick={() => setImporting(true)} disabled={busy}
                className="flex h-8 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50">
                <ArrowUpTrayIcon className="h-4 w-4" /> {t("Import statement")}
              </button>
            )}
            {canUpdate && (
              <button type="button" onClick={autoMatch} disabled={busy || openCount === 0}
                className="flex h-8 items-center gap-1.5 rounded-md bg-cyan-600 px-3 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
                <SparklesIcon className="h-4 w-4" /> {t("Auto-match")}
              </button>
            )}
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard label={t("Balance in books")} value={money(data.bookBalance, currency)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
            <StatsCard label={t("In books, not yet in bank")} value={money(data.unclearedBook, currency)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
            <StatsCard label={t("In bank, not yet in books")} value={money(data.unrecordedStatement, currency)} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
            <StatsCard
              label={data.statementBalance == null ? "Statement should show" : near(data.difference) ? "Reconciled" : "Difference to explain"}
              value={money(data.statementBalance == null ? data.expectedStatementBalance : data.difference ?? 0, currency)}
              gradient={differenceTone === "orange" ? "from-orange-50 to-yellow-50" : "from-green-50 to-emerald-50"}
              borderColor={differenceTone === "orange" ? "border-orange-100" : "border-green-100"}
              labelColor={differenceTone === "orange" ? "text-orange-600" : "text-green-600"}
            />
          </div>
        )}

        {data && (
          <p className="text-xs text-slate-500">
            {t("Books")} {money(data.bookBalance, currency)} − not yet in bank {money(data.unclearedBook, currency)} + not yet in books{" "}
            {money(data.unrecordedStatement, currency)} = statement should show <b>{money(data.expectedStatementBalance, currency)}</b>
            {data.statementBalance != null && (
              <> · the statement shows {money(data.statementBalance, currency)} on {dateLabel(data.statementBalanceDate)}</>
            )}
            .
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
              <span className="text-sm font-semibold text-slate-800">{t("Bank statement")}</span>
              <div className="flex gap-1">
                {([["OPEN", `Open (${openCount})`], ["MATCHED", "Matched"], ["ALL", "All"]] as [LineFilter, string][]).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setFilter(value)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${filter === value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[60dvh] overflow-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t("Date")}</th>
                    <th className="px-3 py-2">{t("Details")}</th>
                    <th className="px-3 py-2 text-right">{t("Amount")}</th>
                    <th className="px-3 py-2 text-right">{t("Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      {loading ? "Loading…" : data?.statementLines.length ? "Nothing here" : "No statement imported yet"}
                    </td></tr>
                  )}
                  {lines.map((line) => (
                    <tr key={line.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{dateLabel(line.date)}</td>
                      <td className="px-3 py-2">
                        <span className="text-slate-800">{line.description || "—"}</span>
                        {line.reference && <span className="block text-xs text-slate-500">{t("Ref")} {line.reference}</span>}
                        {line.matches.map((book) => (
                          <span key={book.id} className="block text-xs text-emerald-700">
                            <LinkIcon className="mr-1 inline h-3 w-3" />{book.entryNumber} · {book.description || book.narration}
                          </span>
                        ))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        {signed(Number(line.amount), currency)}
                        {line.balance != null && <span className="block text-[11px] font-normal text-slate-400">{t("bal")} {money(line.balance, currency)}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {line.matched ? (
                          <span className="flex items-center justify-end gap-2">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{line.posted ? "Posted" : "Matched"}</span>
                            {canUpdate && <button type="button" disabled={busy} onClick={() => unmatch(line)} className="text-xs text-slate-500 hover:text-rose-600 hover:underline">{t("Unmatch")}</button>}
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-2">
                            {canUpdate && <button type="button" disabled={busy} onClick={() => openMatch(line)} className="text-xs font-medium text-cyan-700 hover:underline">{t("Match")}</button>}
                            {canCreate && (
                              <button type="button" disabled={busy} className="text-xs font-medium text-cyan-700 hover:underline"
                                onClick={() => { setPosting(line); setPostForm({ accountId: "", description: line.description ?? "" }); }}>
                                {t("Post")}
                              </button>
                            )}
                            {canDelete && <button type="button" disabled={busy} onClick={() => removeLine(line)} className="text-xs text-slate-400 hover:text-rose-600 hover:underline">{t("Remove")}</button>}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-2">
            <div className="border-b border-slate-100 px-4 py-2">
              <span className="text-sm font-semibold text-slate-800">{t("In the books, not yet matched")}</span>
              <span className="block text-xs text-slate-500">{t("Receipts, payments and entries on")} {account?.generalAccountCode ?? "the account"} the statement hasn't cleared</span>
            </div>
            <div className="max-h-[60dvh] overflow-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {(data?.unmatchedBookLines.length ?? 0) === 0 && (
                    <tr><td className="px-3 py-6 text-center text-slate-400">{loading ? "Loading…" : "Everything in the books is matched"}</td></tr>
                  )}
                  {[...(data?.unmatchedBookLines ?? [])].reverse().map((book) => (
                    <tr key={book.id} className={data && book.date > data.asOf ? "opacity-60" : ""}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{dateLabel(book.date)}</td>
                      <td className="px-3 py-2">
                        <span className="text-slate-800">{book.description || "—"}</span>
                        <span className="block text-xs text-slate-500">{book.entryNumber}{book.narration ? ` · ${book.narration}` : ""}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{signed(Number(book.amount), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Match a statement line with ledger lines */}
      <PaginatedPopup
        isOpen={!!matching}
        title={t("Match statement line")}
        subtitle={matching ? `${dateLabel(matching.date)} · ${matching.description ?? ""} · ${money(matching.amount, currency)}` : undefined}
        onClose={() => setMatching(null)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={saveMatch} className="flex flex-col">
            <div className="max-h-[60dvh] overflow-y-auto px-4 py-4 sm:px-5">
              <p className="mb-2 text-xs text-slate-500">Tick the ledger lines this bank line clears; a deposit of several receipts can clear many.</p>
              {candidates.length === 0 && <p className="py-4 text-center text-sm text-slate-400">{t("No open lines in the books. Post it instead.")}</p>}
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {candidates.map((book: BookLine) => (
                  <li key={book.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <input type="checkbox" checked={chosen.includes(book.id)}
                        onChange={(e) => setChosen((current) => (e.target.checked ? [...current, book.id] : current.filter((x) => x !== book.id)))} />
                      <span className="w-24 shrink-0 text-slate-600">{dateLabel(book.date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-800">{book.description || "—"}</span>
                        <span className="block truncate text-xs text-slate-500">{book.entryNumber}{book.narration ? ` · ${book.narration}` : ""}</span>
                      </span>
                      <span className="shrink-0 font-medium">{signed(Number(book.amount), currency)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {matching && (
                <p className={`mt-3 text-sm ${near(chosenTotal - matching.amount) ? "text-emerald-700" : "text-slate-600"}`}>
                  {t("Chosen")} {money(chosenTotal, currency)} of {money(matching.amount, currency)}
                  {!near(chosenTotal - matching.amount) && chosen.length > 0 && ` · ${money(matching.amount - chosenTotal, currency)} still to find`}
                </p>
              )}
            </div>
            <DialogFooter onCancel={() => setMatching(null)} submitLabel={t("Match")} busy={busy}
              disabled={!matching || chosen.length === 0 || !near(chosenTotal - matching.amount)} />
          </form>
        }
      />

      {/* Post a line only the bank has */}
      <PaginatedPopup
        isOpen={!!posting}
        title={t("Post to the books")}
        subtitle={posting ? `${dateLabel(posting.date)} · ${money(posting.amount, currency)} — for what only the bank did: charges, interest, a direct debit` : undefined}
        onClose={() => setPosting(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={savePost} className="flex flex-col">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <FloatingSelect1 label={posting && posting.amount < 0 ? "Expense or account it paid" : "Income or account it came from"} name="accountId"
                required value={postForm.accountId} options={postOptions} onChange={(e) => setPostForm((f) => ({ ...f, accountId: e.target.value }))} />
              <FloatingInput label={t("Description")} name="description" value={postForm.description}
                onChange={(e) => setPostForm((f) => ({ ...f, description: e.target.value }))} />
              <p className="text-xs text-slate-500">
                A journal entry is made on the statement date ({posting && posting.amount < 0 ? "Dr the account / Cr the bank" : "Dr the bank / Cr the account"})
                and matched to this line. Unmatching reverses it.
              </p>
            </div>
            <DialogFooter onCancel={() => setPosting(null)} submitLabel={t("Post and match")} busy={busy} />
          </form>
        }
      />

      {importing && id && (
        <ImportStatementDialog bankAccountId={id} currency={currency} onClose={() => setImporting(false)} onImported={load} />
      )}
    </>
  );
};

/** Reads a CSV or Excel statement, lets the user confirm the columns and sends the lines. */
const ImportStatementDialog: React.FC<{ bankAccountId: string; currency?: string | null; onClose: () => void; onImported: () => void }> = ({
  bankAccountId,
  currency,
  onClose,
  onImported,
}) => {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<unknown[][]>([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [columns, setColumns] = useState<StatementColumns | null>(null);
  const [order, setOrder] = useState<DateOrder>(defaultDateOrder);
  const [busy, setBusy] = useState(false);

  const header = rows[headerRow] ?? [];
  const columnOptions = header.map((cell, index) => ({ id: String(index), name: String(cell ?? "").trim() || `Column ${index + 1}` }));

  const read = async (file?: File) => {
    if (!file) return;
    try {
      const sheet = await readStatementFile(file);
      if (sheet.length < 2) return ToasterService.error("The file has no lines");
      const found = findHeaderRow(sheet);
      setFileName(file.name);
      setRows(sheet);
      setHeaderRow(found);
      setColumns(guessColumns(sheet[found]));
    } catch {
      ToasterService.error("Could not read the file. Use the CSV or Excel statement downloaded from the bank.");
    }
  };

  const parsed: ParsedStatementLine[] = useMemo(
    () => (columns ? toStatementLines(rows, headerRow, columns, order) : []),
    [rows, headerRow, columns, order]
  );
  // Rows without an amount (opening/closing balance lines, footers) are left out; an amount without a date is a problem
  const usable = parsed.filter((line) => line.amount != null && line.amount !== 0);
  const undated = usable.filter((line) => !line.date).length;
  const totals = usable.reduce((t, l) => ({ in: t.in + Math.max(l.amount ?? 0, 0), out: t.out + Math.min(l.amount ?? 0, 0) }), { in: 0, out: 0 });
  const amountReady = columns && (columns.amount >= 0 || columns.moneyIn >= 0 || columns.moneyOut >= 0);

  const setColumn = (key: keyof StatementColumns, value: string) =>
    setColumns((current) => {
      if (!current) return current;
      const next = { ...current, [key]: value === "" ? -1 : Number(value) };
      // One signed amount column or the in/out pair, not both
      if (key === "amount" && value !== "") Object.assign(next, { moneyIn: -1, moneyOut: -1 });
      if ((key === "moneyIn" || key === "moneyOut") && value !== "") next.amount = -1;
      return next;
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!columns || columns.date < 0) return ToasterService.error("Choose the date column");
    if (!amountReady) return ToasterService.error("Choose the amount column, or the money in and money out columns");
    if (undated > 0) return ToasterService.error(`${undated} line(s) have an amount but no date the chosen order can read`);
    if (usable.length === 0) return ToasterService.error("No lines with an amount to import");
    setBusy(true);
    try {
      const res = await axios.post<{ imported: number; duplicates: number; skipped: number }>(
        `${BANK_API}/${bankAccountId}/statement-lines`,
        { batch: fileName, lines: usable }
      );
      const { imported, duplicates } = res.data;
      ToasterService.success(`${imported} line(s) imported${duplicates ? `; ${duplicates} were already there` : ""}`);
      onImported();
      onClose();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not import the statement"));
    } finally {
      setBusy(false);
    }
  };

  const select = (label: string, key: keyof StatementColumns) => (
    <FloatingSelect1 label={label} name={key} value={columns && columns[key] >= 0 ? String(columns[key]) : ""}
      options={columnOptions} emptyOptionLabel="—" onChange={(e) => setColumn(key, e.target.value)} />
  );

  return (
    <PaginatedPopup
      isOpen
      title={t("Import bank statement")}
      subtitle={t("The CSV or Excel statement from your bank's online banking. Lines already imported are skipped, so overlapping statements are fine.")}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      content={
        <form onSubmit={submit} className="flex flex-col">
          <div className="max-h-[65dvh] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={(e) => read(e.target.files?.[0])}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-50 file:px-3 file:py-1.5 file:text-cyan-700" />
            {columns && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FloatingInput label={t("Header row")} name="headerRow" type="number" value={String(headerRow + 1)}
                    onChange={(e) => {
                      const row = Math.max(0, Math.min(rows.length - 1, Number(e.target.value) - 1));
                      setHeaderRow(row);
                      setColumns(guessColumns(rows[row] ?? []));
                    }} />
                  {select("Date", "date")}
                  <FloatingSelect1 label={t("Dates are written")} name="order" value={order} options={DATE_ORDER_OPTIONS} includeEmptyOption={false}
                    onChange={(e) => setOrder(e.target.value as DateOrder)} />
                  {select("Description", "description")}
                  {select("Reference", "reference")}
                  {select("Balance", "balance")}
                  {select("Amount (signed)", "amount")}
                  {select("Money out (debit)", "moneyOut")}
                  {select("Money in (credit)", "moneyIn")}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                      <tr><th className="px-2 py-1.5">{t("Date")}</th><th className="px-2 py-1.5">{t("Description")}</th><th className="px-2 py-1.5">{t("Ref")}</th><th className="px-2 py-1.5 text-right">{t("Amount")}</th><th className="px-2 py-1.5 text-right">{t("Balance")}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usable.slice(0, 8).map((line, index) => (
                        <tr key={index}>
                          <td className={`px-2 py-1 ${line.date ? "text-slate-700" : "font-medium text-rose-600"}`}>{line.date ? dateLabel(line.date) : "can't read"}</td>
                          <td className="max-w-[260px] truncate px-2 py-1 text-slate-700">{line.description}</td>
                          <td className="px-2 py-1 text-slate-500">{line.reference}</td>
                          <td className="px-2 py-1 text-right">{signed(Number(line.amount), currency)}</td>
                          <td className="px-2 py-1 text-right text-slate-500">{line.balance != null ? money(line.balance, currency) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">
                  {usable.length} line(s): money in {money(totals.in, currency)}, money out {money(Math.abs(totals.out), currency)}
                  {parsed.length > usable.length ? `; ${parsed.length - usable.length} row(s) without an amount left out` : ""}.
                  {undated > 0 && <span className="text-rose-600"> {undated} line(s) have no readable date: check "Dates are written".</span>}
                </p>
              </>
            )}
          </div>
          <DialogFooter onCancel={onClose} submitLabel={usable.length ? `Import ${usable.length} line(s)` : "Import"} busy={busy}
            disabled={!columns || usable.length === 0} />
        </form>
      }
    />
  );
};

export default BankReconciliation;
