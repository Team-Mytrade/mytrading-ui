import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { toFilterOptions, toSelectOptions, useInvoiceEnum } from "./invoiceEnums";

interface Invoice {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  customerId?: number;
  subTotal?: number;
  totalTax?: number;
  grandTotal?: number;
  amountPaid?: number;
  balance?: number;
  status?: string;
}

const API_URL = "/v1/api/invoice/invoices";
const PAGE_SIZE = 10;

const INVOICE_STATUS_FALLBACK = ["PAID", "UNPAID", "OVERDUE", "PARTIALLY_PAID", "CANCELLED", "DRAFT", "SENT", "VOID", "OTHER"];

const statusTones: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  PARTIALLY_PAID: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  UNPAID: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  SENT: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  OVERDUE: "bg-red-50 text-red-700 border-red-200/40",
  CANCELLED: "bg-red-50 text-red-700 border-red-200/40",
  VOID: "bg-red-50 text-red-700 border-red-200/40",
};

const Invoices: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [form, setForm] = useState<Partial<Invoice>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const invoiceStatuses = useInvoiceEnum("INVOICE_STATUS", INVOICE_STATUS_FALLBACK);

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<Invoice[]>(API_URL, { headers });
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching invoices", err);
      ToasterService.error("Failed to load invoices");
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.invoiceNumber?.trim()) {
      ToasterService.error("Invoice number is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Invoice updated successfully!" : "Invoice added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchInvoices();
      }
    } catch (err) {
      console.error("Error submitting invoice", err);
      ToasterService.error("Failed to save invoice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setForm(invoice);
    setEditingId(invoice.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({});
    setEditingId(null);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleDelete = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await axios.delete(`${API_URL}/${invoiceToDelete.id}`, { headers });
      ToasterService.success("Invoice deleted successfully!");
      setShowDeletePopup(false);
      setInvoiceToDelete(null);
      fetchInvoices();
    } catch (err) {
      console.error("Error deleting invoice", err);
      ToasterService.error("Failed to delete invoice");
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (invoice.invoiceNumber || "").toLowerCase().includes(term) ||
        (invoice.status || "").toLowerCase().includes(term) ||
        String(invoice.customerId || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter !== "ALL") matchesFilter = invoice.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [invoices, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: invoices.length,
      paid: invoices.filter((i) => i.status === "PAID").length,
      overdue: invoices.filter((i) => i.status === "OVERDUE").length,
      totalGrandTotal: invoices.reduce((sum, i) => sum + Number(i.grandTotal || 0), 0),
    }),
    [invoices]
  );

  const tableColumns: ColumnDef<Invoice>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice Number",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (invoice) => (
        <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
          {invoice.invoiceNumber || "N/A"}
        </span>
      ),
    },
    {
      key: "customerId",
      label: "Customer ID",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      sortValueGetter: (invoice) => Number(invoice.customerId || 0),
      render: (invoice) => (
        <span className="text-sm text-slate-600 truncate">{invoice.customerId || "N/A"}</span>
      ),
    },
    {
      key: "invoiceDate",
      label: "Invoice Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (invoice) => (
        <span className="text-sm text-slate-600 truncate">{invoice.invoiceDate || "N/A"}</span>
      ),
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (invoice) => Number(invoice.grandTotal || 0),
      render: (invoice) => (
        <span className="text-sm font-medium text-slate-700">
          {Number(invoice.grandTotal || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "amountPaid",
      label: "Amount Paid",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (invoice) => Number(invoice.amountPaid || 0),
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {Number(invoice.amountPaid || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (invoice) => Number(invoice.balance || 0),
      render: (invoice) => (
        <span className="text-sm text-slate-600">
          {Number(invoice.balance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (invoice) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
          statusTones[invoice.status || "OTHER"] || "bg-gray-50 text-gray-700 border-gray-200/40"
        }`}>
          {invoice.status || "OTHER"}
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
          <button
            type="button"
            onClick={() => handleEdit(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Invoice"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(invoice)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Invoice"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Invoices" description="Manage invoice invoices" />
      <PageBreadcrumb pageTitle="Invoices" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Invoice" />
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
            label="Overdue"
            value={stats.overdue}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
          <StatsCard
            label="Total Grand Total"
            value={stats.totalGrandTotal.toLocaleString()}
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
                placeholder="Search invoices by number, status, or customer..."
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
              title="Filter Invoices"
              buttonLabel="Filters"
              label="Filter by Status"
              value={activeFilter}
              options={[
                { label: "All Invoices", value: "ALL" },
                ...toFilterOptions(invoiceStatuses),
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
              <BanknotesIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No invoices found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first invoice
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Invoice" : "Create New Invoice"}
          subtitle={editingId !== null ? "Update your invoice details" : "Add a new invoice"}
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
                  label="Invoice Number"
                  name="invoiceNumber"
                  value={form.invoiceNumber || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  label="Invoice Date"
                  name="invoiceDate"
                  type="date"
                  value={form.invoiceDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Due Date"
                  name="dueDate"
                  type="date"
                  value={form.dueDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Customer ID"
                  name="customerId"
                  type="number"
                  value={form.customerId ?? ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  label="Status"
                  name="status"
                  value={form.status || ""}
                  options={toSelectOptions(invoiceStatuses)}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Sub Total"
                  name="subTotal"
                  type="number"
                  value={form.subTotal ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Total Tax"
                  name="totalTax"
                  type="number"
                  value={form.totalTax ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Grand Total"
                  name="grandTotal"
                  type="number"
                  value={form.grandTotal ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Amount Paid"
                  name="amountPaid"
                  type="number"
                  value={form.amountPaid ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Balance"
                  name="balance"
                  type="number"
                  value={form.balance ?? ""}
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
          innerText="Delete Invoice"
          subText={
            invoiceToDelete
              ? `Are you sure you want to delete "${invoiceToDelete.invoiceNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this invoice?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setInvoiceToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

        <style>{`
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.25s ease-out;
          }
        `}</style>
      </div>
    </>
  );
};

export default Invoices;
