import React, { ChangeEvent, FormEvent, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowsRightLeftIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";

type Warehouse = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code?: string;
  name?: string;
  locationType?: string;
};

type ProductOption = {
  id: number;
  productId?: number;
  productCode?: string;
  code?: string;
  sku?: string;
  productName?: string;
  name?: string;
  categoryName?: string;
};

type InventoryStock = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  type: string;
  quantity: number;
  movementDate: string;
  referenceNo: string;
  productId: number;
  reservedQty: number;
  minStockLevel: number;
  warehouse?: Warehouse | string | null;
};

type InventoryForm = {
  type: string;
  quantity: string;
  movementDate: string;
  referenceNo: string;
  productId: string;
  reservedQty: string;
  minStockLevel: string;
  warehouseId: string;
};

const API_URL = "/v1/api/inventory/stock";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/purchase/products";
const PAGE_SIZE = 10;
const movementTypeOptions = ["GRN", "TRANSFER", "ADJUSTMENT", "RETURN", "SALE"];

const emptyForm: InventoryForm = {
  type: "GRN",
  quantity: "0",
  movementDate: new Date().toISOString().split("T")[0],
  referenceNo: "",
  productId: "",
  reservedQty: "0",
  minStockLevel: "0",
  warehouseId: "",
};

function toNumber(value: string | number | undefined | null) {
  return Number(value || 0);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null") || {};
  } catch {
    return {};
  }
}

function normalizeProductLabel(product: ProductOption) {
  const code = product.productCode || product.code || product.sku;
  const name = product.productName || product.name || `Product #${product.id}`;
  return code ? `${name} (${code})` : name;
}

function getWarehouseId(warehouse: InventoryStock["warehouse"]) {
  if (!warehouse) return "";
  if (typeof warehouse !== "string") return String(warehouse.id || "");
  return "";
}

function getWarehouseName(warehouse: InventoryStock["warehouse"]) {
  if (!warehouse) return "--";
  if (typeof warehouse === "string") return warehouse;
  return warehouse.name || warehouse.code || `Warehouse #${warehouse.id}`;
}

function getWarehouseCode(warehouse: InventoryStock["warehouse"]) {
  if (!warehouse || typeof warehouse === "string") return "";
  return warehouse.code || "";
}

function getStockStatus(stock: InventoryStock) {
  const available = Math.max(0, stock.quantity - stock.reservedQty);
  if (available <= 0) {
    return {
      label: "Out of Stock",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" />,
    };
  }
  if (available <= stock.minStockLevel) {
    return {
      label: "Low Stock",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: "Healthy",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
  };
}

const InventoryStockManager: React.FC = () => {
  const { user } = useContext(AuthContext);
  const authUser = getStoredUser();
  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, []);

  const [stocks, setStocks] = useState<InventoryStock[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [availabilityProductId, setAvailabilityProductId] = useState("");
  const [availabilityWarehouseId, setAvailabilityWarehouseId] = useState("");
  const [availabilityQty, setAvailabilityQty] = useState<number | null>(null);
  const [deleteStock, setDeleteStock] = useState<InventoryStock | null>(null);

  useEffect(() => {
    void fetchAllStock();
    void fetchDropdowns();
  }, []);

  const fetchAllStock = async () => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryStock[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      setStocks(data);
      if (data.length === 0) ToasterService.noData("No inventory stock records found");
    } catch (error) {
      setStocks([]);
      ToasterService.error("Failed to load inventory stock", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    const [warehouseRes, productRes] = await Promise.allSettled([
      axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
      axios.get<ProductOption[]>(PRODUCT_API_URL, { headers }),
    ]);

    if (warehouseRes.status === "fulfilled") {
      setWarehouses(Array.isArray(warehouseRes.value.data) ? warehouseRes.value.data : []);
    } else {
      setWarehouses([]);
      ToasterService.error("Failed to load warehouses");
    }

    if (productRes.status === "fulfilled") {
      setProducts(Array.isArray(productRes.value.data) ? productRes.value.data : []);
    } else {
      setProducts([]);
      ToasterService.error("Failed to load products");
    }
  };

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Stock ID is required");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get<InventoryStock>(`${API_URL}/${lookupId}`, { headers });
      setStocks(response.data ? [response.data] : []);
      ToasterService.success("Inventory stock loaded");
    } catch (error) {
      ToasterService.error("Failed to load inventory stock", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStock = async () => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryStock[]>(`${API_URL}/low-stock`, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      setStocks(data);
      data.length ? ToasterService.success("Low stock items loaded") : ToasterService.noData("No low stock items found");
    } catch (error) {
      ToasterService.error("Failed to load low stock items", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!availabilityProductId || !availabilityWarehouseId) {
      ToasterService.error("Select both product and warehouse");
      return;
    }

    try {
      const response = await axios.get<number>(`${API_URL}/availability`, {
        headers,
        params: {
          productId: availabilityProductId,
          warehouseId: availabilityWarehouseId,
        },
      });
      setAvailabilityQty(Number(response.data || 0));
      ToasterService.success("Availability loaded");
    } catch (error) {
      setAvailabilityQty(null);
      ToasterService.error("Failed to check availability", getErrorMessage(error, "Please try again."));
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openEdit = (stock: InventoryStock) => {
    setEditingId(stock.id);
    setForm({
      type: stock.type || "GRN",
      quantity: String(stock.quantity ?? 0),
      movementDate: stock.movementDate || new Date().toISOString().split("T")[0],
      referenceNo: stock.referenceNo || "",
      productId: String(stock.productId || ""),
      reservedQty: String(stock.reservedQty ?? 0),
      minStockLevel: String(stock.minStockLevel ?? 0),
      warehouseId: getWarehouseId(stock.warehouse),
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === toNumber(form.warehouseId));

    return {
      id: editingId || 0,
      createdDate: editingId
        ? stocks.find((item) => item.id === editingId)?.createdDate || new Date().toISOString()
        : new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      createdBy: user?.userId || user?.id || authUser.userId || authUser.id || "",
      tenantId: user?.tenantId || authUser.tenantId || "",
      type: form.type,
      quantity: toNumber(form.quantity),
      movementDate: form.movementDate,
      referenceNo: form.referenceNo,
      productId: toNumber(form.productId),
      reservedQty: toNumber(form.reservedQty),
      minStockLevel: toNumber(form.minStockLevel),
      warehouse: selectedWarehouse
        ? {
            id: selectedWarehouse.id,
            createdDate: selectedWarehouse.createdDate,
            updatedDate: selectedWarehouse.updatedDate,
            createdBy: selectedWarehouse.createdBy,
            tenantId: selectedWarehouse.tenantId,
            code: selectedWarehouse.code || "",
            name: selectedWarehouse.name || "",
            locationType: selectedWarehouse.locationType || "MAIN",
            stockLevels: [],
            batches: [],
            serialNumbers: [],
            stockMovements: [],
            stockAdjustments: [],
            stockEntries: [],
          }
        : null,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      const payload = buildPayload();
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Inventory stock updated");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Inventory stock created");
      }
      closeForm();
      await fetchAllStock();
    } catch (error) {
      ToasterService.error("Failed to save inventory stock", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteStock?.id) return;

    try {
      await axios.delete(`${API_URL}/${deleteStock.id}`, { headers });
      ToasterService.success("Inventory stock deleted");
      setDeleteStock(null);
      await fetchAllStock();
    } catch (error) {
      ToasterService.error("Failed to delete inventory stock", getErrorMessage(error, "Please try again."));
    }
  };

  const filteredStocks = stocks.filter((stock) => {
    const warehouseName = getWarehouseName(stock.warehouse);
    const productName =
      products.find((product) => product.id === stock.productId || product.productId === stock.productId)?.productName ||
      products.find((product) => product.id === stock.productId || product.productId === stock.productId)?.name ||
      "";

    return `${stock.id} ${stock.type} ${stock.referenceNo} ${stock.productId} ${productName} ${warehouseName}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const stats = {
    total: stocks.length,
    totalQty: stocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0),
    reservedQty: stocks.reduce((sum, stock) => sum + Number(stock.reservedQty || 0), 0),
    lowStock: stocks.filter((stock) => Math.max(0, stock.quantity - stock.reservedQty) <= stock.minStockLevel).length,
  };

  const columns: ColumnDef<InventoryStock>[] = [
    {
      key: "referenceNo",
      label: "Reference",
      sortable: true,
      render: (stock) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50">
            <ArrowsRightLeftIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{stock.referenceNo || "--"}</p>
            <p className="text-xs text-slate-400">Stock #{stock.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (stock) => (
        <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
          {stock.type}
        </span>
      ),
    },
    {
      key: "productId",
      label: "Product",
      sortable: true,
      render: (stock) => {
        const product = products.find((item) => item.id === stock.productId || item.productId === stock.productId);
        return (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <CubeIcon className="h-4 w-4 text-slate-400" />
            <span>{product ? normalizeProductLabel(product) : `Product #${stock.productId}`}</span>
          </div>
        );
      },
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: false,
      render: (stock) => (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
          <div>
            <p>{getWarehouseName(stock.warehouse)}</p>
            {getWarehouseCode(stock.warehouse) && <p className="text-xs text-slate-400">{getWarehouseCode(stock.warehouse)}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      render: (stock) => <span className="text-sm font-semibold text-slate-800">{stock.quantity}</span>,
    },
    {
      key: "reservedQty",
      label: "Reserved",
      sortable: true,
      render: (stock) => <span className="text-sm font-medium text-amber-600">{stock.reservedQty}</span>,
    },
    {
      key: "movementDate",
      label: "Movement Date",
      sortable: true,
      render: (stock) => <span className="text-sm text-slate-600">{stock.movementDate || "--"}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (stock) => {
        const status = getStockStatus(stock);
        return (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.icon}
            {status.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (stock) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteStock(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Inventory Stock" description="Manage inventory stock" />
      <PageBreadcrumb pageTitle="Inventory Stock" />

      <div className="w-full max-w-none space-y-6 px-0 py-8">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Stock" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Stock Records" value={stats.total} icon={<ArrowsRightLeftIcon />} />
          <StatsCard
            label="Total Quantity"
            value={stats.totalQty.toLocaleString()}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<CubeIcon />}
          />
          <StatsCard
            label="Reserved Quantity"
            value={stats.reservedQty.toLocaleString()}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-700"
            icon={<ExclamationTriangleIcon />}
          />
          <StatsCard
            label="Low Stock"
            value={stats.lowStock}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ExclamationTriangleIcon />}
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            <FloatingInput
              label="Stock ID"
              type="number"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button
              type="button"
              onClick={fetchById}
              className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
            >
              Get By ID
            </button>
            <button
              type="button"
              onClick={fetchLowStock}
              className="h-[52px] rounded-lg bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600"
            >
              Low Stock
            </button>
            <button
              type="button"
              onClick={fetchAllStock}
              className="h-[52px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Load All
            </button>
            <FloatingSelect
              label="Availability Product"
              name="availabilityProductId"
              value={availabilityProductId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setAvailabilityProductId(e.target.value)}
              emptyOptionLabel="Select product"
              options={products.map((product) => ({
                id: String(product.id || product.productId || 0),
                name: normalizeProductLabel(product),
              }))}
            />
            <FloatingSelect
              label="Availability Warehouse"
              name="availabilityWarehouseId"
              value={availabilityWarehouseId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setAvailabilityWarehouseId(e.target.value)}
              emptyOptionLabel="Select warehouse"
              options={warehouses.map((warehouse) => ({
                id: String(warehouse.id),
                name: warehouse.name || warehouse.code || `Warehouse #${warehouse.id}`,
              }))}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={checkAvailability}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Check Availability
            </button>
            {availabilityQty !== null && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                Available Qty: {availabilityQty}
              </span>
            )}
          </div>
        </div>

        <div className="relative w-full sm:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search inventory stock..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <ReusableTable
          data={filteredStocks}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="movementDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No inventory stock found</p>
              <button type="button" onClick={openCreate} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                Create your first stock entry
              </button>
            </div>
          }
        />
      </div>

      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
          <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Inventory Stock" : "Create Inventory Stock"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">Payload aligned to the inventory swagger</p>
              </div>
              <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
                <FloatingSelect
                  label="Movement Type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  includeEmptyOption={false}
                  options={movementTypeOptions.map((option) => ({ id: option, name: option }))}
                />
                <FloatingDatePicker
                  label="Movement Date"
                  name="movementDate"
                  value={form.movementDate}
                  onChange={handleChange}
                  required
                />
                <FloatingInput
                  label="Reference Number"
                  name="referenceNo"
                  value={form.referenceNo}
                  onChange={handleChange}
                  required
                />
                <FloatingSelect
                  label="Product"
                  name="productId"
                  value={form.productId}
                  onChange={handleChange}
                  emptyOptionLabel="Select product"
                  options={products.map((product) => ({
                    id: String(product.id || product.productId || 0),
                    name: normalizeProductLabel(product),
                  }))}
                  required
                />
                <FloatingSelect
                  label="Warehouse"
                  name="warehouseId"
                  value={form.warehouseId}
                  onChange={handleChange}
                  emptyOptionLabel="Select warehouse"
                  options={warehouses.map((warehouse) => ({
                    id: String(warehouse.id),
                    name: `${warehouse.name || warehouse.code || `Warehouse #${warehouse.id}`}${warehouse.code ? ` (${warehouse.code})` : ""}`,
                  }))}
                  required
                />
                <FloatingInput
                  label="Quantity"
                  name="quantity"
                  type="number"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                />
                <FloatingInput
                  label="Reserved Quantity"
                  name="reservedQty"
                  type="number"
                  value={form.reservedQty}
                  onChange={handleChange}
                />
                <FloatingInput
                  label="Minimum Stock Level"
                  name="minStockLevel"
                  type="number"
                  value={form.minStockLevel}
                  onChange={handleChange}
                />
              </div>

              <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                <button type="button" onClick={closeForm} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Saving..." : editingId ? "Update Stock" : "Create Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DynamicPopup
        isPopupOpen={!!deleteStock}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteStock(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Inventory Stock"
        subText={deleteStock ? `Are you sure you want to delete stock #${deleteStock.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteStock(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default InventoryStockManager;
