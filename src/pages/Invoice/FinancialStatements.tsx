import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { exportListingPdf } from "../../components/common/export";
import { usePermissions } from "../../access/usePermissions";
import { useCompany } from "../../company/companyApi";
import { formatDate, formatMoney, todayIso } from "../../company/format";
import { INVOICE_API, apiError, labelOf } from "./invoiceShared";

import { t } from "../../i18n/i18n";
interface StatementLine {
  accountId: number;
  accountCode: string;
  accountName: string;
  amount: number;
}

interface TrialBalanceLine {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

interface TrialBalance {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

interface ProfitAndLoss {
  revenue: StatementLine[];
  totalRevenue: number;
  costOfSales: StatementLine[];
  totalCostOfSales: number;
  grossProfit: number;
  expenses: StatementLine[];
  totalExpenses: number;
  netProfit: number;
}

interface BalanceSheet {
  assets: StatementLine[];
  totalAssets: number;
  liabilities: StatementLine[];
  totalLiabilities: number;
  equity: StatementLine[];
  profitToDate: number;
  totalEquity: number;
  unclassified: StatementLine[];
  difference: number;
}

type Statement = "PNL" | "BS" | "TB";
type Period = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "lastYear" | "custom";

const STATEMENTS: { id: Statement; label: string }[] = [
  { id: "PNL", label: "Profit & loss" },
  { id: "BS", label: "Balance sheet" },
  { id: "TB", label: "Trial balance" },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisQuarter", label: "This quarter" },
  { id: "thisYear", label: "Financial year to date" },
  { id: "lastYear", label: "Last financial year" },
  { id: "custom", label: "Custom" },
];

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * First and last day of a period from today in the company's time zone; quarters and years follow the
 * company's financial year, and the current ones end today.
 */
const rangeOf = (period: Period, fyStartMonth: number): [string, string] => {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const month = m - 1;
  const sinceYearStart = (month - (fyStartMonth - 1) + 12) % 12;
  const months = (startMonth: number, count: number, toToday: boolean): [string, string] => {
    const end = isoOf(new Date(y, startMonth + count, 0));
    return [isoOf(new Date(y, startMonth, 1)), toToday && end > today ? today : end];
  };
  if (period === "lastMonth") return months(month - 1, 1, false);
  if (period === "thisQuarter") return months(month - (sinceYearStart % 3), 3, true);
  if (period === "thisYear") return months(month - sinceYearStart, 12, true);
  if (period === "lastYear") return months(month - sinceYearStart - 12, 12, false);
  return months(month, 1, true);
};

const INPUT = "h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:border-cyan-400 focus:outline-none dark:border-gray-700 dark:bg-[#1f1f1f] dark:text-gray-100";
const near = (value: number) => Math.abs(value) < 0.005;
const label = (line: { accountCode: string; accountName: string }) => `${line.accountCode} · ${line.accountName}`;

type PdfRow = { item: string; amount: string };

/** Profit and loss, balance sheet and trial balance, worked out from the ledger by the invoice service. */
const FinancialStatements: React.FC = () => {
  const navigate = useNavigate();
  const { company } = useCompany();
  const { canExport } = usePermissions();
  const fyStart = company?.financialYearStartMonth || 1;
  const [statement, setStatement] = useState<Statement>("PNL");
  const [period, setPeriod] = useState<Period>("thisYear");
  const [[from, to], setRange] = useState<[string, string]>(() => rangeOf("thisYear", fyStart));
  const [pnl, setPnl] = useState<ProfitAndLoss | null>(null);
  const [sheet, setSheet] = useState<BalanceSheet | null>(null);
  const [trial, setTrial] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);

  // On a new period, and when the company's financial year arrives after the first render; custom keeps its dates
  useEffect(() => {
    if (period !== "custom") setRange(rangeOf(period, fyStart));
  }, [fyStart, period]);

  const load = useCallback(async () => {
    if (!from || !to || to < from) return;
    try {
      setLoading(true);
      if (statement === "PNL") {
        setPnl((await axios.get<ProfitAndLoss>(`${INVOICE_API}/financial-statements/profit-and-loss`, { params: { from, to } })).data);
      } else if (statement === "BS") {
        setSheet((await axios.get<BalanceSheet>(`${INVOICE_API}/financial-statements/balance-sheet`, { params: { asOf: to } })).data);
      } else {
        setTrial((await axios.get<TrialBalance>(`${INVOICE_API}/financial-statements/trial-balance`, { params: { from, to } })).data);
      }
    } catch (err) {
      ToasterService.error(apiError(err, "Could not work out the statement"));
    } finally {
      setLoading(false);
    }
  }, [statement, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (value?: number) => formatMoney(value ?? 0);
  const openLedger = (accountId: number) => navigate("/generalLedger", { state: { accountId } });
  const periodLabel = statement === "BS" ? `As at ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`;

  const trialTotals = useMemo(() => {
    const lines = trial?.lines ?? [];
    const sum = (pick: (line: TrialBalanceLine) => number) => lines.reduce((total, line) => total + Number(pick(line) || 0), 0);
    return {
      openingDebit: sum((l) => l.openingDebit),
      openingCredit: sum((l) => l.openingCredit),
      periodDebit: sum((l) => l.periodDebit),
      periodCredit: sum((l) => l.periodCredit),
    };
  }, [trial]);

  const exportPdf = () => {
    const title = STATEMENTS.find((s) => s.id === statement)?.label ?? "Financial statement";
    const range = statement === "BS" ? `As at ${formatDate(to)}` : `${formatDate(from)} to ${formatDate(to)}`;
    const common = { title, reportLabel: "Financial statement", includeSerialNumber: false, metadata: [{ label: "Range", value: range }] };
    if (statement === "TB" && trial) {
      exportListingPdf<TrialBalanceLine>({
        ...common,
        orientation: "landscape",
        data: trial.lines,
        columns: [
          { header: "Account", accessor: (l) => label(l) },
          { header: "Type", accessor: (l) => labelOf(l.accountType) },
          { header: "Opening Dr", accessor: (l) => (l.openingDebit ? money(l.openingDebit) : ""), align: "right" },
          { header: "Opening Cr", accessor: (l) => (l.openingCredit ? money(l.openingCredit) : ""), align: "right" },
          { header: "Period Dr", accessor: (l) => (l.periodDebit ? money(l.periodDebit) : ""), align: "right" },
          { header: "Period Cr", accessor: (l) => (l.periodCredit ? money(l.periodCredit) : ""), align: "right" },
          { header: "Closing Dr", accessor: (l) => (l.closingDebit ? money(l.closingDebit) : ""), align: "right" },
          { header: "Closing Cr", accessor: (l) => (l.closingCredit ? money(l.closingCredit) : ""), align: "right" },
        ],
        metadata: [...common.metadata, { label: "Closing debits", value: money(trial.totalDebit) }, { label: "Closing credits", value: money(trial.totalCredit) }],
      });
      return;
    }
    const rows: PdfRow[] = [];
    const section = (heading: string, lines: StatementLine[], totalLabel: string, total: number) => {
      rows.push({ item: heading.toUpperCase(), amount: "" });
      lines.forEach((line) => rows.push({ item: `    ${label(line)}`, amount: money(line.amount) }));
      rows.push({ item: totalLabel, amount: money(total) });
    };
    if (statement === "PNL" && pnl) {
      section("Revenue", pnl.revenue, "Total revenue", pnl.totalRevenue);
      section("Cost of sales", pnl.costOfSales, "Total cost of sales", pnl.totalCostOfSales);
      rows.push({ item: "Gross profit", amount: money(pnl.grossProfit) });
      section("Expenses", pnl.expenses, "Total expenses", pnl.totalExpenses);
      rows.push({ item: pnl.netProfit < 0 ? "Net loss" : "Net profit", amount: money(Math.abs(pnl.netProfit)) });
    } else if (statement === "BS" && sheet) {
      section("Assets", sheet.assets, "Total assets", sheet.totalAssets);
      section("Liabilities", sheet.liabilities, "Total liabilities", sheet.totalLiabilities);
      section("Equity", [...sheet.equity, { accountId: 0, accountCode: "", accountName: "Profit to date", amount: sheet.profitToDate }],
        "Total equity", sheet.totalEquity);
      rows.push({ item: "Liabilities and equity", amount: money(sheet.totalLiabilities + sheet.totalEquity) });
    } else {
      return;
    }
    exportListingPdf<PdfRow>({
      ...common,
      orientation: "portrait",
      data: rows,
      columns: [
        { header: "", key: "item" },
        { header: "Amount", key: "amount", align: "right", width: 45 },
      ],
    });
  };

  const hasData = statement === "PNL" ? !!pnl : statement === "BS" ? !!sheet : !!trial;

  return (
    <>
      <PageMeta title={t("Financial Statements")} description="Profit and loss, balance sheet and trial balance" />
      <PageBreadcrumb pageTitle="Financial Statements" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATEMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatement(s.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${statement === s.id ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {s.label}
            </button>
          ))}
          {canExport && (
            <button
              type="button"
              onClick={exportPdf}
              disabled={!hasData || loading}
              className="ml-auto flex h-8 items-center gap-1.5 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" /> {t("PDF")}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
                className={`h-8 rounded-md border px-3 text-xs font-medium ${period === p.id
                  ? "border-cyan-400 bg-cyan-50 text-cyan-800 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:bg-[#1f1f1f] dark:text-gray-300"}`}>
                {p.label}
              </button>
            ))}
            {period === "custom" && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                {statement !== "BS" && (
                  <>
                    <input type="date" className={INPUT} value={from} onChange={(e) => setRange([e.target.value, to])} aria-label={t("From")} />
                    to
                  </>
                )}
                {statement === "BS" && "as at"}
                <input type="date" className={INPUT} value={to} onChange={(e) => setRange([from, e.target.value])} aria-label={statement === "BS" ? "As at" : "To"} />
              </span>
            )}
          </div>
          <div className="text-right text-xs text-slate-500 dark:text-gray-400">
            <div className="font-semibold text-slate-700 dark:text-gray-200">{company?.legalName || company?.companyName}</div>
            <div>{periodLabel}</div>
          </div>
        </div>

        {loading && !hasData && <p className="text-sm text-slate-500">{t("Working it out…")}</p>}

        {statement === "PNL" && pnl && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatsCard label={t("Revenue")} value={money(pnl.totalRevenue)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
              <StatsCard label={t("Gross profit")} value={money(pnl.grossProfit)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
              <StatsCard
                label={pnl.netProfit < 0 ? "Net loss" : "Net profit"}
                value={money(Math.abs(pnl.netProfit))}
                gradient={pnl.netProfit < 0 ? "from-orange-50 to-yellow-50" : "from-green-50 to-emerald-50"}
                borderColor={pnl.netProfit < 0 ? "border-orange-100" : "border-green-100"}
                labelColor={pnl.netProfit < 0 ? "text-orange-600" : "text-green-600"}
              />
            </div>
            <StatementTable>
              <Section title={t("Revenue")} lines={pnl.revenue} totalLabel="Total revenue" total={pnl.totalRevenue} onOpen={openLedger} money={money} />
              <Section title={t("Cost of sales")} lines={pnl.costOfSales} totalLabel="Total cost of sales" total={pnl.totalCostOfSales} onOpen={openLedger} money={money} />
              <ResultRow label={t("Gross profit")} amount={money(pnl.grossProfit)} />
              <Section title={t("Expenses")} lines={pnl.expenses} totalLabel="Total expenses" total={pnl.totalExpenses} onOpen={openLedger} money={money} />
              <ResultRow label={pnl.netProfit < 0 ? "Net loss" : "Net profit"} amount={money(Math.abs(pnl.netProfit))} strong />
            </StatementTable>
          </>
        )}

        {statement === "BS" && sheet && (
          <>
            {!near(sheet.difference) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t("Assets and liabilities plus equity differ by")} {money(Math.abs(sheet.difference))}. Journal entries always balance,
                so check the accounts' opening balances in the <Link to="/generalAccounts" className="font-semibold underline">{t("Chart of Accounts")}</Link>
                {sheet.unclassified.length > 0 ? " and give the accounts below a type" : ""}.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatsCard label={t("Assets")} value={money(sheet.totalAssets)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
              <StatsCard label={t("Liabilities")} value={money(sheet.totalLiabilities)} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
              <StatsCard label={t("Equity")} value={money(sheet.totalEquity)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
            </div>
            <StatementTable>
              <Section title={t("Assets")} lines={sheet.assets} totalLabel="Total assets" total={sheet.totalAssets} onOpen={openLedger} money={money} />
              <Section title={t("Liabilities")} lines={sheet.liabilities} totalLabel="Total liabilities" total={sheet.totalLiabilities} onOpen={openLedger} money={money} />
              <Section title={t("Equity")} lines={sheet.equity} totalLabel="Total equity" total={sheet.totalEquity} onOpen={openLedger} money={money}
                extra={
                  <tr className="border-t border-slate-100 dark:border-gray-800">
                    <td className="px-4 py-2 pl-8 text-slate-700 dark:text-gray-200">
                      {t("Profit to date")}
                      <span className="block text-[11px] text-slate-400">{t("Income less expenses so far, until closed into retained earnings")}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-gray-200">{money(sheet.profitToDate)}</td>
                  </tr>
                } />
              <ResultRow label={t("Liabilities and equity")} amount={money(sheet.totalLiabilities + sheet.totalEquity)} strong />
              {sheet.unclassified.length > 0 && (
                <Section title={t("Accounts without a statement type")} lines={sheet.unclassified} totalLabel="Total (debit)"
                  total={sheet.unclassified.reduce((sum, line) => sum + Number(line.amount), 0)} onOpen={openLedger} money={money} />
              )}
            </StatementTable>
          </>
        )}

        {statement === "TB" && trial && (
          <>
            {trial.balanced ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t("Closing debits equal credits.")}</p>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t("Closing debits and credits differ by")} {money(Math.abs(trial.totalDebit - trial.totalCredit))}. Journal entries always
                balance, so check the accounts' opening balances in the <Link to="/generalAccounts" className="font-semibold underline">{t("Chart of Accounts")}</Link>.
              </p>
            )}
            <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-[#191919]">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#222] dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2" rowSpan={2}>{t("Account")}</th>
                    <th className="px-3 py-2" rowSpan={2}>{t("Type")}</th>
                    <th className="px-3 pt-2 text-center" colSpan={2}>{t("Opening")}</th>
                    <th className="px-3 pt-2 text-center" colSpan={2}>{t("Period")}</th>
                    <th className="px-3 pt-2 text-center" colSpan={2}>{t("Closing")}</th>
                  </tr>
                  <tr>
                    {["Debit", "Credit", "Debit", "Credit", "Debit", "Credit"].map((h, i) => (
                      <th key={i} className="px-3 pb-2 text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {trial.lines.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">{t("No balances or postings yet")}</td></tr>
                  )}
                  {trial.lines.map((line) => (
                    <tr key={line.accountId} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-[#222]" onClick={() => openLedger(line.accountId)}>
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{label(line)}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{labelOf(line.accountType)}</td>
                      {[line.openingDebit, line.openingCredit, line.periodDebit, line.periodCredit, line.closingDebit, line.closingCredit].map((value, i) => (
                        <td key={i} className={`px-3 py-2 text-right ${i >= 4 ? "font-medium text-slate-800 dark:text-gray-100" : "text-slate-600 dark:text-gray-300"}`}>
                          {Number(value) ? money(value) : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-gray-700 dark:bg-[#222]">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>{t("Total")}</td>
                    {[trialTotals.openingDebit, trialTotals.openingCredit, trialTotals.periodDebit, trialTotals.periodCredit, trial.totalDebit, trial.totalCredit].map((value, i) => (
                      <td key={i} className="px-3 py-2 text-right">{money(value)}</td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </section>
          </>
        )}

        <p className="text-xs text-slate-500">
          {t("From the ledger: postings made by invoices, receipts, bills, payments, credit and debit notes and stock, plus")}{" "}
          <Link to="/journalEntries" className="text-cyan-700 hover:underline">{t("journal entries")}</Link> and the accounts' opening balances.
          Click an account to see its ledger; <Link to="/postingAccounts" className="text-cyan-700 hover:underline">{t("Posting Accounts")}</Link> sets
          which accounts documents post to.
        </p>
      </div>
    </>
  );
};

const StatementTable: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-gray-800 dark:bg-[#191919]">
    <table className="w-full min-w-[480px] text-sm">
      <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-[#222] dark:text-gray-400">
        <tr>
          <th className="px-4 py-2">{t("Account")}</th>
          <th className="px-4 py-2 text-right">{t("Amount")}</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </section>
);

const Section: React.FC<{
  title: string;
  lines: StatementLine[];
  totalLabel: string;
  total: number;
  onOpen: (accountId: number) => void;
  money: (value?: number) => string;
  extra?: React.ReactNode;
}> = ({ title, lines, totalLabel, total, onOpen, money, extra }) => (
  <>
    <tr>
      <td colSpan={2} className="bg-slate-50/60 px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-[#1c1c1c] dark:text-gray-400">
        {title}
      </td>
    </tr>
    {lines.length === 0 && !extra && (
      <tr className="border-t border-slate-100 dark:border-gray-800">
        <td colSpan={2} className="px-4 py-2 pl-8 text-slate-400">{t("Nothing posted")}</td>
      </tr>
    )}
    {lines.map((line) => (
      <tr key={line.accountId} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-gray-800 dark:hover:bg-[#222]" onClick={() => onOpen(line.accountId)}>
        <td className="px-4 py-2 pl-8 text-slate-700 dark:text-gray-200">{label(line)}</td>
        <td className="px-4 py-2 text-right text-slate-700 dark:text-gray-200">{money(line.amount)}</td>
      </tr>
    ))}
    {extra}
    <tr className="border-t border-slate-200 dark:border-gray-700">
      <td className="px-4 py-2 font-medium text-slate-800 dark:text-gray-100">{totalLabel}</td>
      <td className="px-4 py-2 text-right font-medium text-slate-800 dark:text-gray-100">{money(total)}</td>
    </tr>
  </>
);

const ResultRow: React.FC<{ label: string; amount: string; strong?: boolean }> = ({ label: text, amount, strong }) => (
  <tr className={`border-t-2 border-slate-200 dark:border-gray-700 ${strong ? "text-base font-semibold" : "font-semibold"}`}>
    <td className="px-4 py-2">{text}</td>
    <td className={`px-4 py-2 text-right ${strong ? "text-cyan-700 dark:text-cyan-400" : ""}`}>{amount}</td>
  </tr>
);

export default FinancialStatements;
