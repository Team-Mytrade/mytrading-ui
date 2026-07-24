import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BuildingOfficeIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import DynamicPopup from "../../components/common/Popup";
import PaginatedPopup from "../../components/common/unpopup";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

// ---------- Type Definitions ----------
interface Product {
  id: number;
  productName: string;
  sku?: string;
}

interface Warehouse {
  id: number;
  name: string;
  code?: string;
}

// StockLevel can have nested objects or separate IDs
interface StockLevel {
  id: number;
  quantity: number;
  reserved: number;
  available: number;
  product?: Product;
  warehouse?: Warehouse;
  productId?: number;
  warehouseId?: number;
  createdAt?: string;
  updatedAt?: string;
}

// The 5 supported stock movement operations. Each maps 1:1 to a backend
// endpoint of the shape:
//   PUT /stock-levels/warehouse/{warehouseId}/product/{productId}/{action}?quantity={quantity}
type StockOperation =
  | "add-stock"
  | "reserve"
  | "release"
  | "remove-stock"
  | "complete-sale";

type StockLevelForm = {
  productId: string;
  warehouseId: string;
  operationType: StockOperation;
  quantity: string;
};

const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase/products";
const PAGE_SIZE = 10;

const emptyForm: StockLevelForm = {
  productId: "",
  warehouseId: "",
  operationType: "add-stock",
  quantity: "",
};

// Config for each operation: label shown in the dropdown, success toast copy,
// and the endpoint segment used to build the request URL.
const STOCK_OPERATIONS: Record<
  StockOperation,
  { label: string; endpoint: string; successMessage: string }
> = {
  "add-stock": {
    label: "Add Stock",
    endpoint: "add-stock",
    successMessage: "Stock added successfully",
  },
  reserve: {
    label: "Reserve",
    endpoint: "reserve",
    successMessage: "Stock reserved successfully",
  },
  release: {
    label: "Release",
    endpoint: "release",
    successMessage: "Reserved stock released successfully",
  },
  "remove-stock": {
    label: "Remove Stock",
    endpoint: "remove-stock",
    successMessage: "Stock removed successfully",
  },
  "complete-sale": {
    label: "Complete Sale",
    endpoint: "complete-sale",
    successMessage: "Sale completed successfully",
  },
};

// ---------- Helpers ----------
function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function getStockStatus(available: number, quantity: number) {
  if (quantity === 0) {
    return { color: "bg-gray-50 text-gray-600 border-gray-200", label: "No Stock", icon: <XCircleIcon className="h-3 w-3 mr-1" /> };
  }
  const percentage = (available / quantity) * 100;
  if (percentage <= 20) {
    return { color: "bg-red-50 text-red-700 border-red-200", label: "Low Stock", icon: <ExclamationTriangleIcon className="h-3 w-3 mr-1" /> };
  }
  if (percentage <= 50) {
    return { color: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Medium Stock", icon: <ChartBarIcon className="h-3 w-3 mr-1" /> };
  }
  return { color: "bg-green-50 text-green-700 border-green-200", label: "Healthy Stock", icon: <CheckBadgeIcon className="h-3 w-3 mr-1" /> };
}

// ---- ID extractors ----
function getProductId(stock: StockLevel): number | undefined {
  return stock.product?.id ?? stock.productId;
}

function getWarehouseId(stock: StockLevel): number | undefined {
  return stock.warehouse?.id ?? stock.warehouseId;
}

// ---- Name/SKU getters ----
function getProductName(stock: StockLevel, products: Product[]) {
  const id = getProductId(stock);
  const product = products.find(p => p.id === id);
  return product ? product.productName : "N/A";
}

function getProductSku(stock: StockLevel, products: Product[]) {
  const id = getProductId(stock);
  const product = products.find(p => p.id === id);
  return product?.sku || "";
}

function getWarehouseName(stock: StockLevel, warehouses: Warehouse[]) {
  const id = getWarehouseId(stock);
  const warehouse = warehouses.find(w => w.id === id);
  return warehouse ? warehouse.name : "N/A";
}

function getWarehouseCode(stock: StockLevel, warehouses: Warehouse[]) {
  const id = getWarehouseId(stock);
  const warehouse = warehouses.find(w => w.id === id);
  return warehouse?.code || "";
}

// View details text generator
function getStockDetailsText(stock: StockLevel, products: Product[], warehouses: Warehouse[]) {
  if (!stock) return "No stock details available";

  const status = getStockStatus(stock.available, stock.quantity);
  const utilization = stock.quantity > 0
    ? `${Math.round((stock.reserved / stock.quantity) * 100)}%`
    : "0%";

  let details = `Product: ${getProductName(stock, products)}`;
  const sku = getProductSku(stock, products);
  if (sku) details += `\nSKU: ${sku}`;
  details += `\nWarehouse: ${getWarehouseName(stock, warehouses)}`;
  const code = getWarehouseCode(stock, warehouses);
  if (code) details += ` (${code})`;
  details += `\n\nTotal Quantity: ${stock.quantity}`;
  details += `\nReserved: ${stock.reserved}`;
  details += `\nAvailable: ${stock.available}`;
  details += `\nUtilization: ${utilization}`;
  details += `\nStatus: ${status.label}`;
  if (stock.updatedAt) {
    details += `\nLast Updated: ${new Date(stock.updatedAt).toLocaleString()}`;
  }
  if (status.label === "Low Stock") {
    details += `\n\n⚠️ Low Stock Alert: This item has low stock levels. Consider replenishing soon.`;
  }

  return details;
}

// ---------- Component ----------
const StockLevelsManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<StockLevelForm>(emptyForm);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deletingStock, setDeletingStock] = useState<StockLevel | null>(null);
  const [viewingStock, setViewingStock] = useState<StockLevel | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  // null => "Add Stock Movement" (create) form, which always uses "add-stock"
  // and hides the Operation Type dropdown. Non-null => "Adjust Stock" (edit)
  // form for that row, which shows all 5 operation types.
  const [editingStock, setEditingStock] = useState<StockLevel | null>(null);

  useEffect(() => {
    fetchStockLevels();
    fetchProducts();
    fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStockLevels = async () => {
    try {
      setLoading(true);
      const res = await axios.get<StockLevel[]>(`${API_URL}/stock-levels`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setStockLevels(data);
      if (data.length === 0) ToasterService.noData("No stock levels found");
    } catch (error) {
      ToasterService.error("Failed to load stock levels", getErrorMessage(error, "Please try again."));
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get<Product[]>(PRODUCT_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setProducts(data);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get<Warehouse[]>(`${API_URL}/warehouses`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setWarehouses(data);
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value } as StockLevelForm));
  };

  // Builds the endpoint URL for the selected operation, e.g.:
  // /v1/api/inventory/stock-levels/warehouse/1/product/2/reserve?quantity=100
  const buildOperationUrl = (
    warehouseId: string,
    productId: string,
    operationType: StockOperation,
    quantity: string
  ) => {
    const endpoint = STOCK_OPERATIONS[operationType].endpoint;
    return `${API_URL}/stock-levels/warehouse/${warehouseId}/product/${productId}/${endpoint}?quantity=${quantity}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const quantity = Number(form.quantity) || 0;

    if (!form.productId) {
      ToasterService.error("Required field missing", "Product selection is required.");
      return;
    }
    if (!form.warehouseId) {
      ToasterService.error("Required field missing", "Warehouse selection is required.");
      return;
    }
    if (!form.operationType) {
      ToasterService.error("Required field missing", "Operation type is required.");
      return;
    }
    if (quantity <= 0) {
      ToasterService.error("Invalid quantity", "Quantity must be greater than 0.");
      return;
    }

    // Create mode always hides the Operation Type dropdown; it creates a
    // brand-new StockLevel row via POST (handles product/warehouse combos
    // that have never been stocked before).
    // Edit mode adjusts an EXISTING row via the PUT action endpoints.
    try {
      setSubmitting(true);

      if (!editingStock) {
        const reserved = 0;
        const payload = {
          id: 0,
          quantity,
          reserved,
          available: quantity - reserved,
          productId: Number(form.productId),
          warehouse: { id: Number(form.warehouseId) },
        };
        await axios.post(`${API_URL}/stock-levels`, payload, { headers });
        ToasterService.success("Stock level created successfully");
      } else {
        const operationType = form.operationType;
        const url = buildOperationUrl(form.warehouseId, form.productId, operationType, String(quantity));
        // Confirmed via Swagger + backend controller source: these are all
        // @PutMapping endpoints, e.g.
        //   @PutMapping("/warehouse/{warehouseId}/product/{productId}/add-stock")
        // No request body — quantity is a @RequestParam (query string).
        // NOTE: this endpoint expects the StockLevel row to already exist
        // for this product/warehouse combo — it will not create a new one.
        await axios.put(url, null, { headers });
        ToasterService.success(STOCK_OPERATIONS[operationType].successMessage);
      }

      closeForm();
      fetchStockLevels();
    } catch (error) {
      ToasterService.error(
        editingStock ? `Failed to ${STOCK_OPERATIONS[form.operationType].label.toLowerCase()}` : "Failed to create stock level",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingStock(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  // Pre-fills product/warehouse from the clicked row so the user only has to
  // pick the operation and quantity to apply against that stock level.
  const openEdit = (stock: StockLevel) => {
    setEditingStock(stock);
    setForm({
      productId: String(getProductId(stock) ?? ""),
      warehouseId: String(getWarehouseId(stock) ?? ""),
      operationType: "add-stock",
      quantity: "",
    });
    setShowFormModal(true);
  };

  const openView = (stock: StockLevel) => {
    setViewingStock(stock);
    setShowViewModal(true);
  };

  const closeForm = () => {
    setForm(emptyForm);
    setEditingStock(null);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deletingStock) return;

    try {
      await axios.delete(`${API_URL}/stock-levels/${deletingStock.id}`, { headers });
      ToasterService.success("Stock level deleted");
      setStockLevels((current) => current.filter((item) => item.id !== deletingStock.id));
    } catch (error) {
      ToasterService.error("Failed to delete stock level", getErrorMessage(error, "Please try again."));
    } finally {
      setDeletingStock(null);
    }
  };

  const filteredStockLevels = useMemo(() => {
    const term = searchableText(search);

    return stockLevels.filter((stock) => {
      const productId = getProductId(stock);
      const warehouseId = getWarehouseId(stock);

      if (filterProductId && String(productId ?? "") !== filterProductId) return false;
      if (filterWarehouseId && String(warehouseId ?? "") !== filterWarehouseId) return false;

      const status = getStockStatus(stock.available, stock.quantity);
      if (filterStatus && status.label !== filterStatus) return false;

      if (!term) return true;

      const haystack = [
        getProductName(stock, products),
        getProductSku(stock, products),
        getWarehouseName(stock, warehouses),
        getWarehouseCode(stock, warehouses),
        stock.quantity,
        stock.reserved,
        stock.available,
        status.label,
        stock.id,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [stockLevels, search, filterProductId, filterWarehouseId, filterStatus, products, warehouses]);

  const resetFilters = () => {
    setFilterProductId("");
    setFilterWarehouseId("");
    setFilterStatus("");
  };

  const stats = useMemo(
    () => ({
      totalStock: stockLevels.reduce((sum, s) => sum + s.quantity, 0),
      totalAvailable: stockLevels.reduce((sum, s) => sum + s.available, 0),
      totalReserved: stockLevels.reduce((sum, s) => sum + s.reserved, 0),
      lowStockCount: stockLevels.filter(s => {
        if (s.quantity === 0) return true;
        const percentage = (s.available / s.quantity) * 100;
        return percentage <= 20;
      }).length,
    }),
    [stockLevels]
  );

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: String(product.id),
      name: product.productName,
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((warehouse) => ({
      id: String(warehouse.id),
      name: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
    }));
  }, [warehouses]);

  const statusOptions = useMemo(() => {
    return [
      { id: "Low Stock", name: "Low Stock" },
      { id: "Medium Stock", name: "Medium Stock" },
      { id: "Healthy Stock", name: "Healthy Stock" },
    ];
  }, []);

  // Options shown in the "Operation Type" dropdown of the form.
  const operationTypeOptions = useMemo(() => {
    return (Object.keys(STOCK_OPERATIONS) as StockOperation[]).map((key) => ({
      id: key,
      name: STOCK_OPERATIONS[key].label,
    }));
  }, []);

  const columns: ColumnDef<StockLevel>[] = [
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (stock) => getProductName(stock, products),
      render: (stock) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
            <CubeIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {getProductName(stock, products)}
            </div>
            {getProductSku(stock, products) && (
              <div className="text-xs text-slate-500">SKU: {getProductSku(stock, products)}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      sortValueGetter: (stock) => getWarehouseName(stock, warehouses),
      render: (stock) => (
        <div className="flex items-center gap-2">
          <BuildingOfficeIcon className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-700">
            {getWarehouseName(stock, warehouses)}
          </span>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Total Qty",
      sortable: true,
      render: (stock) => (
        <span className="text-sm font-medium text-slate-900">{stock.quantity}</span>
      ),
    },
    {
      key: "reserved",
      label: "Reserved",
      sortable: true,
      render: (stock) => (
        <span className="text-sm text-yellow-600">{stock.reserved}</span>
      ),
    },
    {
      key: "available",
      label: "Available",
      sortable: true,
      render: (stock) => (
        <span className="text-sm font-bold text-green-600">{stock.available}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValueGetter: (stock) => getStockStatus(stock.available, stock.quantity).label,
      render: (stock) => {
        const status = getStockStatus(stock.available, stock.quantity);
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${status.color}`}>
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
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => openEdit(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Adjust Stock"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingStock(stock)}
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
      <PageMeta title="Stock Levels" description="Monitor and manage inventory stock levels" />
      <PageBreadcrumb pageTitle="Stock Levels" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Stock Movement" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Stock"
            value={stats.totalStock.toLocaleString()}
            icon={<CubeIcon />}
          />
          <StatsCard
            label="Available Stock"
            value={stats.totalAvailable.toLocaleString()}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckBadgeIcon />}
          />
          <StatsCard
            label="Reserved Stock"
            value={stats.totalReserved.toLocaleString()}
            gradient="from-yellow-50 to-amber-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-700"
            icon={<ChartBarIcon />}
          />
          <StatsCard
            label="Low Stock Items"
            value={stats.lowStockCount}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ExclamationTriangleIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product, SKU, or warehouse..."
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
            <ListingPdfExportButton
              title="Stock Levels"
              subtitle="Filtered stock level listing"
              reportLabel="Stock Levels Report"
              data={filteredStockLevels}
              fileName="Stock_Levels"
              disabled={loading}
              metadata={(rows) => [
                { label: "Total", value: rows.length },
                { label: "Search", value: search || "None" },
                { label: "Total Stock", value: rows.reduce((sum, s) => sum + s.quantity, 0) },
              ]}
              columns={[
                { header: "Product", accessor: (row) => getProductName(row, products) },
                { header: "Warehouse", accessor: (row) => getWarehouseName(row, warehouses) },
                { header: "Total Qty", accessor: (row) => row.quantity },
                { header: "Reserved", accessor: (row) => row.reserved },
                { header: "Available", accessor: (row) => row.available },
                { header: "Status", accessor: (row) => getStockStatus(row.available, row.quantity).label },
              ]}
            />
            <FilterPopover
              title="Filter Stock Levels"
              buttonLabel="Filters"
              widthClassName="w-[21rem] sm:w-[23rem]"
              showFooter={false}
            >
              <div className="space-y-3">
                <FloatingSelect
                  label="Product"
                  name="filterProductId"
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  options={productOptions}
                />
                <FloatingSelect
                  label="Warehouse"
                  name="filterWarehouseId"
                  value={filterWarehouseId}
                  onChange={(e) => setFilterWarehouseId(e.target.value)}
                  options={warehouseOptions}
                />
                <FloatingSelect
                  label="Stock Status"
                  name="filterStatus"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  options={statusOptions}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredStockLevels}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="available"
          defaultSortOrder="desc"
          onRowClick={openView}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No stock levels found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Record your first stock movement
              </button>
            </div>
          }
        />
      </div>

      {/* Stock Operation Modal (Add Stock / Reserve / Release / Remove Stock / Complete Sale) */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingStock ? "Adjust Stock" : "Add Stock Movement"}
        subtitle={
          editingStock
            ? "Choose an operation and quantity to apply to this stock level"
            : "Select a product, warehouse, and quantity to add to stock"
        }
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={
          submitting
            ? "Processing..."
            : editingStock
            ? STOCK_OPERATIONS[form.operationType].label
            : "Create"
        }
        tabs={[
          {
            label: "Details",
            fields: [
              <FloatingSelect
                key="productId"
                label="Product"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                options={productOptions}
                required
                disabled={!!editingStock}
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                options={warehouseOptions}
                required
                disabled={!!editingStock}
              />,
            ],
          },
          {
            label: "Operation",
            fields: editingStock
              ? [
                  // Edit mode: full 5-way operation picker
                  <FloatingSelect
                    key="operationType"
                    label="Operation Type"
                    name="operationType"
                    value={form.operationType}
                    onChange={handleChange}
                    options={operationTypeOptions}
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
                  <p key="operation-hint" className="text-xs text-gray-500">
                    {form.operationType === "add-stock" &&
                      "Adds quantity to the total stock for this product/warehouse."}
                    {form.operationType === "reserve" &&
                      "Moves quantity from available into reserved (e.g. for a pending order)."}
                    {form.operationType === "release" &&
                      "Moves quantity from reserved back into available (e.g. order cancelled)."}
                    {form.operationType === "remove-stock" &&
                      "Removes quantity from the total stock (e.g. damage, write-off)."}
                    {form.operationType === "complete-sale" &&
                      "Finalizes a sale — deducts quantity from both reserved and total stock."}
                  </p>,
                ]
              : [
                  // Create mode: no Operation Type dropdown — always add-stock
                  <FloatingInput
                    key="quantity"
                    label="Quantity"
                    name="quantity"
                    type="number"
                    value={form.quantity}
                    onChange={handleChange}
                    required
                  />,
                  <p key="operation-hint" className="text-xs text-gray-500">
                    This creates a new stock level record for this product/warehouse with the given quantity as initial stock.
                  </p>,
                ],
          },
        ]}
      />

      {/* View Details Modal */}
      <DynamicPopup
        isPopupOpen={showViewModal && !!viewingStock}
        setIsPopupOpen={(open: boolean) => {
          if (!open) {
            setShowViewModal(false);
            setViewingStock(null);
          }
        }}
        icon={<CubeIcon className="h-6 w-6 text-cyan-600" />}
        iconBg="bg-cyan-100"
        innerText="Stock Level Details"
        subText={viewingStock ? getStockDetailsText(viewingStock, products, warehouses) : "No stock details available"}
        confirmLabel="Adjust Stock"
        cancelLabel="Close"
        onConfirm={() => {
          if (viewingStock) {
            setShowViewModal(false);
            openEdit(viewingStock);
          }
        }}
        onCancel={() => {
          setShowViewModal(false);
          setViewingStock(null);
        }}
        confirmBtnClass="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white"
      />

      {/* Delete Confirmation Modal */}
      <DynamicPopup
        isPopupOpen={!!deletingStock}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingStock(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Stock Level"
        subText={
          deletingStock
            ? `Are you sure you want to delete the stock level for "${getProductName(deletingStock, products)}" at "${getWarehouseName(deletingStock, warehouses)}"? This action cannot be undone.`
            : "Are you sure you want to delete this stock level?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingStock(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default StockLevelsManager;
