import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  CheckCircleIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  EyeIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  ReceiptRefundIcon,
  TrashIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { FloatingInput, FloatingSelect1, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import {
  CREDIT_NOTE_TYPE_OPTIONS,
  INVOICE_API,
  INVOICE_STATUS_TONES,
  Invoice,
  apiError,
  dateLabel,
  isOpenInvoice,
  labelOf,
  money,
  saveBlob,
  todayInput,
} from "./invoiceShared";
import { ActionButton, DialogFooter, StatusBadge } from "./invoiceUi";

const API_URL = `${INVOICE_API}/invoices`;
const PAGE_SIZE = 10;

interface PendingDispatch {
  id: number;
  dispatchNumber?: string;
  dispatchDate?: string;
  salesOrderNumber?: string;
  customerName?: string;
}

interface CreditNote {
  id: number;
  creditNoteNumber: string;
  creditNoteDate?: string;
  amount: number;
  creditNoteType?: string;
  reason?: string;
  status: string;
  customerCreditAmount?: number;
}

interface InvoiceDocument {
  id: number;
  fileName: string;
  documentVersion: number;
  generatedAt?: string;
  status: string;
}

interface CustomerCredit {
  id: number;
  creditType: string;
  remainingAmount: number;
  reference?: string;
  creditDate?: string;
}

type Dialog = "generate" | "edit" | "cancel" | "creditNote" | "applyCredit" | null;

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, canUpdate, canDelete, canApprove, canExport } = usePermissions();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"issue" | "delete" | null>(null);

  // Generate from dispatch
  const [pendingDispatches, setPendingDispatches] = useState<PendingDispatch[] | null>(null);
  const [generateForm, setGenerateForm] = useState({ dispatchId: "", invoiceDate: todayInput(), remarks: "" });
  // Edit draft / cancel / credit note / apply credit
  const [editForm, setEditForm] = useState({ invoiceDate: "", remarks: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [creditNoteForm, setCreditNoteForm] = useState({ amount: "", creditNoteType: "DISCOUNT", reason: "" });
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [applyForm, setApplyForm] = useState({ creditId: "", amount: "", remarks: "" });
  // Detail extras
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [documents, setDocuments] = useState<InvoiceDocument[]>([]);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Invoice[]>(API_URL);
      const list = Array.isArray(res.data) ? res.data : [];
      setInvoices(list);
      setSelected((current) => (current ? list.find((invoice) => invoice.id === current.id) ?? null : null));
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load invoices"));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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
      const res = await axios.get<Invoice>(`${API_URL}/${invoiceId}`);
      setSelected(res.data);
      loadDetailExtras(res.data);
    } catch {
      setSelected(null);
    }
  };

  /* ---------------- Actions ---------------- */

  const openGenerate = async () => {
    setGenerateForm({ dispatchId: "", invoiceDate: todayInput(), remarks: "" });
    setPendingDispatches(null);
    setDialog("generate");
    try {
      const res = await axios.get<PendingDispatch[]>(`${API_URL}/pending-dispatches`);
      setPendingDispatches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setPendingDispatches([]);
      ToasterService.error(apiError(err, "Could not load the dispatches waiting for an invoice"));
    }
  };

  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!generateForm.dispatchId) {
      ToasterService.error("Choose the dispatch to invoice");
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post<Invoice>(`${API_URL}/from-dispatch`, {
        salesDispatchId: Number(generateForm.dispatchId),
        invoiceDate: generateForm.invoiceDate || null,
        remarks: generateForm.remarks.trim() || null,
      });
      ToasterService.success(`Draft invoice ${res.data.invoiceNumber} created. Check it and issue it.`);
      setDialog(null);
      await fetchInvoices();
      openDetail(res.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not generate the invoice"));
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await axios.put(`${API_URL}/${selected.id}`, { invoiceDate: editForm.invoiceDate || null, remarks: editForm.remarks });
      ToasterService.success("Draft updated");
      setDialog(null);
      await refreshSelected(selected.id);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not update the draft"));
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await axios.post(`${API_URL}/${selected.id}/issue`);
      ToasterService.success(`Invoice ${selected.invoiceNumber} issued`);
      setConfirm(null);
      await refreshSelected(selected.id);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not issue the invoice"));
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${selected.id}`);
      ToasterService.success(`Draft ${selected.invoiceNumber} deleted`);
      setConfirm(null);
      setSelected(null);
      await fetchInvoices();
    } catch (err) {
      setConfirm(null);
      ToasterService.error(apiError(err, "Could not delete the draft"));
    } finally {
      setBusy(false);
    }
  };

  const cancelInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!cancelReason.trim()) {
      ToasterService.error("Enter why the invoice is cancelled");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API_URL}/${selected.id}/cancel`, { reason: cancelReason.trim() });
      ToasterService.success(`Invoice ${selected.invoiceNumber} cancelled`);
      setDialog(null);
      await refreshSelected(selected.id);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not cancel the invoice"));
    } finally {
      setBusy(false);
    }
  };

  const createCreditNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(creditNoteForm.amount);
    if (!amount || amount <= 0) {
      ToasterService.error("Enter the credit amount");
      return;
    }
    if (!creditNoteForm.reason.trim()) {
      ToasterService.error("Enter the reason for the credit note");
      return;
    }
    setBusy(true);
    try {
      const created = await axios.post<CreditNote>(`${INVOICE_API}/credit-notes`, {
        invoiceId: selected.id,
        amount,
        creditNoteType: creditNoteForm.creditNoteType,
        reason: creditNoteForm.reason.trim(),
      });
      // A credit note counts once it is issued; issue it straight away
      const issued = await axios.post<CreditNote>(`${INVOICE_API}/credit-notes/${created.data.id}/issue`);
      const toCredit = Number(issued.data.customerCreditAmount || 0);
      ToasterService.success(
        toCredit > 0
          ? `Credit note ${issued.data.creditNoteNumber} issued; ${money(toCredit, selected.currencyCode)} went to the customer's credit`
          : `Credit note ${issued.data.creditNoteNumber} issued`
      );
      setDialog(null);
      await refreshSelected(selected.id);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not create the credit note"));
    } finally {
      setBusy(false);
    }
  };

  const openApplyCredit = async () => {
    if (!selected?.customerId) return;
    setApplyForm({ creditId: "", amount: "", remarks: "" });
    setCredits([]);
    setDialog("applyCredit");
    try {
      const res = await axios.get<CustomerCredit[]>(`${INVOICE_API}/customer-credits/customer/${selected.customerId}/available`);
      setCredits(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the customer's credits"));
    }
  };

  const applyCredit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(applyForm.amount);
    if (!applyForm.creditId || !amount || amount <= 0) {
      ToasterService.error("Choose a credit and the amount to apply");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${INVOICE_API}/customer-credits/${applyForm.creditId}/apply`, {
        invoiceId: selected.id,
        amount,
        remarks: applyForm.remarks.trim() || null,
      });
      ToasterService.success(`${money(amount, selected.currencyCode)} of credit applied to ${selected.invoiceNumber}`);
      setDialog(null);
      await refreshSelected(selected.id);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not apply the credit"));
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      // Reuse the latest generated PDF; create one the first time
      let document = documents.find((doc) => doc.status === "GENERATED");
      if (!document) {
        const res = await axios.post<InvoiceDocument>(`${API_URL}/${selected.id}/documents/pdf`);
        document = res.data;
      }
      const file = await axios.get(`${API_URL}/${selected.id}/documents/${document.id}/download`, { responseType: "blob" });
      saveBlob(file.data, document.fileName || `${selected.invoiceNumber}.pdf`);
      loadDetailExtras(selected);
    } catch (err: any) {
      ToasterService.error(
        err?.response?.status === 403
          ? "You don't have permission to download invoice PDFs (INVOICE:EXPORT). Ask your administrator for access."
          : apiError(err, "Could not create the invoice PDF")
      );
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- Table ---------------- */

  const filtered = useMemo(
    () => (statusFilter === "ALL" ? invoices : invoices.filter((invoice) => invoice.status === statusFilter)),
    [invoices, statusFilter]
  );

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
      render: (invoice) => (
        <button type="button" onClick={() => openDetail(invoice)} className="text-left">
          <span className="block text-sm font-semibold text-cyan-700 hover:underline">{invoice.invoiceNumber}</span>
          <span className="block text-xs text-slate-500">{invoice.salesDispatchNumber || invoice.salesOrderNumber || ""}</span>
        </button>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      render: (invoice) => <span className="text-sm text-slate-700">{invoice.customerName || `Customer #${invoice.customerId}`}</span>,
    },
    {
      key: "invoiceDate",
      label: "Date",
      sortable: true,
      render: (invoice) => <span className="text-sm text-slate-600">{dateLabel(invoice.invoiceDate)}</span>,
    },
    {
      key: "dueDate",
      label: "Due",
      sortable: true,
      render: (invoice) => <span className="text-sm text-slate-600">{dateLabel(invoice.dueDate)}</span>,
    },
    {
      key: "grandTotal",
      label: "Total",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (invoice) => Number(invoice.grandTotal || 0),
      render: (invoice) => <span className="text-sm font-medium text-slate-800">{money(invoice.grandTotal, invoice.currencyCode)}</span>,
    },
    {
      key: "balanceAmount",
      label: "Balance",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (invoice) => Number(invoice.balanceAmount || 0),
      render: (invoice) => <span className="text-sm text-slate-700">{money(invoice.balanceAmount, invoice.currencyCode)}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      filterOptions: Object.keys(INVOICE_STATUS_TONES).map((status) => ({ label: labelOf(status), value: status })),
      render: (invoice) => <StatusBadge status={invoice.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (invoice) => (
        <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => openDetail(invoice)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title="View invoice">
            <EyeIcon className="h-4 w-4" />
          </button>
          {isOpenInvoice(invoice.status) && canCreate && (
            <button
              type="button"
              onClick={() => navigate(`/paymentReceipts?customerId=${invoice.customerId}&invoiceId=${invoice.id}`)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
              title="Record payment"
            >
              <BanknotesIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  /* ---------------- Detail ---------------- */

  const detail = selected && (
    <div className="flex flex-col">
      <div className="max-h-[calc(100dvh-14rem)] space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xl font-semibold text-slate-900">{selected.invoiceNumber}</h4>
              <StatusBadge status={selected.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {selected.customerName} {selected.customerTaxNumber ? `· GSTIN ${selected.customerTaxNumber}` : ""}
            </p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div>Invoice date <strong className="text-slate-800">{dateLabel(selected.invoiceDate)}</strong></div>
            <div>Due <strong className="text-slate-800">{dateLabel(selected.dueDate)}</strong> {selected.paymentTerms ? `(${selected.paymentTerms})` : ""}</div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-slate-500">Sales order</dt><dd className="font-medium text-slate-800">{selected.salesOrderNumber || "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Dispatch</dt><dd className="font-medium text-slate-800">{selected.salesDispatchNumber || "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Customer reference</dt><dd className="font-medium text-slate-800">{selected.customerReference || "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Currency</dt><dd className="font-medium text-slate-800">{selected.currencyCode || "INR"}</dd></div>
        </dl>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(selected.items ?? []).map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{line.productName || line.productCode}</div>
                    <div className="text-xs text-slate-500">
                      {[line.productCode, line.batchNumber && `Batch ${line.batchNumber}`, line.serialNumbers?.length ? `S/N ${line.serialNumbers.join(", ")}` : ""].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{Number(line.quantity ?? 0)} {line.uom || ""}</td>
                  <td className="px-3 py-2 text-right">{money(line.unitPrice, selected.currencyCode)}</td>
                  <td className="px-3 py-2 text-right">{money(line.discountAmount, selected.currencyCode)}</td>
                  <td className="px-3 py-2 text-right">
                    {money(line.taxAmount, selected.currencyCode)}
                    <div className="text-xs text-slate-500">{line.taxCode || ""} {Number(line.taxRate ?? 0)}%</div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">{money(line.lineTotal, selected.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 text-sm">
            {selected.remarks && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</div>
                <p className="mt-1 whitespace-pre-line text-slate-700">{selected.remarks}</p>
              </div>
            )}
            {creditNotes.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Credit notes</div>
                <ul className="mt-1 space-y-1">
                  {creditNotes.map((note) => (
                    <li key={note.id} className="flex justify-between gap-2 text-slate-700">
                      <span>{note.creditNoteNumber} · {labelOf(note.creditNoteType)} · {labelOf(note.status)}</span>
                      <span className="font-medium">{money(note.amount, selected.currencyCode)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {documents.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDF versions</div>
                <ul className="mt-1 space-y-1 text-slate-600">
                  {documents.map((doc) => (
                    <li key={doc.id}>{doc.fileName} · {labelOf(doc.status)} · {dateLabel(doc.generatedAt)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <dl className="space-y-1 rounded-xl border border-slate-200 p-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{money(selected.subTotal, selected.currencyCode)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd>− {money(selected.discountAmount, selected.currencyCode)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd>{money(selected.taxAmount, selected.currencyCode)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900"><dt>Total</dt><dd>{money(selected.grandTotal, selected.currencyCode)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Paid</dt><dd>{money(selected.amountPaid, selected.currencyCode)}</dd></div>
            <div className="flex justify-between font-semibold text-cyan-700"><dt>Balance due</dt><dd>{money(selected.balanceAmount, selected.currencyCode)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
        {selected.status === "DRAFT" && canDelete && (
          <ActionButton tone="danger" icon={TrashIcon} label="Delete draft" onClick={() => setConfirm("delete")} disabled={busy} />
        )}
        {selected.status === "DRAFT" && canUpdate && (
          <ActionButton icon={PencilSquareIcon} label="Edit" disabled={busy} onClick={() => {
            setEditForm({ invoiceDate: selected.invoiceDate || "", remarks: selected.remarks || "" });
            setDialog("edit");
          }} />
        )}
        {selected.status === "DRAFT" && canApprove && (
          <ActionButton tone="primary" icon={CheckCircleIcon} label="Issue invoice" onClick={() => setConfirm("issue")} disabled={busy} />
        )}
        {isOpenInvoice(selected.status) && Number(selected.amountPaid || 0) === 0 && canApprove && (
          <ActionButton tone="danger" icon={NoSymbolIcon} label="Cancel invoice" disabled={busy} onClick={() => {
            setCancelReason("");
            setDialog("cancel");
          }} />
        )}
        {selected.status !== "DRAFT" && selected.status !== "CANCELLED" && selected.status !== "VOID" && canCreate && (
          <ActionButton icon={ReceiptRefundIcon} label="Credit note" disabled={busy} onClick={() => {
            setCreditNoteForm({ amount: "", creditNoteType: "DISCOUNT", reason: "" });
            setDialog("creditNote");
          }} />
        )}
        {isOpenInvoice(selected.status) && canCreate && (
          <ActionButton icon={DocumentPlusIcon} label="Apply credit" onClick={openApplyCredit} disabled={busy} />
        )}
        {selected.status !== "DRAFT" && canExport && (
          <ActionButton icon={ArrowDownTrayIcon} label={busy ? "Preparing…" : "Download PDF"} onClick={downloadPdf} disabled={busy} />
        )}
        {isOpenInvoice(selected.status) && canCreate && (
          <ActionButton tone="primary" icon={BanknotesIcon} label="Record payment" disabled={busy}
            onClick={() => navigate(`/paymentReceipts?customerId=${selected.customerId}&invoiceId=${selected.id}`)} />
        )}
      </div>
    </div>
  );

  const selectedCredit = credits.find((credit) => String(credit.id) === applyForm.creditId);

  return (
    <>
      <PageMeta title="Invoices" description="Sales invoices generated from dispatches" />
      <PageBreadcrumb
        pageTitle="Invoices"
        actions={canCreate ? <AddButton onClick={openGenerate} label="Generate invoice" /> : undefined}
      />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Outstanding" value={money(stats.outstanding)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Overdue invoices" value={stats.overdue} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
          <StatsCard label="Drafts to issue" value={stats.drafts} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
          <StatsCard label="Paid" value={stats.paid} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {["ALL", "DRAFT", "ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID", "CANCELLED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${statusFilter === status ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {status === "ALL" ? "All" : labelOf(status)}
            </button>
          ))}
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          searchable
          searchPlaceholder="Search by invoice, customer or dispatch…"
          searchFields={["invoiceNumber", "customerName", "salesDispatchNumber", "salesOrderNumber"]}
          onRowClick={openDetail}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-1 text-sm text-gray-500">No invoices yet</p>
              <p className="text-xs text-gray-400">Invoices are generated from confirmed sales dispatches.</p>
            </div>
          }
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
