import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

import { FloatingSelect, FloatingDatePicker, FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";

import { 
  MagnifyingGlassIcon, 
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon
} from "@heroicons/react/24/solid";
import { 
  FunnelIcon, 
  ClipboardListIcon,
  AlertCircleIcon,
  RefreshCwIcon
} from "lucide-react";

// ================= TYPES =================

// ✅ GET Response Schema
interface DeliveryStatusResponse {
  id: number;
  deliveryOrderId: number;
  currentStatus: string;
  remarks: string;
  updatedBy: string;
  deliveredSuccessfully: boolean;
  failureReason?: string;
  statusUpdatedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

// ✅ POST/PUT Request Schema
interface DeliveryStatusRequest {
  deliveryOrderId: number;
  currentStatus: string;
  remarks: string;
  updatedBy: string;
  deliveredSuccessfully: boolean;
  failureReason?: string;
}

// ✅ Form State
interface DeliveryStatusForm {
  id: number | null;
  deliveryOrderId: number;
  currentStatus: string;
  remarks: string;
  updatedBy: string;
  deliveredSuccessfully: boolean;
  failureReason: string;
  statusUpdatedAt: string;
}

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  "PENDING",
  "IN_PROGRESS", 
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "RETURNED"
];

// ================= COMPONENT =================

const DeliveryStatusPage: React.FC = () => {
  const [statuses, setStatuses] = useState<DeliveryStatusResponse[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [successFilter, setSuccessFilter] = useState<string>("ALL");

  const [form, setForm] = useState<DeliveryStatusForm>({
    id: null,
    deliveryOrderId: 0,
    currentStatus: "PENDING",
    remarks: "",
    updatedBy: "",
    deliveredSuccessfully: false,
    failureReason: "",
    statusUpdatedAt: new Date().toISOString(),
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<DeliveryStatusResponse | null>(null);

  // ================= FETCH =================

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      // ✅ Using your GET endpoint
      const res = await axios.get("/v1/api/delivery/status");
      setStatuses(res.data);
    } catch (err) {
      console.error("Error fetching delivery statuses:", err);
    } finally {
      setLoading(false);
    }
  };

  // ================= FILTER =================

  const filteredStatuses = useMemo(() => {
    return statuses.filter((s) => {
      const matchesSearch =
        String(s.deliveryOrderId).includes(search) ||
        s.currentStatus?.toLowerCase().includes(search.toLowerCase()) ||
        s.updatedBy?.toLowerCase().includes(search.toLowerCase()) ||
        String(s.id).includes(search);

      const matchesStatus =
        statusFilter === "ALL" || s.currentStatus === statusFilter;

      const matchesSuccess =
        successFilter === "ALL" || 
        (successFilter === "SUCCESS" && s.deliveredSuccessfully) ||
        (successFilter === "FAILED" && !s.deliveredSuccessfully);

      return matchesSearch && matchesStatus && matchesSuccess;
    });
  }, [statuses, search, statusFilter, successFilter]);

  // ================= STATS =================

  const getStats = () => {
    const stats = {
      total: statuses.length,
      delivered: statuses.filter(s => s.deliveredSuccessfully).length,
      failed: statuses.filter(s => !s.deliveredSuccessfully).length,
      pending: statuses.filter(s => s.currentStatus === "PENDING").length,
      inProgress: statuses.filter(s => s.currentStatus === "IN_PROGRESS").length,
      completed: statuses.filter(s => s.currentStatus === "COMPLETED").length,
    };
    return stats;
  };

  const stats = getStats();

  // ================= TABLE =================

  const tableColumns: ColumnDef<DeliveryStatusResponse>[] = [
    {
      key: "id",
      label: "ID",
      render: (row) => (
        <span className="font-mono text-sm text-gray-600">#{row.id}</span>
      )
    },
    {
      key: "deliveryOrderId",
      label: "Delivery Order",
      render: (row) => (
        <span className="font-medium text-cyan-600">
          DO-{row.deliveryOrderId}
        </span>
      )
    },
    {
      key: "currentStatus",
      label: "Status",
      render: (row) => {
        const statusConfig: Record<string, { color: string; icon: React.JSX.Element }> = {
          PENDING: { 
            color: "bg-yellow-100 text-yellow-700 border-yellow-200",
            icon: <ClockIcon className="h-3 w-3" />
          },
          IN_PROGRESS: { 
            color: "bg-blue-100 text-blue-700 border-blue-200",
            icon: <RefreshCwIcon className="h-3 w-3" />
          },
          SHIPPED: { 
            color: "bg-purple-100 text-purple-700 border-purple-200",
            icon: <TruckIcon className="h-3 w-3" />
          },
          DELIVERED: { 
            color: "bg-green-100 text-green-700 border-green-200",
            icon: <CheckCircleIcon className="h-3 w-3" />
          },
          COMPLETED: { 
            color: "bg-emerald-100 text-emerald-700 border-emerald-200",
            icon: <CheckCircleIcon className="h-3 w-3" />
          },
          CANCELLED: { 
            color: "bg-red-100 text-red-700 border-red-200",
            icon: <XCircleIcon className="h-3 w-3" />
          },
          FAILED: { 
            color: "bg-orange-100 text-orange-700 border-orange-200",
            icon: <AlertCircleIcon className="h-3 w-3" />
          },
          RETURNED: { 
            color: "bg-gray-100 text-gray-700 border-gray-200",
            icon: <RefreshCwIcon className="h-3 w-3" />
          }
        };

        const config = statusConfig[row.currentStatus] || statusConfig.PENDING;
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${config.color}`}>
            {config.icon}
            {row.currentStatus.replace('_', ' ')}
          </span>
        );
      }
    },
    {
      key: "deliveredSuccessfully",
      label: "Result",
      render: (row) => (
        <span className={`text-sm font-medium ${row.deliveredSuccessfully ? 'text-green-600' : 'text-red-600'}`}>
          {row.deliveredSuccessfully ? (
            <span className="flex items-center gap-1">
              <CheckCircleIcon className="h-4 w-4" />
              Success
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircleIcon className="h-4 w-4" />
              Failed
            </span>
          )}
        </span>
      )
    },
    {
      key: "updatedBy",
      label: "Updated By",
      render: (row) => (
        <span className="text-sm text-gray-600">{row.updatedBy || "System"}</span>
      )
    },
    {
      key: "statusUpdatedAt",
      label: "Updated At",
      render: (row) => (
        <div className="text-sm text-gray-500">
          {new Date(row.statusUpdatedAt).toLocaleString()}
        </div>
      )
    }
  ];

  // ================= HANDLERS =================

  const handleAddStatus = () => {
    setForm({
      id: null,
      deliveryOrderId: 0,
      currentStatus: "PENDING",
      remarks: "",
      updatedBy: "",
      deliveredSuccessfully: false,
      failureReason: "",
      statusUpdatedAt: new Date().toISOString(),
    });
    setShowFormModal(true);
  };

  const handleViewStatus = (status: DeliveryStatusResponse) => {
    setSelectedStatus(status);
    setShowDetailModal(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!form.deliveryOrderId || !form.currentStatus) {
      alert("Please fill in all required fields");
      return;
    }

    const payload: DeliveryStatusRequest = {
      deliveryOrderId: Number(form.deliveryOrderId),
      currentStatus: form.currentStatus,
      remarks: form.remarks || "",
      updatedBy: form.updatedBy || "System",
      deliveredSuccessfully: form.deliveredSuccessfully,
      failureReason: form.deliveredSuccessfully ? undefined : form.failureReason || "Unknown error",
    };

    console.log("📦 STATUS PAYLOAD:", payload);

    try {
      if (form.id) {
        // ✅ PUT - Update existing status
        await axios.put(`/v1/api/delivery/status/${form.id}`, payload);
      } else {
        // ✅ POST - Create new status
        await axios.post("/v1/api/delivery/status", payload);
      }
      
      await fetchStatuses();
      setShowFormModal(false);
      
    } catch (err) {
      console.error("Error saving delivery status:", err);
      alert("Failed to save delivery status. Please try again.");
    }
  };

  const handleDeleteStatus = async (id: number) => {
    if (!confirm("Are you sure you want to delete this delivery status?")) return;

    try {
      await axios.delete(`/v1/api/delivery/status/${id}`);
      await fetchStatuses();
    } catch (err) {
      console.error("Error deleting delivery status:", err);
      alert("Failed to delete delivery status.");
    }
  };

  // ================= UI =================

  return (
    <>
      <PageMeta title="Delivery Status" description="Manage delivery statuses" />
      <PageBreadcrumb pageTitle="Delivery Status" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* HEADER */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={handleAddStatus} label="Add Status" />
        </div>

        {/* STATS */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          <StatsCard 
            label="Total" 
            value={stats.total} 
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard 
            label="Delivered" 
            value={stats.delivered}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard 
            label="Failed" 
            value={stats.failed}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
          <StatsCard 
            label="Pending" 
            value={stats.pending}
            gradient="from-yellow-50 to-amber-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard 
            label="In Progress" 
            value={stats.inProgress}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard 
            label="Completed" 
            value={stats.completed}
            gradient="from-purple-50 to-violet-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder="Search by Delivery Order ID, Status, or Updated By..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="p-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FunnelIcon className="h-5 w-5 text-gray-600" />
            <span className="text-sm text-gray-600">Filters</span>
          </button>
        </div>

        {/* FILTERS */}
        {showFilters && (
          <div className="p-4 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Result
              </label>
              <select
                value={successFilter}
                onChange={(e) => setSuccessFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All</option>
                <option value="SUCCESS">Successful</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            <div className="flex items-end">
              {(statusFilter !== "ALL" || successFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSuccessFilter("ALL");
                  }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  ✕ Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* TABLE */}
        <ReusableTable<DeliveryStatusResponse>
          data={filteredStatuses}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="statusUpdatedAt"
          defaultSortOrder="desc"
          onRowClick={handleViewStatus}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <ClipboardListIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No Delivery Statuses Found</p>
              {search || statusFilter !== "ALL" || successFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddStatus}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first delivery status
                </button>
              )}
            </div>
          }
        />

        {/* ================= CREATE/EDIT MODAL ================= */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleSaveStatus}
              className="bg-white p-6 rounded-xl w-[700px] max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                {form.id ? "Edit Delivery Status" : "Add Delivery Status"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Delivery Order ID */}
                <FloatingInput
                  label="Delivery Order ID *"
                  name="deliveryOrderId"
                  type="number"
                  value={form.deliveryOrderId}
                  onChange={handleChange}
                  required
                />

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="currentStatus"
                    value={form.currentStatus}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {status.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Updated By */}
                <FloatingInput
                  label="Updated By"
                  name="updatedBy"
                  value={form.updatedBy}
                  onChange={handleChange}
                  // placeholder="System"
                />

                {/* Delivered Successfully - Checkbox */}
                <div className="flex items-center gap-3 mt-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      name="deliveredSuccessfully"
                      checked={form.deliveredSuccessfully}
                      onChange={handleChange}
                      className="h-4 w-4 text-cyan-600 rounded border-gray-300 focus:ring-cyan-500"
                    />
                    Delivered Successfully
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div className="mt-4">
                <FloatingTextarea
                  label="Remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Additional notes about this delivery status"
                />
              </div>

              {/* Failure Reason (conditional) */}
              {!form.deliveredSuccessfully && (
                <div className="mt-4">
                  <FloatingTextarea
                    label="Failure Reason *"
                    name="failureReason"
                    value={form.failureReason}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Why did the delivery fail?"
                    required={!form.deliveredSuccessfully}
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium"
                >
                  {form.id ? "Update" : "Create"} Status
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= DETAIL VIEW MODAL ================= */}
        {showDetailModal && selectedStatus && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[600px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                  Status #{selectedStatus.id}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteStatus(selectedStatus.id)}
                    className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Delivery Order</label>
                    <p className="font-medium">DO-{selectedStatus.deliveryOrderId}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <p className="font-medium">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        selectedStatus.currentStatus === "COMPLETED" || selectedStatus.currentStatus === "DELIVERED" 
                          ? "bg-green-100 text-green-700" 
                          : selectedStatus.currentStatus === "IN_PROGRESS" || selectedStatus.currentStatus === "SHIPPED"
                          ? "bg-blue-100 text-blue-700"
                          : selectedStatus.currentStatus === "CANCELLED"
                          ? "bg-red-100 text-red-700"
                          : selectedStatus.currentStatus === "FAILED"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {selectedStatus.currentStatus}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Result</label>
                  <p className={`font-medium ${selectedStatus.deliveredSuccessfully ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedStatus.deliveredSuccessfully ? '✅ Delivered Successfully' : '❌ Delivery Failed'}
                  </p>
                </div>

                {selectedStatus.failureReason && (
                  <div>
                    <label className="text-xs text-gray-500">Failure Reason</label>
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
                      {selectedStatus.failureReason}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500">Remarks</label>
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded-lg">
                    {selectedStatus.remarks || "No remarks"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <label className="text-xs text-gray-500">Updated By</label>
                    <p className="text-sm font-medium">{selectedStatus.updatedBy || "System"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Updated At</label>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedStatus.statusUpdatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DeliveryStatusPage;