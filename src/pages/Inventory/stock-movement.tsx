import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { AuthContext } from "../../context/AuthContext";

interface Product {
  id: number;
  name: string;
}

interface Warehouse {
  id: number;
  name: string;
  code?: string;
}

interface Batch {
  id: number;
  batchNumber: string;
}

interface SerialNumber {
  id: number;
  serial?: string;
}

interface StockMovement {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  movementDate: string;
  movementType: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  reference: string;
  productId?: number;
  product?: Product;
  warehouse?: Warehouse | string;
  batch?: Batch | string;
  serialNumber?: SerialNumber | string;
}

const API_URL = "/v1/api/inventory";
const stockMovementApi = axios.create();

stockMovementApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const ITEMS_PER_PAGE = 5;

const MOVEMENT_TYPES = ["GRN", "Transfer", "Adjustment", "Return", "Sale"];

const StockMovementsManager: React.FC = () => {
  const { user } = useContext(AuthContext);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    movementDate: "",
    movementType: "",
    quantity: "",
    fromLocation: "",
    toLocation: "",
    reference: "",
    productId: "",
    warehouseId: "",
    batchId: "",
    serialNumberId: "",
  });

  useEffect(() => {
    fetchStockMovements();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
    fetchSerialNumbers();
  }, []);

  const fetchStockMovements = async () => {
    try {
      const res = await stockMovementApi.get(`${API_URL}/stock-movements`);
      setStockMovements(res.data);
    } catch (err) {
      console.error("Failed to load stock movements", err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await stockMovementApi.get(`${API_URL}/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products", err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await stockMovementApi.get(`${API_URL}/warehouses`);
      setWarehouses(res.data);
    } catch (err) {
      console.error("Failed to load warehouses", err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await stockMovementApi.get(`${API_URL}/batches`);
      setBatches(res.data);
    } catch (err) {
      console.error("Failed to load batches", err);
    }
  };

  const fetchSerialNumbers = async () => {
    try {
      const res = await stockMovementApi.get(`${API_URL}/serial-numbers`);
      setSerialNumbers(res.data);
    } catch (err) {
      console.error("Failed to load serial numbers", err);
    }
  };

  const clearForm = () => {
    setForm({
      movementDate: "",
      movementType: "",
      quantity: "",
      fromLocation: "",
      toLocation: "",
      reference: "",
      productId: "",
      warehouseId: "",
      batchId: "",
      serialNumberId: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const getWarehouseValue = (warehouseId: string) => {
    const warehouse = warehouses.find((item) => item.id === Number(warehouseId));
    return warehouse?.code || warehouse?.name || warehouseId;
  };

  const getBatchValue = (batchId: string) => {
    const batch = batches.find((item) => item.id === Number(batchId));
    return batch?.batchNumber || batchId;
  };

  const getSerialNumberValue = (serialNumberId: string) => {
    const serialNumber = serialNumbers.find((item) => item.id === Number(serialNumberId));
    return serialNumber?.serial || serialNumberId;
  };

  const getWarehouseId = (warehouse?: Warehouse | string) => {
    if (!warehouse) return "";
    if (typeof warehouse !== "string") return warehouse.id?.toString() || "";
    return warehouses.find((item) => item.code === warehouse || item.name === warehouse)?.id?.toString() || "";
  };

  const getBatchId = (batch?: Batch | string) => {
    if (!batch) return "";
    if (typeof batch !== "string") return batch.id?.toString() || "";
    return batches.find((item) => item.batchNumber === batch)?.id?.toString() || "";
  };

  const getSerialNumberId = (serialNumber?: SerialNumber | string) => {
    if (!serialNumber) return "";
    if (typeof serialNumber !== "string") return serialNumber.id?.toString() || "";
    return serialNumbers.find((item) => item.serial === serialNumber)?.id?.toString() || "";
  };

  const buildPayload = () => {
    const now = new Date().toISOString();

    return {
      id: editingId || 0,
      createdDate: now,
      updatedDate: now,
      createdBy: user?.userId || user?.username || "",
      tenantId: user?.tenantId || "",
      movementDate: form.movementDate,
      movementType: form.movementType,
      quantity: Number(form.quantity) || 0,
      fromLocation: form.fromLocation,
      toLocation: form.toLocation,
      reference: form.reference,
      productId: Number(form.productId) || 0,
      warehouse: getWarehouseValue(form.warehouseId),
      batch: getBatchValue(form.batchId),
      serialNumber: form.serialNumberId
        ? {
            id: Number(form.serialNumberId),
            serial: getSerialNumberValue(form.serialNumberId),
          }
        : null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await stockMovementApi.put(`${API_URL}/stock-movements/${editingId}`, buildPayload());
      } else {
        await stockMovementApi.post(`${API_URL}/stock-movements`, buildPayload());
      }

      fetchStockMovements();
      clearForm();
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  const handleEdit = (sm: StockMovement) => {
    setEditingId(sm.id);
    setForm({
      movementDate: sm.movementDate || "",
      movementType: sm.movementType || "",
      quantity: sm.quantity?.toString() || "",
      fromLocation: sm.fromLocation || "",
      toLocation: sm.toLocation || "",
      reference: sm.reference || "",
      productId: sm.productId?.toString() || sm.product?.id?.toString() || "",
      warehouseId: getWarehouseId(sm.warehouse),
      batchId: getBatchId(sm.batch),
      serialNumberId: getSerialNumberId(sm.serialNumber),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this stock movement?")) return;

    try {
      await stockMovementApi.delete(`${API_URL}/stock-movements/${id}`);
      fetchStockMovements();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const filtered = stockMovements.filter((sm) =>
    `${sm.movementType || ""} ${sm.fromLocation || ""} ${sm.toLocation || ""} ${sm.reference || ""} ${sm.product?.name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const totalMovements = stockMovements.length;
  const totalQuantity = stockMovements.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0);
  const transferCount = stockMovements.filter((sm) => sm.movementType === "Transfer").length;
  const uniqueProducts = new Set(stockMovements.map((sm) => sm.product?.id ?? sm.product?.name).filter(Boolean)).size;

  const tableColumns: ColumnDef<StockMovement>[] = [
    {
      key: "movementDate",
      label: "Date",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      sortValueGetter: (sm) => new Date(sm.movementDate).getTime(),
      render: (sm) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="font-medium">{new Date(sm.movementDate).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: "movementType",
      label: "Type",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (sm) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <ArrowsRightLeftIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {sm.movementType}
        </span>
      ),
    },
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (sm) => sm.product?.name || "",
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (sm) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CubeIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {sm.product?.name || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      headerClassName: "w-[9%] text-left",
      className: "w-[9%]",
      render: (sm) => <span className="text-sm font-semibold text-slate-700">{sm.quantity}</span>,
    },
    {
      key: "route",
      label: "Movement",
      sortable: false,
      headerClassName: "w-[24%] text-left",
      className: "w-[24%]",
      render: (sm) => (
        <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
          <span className="truncate font-medium" title={sm.fromLocation}>{sm.fromLocation || "N/A"}</span>
          <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium" title={sm.toLocation}>{sm.toLocation || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (sm) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ClipboardDocumentListIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium" title={sm.reference}>{sm.reference || "--"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[8%] text-right pr-4",
      className: "w-[8%] text-right",
      render: (sm) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(sm)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Stock Movement"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(sm.id)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Stock Movement"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Stock Movements" description="Track and manage inventory stock movements" />
      <PageBreadcrumb pageTitle="Stock Movements" />

      <div className="w-full max-w-none px-0 py-6">
        {!showForm && (
          <>
            <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
              <AddButton
                label="Add Stock Movement"
                onClick={() => {
                  clearForm();
                  setShowForm(true);
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatsCard
                label="Total Movements"
                value={totalMovements}
                gradient="from-cyan-50 to-blue-50"
                borderColor="border-cyan-100"
                labelColor="text-cyan-600"
                icon={<ArrowsRightLeftIcon />}
              />
              <StatsCard
                label="Total Quantity"
                value={totalQuantity.toLocaleString()}
                gradient="from-green-50 to-emerald-50"
                borderColor="border-green-100"
                labelColor="text-green-600"
                icon={<CubeIcon />}
              />
              <StatsCard
                label="Transfers"
                value={transferCount}
                gradient="from-purple-50 to-pink-50"
                borderColor="border-purple-100"
                labelColor="text-purple-600"
                icon={<ArrowRightIcon />}
              />
              <StatsCard
                label="Products Moved"
                value={uniqueProducts}
                gradient="from-orange-50 to-yellow-50"
                borderColor="border-orange-100"
                labelColor="text-orange-600"
                icon={<BuildingStorefrontIcon />}
              />
            </div>

            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1 max-w-md w-full">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by type, location, reference, or product..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </>
        )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="form-container"
          style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "0.5rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Movement Date */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Movement Date
              </label>
              <input
                type="date"
                value={form.movementDate}
                onChange={(e) => handleChange("movementDate", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Movement Type */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Movement Type
              </label>
              <select
                value={form.movementType}
                onChange={(e) => handleChange("movementType", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Type</option>
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Quantity
              </label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
                required
                min="1"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Product */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Product
              </label>
              <select
                value={form.productId}
                onChange={(e) => handleChange("productId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* From Location */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                From Location
              </label>
              <input
                type="text"
                value={form.fromLocation}
                onChange={(e) => handleChange("fromLocation", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* To Location */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                To Location
              </label>
              <input
                type="text"
                value={form.toLocation}
                onChange={(e) => handleChange("toLocation", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            {/* Warehouse */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Warehouse
              </label>
              <select
                value={form.warehouseId}
                onChange={(e) => handleChange("warehouseId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Batch
              </label>
              <select
                value={form.batchId}
                onChange={(e) => handleChange("batchId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Batch</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Serial Number */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Serial Number
              </label>
              <select
                value={form.serialNumberId}
                onChange={(e) => handleChange("serialNumberId", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  backgroundColor: "white",
                }}
              >
                <option value="">Select Serial Number</option>
                {serialNumbers.map((sn) => (
                  <option key={sn.id} value={sn.id}>
                    {sn.serial || `ID: ${sn.id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500", color: "#374151" }}>
                Reference
              </label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => handleChange("reference", e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>

          <div className="form-actions" style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
            <button
              type="submit"
              className="btn btn-success"
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              {editingId ? "Update" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={clearForm}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

        {/* Table */}
        {!showForm && (
          <ReusableTable
            data={filtered}
            columns={tableColumns}
            pageSize={ITEMS_PER_PAGE}
            defaultSortKey="movementDate"
            defaultSortOrder="desc"
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowsRightLeftIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No stock movements found</p>
                <p className="text-gray-400 text-xs">Click "Add Stock Movement" to create one</p>
              </div>
            }
          />
        )}
      </div>
    </>
  );
};

export default StockMovementsManager;
