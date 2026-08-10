import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserGroupIcon,
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
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface VendorPayment {
  id: number;
  paymentReference?: string;
  paymentDate?: string;
  vendorName?: string;
  invoiceNumber?: string;
  amountPaid?: number;
  paymentMethod?: string;
  paidBy?: string;
}

const API_URL = "/v1/api/invoice/vendor-payments";
const PAGE_SIZE = 10;

const VendorPayments: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [vendorPayments, setVendorPayments] = useState<VendorPayment[]>([]);
  const [form, setForm] = useState<Partial<VendorPayment>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<VendorPayment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVendorPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchVendorPayments = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<VendorPayment[]>(API_URL, { headers });
      setVendorPayments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching vendor payments", err);
      ToasterService.error("Failed to load vendor payments");
      setVendorPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.paymentReference?.trim()) {
      ToasterService.error("Payment reference is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Vendor payment updated successfully!" : "Vendor payment added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchVendorPayments();
      }
    } catch (err) {
      console.error("Error submitting vendor payment", err);
      ToasterService.error("Failed to save vendor payment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (payment: VendorPayment) => {
    setForm(payment);
    setEditingId(payment.id);
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

  const handleDelete = (payment: VendorPayment) => {
    setPaymentToDelete(payment);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    try {
      await axios.delete(`${API_URL}/${paymentToDelete.id}`, { headers });
      ToasterService.success("Vendor payment deleted successfully!");
      setShowDeletePopup(false);
      setPaymentToDelete(null);
      fetchVendorPayments();
    } catch (err) {
      console.error("Error deleting vendor payment", err);
      ToasterService.error("Failed to delete vendor payment");
    }
  };

  const filteredVendorPayments = useMemo(() => {
    return vendorPayments.filter((payment) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (payment.paymentReference || "").toLowerCase().includes(term) ||
        (payment.vendorName || "").toLowerCase().includes(term) ||
        (payment.invoiceNumber || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter !== "ALL") {
        matchesFilter = (payment.paymentMethod || "") === activeFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [vendorPayments, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: vendorPayments.length,
      methodsUsed: vendorPayments.filter((p) => (p.paymentMethod || "").trim()).length,
      totalPaid: vendorPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0),
    }),
    [vendorPayments]
  );

  const tableColumns: ColumnDef<VendorPayment>[] = [
    {
      key: "paymentReference",
      label: "Payment Reference",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (payment) => (
        <span className="text-sm font-semibold text-slate-900 truncate">{payment.paymentReference || "N/A"}</span>
      ),
    },
    {
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (payment) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {payment.vendorName ? payment.vendorName.charAt(0).toUpperCase() : "V"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {payment.vendorName || "Unknown Vendor"}
          </span>
        </div>
      ),
    },
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (payment) => (
        <span className="text-sm text-slate-600 truncate">{payment.invoiceNumber || "N/A"}</span>
      ),
    },
    {
      key: "amountPaid",
      label: "Amount Paid",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (payment) => Number(payment.amountPaid || 0),
      render: (payment) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-emerald-600 opacity-80" />
          {Number(payment.amountPaid || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (payment) => (
        <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/40">
          {payment.paymentMethod || "N/A"}
        </span>
      ),
    },
    {
      key: "paymentDate",
      label: "Payment Date",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (payment) => (
        <span className="text-sm text-slate-600 truncate">{payment.paymentDate || "N/A"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[12%] text-right pr-4",
      className: "w-[12%] text-right",
      render: (payment) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(payment)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Payment"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(payment)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Payment"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Vendor Payments" description="Manage vendor payments" />
      <PageBreadcrumb pageTitle="Vendor Payments" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Vendor Payment" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Payments"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Methods Used"
            value={stats.methodsUsed}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Paid"
            value={stats.totalPaid.toLocaleString()}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredVendorPayments.length}
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
                placeholder="Search by reference, vendor, or invoice..."
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
              title="Filter Vendor Payments"
              buttonLabel="Filters"
              label="Filter by Method"
              value={activeFilter}
              options={[
                { label: "All Payments", value: "ALL" },
                { label: "Cash", value: "CASH" },
                { label: "Bank Transfer", value: "BANK_TRANSFER" },
                { label: "Check", value: "CHECK" },
                { label: "Credit Card", value: "CREDIT_CARD" },
                { label: "Other", value: "OTHER" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredVendorPayments}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="paymentReference"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <UserGroupIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No vendor payments found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first vendor payment
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Vendor Payment" : "Create New Vendor Payment"}
          subtitle={editingId !== null ? "Update your payment details" : "Add a new vendor payment"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Payment" : "Create Payment"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  label="Payment Reference"
                  name="paymentReference"
                  value={form.paymentReference || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  label="Vendor Name"
                  name="vendorName"
                  value={form.vendorName || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Invoice Number"
                  name="invoiceNumber"
                  value={form.invoiceNumber || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Amount Paid"
                  name="amountPaid"
                  type="number"
                  value={form.amountPaid ?? ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  label="Payment Method"
                  name="paymentMethod"
                  value={form.paymentMethod || ""}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  options={["CASH", "BANK_TRANSFER", "CHECK", "CREDIT_CARD", "OTHER"].map((m) => ({ id: m, name: m }))}
                />,
                <FloatingInput
                  label="Payment Date"
                  name="paymentDate"
                  type="date"
                  value={form.paymentDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Paid By"
                  name="paidBy"
                  value={form.paidBy || ""}
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
          innerText="Delete Vendor Payment"
          subText={
            paymentToDelete
              ? `Are you sure you want to delete payment "${paymentToDelete.paymentReference || "this payment"}"? This action cannot be undone.`
              : "Are you sure you want to delete this vendor payment?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setPaymentToDelete(null)}
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

export default VendorPayments;
