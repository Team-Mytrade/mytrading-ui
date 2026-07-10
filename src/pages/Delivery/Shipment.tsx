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
  BuildingOfficeIcon,
  TruckIcon as TruckSolidIcon,
  XMarkIcon,

} from "@heroicons/react/24/solid";
import {
  FunnelIcon,
  TruckIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  ClockIcon,
  PackageIcon,
  MapPinIcon,
} from "lucide-react";

// ================= TYPES =================

type ShipmentStatus = "DRAFT" | "SHIPPED" | "DELIVERED";

interface ShipmentItem {
  id?: number;
  productId: number;
  shippedQty: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  shipment?: string;
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

interface Warehouse {
  id: number;
  name: string;
  code?: string;
}

interface FormShipmentItem {
  productId: number;
  shippedQty: number;
}

// ================= API CONFIGURATION =================

const API_BASE_URL = "/v1/api/delivery";

const API = {
  shipments: `${API_BASE_URL}/shipments`,
  shipmentById: (id: number) => `${API_BASE_URL}/shipments/${id}`,
  shipmentStatus: (id: number) => `${API_BASE_URL}/shipments/${id}/status`,
  warehouses: "/v1/api/inventory/warehouses",
  customers: `${API_BASE_URL}/customers`,
  salesOrders: `${API_BASE_URL}/sales-orders`,
  products: `${API_BASE_URL}/products`,
};

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS: ShipmentStatus[] = ["DRAFT", "SHIPPED", "DELIVERED"];

const STATUS_CONFIG: Record<ShipmentStatus, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  DRAFT: {
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
    icon: <ClockIcon className="h-3 w-3" />,
    label: "Draft"
  },
  SHIPPED: {
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
    icon: <TruckIcon className="h-3 w-3" />,
    label: "Shipped"
  },
  DELIVERED: {
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
    icon: <CheckCircleIcon className="h-3 w-3" />,
    label: "Delivered"
  }
};

// ================= COMPONENT =================

const Shipment: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">("ALL");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [form, setForm] = useState({
    id: null as number | null,
    shipmentNo: "",
    trackingNumber: "",
    carrier: "",
    shipmentDate: "",
    status: "DRAFT" as ShipmentStatus,
    warehouseId: 0,
    salesOrderId: 0,
    reservationId: 0,
    active: true,
    items: [] as FormShipmentItem[],
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<ShipmentStatus>("DRAFT");

  // ================= API FUNCTIONS =================

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API.shipments);
      setShipments(response.data || []);
      if (response.data?.length > 0) {
        toast.success(`Loaded ${response.data.length} shipment(s)`);
      }
    } catch (err: any) {
      console.error("Error fetching shipments:", err);
      toast.error(err.response?.data?.message || "Failed to fetch shipments!");
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await axios.get(API.warehouses);
      setWarehouses(response.data || []);
       if (response.data?.length > 0) {
      console.log(`✅ Loaded ${response.data.length} warehouses`);
      }
     } catch (err: any) {
      console.error("Error fetching warehouses:", err);
      toast.error("Failed to load warehouses");
    }
  };
  useEffect(() => {
  fetchShipments();
  fetchWarehouses(); 
}, []);

  const createShipment = async (data: any) => {
    try {
      const response = await axios.post(API.shipments, data);
      toast.success("Shipment created successfully!");
      return response.data;
    } catch (err: any) {
      console.error("Error creating shipment:", err);
      toast.error(err.response?.data?.message || "Failed to create shipment!");
      throw err;
    }
  };

  const updateShipmentStatus = async (id: number, status: ShipmentStatus) => {
    try {
      const response = await axios.put(API.shipmentStatus(id), { status });
      toast.success(`Status updated to ${status}!`);
      return response.data;
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(err.response?.data?.message || "Failed to update status!");
      throw err;
    }
  };

  const deleteShipment = async (id: number) => {
    try {
      await axios.delete(API.shipmentById(id));
      toast.success("Shipment deleted successfully!");
      setShowDeleteModal(false);
      setSelectedShipment(null);
      await fetchShipments();
    } catch (err: any) {
      console.error("Error deleting shipment:", err);
      toast.error(err.response?.data?.message || "Failed to delete shipment!");
      throw err;
    }
  };

  // ================= FETCH =================

  useEffect(() => {
    fetchShipments();
    fetchWarehouses();
  }, []);

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

  const getStats = () => ({
    total: shipments.length,
    draft: shipments.filter(s => s.status === "DRAFT").length,
    shipped: shipments.filter(s => s.status === "SHIPPED").length,
    delivered: shipments.filter(s => s.status === "DELIVERED").length,
  });

  const stats = getStats();

  // ================= HANDLERS =================

  const handleAddShipment = () => {
    setEditingId(null);
    setForm({
      id: null,
      shipmentNo: `SHIP-${Date.now()}`,
      trackingNumber: "",
      carrier: "",
      shipmentDate: new Date().toISOString().split('T')[0],
      status: "DRAFT",
      warehouseId: 0,
      salesOrderId: 0,
      reservationId: 0,
      active: true,
      items: [],
    });
    setShowFormModal(true);
  };

  const handleViewShipment = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
  };

  const handleEditShipment = (shipment: Shipment) => {
    setEditingId(shipment.id);
    setForm({
      id: shipment.id,
      shipmentNo: shipment.shipmentNo,
      trackingNumber: shipment.trackingNumber || "",
      carrier: shipment.carrier || "",
      shipmentDate: shipment.shipmentDate?.split('T')[0] || "",
      status: shipment.status,
      warehouseId: shipment.warehouseId || 0,
      salesOrderId: shipment.salesOrderId || 0,
      reservationId: shipment.reservationId || 0,
      active: shipment.active,
      items: shipment.items.map(item => ({
        productId: item.productId,
        shippedQty: item.shippedQty,
      })),
    });
    setShowFormModal(true);
  };

  const handleDeleteClick = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDeleteModal(true);
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

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else if (type === "number") {
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

    if (!form.shipmentNo) {
      toast.warning("Shipment No is required!");
      return;
    }

    if (!form.warehouseId || form.warehouseId <= 0) {
      toast.warning("Please select a warehouse!");
      return;
    }

    if (form.items.length === 0) {
      toast.warning("Please add at least one item to the shipment!");
      return;
    }

    for (const item of form.items) {
      if (!item.productId || item.productId <= 0) {
        toast.warning("Please enter a valid Product ID for all items!");
        return;
      }
      if (!item.shippedQty || item.shippedQty <= 0) {
        toast.warning("Please enter a valid quantity (>0) for all items!");
        return;
      }
    }

    const payload = {
      shipmentNo: form.shipmentNo,
      shipmentDate: form.shipmentDate || new Date().toISOString().split('T')[0],
      salesOrderId: Number(form.salesOrderId) || 0,
      reservationId: Number(form.reservationId) || 0,
      warehouseId: Number(form.warehouseId),
      carrier: form.carrier || "",
      trackingNumber: form.trackingNumber || "",
      status: form.status,
      active: true,
      createdBy: localStorage.getItem("username") || "ADMIN",
      tenantId: "TENANT-001",
      items: form.items.map(item => ({
        productId: Number(item.productId),
        shippedQty: Number(item.shippedQty),
      })),
    };

    console.log("📦 SAVE PAYLOAD:", JSON.stringify(payload, null, 2));

    setSubmitting(true);
    try {
      if (editingId) {
        // For edit, update status (since full update might not be available)
        await updateShipmentStatus(editingId, form.status);
      } else {
        await createShipment(payload);
      }

      setShowFormModal(false);
      setEditingId(null);
      await fetchShipments();
    } catch (err) {
      // Error already handled by individual functions
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedShipment) return;

    if (newStatus === selectedShipment.status) {
      toast.info("Status is already set to " + newStatus);
      setShowStatusModal(false);
      return;
    }

    setSubmitting(true);
    try {
      await updateShipmentStatus(selectedShipment.id, newStatus);
      setShowStatusModal(false);
      setShowDetailModal(false);
      await fetchShipments();
    } catch (err) {
      // Error already handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedShipment) {
      await deleteShipment(selectedShipment.id);
    }
  };

  // ================= TABLE COLUMNS =================

  const tableColumns: ColumnDef<Shipment>[] = [
    {
      key: "shipmentNo",
      label: "Shipment No",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <TruckIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
              {row.shipmentNo || `SHIP-${row.id}`}
            </span>
            <span className="text-xs text-slate-400 truncate">ID: #{row.id}</span>
          </div>
        </div>
      ),
    },
    {
      key: "trackingNumber",
      label: "Tracking No",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <span className="text-sm font-mono text-slate-600">
          {row.trackingNumber || "-"}
        </span>
      ),
    },
    {
      key: "carrier",
      label: "Carrier",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <span className="text-sm text-slate-600">{row.carrier || "-"}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
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
      key: "shipmentDate",
      label: "Shipment Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <div className="text-sm text-slate-600">
          {row.shipmentDate ? new Date(row.shipmentDate).toLocaleDateString() : "-"}
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
      key: "warehouseId",
      label: "Warehouse",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <MapPinIcon className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-sm text-slate-600">#{row.warehouseId}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[15%] text-right pr-4",
      className: "w-[15%] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleViewShipment(row)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
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
            title="Delete Shipment"
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
      <PageMeta title="Shipments" description="Manage shipments" />
      <PageBreadcrumb pageTitle="Shipments" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* HEADER */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={handleAddShipment} label="Add Shipment" />
        </div>

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
                    {STATUS_CONFIG[status].label}
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
              <TruckIcon className="h-12 w-12 text-gray-400 mb-3" />
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

        {/* ================= CREATE/EDIT MODAL ================= */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleSaveShipment}
              className="bg-white p-6 rounded-xl w-[800px] max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TruckIcon className="h-6 w-6 text-cyan-600" />
                {editingId ? "Edit Shipment" : "Create Shipment"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <FloatingInput
                  label="Shipment No *"
                  name="shipmentNo"
                  value={form.shipmentNo}
                  onChange={handleChange}
                  disabled
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

                <FloatingInput
                  label="Shipment Date"
                  name="shipmentDate"
                  type="date"
                  value={form.shipmentDate}
                  onChange={handleChange}
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
                    <option value={0}>Select Warehouse</option>
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
                        {STATUS_CONFIG[status].label}
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
                    <PackageIcon className="h-5 w-5 text-cyan-600" />
                    Items ({form.items.length}) *
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-50 text-cyan-600 rounded-lg hover:bg-cyan-100 text-sm font-medium"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Item
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
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
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
                          className="p-1 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormModal(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : (editingId ? "Update" : "Create")}
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
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
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
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[selectedShipment.status].bgColor} ${STATUS_CONFIG[selectedShipment.status].color}`}>
                      {STATUS_CONFIG[selectedShipment.status].icon}
                      {STATUS_CONFIG[selectedShipment.status].label}
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
                <div>
                  <label className="text-xs text-gray-500">Reservation ID</label>
                  <p className="font-medium">#{selectedShipment.reservationId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Active</label>
                  <p className="font-medium">{selectedShipment.active ? '✅ Yes' : '❌ No'}</p>
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <PackageIcon className="h-5 w-5 text-cyan-600" />
                  Items ({selectedShipment.items?.length || 0})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedShipment.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div>
                        <span className="font-medium text-sm">Product #{item.productId}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Qty: {item.shippedQty}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenStatusModal(selectedShipment);
                  }}
                  className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium"
                >
                  <PencilIcon className="h-4 w-4 inline mr-1" />
                  Update Status
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDeleteClick(selectedShipment);
                  }}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  <TrashIcon className="h-4 w-4 inline mr-1" />
                  Delete
                </button>
              </div>

              <div className="mt-4 border-t pt-4 text-xs text-gray-400">
                <p>Created: {new Date(selectedShipment.createdDate).toLocaleString()} by {selectedShipment.createdBy}</p>
                <p>Updated: {new Date(selectedShipment.updatedDate).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* ================= DELETE CONFIRMATION MODAL ================= */}
        {showDeleteModal && selectedShipment && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[450px]">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Shipment</h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete shipment <span className="font-semibold text-gray-700">{selectedShipment.shipmentNo}</span>?
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Carrier: {selectedShipment.carrier || "N/A"} • Items: {selectedShipment.items?.length || 0}
                  </p>
                  <p className="text-xs text-red-500 mt-2">⚠️ This action cannot be undone.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedShipment(null);
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
                  Delete Shipment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= UPDATE STATUS MODAL ================= */}
        {showStatusModal && selectedShipment && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[450px]">
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
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[selectedShipment.status].bgColor} ${STATUS_CONFIG[selectedShipment.status].color}`}>
                    {STATUS_CONFIG[selectedShipment.status].icon}
                    {STATUS_CONFIG[selectedShipment.status].label}
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
                      {STATUS_CONFIG[status].label}
                    </option>
                  ))}
                </select>
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
      </div>
    </>
  );
};

export default Shipment;