import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface PaymentReceipt {
  id: number;
  receiptNumber?: string;
  paymentDate?: string;
  customerId?: number;
  totalAmountReceived?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  receivedBy?: string;
  notes?: string;
  invoiceId?: number;
}

const API_URL = "/v1/api/invoice/receipts";
const PAGE_SIZE = 10;

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CHECK", "CREDIT_CARD", "OTHER"];

const paymentMethodTone = (method?: string) => {
  switch (method) {
    case "CASH":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/40";
    case "BANK_TRANSFER":
      return "bg-blue-50 text-blue-700 border-blue-200/40";
    case "CREDIT_CARD":
      return "bg-purple-50 text-purple-700 border-purple-200/40";
    case "CHECK":
      return "bg-yellow-50 text-yellow-700 border-yellow-200/40";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200/40";
  }
};

const PaymentReceipts: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [form, setForm] = useState<Partial<PaymentReceipt>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<PaymentReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<{id:number;invoiceNumber?:string;customerId?:number}[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchReceipts();
    axios.get("/v1/api/invoice/invoices", { headers }).then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReceipts = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<PaymentReceipt[]>(API_URL, { headers });
      setReceipts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching payment receipts", err);
      ToasterService.error("Failed to load payment receipts");
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.receiptNumber?.trim()) {
      ToasterService.error("Receipt number is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        receiptNumber: form.receiptNumber,
        paymentDate: form.paymentDate,
        customerId: form.customerId ? Number(form.customerId) : undefined,
        totalAmountReceived: form.totalAmountReceived ? Number(form.totalAmountReceived) : undefined,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber,
        receivedBy: form.receivedBy,
        notes: form.notes,
      };
      if (form.invoiceId) payload.invoice = { id: Number(form.invoiceId) };
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload, { headers })
          : await axios.post(API_URL, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Payment receipt updated successfully!" : "Payment receipt added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchReceipts();
      }
    } catch (err) {
      console.error("Error submitting payment receipt", err);
      ToasterService.error("Failed to save payment receipt");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (receipt: PaymentReceipt) => {
    setForm(receipt);
    setEditingId(receipt.id);
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

  const handleDelete = (receipt: PaymentReceipt) => {
    setReceiptToDelete(receipt);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!receiptToDelete) return;
    try {
      await axios.delete(`${API_URL}/${receiptToDelete.id}`, { headers });
      ToasterService.success("Payment receipt deleted successfully!");
      setShowDeletePopup(false);
      setReceiptToDelete(null);
      fetchReceipts();
    } catch (err) {
      console.error("Error deleting payment receipt", err);
      ToasterService.error("Failed to delete payment receipt");
    }
  };

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (receipt.receiptNumber || "").toLowerCase().includes(term) ||
        (receipt.referenceNumber || "").toLowerCase().includes(term) ||
        (receipt.paymentMethod || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "CASH") {
        matchesFilter = receipt.paymentMethod === "CASH";
      } else if (activeFilter === "BANK_TRANSFER") {
        matchesFilter = receipt.paymentMethod === "BANK_TRANSFER";
      } else if (activeFilter === "CREDIT_CARD") {
        matchesFilter = receipt.paymentMethod === "CREDIT_CARD";
      }

      return matchesSearch && matchesFilter;
    });
  }, [receipts, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalReceipts: receipts.length,
      withPaymentMethod: receipts.filter((r) => (r.paymentMethod || "").trim() !== "").length,
      totalAmountReceived: receipts.reduce((acc, r) => acc + Number(r.totalAmountReceived || 0), 0),
    }),
    [receipts]
  );

  const tableColumns: ColumnDef<PaymentReceipt>[] = [
    {
      key: "receiptNumber",
      label: "Receipt Number",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (receipt) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CreditCardIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {receipt.receiptNumber || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer ID",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (receipt) => (
        <span className="text-sm text-slate-600 truncate">{receipt.customerId || "N/A"}</span>
      ),
    },
    {
      key: "totalAmountReceived",
      label: "Total Amount Received",
      sortable: true,
      headerClassName: "w-[15%] text-right",
      className: "w-[15%] text-right",
      sortValueGetter: (receipt) => Number(receipt.totalAmountReceived || 0),
      render: (receipt) => (
        <span className="text-sm font-semibold text-slate-700">
          {Number(receipt.totalAmountReceived || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (receipt) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${paymentMethodTone(receipt.paymentMethod)}`}>
          {receipt.paymentMethod || "N/A"}
        </span>
      ),
    },
    {
      key: "referenceNumber",
      label: "Reference Number",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (receipt) => (
        <span className="text-sm text-slate-600 truncate">{receipt.referenceNumber || "N/A"}</span>
      ),
    },
    {
      key: "paymentDate",
      label: "Payment Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (receipt) => (
        <span className="text-sm text-slate-600">
          {receipt.paymentDate ? new Date(receipt.paymentDate).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[8%] text-right pr-4",
      className: "w-[8%] text-right",
      render: (receipt) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(receipt)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Receipt"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(receipt)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Receipt"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Payment Receipts" description="Manage payment receipts" />
      <PageBreadcrumb pageTitle="Payment Receipts" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Payment Receipt" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Receipts"
            value={stats.totalReceipts}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="With Payment Method"
            value={stats.withPaymentMethod}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Amount Received"
            value={stats.totalAmountReceived.toLocaleString()}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredReceipts.length}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search receipts by number, reference, or method..."
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
              title="Filter Payment Receipts"
              buttonLabel="Filters"
              label="Filter by Payment Method"
              value={activeFilter}
              options={[
                { label: "All Receipts", value: "ALL" },
                { label: "Cash", value: "CASH" },
                { label: "Bank Transfer", value: "BANK_TRANSFER" },
                { label: "Credit Card", value: "CREDIT_CARD" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredReceipts}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="receiptNumber"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCardIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No payment receipts found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first payment receipt
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Payment Receipt" : "Create New Payment Receipt"}
          subtitle={editingId !== null ? "Update your receipt details" : "Add a new payment receipt"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Receipt" : "Create Receipt"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="receiptNumber"
                  label="Receipt Number"
                  name="receiptNumber"
                  value={form.receiptNumber || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  key="paymentDate"
                  label="Payment Date"
                  name="paymentDate"
                  type="date"
                  value={form.paymentDate || ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  key="invoiceId"
                  label="Invoice"
                  name="invoiceId"
                  value={form.invoiceId ?? ""}
                  onChange={(e) => setForm({ ...form, invoiceId: e.target.value ? Number(e.target.value) : undefined })}
                  options={invoices.map((inv) => ({ id: String(inv.id), name: inv.invoiceNumber || `Invoice ${inv.id}` }))}
                />,
                <FloatingInput
                  key="totalAmountReceived"
                  label="Total Amount Received"
                  name="totalAmountReceived"
                  type="number"
                  value={form.totalAmountReceived ?? ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  key="paymentMethod"
                  label="Payment Method"
                  name="paymentMethod"
                  value={form.paymentMethod || ""}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  options={PAYMENT_METHODS.map((m) => ({ id: m, name: m }))}
                />,
                <FloatingInput
                  key="referenceNumber"
                  label="Reference Number"
                  name="referenceNumber"
                  value={form.referenceNumber || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="receivedBy"
                  label="Received By"
                  name="receivedBy"
                  value={form.receivedBy || ""}
                  onChange={handleChange}
                />,
                <FloatingTextarea
                  key="notes"
                  label="Notes"
                  name="notes"
                  value={form.notes || ""}
                  onChange={handleChange}
                  rows={3}
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
          innerText="Delete Payment Receipt"
          subText={
            receiptToDelete
              ? `Are you sure you want to delete "${receiptToDelete.receiptNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this payment receipt?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setReceiptToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />


      </div>
    </>
  );
};

export default PaymentReceipts;
