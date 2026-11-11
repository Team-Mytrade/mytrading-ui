import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, SelectField, TotalCard, count, initialPeriod, num, useSyncedParams } from "./reportKit";
import { BOOKS_API, sourceLabel, useBankAccounts } from "./booksShared";
import { t } from "../../../i18n/i18n";

interface BookRow {
  date: string;
  entryId: number;
  entryNumber?: string | null;
  sourceModule?: string | null;
  description?: string | null;
  against?: string | null;
  received: number;
  paid: number;
  balance: number;
  receivedInCurrency?: number | null;
  paidInCurrency?: number | null;
  balanceInCurrency?: number | null;
}

interface Book {
  accountName: string;
  kind: "BANK" | "CASH";
  currency?: string | null;
  ledgerCode?: string | null;
  opening: number;
  received: number;
  paid: number;
  closing: number;
  openingInCurrency?: number | null;
  closingInCurrency?: number | null;
  foreign: boolean;
  rows: BookRow[];
}

type Row = BookRow & { id: string };

const MODULES = ["INVOICE"];

/** One cash box's or bank account's lines with a running balance (backlog 8.2.1.5): the cash book and the bank book. */
const CashBankBook: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [accountId, setAccountId] = useState(params.get("bankAccountId") ?? "");
  const [report, setReport] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const accounts = useBankAccounts();

  // The default cash box or bank account until one is chosen
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      const first = accounts.find((a) => a.defaultAccount && a.active) ?? accounts.find((a) => a.active) ?? accounts[0];
      setAccountId(String(first.id));
    }
  }, [accounts, accountId]);

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      const res = await axios.get<Book>(`${BOOKS_API}/cash-bank`, {
        params: { bankAccountId: accountId, from: period.from, to: period.to },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the book"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, bankAccountId: accountId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r, i) => ({ ...r, id: `${r.entryId}-${i}` })), [report]);
  const foreign = !!report?.foreign;
  const currency = report?.currency ?? undefined;
  const title = report?.kind === "CASH" ? "Cash Book" : "Bank Book";
  const options = accounts.map((a) => ({ value: String(a.id), label: `${a.accountName}${a.kind === "CASH" ? ` (${t("Cash")})` : ""}${a.active ? "" : ` · ${t("Inactive")}`}` }));

  const amount = (base: number, own?: number | null) => (
    <span className="text-sm">
      <span className="text-slate-800">{num(base) === 0 ? "" : money(base)}</span>
      {foreign && num(own) !== 0 && <span className="block text-xs text-slate-500">{money(own, currency)}</span>}
    </span>
  );
  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };
  const columns: ColumnDef<Row>[] = [
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    {
      key: "description",
      label: "Particulars",
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-800">{r.against ?? "—"}</span>
          <span className="block text-xs text-slate-500">{[r.entryNumber, sourceLabel(r.sourceModule), r.description].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    { key: "received", label: "Received", ...right, sortValueGetter: (r) => num(r.received), render: (r) => amount(r.received, r.receivedInCurrency) },
    { key: "paid", label: "Paid", ...right, sortValueGetter: (r) => num(r.paid), render: (r) => amount(r.paid, r.paidInCurrency) },
    {
      key: "balance",
      label: "Balance",
      headerClassName: "text-right",
      className: "text-right",
      render: (r) => (
        <span className="text-sm">
          <span className={`font-semibold ${num(r.balance) < 0 ? "text-red-600" : "text-slate-900"}`}>{money(r.balance)}</span>
          {foreign && <span className="block text-xs text-slate-500">{money(r.balanceInCurrency, currency)}</span>}
        </span>
      ),
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Date", value: (r) => (r.date ? dateLabel(r.date) : "") },
    { label: "Entry", value: (r) => r.entryNumber ?? "" },
    { label: "Particulars", value: (r) => r.against ?? "" },
    { label: "Description", value: (r) => r.description ?? "" },
    { label: "Received", value: (r) => num(r.received), format: "money" },
    { label: "Paid", value: (r) => num(r.paid), format: "money" },
    { label: "Balance", value: (r) => num(r.balance), format: "money" },
    ...(foreign ? [{ label: `${t("Balance")} (${currency})`, value: (r: Row) => num(r.balanceInCurrency), format: "money" } as ReportColumn<Row>] : []),
  ];
  // The export starts with the opening balance and ends with the totals
  const exportRows: Row[] = report
    ? [{ id: "opening", date: "", entryId: 0, entryNumber: t("Opening balance"), received: 0, paid: 0, balance: report.opening, balanceInCurrency: report.openingInCurrency } as Row, ...rows]
    : rows;
  const totalsRow = report
    ? ({ id: "totals", date: "", entryId: 0, entryNumber: t("Total"), received: report.received, paid: report.paid, balance: report.closing, balanceInCurrency: report.closingInCurrency } as Row)
    : undefined;
  const details = report ? [{ label: "Account", value: `${report.accountName}${report.ledgerCode ? ` (${report.ledgerCode})` : ""}` }] : [];

  return (
    <>
      <PageMeta title={t("Cash & Bank Book")} description="A cash box's or bank account's money in and out with its balance" />
      <PageBreadcrumb pageTitle="Cash & Bank Book" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={
            <ExportButtons modules={MODULES} disabled={loading || !report} report={{ title: report ? `${t(title)} — ${report.accountName}` : title, period, columns: exportColumns, rows: exportRows, totals: totalsRow, details }} />
          }
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {options.length > 0 && <SelectField label="Cash box or bank" value={accountId} options={options} allLabel="Choose one" onChange={setAccountId} />}
        </FilterBar>

        {accounts.length === 0 && !loading && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("No cash box or bank account yet.")}{" "}
            <Link to="/bankAccounts" className="font-medium underline">
              {t("Bank & Cash")}
            </Link>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Opening balance" value={money(report?.opening)} hint={foreign ? money(report?.openingInCurrency, currency) : dateLabel(period.from)} />
          <TotalCard label="Received" tone="green" value={money(report?.received)} hint={count(rows.filter((r) => num(r.received) > 0).length, "receipt", "receipts")} />
          <TotalCard label="Paid" tone="red" value={money(report?.paid)} hint={count(rows.filter((r) => num(r.paid) > 0).length, "payment", "payments")} />
          <TotalCard label="Closing balance" tone="cyan" value={money(report?.closing)} hint={foreign ? money(report?.closingInCurrency, currency) : dateLabel(period.to)} />
        </div>

        <p className="text-xs text-slate-500">
          {t("Every posting to the account's ledger account in the period, oldest first, with the balance after each. Particulars are the other accounts of the entry. Amounts are in the company currency; an account in another currency also shows its own.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={50}
          loading={loading}
          searchable
          searchFields={["entryNumber", "description", "against"]}
          searchPlaceholder={t("Search entries")}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BanknotesIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default CashBankBook;
