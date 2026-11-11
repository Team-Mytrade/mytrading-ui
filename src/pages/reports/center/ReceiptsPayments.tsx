import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { apiError, dateLabel, money } from "../../Invoice/invoiceShared";
import { ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, SelectField, TotalCard, count, initialPeriod, num, useSyncedParams } from "./reportKit";
import { BOOKS_API, sourceLabel, useBankAccounts } from "./booksShared";
import { t } from "../../../i18n/i18n";

interface Movement {
  date: string;
  entryId: number;
  entryNumber?: string | null;
  sourceModule: string;
  description?: string | null;
  bankAccountId: number;
  bankAccount?: string | null;
  against?: string | null;
  received: number;
  paid: number;
  transfer: boolean;
}

interface Report {
  rows: Movement[];
  categories: { sourceModule: string; received: number; paid: number; count: number }[];
  totals: { received: number; paid: number; net: number; transfers: number; receipts: number; payments: number };
}

type Row = Movement & { id: string };

const MODULES = ["INVOICE"];

/** Money in and out of every cash box and bank account (backlog 8.2.1.5), by what it was for. */
const ReceiptsPayments: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [accountId, setAccountId] = useState(params.get("bankAccountId") ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const accounts = useBankAccounts();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Report>(`${BOOKS_API}/receipts-payments`, {
        params: { from: period.from, to: period.to, bankAccountId: accountId || undefined },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the receipts and payments"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, accountId]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, bankAccountId: accountId });

  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r, i) => ({ ...r, id: `${r.entryId}-${r.bankAccountId}-${i}` })), [report]);
  const totals = report?.totals;
  const right = { sortable: true, headerClassName: "text-right", className: "text-right" };

  const columns: ColumnDef<Row>[] = [
    { key: "date", label: "Date", sortable: true, render: (r) => <span className="text-sm text-slate-700">{dateLabel(r.date)}</span> },
    {
      key: "sourceModule",
      label: "For",
      sortable: true,
      sortValueGetter: (r) => sourceLabel(r.sourceModule),
      render: (r) => (
        <span className="text-sm">
          <span className="text-slate-800">{r.transfer ? t("Transfer") : sourceLabel(r.sourceModule)}</span>
          <span className="block text-xs text-slate-500">{[r.entryNumber, r.description].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    { key: "bankAccount", label: "Cash box or bank", sortable: true, render: (r) => <span className="text-sm text-slate-700">{r.bankAccount ?? "—"}</span> },
    { key: "against", label: "Particulars", render: (r) => <span className="text-sm text-slate-600">{r.against ?? "—"}</span> },
    {
      key: "received",
      label: "Received",
      ...right,
      sortValueGetter: (r) => num(r.received),
      render: (r) => <span className={`text-sm ${r.transfer ? "text-slate-400" : "text-green-700"}`}>{num(r.received) === 0 ? "" : money(r.received)}</span>,
    },
    {
      key: "paid",
      label: "Paid",
      ...right,
      sortValueGetter: (r) => num(r.paid),
      render: (r) => <span className={`text-sm ${r.transfer ? "text-slate-400" : "text-red-600"}`}>{num(r.paid) === 0 ? "" : money(r.paid)}</span>,
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: "Date", value: (r) => (r.date ? dateLabel(r.date) : "") },
    { label: "For", value: (r) => (r.id === "totals" ? "" : r.transfer ? t("Transfer") : sourceLabel(r.sourceModule)) },
    { label: "Entry", value: (r) => r.entryNumber ?? "" },
    { label: "Description", value: (r) => r.description ?? "" },
    { label: "Cash box or bank", value: (r) => r.bankAccount ?? "" },
    { label: "Particulars", value: (r) => r.against ?? "" },
    { label: "Received", value: (r) => num(r.received), format: "money" },
    { label: "Paid", value: (r) => num(r.paid), format: "money" },
  ];
  const totalsRow = totals
    ? ({ id: "totals", date: "", entryId: 0, entryNumber: t("Total"), sourceModule: "", bankAccountId: 0, transfer: false, received: totals.received, paid: totals.paid } as Row)
    : undefined;
  const details = accountId ? [{ label: "Cash box or bank", value: accounts.find((a) => String(a.id) === accountId)?.accountName ?? `#${accountId}` }] : [];

  return (
    <>
      <PageMeta title={t("Receipts & Payments")} description="Money in and out of every cash box and bank account" />
      <PageBreadcrumb pageTitle="Receipts & Payments" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Receipts & Payments", period, columns: exportColumns, rows, totals: totalsRow, details }} />}
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {accounts.length > 0 && (
            <SelectField label="Cash box or bank" value={accountId} options={accounts.map((a) => ({ value: String(a.id), label: a.accountName }))} allLabel="All cash and bank" onChange={setAccountId} />
          )}
        </FilterBar>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TotalCard label="Received" tone="green" value={money(totals?.received)} hint={count(totals?.receipts, "receipt", "receipts")} />
          <TotalCard label="Paid" tone="red" value={money(totals?.paid)} hint={count(totals?.payments, "payment", "payments")} />
          <TotalCard label="Net" tone="cyan" value={money(totals?.net)} hint={t("Received less paid")} />
          <TotalCard label="Transfers" value={money(totals?.transfers)} hint={t("Between your own accounts, not counted")} />
        </div>

        {(report?.categories ?? []).length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">{t("By what it was for")}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-500">
                  <th className="pb-2 text-start font-medium">{t("For")}</th>
                  <th className="pb-2 text-end font-medium">{t("Received")}</th>
                  <th className="pb-2 text-end font-medium">{t("Paid")}</th>
                  <th className="pb-2 text-end font-medium">{t("Lines")}</th>
                </tr>
              </thead>
              <tbody>
                {report?.categories.map((c) => (
                  <tr key={c.sourceModule} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-800">{sourceLabel(c.sourceModule)}</td>
                    <td className="py-1.5 text-end text-green-700">{num(c.received) === 0 ? "—" : money(c.received)}</td>
                    <td className="py-1.5 text-end text-red-600">{num(c.paid) === 0 ? "—" : money(c.paid)}</td>
                    <td className="py-1.5 text-end text-slate-600">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <p className="text-xs text-slate-500">
          {t("Every posting to a cash box's or bank account's ledger account in the period, in the company currency. Money moved between two of your own accounts is a transfer: listed, but not counted as received or paid.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={50}
          loading={loading}
          searchable
          searchFields={["entryNumber", "description", "against", "bankAccount"]}
          searchPlaceholder={t("Search entries")}
          defaultSortKey="date"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ArrowsRightLeftIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default ReceiptsPayments;
