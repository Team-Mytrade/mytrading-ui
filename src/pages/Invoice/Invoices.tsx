import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dispatches, setDispatches] = useState<DispatchOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Create / Edit form
  const [form, setForm] = useState<FormState>({});
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dispatchId = Number(searchParams.get("dispatchId"));
    if (!canCreate || !Number.isSafeInteger(dispatchId) || dispatchId <= 0) return;
    setEditingInvoice(null);
    setForm({ salesDispatchId: String(dispatchId), invoiceDate: todayIso() });
    setShowFormModal(true);
    const remaining = new URLSearchParams(searchParams);
    remaining.delete("dispatchId");
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams, canCreate]);

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

  // Opened with ?invoiceId= (e.g. from a receipt): show that invoice once the list is in
  useEffect(() => {
    const invoiceId = Number(searchParams.get("invoiceId"));
    if (!invoiceId || !invoices.length) return;
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (invoice) openDetail(invoice);
    searchParams.delete("invoiceId");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  const loadDetailExtras = async (invoice: Invoice) => {
    setCreditNotes([]);
    setDocuments([]);
    if (invoice.status === "DRAFT") return;
    const [notes, docs] = await Promise.allSettled([
      axios.get<CreditNote[]>(`${INVOICE_API}/credit-notes`, { params: { invoiceId: invoice.id } }),
      canExport ? axios.get<InvoiceDocument[]>(`${API_URL}/${invoice.id}/documents`) : Promise.resolve({ data: [] as InvoiceDocument[] }),
    ]);
    if (notes.status === "fulfilled") setCreditNotes(Array.isArray(notes.value.data) ? notes.value.data : []);
    if (docs.status === "fulfilled") setDocuments(Array.isArray(docs.value.data) ? docs.value.data : []);
  };

  const openDetail = (invoice: Invoice) => {
    setSelected(invoice);
    loadDetailExtras(invoice);
  };

  const refreshSelected = async (invoiceId: number) => {
    await fetchInvoices();
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
    if (submitting) return;
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
      setBusy(false);
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
    if (cancelReason.trim().length > 500) return ToasterService.error("Cancellation reason must be 500 characters or fewer");
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
    if (regenerateReason.trim().length > 500) return ToasterService.error("Regeneration reason must be 500 characters or fewer");
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
      let document = documents.find((item) => item.status === "GENERATED");
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

  /** Retrieve complete invoice lines before displaying a draft or issued invoice. */
  const reviewInvoice = async (invoice: Invoice) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await axios.get<Invoice>(`${API_URL}/${invoice.id}`);
      setDetailInvoice(data);
    } catch (error) { ToasterService.error(apiError(error, "Unable to load invoice details")); }
    finally { setBusy(false); }
  };

  const rowActions = (invoice: Invoice, inDrawer = false) => {
    const buttonClass = inDrawer
      ? ICON_BUTTON_CLASS
      : "rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600";
    const iconClass = inDrawer ? "h-5 w-5" : "h-4 w-4";
    return (
      <>
        <button type="button" disabled={busy} onClick={() => reviewInvoice(invoice)} className="px-2 text-sm font-semibold text-cyan-700">Review</button>
        {!isDraft(invoice) && !isClosed(invoice) && Number(invoice.balanceAmount) > 0 && invoice.customerId && <button type="button" onClick={() => navigate(`/paymentReceipts?customerId=${invoice.customerId}`)} className="px-2 text-sm font-semibold text-cyan-700">Record Payment</button>}
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
        {["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"].includes(invoice.status || "") && (
          <button type="button" onClick={() => downloadPdf(invoice)} className={buttonClass} title="Download PDF" disabled={busy}>
            <DocumentArrowDownIcon className={iconClass} />
          </button>
        )}
        {canUpdate && ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"].includes(invoice.status || "") && (
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

  const stats = useMemo(() => {
    const open = invoices.filter((invoice) => isOpenInvoice(invoice.status));
    return {
      drafts: invoices.filter((invoice) => invoice.status === "DRAFT").length,
      outstanding: open.reduce((sum, invoice) => sum + Number(invoice.balanceAmount || 0), 0),
      overdue: invoices.filter((invoice) => invoice.status === "OVERDUE").length,
      paid: invoices.filter((invoice) => invoice.status === "PAID").length,
    };
  }, [invoices]);

  const columns: ColumnDef<Invoice>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice",
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
            suspendRowDetails={showFormModal || Boolean(detailInvoice) || Boolean(invoiceToIssue) || Boolean(invoiceToCancel) || Boolean(invoiceToRegenerate)}
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

        <Dragger isOpen={Boolean(detailInvoice)} title={`Invoice ${detailInvoice?.invoiceNumber || ''}`} subtitle="Review the saved invoice before issuing or recording payment."
          onClose={() => setDetailInvoice(null)} onSubmit={(event) => event.preventDefault()} submitLabel="Close" showSubmit={false}>
          {detailInvoice && <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              {([['Status', detailInvoice.status], ['Customer', detailInvoice.customerName], ['Customer code', detailInvoice.customerCode], ['Tax number', detailInvoice.customerTaxNumber], ['Email', detailInvoice.customerEmail], ['Invoice date', detailInvoice.invoiceDate], ['Due date', detailInvoice.dueDate], ['Sales order', detailInvoice.salesOrderNumber], ['Dispatch', detailInvoice.salesDispatchNumber], ['Payment terms', detailInvoice.paymentTerms]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd>{value || '—'}</dd></div>)}
            </dl>
            {(detailInvoice.items || []).map((item, index) => <section key={item.id || index} className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-gray-700">
              <h3 className="font-semibold">{item.productName || item.description} · {item.productCode}</h3>
              <p>{item.quantity} {item.uom} × {formatAmount(item.unitPrice, detailInvoice.currencyCode)}</p>
              <p className="text-sm">Batch: {item.batchNumber || '—'} · Serials: {item.serialNumbers?.join(', ') || '—'}</p>
              <p className="text-sm">Discount: {formatAmount(item.discountAmount, detailInvoice.currencyCode)} · Tax: {item.taxCode || '—'} ({item.taxRate ?? 0}%) {formatAmount(item.taxAmount, detailInvoice.currencyCode)} · Line total: {formatAmount(item.lineTotal, detailInvoice.currencyCode)}</p>
            </section>)}
            <dl className="grid grid-cols-2 gap-3">{([['Subtotal', detailInvoice.subTotal], ['Discount', detailInvoice.discountAmount], ['Tax', detailInvoice.taxAmount], ['Grand total', detailInvoice.grandTotal], ['Paid', detailInvoice.amountPaid], ['Balance', detailInvoice.balanceAmount]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="font-semibold">{formatAmount(value, detailInvoice.currencyCode)}</dd></div>)}</dl>
            {canUpdate && isDraft(detailInvoice) && <button type="button" onClick={() => { setInvoiceToIssue(detailInvoice); setDetailInvoice(null); }} className="rounded-lg bg-cyan-600 px-4 py-2 text-white">Issue Invoice</button>}
          </div>}
        </Dragger>

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

      <PaginatedPopup
        isOpen={Boolean(selected) && !dialog && !confirm}
        title="Invoice"
        subtitle={selected ? `${selected.customerName ?? ""} · ${labelOf(selected.status)}` : ""}
        onClose={() => setSelected(null)}
        maxWidthClassName="max-w-4xl"
        content={detail || undefined}
      />

      {/* Generate from a confirmed dispatch */}
      <PaginatedPopup
        isOpen={dialog === "generate"}
        title="Generate invoice"
        subtitle="From a confirmed sales dispatch. The invoice starts as a draft you can check before issuing."
        onClose={() => setDialog(null)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={generate} className="flex flex-col">
            <div className="max-h-[60dvh] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              {pendingDispatches === null ? (
                <p className="text-sm text-slate-500">Loading dispatches…</p>
              ) : pendingDispatches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  <TruckIcon className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                  No confirmed dispatches are waiting for an invoice.
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingDispatches.map((dispatch) => (
                    <label
                      key={dispatch.id}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm transition ${generateForm.dispatchId === String(dispatch.id) ? "border-cyan-500 bg-cyan-50/60" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="dispatch"
                          checked={generateForm.dispatchId === String(dispatch.id)}
                          onChange={() => setGenerateForm((form) => ({ ...form, dispatchId: String(dispatch.id) }))}
                        />
                        <span>
                          <span className="block font-semibold text-slate-800">{dispatch.dispatchNumber}</span>
                          <span className="block text-xs text-slate-500">{dispatch.customerName} · {dispatch.salesOrderNumber}</span>
                        </span>
                      </span>
                      <span className="text-xs text-slate-500">{dateLabel(dispatch.dispatchDate)}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingInput label="Invoice date" name="invoiceDate" type="date" value={generateForm.invoiceDate}
                  onChange={(event) => setGenerateForm((form) => ({ ...form, invoiceDate: event.target.value }))} />
                <FloatingInput label="Remarks" name="remarks" value={generateForm.remarks}
                  onChange={(event) => setGenerateForm((form) => ({ ...form, remarks: event.target.value }))} />
              </div>
            </div>
            <DialogFooter onCancel={() => setDialog(null)} submitLabel="Create draft" busy={busy} disabled={!generateForm.dispatchId} />
          </form>
        }
      />

      {/* Edit draft */}
      <PaginatedPopup
        isOpen={dialog === "edit"}
        title={`Edit draft ${selected?.invoiceNumber ?? ""}`}
        subtitle="Lines, prices and taxes come from the sales order and dispatch."
        onClose={() => setDialog(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={saveDraft} className="flex flex-col">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <FloatingInput label="Invoice date" name="invoiceDate" type="date" value={editForm.invoiceDate}
                onChange={(event) => setEditForm((form) => ({ ...form, invoiceDate: event.target.value }))} />
              <FloatingTextarea label="Remarks" name="remarks" rows={3} value={editForm.remarks}
                onChange={(event) => setEditForm((form) => ({ ...form, remarks: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setDialog(null)} submitLabel="Save" busy={busy} />
          </form>
        }
      />

      {/* Cancel an issued invoice without payments */}
      <PaginatedPopup
        isOpen={dialog === "cancel"}
        title={`Cancel ${selected?.invoiceNumber ?? ""}`}
        subtitle="The receivable is closed and the invoice stays on record as cancelled."
        onClose={() => setDialog(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={cancelInvoice} className="flex flex-col">
            <div className="px-4 py-4 sm:px-5">
              <FloatingTextarea label="Reason" name="reason" rows={3} required value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)} />
            </div>
            <DialogFooter onCancel={() => setDialog(null)} submitLabel="Cancel invoice" busy={busy} danger />
          </form>
        }
      />

      {/* Credit note */}
      <PaginatedPopup
        isOpen={dialog === "creditNote"}
        title={`Credit note for ${selected?.invoiceNumber ?? ""}`}
        subtitle={`Reduces what the customer owes on this invoice (balance ${money(selected?.balanceAmount, selected?.currencyCode)}). Any amount beyond the balance becomes customer credit.`}
        onClose={() => setDialog(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={createCreditNote} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingInput label="Amount" name="amount" type="number" required value={creditNoteForm.amount}
                onChange={(event) => setCreditNoteForm((form) => ({ ...form, amount: event.target.value }))} />
              <FloatingSelect1 label="Type" name="creditNoteType" value={creditNoteForm.creditNoteType} options={CREDIT_NOTE_TYPE_OPTIONS}
                includeEmptyOption={false} onChange={(event) => setCreditNoteForm((form) => ({ ...form, creditNoteType: event.target.value }))} />
              <div className="sm:col-span-2">
                <FloatingTextarea label="Reason" name="reason" rows={3} required value={creditNoteForm.reason}
                  onChange={(event) => setCreditNoteForm((form) => ({ ...form, reason: event.target.value }))} />
              </div>
            </div>
            <DialogFooter onCancel={() => setDialog(null)} submitLabel="Issue credit note" busy={busy} />
          </form>
        }
      />

      {/* Apply an advance / overpayment / credit-note credit */}
      <PaginatedPopup
        isOpen={dialog === "applyCredit"}
        title={`Apply customer credit to ${selected?.invoiceNumber ?? ""}`}
        subtitle={`Balance due ${money(selected?.balanceAmount, selected?.currencyCode)}`}
        onClose={() => setDialog(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={applyCredit} className="flex flex-col">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              {credits.length === 0 ? (
                <p className="text-sm text-slate-500">This customer has no unused credit.</p>
              ) : (
                <>
                  <FloatingSelect1
                    label="Credit"
                    name="creditId"
                    value={applyForm.creditId}
                    options={credits.map((credit) => ({
                      id: String(credit.id),
                      name: `${labelOf(credit.creditType)} ${credit.reference ? `(${credit.reference})` : ""} · ${money(credit.remainingAmount, selected?.currencyCode)} left`,
                    }))}
                    onChange={(event) => {
                      const credit = credits.find((item) => String(item.id) === event.target.value);
                      const amount = credit ? Math.min(Number(credit.remainingAmount), Number(selected?.balanceAmount || 0)) : 0;
                      setApplyForm((form) => ({ ...form, creditId: event.target.value, amount: amount ? String(amount) : "" }));
                    }}
                  />
                  <FloatingInput label="Amount to apply" name="amount" type="number" value={applyForm.amount}
                    onChange={(event) => setApplyForm((form) => ({ ...form, amount: event.target.value }))} />
                  {selectedCredit && (
                    <p className="text-xs text-slate-500">
                      Up to {money(Math.min(Number(selectedCredit.remainingAmount), Number(selected?.balanceAmount || 0)), selected?.currencyCode)}
                    </p>
                  )}
                  <FloatingInput label="Remarks" name="remarks" value={applyForm.remarks}
                    onChange={(event) => setApplyForm((form) => ({ ...form, remarks: event.target.value }))} />
                </>
              )}
            </div>
            <DialogFooter onCancel={() => setDialog(null)} submitLabel="Apply credit" busy={busy} disabled={!credits.length} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={confirm === "issue"}
        title={`Issue ${selected?.invoiceNumber ?? "invoice"}?`}
        message={`The invoice becomes final and ${money(selected?.grandTotal, selected?.currencyCode)} is due from ${selected?.customerName ?? "the customer"} by ${dateLabel(selected?.dueDate)}. Issued invoices can't be edited.`}
        confirmLabel={busy ? "Issuing…" : "Issue"}
        variant="info"
        onConfirm={issue}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        isOpen={confirm === "delete"}
        title={`Delete draft ${selected?.invoiceNumber ?? ""}?`}
        message="The dispatch becomes available to invoice again."
        confirmLabel={busy ? "Deleting…" : "Delete"}
        variant="danger"
        onConfirm={deleteDraft}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
};

export default Invoices;
