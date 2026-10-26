import React, { useEffect, useLayoutEffect, useRef, useState, ChangeEvent, FormEvent } from "react";
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
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import {
  FloatingInput,
  FloatingDatePicker,
  FloatingTextarea,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

interface PurchaseInvoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  purchaseInvoiceStatus?: string;
  currency?: string;
  referenceNumber?: string;
  notes?: string;
  vendor?: { id: number; name?: string } | null;
  vendorId?: string;
}

/**
 * Fields accepted when creating or updating a purchase invoice (Swagger schema).
 * Server fields (id, createdDate, updatedDate, createdBy, tenantId) are never sent.
 * There is no vendor field yet – waiting for backend.
 */
interface PurchaseInvoicePayload {
  purchaseInvoiceStatus: string;
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount: number;
  currency: string;
  referenceNumber?: string;
  notes?: string;
  vendor: { id: number };
}

/** GET /v1/api/invoice/vendors (Invoice module vendor list) */
interface Vendor {
  id: number;
  name?: string;
}

/** GET /v1/api/invoice/payment-terms */
interface PaymentTerm {
  id: number;
  termCode?: string;
  description?: string;
  dueDays?: number;
}

const API_URL = "/v1/api/invoice/purchase-invoices";
const PAYMENT_TERMS_URL = "/v1/api/invoice/payment-terms";
const VENDORS_URL = "/v1/api/invoice/vendors";
const PAGE_SIZE = 10;

/**
 * Statuses that belong to a vendor bill. The enum API also returns payment statuses
 * (Failed, Refunded, Chargeback…), which are left out of this page.
 * A new bill always starts as OPEN; Partially Paid / Paid should come from Vendor Payments.
 */
const BILL_STATUSES = ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];
const CURRENCY_FALLBACK = ["INR", "USD", "EUR"];

/** Clickable stats cards: click one to show only those rows, click again to show all. */
const STATS_CARDS: StatsCardOption<PurchaseInvoice>[] = [
  { key: "ALL", label: "Total Invoices", match: () => true, tone: "cyan" },
  { key: "PAID", label: "Paid", match: (i) => i.purchaseInvoiceStatus === "PAID", tone: "green" },
  {
    key: "OPEN",
    label: "Open / Partially Paid",
    match: (i) => i.purchaseInvoiceStatus === "OPEN" || i.purchaseInvoiceStatus === "PARTIALLY_PAID",
    tone: "amber",
  },
  { key: "OVERDUE", label: "Overdue", match: (i) => i.purchaseInvoiceStatus === "OVERDUE", tone: "red" },
];

const statusTone = (status?: string) => {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/40";
    case "PARTIALLY_PAID":
      return "bg-yellow-50 text-yellow-700 border-yellow-200/40";
    case "OPEN":
      return "bg-blue-50 text-blue-700 border-blue-200/40";
    case "OVERDUE":
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200/40";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200/40";
  }
};

/** "2026-10-22" + 30 days → "2026-11-21" (local date, no timezone shift). */
const addDays = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const termLabel = (term: PaymentTerm) => {
  const name = term.description || term.termCode || `Term #${term.id}`;
  return `${name} (${Number(term.dueDays || 0)} day${Number(term.dueDays) === 1 ? "" : "s"})`;
};

/** Backend message when there is one (e.g. "Invoice number already exists"). */
const apiError = (err: any, fallback: string) => {
  const data = err?.response?.data;
  const message = String(data?.message || data?.error || "");
  // The generic 500 text isn't useful on its own; keep the reference for the backend team.
  if (data?.reference) return `${fallback} (reference ${data.reference})`;
  return message || fallback;
};

/**
 * Notes box that starts as one line (same height as an input) and grows as the text gets
 * longer. Same behaviour as the Purchase module pages.
 */
const AutoGrowTextarea = (props: React.ComponentProps<typeof FloatingTextarea>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resize = () => {
    const textarea = wrapperRef.current?.querySelector("textarea");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(52, textarea.scrollHeight + 2)}px`;
  };
  // Also resizes when an existing note is loaded for Edit
  useLayoutEffect(resize, [props.value]);
  return (
    <div ref={wrapperRef} onInput={resize}>
      <FloatingTextarea {...props} rows={1} />
    </div>
  );
};

/** ₹ with Indian grouping for INR; other currencies show their code. */
const formatInvoiceAmount = (amount?: number, currency?: string) => {
  const value = Number(amount || 0);
  if (!currency || currency === "INR") return formatMoney(value);
  return `${currency} ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const PurchaseInvoices: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [form, setForm] = useState<Partial<PurchaseInvoice>>({});
  // Only used to fill Due Date; it is not sent to the API (the schema has no payment term field).
  const [paymentTermId, setPaymentTermId] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const allStatuses = useInvoiceEnum("PURCHASE_INVOICE_STATUS", BILL_STATUSES);
  const currencies = useInvoiceEnum("CURRENCY", CURRENCY_FALLBACK);

  // Bill statuses only, in a sensible order, with labels from the enum API when it has them.
  const billStatuses = BILL_STATUSES.map(
    (code) => allStatuses.find((s) => s.code === code) || { code, label: code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ") }
  );

  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(purchaseInvoices, STATS_CARDS);

  useEffect(() => {
    fetchPurchaseInvoices();
    fetchPaymentTerms();
    fetchVendors();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchPurchaseInvoices();
      fetchPaymentTerms();
      fetchVendors();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPurchaseInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<PurchaseInvoice[]>(API_URL);
      setPurchaseInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load purchase invoices"));
      setPurchaseInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentTerms = async () => {
    try {
      const res = await axios.get<PaymentTerm[]>(PAYMENT_TERMS_URL);
      const list = Array.isArray(res.data) ? res.data : [];
      setPaymentTerms([...list].sort((a, b) => Number(a.dueDays || 0) - Number(b.dueDays || 0)));
    } catch (err) {
      // Not critical: Due Date can still be picked by hand.
      console.error("Error fetching payment terms", err);
      setPaymentTerms([]);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await axios.get(VENDORS_URL);
      const data = res.data;
      const list: Vendor[] = Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : Array.isArray(data?.data) ? data.data : [];
      // Only id and name are kept (the API also returns each vendor's invoices and payables).
      setVendors(list.map((v) => ({ id: v.id, name: v.name })).sort((a, b) => String(a.name).localeCompare(String(b.name))));
    } catch (err) {
      console.error("Error fetching vendors", err);
      ToasterService.error("Failed to load vendors");
      setVendors([]);
    }
  };

  const selectedTerm = paymentTerms.find((t) => String(t.id) === paymentTermId);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      // A new invoice date moves the due date too, when a payment term is chosen.
      if (name === "invoiceDate" && value && selectedTerm) next.dueDate = addDays(value, Number(selectedTerm.dueDays || 0));
      return next;
    });
    // Picking a due date by hand means it no longer follows the term.
    if (name === "dueDate") setPaymentTermId("");
  };

  const handleTermChange = (termId: string) => {
    setPaymentTermId(termId);
    const term = paymentTerms.find((t) => String(t.id) === termId);
    if (term && form.invoiceDate) {
      setForm((current) => ({ ...current, dueDate: addDays(String(current.invoiceDate), Number(term.dueDays || 0)) }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      ToasterService.error("Choose the vendor this bill is from");
      return;
    }
    if (!form.invoiceNumber?.trim()) {
      ToasterService.error("Enter the vendor's invoice number");
      return;
    }

    const totalAmount = Number(form.totalAmount ?? 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      ToasterService.error("Total amount must be more than 0");
      return;
    }

    if (!form.invoiceDate) {
      ToasterService.error("Invoice date is required");
      return;
    }

    if (form.invoiceDate && form.dueDate && form.dueDate < form.invoiceDate) {
      ToasterService.error("Due date cannot be before invoice date");
      return;
    }

    const payload: PurchaseInvoicePayload = {
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate || undefined,
      dueDate: form.dueDate || undefined,
      totalAmount,
      // New bill: always OPEN. Edit: the status chosen in the form (bill statuses only).
      purchaseInvoiceStatus: editingId !== null ? form.purchaseInvoiceStatus || "OPEN" : "OPEN",
      currency: form.currency?.trim().toUpperCase() || "INR",
      referenceNumber: form.referenceNumber?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      vendor: { id: Number(vendorId) },
    };

    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload)
          : await axios.post<PurchaseInvoice>(API_URL, payload);
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Purchase invoice updated" : "Purchase invoice added; it is now in Accounts Payable");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchPurchaseInvoices();
      }
    } catch (err) {
      console.error("Error submitting purchase invoice", err);
      ToasterService.error(apiError(err, "Failed to save purchase invoice"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setForm({
      ...invoice,
      invoiceDate: invoice.invoiceDate?.slice(0, 10),
      dueDate: invoice.dueDate?.slice(0, 10),
    });
    setPaymentTermId("");
    // Old records carry their vendor; newer ones may not until the backend returns it.
    setVendorId(invoice.vendor?.id ? String(invoice.vendor.id) : "");
    setEditingId(invoice.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    // Invoice date defaults to today; the user can change it to the date on the vendor's bill
    setForm({ currency: "INR", purchaseInvoiceStatus: "OPEN", invoiceDate: todayIso() });
    setPaymentTermId("");
    setVendorId("");
    setEditingId(null);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setPaymentTermId("");
    setVendorId("");
    setForm({});
  };

  const handleDelete = (invoice: PurchaseInvoice) => {
    setInvoiceToDelete(invoice);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${invoiceToDelete.id}`);
      ToasterService.success("Purchase invoice deleted successfully!");
      setShowDeletePopup(false);
      setInvoiceToDelete(null);
      fetchPurchaseInvoices();
    } catch (err) {
      console.error("Error deleting purchase invoice", err);
      ToasterService.error(apiError(err, "Failed to delete purchase invoice"));
    } finally {
      setDeleting(false);
    }
  };

  const statusLabel = (code?: string) =>
    allStatuses.find((s) => s.code === code)?.label || code || "N/A";

  // Edit status choices: bill statuses, plus the record's current one if it is something else.
  const editStatusOptions = [
    ...billStatuses,
    ...(form.purchaseInvoiceStatus && !BILL_STATUSES.includes(form.purchaseInvoiceStatus)
      ? [{ code: form.purchaseInvoiceStatus, label: statusLabel(form.purchaseInvoiceStatus) }]
      : []),
  ].map((s) => ({ id: s.code, name: s.label }));

  const tableColumns: ColumnDef<PurchaseInvoice>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice Number",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (invoice) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {invoice.invoiceNumber || "N/A"}
          </span>
        </div>
      ),
    },
    {
      // Only the vendor's name (the API nests the whole vendor with all its invoices).
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      sortValueGetter: (invoice) => invoice.vendor?.name || "",
      filterValueGetter: (invoice) => invoice.vendor?.name || "",
      detailFormatter: (invoice) => invoice.vendor?.name || "--",
      exportValueGetter: (invoice) => invoice.vendor?.name || "",
      render: (invoice) => <span className="block truncate text-sm text-slate-600">{invoice.vendor?.name || "--"}</span>,
    },
    {
      key: "invoiceDate",
      label: "Invoice Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      exportValueGetter: (invoice) => (invoice.invoiceDate ? formatDisplayDate(invoice.invoiceDate) : ""),
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {invoice.invoiceDate ? formatDisplayDate(invoice.invoiceDate) : "N/A"}
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      exportValueGetter: (invoice) => (invoice.dueDate ? formatDisplayDate(invoice.dueDate) : ""),
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {invoice.dueDate ? formatDisplayDate(invoice.dueDate) : "N/A"}
        </span>
      ),
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      sortable: true,
      headerClassName: "w-[14%] text-right",
      className: "w-[14%] text-right",
      sortValueGetter: (invoice) => Number(invoice.totalAmount || 0),
      // Drawer and export show the invoice's own currency (₹ only for INR)
      detailFormatter: (invoice) => formatInvoiceAmount(invoice.totalAmount, invoice.currency),
      exportValueGetter: (invoice) => formatInvoiceAmount(invoice.totalAmount, invoice.currency),
      render: (invoice) => (
        <span className="text-sm font-semibold text-slate-700">
          {formatInvoiceAmount(invoice.totalAmount, invoice.currency)}
        </span>
      ),
    },
    {
      key: "purchaseInvoiceStatus",
      label: "Status",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      // Column filter dropdown and drawer/export use readable labels, e.g. "Partially Paid"
      filterOptions: billStatuses.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (invoice) => statusLabel(invoice.purchaseInvoiceStatus),
      exportValueGetter: (invoice) => statusLabel(invoice.purchaseInvoiceStatus),
      render: (invoice) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusTone(invoice.purchaseInvoiceStatus)}`}>
          {statusLabel(invoice.purchaseInvoiceStatus)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (invoice) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleEdit(invoice); }}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
              title="Edit Purchase Invoice"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDelete(invoice); }}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
              title="Delete Purchase Invoice"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Purchase Invoices" description="Manage purchase invoices" />
      {/* Same layout as the Purchase module pages: Add button sits in the breadcrumb row */}
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Purchase Invoices"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Purchase Invoice" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          {/* Clickable cards + toolbar (columns, export, search, filter, refresh) */}
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="invoiceNumber"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(invoice) => `Invoice ${invoice.invoiceNumber || ""}`.trim()}
            rowDetailsSubtitle="Purchase invoice details"
            // The raw vendor object repeats every invoice of that vendor; the Vendor column shows its name instead.
            hiddenDetailKeys={["vendor"]}
            // Hides the details drawer while the edit Dragger is open; it comes back with the saved data
            suspendRowDetails={showFormModal}
            // Edit icon next to ✕ in the row details drawer
            rowDetailsActions={(invoice: PurchaseInvoice) =>
              canUpdate ? (
                <button
                  type="button"
                  onClick={() => handleEdit(invoice)}
                  // Same classes as the ✕ next to it (light and dark mode)
                  className={ICON_BUTTON_CLASS}
                  title="Edit"
                  aria-label="Edit this record"
                >
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No purchase invoices found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all invoices</p>
                ) : (
                  canCreate && (
                    <button
                      type="button"
                      onClick={() => openCreate()}
                      className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                    >
                      Create your first purchase invoice
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        <Dragger
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Purchase Invoice" : "Add Purchase Invoice"}
          subtitle={editingId !== null ? "Update your invoice details" : "Enter the details from the vendor's bill"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Who the bill is from. Needed by Accounts Payable and Vendor Payments. */}
            <div className="md:col-span-2">
              <SearchableSelect
                label="Vendor"
                value={vendorId}
                options={vendors.map((v) => ({ value: String(v.id), label: v.name || `Vendor ${v.id}` }))}
                onChange={(value: string | number) => setVendorId(String(value ?? ""))}
                placeholder={vendors.length ? "Search vendor" : "No vendors loaded"}
                required
              />
            </div>
            <FloatingInput
              label="Invoice Number"
              name="invoiceNumber"
              value={form.invoiceNumber || ""}
              onChange={handleChange}
              required
            />
            <FloatingInput
              label="Reference Number"
              name="referenceNumber"
              value={form.referenceNumber || ""}
              onChange={handleChange}
            />
            <FloatingDatePicker
              label="Invoice Date"
              name="invoiceDate"
              value={form.invoiceDate || ""}
              onChange={handleChange}
              required
            />
            {/* Picking a term fills Due Date = Invoice Date + due days. Not sent to the API. */}
            <FloatingSelect
              label="Payment Term"
              name="paymentTermId"
              value={paymentTermId}
              onChange={(e) => handleTermChange(e.target.value)}
              options={paymentTerms.map((t) => ({ id: String(t.id), name: termLabel(t) }))}
              emptyOptionLabel="Pick due date manually"
            />
            <FloatingDatePicker
              label="Due Date"
              name="dueDate"
              value={form.dueDate || ""}
              onChange={handleChange}
              minDate={form.invoiceDate || undefined}
            />
            <FloatingInput
              label="Total Amount"
              name="totalAmount"
              type="number"
              min={0}
              step="0.01"
              value={form.totalAmount ?? ""}
              onChange={handleChange}
              required
            />
            <FloatingSelect
              label="Currency"
              name="currency"
              value={form.currency || ""}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              // Currency shown as its code in capitals: INR, USD, EUR
              options={currencies.map((c) => ({ id: c.code, name: c.code.toUpperCase() }))}
              required
            />
            {/* New bills always start as Open, so Status is shown only on Edit. */}
            {editingId !== null && (
              <FloatingSelect
                label="Status"
                name="purchaseInvoiceStatus"
                value={form.purchaseInvoiceStatus || ""}
                onChange={(e) => setForm({ ...form, purchaseInvoiceStatus: e.target.value })}
                options={editStatusOptions}
              />
            )}
            <div className="md:col-span-2">
              <AutoGrowTextarea
                label="Notes"
                name="notes"
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </Dragger>

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Purchase Invoice"
          subText={
            invoiceToDelete
              ? `Are you sure you want to delete "${invoiceToDelete.invoiceNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this purchase invoice?"
          }
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setInvoiceToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default PurchaseInvoices;
