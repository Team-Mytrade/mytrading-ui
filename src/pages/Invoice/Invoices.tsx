import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  BanknotesIcon,
  PaperAirplaneIcon,
  DocumentArrowDownIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/invoices)              */
/* ------------------------------------------------------------------ */

interface InvoiceItem {
  id: number;
  productCode?: string;
  productName?: string;
  description?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  grossAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  taxCode?: string;
  taxRate?: number;
  taxAmount?: number;
  lineTotal?: number;
  batchNumber?: string;
  serialNumbers?: string[];
}

interface Invoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  status?: string;
  salesOrderId?: number;
  salesOrderNumber?: string;
  salesDispatchId?: number;
  salesDispatchNumber?: string;
  customerId?: number;
  customerCode?: string;
  customerName?: string;
  customerTaxNumber?: string;
  customerEmail?: string;
  currencyCode?: string;
  paymentTerms?: string;
  customerReference?: string;
  subTotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  grandTotal?: number;
  amountPaid?: number;
  balanceAmount?: number;
  remarks?: string;
  items?: InvoiceItem[];
  createdDate?: string;
  updatedDate?: string;
  issuedAt?: string;
  issuedBy?: string;
}

interface InvoiceDocument {
  id: number;
  fileName?: string;
  documentVersion?: number;
  status?: string;
  generatedAt?: string;
}

/** Invoices are created from a sales dispatch. Totals, customer and items come from the dispatch. */
interface CreateFromDispatchPayload {
  salesDispatchId: number;
  invoiceDate: string;
  remarks?: string;
}

/** A draft invoice can only change its date and remarks. */
interface UpdateInvoicePayload {
  invoiceDate: string;
  remarks?: string;
}

interface DispatchOption {
  id: number;
  dispatchNumber?: string;
  salesDispatchNumber?: string;
  customerName?: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/invoices";
/**
 * ⚠️ PENDING: the GET API that lists sales dispatches is not available yet.
 * While this is "", the Create form asks for the Sales Dispatch ID as a number.
 * When the API exists, put its path here and the field becomes a searchable dropdown.
 */
const DISPATCH_LIST_URL = "";
const PAGE_SIZE = 10;

const INVOICE_STATUS_FALLBACK = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"];

const toneForStatus = (status?: string): StatsCardTone => {
  switch (status) {
    case "PAID":
      return "green";
    case "ISSUED":
    case "SENT":
      return "blue";
    case "PARTIALLY_PAID":
      return "amber";
    case "OVERDUE":
    case "CANCELLED":
    case "VOID":
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

/** ₹ for INR (or no currency); other currencies show their code. */
const formatAmount = (amount?: number, currency?: string) => {
  const value = Number(amount || 0);
  if (!currency || currency === "INR") return formatMoney(value);
  return `${currency} ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type FormState = { salesDispatchId?: string; invoiceDate?: string; remarks?: string };

/** Customer check inside the Add drawer: each option loads from its own API. */
type CustomerView = "OUTSTANDING" | "CREDITABLE";
const VIEW_OPTIONS: { value: CustomerView; label: string; endpoint?: string }[] = [
  { value: "OUTSTANDING", label: "Outstanding (unpaid)", endpoint: "outstanding" },
  { value: "CREDITABLE", label: "Creditable (can get a credit note)", endpoint: "creditable" },
];

const Invoices: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create / Edit form
  const [form, setForm] = useState<FormState>({});
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  // Issue
  const [invoiceToIssue, setInvoiceToIssue] = useState<Invoice | null>(null);
  // Cancel (needs a reason)
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);
  // Regenerate PDF (needs a reason)
  const [invoiceToRegenerate, setInvoiceToRegenerate] = useState<Invoice | null>(null);
  const [regenerateReason, setRegenerateReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  // Any row action in progress (blocks double clicks)
  const [busy, setBusy] = useState(false);

  // Customer check in the Add drawer: GET /invoices/outstanding or /invoices/creditable
  const [lookupView, setLookupView] = useState<CustomerView>("OUTSTANDING");
  const [lookupCustomerId, setLookupCustomerId] = useState("");
  const [lookupRows, setLookupRows] = useState<Invoice[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const invoiceStatuses = useInvoiceEnum("INVOICE_STATUS", INVOICE_STATUS_FALLBACK);
  const statusLabel = (code?: string) => invoiceStatuses.find((s) => s.code === code)?.label || code || "--";

  /* ---------------- Load ---------------- */

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setInvoices(asArray<Invoice>(res.data));
    } catch (err) {
      console.error("Error fetching invoices", err);
      ToasterService.error("Failed to load invoices");
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDispatches = async () => {
    if (!DISPATCH_LIST_URL) return; // no dispatch list API yet
    try {
      const res = await axios.get(DISPATCH_LIST_URL);
      setDispatches(asArray<DispatchOption>(res.data));
    } catch (err) {
      console.error("Error fetching sales dispatches", err);
      ToasterService.error("Failed to load sales dispatches for the Create form");
      setDispatches([]);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchDispatches();
    // Toolbar Refresh icon reloads the list and the dispatch dropdown
    const reload = () => {
      fetchInvoices();
      fetchDispatches();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Customer check (outstanding / creditable) ---------------- */

  /** Customers found in the invoice list (there is no customer list API on this page). */
  const customers = useMemo(() => {
    const map = new Map<number, string>();
    invoices.forEach((i) => {
      if (i.customerId && !map.has(i.customerId)) {
        map.set(i.customerId, [i.customerCode, i.customerName].filter(Boolean).join(" – ") || `Customer ${i.customerId}`);
      }
    });
    return [...map.entries()].map(([id, name]) => ({ id: String(id), name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  useEffect(() => {
    const option = VIEW_OPTIONS.find((o) => o.value === lookupView);
    if (!showFormModal || !option?.endpoint || !lookupCustomerId) {
      setLookupRows([]);
      return;
    }
    let active = true;
    setLookupLoading(true);
    axios
      .get(`${API_URL}/${option.endpoint}`, { params: { customerId: Number(lookupCustomerId) } })
      .then((res) => active && setLookupRows(asArray<Invoice>(res.data)))
      .catch((err) => {
        console.error(`Error loading ${option.label} invoices`, err);
        if (active) {
          ToasterService.error(apiError(err, `Failed to load ${option.label.toLowerCase()} invoices`));
          setLookupRows([]);
        }
      })
      .finally(() => active && setLookupLoading(false));
    return () => {
      active = false;
    };
  }, [showFormModal, lookupView, lookupCustomerId]);

  const lookupTotal = lookupRows.reduce((sum, i) => sum + Number(i.balanceAmount || 0), 0);

  /* ---------------- Cards: Total + one per status found ---------------- */

  const cards = useMemo<StatsCardOption<Invoice>[]>(() => {
    const present = new Set(invoices.map((i) => i.status).filter(Boolean) as string[]);
    const ordered = [
      ...invoiceStatuses.map((s) => s.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !invoiceStatuses.some((s) => s.code === code)),
    ].slice(0, 5);
    return [
      { key: "ALL", label: "Total Invoices", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: statusLabel(code),
        match: (i: Invoice) => i.status === code,
        tone: toneForStatus(code),
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, invoiceStatuses]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(invoices, cards);

  /* ---------------- Create / Edit ---------------- */

  const isDraft = (invoice: Invoice) => invoice.status === "DRAFT";
  const isClosed = (invoice: Invoice) => invoice.status === "CANCELLED" || invoice.status === "PAID";

  const openCreate = () => {
    setLookupView("OUTSTANDING");
    setLookupCustomerId("");
    setEditingInvoice(null);
    setForm({ invoiceDate: todayIso() });
    setShowFormModal(true);
  };

  /** Loads the latest copy of the invoice (GET /invoices/{id}) before editing. */
  const handleEdit = async (invoice: Invoice) => {
    let latest = invoice;
    try {
      const res = await axios.get<Invoice>(`${API_URL}/${invoice.id}`);
      latest = res.data || invoice;
    } catch (err) {
      console.error("Error loading invoice", err);
      ToasterService.error(apiError(err, "Could not load the latest invoice details"));
    }
    if (latest.status && latest.status !== "DRAFT") {
      ToasterService.error("Only draft invoices can be edited");
      fetchInvoices();
      return;
    }
    setEditingInvoice(latest);
    setForm({ invoiceDate: latest.invoiceDate?.slice(0, 10), remarks: latest.remarks || "" });
    setShowFormModal(true);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingInvoice(null);
    setForm({});
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingInvoice && !(Number(form.salesDispatchId) > 0)) {
      ToasterService.error(DISPATCH_LIST_URL ? "Choose a sales dispatch" : "Enter a valid Sales Dispatch ID");
      return;
    }
    if (!form.invoiceDate) {
      ToasterService.error("Invoice date is required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingInvoice) {
        const payload: UpdateInvoicePayload = {
          invoiceDate: form.invoiceDate,
          remarks: form.remarks?.trim() || undefined,
        };
        await axios.put(`${API_URL}/${editingInvoice.id}`, payload);
        ToasterService.success("Invoice updated successfully!");
      } else {
        const payload: CreateFromDispatchPayload = {
          salesDispatchId: Number(form.salesDispatchId),
          invoiceDate: form.invoiceDate,
          remarks: form.remarks?.trim() || undefined,
        };
        const res = await axios.post<Invoice>(`${API_URL}/from-dispatch`, payload);
        ToasterService.success(`Invoice ${res.data?.invoiceNumber || ""} created as a draft`.replace("  ", " "));
      }
      closeModal();
      await fetchInvoices();
    } catch (err) {
      console.error("Error saving invoice", err);
      ToasterService.error(apiError(err, "Failed to save invoice"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Issue / Cancel / Delete ---------------- */

  const confirmIssue = async () => {
    if (!invoiceToIssue || busy) return;
    setBusy(true);
    try {
      await axios.post(`${API_URL}/${invoiceToIssue.id}/issue`);
      ToasterService.success(`Invoice ${invoiceToIssue.invoiceNumber || ""} issued`);
      setInvoiceToIssue(null);
      fetchInvoices();
    } catch (err) {
      console.error("Error issuing invoice", err);
      ToasterService.error(apiError(err, "Failed to issue invoice"));
    } finally {
      setBusy(false);
    }
  };

  const submitCancel = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoiceToCancel || busy) return;
    if (!cancelReason.trim()) {
      ToasterService.error("Please enter a reason for cancelling");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API_URL}/${invoiceToCancel.id}/cancel`, { reason: cancelReason.trim() });
      ToasterService.success(`Invoice ${invoiceToCancel.invoiceNumber || ""} cancelled`);
      setInvoiceToCancel(null);
      setCancelReason("");
      fetchInvoices();
    } catch (err) {
      console.error("Error cancelling invoice", err);
      ToasterService.error(apiError(err, "Failed to cancel invoice"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || busy) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${invoiceToDelete.id}`);
      ToasterService.success("Invoice deleted successfully!");
      setInvoiceToDelete(null);
      fetchInvoices();
    } catch (err) {
      console.error("Error deleting invoice", err);
      ToasterService.error(apiError(err, "Failed to delete invoice"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- PDF ---------------- */

  /** Saves a downloaded file. */
  const saveFile = (data: BlobPart, fileName: string) => {
    const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
    const link = window.document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  /** Makes a new PDF version (POST /documents/pdf/regenerate) and downloads it. */
  const submitRegenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoiceToRegenerate || busy) return;
    if (!regenerateReason.trim()) {
      ToasterService.error("Please enter a reason for regenerating the PDF");
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post<InvoiceDocument>(`${API_URL}/${invoiceToRegenerate.id}/documents/pdf/regenerate`, {
        reason: regenerateReason.trim(),
      });
      const file = await axios.get(`${API_URL}/${invoiceToRegenerate.id}/documents/${res.data.id}/download`, { responseType: "blob" });
      saveFile(file.data, res.data.fileName || `${invoiceToRegenerate.invoiceNumber || "invoice"}.pdf`);
      ToasterService.success(`PDF version ${res.data.documentVersion ?? ""} generated`);
      setInvoiceToRegenerate(null);
      setRegenerateReason("");
    } catch (err) {
      console.error("Error regenerating invoice PDF", err);
      ToasterService.error(apiError(err, "Failed to regenerate invoice PDF"));
    } finally {
      setBusy(false);
    }
  };

  /** Downloads the latest PDF; generates it first if none exists yet. */
  const downloadPdf = async (invoice: Invoice) => {
    if (busy) return;
    setBusy(true);
    try {
      const list = await axios.get(`${API_URL}/${invoice.id}/documents`);
      const documents = asArray<InvoiceDocument>(list.data).sort(
        (a, b) => Number(b.documentVersion || 0) - Number(a.documentVersion || 0)
      );
      let document = documents[0];
      if (!document) {
        const generated = await axios.post<InvoiceDocument>(`${API_URL}/${invoice.id}/documents/pdf`);
        document = generated.data;
      }
      const file = await axios.get(`${API_URL}/${invoice.id}/documents/${document.id}/download`, { responseType: "blob" });
      saveFile(file.data, document.fileName || `${invoice.invoiceNumber || "invoice"}.pdf`);
    } catch (err) {
      console.error("Error downloading invoice PDF", err);
      ToasterService.error(apiError(err, "Failed to download invoice PDF"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- Table ---------------- */

  const rowActions = (invoice: Invoice, inDrawer = false) => {
    const buttonClass = inDrawer
      ? ICON_BUTTON_CLASS
      : "rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600";
    const iconClass = inDrawer ? "h-5 w-5" : "h-4 w-4";
    return (
      <>
        {canUpdate && isDraft(invoice) && (
          <button type="button" onClick={() => handleEdit(invoice)} className={buttonClass} title="Edit date / remarks">
            <PencilSquareIcon className={iconClass} />
          </button>
        )}
        {canUpdate && isDraft(invoice) && (
          <button type="button" onClick={() => setInvoiceToIssue(invoice)} className={buttonClass} title="Issue invoice">
            <PaperAirplaneIcon className={iconClass} />
          </button>
        )}
        {!isDraft(invoice) && (
          <button type="button" onClick={() => downloadPdf(invoice)} className={buttonClass} title="Download PDF" disabled={busy}>
            <DocumentArrowDownIcon className={iconClass} />
          </button>
        )}
        {canUpdate && !isDraft(invoice) && invoice.status !== "CANCELLED" && (
          <button type="button" onClick={() => setInvoiceToRegenerate(invoice)} className={buttonClass} title="Regenerate PDF">
            <ArrowPathIcon className={iconClass} />
          </button>
        )}
        {canUpdate && !isDraft(invoice) && !isClosed(invoice) && (
          <button type="button" onClick={() => setInvoiceToCancel(invoice)} className={buttonClass} title="Cancel invoice">
            <XCircleIcon className={iconClass} />
          </button>
        )}
        {canDelete && isDraft(invoice) && !inDrawer && (
          <button
            type="button"
            onClick={() => setInvoiceToDelete(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete draft"
          >
            <TrashIcon className={iconClass} />
          </button>
        )}
      </>
    );
  };

  const money = (key: keyof Invoice, label: string, width: string, bold = false): ColumnDef<Invoice> => ({
    key,
    label,
    sortable: true,
    filterable: false,
    headerClassName: `${width} text-right`,
    className: `${width} text-right`,
    sortValueGetter: (i) => Number(i[key] || 0),
    detailFormatter: (i) => formatAmount(i[key] as number, i.currencyCode),
    exportValueGetter: (i) => formatAmount(i[key] as number, i.currencyCode),
    render: (i) => (
      <span className={`text-sm ${bold ? "font-semibold text-slate-700" : "text-slate-600"}`}>{formatAmount(i[key] as number, i.currencyCode)}</span>
    ),
  });

  const date = (key: "invoiceDate" | "dueDate", label: string, width: string): ColumnDef<Invoice> => ({
    key,
    label,
    sortable: true,
    headerClassName: `${width} text-left`,
    className: width,
    exportValueGetter: (i) => (i[key] ? formatDisplayDate(i[key] as string) : ""),
    render: (i) => <span className="text-sm text-slate-600">{i[key] ? formatDisplayDate(i[key] as string) : "--"}</span>,
  });

  const tableColumns: ColumnDef<Invoice>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice Number",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (i) => <span className="text-sm font-semibold text-slate-900 truncate">{i.invoiceNumber || "--"}</span>,
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      headerClassName: "w-[17%] text-left",
      className: "w-[17%]",
      render: (i) => <span className="block truncate text-sm text-slate-600">{i.customerName || "--"}</span>,
    },
    date("invoiceDate", "Invoice Date", "w-[11%]"),
    date("dueDate", "Due Date", "w-[11%]"),
    money("grandTotal", "Grand Total", "w-[12%]", true),
    money("balanceAmount", "Balance", "w-[11%]"),
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[11%] text-left",
      className: "w-[11%]",
      filterOptions: invoiceStatuses.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (i) => statusLabel(i.status),
      exportValueGetter: (i) => statusLabel(i.status),
      render: (i) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[toneForStatus(i.status)]}`}>
          {statusLabel(i.status)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[13%] text-right pr-4",
      className: "w-[13%] text-right",
      render: (i) => <div className="flex items-center justify-end gap-0.5">{rowActions(i)}</div>,
    },
  ];

  const dispatchOptions = dispatches.map((d) => ({
    value: String(d.id),
    label: [d.dispatchNumber || d.salesDispatchNumber || `Dispatch ${d.id}`, d.customerName].filter(Boolean).join(" – "),
  }));

  return (
    <>
      <PageMeta title="Invoices" description="Manage sales invoices" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Invoices"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Invoice" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />


          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="invoiceDate"
            defaultSortOrder="desc"
            loading={isLoading}
            rowDetailsTitle={(i) => `Invoice ${i.invoiceNumber || ""}`.trim()}
            rowDetailsSubtitle="Sales invoice details"
            hiddenDetailKeys={["createdDate", "updatedDate"]}
            suspendRowDetails={showFormModal || Boolean(invoiceToCancel) || Boolean(invoiceToRegenerate)}
            rowDetailsActions={(i: Invoice) => <>{rowActions(i, true)}</>}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BanknotesIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No invoices found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all invoices</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                      Create your first invoice
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Create (from a dispatch) / Edit (date + remarks of a draft) */}
        <Dragger
          isOpen={showFormModal}
          title={editingInvoice ? `Edit Invoice ${editingInvoice.invoiceNumber || ""}` : "Add Invoice"}
          subtitle={
            editingInvoice
              ? "Only the date and remarks of a draft can be changed"
              : "Customer, items and totals are taken from the sales dispatch"
          }
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingInvoice ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {!editingInvoice &&
              (DISPATCH_LIST_URL ? (
                <SearchableSelect
                  label="Sales Dispatch"
                  value={form.salesDispatchId || ""}
                  options={dispatchOptions}
                  onChange={(value: string | number) => setForm({ ...form, salesDispatchId: String(value ?? "") })}
                  placeholder={dispatches.length ? "Search dispatch" : "No dispatches loaded"}
                  required
                />
              ) : (
                // Temporary until the dispatch list API exists: type the dispatch ID
                <FloatingInput
                  label="Sales Dispatch ID"
                  name="salesDispatchId"
                  type="number"
                  min={1}
                  step={1}
                  value={form.salesDispatchId || ""}
                  onChange={handleChange}
                  onKeyDown={(e) => ["e", "E", "+", "-", "."].includes(e.key) && e.preventDefault()}
                  onWheel={(e) => e.currentTarget.blur()}
                  required
                />
              ))}
            <FloatingDatePicker label="Invoice Date" name="invoiceDate" value={form.invoiceDate || ""} onChange={handleChange} required />
            <div className="md:col-span-2">
              <FloatingTextarea label="Remarks" name="remarks" rows={2} value={form.remarks || ""} onChange={handleChange} />
            </div>
          </div>

          {/* Optional: check a customer's open invoices before creating a new one */}
          {!editingInvoice && (
            <div className="mt-2 border-t border-slate-100 pt-4 dark:border-gray-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Customer Invoices</h3>
              <p className="mb-3 text-xs text-slate-400">Optional – see a customer's outstanding or creditable invoices before you create a new one.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FloatingSelect
                  label="Show"
                  name="lookupView"
                  value={lookupView}
                  includeEmptyOption={false}
                  onChange={(e) => setLookupView(e.target.value as CustomerView)}
                  options={VIEW_OPTIONS.map((o) => ({ id: o.value, name: o.label }))}
                />
                <SearchableSelect
                  label="Customer"
                  value={lookupCustomerId}
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(value: string | number) => setLookupCustomerId(String(value ?? ""))}
                  placeholder={customers.length ? "Search customer" : "No customers in the invoice list yet"}
                />
              </div>

              {lookupCustomerId &&
                (lookupLoading ? (
                  <p className="py-3 text-sm text-slate-500">Loading invoices…</p>
                ) : lookupRows.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500">
                    No {lookupView === "OUTSTANDING" ? "outstanding" : "creditable"} invoices for this customer.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Due Date</th>
                          <th className="px-3 py-2 text-right">Grand Total</th>
                          <th className="px-3 py-2 text-right">Balance</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                        {lookupRows.map((i) => (
                          <tr key={i.id}>
                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{i.invoiceNumber || "--"}</td>
                            <td className="px-3 py-2 text-slate-600">{i.invoiceDate ? formatDisplayDate(i.invoiceDate) : "--"}</td>
                            <td className="px-3 py-2 text-slate-600">{i.dueDate ? formatDisplayDate(i.dueDate) : "--"}</td>
                            <td className="px-3 py-2 text-right text-slate-600">{formatAmount(i.grandTotal, i.currencyCode)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatAmount(i.balanceAmount, i.currencyCode)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[toneForStatus(i.status)]}`}>
                                {statusLabel(i.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-gray-800">
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                            {lookupRows.length} invoice{lookupRows.length === 1 ? "" : "s"} · Total balance
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-gray-100">{formatMoney(lookupTotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
            </div>
          )}
        </Dragger>

        {/* Regenerate PDF needs a reason */}
        <Dragger
          isOpen={Boolean(invoiceToRegenerate)}
          variant="modal"
          compact
          title={`Regenerate PDF – ${invoiceToRegenerate?.invoiceNumber || ""}`}
          subtitle="Creates a new PDF version and downloads it"
          onClose={() => {
            setInvoiceToRegenerate(null);
            setRegenerateReason("");
          }}
          onSubmit={submitRegenerate}
          submitting={busy}
          submitLabel="Regenerate"
        >
          <FloatingTextarea label="Reason" name="regenerateReason" rows={3} value={regenerateReason} onChange={(e) => setRegenerateReason(e.target.value)} required />
        </Dragger>

        {/* Cancel needs a reason */}
        <Dragger
          isOpen={Boolean(invoiceToCancel)}
          variant="modal"
          compact
          title={`Cancel Invoice ${invoiceToCancel?.invoiceNumber || ""}`}
          subtitle="This cannot be undone"
          onClose={() => {
            setInvoiceToCancel(null);
            setCancelReason("");
          }}
          onSubmit={submitCancel}
          submitting={busy}
          submitLabel="Cancel Invoice"
        >
          <FloatingTextarea label="Reason" name="reason" rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
        </Dragger>

        <DynamicPopup
          isPopupOpen={Boolean(invoiceToIssue)}
          setIsPopupOpen={(open: boolean) => !open && setInvoiceToIssue(null)}
          icon={<PaperAirplaneIcon className="h-6 w-6 text-cyan-600" />}
          iconBg="bg-cyan-100"
          innerText="Issue Invoice"
          subText={`Issue "${invoiceToIssue?.invoiceNumber || "this invoice"}"? After issuing, it can no longer be edited or deleted.`}
          confirmLabel={busy ? "Issuing..." : "Issue"}
          cancelLabel="Cancel"
          onConfirm={confirmIssue}
          onCancel={() => setInvoiceToIssue(null)}
          confirmBtnClass="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white"
        />

        <DynamicPopup
          isPopupOpen={Boolean(invoiceToDelete)}
          setIsPopupOpen={(open: boolean) => !open && setInvoiceToDelete(null)}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Draft Invoice"
          subText={`Are you sure you want to delete "${invoiceToDelete?.invoiceNumber || "this invoice"}"? This action cannot be undone.`}
          confirmLabel={busy ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setInvoiceToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default Invoices;
