import React, { useEffect, useMemo, useState, FormEvent } from "react";
import axios from "axios";
import { CreditCardIcon, ChartBarIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { formatEnumLabel, toSelectOptions, useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/tax-record)            */
/* ------------------------------------------------------------------ */

interface TaxType {
  id: number;
  taxName?: string;
  taxRate?: number;
  region?: string;
  isActive?: boolean;
}

interface TaxRecord {
  id: number;
  transactionType?: string;
  sourceId?: number;
  sourceModule?: string;
  taxType?: TaxType;
  taxableAmount?: number;
  /** Worked out by the backend from the tax type's rate. */
  taxAmount?: number;
  /** Set by the backend. */
  transactionDate?: string;
  glEntry?: { id: number; journalEntry?: { entryNumber?: string } };
  // Filled for the table, search and export
  taxTypeName?: string;
  journalEntryNumber?: string;
}

/** Body of POST /tax-record/record. The date and tax amount are set by the backend. */
interface CreateTaxRecordPayload {
  sourceModule: string;
  sourceId?: number;
  transactionType: string;
  taxTypeId: number;
  taxableAmount: number;
}

interface SourceDocument {
  id: number;
  invoiceNumber?: string;
}

type TaxForm = {
  sourceModule?: string;
  sourceId?: string;
  transactionType?: string;
  taxTypeId?: string;
  taxableAmount?: string;
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/tax-record";
const TAX_TYPES_URL = "/v1/api/invoice/tax-types";
/** Lists used to pick the source document by its number instead of typing an id. */
const SOURCE_LISTS: Record<string, string> = {
  SALES_INVOICE: "/v1/api/invoice/invoices",
  PURCHASE_INVOICE: "/v1/api/invoice/purchase-invoices",
};
const PAGE_SIZE = 10;

const SOURCE_MODULE_FALLBACK = ["SALES_INVOICE", "PURCHASE_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "ADJUSTMENT_NOTE", "OTHER"];
const TRANSACTION_TYPE_FALLBACK = ["SALE", "PURCHASE", "OTHER"];

const TYPE_TONE: Record<string, StatsCardTone> = { SALE: "green", PURCHASE: "blue" };

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

const taxTypeText = (t?: TaxType) =>
  t ? [t.taxName || `Tax ${t.id}`, t.taxRate != null ? `${t.taxRate}%` : ""].filter(Boolean).join(" – ") : "--";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * Tax records are an audit trail: they can be added and viewed, never edited or deleted
 * (the API has no PUT or DELETE). The tax amount and date are set by the backend.
 */
const TaxRecords: React.FC = () => {
  const { canCreate } = usePermissions();

  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [sourceDocs, setSourceDocs] = useState<Record<string, SourceDocument[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const sourceModules = useInvoiceEnum("SOURCE_MODULE", SOURCE_MODULE_FALLBACK);
  const transactionTypes = useInvoiceEnum("TRANSACTION_TYPE", TRANSACTION_TYPE_FALLBACK);
  const moduleLabel = (code?: string) => sourceModules.find((s) => s.code === code)?.label || (code ? formatEnumLabel(code) : "--");
  const typeLabel = (code?: string) => transactionTypes.find((s) => s.code === code)?.label || (code ? formatEnumLabel(code) : "--");

  // Create
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaxForm>({});
  const [submitting, setSubmitting] = useState(false);

  // Report: GET /tax-record/report?from=&to=
  const [showReport, setShowReport] = useState(false);
  const [reportRange, setReportRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [reportData, setReportData] = useState<Record<string, number> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setRecords(
        asArray<TaxRecord>(res.data).map((r) => ({
          ...r,
          taxTypeName: taxTypeText(r.taxType),
          journalEntryNumber: r.glEntry?.journalEntry?.entryNumber,
        }))
      );
    } catch (err) {
      console.error("Error fetching tax records", err);
      ToasterService.error("Failed to load tax records");
      setRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTaxTypes = () =>
    axios
      .get(TAX_TYPES_URL)
      .then((r) => setTaxTypes(asArray<TaxType>(r.data)))
      .catch(() => ToasterService.error("Failed to load tax types"));

  const fetchSourceDocs = () =>
    Promise.all(
      Object.entries(SOURCE_LISTS).map(([module, url]) =>
        axios
          .get(url)
          .then((r) => [module, asArray<SourceDocument>(r.data)] as const)
          .catch(() => [module, [] as SourceDocument[]] as const)
      )
    ).then((pairs) => setSourceDocs(Object.fromEntries(pairs)));

  useEffect(() => {
    fetchRecords();
    fetchTaxTypes();
    fetchSourceDocs();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchRecords();
      fetchTaxTypes();
      fetchSourceDocs();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** "Source" column: the document number when we know it, otherwise #id. */
  const sourceText = (r: TaxRecord) => {
    if (!r.sourceId) return "--";
    const doc = (sourceDocs[r.sourceModule || ""] || []).find((d) => d.id === r.sourceId);
    return doc?.invoiceNumber || `#${r.sourceId}`;
  };

  /* ---------------- Cards: Total + one per transaction type found ---------------- */

  const cards = useMemo<StatsCardOption<TaxRecord>[]>(() => {
    const present = new Set(records.map((r) => r.transactionType).filter(Boolean) as string[]);
    const ordered = [
      ...transactionTypes.map((t) => t.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !transactionTypes.some((t) => t.code === code)),
    ].slice(0, 4);
    return [
      { key: "ALL", label: "Total Records", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: typeLabel(code),
        match: (r: TaxRecord) => r.transactionType === code,
        tone: TYPE_TONE[code] || "slate",
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, transactionTypes]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(records, cards);

  /* ---------------- Create ---------------- */

  const openCreate = () => {
    setForm({ sourceModule: "SALES_INVOICE", transactionType: "SALE" });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({});
  };

  const selectedTaxType = taxTypes.find((t) => String(t.id) === form.taxTypeId);
  const sourceOptions = sourceDocs[form.sourceModule || ""];
  /** Preview only – the backend calculates the real tax amount. */
  const estimatedTax =
    selectedTaxType?.taxRate != null && Number(form.taxableAmount) > 0
      ? Math.round(Number(form.taxableAmount) * Number(selectedTaxType.taxRate)) / 100
      : null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const taxableAmount = Number(form.taxableAmount);
    if (!form.sourceModule) return ToasterService.error("Source module is required");
    if (!form.transactionType) return ToasterService.error("Transaction type is required");
    if (!form.taxTypeId) return ToasterService.error("Tax type is required");
    if (!Number.isFinite(taxableAmount) || taxableAmount <= 0) return ToasterService.error("Taxable amount must be more than 0");

    const payload: CreateTaxRecordPayload = {
      sourceModule: form.sourceModule,
      sourceId: form.sourceId ? Number(form.sourceId) : undefined,
      transactionType: form.transactionType,
      taxTypeId: Number(form.taxTypeId),
      taxableAmount,
    };
    setSubmitting(true);
    try {
      const res = await axios.post<TaxRecord>(`${API_URL}/record`, payload);
      ToasterService.success(
        res.data?.taxAmount != null ? `Tax record added – tax ${formatMoney(Number(res.data.taxAmount))}` : "Tax record added"
      );
      closeForm();
      fetchRecords();
    } catch (err) {
      console.error("Error creating tax record", err);
      ToasterService.error(apiError(err, "Failed to save tax record"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Report ---------------- */

  const openReport = () => {
    const today = todayIso();
    setReportRange({ from: `${today.slice(0, 8)}01`, to: today }); // this month
    setReportData(null);
    setShowReport(true);
  };

  const runReport = async (e: FormEvent) => {
    e.preventDefault();
    if (reportRange.from && reportRange.to && reportRange.from > reportRange.to) {
      return ToasterService.error("From date cannot be after To date");
    }
    setReportLoading(true);
    try {
      const res = await axios.get<Record<string, number>>(`${API_URL}/report`, {
        params: { from: reportRange.from || undefined, to: reportRange.to || undefined },
      });
      setReportData(res.data && typeof res.data === "object" ? res.data : {});
    } catch (err) {
      console.error("Error loading tax report", err);
      ToasterService.error(apiError(err, "Failed to load tax report"));
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  };

  const reportEntries = Object.entries(reportData || {});
  const reportTotal = reportEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0);

  /* ---------------- Table ---------------- */

  const money = (key: "taxableAmount" | "taxAmount", label: string, bold = false): ColumnDef<TaxRecord> => ({
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

  const filtered = useMemo(
    () => (typeFilter === "ALL" ? inPeriod : inPeriod.filter((record) => record.transactionType === typeFilter)),
    [inPeriod, typeFilter]
  );

  const collected = Number(report?.taxCollected ?? 0);
  const paid = Number(report?.taxPaid ?? 0);

  const columns: ColumnDef<TaxRecord>[] = [
    { key: "transactionDate", label: "Date", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.transactionDate)}</span> },
    { key: "transactionType", label: "Type", sortable: true, render: (row) => <StatusBadge status={row.transactionType} tones={TRANSACTION_TONES} /> },
    {
      key: "taxType",
      label: "Tax",
      sortable: true,
      filterOptions: transactionTypes.map((t) => ({ label: t.label, value: t.code })),
      detailFormatter: (r) => typeLabel(r.transactionType),
      exportValueGetter: (r) => typeLabel(r.transactionType),
      render: (r) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[TYPE_TONE[r.transactionType || ""] || "slate"]}`}>
          {typeLabel(r.transactionType)}
        </span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source",
      sortable: true,
      filterOptions: sourceModules.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (r) => moduleLabel(r.sourceModule),
      exportValueGetter: (r) => moduleLabel(r.sourceModule),
      render: (r) => <span className="text-sm text-slate-700">{moduleLabel(r.sourceModule)}</span>,
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      sortValueGetter: (r) => sourceText(r),
      detailFormatter: (r) => sourceText(r),
      exportValueGetter: (r) => sourceText(r),
      render: (r) => <span className="text-sm text-slate-600">{sourceText(r)}</span>,
    },
    {
      key: "taxTypeName",
      label: "Tax Type",
      sortable: true,
      render: (r) => <span className="text-sm text-slate-600 truncate">{r.taxTypeName || "--"}</span>,
    },
    money("taxableAmount", "Taxable Amount"),
    money("taxAmount", "Tax Amount", true),
    {
      key: "transactionDate",
      label: "Date",
      sortable: true,
      exportValueGetter: (r) => (r.transactionDate ? formatDisplayDate(r.transactionDate) : ""),
      render: (r) => <span className="text-sm text-slate-600">{r.transactionDate ? formatDisplayDate(r.transactionDate) : "--"}</span>,
    },
    {
      key: "journalEntryNumber",
      label: "Journal Entry",
      sortable: true,
      render: (r) => <span className="text-sm text-slate-600">{r.journalEntryNumber || "--"}</span>,
    },
  ];

  return (
    <>
      <PageMeta title="Tax Records" description="Tax records and tax report" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Tax Records"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openReport}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-white px-3 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 dark:border-cyan-800 dark:bg-gray-900 dark:text-cyan-300"
            >
              <ChartBarIcon className="h-4 w-4" />
              Tax Report
            </button>
            {canCreate && <AddButton className="-mr-5" label="Add Tax Record" onClick={openCreate} />}
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
            rowDetailsTitle="Tax Record"
            rowDetailsSubtitle="Tax records cannot be changed"
            // Long nested objects; their useful parts are shown as columns
            hiddenDetailKeys={["taxType", "glEntry"]}
            suspendRowDetails={showForm || showReport}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <CreditCardIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No tax records found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all records</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                      Create your first tax record
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Add tax record */}
        <Dragger
          isOpen={showForm}
          title="Add Tax Record"
          subtitle="The tax amount and date are calculated by the system. Tax records cannot be edited after saving."
          onClose={closeForm}
          onSubmit={handleCreate}
          submitting={submitting}
          submitLabel="Create"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FloatingSelect
              label="Source Module"
              name="sourceModule"
              value={form.sourceModule || ""}
              // A different module means a different document list
              onChange={(e) => setForm({ ...form, sourceModule: e.target.value, sourceId: "" })}
              options={toSelectOptions(sourceModules)}
              required
            />
            {sourceOptions ? (
              <SearchableSelect
                label="Source Document"
                value={form.sourceId || ""}
                options={sourceOptions.map((d) => ({ value: String(d.id), label: d.invoiceNumber || `#${d.id}` }))}
                onChange={(value: string | number) => setForm({ ...form, sourceId: String(value ?? "") })}
                placeholder={sourceOptions.length ? "Search document" : "No documents loaded"}
                emptyOptionLabel="None"
              />
            ) : (
              <FloatingInput
                label="Source ID"
                name="sourceId"
                type="number"
                min={1}
                step={1}
                value={form.sourceId || ""}
                onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                onKeyDown={(e) => ["e", "E", "+", "-", "."].includes(e.key) && e.preventDefault()}
                onWheel={(e) => e.currentTarget.blur()}
              />
            )}
            <FloatingSelect
              label="Transaction Type"
              name="transactionType"
              value={form.transactionType || ""}
              onChange={(e) => setForm({ ...form, transactionType: e.target.value })}
              options={toSelectOptions(transactionTypes)}
              required
            />
            <SearchableSelect
              label="Tax Type"
              value={form.taxTypeId || ""}
              options={taxTypes.filter((t) => t.isActive !== false).map((t) => ({ value: String(t.id), label: taxTypeText(t) }))}
              onChange={(value: string | number) => setForm({ ...form, taxTypeId: String(value ?? "") })}
              placeholder={taxTypes.length ? "Search tax type" : "No tax types loaded"}
              required
            />
            <FloatingInput
              label="Taxable Amount"
              name="taxableAmount"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.taxableAmount || ""}
              onChange={(e) => setForm({ ...form, taxableAmount: e.target.value })}
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
              onWheel={(e) => e.currentTarget.blur()}
              required
            />
            <div className="mb-5 flex h-[52px] items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-4 text-sm dark:border-gray-700 dark:bg-gray-800">
              <span className="text-gray-500">Estimated Tax</span>
              <strong className="text-slate-800 dark:text-gray-100">{estimatedTax != null ? formatMoney(estimatedTax) : "--"}</strong>
            </div>
          </div>
        </Dragger>

        {/* Tax report for a date range */}
        <Dragger
          isOpen={showReport}
          variant="modal"
          title="Tax Report"
          subtitle="Tax totals for a date range"
          onClose={() => setShowReport(false)}
          onSubmit={runReport}
          submitting={reportLoading}
          submitLabel="Show Report"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FloatingDatePicker
              label="From"
              name="from"
              value={reportRange.from}
              onChange={(e) => setReportRange({ ...reportRange, from: e.target.value })}
              maxDate={reportRange.to || undefined}
            />
            <FloatingDatePicker
              label="To"
              name="to"
              value={reportRange.to}
              onChange={(e) => setReportRange({ ...reportRange, to: e.target.value })}
              minDate={reportRange.from || undefined}
            />
          </div>
          {reportData &&
            (reportEntries.length === 0 ? (
              <p className="text-sm text-slate-500">No tax recorded in this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {reportEntries.map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-3 py-2 text-slate-700 dark:text-gray-200">{formatEnumLabel(key)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatMoney(Number(value || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-gray-800">
                    <tr>
                      <td className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">Total</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{formatMoney(reportTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}
        </Dragger>
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title="Record tax"
        subtitle="Tax records can't be edited or deleted afterwards"
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1 label="Type" name="transactionType" value={form.transactionType} options={TRANSACTION_OPTIONS} includeEmptyOption={false}
                onChange={(event) => {
                  const transactionType = event.target.value;
                  const sourceModule = transactionType === "SALE" ? "SALES_INVOICE" : transactionType === "PURCHASE" ? "PURCHASE_INVOICE" : "OTHER";
                  setForm((current) => ({ ...current, transactionType, sourceModule }));
                }} />
              <FloatingSelect1 label="Tax type" name="taxTypeId" required value={form.taxTypeId}
                options={taxTypes
                  .filter((type) => type.isActive !== false || String(type.id) === form.taxTypeId)
                  .map((type) => ({ id: String(type.id), name: `${type.taxName ?? `Tax ${type.id}`} (${Number(type.taxRate ?? 0)}%)` }))}
                onChange={(event) => setForm((current) => ({ ...current, taxTypeId: event.target.value }))} />
              <FloatingInput label="Taxable amount" name="taxableAmount" type="number" required value={form.taxableAmount}
                onChange={(event) => setForm((current) => ({ ...current, taxableAmount: event.target.value }))} />
              <FloatingInput label="Date" name="transactionDate" type="date" value={form.transactionDate}
                onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
              <FloatingSelect1 label="Source" name="sourceModule" value={form.sourceModule} options={SOURCE_MODULE_OPTIONS} includeEmptyOption={false}
                onChange={(event) => setForm((current) => ({ ...current, sourceModule: event.target.value }))} />
              <FloatingInput label="Source document id (optional)" name="sourceId" type="number" value={form.sourceId}
                onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))} />
              {previewTax != null && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:col-span-2">
                  Tax: <span className="font-semibold">{money(previewTax)}</span> ({Number(selectedType?.taxRate ?? 0)}% of {money(form.taxableAmount)})
                </p>
              )}
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel="Record tax" busy={busy} />
          </form>
        }
      />
    </>
  );
};

export default TaxRecords;
