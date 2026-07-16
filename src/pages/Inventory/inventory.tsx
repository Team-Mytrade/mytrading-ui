// pages/InventoryStockManager.tsx

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type Warehouse = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code?: string;
  name?: string;
  locationType?: string;
  stockLevels?: any[];
  batches?: any[];
  serialNumbers?: any[];
  stockMovements?: any[];
  stockAdjustments?: any[];
  stockEntries?: any[];
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

const movementTypeOptions = ["GRN", "TRANSFER", "RETURN"];

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

function toNumber(value: string | number | undefined | null): number {
  return Number(value || 0);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function normalizeProductLabel(product: ProductOption): string {
  const code = product.productCode || product.code || product.sku;
  const name = product.productName || product.name || `Product #${product.id}`;
  return code ? `${name} (${code})` : name;
}

function getWarehouseId(warehouse: InventoryStock["warehouse"]): string {
  if (!warehouse) return "";
  if (typeof warehouse !== "string") return String(warehouse.id || "");
  return "";
}

function getWarehouseName(warehouse: InventoryStock["warehouse"]): string {
  if (!warehouse) return "--";
  if (typeof warehouse === "string") return warehouse;
  return warehouse.name || warehouse.code || `Warehouse #${warehouse.id}`;
}

function getWarehouseCode(warehouse: InventoryStock["warehouse"]): string {
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
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [stocks, setStocks] = useState<InventoryStock[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<InventoryForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteStock, setDeleteStock] = useState<InventoryStock | null>(null);

  useEffect(() => {
    fetchAllStock();
    fetchDropdowns();
  }, []);

  const fetchAllStock = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<InventoryStock[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      setStocks(data);
    } catch (error) {
      setStocks([]);
      ToasterService.error("Failed to load inventory stock", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async (): Promise<void> => {
    try {
      const [warehouseRes, productRes] = await Promise.all([
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
        axios.get<ProductOption[]>(PRODUCT_API_URL, { headers }),
      ]);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
    } catch (error) {
      ToasterService.error("Failed to load dropdown data", getErrorMessage(error, "Please try again."));
    }
  };

  const openCreate = (): void => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const closeForm = (): void => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openEdit = (stock: InventoryStock): void => {
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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const selectedWarehouse = warehouses.find((w) => w.id === toNumber(form.warehouseId));
    const existing = stocks.find((s) => s.id === editingId);

    return {
      id: editingId || 0,
      createdDate: existing?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      createdBy: existing?.createdBy || "",
      tenantId: existing?.tenantId || "",
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
            createdDate: selectedWarehouse.createdDate || new Date().toISOString(),
            updatedDate: selectedWarehouse.updatedDate || new Date().toISOString(),
            createdBy: selectedWarehouse.createdBy || "",
            tenantId: selectedWarehouse.tenantId || "",
            code: selectedWarehouse.code || "",
            name: selectedWarehouse.name || "",
            locationType: selectedWarehouse.locationType || "MAIN",
            stockLevels: selectedWarehouse.stockLevels || [],
            batches: selectedWarehouse.batches || [],
            serialNumbers: selectedWarehouse.serialNumbers || [],
            stockMovements: selectedWarehouse.stockMovements || [],
            stockAdjustments: selectedWarehouse.stockAdjustments || [],
            stockEntries: selectedWarehouse.stockEntries || [],
          }
        : null,
    };
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Inventory stock updated successfully");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Inventory stock created successfully");
      }

      closeForm();
      await fetchAllStock();
    } catch (error) {
      ToasterService.error("Failed to save inventory stock", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteStock?.id) return;

    try {
      await axios.delete(`${API_URL}/${deleteStock.id}?cascade=true`, { headers });
      ToasterService.success("Inventory stock deleted successfully");
      setDeleteStock(null);
      await fetchAllStock();
    } catch (error) {
      ToasterService.error("Failed to delete inventory stock", getErrorMessage(error, "Please try again."));
    }
  };

  const filteredStocks = useMemo(() => {
    const term = searchableText(search);

    return stocks.filter((stock) => {
      const matchesType = typeFilter === "" || stock.type === typeFilter;

      const available = Math.max(0, stock.quantity - stock.reservedQty);
      let matchesStatus = true;
      if (statusFilter === "low") {
        matchesStatus = available > 0 && available <= stock.minStockLevel;
      } else if (statusFilter === "out") {
        matchesStatus = available <= 0;
      } else if (statusFilter === "healthy") {
        matchesStatus = available > stock.minStockLevel;
      }

      const warehouseName = getWarehouseName(stock.warehouse);
      const product = products.find(
        (p) => p.id === stock.productId || p.productId === stock.productId
      );
      const productName = product
        ? normalizeProductLabel(product)
        : `Product #${stock.productId}`;

      const searchString = `${stock.id} ${stock.type} ${stock.referenceNo} ${stock.productId} ${productName} ${warehouseName}`.toLowerCase();
      const matchesSearch = !term || searchString.includes(term);

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [stocks, search, typeFilter, statusFilter, products]);

  const stats = useMemo(
    () => ({
      total: stocks.length,
      totalQty: stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0),
      reservedQty: stocks.reduce((sum, s) => sum + Number(s.reservedQty || 0), 0),
      lowStock: stocks.filter(
        (s) => {
          const available = Math.max(0, s.quantity - s.reservedQty);
          return available > 0 && available <= s.minStockLevel;
        }
      ).length,
      outOfStock: stocks.filter(
        (s) => Math.max(0, s.quantity - s.reservedQty) <= 0
      ).length,
    }),
    [stocks]
  );

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
            <p className="truncate text-sm font-semibold text-slate-900">
              {stock.referenceNo || "--"}
            </p>
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
        const product = products.find(
          (p) => p.id === stock.productId || p.productId === stock.productId
        );
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
            {getWarehouseCode(stock.warehouse) && (
              <p className="text-xs text-slate-400">{getWarehouseCode(stock.warehouse)}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      render: (stock) => (
        <span className="text-sm font-semibold text-slate-800">{stock.quantity}</span>
      ),
    },
    {
      key: "reservedQty",
      label: "Reserved",
      sortable: true,
      render: (stock) => (
        <span className="text-sm font-medium text-amber-600">{stock.reservedQty}</span>
      ),
    },
    {
      key: "movementDate",
      label: "Movement Date",
      sortable: true,
      render: (stock) => (
        <span className="text-sm text-slate-600">
          {stock.movementDate ? new Date(stock.movementDate).toLocaleDateString() : "--"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (stock) => {
        const status = getStockStatus(stock);
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
          >
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
        <div className="flex justify-end gap-1">
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

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Stock" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Stock Records"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<ArrowsRightLeftIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Total Quantity"
            value={stats.totalQty.toLocaleString()}
            gradient="from-emerald-50 to-green-50"
            borderColor="border-emerald-100"
            labelColor="text-emerald-600"
            icon={<CubeIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Reserved"
            value={stats.reservedQty.toLocaleString()}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-700"
            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Low Stock"
            value={stats.lowStock}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          />
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search inventory stock..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ListingPdfExportButton<InventoryStock>
              title="Inventory Stock Report"
              subtitle="Filtered inventory stock listing"
              reportLabel="Stock Report"
              data={filteredStocks}
              fileName="Inventory_Stock"
              disabled={loading}
              metadata={(rows, rangeLabel) => [
                { label: "Total", value: rows.length },
                { label: "Range", value: rangeLabel },
                { label: "Type", value: typeFilter || "All" },
                { label: "Status", value: statusFilter || "All" },
                { label: "Search", value: search || "None" },
              ]}
              columns={[
                { header: "Reference", accessor: (stock) => stock.referenceNo || `ID: ${stock.id}` },
                { header: "Type", key: "type" },
                { header: "Product", accessor: (stock) => {
                  const product = products.find((p) => p.id === stock.productId || p.productId === stock.productId);
                  return product ? normalizeProductLabel(product) : `Product #${stock.productId}`;
                }},
                { header: "Warehouse", accessor: (stock) => getWarehouseName(stock.warehouse) },
                { header: "Quantity", key: "quantity" },
                { header: "Reserved", key: "reservedQty" },
                { header: "Status", accessor: (stock) => getStockStatus(stock).label },
              ]}
            />

            <FilterPopover
              title="Filter Stock"
              buttonLabel="Filters"
              label="Type"
              value={typeFilter}
              options={[
                { label: "All Types", value: "" },
                ...movementTypeOptions.map((type) => ({
                  label: type,
                  value: type,
                })),
              ]}
              onChange={setTypeFilter}
              onReset={() => setTypeFilter("")}
              onApply={() => undefined}
            />
          </div>
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
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first stock entry
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
  isOpen={showFormModal}
  title={editingId ? "Edit Stock Entry" : "Create Stock Entry"}
  subtitle="Add stock to your inventory"
  onClose={closeForm}
  onSubmit={handleSubmit}
  submitting={submitting}
  submitLabel={editingId ? "Update Stock" : "Create Stock"}
  maxWidthClassName="max-w-4xl"
  tabs={[
    {
      label: "Basic Info",
      fields: [
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FloatingSelect
            label="Movement Type"
            name="type"
            value={form.type}
            onChange={handleChange}
            includeEmptyOption={false}
            options={movementTypeOptions.map((type) => ({ id: type, name: type }))}
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
        </div>,
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FloatingSelect
            label="Product"
            name="productId"
            value={form.productId}
            onChange={handleChange}
            emptyOptionLabel="Select product"
            options={products.map((p) => ({
              id: String(p.id || p.productId || 0),
              name: normalizeProductLabel(p),
            }))}
            required
          />
          <FloatingSelect
            label="Warehouse"
            name="warehouseId"
            value={form.warehouseId}
            onChange={handleChange}
            emptyOptionLabel="Select warehouse"
            options={warehouses.map((w) => ({
              id: String(w.id),
              name: `${w.name || w.code || `Warehouse #${w.id}`}`,
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
        </div>,
      ],
    },
    {
      label: "Stock Settings",
      fields: [
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
        </div>,
      ],
    },
  ]}
/>
<PaginatedPopup
  isOpen={showFormModal}
  title={editingId ? "Edit Stock Entry" : "Create Stock Entry"}
  subtitle="Add stock to your inventory"
  onClose={closeForm}
  onSubmit={handleSubmit}
  submitting={submitting}
  submitLabel={editingId ? "Update Stock" : "Create Stock"}
  maxWidthClassName="max-w-4xl"
  tabs={[
    {
      label: "Stock Info",
      fields: [
        <FloatingSelect
          key="type"
          label="Movement Type"
          name="type"
          value={form.type}
          onChange={handleChange}
          includeEmptyOption={false}
          options={movementTypeOptions.map((type) => ({ id: type, name: type }))}
          required
        />,
        <FloatingDatePicker
          key="movementDate"
          label="Movement Date"
          name="movementDate"
          value={form.movementDate}
          onChange={handleChange}
          required
        />,
        <FloatingInput
          key="referenceNo"
          label="Reference Number"
          name="referenceNo"
          value={form.referenceNo}
          onChange={handleChange}
          required
        />,
        <FloatingSelect
          key="productId"
          label="Select product"
          name="productId"
          value={form.productId}
          onChange={handleChange}
          emptyOptionLabel="Select product"
          options={products.map((p) => ({
            id: String(p.id || p.productId || 0),
            name: normalizeProductLabel(p),
          }))}
          required
        />,
        <FloatingSelect
          key="warehouseId"
          label="Select warehouse"
          name="warehouseId"
          value={form.warehouseId}
          onChange={handleChange}
          emptyOptionLabel="Select warehouse"
          options={warehouses.map((w) => ({
            id: String(w.id),
            name: `${w.name || w.code || `Warehouse #${w.id}`}`,
          }))}
          required
        />,
        <FloatingInput
          key="quantity"
          label="Quantity"
          name="quantity"
          type="number"
          value={form.quantity}
          onChange={handleChange}
          required
        />,
      ],
    },
    {
      label: "Stock Settings",
      fields: [
        <FloatingInput
          key="reservedQty"
          label="Reserved Quantity"
          name="reservedQty"
          type="number"
          value={form.reservedQty}
          onChange={handleChange}
        />,
        <FloatingInput
          key="minStockLevel"
          label="Minimum Stock Level"
          name="minStockLevel"
          type="number"
          value={form.minStockLevel}
          onChange={handleChange}
        />,
      ],
    },
  ]}
/>
      

      <DynamicPopup
        isPopupOpen={!!deleteStock}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteStock(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Inventory Stock"
        subText={
          deleteStock
            ? `Are you sure you want to delete stock entry #${deleteStock.id}?`
            : "Are you sure?"
        }
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