import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { CheckCircleIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { formatEnumLabel, toSelectOptions, useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/expenses-revenue)      */
/* ------------------------------------------------------------------ */

interface GeneralAccount {
  id: number;
  accountCode?: string;
  accountName?: string;
  accountType?: string;
  isActive?: boolean;
  allowTransactions?: boolean;
}


interface ExpenseRevenueItem {
  id: number;
  revenueExpenseType?: string;
  revenueExpenseCategory?: string;
  description?: string;
  amount?: number;
  transactionDate?: string;
  generalAccount?: GeneralAccount;
  paymentMethod?: string;
  referenceNumber?: string;
  // Filled for the table, search and export
  accountText?: string;
}

/** POST body: only the editable fields; the account is sent as { id }. */
interface CreateItemPayload {
  revenueExpenseType: string;
  revenueExpenseCategory?: string;
  description: string;
  amount: number;
  transactionDate: string;
  generalAccount?: { id: number };
  paymentMethod?: string;
  referenceNumber?: string;
}

type ItemForm = {
  revenueExpenseType?: string;
  revenueExpenseCategory?: string;
  description?: string;
  amount?: string;
  transactionDate?: string;
  generalAccountId?: string;
  paymentMethod?: string;
  referenceNumber?: string;
};

type ReportKind = "PERIOD" | "MONTHLY";

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/expenses-revenue";
const ACCOUNTS_URL = "/v1/api/invoice/general-accounts";
const PAGE_SIZE = 10;

const TYPE_FALLBACK = ["EXPENSE", "REVENUE", "TRANSFER", "ADJUSTMENT", "CREDIT_NOTE", "DEBIT_NOTE", "REFUND", "CHARGEBACK", "WRITE_OFF", "OTHER"];
const CATEGORY_FALLBACK = ["RENT", "FREIGHT", "MISC", "SALARY", "UTILITIES", "OFFICE_SUPPLIES", "MAINTENANCE", "TRAVEL", "ENTERTAINMENT", "ADVERTISING", "INSURANCE", "TAXES", "DEPRECIATION", "INTEREST", "OTHER"];

// No enum API for payment methods, so the list stays here
const PAYMENT_METHODS = [
  { code: "CASH", label: "Cash" },
  { code: "BANK_TRANSFER", label: "Bank Transfer" },
  { code: "CHECK", label: "Cheque" },
  { code: "CREDIT_CARD", label: "Credit Card" },
  { code: "OTHER", label: "Other" },
];
const methodLabel = (code?: string) => PAYMENT_METHODS.find((m) => m.code === code)?.label || code || "--";

const TYPE_TONE: Record<string, StatsCardTone> = {
  EXPENSE: "red",
  REVENUE: "green",
  REFUND: "blue",
  TRANSFER: "cyan",
  ADJUSTMENT: "amber",
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

const accountText = (a?: GeneralAccount) =>
  a ? [a.accountCode, a.accountName].filter(Boolean).join(" – ") || `Account ${a.id}` : "--";

/** Shows a number as ₹, anything else as text. */
const showValue = (value: unknown) =>
  typeof value === "number" ? formatMoney(value) : value == null || value === "" ? "--" : String(value);

/** Report keys like "OFFICE_SUPPLIES" or "totalAmount" as readable text. */
const keyLabel = (key: string) =>
  /^[A-Z0-9_]+$/.test(key) ? formatEnumLabel(key) : key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * Items can be added and viewed; the API has no edit or delete.
 * Reports: period list + summary (GET /type/from/to and /summary) and monthly report (GET /report).
 */
const ExpenseRevenue: React.FC = () => {
  const { canCreate } = usePermissions();

  const [items, setItems] = useState<ExpenseRevenueItem[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const types = useInvoiceEnum("REVENUE_EXPENSE_TYPE", TYPE_FALLBACK);
  const categories = useInvoiceEnum("REVENUE_EXPENSE_CATEGORY", CATEGORY_FALLBACK);
  const typeLabel = (code?: string) => types.find((t) => t.code === code)?.label || (code ? formatEnumLabel(code) : "--");
  const categoryLabel = (code?: string) => categories.find((c) => c.code === code)?.label || (code ? formatEnumLabel(code) : "--");

  // Create
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ItemForm>({});
  const [submitting, setSubmitting] = useState(false);

  // Reports
  const [showReport, setShowReport] = useState(false);
  const [reportKind, setReportKind] = useState<ReportKind>("PERIOD");
  const [period, setPeriod] = useState<{ type: string; from: string; to: string }>({ type: "EXPENSE", from: "", to: "" });
  const [monthly, setMonthly] = useState<{ year: string; month: string }>({ year: "", month: "" });
  const [periodItems, setPeriodItems] = useState<ExpenseRevenueItem[] | null>(null);
  const [periodSummary, setPeriodSummary] = useState<Record<string, number> | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setItems(asArray<ExpenseRevenueItem>(res.data).map((i) => ({ ...i, accountText: accountText(i.generalAccount) })));
    } catch (err) {
      console.error("Error fetching expenses and revenue", err);
      ToasterService.error("Failed to load expenses and revenue");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = () =>
    axios
      .get(ACCOUNTS_URL)
      .then((r) => setAccounts(asArray<GeneralAccount>(r.data)))
      .catch(() => ToasterService.error("Failed to load accounts"));

  useEffect(() => {
    fetchItems();
    fetchAccounts();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchItems();
      fetchAccounts();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Cards: Total + one per type found ---------------- */

  const cards = useMemo<StatsCardOption<ExpenseRevenueItem>[]>(() => {
    const present = new Set(items.map((i) => i.revenueExpenseType).filter(Boolean) as string[]);
    const ordered = [
      ...types.map((t) => t.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !types.some((t) => t.code === code)),
    ].slice(0, 5);
    return [
      { key: "ALL", label: "Total Items", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: typeLabel(code),
        match: (i: ExpenseRevenueItem) => i.revenueExpenseType === code,
        tone: TYPE_TONE[code] || "slate",
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, types]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(items, cards);

  /* ---------------- Create ---------------- */

  const openCreate = () => {
    setForm({ revenueExpenseType: "EXPENSE", transactionDate: todayIso(), paymentMethod: "BANK_TRANSFER" });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({});
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    const description = form.description?.trim() || "";
    if (!form.revenueExpenseType) return ToasterService.error("Type is required");
    if (!Number.isFinite(amount) || amount <= 0) return ToasterService.error("Amount must be more than 0");
    if (!form.transactionDate) return ToasterService.error("Transaction date is required");
    if (!description) return ToasterService.error("Description is required");

    const payload: CreateItemPayload = {
      revenueExpenseType: form.revenueExpenseType,
      revenueExpenseCategory: form.revenueExpenseCategory || undefined,
      description,
      amount,
      transactionDate: form.transactionDate,
      generalAccount: form.generalAccountId ? { id: Number(form.generalAccountId) } : undefined,
      paymentMethod: form.paymentMethod || undefined,
      referenceNumber: form.referenceNumber?.trim() || undefined,
    };
    setSubmitting(true);
    try {
      await axios.post(API_URL, payload);
      ToasterService.success(`${typeLabel(payload.revenueExpenseType)} of ${formatMoney(amount)} added`);
      closeForm();
      fetchItems();
    } catch (err) {
      console.error("Error creating expense/revenue item", err);
      ToasterService.error(apiError(err, "Failed to save item"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Reports ---------------- */

  const openReport = () => {
    const today = todayIso();
    setPeriod({ type: "EXPENSE", from: `${today.slice(0, 8)}01`, to: today }); // this month
    setMonthly({ year: today.slice(0, 4), month: String(Number(today.slice(5, 7))) });
    setPeriodItems(null);
    setPeriodSummary(null);
    setMonthlyReport(null);
    setShowReport(true);
  };

  const runReport = async (e: FormEvent) => {
    e.preventDefault();
    setReportLoading(true);
    try {
      if (reportKind === "PERIOD") {
        if (!period.type || !period.from || !period.to) return ToasterService.error("Choose a type and both dates");
        if (period.from > period.to) return ToasterService.error("From date cannot be after To date");
        const params = { type: period.type, from: period.from, to: period.to };
        const [list, summary] = await Promise.all([
          axios.get(`${API_URL}/type/from/to`, { params }),
          axios.get<Record<string, number>>(`${API_URL}/summary`, { params }),
        ]);
        setPeriodItems(asArray<ExpenseRevenueItem>(list.data));
        setPeriodSummary(summary.data && typeof summary.data === "object" ? summary.data : {});
      } else {
        if (!monthly.year || !monthly.month) return ToasterService.error("Choose a year and month");
        const res = await axios.get<Record<string, unknown>>(`${API_URL}/report`, {
          params: { year: Number(monthly.year), month: Number(monthly.month) },
        });
        setMonthlyReport(res.data && typeof res.data === "object" ? res.data : {});
      }
    } catch (err) {
      console.error("Error loading report", err);
      ToasterService.error(apiError(err, "Failed to load report"));
    } finally {
      setReportLoading(false);
    }
  };

  const periodTotal = (periodItems || []).reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const currentYear = Number(todayIso().slice(0, 4));

  /* ---------------- Table ---------------- */


  const tableColumns: ColumnDef<ExpenseRevenueItem>[] = [
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (i) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircleIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">{i.description || "--"}</span>
        </div>
      ),
    },
    {
      key: "revenueExpenseType",
      label: "Type",
      sortable: true,
      filterOptions: types.map((t) => ({ label: t.label, value: t.code })),
      detailFormatter: (i) => typeLabel(i.revenueExpenseType),
      exportValueGetter: (i) => typeLabel(i.revenueExpenseType),
      render: (i) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[TYPE_TONE[i.revenueExpenseType || ""] || "slate"]}`}>
          {typeLabel(i.revenueExpenseType)}
        </span>
      ),
    },
    {
      key: "revenueExpenseCategory",
      label: "Category",
      sortable: true,
      filterOptions: categories.map((c) => ({ label: c.label, value: c.code })),
      detailFormatter: (i) => categoryLabel(i.revenueExpenseCategory),
      exportValueGetter: (i) => categoryLabel(i.revenueExpenseCategory),
      render: (i) => <span className="text-sm text-slate-600">{categoryLabel(i.revenueExpenseCategory)}</span>,
    },
    {
      key: "accountText",
      label: "Account",
      sortable: true,
      render: (i) => <span className="block truncate text-sm text-slate-600">{i.accountText}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      filterable: false,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (i) => Number(i.amount || 0),
      detailFormatter: (i) => formatMoney(Number(i.amount || 0)),
      exportValueGetter: (i) => formatMoney(Number(i.amount || 0)),
      render: (i) => <span className="text-sm font-semibold text-slate-700">{formatMoney(Number(i.amount || 0))}</span>,
    },
    {
      key: "transactionDate",
      label: "Date",
      sortable: true,
      exportValueGetter: (i) => (i.transactionDate ? formatDisplayDate(i.transactionDate) : ""),
      render: (i) => <span className="text-sm text-slate-600">{i.transactionDate ? formatDisplayDate(i.transactionDate) : "--"}</span>,
    },
    {
      key: "paymentMethod",
      label: "Method",
      sortable: true,
      filterOptions: PAYMENT_METHODS.map((m) => ({ label: m.label, value: m.code })),
      detailFormatter: (i) => methodLabel(i.paymentMethod),
      exportValueGetter: (i) => methodLabel(i.paymentMethod),
      render: (i) => <span className="text-sm text-slate-600">{methodLabel(i.paymentMethod)}</span>,
    },
    {
      key: "referenceNumber",
      label: "Reference",
      sortable: true,
      render: (i) => <span className="block truncate text-sm text-slate-600">{i.referenceNumber || "--"}</span>,
    },
  ];

  const keyValueTable = (data: Record<string, unknown>) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td className="px-3 py-2 text-slate-600 dark:text-gray-300">{keyLabel(key)}</td>
              <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{showValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageMeta title="Expenses & Revenue" description="Expenses, revenue and reports" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Expenses & Revenue"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openReport}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-800 dark:bg-gray-900 dark:text-cyan-300"
            >
              <ChartBarIcon className="h-4 w-4" />
              Reports
            </button>
            {canCreate && <AddButton className="-mr-5" label="Add ExpenseRevenueItem" onClick={openCreate} />}
          </div>
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
            defaultSortKey="transactionDate"
            defaultSortOrder="desc"
            loading={isLoading}
            rowDetailsTitle={(i) => i.description || "Expense / Revenue"}
            rowDetailsSubtitle="Items cannot be edited after saving"
            // The nested account object is long; its code and name are shown in the Account column
            hiddenDetailKeys={["generalAccount"]}
            suspendRowDetails={showForm || showReport}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircleIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No expense or revenue items found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all items</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                      Create your first item
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Add item */}
        <Dragger
          isOpen={showForm}
          title="Add Expense / Revenue"
          subtitle="Items cannot be edited after saving"
          onClose={closeForm}
          onSubmit={handleCreate}
          submitting={submitting}
          submitLabel="Create"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FloatingSelect
              label="Type"
              name="revenueExpenseType"
              value={form.revenueExpenseType || ""}
              onChange={(e) => setForm({ ...form, revenueExpenseType: e.target.value })}
              options={toSelectOptions(types)}
              required
            />
            <FloatingSelect
              label="Category"
              name="revenueExpenseCategory"
              value={form.revenueExpenseCategory || ""}
              onChange={(e) => setForm({ ...form, revenueExpenseCategory: e.target.value })}
              options={toSelectOptions(categories)}
            />
            <FloatingInput
              label="Amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.amount || ""}
              onChange={handleChange}
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
              onWheel={(e) => e.currentTarget.blur()}
              required
            />
            <FloatingDatePicker label="Transaction Date" name="transactionDate" value={form.transactionDate || ""} onChange={handleChange} maxDate={todayIso()} required />
            <SearchableSelect
              label="General Account"
              value={form.generalAccountId || ""}
              options={accounts
                .filter((a) => a.isActive !== false && a.allowTransactions !== false)
                .map((a) => ({ value: String(a.id), label: accountText(a), keywords: [a.accountCode || ""] }))}
              onChange={(value: string | number) => setForm({ ...form, generalAccountId: String(value ?? "") })}
              placeholder={accounts.length ? "Search account" : "No accounts loaded"}
              emptyOptionLabel="None"
            />
            <FloatingSelect
              label="Payment Method"
              name="paymentMethod"
              value={form.paymentMethod || ""}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              options={PAYMENT_METHODS.map((m) => ({ id: m.code, name: m.label }))}
            />
            <div className="md:col-span-2">
              <FloatingInput label="Reference Number" name="referenceNumber" value={form.referenceNumber || ""} onChange={handleChange} maxLength={100} />
            </div>
            <div className="md:col-span-2">
              <FloatingTextarea label="Description" name="description" rows={2} value={form.description || ""} onChange={handleChange} required />
            </div>
          </div>
        </Dragger>

        {/* Reports */}
        <Dragger
          isOpen={showReport}
          variant="modal"
          title="Expense & Revenue Reports"
          subtitle="Totals for a period or a month"
          onClose={() => setShowReport(false)}
          onSubmit={runReport}
          submitting={reportLoading}
          submitLabel="Show Report"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FloatingSelect
                label="Report"
                name="reportKind"
                value={reportKind}
                includeEmptyOption={false}
                onChange={(e) => setReportKind(e.target.value as ReportKind)}
                options={[
                  { id: "PERIOD", name: "By type and date range" },
                  { id: "MONTHLY", name: "Monthly report" },
                ]}
              />
            </div>

            {reportKind === "PERIOD" ? (
              <>
                <div className="md:col-span-2">
                  <FloatingSelect
                    label="Type"
                    name="periodType"
                    value={period.type}
                    includeEmptyOption={false}
                    onChange={(e) => setPeriod({ ...period, type: e.target.value })}
                    options={toSelectOptions(types)}
                  />
                </div>
                <FloatingDatePicker label="From" name="from" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} maxDate={period.to || undefined} required />
                <FloatingDatePicker label="To" name="to" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} minDate={period.from || undefined} required />
              </>
            ) : (
              <>
                <FloatingSelect
                  label="Year"
                  name="year"
                  value={monthly.year}
                  includeEmptyOption={false}
                  onChange={(e) => setMonthly({ ...monthly, year: e.target.value })}
                  options={Array.from({ length: 6 }, (_, k) => String(currentYear - k)).map((y) => ({ id: y, name: y }))}
                />
                <FloatingSelect
                  label="Month"
                  name="month"
                  value={monthly.month}
                  includeEmptyOption={false}
                  onChange={(e) => setMonthly({ ...monthly, month: e.target.value })}
                  options={MONTHS.map((m, k) => ({ id: String(k + 1), name: m }))}
                />
              </>
            )}
          </div>

          {/* Period results: summary (GET /summary) + items (GET /type/from/to) */}
          {reportKind === "PERIOD" && periodItems && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
                <span>
                  {periodItems.length} {typeLabel(period.type).toLowerCase()} item{periodItems.length === 1 ? "" : "s"}
                </span>
                <strong>{formatMoney(periodTotal)}</strong>
              </div>
              {periodSummary && Object.keys(periodSummary).length > 0 && keyValueTable(periodSummary)}
              {periodItems.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {periodItems.map((i) => (
                        <tr key={i.id}>
                          <td className="px-3 py-2 text-slate-600">{i.transactionDate ? formatDisplayDate(i.transactionDate) : "--"}</td>
                          <td className="px-3 py-2 text-slate-700 dark:text-gray-200">{i.description || "--"}</td>
                          <td className="px-3 py-2 text-slate-600">{categoryLabel(i.revenueExpenseCategory)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatMoney(Number(i.amount || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Monthly results (GET /report): each section shown as a small table */}
          {reportKind === "MONTHLY" && monthlyReport && (
            Object.keys(monthlyReport).length === 0 ? (
              <p className="text-sm text-slate-500">No data for this month.</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(monthlyReport).map(([section, value]) => (
                  <div key={section}>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{keyLabel(section)}</h4>
                    {value && typeof value === "object" && !Array.isArray(value)
                      ? keyValueTable(value as Record<string, unknown>)
                      : keyValueTable({ [section]: value })}
                  </div>
                ))}
              </div>
            )
          )}
        </Dragger>
      </div>

    </>
  );
};

export default ExpenseRevenue;
