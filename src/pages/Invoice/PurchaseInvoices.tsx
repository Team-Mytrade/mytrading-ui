import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
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
import { toSelectOptions, useInvoiceEnum } from "./invoiceEnums";

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
}

/**
 * Fields accepted when creating or updating a purchase invoice.
 * Server-maintained fields (id, createdDate, updatedDate, createdBy, tenantId)
 * are deliberately excluded and must be assigned by the API.
 */
interface PurchaseInvoicePayload {
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount: number;
  purchaseInvoiceStatus: string;
  currency: string;
  referenceNumber?: string;
  notes?: string;
}

const API_URL = "/v1/api/invoice/purchase-invoices";
const PAGE_SIZE = 10;

const PURCHASE_INVOICE_STATUS_FALLBACK = ["OPEN", "PARTIALLY_PAID", "PAID", "CANCELLED", "OVERDUE", "DRAFT", "VOID", "RETURNED", "APPROVED", "REJECTED", "PENDING", "COMPLETED", "FAILED", "REFUNDED", "CHARGEBACK", "WRITE_OFF", "OTHER"];

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
  const purchaseInvoiceStatuses = useInvoiceEnum("PURCHASE_INVOICE_STATUS", PURCHASE_INVOICE_STATUS_FALLBACK);

  useEffect(() => {
    fetchPurchaseInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPurchaseInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<PurchaseInvoice[]>(API_URL, { headers });
      setPurchaseInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching purchase invoices", err);
      ToasterService.error("Failed to load purchase invoices");
      setPurchaseInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.invoiceNumber?.trim()) {
      ToasterService.error("Invoice number is required");
      return;
    }

    const totalAmount = Number(form.totalAmount ?? 0);
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      ToasterService.error("Total amount must be a valid non-negative number");
      return;
    }

    const payload: PurchaseInvoicePayload = {
      invoiceNumber: form.invoiceNumber.trim(),
      invoiceDate: form.invoiceDate || undefined,
      dueDate: form.dueDate || undefined,
      totalAmount,
      purchaseInvoiceStatus: form.purchaseInvoiceStatus || "OPEN",
      currency: form.currency?.trim() || "INR",
      referenceNumber: form.referenceNumber?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post<PurchaseInvoice>(API_URL, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Purchase invoice updated successfully!" : "Purchase invoice added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchPurchaseInvoices();
      }
    } catch (err) {
      console.error("Error submitting purchase invoice", err);
      ToasterService.error("Failed to save purchase invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setForm(invoice);
    setEditingId(invoice.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({ currency: "INR", purchaseInvoiceStatus: "OPEN", totalAmount: 0 });
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
      console.error("Error deleting purchase invoice", err);
      ToasterService.error("Failed to delete purchase invoice");
    }
  };

  const filteredInvoices = useMemo(() => {
    return purchaseInvoices.filter((invoice) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (invoice.invoiceNumber || "").toLowerCase().includes(term) ||
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
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
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
      key: "invoiceDate",
      label: "Invoice Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "totalAmount",
      label: "Total Amount",
      sortable: true,
      headerClassName: "w-[15%] text-right",
      className: "w-[15%] text-right",
      sortValueGetter: (invoice) => Number(invoice.totalAmount || 0),
      render: (invoice) => (
        <span className="text-sm font-semibold text-slate-700">
          {Number(invoice.totalAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "purchaseInvoiceStatus",
      label: "Status",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (invoice) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusTone(invoice.purchaseInvoiceStatus)}`}>
          {invoice.purchaseInvoiceStatus || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[25%] text-right pr-4",
      className: "w-[25%] text-right",
      render: (invoice) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Purchase Invoice"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Purchase Invoice"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Purchase Invoices" description="Manage purchase invoices" />
      <PageBreadcrumb pageTitle="Purchase Invoices" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Purchase Invoice" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Invoices"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Paid"
            value={stats.paid}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Open"
            value={stats.open}
            gradient="from-yellow-50 to-amber-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard
            label="Total Amount"
            value={stats.totalAmount.toLocaleString()}
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
                placeholder="Search invoices by number, reference, or status..."
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
              title="Filter Purchase Invoices"
              buttonLabel="Filters"
              label="Filter by Status"
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
              <p className="text-gray-500 text-sm mb-2">No purchase invoices found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first purchase invoice
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Purchase Invoice" : "Create New Purchase Invoice"}
          subtitle={editingId !== null ? "Update your invoice details" : "Add a new purchase invoice"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Invoice" : "Create Invoice"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="invoiceNumber"
                  label="Invoice Number"
                  name="invoiceNumber"
                  value={form.invoiceNumber || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="invoiceDate"
                  label="Invoice Date"
                  name="invoiceDate"
                  type="date"
                  value={form.invoiceDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="dueDate"
                  label="Due Date"
                  name="dueDate"
                  type="date"
                  value={form.dueDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="totalAmount"
                  label="Total Amount"
                  name="totalAmount"
                  type="number"
                  value={form.totalAmount ?? ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  key="purchaseInvoiceStatus"
                  label="Status"
                  name="purchaseInvoiceStatus"
                  value={form.purchaseInvoiceStatus || ""}
                  onChange={(e) => setForm({ ...form, purchaseInvoiceStatus: e.target.value })}
                  options={toSelectOptions(purchaseInvoiceStatuses)}
                />,
                <FloatingInput
                  key="currency"
                  label="Currency"
                  name="currency"
                  value={form.currency || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="referenceNumber"
                  label="Reference Number"
                  name="referenceNumber"
                  value={form.referenceNumber || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="notes"
                  label="Notes"
                  name="notes"
                  value={form.notes || ""}
                  onChange={handleChange}
                />,
              ],
            },
          ]}
        />

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
          confirmLabel="Delete"
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
