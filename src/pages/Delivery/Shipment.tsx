import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

import { FloatingSelect, FloatingDatePicker, FloatingInput } from "../../components/inputfeild/FloatingInput";

import { MagnifyingGlassIcon, BuildingOfficeIcon } from "@heroicons/react/24/solid";
import { FunnelIcon, TruckIcon, EyeIcon, PencilIcon, XCircleIcon } from "lucide-react";

// ================= TYPES =================

type ShipmentStatus = "DRAFT" | "SHIPPED" | "DELIVERED";

// For API payload (simplified items without auto-generated fields)
interface ShipmentItemPayload {
  id?: number;
  productId: number;
  shippedQty: number;
}

// Full Shipment Item with all fields (from API response)
interface ShipmentItem extends ShipmentItemPayload {
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  tenantId: string;
  shipment: string;
}

// For API create payload - using the simplified item type
interface ShipmentCreatePayload {
  shipmentNo: string;
  shipmentDate: string;
  salesOrderId: number;
  reservationId: number;
  warehouseId: number;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  active: boolean;
  createdBy: string;
  tenantId: string;
  items: ShipmentItemPayload[]; // Use simplified type here
}

interface Shipment {
  id: number;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  tenantId: string;
  shipmentNo: string;
  shipmentDate: string;
  salesOrderId: number;
  reservationId: number;
  warehouseId: number;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  active: boolean;
  items: ShipmentItem[];
}

// For form state
interface FormShipmentItem {
  id?: number;
  productId: number;
  shippedQty: number;
}

interface Warehouse {
  id: number;
  name: string;
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

class ShipmentService {
  // GET /v1/api/delivery/shipments
  static async getAll(): Promise<Shipment[]> {
    try {
      const response = await apiClient.get("/v1/api/delivery/shipments");
      return response.data;
    } catch (error) {
      console.error("Error fetching shipments:", error);
      throw error;
    }
  }

  // GET /v1/api/delivery/shipments/{id}
  static async getById(id: number): Promise<Shipment> {
    try {
      const response = await apiClient.get(`/v1/api/delivery/shipments/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching shipment ${id}:`, error);
      throw error;
    }
  }

  // POST /v1/api/delivery/shipments
  static async create(data: ShipmentCreatePayload): Promise<Shipment> {
    try {
      const response = await apiClient.post("/v1/api/delivery/shipments", data);
      return response.data;
    } catch (error) {
      console.error("Error creating shipment:", error);
      throw error;
    }
  }

  // PUT /v1/api/delivery/shipments/{id}/status
  static async updateStatus(id: number, status: ShipmentStatus): Promise<Shipment> {
    try {
      const response = await apiClient.put(`/v1/api/delivery/shipments/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error(`Error updating shipment status ${id}:`, error);
      throw error;
    }
  }

  // DELETE /v1/api/delivery/shipments/{id}
  static async delete(id: number): Promise<void> {
    try {
      await apiClient.delete(`/v1/api/delivery/shipments/${id}`);
    } catch (error) {
      console.error(`Error deleting shipment ${id}:`, error);
      throw error;
    }
  }
}

class WarehouseService {
  // GET /v1/api/warehouse
  static async getAll(): Promise<Warehouse[]> {
    try {
      const response = await apiClient.get("/v1/api/warehouse");
      return response.data;
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      throw error;
    }
  }
}

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS: ShipmentStatus[] = ["DRAFT", "SHIPPED", "DELIVERED"];

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.JSX.Element }> = {
  DRAFT: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: <span className="text-xs">📝</span>
  },
  SHIPPED: {
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: <span className="text-xs">🚚</span>
  },
  DELIVERED: {
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: <span className="text-xs">✅</span>
  }
};

// ================= COMPONENT =================

const Shipment: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">("ALL");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [form, setForm] = useState({
    id: null as number | null,
    shipmentNo: "",
    trackingNumber: "",
    carrier: "",
    shipmentDate: "",
    status: "DRAFT" as ShipmentStatus,
    warehouseId: "",
    salesOrderId: 0,
    reservationId: 0,
    active: true,
    items: [] as FormShipmentItem[],
    createdBy: "",
    tenantId: "",
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<ShipmentStatus>("DRAFT");

  // ================= FETCH =================

  useEffect(() => {
    fetchShipments();
    fetchWarehouses();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ShipmentService.getAll();
      setShipments(data);
    } catch (err) {
      console.error("Error fetching shipments:", err);
      setError("Failed to load shipments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const data = await WarehouseService.getAll();
      setWarehouses(data);
    } catch (err) {
      console.error("Error fetching warehouses:", err);
    }
  };

  // ================= FILTER =================

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      const matchesSearch =
        s.shipmentNo?.toLowerCase().includes(search.toLowerCase()) ||
        s.trackingNumber?.toLowerCase().includes(search.toLowerCase()) ||
        String(s.id).includes(search) ||
        s.carrier?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [shipments, search, statusFilter]);

  // ================= STATS =================

  const getStats = () => {
    const stats = {
      total: shipments.length,
      draft: shipments.filter(s => s.status === "DRAFT").length,
      shipped: shipments.filter(s => s.status === "SHIPPED").length,
      delivered: shipments.filter(s => s.status === "DELIVERED").length,
    };
    return stats;
  };

  const stats = getStats();

  // ================= TABLE =================

  const tableColumns: ColumnDef<Shipment>[] = [
    {
      key: "shipmentNo",
      label: "Shipment No",
      render: (row) => (
        <span className="font-medium text-cyan-600">
          {row.shipmentNo || `SHIP-${row.id}`}
        </span>
      )
    },
    {
      key: "trackingNumber",
      label: "Tracking No",
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.trackingNumber || "-"}
        </span>
      )
    },
    {
      key: "carrier",
      label: "Carrier",
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.carrier || "-"}
        </span>
      )
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const config = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${config.bgColor} ${config.color}`}>
            {config.icon}
            {row.status}
          </span>
        );
      }
    },
    {
      key: "shipmentDate",
      label: "Shipment Date",
      render: (row) => (
        <div className="text-sm">
          {row.shipmentDate ? new Date(row.shipmentDate).toLocaleDateString() : "-"}
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
      key: "active",
      label: "Active",
      render: (row) => (
        <span className={`text-xs font-medium ${row.active ? 'text-green-600' : 'text-red-600'}`}>
          {row.active ? '✅' : '❌'}
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
              handleViewShipment(row);
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="View Details"
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

  const handleAddShipment = () => {
    setForm({
      id: null,
      shipmentNo: `SHIP-${Date.now()}`,
      trackingNumber: "",
      carrier: "",
      shipmentDate: new Date().toISOString().split('T')[0],
      status: "DRAFT",
      warehouseId: "",
      salesOrderId: 0,
      reservationId: 0,
      active: true,
      items: [],
      createdBy: "",
      tenantId: "",
    });
    setShowFormModal(true);
  };

  const handleViewShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
  };

  const handleOpenStatusModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setNewStatus(shipment.status);
    setShowStatusModal(true);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    
    if (type === "number") {
      setForm((prev) => ({
        ...prev,
        [name]: value === "" ? 0 : Number(value),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAddItem = () => {
    const newItem: FormShipmentItem = {
      productId: 0,
      shippedQty: 0,
    };

    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleItemChange = (index: number, field: keyof FormShipmentItem, value: any) => {
    const updatedItems = [...form.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setForm(prev => ({ ...prev, items: updatedItems }));
  };

  const handleRemoveItem = (index: number) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.shipmentNo || !form.warehouseId) {
      alert("Shipment No and Warehouse are required!");
      return;
    }

    if (form.items.length === 0) {
      alert("Please add at least one item to the shipment!");
      return;
    }

    // Validate items
    for (const item of form.items) {
      if (!item.productId || item.productId <= 0) {
        alert("Please enter a valid Product ID for all items!");
        return;
      }
      if (!item.shippedQty || item.shippedQty <= 0) {
        alert("Please enter a valid quantity (>0) for all items!");
        return;
      }
    }

    // Build payload with proper typing
    const payload: ShipmentCreatePayload = {
      shipmentNo: form.shipmentNo,
      shipmentDate: form.shipmentDate || new Date().toISOString().split('T')[0],
      salesOrderId: Number(form.salesOrderId) || 0,
      reservationId: Number(form.reservationId) || 0,
      warehouseId: Number(form.warehouseId),
      carrier: form.carrier || "",
      trackingNumber: form.trackingNumber || "",
      status: form.status,
      active: true,
      createdBy: localStorage.getItem("username") || "system",
      tenantId: "default",
      items: form.items.map(item => ({
        productId: Number(item.productId),
        shippedQty: Number(item.shippedQty),
        ...(item.id && { id: item.id })
      })),
    };

    console.log("📦 SAVE PAYLOAD:", payload);

    setLoading(true);
    try {
      let result: Shipment;
      if (form.id) {
        // Since we don't have a PUT endpoint for full update, we'll use the status endpoint
        alert("Edit functionality is limited. Please use the status update feature.");
        setShowFormModal(false);
        return;
      } else {
        // POST /v1/api/delivery/shipments
        result = await ShipmentService.create(payload);
        console.log("✅ Shipment created:", result);
      }
      
      await fetchShipments();
      setShowFormModal(false);
      setError(null);
      alert("Shipment created successfully!");
    } catch (err) {
      console.error("Error saving shipment:", err);
      setError("Failed to save shipment. Please try again.");
      alert("Failed to save shipment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedShipment) return;

    if (newStatus === selectedShipment.status) {
      alert("New status is the same as current status.");
      return;
    }

    setLoading(true);
    try {
      // PUT /v1/api/delivery/shipments/{id}/status
      await ShipmentService.updateStatus(selectedShipment.id, newStatus);
      await fetchShipments();
      setShowStatusModal(false);
      setShowDetailModal(false);
      setError(null);
      alert(`Status updated to ${newStatus} successfully!`);
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Failed to update status.");
      alert("Failed to update status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShipment = async (id: number) => {
    if (!confirm("Are you sure you want to delete this shipment?")) return;

    setLoading(true);
    try {
      // DELETE /v1/api/delivery/shipments/{id}
      await ShipmentService.delete(id);
      await fetchShipments();
      setShowDetailModal(false);
      setError(null);
      alert("Shipment deleted successfully!");
    } catch (err) {
      console.error("Error deleting shipment:", err);
      setError("Failed to delete shipment.");
      alert("Failed to delete shipment.");
    } finally {
      setLoading(false);
    }
  };

  // ================= UI =================

  return (
    <>
      <PageMeta title="Shipment" description="Manage shipments" />
      <PageBreadcrumb pageTitle="Shipment" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* HEADER */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={handleAddShipment} label="Add Shipment" />
        </div>

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
        <div className="grid grid-cols-4 gap-4">
          <StatsCard 
            label="Total" 
            value={stats.total} 
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard 
            label="Draft" 
            value={stats.draft}
            gradient="from-yellow-50 to-amber-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard 
            label="Shipped" 
            value={stats.shipped}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard 
            label="Delivered" 
            value={stats.delivered}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder="Search by shipment no, tracking, carrier, or ID..."
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
          <div className="p-4 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | "ALL")}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              {statusFilter !== "ALL" && (
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  ✕ Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* TABLE */}
        <ReusableTable<Shipment>
          data={filteredShipments}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="createdDate"
          defaultSortOrder="desc"
          onRowClick={handleViewShipment}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No Shipments Found</p>
              {search || statusFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddShipment}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first shipment
                </button>
              )}
            </div>
          }
        />

        {/* ================= CREATE MODAL ================= */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleSaveShipment}
              className="bg-white p-6 rounded-xl w-[800px] max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TruckIcon className="h-6 w-6 text-cyan-600" />
                {form.id ? "Edit Shipment" : "Create Shipment"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <FloatingInput
                  label="Shipment No *"
                  name="shipmentNo"
                  value={form.shipmentNo}
                  onChange={handleChange}
                  disabled
                  required
                />

                <FloatingInput
                  label="Tracking Number"
                  name="trackingNumber"
                  value={form.trackingNumber}
                  onChange={handleChange}
                />

                <FloatingInput
                  label="Carrier"
                  name="carrier"
                  value={form.carrier}
                  onChange={handleChange}
                />

                <FloatingDatePicker
                  label="Shipment Date"
                  name="shipmentDate"
                  value={form.shipmentDate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      shipmentDate: e.target.value,
                    }))
                  }
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warehouse *
                  </label>
                  <select
                    name="warehouseId"
                    value={form.warehouseId}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name || `Warehouse #${w.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <FloatingInput
                  label="Sales Order ID"
                  name="salesOrderId"
                  type="number"
                  value={form.salesOrderId}
                  onChange={handleChange}
                />

                <FloatingInput
                  label="Reservation ID"
                  name="reservationId"
                  type="number"
                  value={form.reservationId}
                  onChange={handleChange}
                />
              </div>

              {/* ITEMS SECTION */}
              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-semibold text-gray-700 flex items-center gap-2">
                    <span>📦</span>
                    Items ({form.items.length}) *
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-sm text-cyan-600 hover:text-cyan-800 font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                {form.items.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Click "Add Item" to add products to this shipment
                  </p>
                )}

                {form.items.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {form.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <input
                          type="number"
                          placeholder="Product ID *"
                          value={item.productId || ''}
                          onChange={(e) => handleItemChange(index, 'productId', Number(e.target.value))}
                          className="w-1/3 p-1 border rounded text-sm"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Qty *"
                          value={item.shippedQty || ''}
                          onChange={(e) => handleItemChange(index, 'shippedQty', Number(e.target.value))}
                          className="w-1/4 p-1 border rounded text-sm"
                          required
                          min="1"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm ml-auto"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Saving..." : (form.id ? "Update" : "Create") + " Shipment"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= DETAIL VIEW MODAL ================= */}
        {showDetailModal && selectedShipment && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[700px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <TruckIcon className="h-6 w-6 text-cyan-600" />
                  {selectedShipment.shipmentNo || `SHIP-${selectedShipment.id}`}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNewStatus(selectedShipment.status);
                      setShowStatusModal(true);
                    }}
                    className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm"
                  >
                    Update Status
                  </button>
                  <button
                    onClick={() => handleDeleteShipment(selectedShipment.id)}
                    className="px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm"
                    disabled={loading}
                  >
                    {loading ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Tracking Number</label>
                  <p className="font-medium">{selectedShipment.trackingNumber || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Carrier</label>
                  <p className="font-medium">{selectedShipment.carrier || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p className="font-medium">
                    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[selectedShipment.status]?.bgColor} ${STATUS_CONFIG[selectedShipment.status]?.color}`}>
                      {selectedShipment.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Shipment Date</label>
                  <p className="font-medium">
                    {selectedShipment.shipmentDate ? new Date(selectedShipment.shipmentDate).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Sales Order</label>
                  <p className="font-medium">SO-{selectedShipment.salesOrderId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Warehouse</label>
                  <p className="font-medium">#{selectedShipment.warehouseId}</p>
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span>📦</span>
                  Items ({selectedShipment.items?.length || 0})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedShipment.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div>
                        <span className="font-medium">Product #{item.productId}</span>
                      </div>
                      <div className="text-sm space-x-3">
                        <span className="text-gray-500">Qty: {item.shippedQty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4 text-xs text-gray-400">
                <p>Created: {new Date(selectedShipment.createdDate).toLocaleString()} by {selectedShipment.createdBy}</p>
                <p>Updated: {new Date(selectedShipment.updatedDate).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= UPDATE STATUS MODAL ================= */}
        {showStatusModal && selectedShipment && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[400px]">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PencilIcon className="h-6 w-6 text-purple-600" />
                Update Status
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shipment
                </label>
                <p className="text-gray-600 font-medium">{selectedShipment.shipmentNo}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Status
                </label>
                <p className="text-gray-600 font-medium">
                  <span className={`px-2 py-1 rounded-full text-xs ${STATUS_CONFIG[selectedShipment.status]?.bgColor} ${STATUS_CONFIG[selectedShipment.status]?.color}`}>
                    {selectedShipment.status}
                  </span>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Status *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ShipmentStatus)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
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

export default Shipment;