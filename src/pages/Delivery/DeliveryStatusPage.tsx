import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";

import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
  EyeIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import {
  FunnelIcon,
  PackageIcon,
  ClipboardListIcon,
  CalendarIcon,
  UserIcon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";

// ================= TYPES =================

type DeliveryStatus = "PENDING" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "FAILED";

interface DeliveryStatusHistory {
  id: number;
  deliveryOrderId: number;
  currentStatus: DeliveryStatus;
  remarks: string;
  updatedBy: string;
  deliveredSuccessfully: boolean;
  failureReason: string;
  statusUpdatedAt: string;
}

interface DeliveryItem {
  id?: number;
  productId: number;
  orderedQty: number;
  deliveredQty: number;
  deliveryNote?: string;
}

interface Delivery {
  id: number;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  tenantId: string;
  deliveryNo: string;
  deliveryDate: string;
  salesOrderId: number;
  customerId: number;
  status: DeliveryStatus;
  items: DeliveryItem[];
}

interface DeliveryStatusUpdate {
  deliveryOrderId: number;
  currentStatus: DeliveryStatus;
  remarks: string;
  updatedBy: string;
  deliveredSuccessfully: boolean;
  failureReason: string;
}

// ================= API CONFIGURATION =================

const API_BASE_URL = "/v1/api/delivery";

const API = {
  deliveries: `${API_BASE_URL}/delivery-orders`,
  statusHistory: (id: number) => `${API_BASE_URL}/delivery-status/${id}`,
  updateStatus: `${API_BASE_URL}/delivery-status`,
  deleteDelivery: (id: number) => `${API_BASE_URL}/delivery-orders/${id}`,
};

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS: DeliveryStatus[] = ["PENDING", "IN_PROGRESS", "SHIPPED", "DELIVERED", "CANCELLED", "FAILED"];

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  PENDING: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: <ClockIcon className="h-3 w-3" />,
    label: "Pending"
  },
  IN_PROGRESS: {
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    icon: <RefreshCwIcon className="h-3 w-3" />,
    label: "In Progress"
  },
  SHIPPED: {
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
    icon: <TruckIcon className="h-3 w-3" />,
    label: "Shipped"
  },
  DELIVERED: {
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    icon: <CheckCircleIcon className="h-3 w-3" />,
    label: "Delivered"
  },
  CANCELLED: {
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
    icon: <XCircleIcon className="h-3 w-3" />,
    label: "Cancelled"
  },
  FAILED: {
    color: "text-orange-700",
    bgColor: "bg-orange-50 border-orange-200",
    icon: <XCircleIcon className="h-3 w-3" />,
    label: "Failed"
  }
};

// ================= COMPONENT =================

const DeliveryStatusPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [statusHistory, setStatusHistory] = useState<DeliveryStatusHistory | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>("PENDING");
  const [remarks, setRemarks] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [deliveredSuccessfully, setDeliveredSuccessfully] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ================= API FUNCTIONS =================

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API.deliveries);
      setDeliveries(response.data || []);
      if (response.data?.length > 0) {
        toast.success(`Loaded ${response.data.length} delivery(s)`);
      }
    } catch (err: any) {
      console.error("Error fetching deliveries:", err);
      toast.error(err.response?.data?.message || "Failed to fetch deliveries!");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusHistory = async (deliveryOrderId: number) => {
    setLoadingHistory(true);
    try {
      const response = await axios.get(API.statusHistory(deliveryOrderId));
      setStatusHistory(response.data);
      setShowHistoryModal(true);
    } catch (err: any) {
      console.error("Error fetching status history:", err);
      toast.error(err.response?.data?.message || "Failed to load status history!");
    } finally {
      setLoadingHistory(false);
    }
  };

  const updateDeliveryStatus = async (data: DeliveryStatusUpdate) => {
    try {
      const response = await axios.post(API.updateStatus, data);
      toast.success(`Status updated to ${STATUS_CONFIG[data.currentStatus].label}!`);
      return response.data;
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(err.response?.data?.message || "Failed to update status!");
      throw err;
    }
  };

  const deleteDelivery = async (id: number) => {
    try {
      await axios.delete(API.deleteDelivery(id));
      toast.success("Delivery deleted successfully!");
      setShowDeleteModal(false);
      setSelectedDelivery(null);
      await fetchDeliveries();
    } catch (err: any) {
      console.error("Error deleting delivery:", err);
      toast.error(err.response?.data?.message || "Failed to delete delivery!");
      throw err;
    }
  };

  // ================= FETCH =================

  useEffect(() => {
    fetchDeliveries();
  }, []);

  // ================= FILTER =================

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const matchesSearch =
        d.deliveryNo?.toLowerCase().includes(search.toLowerCase()) ||
        String(d.customerId).includes(search) ||
        String(d.salesOrderId).includes(search) ||
        String(d.id).includes(search);

      const matchesStatus =
        statusFilter === "ALL" || d.status === statusFilter;

      const matchesDate =
        !dateFilter || d.deliveryDate?.startsWith(dateFilter);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [deliveries, search, statusFilter, dateFilter]);

  // ================= STATS =================

  const getStats = () => ({
    total: deliveries.length,
    pending: deliveries.filter(d => d.status === "PENDING").length,
    inProgress: deliveries.filter(d => d.status === "IN_PROGRESS").length,
    shipped: deliveries.filter(d => d.status === "SHIPPED").length,
    delivered: deliveries.filter(d => d.status === "DELIVERED").length,
    cancelled: deliveries.filter(d => d.status === "CANCELLED" || d.status === "FAILED").length,
  });

  const stats = getStats();

  // ================= HANDLERS =================

  const handleViewHistory = async (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    await fetchStatusHistory(delivery.id);
  };

  const handleOpenStatusModal = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setNewStatus(delivery.status);
    setRemarks("");
    setFailureReason("");
    setDeliveredSuccessfully(false);
    setShowStatusModal(true);
  };

  const handleDeleteClick = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setShowDeleteModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedDelivery) return;

    if (newStatus === selectedDelivery.status) {
      toast.warning("New status is the same as current status.");
      return;
    }

    // Validate based on status
    if (newStatus === "DELIVERED" && !deliveredSuccessfully) {
      toast.warning("Please confirm if delivery was successful.");
      return;
    }

    if (newStatus === "FAILED" && !failureReason) {
      toast.warning("Please provide a failure reason.");
      return;
    }

    const statusData: DeliveryStatusUpdate = {
      deliveryOrderId: selectedDelivery.id,
      currentStatus: newStatus,
      remarks: remarks || `Status changed from ${selectedDelivery.status} to ${newStatus}`,
      updatedBy: localStorage.getItem("username") || "ADMIN",
      deliveredSuccessfully: newStatus === "DELIVERED" ? deliveredSuccessfully : false,
      failureReason: newStatus === "FAILED" ? failureReason : "",
    };

    console.log("📦 STATUS UPDATE PAYLOAD:", JSON.stringify(statusData, null, 2));

    setSubmitting(true);
    try {
      await updateDeliveryStatus(statusData);
      setShowStatusModal(false);
      await fetchDeliveries();
    } catch (err) {
      // Error already handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedDelivery) {
      await deleteDelivery(selectedDelivery.id);
    }
  };

  // ================= TABLE COLUMNS =================

  const tableColumns: ColumnDef<Delivery>[] = [
    {
      key: "deliveryNo",
      label: "Delivery No",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <ClipboardListIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
              {row.deliveryNo || `DEL-${row.id}`}
            </span>
            <span className="text-xs text-slate-400 truncate">ID: #{row.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <UserIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700">#{row.customerId}</span>
        </div>
      ),
    },
    {
      key: "salesOrderId",
      label: "Sales Order",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <span className="text-sm text-slate-600">SO-{row.salesOrderId}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (row) => {
        const config = STATUS_CONFIG[row.status];
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${config.bgColor} ${config.color}`}>
            {config.icon}
            {config.label}
          </span>
        );
      },
    },
    {
      key: "deliveryDate",
      label: "Delivery Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-600">
            {row.deliveryDate ? new Date(row.deliveryDate).toLocaleDateString() : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "items",
      label: "Items",
      sortable: false,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <PackageIcon className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">{row.items?.length || 0}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[24%] text-right pr-4",
      className: "w-[24%] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleViewHistory(row)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
            title="View Status History"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenStatusModal(row)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-purple-50 hover:text-purple-600"
            title="Update Status"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteClick(row)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Delivery"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ================= UI =================

  return (
    <>
      <PageMeta title="Delivery Status" description="Manage delivery statuses" />
      <PageBreadcrumb pageTitle="Delivery Status" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

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
            label="Shipped"
            value={stats.shipped}
            gradient="from-purple-50 to-violet-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Delivered"
            value={stats.delivered}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Cancelled/Failed"
            value={stats.cancelled}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder="Search by delivery no, customer ID, or sales order..."
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
                onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | "ALL")}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {STATUS_CONFIG[status].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-end">
              {(statusFilter !== "ALL" || dateFilter) && (
                <button
                  onClick={() => {
                    setStatusFilter("ALL");
                    setDateFilter("");
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
        <ReusableTable<Delivery>
          data={filteredDeliveries}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="createdDate"
          defaultSortOrder="desc"
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <ClipboardListIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No Deliveries Found</p>
              {search || statusFilter !== "ALL" || dateFilter ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <p className="text-gray-400 text-xs">Create a delivery to get started</p>
              )}
            </div>
          }
        />

        {/* ================= STATUS HISTORY MODAL ================= */}
        {showHistoryModal && selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[600px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                  Status History
                </h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Delivery No</label>
                    <p className="font-medium">{selectedDelivery.deliveryNo}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Current Status</label>
                    <p className="font-medium">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[selectedDelivery.status].bgColor} ${STATUS_CONFIG[selectedDelivery.status].color}`}>
                        {STATUS_CONFIG[selectedDelivery.status].icon}
                        {STATUS_CONFIG[selectedDelivery.status].label}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {loadingHistory ? (
                <div className="text-center py-8">
                  <RefreshCwIcon className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
                  <p className="text-gray-500 mt-2">Loading history...</p>
                </div>
              ) : statusHistory ? (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[statusHistory.currentStatus]?.bgColor} ${STATUS_CONFIG[statusHistory.currentStatus]?.color}`}>
                        {STATUS_CONFIG[statusHistory.currentStatus]?.icon}
                        {STATUS_CONFIG[statusHistory.currentStatus]?.label}
                      </span>
                    </div>
                    <div className="flex-1">
                      {statusHistory.remarks && (
                        <p className="text-sm text-gray-700">{statusHistory.remarks}</p>
                      )}
                      {statusHistory.deliveredSuccessfully && (
                        <p className="text-sm text-green-600">✅ Delivered Successfully</p>
                      )}
                      {statusHistory.failureReason && (
                        <p className="text-sm text-red-600">❌ Failure: {statusHistory.failureReason}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          Updated by: {statusHistory.updatedBy || 'System'}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {new Date(statusHistory.statusUpdatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No status history available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= UPDATE STATUS MODAL ================= */}
        {showStatusModal && selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[500px] max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PencilIcon className="h-6 w-6 text-purple-600" />
                Update Status
              </h2>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Delivery No</label>
                    <p className="font-medium text-sm">{selectedDelivery.deliveryNo}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Current Status</label>
                    <p className="font-medium">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[selectedDelivery.status].bgColor} ${STATUS_CONFIG[selectedDelivery.status].color}`}>
                        {STATUS_CONFIG[selectedDelivery.status].icon}
                        {STATUS_CONFIG[selectedDelivery.status].label}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as DeliveryStatus)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {STATUS_CONFIG[status].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Show additional fields based on status */}
              {newStatus === "DELIVERED" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivered Successfully *
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={deliveredSuccessfully === true}
                        onChange={() => setDeliveredSuccessfully(true)}
                        className="h-4 w-4 text-green-600"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={deliveredSuccessfully === false}
                        onChange={() => setDeliveredSuccessfully(false)}
                        className="h-4 w-4 text-red-600"
                      />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>
              )}

              {newStatus === "FAILED" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Failure Reason *
                  </label>
                  <textarea
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="Please provide the reason for failure..."
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    required
                  />
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks (Optional)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any additional remarks..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  disabled={submitting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= DELETE CONFIRMATION MODAL ================= */}
        {showDeleteModal && selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[450px]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Delivery</h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete delivery <span className="font-semibold text-gray-700">{selectedDelivery.deliveryNo}</span>?
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Customer: #{selectedDelivery.customerId} • Items: {selectedDelivery.items?.length || 0}
                  </p>
                  <p className="text-xs text-red-500 mt-2">⚠️ This action cannot be undone.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedDelivery(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Delete Delivery
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DeliveryStatusPage;