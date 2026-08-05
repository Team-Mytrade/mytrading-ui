import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
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

type AvailabilityCheck = {
  productId: number;
  warehouseId: number;
  requiredQty: number;
  isAvailable: boolean;
  availableQty: number;
  totalQty: number;
  reservedQty: number;
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

function getWarehouseId(warehouse: InventoryStock["warehouse"], warehouses: Warehouse[]): string {
  if (!warehouse) return "";
  if (typeof warehouse !== "string") return String(warehouse.id || "");
  return String(
    warehouses.find((w) => w.code === warehouse || w.name === warehouse)?.id || ""
  );
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

const getCleanStockData = (stock: InventoryStock): any => {
  let warehouseDisplay = '--';
  if (stock.warehouse) {
    if (typeof stock.warehouse === 'object') {
      const name = stock.warehouse.name || 'Warehouse';
      const code = stock.warehouse.code ? `(${stock.warehouse.code})` : '';
      warehouseDisplay = `${name} ${code}`.trim();
    } else {
      warehouseDisplay = stock.warehouse;
    }
  }

  return {
    id: stock.id,
    referenceNo: stock.referenceNo || `#${stock.id}`,
    type: stock.type || 'N/A',
    productId: stock.productId || 0,
    quantity: stock.quantity || 0,
    reservedQty: stock.reservedQty || 0,
    minStockLevel: stock.minStockLevel || 0,
    movementDate: stock.movementDate || '--',
    createdDate: stock.createdDate,
    updatedDate: stock.updatedDate,
    createdBy: stock.createdBy,
    tenantId: stock.tenantId,
    status: getStockStatus(stock).label,
    warehouse: warehouseDisplay,
  };
};

const InventoryStockManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
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
  
  // State for availability check
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityCheck, setAvailabilityCheck] = useState<AvailabilityCheck | null>(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    productId: "",
    warehouseId: "",
    requiredQty: "",
  });

  // State for product stock summary
  const [showProductStockModal, setShowProductStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<number | null>(null);
  const [productStockData, setProductStockData] = useState<InventoryStock[]>([]);

  useEffect(() => {
    fetchAllStock();
    fetchDropdowns();
  }, []);

  // Watch for warehouseId in URL and filter stocks
  useEffect(() => {
    const warehouseId = searchParams.get('warehouseId');
    if (warehouseId) {
      fetchStockByWarehouse(warehouseId);
    } else {
      fetchAllStock();
    }
  }, [searchParams]);

 // fetchAllStock to clear filters
const fetchAllStock = async (): Promise<void> => {
  try {
    setLoading(true);
    const response = await axios.get<InventoryStock[]>(API_URL, { headers });
    const data = Array.isArray(response.data) ? response.data : [];
    setStocks(data);
    setTypeFilter("");  // ✅ Reset type filter
    setStatusFilter(""); // ✅ Reset status filter
  } catch (error) {
    setStocks([]);
    ToasterService.error("Failed to load inventory stock", getErrorMessage(error, "Please try again."));
  } finally {
    setLoading(false);
  }
};

  // ✅ UPDATED: Use dedicated warehouse API
  const fetchStockByWarehouse = async (warehouseId: string): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/warehouse/${warehouseId}`,
        { headers }
      );
      const data = Array.isArray(response.data) ? response.data : [];
      setStocks(data);
      const warehouseName = warehouses.find(w => w.id.toString() === warehouseId)?.name || warehouseId;
      ToasterService.success(`Showing stock for warehouse: ${warehouseName}`);
    } catch (error) {
      setStocks([]);
      ToasterService.error("Failed to load warehouse stock", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Fetch product stock using dedicated API
  const fetchProductStock = async (productId: number): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/product/${productId}`,
        { headers }
      );
      const data = Array.isArray(response.data) ? response.data : [];
      setStocks(data);
      const productName = products.find(p => p.id === productId)?.productName || `Product #${productId}`;
      ToasterService.success(`Showing stock for product: ${productName}`);
    } catch (error) {
      setStocks([]);
      ToasterService.error("Failed to load product stock", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

 const fetchLowStock = async (): Promise<void> => {
  try {
    setLoading(true);
    
    // Try API first
    const response = await axios.get(
      `${API_URL}/low-stock`,
      { headers }
    );
    
   let data = Array.isArray(response.data) ? response.data : [];
    
    // ✅ If API returns empty, use client-side filter
    if (data.length === 0) {
      // Fetch all stock first
      const allStockResponse = await axios.get(API_URL, { headers });
      const allData = Array.isArray(allStockResponse.data) ? allStockResponse.data : [];
      
      // Filter low stock items client-side
      data = allData.filter((s: InventoryStock) => {
        const available = Math.max(0, s.quantity - s.reservedQty);
        return available > 0 && available <= s.minStockLevel;
      });
      
      ToasterService.info(`Found ${data.length} low stock items (client-side filter)`);
    } else {
      ToasterService.success(`Showing ${data.length} low stock items`);
    }
    
    setStocks(data);
    setTypeFilter("");
    setStatusFilter("low");
  } catch (error) {
    setStocks([]);
    ToasterService.error("Failed to load low stock items", getErrorMessage(error, "Please try again."));
  } finally {
    setLoading(false);
  }
};

  // ✅ NEW: Fetch product stock summary for modal
  const fetchProductStockSummary = async (productId: number): Promise<InventoryStock[]> => {
    try {
      const response = await axios.get(
        `${API_URL}/product/${productId}`,
        { headers }
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      ToasterService.error("Failed to load product stock summary", getErrorMessage(error, "Please try again."));
      return [];
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
      warehouseId: getWarehouseId(stock.warehouse, warehouses),
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const payload = {
      type: form.type,
      quantity: toNumber(form.quantity),
      movementDate: form.movementDate,
      referenceNo: form.referenceNo,
      productId: toNumber(form.productId),
      reservedQty: toNumber(form.reservedQty),
      minStockLevel: toNumber(form.minStockLevel),
      warehouse: form.warehouseId ? { id: toNumber(form.warehouseId) } : null,
    };

    if (editingId) {
      return { id: editingId, ...payload };
    }

    return payload;
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
      const warehouseId = searchParams.get('warehouseId');
      if (warehouseId) {
        fetchStockByWarehouse(warehouseId);
      } else {
        await fetchAllStock();
      }
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
      const warehouseId = searchParams.get('warehouseId');
      if (warehouseId) {
        fetchStockByWarehouse(warehouseId);
      } else {
        await fetchAllStock();
      }
    } catch (error) {
      try {
        await axios.delete(`${API_URL}/${deleteStock.id}`, { headers });
        ToasterService.success("Inventory stock deleted successfully");
        setDeleteStock(null);
        const warehouseId = searchParams.get('warehouseId');
        if (warehouseId) {
          fetchStockByWarehouse(warehouseId);
        } else {
          await fetchAllStock();
        }
      } catch (fallbackError) {
        ToasterService.error("Failed to delete inventory stock", getErrorMessage(fallbackError, "Please try again."));
      }
    }
  };

  // ✅ UPDATED: Use validate API
  const handleAvailabilityCheck = async () => {
    const productId = toNumber(availabilityForm.productId);
    const warehouseId = toNumber(availabilityForm.warehouseId);
    const requiredQty = toNumber(availabilityForm.requiredQty);

    if (!productId || !warehouseId || !requiredQty) {
      ToasterService.error("Please fill all fields");
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/validate`,
        {
          params: { productId, warehouseId, qty: requiredQty },
          headers
        }
      );

      const data = response.data;
      setAvailabilityCheck({
        productId,
        warehouseId,
        requiredQty,
        isAvailable: data.available || false,
        availableQty: data.availableQty || 0,
        totalQty: data.totalQty || 0,
        reservedQty: data.reservedQty || 0,
      });
    } catch (error) {
      ToasterService.error("Failed to check availability", getErrorMessage(error, "Please try again."));
    }
  };

  // ✅ UPDATED: Handle product summary modal
  const handleProductSummary = async (productId: number) => {
    const data = await fetchProductStockSummary(productId);
    setProductStockData(data);
    setSelectedProductForStock(productId);
    setShowProductStockModal(true);
  };

  // Calculate totals for product stock summary
  const totalForProduct = productStockData.reduce((sum, s) => sum + s.quantity, 0);
  const totalReservedForProduct = productStockData.reduce((sum, s) => sum + s.reservedQty, 0);
  const totalAvailableForProduct = productStockData.reduce(
    (sum, s) => sum + (s.quantity - s.reservedQty), 0
  );

 const filteredStocks = useMemo(() => {
  const term = searchableText(search);

  // ✅ If statusFilter is "low", we already have filtered data
  // But we still need to apply search and type filters
  return stocks.filter((stock) => {
    const matchesType = typeFilter === "" || stock.type === typeFilter;

    // ✅ Only apply status filter if we're not showing low stock
    // (Low stock is already filtered in fetchLowStock)
    let matchesStatus = true;
    if (statusFilter === "low") {
      // If we're showing low stock, just check if it's actually low
      const available = Math.max(0, stock.quantity - stock.reservedQty);
      matchesStatus = available > 0 && available <= stock.minStockLevel;
    } else if (statusFilter === "out") {
      const available = Math.max(0, stock.quantity - stock.reservedQty);
      matchesStatus = available <= 0;
    } else if (statusFilter === "healthy") {
      const available = Math.max(0, stock.quantity - stock.reservedQty);
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
  })
  .map((stock) => getCleanStockData(stock));
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
        <span className="inline-flex rounded-full border ml-5 border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
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
          <button 
            className="flex items-center gap-2 text-sm text-slate-700 hover:text-cyan-600 transition-colors"
            onClick={() => {
              const productId = stock.productId;
              if (productId) {
                // ✅ Navigate to product stock view
                 handleProductSummary(productId);
              }
            }}
          >
            <CubeIcon className="h-4 w-4 text-slate-400" />
            <span>{product ? normalizeProductLabel(product) : `Product #${stock.productId}`}</span>
          </button>
        );
      },
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: false,
      render: (stock) => {
        const warehouseId = typeof stock.warehouse === 'string' 
          ? stock.warehouse 
          : stock.warehouse?.id?.toString();
        
        return (
          <button 
            className="flex items-center gap-2 ml-8 text-sm text-slate-700 hover:text-cyan-600 transition-colors"
            onClick={() => {
              if (warehouseId) {
                navigate(`/warehouse?warehouseId=${warehouseId}`);
              }
            }}
          >
            <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
            <div className="text-left">
              <p>{getWarehouseName(stock.warehouse)}</p>
              {getWarehouseCode(stock.warehouse) && (
                <p className="text-xs text-slate-400">{getWarehouseCode(stock.warehouse)}</p>
              )}
            </div>
          </button>
        );
      },
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      render: (stock) => (
        <button 
          className="text-sm font-semibold text-slate-800 ml-7 hover:text-cyan-600 hover:underline transition-colors"
          onClick={() => {
            const warehouseId = typeof stock.warehouse === 'string' 
              ? stock.warehouse 
              : stock.warehouse?.id?.toString();
            
            navigate(`/stock-movement?productId=${stock.productId}&warehouseId=${warehouseId || ''}`);
          }}
        >
          {stock.quantity}
        </button>
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

        {/* Stats Cards */}
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

        {/* Search and Filters + Buttons */}
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
            {/* Check Availability Button */}
            <button
              onClick={() => setShowAvailabilityModal(true)}
            
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-cyan-600"
              title="Check stock availability for a product in a warehouse"
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Check Availability</span>
            </button>

            {/* Product Summary Button */}
            <button
              onClick={() => {
                // Show product summary modal with first product selected
                setShowProductStockModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 hover:text-purple-600"
              title="View stock summary for a product across all warehouses"
            >
              <ChartBarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Product Summary</span>
            </button>

            {/* Low Stock Filter Button */}
<button
  onClick={() => {
    if (statusFilter === "low") {
      // If showing low stock, reset to all stock
      fetchAllStock();
      setStatusFilter("");
      setTypeFilter("");
      ToasterService.info("Showing all stock");
    } else {
      // Show low stock
      fetchLowStock();
      setStatusFilter("low");
    }
  }}
  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
    statusFilter === "low" 
      ? 'bg-red-50 text-red-700 border-red-200' 
      : 'bg-white text-gray-700 border-gray-200 hover:bg-red-50 hover:text-red-600'
  }`}
  title="Show low stock items"
>
  <ExclamationTriangleIcon className="h-4 w-4" />
  <span className="hidden sm:inline">{statusFilter === "low" ? 'Show All' : 'Low Stock'}</span>
</button>

            {/* PDF Export Button */}
            <ListingPdfExportButton<InventoryStock>
              title="Inventory Stock Report"
              subtitle="Filtered inventory stock listing"
              reportLabel="Stock Report"
              data={stocks}
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

            {/* Filter Button */}
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

        {/* Table */}
        <ReusableTable
          data={filteredStocks}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="movementDate"
          defaultSortOrder="desc"
          enableRowDetails={true}
          rowDetailsTitle="Stock Details"
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

      {/* Stock Availability Check Modal */}
      <PaginatedPopup
        isOpen={showAvailabilityModal}
        title="Check Stock Availability"
        subtitle="Verify if stock is available for a product in a warehouse"
        onClose={() => {
          setShowAvailabilityModal(false);
          setAvailabilityCheck(null);
          setAvailabilityForm({ productId: "", warehouseId: "", requiredQty: "" });
        }}
        submitting={false}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Availability Check",
            fields: [
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FloatingSelect
                    label="Product"
                    name="productId"
                    value={availabilityForm.productId}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, productId: e.target.value })}
                    emptyOptionLabel="Select product"
                    options={products.map((p) => ({
                      id: String(p.id || p.productId || 0),
                      name: normalizeProductLabel(p),
                    }))}
                  />
                  <FloatingSelect
                    label="Warehouse"
                    name="warehouseId"
                    value={availabilityForm.warehouseId}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, warehouseId: e.target.value })}
                    emptyOptionLabel="Select warehouse"
                    options={warehouses.map((w) => ({
                      id: String(w.id),
                      name: w.name || w.code || `Warehouse #${w.id}`,
                    }))}
                  />
                  <FloatingInput
                    label="Required Quantity"
                    name="requiredQty"
                    type="number"
                    value={availabilityForm.requiredQty}
                    onChange={(e) => setAvailabilityForm({ ...availabilityForm, requiredQty: e.target.value })}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAvailabilityCheck}
                  className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!availabilityForm.productId || !availabilityForm.warehouseId || !availabilityForm.requiredQty}
                >
                  Check Availability
                </button>

                {availabilityCheck && (
                  <div className={`mt-4 rounded-lg border p-4 ${
                    availabilityCheck.isAvailable 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-start gap-3">
                      {availabilityCheck.isAvailable ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                      ) : (
                        <XMarkIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                      )}
                      <div>
                        <p className={`font-semibold ${
                          availabilityCheck.isAvailable ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {availabilityCheck.isAvailable 
                            ? '✅ Stock is available!' 
                            : '❌ Stock is NOT available'}
                        </p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p>Required: <strong>{availabilityCheck.requiredQty}</strong> units</p>
                          <p>Available: <strong>{availabilityCheck.availableQty}</strong> units</p>
                          <p>Total Stock: <strong>{availabilityCheck.totalQty}</strong> units</p>
                          <p>Reserved: <strong>{availabilityCheck.reservedQty}</strong> units</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ],
          },
        ]}
      />

      {/* Product Stock Summary Modal */}
      <PaginatedPopup
        isOpen={showProductStockModal}
        title="Product Stock Summary"
        subtitle="View stock details for a specific product across all warehouses"
        onClose={() => {
          setShowProductStockModal(false);
          setSelectedProductForStock(null);
          setProductStockData([]);
        }}
        submitting={false}
        maxWidthClassName="max-w-4xl"
        tabs={[
          {
            label: "Stock Summary",
            fields: [
              <div className="space-y-4">
                <FloatingSelect
                  label="Select Product"
                  name="productId"
                  value={String(selectedProductForStock || '')}
                  onChange={async (e) => {
                    const productId = Number(e.target.value);
                    if (productId) {
                      await handleProductSummary(productId);
                    }
                  }}
                  emptyOptionLabel="Select product"
                  options={products.map((p) => ({
                    id: String(p.id || p.productId || 0),
                    name: normalizeProductLabel(p),
                  }))}
                />

                {selectedProductForStock && productStockData.length > 0 && (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-cyan-50 p-4 text-center dark:bg-cyan-900/20">
                        <p className="text-xs text-gray-500">Total Stock</p>
                        <p className="text-2xl font-bold text-cyan-600">{totalForProduct}</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-4 text-center dark:bg-orange-900/20">
                        <p className="text-xs text-gray-500">Reserved</p>
                        <p className="text-2xl font-bold text-orange-600">{totalReservedForProduct}</p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-900/20">
                        <p className="text-xs text-gray-500">Available</p>
                        <p className="text-2xl font-bold text-green-600">{totalAvailableForProduct}</p>
                      </div>
                    </div>

                    {/* Warehouse Breakdown */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Warehouse Breakdown:</p>
                      {productStockData.map((stock) => (
                        <div key={stock.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 dark:bg-gray-800/40">
                          <div className="flex items-center gap-2">
                            <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-sm">{getWarehouseName(stock.warehouse)}</span>
                            {getWarehouseCode(stock.warehouse) && (
                              <span className="text-xs text-slate-400">({getWarehouseCode(stock.warehouse)})</span>
                            )}
                          </div>
                          <div className="flex gap-4 text-sm">
                            <span>Total: <strong>{stock.quantity}</strong></span>
                            <span className="text-orange-600">Reserved: <strong>{stock.reservedQty}</strong></span>
                            <span className="text-green-600">Available: <strong>{stock.quantity - stock.reservedQty}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {selectedProductForStock && productStockData.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <CubeIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    <p>No stock found for this product</p>
                  </div>
                )}
              </div>
            ],
          },
        ]}
      />

      {/* Create/Edit Form */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Inventory Stock" : "Create Inventory Stock"}
        subtitle="Enter stock details from the inventory schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Stock" : "Create Stock"}
        maxWidthClassName="max-w-4xl"
        tabs={[
          {
            label: "Stock Details",
            fields: [
              <FloatingSelect
                label="Movement Type"
                name="type"
                value={form.type}
                onChange={handleChange}
                includeEmptyOption={false}
                options={movementTypeOptions.map((type) => ({
                  id: type,
                  name: type,
                }))}
              />,
              <FloatingDatePicker
                label="Movement Date"
                name="movementDate"
                value={form.movementDate}
                onChange={handleChange}
                required
              />,
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
              />,
              <FloatingSelect
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                emptyOptionLabel="Select warehouse"
                options={warehouses.map((w) => ({
                  id: String(w.id),
                  name: w.name || w.code || `Warehouse #${w.id}`,
                }))}
                required
              />,
              <FloatingInput
                label="Quantity"
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                label="Reserved Quantity"
                name="reservedQty"
                type="number"
                value={form.reservedQty}
                onChange={handleChange}
              />,
              <FloatingInput
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

      {/* Delete Confirmation */}
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