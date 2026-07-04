import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

import { 
  MagnifyingGlassIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,

  EyeIcon,
  PencilIcon
} from "@heroicons/react/24/solid";
import { 
  FunnelIcon, 
  PackageIcon, 
  ClipboardListIcon,
  CalendarIcon,
  UserIcon,
  RefreshCwIcon
  
} from "lucide-react";

// ================= TYPES =================

type DeliveryStatus = "PENDING" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "FAILED";

interface DeliveryStatusHistory {
  id: number;
  deliveryOrderId: number;
  status: DeliveryStatus;
  note: string;
  updatedBy: string;
  createdDate: string;
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

interface DeliveryItem {
  id?: number;
  productId: number;
  orderedQty: number;
  deliveredQty: number;
  deliveryNote?: string;
}

interface DeliveryStatusUpdate {
  deliveryOrderId: number;
  status: DeliveryStatus;
  note?: string;
  updatedBy?: string;
}

// ================= API CONFIGURATION =================

const API_BASE_URL = "http://localhost:8080"; // Change this to your actual API URL

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ================= API SERVICE =================

class DeliveryStatusService {
  // GET /v1/api/delivery/delivery-orders
  static async getAllDeliveries(): Promise<Delivery[]> {
    try {
      const response = await apiClient.get("/v1/api/delivery/delivery-orders");
      return response.data;
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      throw error;
    }
  }

  // GET /v1/api/delivery/delivery-status/{deliveryOrderId}
  static async getStatusHistory(deliveryOrderId: number): Promise<DeliveryStatusHistory[]> {
    try {
      const response = await apiClient.get(`/v1/api/delivery/delivery-status/${deliveryOrderId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching status history for ${deliveryOrderId}:`, error);
      throw error;
    }
  }

  // POST /v1/api/delivery/delivery-status
  static async updateStatus(statusData: DeliveryStatusUpdate): Promise<any> {
    try {
      const response = await apiClient.post("/v1/api/delivery/delivery-status", statusData);
      return response.data;
    } catch (error) {
      console.error("Error updating delivery status:", error);
      throw error;
    }
  }

  // DELETE /v1/api/delivery/delivery-orders/{id}
  static async deleteDelivery(id: number): Promise<void> {
    try {
      await apiClient.delete(`/v1/api/delivery/delivery-orders/${id}`);
    } catch (error) {
      console.error(`Error deleting delivery ${id}:`, error);
      throw error;
    }
  }
}

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS: DeliveryStatus[] = ["PENDING", "IN_PROGRESS", "SHIPPED", "DELIVERED", "CANCELLED", "FAILED"];

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.JSX.Element }> = {
  PENDING: { 
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: <ClockIcon className="h-4 w-4" />
  },
  IN_PROGRESS: { 
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: <RefreshCwIcon className="h-4 w-4" />
  },
  SHIPPED: { 
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: <TruckIcon className="h-4 w-4" />
  },
  DELIVERED: { 
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: <CheckCircleIcon className="h-4 w-4" />
  },
  CANCELLED: { 
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: <XCircleIcon className="h-4 w-4" />
  },
  FAILED: { 
    color: "text-orange-700",
    bgColor: "bg-orange-100",
    icon: <XCircleIcon className="h-4 w-4" />
  }
};

// ================= COMPONENT =================

const DeliveryStatusPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [statusHistory, setStatusHistory] = useState<DeliveryStatusHistory[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>("PENDING");
  const [statusNote, setStatusNote] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ================= FETCH =================

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await DeliveryStatusService.getAllDeliveries();
      setDeliveries(data);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
      setError("Failed to load deliveries. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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

  const getStats = () => {
    const stats = {
      total: deliveries.length,
      pending: deliveries.filter(d => d.status === "PENDING").length,
      inProgress: deliveries.filter(d => d.status === "IN_PROGRESS").length,
      shipped: deliveries.filter(d => d.status === "SHIPPED").length,
      delivered: deliveries.filter(d => d.status === "DELIVERED").length,
      cancelled: deliveries.filter(d => d.status === "CANCELLED").length,
      failed: deliveries.filter(d => d.status === "FAILED").length,
    };
    return stats;
  };

  const stats = getStats();

  // ================= TABLE =================

  const tableColumns: ColumnDef<Delivery>[] = [
    {
      key: "deliveryNo",
      label: "Delivery No",
      render: (row) => (
        <span className="font-medium text-cyan-600">
          {row.deliveryNo || `DEL-${row.id}`}
        </span>
      )
    },
    {
      key: "customerId",
      label: "Customer",
      render: (row) => (
        <div className="flex items-center gap-1">
          <UserIcon className="h-3 w-3 text-gray-400" />
          <span className="font-medium">#{row.customerId}</span>
        </div>
      )
    },
    {
      key: "salesOrderId",
      label: "Sales Order",
      render: (row) => (
        <span className="text-sm text-gray-600">SO-{row.salesOrderId}</span>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.PENDING;
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${config.bgColor} ${config.color}`}>
            {config.icon}
            {row.status.replace('_', ' ')}
          </span>
        );
      }
    },
    {
      key: "deliveryDate",
      label: "Delivery Date",
      render: (row) => (
        <div className="text-sm flex items-center gap-1">
          <CalendarIcon className="h-3 w-3 text-gray-400" />
          {row.deliveryDate ? new Date(row.deliveryDate).toLocaleDateString() : "-"}
        </div>
      )
    },
    {
      key: "items",
      label: "Items",
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.items?.length || 0} items
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewHistory(row);
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="View Status History"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenStatusModal(row);
            }}
            className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
            title="Update Status"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  // ================= HANDLERS =================

  const handleViewHistory = async (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setLoadingHistory(true);
    try {
      const history = await DeliveryStatusService.getStatusHistory(delivery.id);
      setStatusHistory(history);
      setShowHistoryModal(true);
    } catch (err) {
      console.error("Error fetching status history:", err);
      alert("Failed to load status history.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenStatusModal = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setNewStatus(delivery.status);
    setStatusNote("");
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedDelivery) return;

    if (newStatus === selectedDelivery.status) {
      alert("New status is the same as current status.");
      return;
    }

    const statusData: DeliveryStatusUpdate = {
      deliveryOrderId: selectedDelivery.id,
      status: newStatus,
      note: statusNote || `Status changed from ${selectedDelivery.status} to ${newStatus}`,
      updatedBy: localStorage.getItem("username") || "system",
    };

    setLoading(true);
    try {
      await DeliveryStatusService.updateStatus(statusData);
      await fetchDeliveries();
      setShowStatusModal(false);
      setError(null);
      alert(`Status updated to ${newStatus.replace('_', ' ')} successfully!`);
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Failed to update status.");
      alert("Failed to update status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDelivery = async (id: number) => {
    if (!confirm("Are you sure you want to delete this delivery?")) return;

    setLoading(true);
    try {
      await DeliveryStatusService.deleteDelivery(id);
      await fetchDeliveries();
      setShowHistoryModal(false);
      setError(null);
    } catch (err) {
      console.error("Error deleting delivery:", err);
      setError("Failed to delete delivery.");
      alert("Failed to delete delivery.");
    } finally {
      setLoading(false);
    }
  };

  // ================= UI =================

  return (
    <>
      <PageMeta title="Delivery Status" description="Manage delivery statuses" />
      <PageBreadcrumb pageTitle="Delivery Status" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <span className="font-medium">Error: </span>
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-700 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

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
            value={stats.cancelled + stats.failed}
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
                    {status.replace('_', ' ')}
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
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this delivery?")) {
                        handleDeleteDelivery(selectedDelivery.id);
                      }
                    }}
                    className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Close
                  </button>
                </div>
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
                      <span className={`px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[selectedDelivery.status]?.bgColor} ${STATUS_CONFIG[selectedDelivery.status]?.color}`}>
                        {selectedDelivery.status}
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
              ) : statusHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No status history available</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {statusHistory.map((history, index) => (
                    <div key={history.id || index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[history.status]?.bgColor} ${STATUS_CONFIG[history.status]?.color}`}>
                          {history.status}
                        </span>
                      </div>
                      <div className="flex-1">
                        {history.note && (
                          <p className="text-sm text-gray-700">{history.note}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            Updated by: {history.updatedBy || 'System'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">
                            {new Date(history.createdDate).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= UPDATE STATUS MODAL ================= */}
        {showStatusModal && selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[450px]">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <RefreshCwIcon className="h-6 w-6 text-purple-600" />
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
                      <span className={`px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[selectedDelivery.status]?.bgColor} ${STATUS_CONFIG[selectedDelivery.status]?.color}`}>
                        {selectedDelivery.status}
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
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status Note (Optional)
                </label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Add a note about this status change..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Updating..." : "Update Status"}
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