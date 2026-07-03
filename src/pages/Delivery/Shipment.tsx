import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

import { FloatingSelect, FloatingDatePicker, FloatingInput } from "../../components/inputfeild/FloatingInput";

import { MagnifyingGlassIcon, BuildingOfficeIcon } from "@heroicons/react/24/solid";
import { FunnelIcon, TruckIcon } from "lucide-react";

// ================= TYPES =================

type ShipmentStatus = "DRAFT" | "SHIPPED" | "DELIVERED";

interface ShipmentItem {
  id: number;
  createdDate: string;
  updatedDate: string;
  createdBy: string;
  tenantId: string;
  shipment: string;  // This should be shipmentNo or shipment ID
  productId: number;
  shippedQty: number;
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
}

// ================= CONSTANTS =================

const PAGE_SIZE = 10;

// ================= COMPONENT =================

const Shipment: React.FC = () => {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | "ALL">("ALL");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // ✅ FIX: Use proper initial state matching schema
  const [form, setForm] = useState({
    id: null as number | null,
    shipmentNo: "",
    trackingNumber: "",
    carrier: "",
    shipmentDate: "",
    status: "DRAFT" as ShipmentStatus,
    warehouseId: "",
    salesOrderId: 0,        // ✅ Added missing fields
    reservationId: 0,       // ✅ Added missing fields
    active: true,           // ✅ Added missing fields
    items: [] as ShipmentItem[], // ✅ Added items array
    createdBy: "",          // ✅ Added for creation
    tenantId: "",           // ✅ Added for multi-tenant
  });

  const [showFormModal, setShowFormModal] = useState(false);

  // ================= FETCH =================

  useEffect(() => {
    fetchShipments();
    fetchWarehouses();
  }, []);

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/v1/api/shipment");
      setShipments(res.data);
    } catch (err) {
      console.error("Error fetching shipments:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get("/v1/api/warehouse");
      setWarehouses(res.data);
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
        String(s.id).includes(search);

      const matchesStatus =
        statusFilter === "ALL" || s.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [shipments, search, statusFilter]);

  // ================= TABLE =================

  const tableColumns: ColumnDef<Shipment>[] = [
    { key: "shipmentNo", label: "Shipment No" },
    { key: "trackingNumber", label: "Tracking No" },
    { key: "carrier", label: "Carrier" },

    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.status === "DELIVERED"
              ? "bg-green-100 text-green-700"
              : row.status === "SHIPPED"
              ? "bg-blue-100 text-blue-700"
              : "bg-yellow-100 text-yellow-700"  // ✅ DRAFT should be yellow
          }`}
        >
          {row.status}
        </span>
      ),
    },

    {
      key: "shipmentDate",
      label: "Shipment Date",
      render: (row) => row.shipmentDate ? new Date(row.shipmentDate).toLocaleDateString() : "-",
    },

    {
      key: "createdDate",
      label: "Created Date",
      render: (row) => new Date(row.createdDate).toLocaleString(),
    },

    // ✅ Added items count column
    {
      key: "items",
      label: "Items",
      render: (row) => (
        <span className="text-sm text-gray-600">
          {row.items?.length || 0} items
        </span>
      ),
    },

    // ✅ Added active status column
    {
      key: "active",
      label: "Status",
      render: (row) => (
        <span className={`text-xs font-medium ${row.active ? 'text-green-600' : 'text-red-600'}`}>
          {row.active ? '✅ Active' : '❌ Inactive'}
        </span>
      ),
    },
  ];

  // ================= HANDLERS =================

  const handleAddShipment = () => {
    setForm({
      id: null,
      shipmentNo: "",
      trackingNumber: "",
      carrier: "",
      shipmentDate: new Date().toISOString().split('T')[0], // ✅ Default to today
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
    console.log("View shipment:", shipment);
    // ✅ Optionally open detail modal or navigate
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Validate required fields
    if (!form.shipmentNo || !form.warehouseId) {
      alert("Shipment No and Warehouse are required!");
      return;
    }

    // ✅ Build payload according to schema
    const payload = {
      shipmentNo: form.shipmentNo,
      shipmentDate: form.shipmentDate || new Date().toISOString().split('T')[0],
      salesOrderId: Number(form.salesOrderId) || 0,
      reservationId: Number(form.reservationId) || 0,
      warehouseId: Number(form.warehouseId),
      carrier: form.carrier || "Unknown",
      trackingNumber: form.trackingNumber || "",
      status: form.status,
      active: true,
      createdBy: "system", // ✅ Should come from auth context
      tenantId: "default", // ✅ Should come from auth context
      items: form.items || [],
    };

    console.log("📦 SAVE PAYLOAD:", payload);

    try {
      if (form.id) {
        // ✅ UPDATE
        await axios.put(`/v1/api/shipment/${form.id}`, payload);
      } else {
        // ✅ CREATE
        await axios.post("/v1/api/shipment", payload);
      }
      
      // ✅ Refresh list
      await fetchShipments();
      setShowFormModal(false);
      
    } catch (err) {
      console.error("Error saving shipment:", err);
      alert("Failed to save shipment. Please try again.");
    }
  };

  // ✅ Handler to add items to shipment
  const handleAddItem = () => {
    const newItem: ShipmentItem = {
      id: Date.now(), // Temporary ID
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      createdBy: form.createdBy || "system",
      tenantId: form.tenantId || "default",
      shipment: form.shipmentNo,
      productId: 0,
      shippedQty: 0,
    };

    setForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleItemChange = (index: number, field: keyof ShipmentItem, value: any) => {
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

        {/* STATS */}
        <div className="grid grid-cols-4 gap-4">
          <StatsCard 
            label="Total" 
            value={shipments.length} 
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard 
            label="Draft" 
            value={shipments.filter(s => s.status === "DRAFT").length}
            gradient="from-yellow-50 to-amber-50"  // ✅ Changed to yellow for draft
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard 
            label="Shipped" 
            value={shipments.filter(s => s.status === "SHIPPED").length}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
          />
          <StatsCard 
            label="Delivered" 
            value={shipments.filter(s => s.status === "DELIVERED").length}
            gradient="from-green-50 to-emerald-50"  // ✅ Changed to green for delivered
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
        </div>

        {/* SEARCH - ✅ FIXED input placement */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder="Search by shipment no, tracking, or ID..."
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

        {/* FILTER */}
        {showFilters && (
          <div className="p-4 border rounded bg-gray-50 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as ShipmentStatus | "ALL")
                }
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
            
            {statusFilter !== "ALL" && (
              <button
                onClick={() => setStatusFilter("ALL")}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                ✕ Clear Filter
              </button>
            )}
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

        {/* ✅ IMPROVED FORM MODAL with items support */}
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
                {/* ✅ Required fields */}
                <FloatingInput
                  label="Shipment No *"
                  name="shipmentNo"
                  value={form.shipmentNo}
                  onChange={handleChange}
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
                    <option value="DRAFT">Draft</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="DELIVERED">Delivered</option>
                  </select>
                </div>

                {/* ✅ Optional fields */}
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

              {/* ✅ ITEMS SECTION */}
              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-md font-semibold text-gray-700">
                    📦 Items ({form.items.length})
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
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {form.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <input
                          type="number"
                          placeholder="Product ID"
                          value={item.productId || ''}
                          onChange={(e) => handleItemChange(index, 'productId', Number(e.target.value))}
                          className="w-1/3 p-1 border rounded text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.shippedQty || ''}
                          onChange={(e) => handleItemChange(index, 'shippedQty', Number(e.target.value))}
                          className="w-1/4 p-1 border rounded text-sm"
                        />
                        <span className="text-xs text-gray-500 flex-1">
                          ID: {item.id}
                        </span>
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
                  {form.id ? "Update" : "Create"} Shipment
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default Shipment;