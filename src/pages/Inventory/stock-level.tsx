import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import DynamicPopup from "../../components/common/Popup";
import PaginatedPopup from "../../components/common/unpopup";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

/**
 * =====================================================================================
 * NOTES ON BACKEND SHAPE (confirmed from the real runtime response, which overrides
 * the Swagger schema):
 *
 * 1. `warehouse` is a FULL NESTED OBJECT on the StockLevel entity:
 *    { id, createdDate, updatedDate, createdBy, tenantId, code, name, locationType,
 *      active } — NOT a string.
 *
 * 2. There is NO nested `product` object in the StockLevel response — only
 *    `productId`. Product name/SKU are resolved via the separately-fetched products list.
 *
 * 3. `createdBy` / `tenantId` are populated server-side from the authenticated session.
 *
 * 4. Create stays a POST to /stock-levels. The 5 stock operations
 *    (add-stock / reserve / release / remove-stock / complete-sale) stay as
 *    PUT /stock-levels/warehouse/{warehouseId}/product/{productId}/{op}?quantity=X
 * =====================================================================================
 */

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
  locationType?: string;
  active?: boolean;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
}

interface StockLevel {
  id: number;
  quantity: number;
  reserved: number;
  available: number;
  productId?: number;
  warehouse?: Warehouse;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
}

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

const PRODUCT_ROUTE = "/purchase-products";
const WAREHOUSE_ROUTE = "/warehouse";

const emptyForm: StockLevelForm = {
  productId: "",
  warehouseId: "",
  operationType: "add-stock",
  quantity: "",
};

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

function getStockStatus(available: number, quantity: number) {
  if (quantity === 0) {
    return {
      color: "bg-gray-50 text-gray-600 border-gray-200",
      label: "No Stock",
      icon: <XCircleIcon className="mr-1 h-3 w-3" />,
    };
  }
  const percentage = (available / quantity) * 100;
  if (percentage <= 20) {
    return {
      color: "bg-red-50 text-red-700 border-red-200",
      label: "Low Stock",
      icon: <ExclamationTriangleIcon className="mr-1 h-3 w-3" />,
    };
  }
  if (percentage <= 50) {
    return {
      color: "bg-yellow-50 text-yellow-700 border-yellow-200",
      label: "Medium Stock",
      icon: <ChartBarIcon className="mr-1 h-3 w-3" />,
    };
  }
  return {
    color: "bg-green-50 text-green-700 border-green-200",
    label: "Healthy Stock",
    icon: <CheckBadgeIcon className="mr-1 h-3 w-3" />,
  };
}

function getProductId(stock: StockLevel): number | undefined {
  return stock.productId;
}

function getWarehouseId(stock: StockLevel): number | undefined {
  return stock.warehouse?.id;
}

function getProductName(stock: StockLevel, products: Product[]) {
  const id = getProductId(stock);
  const product = products.find((p) => p.id === id);
  return product ? product.productName : "N/A";
}

function getProductSku(stock: StockLevel, products: Product[]) {
  const id = getProductId(stock);
  const product = products.find((p) => p.id === id);
  return product?.sku || "";
}

function getWarehouseName(stock: StockLevel) {
  return stock.warehouse?.name || "N/A";
}

function getWarehouseCode(stock: StockLevel) {
  return stock.warehouse?.code || "";
}

// ---------- Component ----------
const StockLevelsManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;
  const navigate = useNavigate();

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<StockLevelForm>(emptyForm);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingStock, setDeletingStock] = useState<StockLevel | null>(null);
  const [viewingStock, setViewingStock] = useState<StockLevel | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
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
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.content || (res.data as any)?.data || [];
      setStockLevels(data);
      if (data.length === 0) ToasterService.noData("No stock levels found");
    } catch (error) {
      ToasterService.error(
        "Failed to load stock levels",
        getErrorMessage(error, "Please try again.")
      );
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get<Product[]>(PRODUCT_URL, { headers });
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.content || (res.data as any)?.data || [];
      setProducts(data);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get<Warehouse[]>(`${API_URL}/warehouses`, { headers });
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.content || (res.data as any)?.data || [];
      setWarehouses(data);
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  // ---------- Stock operation handlers ----------
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value } as StockLevelForm));
  };

  const goToProduct = (productId?: number) => {
    if (!productId) return;
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, { state: { productId } });
  };

  const goToWarehouse = (warehouseId?: number, warehouseName?: string) => {
    if (!warehouseId) return;
    navigate(`${WAREHOUSE_ROUTE}?warehouseId=${warehouseId}`, {
      state: { warehouseId, warehouseName },
    });
  };

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

    try {
      setSubmitting(true);

      if (!editingStock) {
        const payload = {
          id: 0,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
          quantity,
          reserved: 0,
          available: quantity,
          productId: Number(form.productId),
          warehouse: { id: Number(form.warehouseId) },
        };
        await axios.post(`${API_URL}/stock-levels`, payload, { headers });
        ToasterService.success("Stock level created successfully");
      } else {
        const operationType = form.operationType;
        const url = buildOperationUrl(
          form.warehouseId,
          form.productId,
          operationType,
          String(quantity)
        );
        await axios.put(url, null, { headers });
        ToasterService.success(STOCK_OPERATIONS[operationType].successMessage);
      }

      closeForm();
      fetchStockLevels();
    } catch (error) {
      ToasterService.error(
        editingStock
          ? `Failed to ${STOCK_OPERATIONS[form.operationType].label.toLowerCase()}`
          : "Failed to create stock level",
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
      ToasterService.error(
        "Failed to delete stock level",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setDeletingStock(null);
    }
  };

  // ---------- Stats ----------
  const stats = useMemo(
    () => ({
      totalStock: stockLevels.reduce((sum, s) => sum + s.quantity, 0),
      totalAvailable: stockLevels.reduce((sum, s) => sum + s.available, 0),
      totalReserved: stockLevels.reduce((sum, s) => sum + s.reserved, 0),
      lowStockCount: stockLevels.filter((s) => {
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

  const operationTypeOptions = useMemo(() => {
    return (Object.keys(STOCK_OPERATIONS) as StockOperation[]).map((key) => ({
      id: key,
      name: STOCK_OPERATIONS[key].label,
    }));
  }, []);

  // ---------- Table columns ----------
  const columns: ColumnDef<StockLevel>[] = [
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (stock) => getProductName(stock, products),
      render: (stock) => {
        const productId = getProductId(stock);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
              <CubeIcon className="h-4 w-4 text-cyan-700" />
            </div>
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToProduct(productId);
                }}
                className="text-left text-sm font-semibold text-cyan-600 hover:text-cyan-700"
                title="View product"
              >
                {getProductName(stock, products)}
              </button>
              {getProductSku(stock, products) && (
                <div className="text-xs text-slate-500">
                  SKU: {getProductSku(stock, products)}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      sortValueGetter: (stock) => getWarehouseName(stock),
      render: (stock) => {
        const warehouseId = getWarehouseId(stock);
        const warehouseName = getWarehouseName(stock);
        return (
          <div className="flex items-center gap-2">
            <BuildingOfficeIcon className="h-4 w-4 text-slate-400" />
            {warehouseId ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToWarehouse(warehouseId, warehouseName);
                }}
                className="text-left text-sm font-medium text-cyan-600 hover:text-cyan-700"
                title="View warehouse"
              >
                {warehouseName}
              </button>
            ) : (
              <span className="text-sm text-slate-700">{warehouseName}</span>
            )}
          </div>
        );
      },
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
      render: (stock) => <span className="text-sm text-yellow-600">{stock.reserved}</span>,
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
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.color}`}
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
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
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

  const viewingStatus = viewingStock
    ? getStockStatus(viewingStock.available, viewingStock.quantity)
    : null;
  const viewingUtilization =
    viewingStock && viewingStock.quantity > 0
      ? `${Math.round((viewingStock.reserved / viewingStock.quantity) * 100)}%`
      : "0%";

  return (
    <>
      <PageMeta
        title="Stock Levels"
        description="Monitor and manage inventory stock levels"
      />
      <PageBreadcrumb
        pageTitle="Stock Levels"
        actions={<AddButton onClick={openCreate} label="Add Stock" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        {/* Toolbar — Refresh only
        <div className="mb-4 flex items-center justify-end">
          <button
            onClick={fetchStockLevels}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-cyan-600"
            title="Refresh"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div> */}

        <ReusableTable
          data={stockLevels}
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
                Add your first stock
              </button>
            </div>
          }
        />
      </div>

      {/* Stock Operation Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingStock ? "Adjust Stock" : "Add Stock"}
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
        maxWidthClassName="max-w-2xl"
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
                    min={1}
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
                  <FloatingInput
                    key="quantity"
                    label="Quantity"
                    name="quantity"
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={handleChange}
                    required
                  />,
                  <p key="operation-hint" className="text-xs text-gray-500">
                    This creates a new stock level record for this product/warehouse
                    with the given quantity as initial stock.
                  </p>,
                ],
          },
        ]}
      />

      {/* View Details Modal — now using PaginatedPopup for consistency */}
      <PaginatedPopup
        isOpen={showViewModal && !!viewingStock}
        title="Stock Level Details"
        subtitle={viewingStock ? `Stock level #${viewingStock.id}` : ""}
        onClose={() => {
          setShowViewModal(false);
          setViewingStock(null);
        }}
        submitting={false}
        maxWidthClassName="max-w-lg"
        tabs={[
          {
            label: "Details",
            fields: [
              viewingStock &&
                viewingStatus && (
                  <div key="view-content" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Product</p>
                        <button
                          type="button"
                          onClick={() => goToProduct(getProductId(viewingStock))}
                          className="text-left text-sm font-medium text-cyan-600 hover:text-cyan-700"
                        >
                          {getProductName(viewingStock, products)}
                        </button>
                        {getProductSku(viewingStock, products) && (
                          <p className="mt-1 text-xs text-gray-500">
                            SKU: {getProductSku(viewingStock, products)}
                          </p>
                        )}
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Warehouse</p>
                        {getWarehouseId(viewingStock) ? (
                          <button
                            type="button"
                            onClick={() =>
                              goToWarehouse(
                                getWarehouseId(viewingStock),
                                getWarehouseName(viewingStock)
                              )
                            }
                            className="text-left text-sm font-medium text-cyan-600 hover:text-cyan-700"
                          >
                            {getWarehouseName(viewingStock)}
                          </button>
                        ) : (
                          <p className="text-sm text-gray-700">
                            {getWarehouseName(viewingStock)}
                          </p>
                        )}
                        {getWarehouseCode(viewingStock) && (
                          <p className="mt-1 text-xs text-gray-500">
                            {getWarehouseCode(viewingStock)}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Total Quantity</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {viewingStock.quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${viewingStatus.color}`}
                        >
                          {viewingStatus.icon}
                          {viewingStatus.label}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Reserved</p>
                        <p className="text-sm font-medium text-yellow-600">
                          {viewingStock.reserved}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Available</p>
                        <p className="text-sm font-bold text-green-600">
                          {viewingStock.available}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Utilization</p>
                        <p className="text-sm text-gray-700">{viewingUtilization}</p>
                      </div>
                      {viewingStock.updatedDate && (
                        <div>
                          <p className="text-xs text-gray-500">Last Updated</p>
                          <p className="text-sm text-gray-600">
                            {new Date(viewingStock.updatedDate).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>

                    {viewingStatus.label === "Low Stock" && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="flex items-start gap-2 text-sm text-red-800">
                          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <span>
                            <strong>Low Stock Alert:</strong> This item has low stock
                            levels. Consider replenishing soon.
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                ),
            ],
          },
        ]}
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
            ? `Are you sure you want to delete the stock level for "${getProductName(
                deletingStock,
                products
              )}" at "${getWarehouseName(deletingStock)}"? This action cannot be undone.`
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