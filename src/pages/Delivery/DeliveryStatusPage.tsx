import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TruckIcon,
  HashtagIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUSES = ["Pending", "Dispatched", "In Transit", "Delivered", "Cancelled"] as const;
type StatusType = typeof STATUSES[number];

interface DeliveryStatus {
  id?: number;
  orderNumber: string;
  customerName: string;
  deliveryDate: string;
  status: StatusType;
  remarks?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/dispatch/delivery-status";

const STATUS_STYLES: Record<StatusType, string> = {
  Pending:    "bg-yellow-100 text-yellow-800",
  Dispatched: "bg-blue-100   text-blue-800",
  "In Transit":"bg-indigo-100 text-indigo-800",
  Delivered:  "bg-green-100  text-green-800",
  Cancelled:  "bg-red-100    text-red-700",
};

const STATUS_ICONS: Record<StatusType, React.ReactNode> = {
  Pending:     <ClockIcon           className="h-3 w-3" />,
  Dispatched:  <PaperAirplaneIcon   className="h-3 w-3" />,
  "In Transit":<ArrowPathIcon       className="h-3 w-3" />,
  Delivered:   <CheckCircleIcon     className="h-3 w-3" />,
  Cancelled:   <XCircleIcon         className="h-3 w-3" />,
};

const emptyForm: DeliveryStatus = {
  orderNumber:  "",
  customerName: "",
  deliveryDate: new Date().toISOString().split("T")[0],
  status:       "Pending",
  remarks:      "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const DeliveryStatusPage: React.FC = () => {
  const [records, setRecords] = useState<DeliveryStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<DeliveryStatus>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<DeliveryStatus | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<DeliveryStatus[]>(API_URL);
      setRecords(res.data);
    } catch (err) {
      console.error("Failed to load delivery statuses:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof DeliveryStatus, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleEdit = (record: DeliveryStatus) => {
    setForm({ ...record, deliveryDate: record.deliveryDate.slice(0, 10), remarks: record.remarks ?? "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, remarks: form.remarks || undefined };
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }
      loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving delivery status:", err);
    }
  };

  const promptDelete = (record: DeliveryStatus) => {
    setDeletingItem(record);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`);
      loadData();
    } catch (err) {
      console.error("Error deleting delivery status:", err);
    }
    setDeletingItem(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total:      records.length,
    pending:    records.filter(r => r.status === "Pending").length,
    inTransit:  records.filter(r => r.status === "In Transit" || r.status === "Dispatched").length,
    delivered:  records.filter(r => r.status === "Delivered").length,
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<DeliveryStatus>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "orderNumber",
      label: "Order #",
      sortable: true,
      render: (_, v) => (
        <span className="text-sm font-semibold text-gray-900">DO-{String(v)}</span>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "deliveryDate",
      label: "Delivery Date",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">
            {new Date(String(v)).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (_, v) => {
        const s = v as StatusType;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s]}`}>
            {STATUS_ICONS[s]}
            {s}
          </span>
        );
      },
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (_, v) => (
        <span className="text-sm text-gray-500">{String(v) || "—"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleEdit(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => promptDelete(row)}
            title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageMeta
        title="Delivery Status / Confirmation"
        description="Track and manage delivery statuses"
      />
      <PageBreadcrumb pageTitle="Delivery Status / Confirmation" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Delivery Status</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Track and confirm delivery statuses for all orders
            </p>
          </div> */}
          <AddButton
            label="Add Delivery Status"
            onClick={() => { setForm(emptyForm); setShowForm(true); }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard
            label="Total Records"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Pending"
            value={stats.pending}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard
            label="In Transit"
            value={stats.inTransit}
            gradient="from-indigo-50 to-blue-50"
            borderColor="border-indigo-100"
            labelColor="text-indigo-600"
          />
          <StatsCard
            label="Delivered"
            value={stats.delivered}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit Delivery Status" : "Add Delivery Status"}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.orderNumber}
                    onChange={e => handleChange("orderNumber", e.target.value)}
                    placeholder="e.g. 00123"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={e => handleChange("customerName", e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.deliveryDate}
                    onChange={e => handleChange("deliveryDate", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.status}
                    onChange={e => handleChange("status", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.remarks}
                  onChange={e => handleChange("remarks", e.target.value)}
                  rows={3}
                  placeholder="Add any notes or comments about this delivery..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
                >
                  {form.id ? "Update Status" : "Add Status"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <ReusableTable<DeliveryStatus>
          data={records}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by order number, customer, or status..."
          searchFields={["orderNumber", "customerName", "status", "remarks"]}
          pageSize={5}
          defaultSortKey="deliveryDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <TruckIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">
                No delivery status records found
              </p>
              <button
                onClick={() => { setForm(emptyForm); setShowForm(true); }}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Add your first delivery status →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Delivery Status"
        subText="Are you sure you want to delete this delivery status record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default DeliveryStatusPage;
