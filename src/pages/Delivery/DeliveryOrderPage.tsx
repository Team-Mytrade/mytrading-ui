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
  UserIcon,
  CalendarIcon,
  ShoppingBagIcon,
  XMarkIcon,

} from "@heroicons/react/24/solid";
import {
  FunnelIcon,
  PackageIcon,
  ClipboardListIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
  RefreshCwIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
} from "lucide-react";

// ================= TYPES =================

type DeliveryStatus = "PENDING" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "FAILED";

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

// ================= API CONFIGURATION =================

const API_BASE_URL = "/v1/api/delivery";

const API = {
  getAll: `${API_BASE_URL}/delivery-orders`,
  getById: (id: number) => `${API_BASE_URL}/delivery-orders/${id}`,
  create: `${API_BASE_URL}/delivery-orders`,
  updateStatus: (id: number) => `${API_BASE_URL}/delivery-orders/${id}/status`,
  delete: (id: number) => `${API_BASE_URL}/delivery-orders/${id}`,
};

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS: DeliveryStatus[] = ["PENDING", "IN_PROGRESS", "SHIPPED", "DELIVERED", "CANCELLED", "FAILED"];

const STATUS_CONFIG: Record<DeliveryStatus, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
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

const DeliveryNote: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [dateFilter, setDateFilter] = useState("");

  const [form, setForm] = useState({
    id: null as number | null,
    deliveryNo: "",
    deliveryDate: "",
    salesOrderId: 0,
    customerId: 0,
    status: "PENDING" as DeliveryStatus,
    items: [] as DeliveryItem[],
  });

  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>("PENDING");

  // ================= API FUNCTIONS =================

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const response = await axios.get(API.getAll);
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

  const createDelivery = async (data: any) => {
    try {
      const response = await axios.post(API.create, data);
      toast.success("Delivery created successfully!");
      return response.data;
    } catch (err: any) {
      console.error("Error creating delivery:", err);
      toast.error(err.response?.data?.message || "Failed to create delivery!");
      throw err;
    }
  };

  const updateDeliveryStatus = async (id: number, status: DeliveryStatus) => {
    try {
      const response = await axios.put(API.updateStatus(id), { status });
      toast.success(`Status updated to ${STATUS_CONFIG[status].label}!`);
      return response.data;
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(err.response?.data?.message || "Failed to update status!");
      throw err;
    }
  };

  const deleteDelivery = async (id: number) => {
    try {
      await axios.delete(API.delete(id));
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

  const handleAddDelivery = () => {
    setEditingId(null);
    setForm({
      id: null,
      deliveryNo: `DEL-${Date.now()}`,
      deliveryDate: new Date().toISOString().split('T')[0],
      salesOrderId: 0,
      customerId: 0,
      status: "PENDING",
      items: [],
    });
    setShowFormModal(true);
  };

  const handleViewDelivery = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setShowDetailModal(true);
  };

  const handleEditDelivery = (delivery: Delivery) => {
    setEditingId(delivery.id);
    setForm({
      id: delivery.id,
      deliveryNo: delivery.deliveryNo,
      deliveryDate: delivery.deliveryDate?.split('T')[0] || "",
      salesOrderId: delivery.salesOrderId,
      customerId: delivery.customerId,
      status: delivery.status,
      items: delivery.items.map(item => ({ ...item })),
    });
    setShowFormModal(true);
  };

  const handleDeleteClick = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setShowDeleteModal(true);
  };

  const handleOpenStatusModal = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
    setNewStatus(delivery.status);
    setShowStatusModal(true);
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
    const newItem: DeliveryItem = {
      productId: 0,
      orderedQty: 0,
      deliveredQty: 0,
      deliveryNote: "",
    };
    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleItemChange = (index: number, field: keyof DeliveryItem, value: any) => {
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

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customerId || form.customerId <= 0) {
      toast.warning("Please enter a valid Customer ID (> 0)");
      return;
    }

    if (!form.salesOrderId || form.salesOrderId <= 0) {
      toast.warning("Please enter a valid Sales Order ID (> 0)");
      return;
    }

    if (form.items.length === 0) {
      toast.warning("Please add at least one item to the delivery!");
      return;
    }

    for (const item of form.items) {
      if (!item.productId || item.productId <= 0) {
        toast.warning("Please enter a valid Product ID for all items!");
        return;
      }
      if (item.orderedQty <= 0) {
        toast.warning("Ordered quantity must be greater than 0!");
        return;
      }
      if (item.deliveredQty < 0) {
        toast.warning("Delivered quantity cannot be negative!");
        return;
      }
    }

    const payload = {
      deliveryNo: form.deliveryNo,
      deliveryDate: form.deliveryDate || new Date().toISOString().split('T')[0],
      salesOrderId: Number(form.salesOrderId),
      customerId: Number(form.customerId),
      status: form.status,
      createdBy: "ADMIN",
      tenantId: "TENANT-001",
      items: form.items.map(item => ({
        productId: Number(item.productId),
        orderedQty: Number(item.orderedQty),
        deliveredQty: Number(item.deliveredQty),
        deliveryNote: item.deliveryNote || "",
      })),
    };

    console.log("📦 SAVE PAYLOAD:", JSON.stringify(payload, null, 2));

    setSubmitting(true);
    try {
      if (editingId) {
        await updateDeliveryStatus(editingId, form.status);
      } else {
        await createDelivery(payload);
      }

      setShowFormModal(false);
      setEditingId(null);
      await fetchDeliveries();
    } catch (err) {
      // Error already handled by individual functions
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedDelivery) return;

    if (newStatus === selectedDelivery.status) {
      toast.info("Status is already set to " + STATUS_CONFIG[newStatus].label);
      setShowStatusModal(false);
      return;
    }

    setSubmitting(true);
    try {
      await updateDeliveryStatus(selectedDelivery.id, newStatus);
      setShowStatusModal(false);
      setShowDetailModal(false);
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
        <div className="flex items-center gap-1.5">
          <ShoppingBagIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700">SO-{row.salesOrderId}</span>
        </div>
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
          <PackageIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
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
            onClick={() => handleViewDelivery(row)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
            title="View Delivery"
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
      <PageMeta title="Deliveries" description="Manage deliveries" />
      <PageBreadcrumb pageTitle="Deliveries" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* HEADER */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={handleAddDelivery} label="Add Delivery" />
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
            label="Cancelled"
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
          onRowClick={handleViewDelivery}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <ClipboardListIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No Deliveries Found</p>
              {search || statusFilter !== "ALL" || dateFilter ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddDelivery}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first delivery
                </button>
              )}
            </div>
          }
        />

        {/* ================= CREATE/EDIT MODAL ================= */}
        {showFormModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <form
              onSubmit={handleSaveDelivery}
              className="bg-white p-6 rounded-xl w-[800px] max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                {editingId ? "Edit Delivery" : "Create Delivery"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <FloatingInput
                  label="Delivery No"
                  name="deliveryNo"
                  value={form.deliveryNo}
                  onChange={handleChange}
                  disabled
                />

                <FloatingInput
                  label="Delivery Date *"
                  name="deliveryDate"
                  type="date"
                  value={form.deliveryDate}
                  onChange={handleChange}
                  required
                />

                <FloatingInput
                  label="Sales Order ID *"
                  name="salesOrderId"
                  type="number"
                  value={form.salesOrderId}
                  onChange={handleChange}
                  required
                />

                <FloatingInput
                  label="Customer ID *"
                  name="customerId"
                  type="number"
                  value={form.customerId}
                  onChange={handleChange}
                  required
                />

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status *
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    required
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>
                        {STATUS_CONFIG[status].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Section */}
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
                    Click "Add Item" to add products to this delivery
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
                          className="w-24 p-1 border rounded text-sm"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Ordered Qty *"
                          value={item.orderedQty || ''}
                          onChange={(e) => handleItemChange(index, 'orderedQty', Number(e.target.value))}
                          className="w-24 p-1 border rounded text-sm"
                          required
                          min="1"
                        />
                        <input
                          type="number"
                          placeholder="Delivered Qty *"
                          value={item.deliveredQty || ''}
                          onChange={(e) => handleItemChange(index, 'deliveredQty', Number(e.target.value))}
                          className="w-24 p-1 border rounded text-sm"
                          required
                          min="0"
                        />
                        <input
                          type="text"
                          placeholder="Note"
                          value={item.deliveryNote || ''}
                          onChange={(e) => handleItemChange(index, 'deliveryNote', e.target.value)}
                          className="flex-1 p-1 border rounded text-sm"
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
        {showDetailModal && selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[700px] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                  {selectedDelivery.deliveryNo || `DEL-${selectedDelivery.id}`}
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
                  <label className="text-xs text-gray-500">Customer</label>
                  <p className="font-medium flex items-center gap-1.5">
                    <UserIcon className="h-4 w-4 text-slate-400" />
                    #{selectedDelivery.customerId}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Sales Order</label>
                  <p className="font-medium flex items-center gap-1.5">
                    <ShoppingBagIcon className="h-4 w-4 text-slate-400" />
                    SO-{selectedDelivery.salesOrderId}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p className="font-medium">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[selectedDelivery.status].bgColor} ${STATUS_CONFIG[selectedDelivery.status].color}`}>
                      {STATUS_CONFIG[selectedDelivery.status].icon}
                      {STATUS_CONFIG[selectedDelivery.status].label}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Delivery Date</label>
                  <p className="font-medium flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                    {selectedDelivery.deliveryDate ? new Date(selectedDelivery.deliveryDate).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <PackageIcon className="h-5 w-5 text-cyan-600" />
                  Items ({selectedDelivery.items?.length || 0})
                </h3>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedDelivery.items?.map((item, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div>
                        <span className="font-medium text-sm">Product #{item.productId}</span>
                      </div>
                      <div className="text-sm space-x-3">
                        <span className="text-gray-500">Ordered: {item.orderedQty}</span>
                        <span className="text-green-600">Delivered: {item.deliveredQty}</span>
                        {item.deliveryNote && (
                          <span className="text-gray-400 text-xs">Note: {item.deliveryNote}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t pt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenStatusModal(selectedDelivery);
                  }}
                  className="px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium"
                >
                  <PencilIcon className="h-4 w-4 inline mr-1" />
                  Update Status
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleDeleteClick(selectedDelivery);
                  }}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                >
                  <TrashIcon className="h-4 w-4 inline mr-1" />
                  Delete
                </button>
              </div>

              <div className="mt-4 border-t pt-4 text-xs text-gray-400">
                <p>Created: {new Date(selectedDelivery.createdDate).toLocaleString()} by {selectedDelivery.createdBy}</p>
                <p>Updated: {new Date(selectedDelivery.updatedDate).toLocaleString()}</p>
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

        {/* ================= UPDATE STATUS MODAL ================= */}
        {showStatusModal && selectedDelivery && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-[450px]">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PencilIcon className="h-6 w-6 text-purple-600" />
                Update Status
              </h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery
                </label>
                <p className="text-gray-600 font-medium">{selectedDelivery.deliveryNo}</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Status
                </label>
                <p className="text-gray-600 font-medium">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_CONFIG[selectedDelivery.status].bgColor} ${STATUS_CONFIG[selectedDelivery.status].color}`}>
                    {STATUS_CONFIG[selectedDelivery.status].icon}
                    {STATUS_CONFIG[selectedDelivery.status].label}
                  </span>
                </p>
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

export default DeliveryNote;