import React, { FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { formatNumber } from "../../company/format";

/**
 * Inventory Stock: the real stock per product and warehouse (the same records sales reservations, purchase
 * receipts, stock movements and adjustments change). Stock is not typed in here: it is received on the Stock
 * Movement screen and corrected with Stock Adjustments. What is set here is each record's reorder level, which
 * drives the low-stock alerts.
 */

type Warehouse = {
  id: number;
  code?: string;
  name?: string;
  locationType?: string;
  active?: boolean;
};

type ProductOption = {
  id: number;
  productCode?: string;
  productName?: string;
};

type StockRecord = {
  id: number;
  productId: number;
  quantity: number;
  reserved: number;
  available: number;
  reorderLevel?: number | null;
  warehouse?: Warehouse | null;
};

type AvailabilityCheck = {
  requiredQty: number;
  isAvailable: boolean;
  availableQty: number;
  totalQty: number;
  reservedQty: number;
};

const STOCK_LEVELS_API_URL = "/v1/api/inventory/stock-levels";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/common/products";
const PAGE_SIZE = 10;

// A plain modal for views that have nothing to save (the form popup would add
// Save / Previous buttons and "1 of 1").
const InfoModal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidthClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, subtitle, maxWidthClassName = "max-w-2xl", onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidthClassName} rounded-2xl bg-white shadow-xl dark:bg-slate-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

// Product name only; the code is shown separately where there is room.
function productLabel(product?: ProductOption): string {
  return product?.productName || product?.productCode || "Unknown product";
}

// Dropdowns need the code to tell similar names apart.
function productOptionLabel(product: ProductOption): string {
  const name = productLabel(product);
  return product.productCode && product.productName ? `${name} (${product.productCode})` : name;
}

function warehouseLabel(warehouse?: Warehouse | null): string {
  if (!warehouse) return "--";
  return warehouse.name || warehouse.code || "--";
}

const num = (value: unknown) => Number(value || 0);

function getStockStatus(stock: StockRecord) {
  const available = num(stock.available);
  if (available <= 0) {
    return {
      key: "out",
      label: "Out of Stock",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" />,
    };
  }
  if (stock.reorderLevel != null && available <= stock.reorderLevel) {
    return {
      key: "low",
      label: "Low Stock",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" />,
    };
  }
  return {
    key: "ok",
    label: "Healthy",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
  };
}

const InventoryStockManager: React.FC = () => {
  const { canUpdate } = usePermissions();
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const warehouseFilter = searchParams.get("warehouseId") || "";

  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [lowOnly, setLowOnly] = useState(false);

  const [reorderStock, setReorderStock] = useState<StockRecord | null>(null);
  const [reorderValue, setReorderValue] = useState("");
  const [savingReorder, setSavingReorder] = useState(false);

  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityCheck, setAvailabilityCheck] = useState<AvailabilityCheck | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState({ productId: "", warehouseId: "", requiredQty: "" });

  const [showProductStockModal, setShowProductStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<number | null>(null);

  useEffect(() => {
    fetchStock();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const response = await axios.get<StockRecord[]>(STOCK_LEVELS_API_URL, { headers });
      setStocks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setStocks([]);
      ToasterService.error("Failed to load stock", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    const [productsRes, warehousesRes] = await Promise.allSettled([
      axios.get<ProductOption[]>(PRODUCT_API_URL, { headers }),
      axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
    ]);
    if (productsRes.status === "fulfilled") {
      setProducts(Array.isArray(productsRes.value.data) ? productsRes.value.data : []);
    } else {
      ToasterService.error("Failed to load products", getErrorMessage(productsRes.reason, "Product names may be missing."));
    }
    if (warehousesRes.status === "fulfilled") {
      setWarehouses(Array.isArray(warehousesRes.value.data) ? warehousesRes.value.data : []);
    }
  };

  const productById = useMemo(() => new Map(products.map((p) => [Number(p.id), p])), [products]);
  const productName = (productId: number) => productLabel(productById.get(Number(productId)));

  const visibleStocks = useMemo(
    () =>
      stocks.filter(
        (s) =>
          (!warehouseFilter || String(s.warehouse?.id) === warehouseFilter) &&
          (!lowOnly || getStockStatus(s).key !== "ok")
      ),
    [stocks, warehouseFilter, lowOnly]
  );

  const stats = useMemo(
    () => ({
      records: stocks.length,
      onHand: stocks.reduce((sum, s) => sum + num(s.quantity), 0),
      reserved: stocks.reduce((sum, s) => sum + num(s.reserved), 0),
      lowOrOut: stocks.filter((s) => getStockStatus(s).key !== "ok").length,
    }),
    [stocks]
  );

  const openReorder = (stock: StockRecord) => {
    setReorderStock(stock);
    setReorderValue(stock.reorderLevel != null ? String(stock.reorderLevel) : "");
  };

  const saveReorder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reorderStock) return;
    const value = reorderValue.trim();
    if (value !== "" && (!Number.isInteger(Number(value)) || Number(value) < 0)) {
      ToasterService.error("Invalid reorder level", "Enter a whole number of zero or more, or leave it empty.");
      return;
    }
    try {
      setSavingReorder(true);
      const response = await axios.put<StockRecord>(
        `${STOCK_LEVELS_API_URL}/${reorderStock.id}/reorder-level`,
        null,
        { headers, params: value === "" ? {} : { level: Number(value) } }
      );
      setStocks((current) => current.map((s) => (s.id === reorderStock.id ? { ...s, ...response.data } : s)));
      ToasterService.success(value === "" ? "Reorder level removed" : "Reorder level saved");
      setReorderStock(null);
    } catch (error) {
      ToasterService.error("Failed to save the reorder level", getErrorMessage(error, "Please try again."));
    } finally {
      setSavingReorder(false);
    }
  };

  const handleAvailabilityCheck = async () => {
    const { productId, warehouseId, requiredQty } = availabilityForm;
    const required = num(requiredQty);
    try {
      const response = await axios.get<StockRecord>(
        `${STOCK_LEVELS_API_URL}/warehouse/${warehouseId}/product/${productId}`,
        { headers }
      );
      const stock = response.data;
      setAvailabilityCheck({
        requiredQty: required,
        isAvailable: num(stock.available) >= required,
        availableQty: num(stock.available),
        totalQty: num(stock.quantity),
        reservedQty: num(stock.reserved),
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No stock record yet: nothing on hand in that warehouse
        setAvailabilityCheck({ requiredQty: required, isAvailable: false, availableQty: 0, totalQty: 0, reservedQty: 0 });
        return;
      }
      ToasterService.error("Failed to check availability", getErrorMessage(error, "Please try again."));
    }
  };

  const productStockData = useMemo(
    () => stocks.filter((s) => Number(s.productId) === selectedProductForStock),
    [stocks, selectedProductForStock]
  );

  const productOptions = products.map((p) => ({ id: String(p.id), name: productOptionLabel(p) }));
  const warehouseOptions = warehouses.map((w) => ({ id: String(w.id), name: warehouseLabel(w) }));

  const columns: ColumnDef<StockRecord>[] = [
    {
      key: "productId",
      label: "Product",
      sortable: true,
      render: (stock) => (
        <button
          type="button"
          className="flex max-w-[220px] items-center gap-2 text-left text-sm text-slate-700 transition-colors hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProductForStock(Number(stock.productId));
            setShowProductStockModal(true);
          }}
          title="View this product in all warehouses"
        >
          <CubeIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate">{productName(stock.productId)}</p>
            {productById.get(Number(stock.productId))?.productCode && (
              <p className="truncate text-xs text-slate-400">
                {productById.get(Number(stock.productId))?.productCode}
              </p>
            )}
          </div>
        </button>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: false,
      render: (stock) => (
        <button
          type="button"
          className="flex max-w-[220px] items-center gap-2 text-left text-sm text-slate-700 transition-colors hover:text-cyan-600 dark:text-slate-300 dark:hover:text-cyan-400"
          onClick={(e) => {
            e.stopPropagation();
            if (stock.warehouse?.id) {
              navigate(
                `/warehouse?warehouseId=${stock.warehouse.id}&warehouseName=${encodeURIComponent(
                  warehouseLabel(stock.warehouse)
                )}`
              );
            }
          }}
        >
          <BuildingOffice2Icon className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate">{warehouseLabel(stock.warehouse)}</p>
            {stock.warehouse?.code && stock.warehouse?.name && (
              <p className="truncate text-xs text-slate-400">{stock.warehouse.code}</p>
            )}
          </div>
        </button>
      ),
    },
    {
      key: "quantity",
      label: "On Hand",
      sortable: true,
      render: (stock) => (
        <button
          type="button"
          className="text-sm font-semibold text-slate-800 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-200 dark:hover:text-cyan-400"
          title="View stock movements for this product and warehouse"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/stock-movement?productId=${stock.productId}&warehouseId=${stock.warehouse?.id ?? ""}`);
          }}
        >
          {num(stock.quantity)}
        </button>
      ),
    },
    {
      key: "reserved",
      label: "Reserved",
      sortable: true,
      render: (stock) => <span className="text-sm text-orange-600">{num(stock.reserved)}</span>,
    },
    {
      key: "available",
      label: "Available",
      sortable: true,
      render: (stock) => <span className="text-sm font-semibold text-emerald-700">{num(stock.available)}</span>,
    },
    {
      key: "reorderLevel",
      label: "Reorder Level",
      sortable: true,
      render: (stock) => <span className="text-sm text-slate-600">{stock.reorderLevel ?? "--"}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (stock) => {
        const status = getStockStatus(stock);
        return (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
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
          {canUpdate && (
            <button
              type="button"
              onClick={() => openReorder(stock)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
              title="Set reorder level"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Inventory Stock" description="Stock on hand per product and warehouse" />
      <PageBreadcrumb
        pageTitle="Inventory Stock"
        actions={<AddButton onClick={() => navigate("/stock-movement?action=receive")} label="Receive Stock" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Stock Records"
            value={stats.records}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<ArrowsRightLeftIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="On Hand"
            value={formatNumber(stats.onHand)}
            gradient="from-emerald-50 to-green-50"
            borderColor="border-emerald-100"
            labelColor="text-emerald-600"
            icon={<CubeIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Reserved"
            value={formatNumber(stats.reserved)}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-700"
            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Low / Out of Stock"
            value={stats.lowOrOut}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Stock changes through receipts, stock movements, adjustments and sales.
            {warehouseFilter && (
              <>
                {" "}Showing {warehouseLabel(warehouses.find((w) => String(w.id) === warehouseFilter))} only —{" "}
                <button className="font-medium text-cyan-600 hover:text-cyan-700" onClick={() => navigate("/inventory")}>
                  show all warehouses
                </button>
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAvailabilityModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-cyan-600"
              title="Check stock availability for a product in a warehouse"
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Check Availability</span>
            </button>

            <button
              onClick={() => setShowProductStockModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-purple-600"
              title="View stock for a product across all warehouses"
            >
              <ChartBarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Product Summary</span>
            </button>

            <button
              onClick={() => setLowOnly((value) => !value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                lowOnly
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-red-50 hover:text-red-600"
              }`}
              title="Show stock that is low or out"
            >
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{lowOnly ? "Show All" : "Low Stock"}</span>
            </button>
          </div>
        </div>

        <ReusableTable
          data={visibleStocks}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="productId"
          defaultSortOrder="asc"
          enableRowDetails={true}
          rowDetailsTitle="Stock Details"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">
                {lowOnly ? "Nothing is low or out of stock" : "No stock yet"}
              </p>
              {!lowOnly && (
                <button
                  type="button"
                  onClick={() => navigate("/stock-movement?action=receive")}
                  className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
                >
                  Receive stock
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Reorder level */}
      <PaginatedPopup
        isOpen={!!reorderStock}
        title="Reorder Level"
        subtitle={
          reorderStock
            ? `${productName(reorderStock.productId)} in ${warehouseLabel(reorderStock.warehouse)}: shows as low stock when available falls to this level.`
            : ""
        }
        onClose={() => setReorderStock(null)}
        onSubmit={saveReorder}
        submitLabel="Save"
        submitting={savingReorder}
        maxWidthClassName="max-w-md"
        fields={[
          <FloatingInput
            key="reorderLevel"
            label="Reorder level (empty = no alert)"
            name="reorderLevel"
            type="number"
            min={0}
            value={reorderValue}
            onChange={(e) => setReorderValue(e.target.value)}
          />,
        ]}
      />

      {/* Stock Availability Check */}
      <InfoModal
        open={showAvailabilityModal}
        title="Check Stock Availability"
        subtitle="Is enough free stock of a product available in a warehouse?"
        maxWidthClassName="max-w-2xl"
        onClose={() => {
          setShowAvailabilityModal(false);
          setAvailabilityCheck(null);
          setAvailabilityForm({ productId: "", warehouseId: "", requiredQty: "" });
        }}
      >
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <FloatingSelect
                    label="Product"
                    name="productId"
                    value={availabilityForm.productId}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, productId: e.target.value })}
                    options={productOptions}
                  />
                  <FloatingSelect
                    label="Warehouse"
                    name="warehouseId"
                    value={availabilityForm.warehouseId}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, warehouseId: e.target.value })}
                    options={warehouseOptions}
                  />
                  <FloatingInput
                    label="Required Quantity"
                    name="requiredQty"
                    type="number"
                    min={1}
                    value={availabilityForm.requiredQty}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, requiredQty: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAvailabilityCheck}
                  className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    !availabilityForm.productId ||
                    !availabilityForm.warehouseId ||
                    !(Number(availabilityForm.requiredQty) > 0)
                  }
                >
                  Check Availability
                </button>

                {availabilityCheck && (
                  <div
                    className={`mt-4 rounded-lg border p-4 ${
                      availabilityCheck.isAvailable ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {availabilityCheck.isAvailable ? (
                        <CheckCircleIcon className="h-6 w-6 flex-shrink-0 text-green-600" />
                      ) : (
                        <XMarkIcon className="h-6 w-6 flex-shrink-0 text-red-600" />
                      )}
                      <div>
                        <p className={`font-semibold ${availabilityCheck.isAvailable ? "text-green-700" : "text-red-700"}`}>
                          {availabilityCheck.isAvailable ? "Stock is available" : "Not enough stock"}
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>Required: <strong>{availabilityCheck.requiredQty}</strong></p>
                          <p>Available: <strong>{availabilityCheck.availableQty}</strong></p>
                          <p>On hand: <strong>{availabilityCheck.totalQty}</strong></p>
                          <p>Reserved: <strong>{availabilityCheck.reservedQty}</strong></p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
      </InfoModal>

      {/* Product Stock Summary */}
      <InfoModal
        open={showProductStockModal}
        title="Product Stock Summary"
        subtitle="Stock of one product across all warehouses"
        maxWidthClassName="max-w-4xl"
        onClose={() => {
          setShowProductStockModal(false);
          setSelectedProductForStock(null);
        }}
      >
              <div className="space-y-4">
                <FloatingSelect
                  label="Select Product"
                  name="productId"
                  value={String(selectedProductForStock || "")}
                  onChange={(e) => setSelectedProductForStock(Number(e.target.value) || null)}
                  options={productOptions}
                />

                {selectedProductForStock && productStockData.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-cyan-50 p-4 text-center dark:bg-cyan-900/20">
                        <p className="text-xs text-gray-500">On Hand</p>
                        <p className="text-2xl font-bold text-cyan-600">
                          {productStockData.reduce((sum, s) => sum + num(s.quantity), 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-4 text-center dark:bg-orange-900/20">
                        <p className="text-xs text-gray-500">Reserved</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {productStockData.reduce((sum, s) => sum + num(s.reserved), 0)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                        <p className="text-xs text-gray-500">Available</p>
                        <p className="text-2xl font-bold text-green-600">
                          {productStockData.reduce((sum, s) => sum + num(s.available), 0)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Warehouse breakdown:</p>
                      {productStockData.map((stock) => (
                        <div
                          key={stock.id}
                          className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 dark:bg-gray-800/40"
                        >
                          <div className="flex items-center gap-2">
                            <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
                            <span className="text-sm font-medium">{warehouseLabel(stock.warehouse)}</span>
                            {stock.warehouse?.code && (
                              <span className="text-xs text-slate-400">({stock.warehouse.code})</span>
                            )}
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span>On hand: <strong>{num(stock.quantity)}</strong></span>
                            <span className="text-orange-600">Reserved: <strong>{num(stock.reserved)}</strong></span>
                            <span className="text-green-600">Available: <strong>{num(stock.available)}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedProductForStock && productStockData.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    <CubeIcon className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                    <p>This product is not in stock in any warehouse</p>
                  </div>
                )}
              </div>
      </InfoModal>
    </>
  );
};

export default InventoryStockManager;
