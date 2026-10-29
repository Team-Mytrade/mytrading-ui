import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DocumentChartBarIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { CUSTOMER_FINANCIAL_API, INVOICE_API, apiError, dateLabel, daysOverdue, labelOf, money } from "./invoiceShared";
import { ArStatusBadge } from "./invoiceUi";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/accounts-receivable`;
const PAGE_SIZE = 10;

interface Receivable {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName?: string;
  originalAmount: number;
  amountPaid: number;
  balanceAmount: number;
  invoiceDate?: string;
  dueDate?: string;
  lastPaymentDate?: string;
  status: string;
}

interface Aging {
  totalOutstanding: number;
  buckets: { bucket: string; invoiceCount: number; outstandingAmount: number }[];
}

interface Summary {
  totalInvoiced: number;
  totalCreditNotes: number;
  totalCashReceived: number;
  totalCreditApplied: number;
  totalOutstanding: number;
  availableCustomerCredit: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
}

interface Statement {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  entries: {
    transactionDate: string;
    type: string;
    documentNumber?: string;
    referenceNumber?: string;
    description?: string;
    debit: number;
    credit: number;
    affectsBalance: boolean;
  }[];
}

const BUCKET_LABELS: Record<string, string> = {
  CURRENT: "Not due yet",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "Over 90 days",
};

const AccountsReceivable: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Receivable[]>([]);
  const [aging, setAging] = useState<Aging | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("OPEN_ONLY");

  const [statementFor, setStatementFor] = useState<{ customerId: number; customerName: string } | null>(null);
  const [range, setRange] = useState(() => ({ fromDate: `${new Date().getFullYear()}-01-01`, toDate: new Date().toISOString().slice(0, 10) }));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [listRes, agingRes] = await Promise.allSettled([axios.get<Receivable[]>(API_URL), axios.get<Aging>(`${API_URL}/aging`)]);
    if (listRes.status === "fulfilled") setRows(Array.isArray(listRes.value.data) ? listRes.value.data : []);
    else ToasterService.error(apiError(listRes.reason, "Failed to load receivables"));
    if (agingRes.status === "fulfilled") setAging(agingRes.value.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const loadStatement = useCallback(async (customerId: number, fromDate: string, toDate: string) => {
    setStatement(null);
    try {
      const [summaryRes, statementRes] = await Promise.all([
        axios.get<Summary>(`${CUSTOMER_FINANCIAL_API}/${customerId}/summary`),
        axios.get<Statement>(`${CUSTOMER_FINANCIAL_API}/${customerId}/statement`, { params: { fromDate, toDate } }),
      ]);
      setSummary(summaryRes.data);
      setStatement(statementRes.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the customer statement"));
    }
  }, []);

  const openStatement = (row: Receivable) => {
    setSummary(null);
    setStatementFor({ customerId: row.customerId, customerName: row.customerName || `Customer #${row.customerId}` });
    loadStatement(row.customerId, range.fromDate, range.toDate);
  };

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    if (statusFilter === "OPEN_ONLY") return rows.filter((row) => Number(row.balanceAmount) > 0 && row.status !== "CANCELLED");
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const columns: ColumnDef<Receivable>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      render: (row) => (
        <button type="button" onClick={() => navigate(`/invoices?invoiceId=${row.invoiceId}`)} className="text-sm font-semibold text-cyan-700 hover:underline">
          {row.invoiceNumber}
        </button>
      ),
    },
    { key: "customerName", label: "Customer", sortable: true, render: (row) => <span className="text-sm text-slate-700">{row.customerName || `Customer #${row.customerId}`}</span> },
    { key: "invoiceDate", label: "Invoiced", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.invoiceDate)}</span> },
    {
      key: "dueDate",
      label: "Due",
      sortable: true,
      render: (row) => {
        const late = Number(row.balanceAmount) > 0 && row.status !== "CANCELLED" ? daysOverdue(row.dueDate) : 0;
        return (
          <span className="text-sm text-slate-600">
            {dateLabel(row.dueDate)}
            {late > 0 && <span className="block text-xs font-semibold text-red-600">{late} days late</span>}
          </span>
        );
      },
    },
    { key: "originalAmount", label: "Amount", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm">{money(row.originalAmount)}</span> },
    { key: "amountPaid", label: "Paid", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm text-slate-600">{money(row.amountPaid)}</span> },
    { key: "balanceAmount", label: "Balance", sortable: true, headerClassName: "text-right", className: "text-right", render: (row) => <span className="text-sm font-semibold text-slate-900">{money(row.balanceAmount)}</span> },
    { key: "status", label: "Status", sortable: true, render: (row) => <ArStatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => openStatement(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Customer statement")}>
            <DocumentChartBarIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Accounts Receivable")} description="What customers owe, by invoice and age" />
      <PageBreadcrumb pageTitle="Accounts Receivable" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-blue-50 p-3">
            <div className="text-xs font-medium text-cyan-700">{t("Total outstanding")}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{money(aging?.totalOutstanding)}</div>
          </div>
          {(aging?.buckets ?? []).map((bucket) => (
            <div key={bucket.bucket} className={`rounded-xl border p-3 ${bucket.bucket === "CURRENT" ? "border-slate-200 bg-white" : "border-red-100 bg-red-50/40"}`}>
              <div className="text-xs font-medium text-slate-600">{BUCKET_LABELS[bucket.bucket] ?? bucket.bucket}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{money(bucket.outstandingAmount)}</div>
              <div className="text-xs text-slate-500">{bucket.invoiceCount} invoice{bucket.invoiceCount === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[["OPEN_ONLY", "Open"], ["OVERDUE", "Overdue"], ["PARTIALLY_PAID", "Partly paid"], ["PAID", "Paid"], ["CANCELLED", "Cancelled"], ["ALL", "All"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${statusFilter === value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          searchable
          searchPlaceholder={t("Search by invoice or customer…")}
          searchFields={["invoiceNumber", "customerName"]}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-1 text-sm text-gray-500">{t("Nothing to collect here")}</p>
              <p className="text-xs text-gray-400">{t("Receivables appear when invoices are issued.")}</p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={Boolean(statementFor)}
        title={`Statement · ${statementFor?.customerName ?? ""}`}
        subtitle={t("Invoices, payments and credits in the period, with the running balance")}
        onClose={() => setStatementFor(null)}
        maxWidthClassName="max-w-4xl"
        content={
          statementFor ? (
            <div className="max-h-[75dvh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {summary && (
                <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-slate-500">{t("Outstanding")}</dt><dd className="font-semibold text-slate-900">{money(summary.totalOutstanding)}</dd></div>
                  <div><dt className="text-xs text-slate-500">{t("Unused credit")}</dt><dd className="font-semibold text-slate-900">{money(summary.availableCustomerCredit)}</dd></div>
                  <div><dt className="text-xs text-slate-500">{t("Open invoices")}</dt><dd className="font-semibold text-slate-900">{summary.openInvoiceCount}</dd></div>
                  <div><dt className="text-xs text-slate-500">{t("Overdue invoices")}</dt><dd className="font-semibold text-red-600">{summary.overdueInvoiceCount}</dd></div>
                </dl>
              )}
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadStatement(statementFor.customerId, range.fromDate, range.toDate);
                }}
              >
                <div className="w-44"><FloatingInput label={t("From")} name="fromDate" type="date" value={range.fromDate} onChange={(event) => setRange((r) => ({ ...r, fromDate: event.target.value }))} /></div>
                <div className="w-44"><FloatingInput label={t("To")} name="toDate" type="date" value={range.toDate} onChange={(event) => setRange((r) => ({ ...r, toDate: event.target.value }))} /></div>
                <button type="submit" className="mb-1 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">{t("Show")}</button>
              </form>
              {!statement ? (
                <p className="text-sm text-slate-500">{t("Loading…")}</p>
              ) : (
                <StatementTable statement={statement} />
              )}
            </div>
          ) : undefined
        }
      />
    </>
  );
};

const StatementTable = ({ statement }: { statement: Statement }) => {
  let balance = Number(statement.openingBalance || 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">{t("Date")}</th>
            <th className="px-3 py-2 text-left">{t("Document")}</th>
            <th className="px-3 py-2 text-left">{t("Details")}</th>
            <th className="px-3 py-2 text-right">{t("Debit")}</th>
            <th className="px-3 py-2 text-right">{t("Credit")}</th>
            <th className="px-3 py-2 text-right">{t("Balance")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          <tr className="bg-slate-50/50">
            <td className="px-3 py-2" colSpan={5}>{t("Opening balance")}</td>
            <td className="px-3 py-2 text-right font-medium">{money(statement.openingBalance)}</td>
          </tr>
          {statement.entries.map((entry, index) => {
            if (entry.affectsBalance) balance += Number(entry.debit || 0) - Number(entry.credit || 0);
            return (
              <tr key={index} className={entry.affectsBalance ? "" : "text-slate-400"}>
                <td className="px-3 py-2">{dateLabel(entry.transactionDate)}</td>
                <td className="px-3 py-2">
                  <span className="font-medium">{entry.documentNumber}</span>
                  <span className="block text-xs text-slate-500">{labelOf(entry.type)}</span>
                </td>
                <td className="px-3 py-2">
                  {entry.description}
                  {entry.referenceNumber && <span className="block text-xs text-slate-500">{entry.referenceNumber}</span>}
                  {!entry.affectsBalance && <span className="block text-xs">{t("For information: already counted when the money was received")}</span>}
                </td>
                <td className="px-3 py-2 text-right">{Number(entry.debit) ? money(entry.debit) : ""}</td>
                <td className="px-3 py-2 text-right">{Number(entry.credit) ? money(entry.credit) : ""}</td>
                <td className="px-3 py-2 text-right font-medium">{entry.affectsBalance ? money(balance) : ""}</td>
              </tr>
            );
          })}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-3 py-2" colSpan={3}>{t("Closing balance")}</td>
            <td className="px-3 py-2 text-right">{money(statement.totalDebit)}</td>
            <td className="px-3 py-2 text-right">{money(statement.totalCredit)}</td>
            <td className="px-3 py-2 text-right">{money(statement.closingBalance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default AccountsReceivable;
