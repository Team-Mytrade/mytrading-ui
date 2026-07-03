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
  UserIcon,
  CalendarIcon,
  ShoppingBagIcon,
} from "@heroicons/react/24/solid";
import { 
  FunnelIcon, 
  PackageIcon, 
  ClipboardListIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  TruckIcon,
  RefreshCwIcon
} from "lucide-react";

// ================= TYPES =================

type DeliveryStatus = "PENDING" | "IN_PROGRESS" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "FAILED";

interface DeliveryItem {
  id?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
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

// ================= CONSTANTS =================

const PAGE_SIZE = 10;
const STATUS_OPTIONS: DeliveryStatus[] = ["PENDING", "IN_PROGRESS", "SHIPPED", "DELIVERED", "CANCELLED", "FAILED"];

// ================= COMPONENT =================

const DeliveryNote: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
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
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);

  // ================= FETCH =================

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/v1/api/delivery");
      setDeliveries(res.data);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
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
        <div>
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
          CANCELLED: { 
            color: "bg-red-100 text-red-700 border-red-200",
            icon: <XCircleIcon className="h-3 w-3" />
          },
          FAILED: { 
            color: "bg-orange-100 text-orange-700 border-orange-200",
            icon: <XCircleIcon className="h-3 w-3" />
          }
        };

        const config = statusConfig[row.status] || statusConfig.PENDING;
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${config.color}`}>
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
        <div className="text-sm">
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
      key: "createdDate",
      label: "Created",
      render: (row) => (
        <div className="text-xs text-gray-500">
          {new Date(row.createdDate).toLocaleDateString()}
        </div>
      )
    }
  ];

  // ================= HANDLERS =================

  const handleAddDelivery = () => {
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

    // Validate required fields
    if (!form.customerId || !form.salesOrderId || form.items.length === 0) {
      alert("Please fill in all required fields (Customer, Sales Order, and at least one item)");
      return;
    }

    const payload = {
      deliveryNo: form.deliveryNo,
      deliveryDate: form.deliveryDate || new Date().toISOString().split('T')[0],
      salesOrderId: Number(form.salesOrderId),
      customerId: Number(form.customerId),
      status: form.status,
      items: form.items.map(item => ({
        productId: Number(item.productId) || 0,
        orderedQty: Number(item.orderedQty) || 0,
        deliveredQty: Number(item.deliveredQty) || 0,
        deliveryNote: item.deliveryNote || "",
      })),
    };

    console.log("📦 DELIVERY PAYLOAD:", payload);

    try {
      if (form.id) {
        await axios.put(`/v1/api/delivery/${form.id}`, payload);
      } else {
        await axios.post("/v1/api/delivery", payload);
      }
      
      await fetchDeliveries();
      setShowFormModal(false);
      
    } catch (err) {
      console.error("Error saving delivery:", err);
      alert("Failed to save delivery. Please try again.");
    }
  };

  const handleDeleteDelivery = async (id: number) => {
    if (!confirm("Are you sure you want to delete this delivery?")) return;

    try {
      await axios.delete(`/v1/api/delivery/${id}`);
      await fetchDeliveries();
    } catch (err) {
      console.error("Error deleting delivery:", err);
      alert("Failed to delete delivery.");
    }
  };

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
                {form.id ? "Edit Delivery" : "Create Delivery"}
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <FloatingInput
                  label="Delivery No"
                  name="deliveryNo"
                  value={form.deliveryNo}
                  onChange={handleChange}
                  disabled
                />

                <FloatingDatePicker
                  label="Delivery Date *"
                  name="deliveryDate"
                  value={form.deliveryDate}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      deliveryDate: e.target.value,
                    }))
                  }
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

                <div>
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
                        {status.replace('_', ' ')}
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
                    className="text-sm text-cyan-600 hover:text-cyan-800 font-medium"
                  >
                    + Add Item
                  </button>
                </div>

                {form.items.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {form.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <input
                          type="number"
                          placeholder="Product ID"
                          value={item.productId || ''}
                          onChange={(e) => handleItemChange(index, 'productId', Number(e.target.value))}
                          className="w-24 p-1 border rounded text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Ordered Qty"
                          value={item.orderedQty || ''}
                          onChange={(e) => handleItemChange(index, 'orderedQty', Number(e.target.value))}
                          className="w-24 p-1 border rounded text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Delivered Qty"
                          value={item.deliveredQty || ''}
                          onChange={(e) => handleItemChange(index, 'deliveredQty', Number(e.target.value))}
                          className="w-24 p-1 border rounded text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Note"
                          value={item.deliveryNote || ''}
                          onChange={(e) => handleItemChange(index, 'deliveryNote', e.target.value)}
                          className="w-32 p-1 border rounded text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
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
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium"
                >
                  {form.id ? "Update" : "Create"} Delivery
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
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteDelivery(selectedDelivery.id)}
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500">Customer</label>
                  <p className="font-medium">#{selectedDelivery.customerId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Sales Order</label>
                  <p className="font-medium">SO-{selectedDelivery.salesOrderId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p className="font-medium">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedDelivery.status === "DELIVERED" ? "bg-green-100 text-green-700" :
                      selectedDelivery.status === "SHIPPED" ? "bg-purple-100 text-purple-700" :
                      selectedDelivery.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                      selectedDelivery.status === "CANCELLED" || selectedDelivery.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {selectedDelivery.status}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Delivery Date</label>
                  <p className="font-medium">
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
                        <span className="font-medium">Product #{item.productId}</span>
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

              <div className="mt-4 border-t pt-4 text-xs text-gray-400">
                <p>Created: {new Date(selectedDelivery.createdDate).toLocaleString()} by {selectedDelivery.createdBy}</p>
                <p>Updated: {new Date(selectedDelivery.updatedDate).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DeliveryNote;