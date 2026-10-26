import React, { useEffect, useMemo, useState, FormEvent } from "react";
import axios from "axios";
import { BuildingOffice2Icon, ChartBarIcon, DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { formatEnumLabel } from "./invoiceEnums";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/accounts-receivable)   */
/* ------------------------------------------------------------------ */

interface Receivable {
  id: number;
  invoiceId?: number;
  invoiceNumber?: string;
  customerId?: number;
  customerCode?: string;
  customerName?: string;
  originalAmount?: number;
  amountPaid?: number;
  balanceAmount?: number;
  invoiceDate?: string;
  dueDate?: string;
  lastPaymentDate?: string;
  status?: string;
  createdDate?: string;
  updatedDate?: string;
}

/** GET /customer/{customerId}/outstanding */
interface OutstandingInvoice {
  invoiceId: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  originalAmount?: number;
  creditedAmount?: number;
  cashPaid?: number;
  creditApplied?: number;
  outstandingAmount?: number;
  status?: string;
  overdueDays?: number;
}

/** GET /aging?customerId=&asOfDate= */
interface AgingReport {
  asOfDate?: string;
  customerId?: number;
  totalOutstanding?: number;
  buckets?: { bucket: string; invoiceCount?: number; outstandingAmount?: number }[];
}

/** GET /v1/api/customer-financial/{customerId}/statement?fromDate=&toDate= */
interface CustomerStatement {
  openingBalance?: number;
  totalDebit?: number;
  totalCredit?: number;
  closingBalance?: number;
  entries?: {
    transactionDate?: string;
    type?: string;
    documentNumber?: string;
    referenceNumber?: string;
    description?: string;
    debit?: number;
    credit?: number;
    affectsBalance?: boolean;
  }[];
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/accounts-receivable";
const CUSTOMER_FINANCIAL_URL = "/v1/api/customer-financial";

/** First day of the month, 3 months back: a sensible default statement period. */
const threeMonthsAgo = () => {
  const [y, m] = todayIso().split("-").map(Number);
  const d = new Date(y, m - 1 - 3, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const PAGE_SIZE = 10;
// Status values from the Swagger (no enum API type for this list)
const STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];

const toneForStatus = (status?: string): StatsCardTone => {
  switch (status) {
    case "PAID":
      return "green";
    case "OPEN":
      return "blue";
    case "PARTIALLY_PAID":
      return "amber";
    case "OVERDUE":
    case "CANCELLED":
      return "red";
    default:
      return "slate";
  }
};

const BADGE_CLASS: Record<StatsCardTone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  blue: "bg-blue-50 text-blue-700 border-blue-200/40",
  amber: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  red: "bg-red-50 text-red-700 border-red-200/40",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200/40",
  slate: "bg-gray-50 text-gray-700 border-gray-200/40",
};

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

const statusLabel = (code?: string) => (code ? formatEnumLabel(code) : "--");

const customerText = (r: { customerCode?: string; customerName?: string; customerId?: number }) =>
  [r.customerCode, r.customerName].filter(Boolean).join(" – ") || (r.customerId ? `Customer #${r.customerId}` : "--");

const StatusBadge = ({ status }: { status?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[toneForStatus(status)]}`}>
    {statusLabel(status)}
  </span>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * Accounts receivable is created and updated by the backend from invoices and receipts.
 * The API is read-only, so this page shows the list, an aging report and a customer statement.
 */
const AccountsReceivable: React.FC = () => {
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Aging & customer statement popup
  const [showReport, setShowReport] = useState(false);
  const [reportCustomerId, setReportCustomerId] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [statement, setStatement] = useState<OutstandingInvoice[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // Full statement for one customer (customer-financial API)
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState("");
  const [fullStatement, setFullStatement] = useState<CustomerStatement | null>(null);

  /* ---------------- Load ---------------- */

  const fetchReceivables = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setReceivables(asArray<Receivable>(res.data).map((r) => ({ ...r, customerName: r.customerName })));
    } catch (err) {
      console.error("Error fetching accounts receivable", err);
      ToasterService.error("Failed to load accounts receivable");
      setReceivables([]);
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    fetchReceivables();
    // Toolbar Refresh icon reloads the list
    const reload = () => fetchReceivables();
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Customers found in the receivables list. */
  const customers = useMemo(() => {
    const map = new Map<number, string>();
    receivables.forEach((r) => r.customerId && !map.has(r.customerId) && map.set(r.customerId, customerText(r)));
    return [...map.entries()].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => a.label.localeCompare(b.label));
  }, [receivables]);

  /* ---------------- Cards: Total + one per status found ---------------- */

  const cards = useMemo<StatsCardOption<Receivable>[]>(() => {
    const present = new Set(receivables.map((r) => r.status).filter(Boolean) as string[]);
    const ordered = [...STATUSES.filter((s) => present.has(s)), ...[...present].filter((s) => !STATUSES.includes(s))];
    return [
      { key: "ALL", label: "Total Receivables", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: statusLabel(code),
        match: (r: Receivable) => r.status === code,
        tone: toneForStatus(code),
      })),
    ];
  }, [receivables]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(receivables, cards);

  /* ---------------- Aging & statement ---------------- */

  /** Opens the popup; from a row it is already set to that customer. */
  const openReport = (customerId?: number) => {
    setReportCustomerId(customerId ? String(customerId) : "");
    setAsOfDate(todayIso());
    setAging(null);
    setStatement(null);
    setFullStatement(null);
    setStmtFrom(threeMonthsAgo());
    setStmtTo(todayIso());
    setShowReport(true);
    if (customerId) loadReport(String(customerId), todayIso(), threeMonthsAgo(), todayIso());
  };

  const loadReport = async (customerId: string, date: string, from = stmtFrom, to = stmtTo) => {
    setReportLoading(true);
    try {
      const [agingRes, statementRes, fullRes] = await Promise.all([
        axios.get<AgingReport>(`${API_URL}/aging`, {
          params: { customerId: customerId ? Number(customerId) : undefined, asOfDate: date || undefined },
        }),
        customerId ? axios.get(`${API_URL}/customer/${customerId}/outstanding`) : Promise.resolve(null),
        customerId && from && to
          ? axios
              .get<CustomerStatement>(`${CUSTOMER_FINANCIAL_URL}/${customerId}/statement`, { params: { fromDate: from, toDate: to } })
              .catch((err) => {
                console.error("Error loading customer statement", err);
                ToasterService.error(apiError(err, "Failed to load the customer statement"));
                return null;
              })
          : Promise.resolve(null),
      ]);
      setAging(agingRes.data || null);
      setStatement(statementRes ? asArray<OutstandingInvoice>(statementRes.data) : null);
      setFullStatement(fullRes ? fullRes.data || null : null);
    } catch (err) {
      console.error("Error loading aging report", err);
      ToasterService.error(apiError(err, "Failed to load the aging report"));
    } finally {
      setReportLoading(false);
    }
  };

  const submitReport = (e: FormEvent) => {
    e.preventDefault();
    if (reportCustomerId && stmtFrom && stmtTo && stmtFrom > stmtTo) {
      ToasterService.error("Statement 'from' date must be before the 'to' date");
      return;
    }
    loadReport(reportCustomerId, asOfDate, stmtFrom, stmtTo);
  };

  /* ---------------- Table ---------------- */

  const money = (key: "originalAmount" | "amountPaid" | "balanceAmount", label: string, bold = false): ColumnDef<Receivable> => ({
    key,
    label,
    sortable: true,
    filterable: false,
    headerClassName: "text-right",
    className: "text-right",
    sortValueGetter: (r) => Number(r[key] || 0),
    detailFormatter: (r) => formatMoney(Number(r[key] || 0)),
    exportValueGetter: (r) => formatMoney(Number(r[key] || 0)),
    render: (r) => <span className={`text-sm ${bold ? "font-semibold text-slate-700" : "text-slate-600"}`}>{formatMoney(Number(r[key] || 0))}</span>,
  });

  const date = (key: "invoiceDate" | "dueDate" | "lastPaymentDate", label: string): ColumnDef<Receivable> => ({
    key,
    label,
    sortable: true,
    exportValueGetter: (r) => (r[key] ? formatDisplayDate(r[key] as string) : ""),
    render: (r) => <span className="text-sm text-slate-600">{r[key] ? formatDisplayDate(r[key] as string) : "--"}</span>,
  });

  const tableColumns: ColumnDef<Receivable>[] = [
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      sortValueGetter: (r) => customerText(r),
      exportValueGetter: (r) => customerText(r),
      render: (r) => <span className="block truncate text-sm font-semibold text-slate-900">{customerText(r)}</span>,
    },
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      render: (r) => <span className="text-sm text-slate-600">{r.invoiceNumber || "--"}</span>,
    },
    date("invoiceDate", "Invoice Date"),
    date("dueDate", "Due Date"),
    money("originalAmount", "Amount", true),
    money("amountPaid", "Paid"),
    money("balanceAmount", "Balance", true),
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterOptions: STATUSES.map((s) => ({ label: statusLabel(s), value: s })),
      detailFormatter: (r) => statusLabel(r.status),
      exportValueGetter: (r) => statusLabel(r.status),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[8%] text-right pr-4",
      className: "w-[8%] text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          {r.customerId && (
            <button
              type="button"
              onClick={() => openReport(r.customerId)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
              title="Customer statement & aging"
            >
              <DocumentMagnifyingGlassIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const statementTotal = (statement || []).reduce((sum, s) => sum + Number(s.outstandingAmount || 0), 0);

  return (
    <>
      <PageMeta title="Accounts Receivable" description="What customers owe, aging and statements" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Accounts Receivable"
        actions={
          <button
            type="button"
            onClick={() => openReport()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-800 dark:bg-gray-900 dark:text-cyan-300"
          >
            <ChartBarIcon className="h-4 w-4" />
            Aging Report
          </button>
        }
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="dueDate"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(r) => `Receivable – ${r.invoiceNumber || ""}`}
            rowDetailsSubtitle="Updated automatically from invoices and receipts"
            suspendRowDetails={showReport}
            rowDetailsActions={(r: Receivable) =>
              r.customerId ? (
                <button type="button" onClick={() => openReport(r.customerId)} className={ICON_BUTTON_CLASS} title="Customer statement & aging" aria-label="Customer statement and aging">
                  <DocumentMagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No receivables found</p>
                <p className="text-gray-400 text-xs">
                  {selected !== "ALL" ? "Click the selected card again to show all receivables" : "Receivables appear here when sales invoices are issued"}
                </p>
              </div>
            }
          />
        </div>

        {/* Aging (GET /aging) + customer statement (GET /customer/{id}/outstanding) */}
        <Dragger
          isOpen={showReport}
          variant="modal"
          title="Aging Report"
          subtitle="How long invoices have been unpaid. Choose a customer to also see their statement."
          onClose={() => setShowReport(false)}
          onSubmit={submitReport}
          submitting={reportLoading}
          submitLabel="Show Report"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SearchableSelect
              label="Customer"
              value={reportCustomerId}
              options={customers}
              onChange={(value: string | number) => setReportCustomerId(String(value ?? ""))}
              placeholder="All customers"
              emptyOptionLabel="All customers"
            />
            <FloatingDatePicker label="As of Date" name="asOfDate" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
            {/* Statement period: only for one customer */}
            {reportCustomerId && (
              <>
                <FloatingDatePicker label="Statement From" name="stmtFrom" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} maxDate={stmtTo || todayIso()} />
                <FloatingDatePicker label="Statement To" name="stmtTo" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} minDate={stmtFrom || undefined} maxDate={todayIso()} />
              </>
            )}
          </div>

          {aging && (
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
                <span>Total outstanding{aging.asOfDate ? ` as of ${formatDisplayDate(aging.asOfDate)}` : ""}</span>
                <strong>{formatMoney(Number(aging.totalOutstanding || 0))}</strong>
              </div>
              {aging.buckets?.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  {aging.buckets.map((b) => (
                    <div key={b.bucket} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                      <span className="block text-xs text-slate-500">{b.bucket}</span>
                      <strong className="block text-slate-800 dark:text-gray-100">{formatMoney(Number(b.outstandingAmount || 0))}</strong>
                      <span className="text-xs text-slate-400">
                        {b.invoiceCount || 0} invoice{b.invoiceCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Nothing outstanding.</p>
              )}
            </div>
          )}

          {statement && (
            <div>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Customer Statement – Unpaid Invoices</h4>
              {statement.length === 0 ? (
                <p className="text-sm text-slate-500">This customer has no unpaid invoices.</p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Due Date</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Credited</th>
                        <th className="px-3 py-2 text-right">Paid</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-3 py-2">Overdue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {statement.map((s) => (
                        <tr key={s.invoiceId}>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{s.invoiceNumber || `#${s.invoiceId}`}</td>
                          <td className="px-3 py-2 text-slate-600">{s.dueDate ? formatDisplayDate(s.dueDate) : "--"}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatMoney(Number(s.originalAmount || 0))}</td>
                          <td className="px-3 py-2 text-right text-slate-600">
                            {formatMoney(Number(s.creditedAmount || 0) + Number(s.creditApplied || 0))}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600">{formatMoney(Number(s.cashPaid || 0))}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{formatMoney(Number(s.outstandingAmount || 0))}</td>
                          <td className="px-3 py-2">
                            {Number(s.overdueDays || 0) > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border bg-red-50 text-red-700 border-red-200/40">
                                {s.overdueDays} day{s.overdueDays === 1 ? "" : "s"}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Not due</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-gray-800">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                          {statement.length} unpaid invoice{statement.length === 1 ? "" : "s"} · Total outstanding
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{formatMoney(statementTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
          {/* Full statement for the period (customer-financial API): every invoice, credit note and receipt */}
          {fullStatement && (
            <div className="mt-4">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Account Statement{stmtFrom && stmtTo ? ` – ${formatDisplayDate(stmtFrom)} to ${formatDisplayDate(stmtTo)}` : ""}
              </h4>
              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Opening balance", value: fullStatement.openingBalance },
                  { label: "Invoiced (debit)", value: fullStatement.totalDebit },
                  { label: "Received / credited", value: fullStatement.totalCredit },
                  { label: "Closing balance", value: fullStatement.closingBalance, strong: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
                    <span className="block text-xs text-slate-500">{s.label}</span>
                    <strong className={`text-sm ${s.strong ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-gray-200"}`}>{formatMoney(Number(s.value || 0))}</strong>
                  </div>
                ))}
              </div>
              {!fullStatement.entries?.length ? (
                <p className="text-sm text-slate-500">No transactions in this period.</p>
              ) : (
                <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Document</th>
                        <th className="px-3 py-2 text-right">Debit</th>
                        <th className="px-3 py-2 text-right">Credit</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {(() => {
                        // Running balance: opening + debit − credit (lines that don't affect the balance are shown greyed)
                        let running = Math.round(Number(fullStatement.openingBalance || 0) * 100);
                        return fullStatement.entries!.map((e, i) => {
                          if (e.affectsBalance !== false) running += Math.round(Number(e.debit || 0) * 100) - Math.round(Number(e.credit || 0) * 100);
                          return (
                            <tr key={i} className={e.affectsBalance === false ? "text-slate-400" : ""}>
                              <td className="whitespace-nowrap px-3 py-2">{e.transactionDate ? formatDisplayDate(e.transactionDate) : "--"}</td>
                              <td className="px-3 py-2">{statusLabel(e.type)}</td>
                              <td className="px-3 py-2">
                                <span className="block font-medium text-slate-800 dark:text-gray-100">{e.documentNumber || "--"}</span>
                                {(e.description || e.referenceNumber) && (
                                  <span className="block text-xs text-slate-400">{[e.description, e.referenceNumber].filter(Boolean).join(" · ")}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">{Number(e.debit || 0) > 0 ? formatMoney(Number(e.debit)) : ""}</td>
                              <td className="px-3 py-2 text-right">{Number(e.credit || 0) > 0 ? formatMoney(Number(e.credit)) : ""}</td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{formatMoney(running / 100)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Dragger>
      </div>

    </>
  );
};

export default AccountsReceivable;
