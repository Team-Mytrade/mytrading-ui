import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  ReceiptRefundIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { usePermissions } from "../../access/usePermissions";
import { INVOICE_API, apiError, dateLabel, labelOf, money, todayInput } from "./invoiceShared";
import { ActionButton, DialogFooter } from "./invoiceUi";
import BillFromGrnDialog from "./BillFromGrnDialog";
import { companyCurrency } from "../../company/format";

import { t } from "../../i18n/i18n";
interface PurchaseInvoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  // Input VAT: part of the total, or for reverse charge self-assessed on top of it
  taxableAmount?: number | null;
  taxAmount?: number | null;
  reverseCharge?: boolean | null;
  purchaseInvoiceStatus?: string;
  currency?: string;
  referenceNumber?: string;
  notes?: string;
  vendor?: { id: number; name?: string } | null;
  vendorId?: string;
  // Bills made from a goods receipt; their amount follows the receipt (corrections are debit notes)
  grnId?: number | null;
  grnNumber?: string | null;
  poNumber?: string | null;
}

/**
 * Fields accepted when creating or updating a purchase invoice. The payment status follows
 * the payable (vendor payments), so it is not sent.
 */
interface PurchaseInvoicePayload {
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount: number;
  taxAmount: number;
  reverseCharge: boolean;
  currency: string;
  referenceNumber?: string;
  notes?: string;
  vendor: { id: number };
}

interface Vendor {
  id: number;
  name: string;
}

const API_URL = `${INVOICE_API}/purchase-invoices`;
// Purchase and Finance share the vendor list kept in the common service
const COMMON_VENDORS_API = "/v1/api/common/vendors";
const PAGE_SIZE = 10;

const statusTone = (status?: string) => {
  switch (status) {
    case "PAID":
    case "COMPLETED":
    case "APPROVED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/40";
    case "PARTIALLY_PAID":
    case "PENDING":
      return "bg-yellow-50 text-yellow-700 border-yellow-200/40";
    case "OVERDUE":
    case "CANCELLED":
    case "VOID":
    case "REJECTED":
    case "FAILED":
      return "bg-red-50 text-red-700 border-red-200/40";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200/40";
  }
};

const PurchaseInvoices: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [form, setForm] = useState<Partial<PurchaseInvoice>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [billingFromGrn, setBillingFromGrn] = useState(false);
  const [debitFor, setDebitFor] = useState<PurchaseInvoice | null>(null);
  const [debitForm, setDebitForm] = useState({ amount: "", noteDate: todayInput(), reason: "" });
  const [debitBusy, setDebitBusy] = useState(false);

  const openDebitNote = (invoice: PurchaseInvoice) => {
    setDebitForm({ amount: "", noteDate: todayInput(), reason: "" });
    setDebitFor(invoice);
  };

  const saveDebitNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!debitFor) return;
    const amount = Number(debitForm.amount);
    if (!amount || amount <= 0) return ToasterService.error("Enter the debit note amount");
    if (!debitForm.reason.trim()) return ToasterService.error("Say what the debit note is for");
    setDebitBusy(true);
    try {
      await axios.post(`${INVOICE_API}/debit-notes`, {
        purchaseInvoiceId: debitFor.id,
        amount,
        noteDate: debitForm.noteDate || null,
        reason: debitForm.reason.trim(),
      }, { headers });
      ToasterService.success(`Debit note of ${money(amount, debitFor.currency)} taken off bill ${debitFor.invoiceNumber}`);
      setDebitFor(null);
      await fetchPurchaseInvoices();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the debit note"));
    } finally {
      setDebitBusy(false);
    }
  };

  useEffect(() => {
    fetchPurchaseInvoices();
    axios
      .get<Vendor[]>(COMMON_VENDORS_API, { headers })
      .then((res) => setVendors(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVendors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPurchaseInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<PurchaseInvoice[]>(API_URL, { headers });
      setPurchaseInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load purchase invoices"));
      setPurchaseInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.vendorId) {
      ToasterService.error("Choose the vendor");
      return;
    }
    if (!form.invoiceNumber?.trim()) {
      ToasterService.error("Enter the vendor's invoice number");
      return;
    }

    const totalAmount = Number(form.totalAmount ?? 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      ToasterService.error("Enter the bill amount");
      return;
    }

    const taxAmount = Number(form.taxAmount ?? 0);
    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      ToasterService.error("VAT cannot be negative");
      return;
    }
    if (!form.reverseCharge && taxAmount >= totalAmount) {
      ToasterService.error("The VAT must be less than the bill amount, which includes it");
      return;
    }

    const payload: PurchaseInvoicePayload = {
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate || undefined,
      dueDate: form.dueDate || undefined,
      totalAmount,
      taxAmount,
      reverseCharge: Boolean(form.reverseCharge),
      currency: form.currency?.trim() || companyCurrency(),
      referenceNumber: form.referenceNumber?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      vendor: { id: Number(form.vendorId) },
    };

    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload, { headers })
          : await axios.post<PurchaseInvoice>(API_URL, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Purchase invoice updated" : "Purchase invoice added; it is now in Accounts Payable");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchPurchaseInvoices();
      }
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to save purchase invoice"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setForm({ ...invoice, vendorId: invoice.vendor?.id ? String(invoice.vendor.id) : "" });
    setEditingId(invoice.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({ currency: companyCurrency(), vendorId: "" });
    setEditingId(null);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleDelete = (invoice: PurchaseInvoice) => {
    setInvoiceToDelete(invoice);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await axios.delete(`${API_URL}/${invoiceToDelete.id}`, { headers });
      ToasterService.success("Purchase invoice deleted successfully!");
      setShowDeletePopup(false);
      setInvoiceToDelete(null);
      fetchPurchaseInvoices();
    } catch (err) {
      setShowDeletePopup(false);
      ToasterService.error(apiError(err, "Failed to delete purchase invoice"));
    }
  };

  const filteredInvoices = useMemo(() => {
    return purchaseInvoices.filter((invoice) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (invoice.invoiceNumber || "").toLowerCase().includes(term) ||
        (invoice.vendor?.name || "").toLowerCase().includes(term) ||
        (invoice.referenceNumber || "").toLowerCase().includes(term) ||
        (invoice.purchaseInvoiceStatus || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "PAID") {
        matchesFilter = invoice.purchaseInvoiceStatus === "PAID";
      } else if (activeFilter === "OPEN") {
        matchesFilter = invoice.purchaseInvoiceStatus === "OPEN" || invoice.purchaseInvoiceStatus === "PARTIALLY_PAID";
      } else if (activeFilter === "OVERDUE") {
        matchesFilter = invoice.purchaseInvoiceStatus === "OVERDUE";
      }

      return matchesSearch && matchesFilter;
    });
  }, [purchaseInvoices, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: purchaseInvoices.length,
      paid: purchaseInvoices.filter((i) => i.purchaseInvoiceStatus === "PAID").length,
      open: purchaseInvoices.filter((i) => i.purchaseInvoiceStatus === "OPEN" || i.purchaseInvoiceStatus === "PARTIALLY_PAID").length,
      totalAmount: purchaseInvoices.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0),
    }),
    [purchaseInvoices]
  );

  const tableColumns: ColumnDef<PurchaseInvoice>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice Number",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (invoice) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {invoice.invoiceNumber || "N/A"}
            {invoice.grnNumber && (
              <span className="block text-xs font-normal text-slate-400">{t("from")} {invoice.grnNumber}{invoice.poNumber ? ` · ${invoice.poNumber}` : ""}</span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: "vendor",
      label: "Vendor",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      sortValueGetter: (invoice) => invoice.vendor?.name ?? "",
      render: (invoice) => <span className="text-sm text-slate-700">{invoice.vendor?.name ?? "—"}</span>,
    },
    {
      key: "invoiceDate",
      label: "Invoice Date",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {dateLabel(invoice.invoiceDate)}
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {dateLabel(invoice.dueDate)}
        </span>
      ),
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      sortable: true,
      headerClassName: "w-[13%] text-right",
      className: "w-[13%] text-right",
      sortValueGetter: (invoice) => Number(invoice.totalAmount || 0),
      render: (invoice) => (
        <span className="text-sm font-semibold text-slate-700">
          {money(invoice.totalAmount, invoice.currency)}
        </span>
      ),
    },
    {
      key: "taxAmount",
      label: "VAT",
      sortable: true,
      headerClassName: "w-[10%] text-right",
      className: "w-[10%] text-right",
      sortValueGetter: (invoice) => Number(invoice.taxAmount || 0),
      render: (invoice) => (
        <span className="text-sm text-slate-600" title={invoice.reverseCharge ? "Reverse charge: self-assessed, not paid to the vendor" : undefined}>
          {invoice.taxAmount ? money(invoice.taxAmount, invoice.currency) : "—"}
          {invoice.reverseCharge ? " (RC)" : ""}
        </span>
      ),
    },
    {
      key: "purchaseInvoiceStatus",
      label: "Status",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (invoice) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusTone(invoice.purchaseInvoiceStatus)}`}>
          {invoice.purchaseInvoiceStatus ? labelOf(invoice.purchaseInvoiceStatus) : "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[12%] text-right pr-4",
      className: "w-[12%] text-right",
      render: (invoice) => (
        <div className="flex items-center justify-end gap-0.5">
          {canCreate && ["OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.purchaseInvoiceStatus ?? "") && (
            <button
              type="button"
              onClick={() => openDebitNote(invoice)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600"
              title={t("Debit note")}
            >
              <ReceiptRefundIcon className="h-4 w-4" />
            </button>
          )}
          {canUpdate && (<button
            type="button"
            onClick={() => handleEdit(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title={t("Edit Purchase Invoice")}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>)}
          {canDelete && (<button
            type="button"
            onClick={() => handleDelete(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title={t("Delete Purchase Invoice")}
          >
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Purchase Invoices")} description="Manage purchase invoices" />
      <PageBreadcrumb pageTitle="Purchase Invoices" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {canCreate && (
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton icon={TruckIcon} label={t("Bill from GRN")} onClick={() => setBillingFromGrn(true)} />
              <AddButton onClick={openCreate} label={t("Add Purchase Invoice")} />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label={t("Total Invoices")}
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label={t("Paid")}
            value={stats.paid}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label={t("Open")}
            value={stats.open}
            gradient="from-yellow-50 to-amber-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard
            label={t("Total Amount")}
            value={money(stats.totalAmount)}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t("Search by number, vendor, reference or status...")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <FilterPopover
              title={t("Filter Purchase Invoices")}
              buttonLabel="Filters"
              label={t("Filter by Status")}
              value={activeFilter}
              options={[
                { label: "All Invoices", value: "ALL" },
                { label: "Paid", value: "PAID" },
                { label: "Open / Partial", value: "OPEN" },
                { label: "Overdue", value: "OVERDUE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredInvoices}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="invoiceNumber"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">{t("No purchase invoices found")}</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">{t("Try adjusting your search or filters")}</p>
              ) : (
                canCreate && <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  {t("Create your first purchase invoice")}
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={t(editingId !== null ? "Edit Purchase Invoice" : "Create New Purchase Invoice")}
          subtitle={t(editingId !== null ? "Update your invoice details" : "Add a new purchase invoice")}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={t(editingId !== null ? "Update Invoice" : "Create Invoice")}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingSelect
                  key="vendorId"
                  label={t("Vendor")}
                  name="vendorId"
                  value={form.vendorId || ""}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                  options={vendors.map((vendor) => ({ id: String(vendor.id), name: vendor.name }))}
                  required
                />,
                ...(vendors.length === 0
                  ? [
                      <p key="noVendors" className="text-xs text-amber-700">
                        {t("No vendors yet. Add them under Common → Vendors first.")}
                      </p>,
                    ]
                  : []),
                <FloatingInput
                  key="invoiceNumber"
                  label={t("Vendor's invoice number")}
                  name="invoiceNumber"
                  value={form.invoiceNumber || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="invoiceDate"
                  label={t("Invoice Date")}
                  name="invoiceDate"
                  type="date"
                  value={form.invoiceDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="dueDate"
                  label={t("Due Date")}
                  name="dueDate"
                  type="date"
                  value={form.dueDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="totalAmount"
                  label={form.grnId ? `Bill amount (from ${form.grnNumber}; correct it with a debit note)` : t("Bill amount (incl. tax)")}
                  name="totalAmount"
                  type="number"
                  value={form.totalAmount ?? ""}
                  onChange={handleChange}
                  disabled={Boolean(form.grnId)}
                  required
                />,
                <FloatingInput
                  key="taxAmount"
                  label={t(form.reverseCharge ? "VAT you account for (reverse charge)" : "VAT on the bill (input VAT)")}
                  name="taxAmount"
                  type="number"
                  value={form.taxAmount ?? ""}
                  onChange={handleChange}
                  disabled={Boolean(form.grnId)}
                />,
                <label key="reverseCharge" className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={Boolean(form.reverseCharge)}
                    disabled={Boolean(form.grnId)}
                    onChange={(e) => setForm({ ...form, reverseCharge: e.target.checked })}
                  />
                  Reverse charge (imported service: the vendor charged no VAT; you account for it)
                </label>,
                <FloatingInput
                  key="currency"
                  label={t("Currency")}
                  name="currency"
                  value={form.currency || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="referenceNumber"
                  label={t("Reference Number")}
                  name="referenceNumber"
                  value={form.referenceNumber || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="notes"
                  label={t("Notes")}
                  name="notes"
                  value={form.notes || ""}
                  onChange={handleChange}
                />,
              ],
            },
          ]}
        />

        <BillFromGrnDialog
          isOpen={billingFromGrn}
          onClose={() => setBillingFromGrn(false)}
          onCreated={fetchPurchaseInvoices}
        />

        <PaginatedPopup
          isOpen={Boolean(debitFor)}
          title={`Debit note on ${debitFor?.invoiceNumber ?? "bill"}`}
          subtitle={`${debitFor?.vendor?.name ?? ""} · reduces what is owed on this bill (returned goods get theirs from Purchase Returns)`}
          onClose={() => setDebitFor(null)}
          maxWidthClassName="max-w-lg"
          content={
            <form onSubmit={saveDebitNote} className="flex flex-col">
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
                <FloatingInput label={t("Amount")} name="amount" type="number" required value={debitForm.amount}
                  onChange={(event) => setDebitForm((current) => ({ ...current, amount: event.target.value }))} />
                <FloatingInput label={t("Date")} name="noteDate" type="date" value={debitForm.noteDate}
                  onChange={(event) => setDebitForm((current) => ({ ...current, noteDate: event.target.value }))} />
                <div className="sm:col-span-2">
                  <FloatingInput label={t("Reason (price difference, short supply…)")} name="reason" required value={debitForm.reason}
                    onChange={(event) => setDebitForm((current) => ({ ...current, reason: event.target.value }))} />
                </div>
              </div>
              <DialogFooter onCancel={() => setDebitFor(null)} submitLabel={t("Save debit note")} busy={debitBusy} />
            </form>
          }
        />

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText={t("Delete Purchase Invoice")}
          subText={
            invoiceToDelete
              ? `Are you sure you want to delete "${invoiceToDelete.invoiceNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this purchase invoice?"
          }
          confirmLabel={t("Delete")}
          cancelLabel={t("Cancel")}
          onConfirm={confirmDelete}
          onCancel={() => setInvoiceToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

      </div>
    </>
  );
};

export default PurchaseInvoices;
