import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatMoney } from "../../components/common/Table";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { toSelectOptions, useInvoiceEnum } from "../Invoice/invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/tax-details)           */
/* ------------------------------------------------------------------ */

/**
 * One tax amount on a document: which tax (tax type), its rate and amount, and whether it is
 * INPUT tax (paid on purchases, can be claimed back) or OUTPUT tax (charged on sales, owed to the government).
 */
interface TaxDetail {
  id: number;
  taxCode?: string;
  taxDescription?: string;
  taxRate?: number;
  taxAmount?: number;
  taxCatagory?: string; // spelled this way by the API
  taxType?: { id: number; taxName?: string; taxRate?: number } | null;
  invoice?: { id: number; invoiceNumber?: string; customerName?: string } | null;
  // Filled here for the table, search and export
  taxTypeName?: string;
  invoiceNumber?: string;
}

/** POST / PUT body: only editable fields; linked records by id (the API returns them in full). */
interface TaxDetailPayload {
  taxCode: string;
  taxDescription?: string;
  taxRate: number;
  taxAmount: number;
  taxCatagory: string;
  taxType: { id: number };
  invoice?: { id: number } | null;
}

interface TaxTypeRef {
  id: number;
  taxName?: string;
  taxRate?: number;
  isActive?: boolean;
}

interface InvoiceRef {
  id: number;
  invoiceNumber?: string;
  customerName?: string;
  subTotal?: number;
  taxAmount?: number;
}

type DetailForm = {
  taxTypeId: string;
  taxCode: string;
  taxDescription: string;
  taxRate: string;
  taxCatagory: string;
  invoiceId: string;
  taxableAmount: string; // helper only: amount the tax is worked out on (not sent)
  taxAmount: string;
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/tax-details";
const TAX_TYPES_URL = "/v1/api/invoice/tax-types";
const INVOICES_URL = "/v1/api/invoice/invoices";
const PAGE_SIZE = 10;
const CATEGORY_FALLBACK = ["INPUT", "OUTPUT"];

const EMPTY_FORM: DetailForm = {
  taxTypeId: "",
  taxCode: "",
  taxDescription: "",
  taxRate: "",
  taxCatagory: "OUTPUT",
  invoiceId: "",
  taxableAmount: "",
  taxAmount: "",
};

const CATEGORY_HINT: Record<string, string> = {
  INPUT: "Input tax – paid on purchases, can be claimed back",
  OUTPUT: "Output tax – charged on sales, owed to the government",
};

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

const toPaise = (value: unknown) => Math.round((Number(value) || 0) * 100);
const fromPaise = (paise: number) => paise / 100;
const rateText = (rate?: number) => (rate == null ? "--" : `${Number(rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`);

/** Money box: blocks - + e E, ignores mouse-wheel scrolling. */
const amountInputProps = {
  type: "number" as const,
  min: 0,
  step: "0.01",
  inputMode: "decimal" as const,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault(),
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
};

/** Only the fields used here (the API nests the full tax type and the full invoice with all its items). */
const slim = (d: any): TaxDetail => ({
  id: d.id,
  taxCode: d.taxCode,
  taxDescription: d.taxDescription,
  taxRate: d.taxRate,
  taxAmount: d.taxAmount,
  taxCatagory: d.taxCatagory,
  taxType: d.taxType ? { id: d.taxType.id, taxName: d.taxType.taxName, taxRate: d.taxType.taxRate } : null,
  invoice: d.invoice ? { id: d.invoice.id, invoiceNumber: d.invoice.invoiceNumber, customerName: d.invoice.customerName } : null,
  taxTypeName: d.taxType?.taxName,
  invoiceNumber: d.invoice?.invoiceNumber,
});

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const TaxDetails: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [details, setDetails] = useState<TaxDetail[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxTypeRef[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const categories = useInvoiceEnum("TAXCATAGORY", CATEGORY_FALLBACK);
  const categoryLabel = (code?: string) => categories.find((c) => c.code === code)?.label || code || "--";

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DetailForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<TaxDetail | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setDetails(asArray<any>(res.data).map(slim));
    } catch (err) {
      console.error("Error fetching tax details", err);
      ToasterService.error("Failed to load tax details");
      setDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTaxTypes = () =>
    axios
      .get(TAX_TYPES_URL)
      .then((r) => setTaxTypes(asArray<TaxTypeRef>(r.data)))
      .catch(() => ToasterService.error("Failed to load tax types"));

  const fetchInvoices = () =>
    axios
      .get(INVOICES_URL)
      .then((r) =>
        setInvoices(
          asArray<any>(r.data).map((i) => ({
            id: i.id,
            invoiceNumber: i.invoiceNumber,
            customerName: i.customerName,
            subTotal: i.subTotal,
            taxAmount: i.taxAmount,
          }))
        )
      )
      .catch(() => ToasterService.error("Failed to load invoices"));

  useEffect(() => {
    fetchDetails();
    fetchTaxTypes();
    fetchInvoices();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchDetails();
      fetchTaxTypes();
      fetchInvoices();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Cards + money summary ---------------- */

  const cards = useMemo<StatsCardOption<TaxDetail>[]>(
    () => [
      { key: "ALL", label: "All Tax Details", match: () => true, tone: "cyan" },
      { key: "OUTPUT", label: "Output (Sales)", match: (d) => d.taxCatagory === "OUTPUT", tone: "amber" },
      { key: "INPUT", label: "Input (Purchases)", match: (d) => d.taxCatagory === "INPUT", tone: "green" },
    ],
    []
  );
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(details, cards);

  // Output tax − Input tax = what is owed to the government (negative = can be claimed back)
  const summary = useMemo(() => {
    const sum = (cat: string) => details.filter((d) => d.taxCatagory === cat).reduce((t, d) => t + toPaise(d.taxAmount), 0);
    const output = sum("OUTPUT");
    const input = sum("INPUT");
    return { output: fromPaise(output), input: fromPaise(input), net: fromPaise(output - input) };
  }, [details]);

  /* ---------------- Form ---------------- */

  const activeTaxTypes = taxTypes.filter((t) => t.isActive !== false || String(t.id) === form.taxTypeId);
  const selectedInvoice = invoices.find((i) => String(i.id) === form.invoiceId);

  /** Tax = taxable amount × rate (paise maths). */
  const computedTax = (taxable: string, rate: string) =>
    taxable === "" || rate === "" ? "" : String(fromPaise(Math.round((toPaise(taxable) * Number(rate || 0)) / 100)));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (d: TaxDetail) => {
    setForm({
      taxTypeId: d.taxType?.id ? String(d.taxType.id) : "",
      taxCode: d.taxCode || "",
      taxDescription: d.taxDescription || "",
      taxRate: d.taxRate != null ? String(d.taxRate) : "",
      taxCatagory: d.taxCatagory || "OUTPUT",
      invoiceId: d.invoice?.id ? String(d.invoice.id) : "",
      taxableAmount: "",
      taxAmount: d.taxAmount != null ? String(d.taxAmount) : "",
    });
    setEditingId(d.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  /** Picking a tax type fills the rate, and the code / description when they are still empty. */
  const pickTaxType = (id: string) => {
    const type = taxTypes.find((t) => String(t.id) === id);
    const rate = type?.taxRate != null ? String(type.taxRate) : form.taxRate;
    setForm({
      ...form,
      taxTypeId: id,
      taxRate: rate,
      taxCode: form.taxCode || (type?.taxName ? type.taxName.toUpperCase().replace(/\s+/g, "") : ""),
      taxDescription: form.taxDescription || type?.taxName || "",
      taxAmount: form.taxableAmount ? computedTax(form.taxableAmount, rate) : form.taxAmount,
    });
  };

  /** Picking an invoice fills the taxable amount (its sub-total) and works out the tax. */
  const pickInvoice = (id: string) => {
    const invoice = invoices.find((i) => String(i.id) === id);
    const taxable = invoice?.subTotal != null ? String(invoice.subTotal) : form.taxableAmount;
    setForm({ ...form, invoiceId: id, taxableAmount: taxable, taxAmount: taxable ? computedTax(taxable, form.taxRate) : form.taxAmount });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const rate = Number(form.taxRate);
    if (!form.taxTypeId) return ToasterService.error("Choose the tax type");
    if (!form.taxCode.trim()) return ToasterService.error("Tax code is required");
    if (form.taxRate === "" || !Number.isFinite(rate) || rate < 0 || rate > 100) return ToasterService.error("Tax rate must be between 0 and 100");
    if (form.taxAmount === "" || toPaise(form.taxAmount) < 0) return ToasterService.error("Tax amount is required");
    if (!form.taxCatagory) return ToasterService.error("Choose input or output tax");

    const payload: TaxDetailPayload = {
      taxCode: form.taxCode.trim().toUpperCase(),
      taxDescription: form.taxDescription.trim() || undefined,
      taxRate: rate,
      taxAmount: fromPaise(toPaise(form.taxAmount)),
      taxCatagory: form.taxCatagory,
      taxType: { id: Number(form.taxTypeId) },
      invoice: form.invoiceId ? { id: Number(form.invoiceId) } : null,
    };

    setSubmitting(true);
    try {
      if (editingId !== null) await axios.put(`${API_URL}/${editingId}`, payload);
      else await axios.post(API_URL, payload);
      ToasterService.success(editingId !== null ? "Tax detail updated" : "Tax detail added");
      closeForm();
      fetchDetails();
    } catch (err) {
<<<<<<< HEAD
=======
      console.error("Error saving tax detail", err);
>>>>>>> 28f721687fb8e135a8cd2916bfdd1e2fa179e52b
      ToasterService.error(apiError(err, "Failed to save tax detail"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Delete ---------------- */

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${toDelete.id}`);
      ToasterService.success("Tax detail deleted");
      setShowDelete(false);
      setToDelete(null);
      fetchDetails();
    } catch (err) {
<<<<<<< HEAD
      ToasterService.error(apiError(err, "Failed to delete tax detail"));
=======
      console.error("Error deleting tax detail", err);
      ToasterService.error(apiError(err, "Failed to delete tax detail"));
    } finally {
      setDeleting(false);
>>>>>>> 28f721687fb8e135a8cd2916bfdd1e2fa179e52b
    }
  };

  /* ---------------- Table ---------------- */

  const tableColumns: ColumnDef<TaxDetail>[] = [
    {
      key: "taxCode",
      label: "Tax Code",
      sortable: true,
      render: (d) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="min-w-0 leading-snug">
            <span className="block truncate text-sm font-semibold text-slate-900">{d.taxCode || "--"}</span>
            {d.taxDescription && <span className="block truncate text-xs text-slate-500">{d.taxDescription}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "taxTypeName",
      label: "Tax Type",
      sortable: true,
      render: (d) => <span className="block truncate text-sm text-slate-600">{d.taxTypeName || "--"}</span>,
    },
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      detailFormatter: (d) => (d.invoice ? [d.invoiceNumber, d.invoice.customerName].filter(Boolean).join(" – ") : "--"),
      render: (d) => (
        <div className="min-w-0 leading-snug">
          <span className="block truncate text-sm text-slate-600">{d.invoiceNumber || "--"}</span>
          {d.invoice?.customerName && <span className="block truncate text-xs text-slate-400">{d.invoice.customerName}</span>}
        </div>
      ),
    },
    {
      key: "taxRate",
      label: "Rate",
      sortable: true,
      filterable: false,
      sortValueGetter: (d) => Number(d.taxRate || 0),
      detailFormatter: (d) => rateText(d.taxRate),
      exportValueGetter: (d) => rateText(d.taxRate),
      render: (d) => (
        <span className="inline-flex items-center rounded-full border border-blue-200/40 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{rateText(d.taxRate)}</span>
      ),
    },
    {
      key: "taxAmount",
      label: "Tax Amount",
      sortable: true,
      filterable: false,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (d) => Number(d.taxAmount || 0),
      detailFormatter: (d) => formatMoney(Number(d.taxAmount || 0)),
      exportValueGetter: (d) => formatMoney(Number(d.taxAmount || 0)),
      render: (d) => <span className="text-sm font-semibold text-slate-700">{formatMoney(Number(d.taxAmount || 0))}</span>,
    },
    {
      key: "taxCatagory",
      label: "Category",
      sortable: true,
      filterOptions: categories.map((c) => ({ label: c.label, value: c.code })),
      detailFormatter: (d) => CATEGORY_HINT[d.taxCatagory || ""] || categoryLabel(d.taxCatagory),
      exportValueGetter: (d) => categoryLabel(d.taxCatagory),
      render: (d) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            d.taxCatagory === "INPUT" ? "border-emerald-200/40 bg-emerald-50 text-emerald-700" : "border-amber-200/40 bg-amber-50 text-amber-700"
          }`}
        >
          {categoryLabel(d.taxCatagory)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (d) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => openEdit(d)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title="Edit Tax Detail">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setToDelete(d);
                setShowDelete(true);
              }}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
              title="Delete Tax Detail"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const Stat = ({ label, value, tone = "text-slate-800 dark:text-gray-100", hint }: { label: string; value: string; tone?: string; hint?: string }) => (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
      <span className="block text-xs text-slate-500 dark:text-gray-400">{label}</span>
      <strong className={`text-sm ${tone}`}>{value}</strong>
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </div>
  );

  return (
    <>
      <PageMeta title="Tax Details" description="Input and output tax amounts" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Tax Details"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Tax Detail" onClick={openCreate} /> : undefined}
      />

<<<<<<< HEAD
      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {canCreate && <AddButton onClick={openCreate} label="Add Tax Detail" />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 my-5">
          <StatsCard
            label="Total Tax Details"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Input Tax"
            value={stats.input}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Output Tax"
            value={stats.output}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Total Tax Amount"
            value={stats.totalTax.toLocaleString()}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>
=======
      {/* Same wrapper as the Invoice pages (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />
>>>>>>> 28f721687fb8e135a8cd2916bfdd1e2fa179e52b

          {/* What is owed to / claimable from the government */}
          {details.length > 0 && (
            <div className="mb-[3px] grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Stat label="Output tax (on sales)" value={formatMoney(summary.output)} tone="text-amber-700 dark:text-amber-400" />
              <Stat label="Input tax (on purchases)" value={formatMoney(summary.input)} tone="text-emerald-700 dark:text-emerald-400" />
              <Stat
                label={summary.net >= 0 ? "Net tax payable" : "Net tax credit"}
                value={formatMoney(Math.abs(summary.net))}
                tone={summary.net >= 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}
                hint="Output − Input"
              />
            </div>
          )}

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="taxCode"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(d) => `Tax ${d.taxCode || ""}`.trim()}
            rowDetailsSubtitle="Tax detail"
            // Linked records are shown by name in their own columns
            hiddenDetailKeys={["taxType", "invoice"]}
            suspendRowDetails={showForm || showDelete}
            rowDetailsActions={(d: TaxDetail) =>
              canUpdate ? (
                <button type="button" onClick={() => openEdit(d)} className={ICON_BUTTON_CLASS} title="Edit" aria-label="Edit this record">
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No tax details found</p>
                {selected !== "ALL" ? (
                  <p className="text-xs text-gray-400">Click the selected card again to show all tax details</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
                      Create your first tax detail
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        <Dragger
          isOpen={showForm}
          variant="modal"
          title={editingId !== null ? "Edit Tax Detail" : "Add Tax Detail"}
          subtitle="Pick the tax type; the rate and amount are filled in for you"
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SearchableSelect
              label="Tax Type"
              value={form.taxTypeId}
              options={activeTaxTypes.map((t) => ({ value: String(t.id), label: `${t.taxName || `Tax ${t.id}`} (${rateText(t.taxRate)})` }))}
              onChange={(value: string | number) => pickTaxType(String(value ?? ""))}
              placeholder={taxTypes.length ? "Search tax type" : "No tax types – add them in Tax Types first"}
              required
            />
            <FloatingSelect
              label="Category"
              name="taxCatagory"
              value={form.taxCatagory}
              onChange={(e) => setForm({ ...form, taxCatagory: e.target.value })}
              options={toSelectOptions(categories)}
              includeEmptyOption={false}
              required
            />
            <div className="md:col-span-2 -mt-3 mb-3 px-1 text-xs text-slate-500">{CATEGORY_HINT[form.taxCatagory] || ""}</div>

            <FloatingInput
              label="Tax Code"
              name="taxCode"
              value={form.taxCode}
              onChange={(e) => setForm({ ...form, taxCode: e.target.value.toUpperCase() })}
              maxLength={50}
              required
            />
            <FloatingInput label="Description" name="taxDescription" value={form.taxDescription} onChange={handleChange} maxLength={255} />

            <div className="md:col-span-2">
              <SearchableSelect
                label="Invoice (optional)"
                value={form.invoiceId}
                options={invoices.map((i) => ({
                  value: String(i.id),
                  label: [i.invoiceNumber || `Invoice ${i.id}`, i.customerName, i.subTotal != null ? formatMoney(Number(i.subTotal)) : ""].filter(Boolean).join(" · "),
                }))}
                onChange={(value: string | number) => pickInvoice(String(value ?? ""))}
                placeholder={invoices.length ? "Search sales invoice" : "No invoices loaded"}
                emptyOptionLabel="Not linked to an invoice"
              />
              {selectedInvoice && (
                <p className="-mt-3 mb-3 px-1 text-xs text-slate-500">
                  Invoice sub-total {formatMoney(Number(selectedInvoice.subTotal || 0))}, tax on the invoice {formatMoney(Number(selectedInvoice.taxAmount || 0))}.
                </p>
              )}
            </div>

            <FloatingInput
              label="Taxable Amount (to work out the tax)"
              name="taxableAmount"
              {...amountInputProps}
              value={form.taxableAmount}
              onChange={(e) => setForm({ ...form, taxableAmount: e.target.value, taxAmount: computedTax(e.target.value, form.taxRate) || form.taxAmount })}
            />
            <FloatingInput
              label="Tax Rate (%)"
              name="taxRate"
              {...amountInputProps}
              max={100}
              value={form.taxRate}
              onChange={(e) => setForm({ ...form, taxRate: e.target.value, taxAmount: form.taxableAmount ? computedTax(form.taxableAmount, e.target.value) : form.taxAmount })}
              required
            />
            <div className="md:col-span-2">
              <FloatingInput label="Tax Amount" name="taxAmount" {...amountInputProps} value={form.taxAmount} onChange={handleChange} required />
              {form.taxableAmount && form.taxRate && (
                <p className="-mt-3 mb-3 px-1 text-xs text-slate-500">
                  {formatMoney(Number(form.taxableAmount))} × {rateText(Number(form.taxRate))} = {formatMoney(Number(computedTax(form.taxableAmount, form.taxRate) || 0))}
                </p>
              )}
            </div>
          </div>
        </Dragger>

        <DynamicPopup
          isPopupOpen={showDelete}
          setIsPopupOpen={setShowDelete}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Tax Detail"
          subText={toDelete ? `Delete tax detail "${toDelete.taxCode}" (${formatMoney(Number(toDelete.taxAmount || 0))})? This cannot be undone.` : ""}
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default TaxDetails;
