import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  EyeIcon,
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

// ======================== ENUM TYPE ========================
interface EnumOption {
  id: string;
  name: string;
}

// ======================== DATA MODELS ========================
type Product = {
  id: number;
  productId?: number;
  name?: string;
  productName?: string;
  productCode?: string;
  code?: string;
};

type Warehouse = {
  id: number;
  name?: string;
  code?: string;
};

type Batch = {
  id: number;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  productId?: number;
  warehouse?: string;
};

type SerialNumber = {
  id: number;
  serial?: string;
  productId?: number;
  productNumber?: string;
  warehouse?: string;
  batch?: Batch | string;
};

type StockMovement = {
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
  batch?: Batch | string | null;
  serialNumber?: SerialNumber | string | null;
};

type MovementForm = {
  movementDate: string;
  movementType: string;
  quantity: string;
  fromLocation: string;
  toLocation: string;
  reference: string;
  productId: string;
  warehouseId: string;
  batchId: string;
  serialNumberId: string;
};

const API_URL = "/v1/api/inventory/stock-movements";
const ENUMS_API_URL = "/v1/api/inventory/enums";
const PRODUCTS_API_URL = "/v1/api/purchase/products";
const WAREHOUSES_API_URL = "/v1/api/inventory/warehouses";
const BATCHES_API_URL = "/v1/api/inventory/batches";
const SERIALS_API_URL = "/v1/api/inventory/serial-numbers";
const PAGE_SIZE = 10;
const MOVEMENT_TYPE_ENUM = "MOVEMENT_TYPE";

const PRODUCT_ROUTE = "/purchase-products";

const emptyForm: MovementForm = {
  movementDate: new Date().toISOString().split("T")[0],
  movementType: "",
  quantity: "",
  fromLocation: "",
  toLocation: "",
  reference: "",
  productId: "",
  warehouseId: "",
  batchId: "",
  serialNumberId: "",
};

// Deterministic color per movement type string, so badges stay visually distinct
// without needing to know the type set in advance (no hardcoded value list).
const BADGE_PALETTE = [
  "bg-green-50 text-green-700 border-green-200",
  "bg-red-50 text-red-700 border-red-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-indigo-50 text-indigo-700 border-indigo-200",
];

function getMovementTypeBadge(type?: string | null) {
  if (!type) return "bg-slate-50 text-slate-700 border-slate-200";
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  }
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

function toNumber(value: string | number | undefined | null) {
  return Number(value || 0);
}

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

// Product is now shown as productName only, everywhere (table, dropdowns, view modal).
// No code suffix, no fabricated "Product #id" label swapped in silently for display —
// falls back to N/A when there's genuinely no name.
function getProductName(product?: Product | null): string {
  if (!product) return "";
  return product.productName || product.name || "";
}

function getWarehouseValue(warehouse?: Warehouse | string | null) {
  if (!warehouse) return "";
  if (typeof warehouse === "string") return warehouse;
  return warehouse.code || warehouse.name || String(warehouse.id);
}

function getWarehouseId(warehouse: Warehouse | string | null | undefined, warehouses: Warehouse[]) {
  if (!warehouse) return "";
  if (typeof warehouse !== "string") return String(warehouse.id || "");
  return String(warehouses.find((item) => item.code === warehouse || item.name === warehouse)?.id || "");
}

function getBatchId(batch: Batch | string | null | undefined, batches: Batch[]) {
  if (!batch) return "";
  if (typeof batch !== "string") return String(batch.id || "");
  return String(batches.find((item) => item.batchNumber === batch)?.id || "");
}

function getSerialId(serialNumber: SerialNumber | string | null | undefined, serialNumbers: SerialNumber[]) {
  if (!serialNumber) return "";
  if (typeof serialNumber !== "string") return String(serialNumber.id || "");
  return String(serialNumbers.find((item) => item.serial === serialNumber)?.id || "");
}

// ======================== HELPER: ENUM NORMALIZATION ========================
// IDs are kept exactly as the API returns them — no .toUpperCase() transform.
// (Previously this forced ids to uppercase, which silently broke label lookup,
// filtering, and edit-prefill whenever the backend returned a movementType
// string that wasn't already all-caps.)
function normalizeEnumOptions(raw: any): EnumOption[] {
  const list = Array.isArray(raw) ? raw : raw?.content || raw?.data || raw?.result || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((item: any): EnumOption | null => {
      if (typeof item === "string") {
        return { id: item, name: item };
      }
      if (item && typeof item === "object") {
        const id = item.id ?? item.value ?? item.code ?? item.key ?? item.name;
        const name = item.name ?? item.label ?? item.description ?? item.value ?? id;
        if (id == null) return null;
        return { id: String(id), name: String(name ?? id) };
      }
      return null;
    })
    .filter((option): option is EnumOption => option !== null);
}

// Label lookup resolves purely against whatever the enum endpoint returned.
// If a movement's movementType isn't in that list (stale data, endpoint not
// loaded yet, id casing differs, etc.) it falls back to showing the raw value
// rather than a hardcoded/translated label.
function getMovementTypeLabel(type: string | undefined | null, options: EnumOption[]) {
  if (!type) return "-";
  const match = options.find((option) => option.id === type);
  return match?.name || type;
}

// ======================== MAIN COMPONENT ========================
const StockMovementsManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;
  const navigate = useNavigate();

  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [movementTypeOptions, setMovementTypeOptions] = useState<EnumOption[]>([]);
  const [form, setForm] = useState<MovementForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMovementType, setFilterMovementType] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [deletingMovement, setDeletingMovement] = useState<StockMovement | null>(null);
  const [viewingMovement, setViewingMovement] = useState<StockMovement | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // ---------- Data fetching ----------
  useEffect(() => {
    fetchStockMovements();
    fetchLookups();
    fetchMovementTypeOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStockMovements = async () => {
    try {
      setLoading(true);
      const res = await axios.get<StockMovement[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setStockMovements(data);
      if (data.length === 0) ToasterService.noData("No stock movements found");
    } catch (error) {
      ToasterService.error("Failed to load stock movements", getErrorMessage(error, "Please try again."));
      setStockMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [productsRes, warehousesRes, batchesRes, serialsRes] = await Promise.all([
        axios.get<Product[]>(PRODUCTS_API_URL, { headers }),
        axios.get<Warehouse[]>(WAREHOUSES_API_URL, { headers }),
        axios.get<Batch[]>(BATCHES_API_URL, { headers }),
        axios.get<SerialNumber[]>(SERIALS_API_URL, { headers }),
      ]);

      setProducts(Array.isArray(productsRes.data) ? productsRes.data : (productsRes.data as any)?.content || (productsRes.data as any)?.data || []);
      setWarehouses(Array.isArray(warehousesRes.data) ? warehousesRes.data : (warehousesRes.data as any)?.content || (warehousesRes.data as any)?.data || []);
      setBatches(Array.isArray(batchesRes.data) ? batchesRes.data : (batchesRes.data as any)?.content || (batchesRes.data as any)?.data || []);
      setSerialNumbers(Array.isArray(serialsRes.data) ? serialsRes.data : (serialsRes.data as any)?.content || (serialsRes.data as any)?.data || []);
    } catch (error) {
      ToasterService.error("Failed to load lookup data", getErrorMessage(error, "Please try again."));
    }
  };

  // Movement type options come exclusively from the backend enum endpoint.
  // No hardcoded value list, no legacy code translation, no case transform.
  const fetchMovementTypeOptions = async () => {
    try {
      const res = await axios.get(ENUMS_API_URL, {
        headers,
        params: { type: MOVEMENT_TYPE_ENUM },
      });
      const options = normalizeEnumOptions(res.data);
      if (options.length === 0) {
        ToasterService.error(
          "Movement Type options unavailable",
          "No values returned for MOVEMENT_TYPE enum."
        );
      }
      setMovementTypeOptions(options);
    } catch (error) {
      ToasterService.error(
        "Failed to load Movement Type options",
        getErrorMessage(error, "Please try again.")
      );
      setMovementTypeOptions([]);
    }
  };

  // ---------- Form handlers ----------
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "productId" && value !== current.productId) {
        next.batchId = "";
        next.serialNumberId = "";
      }
      return next;
    });
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      movementDate: form.movementDate,
      movementType: form.movementType,
      quantity: toNumber(form.quantity),
      fromLocation: form.fromLocation,
      toLocation: form.toLocation,
      reference: form.reference,
      productId: toNumber(form.productId),
    };

    if (editingId) {
      payload.id = editingId;
    }

    if (form.warehouseId) {
      payload.warehouse = { id: toNumber(form.warehouseId) };
    }
    if (form.batchId) {
      payload.batch = { id: toNumber(form.batchId) };
    }
    if (form.serialNumberId) {
      payload.serialNumber = { id: toNumber(form.serialNumberId) };
    }

    return payload;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const quantity = toNumber(form.quantity);
    if (quantity <= 0) {
      ToasterService.error("Invalid quantity", "Quantity must be greater than 0.");
      return;
    }
    if (!form.movementDate) {
      ToasterService.error("Required field missing", "Movement date is required.");
      return;
    }
    if (!form.movementType) {
      ToasterService.error("Required field missing", "Movement type is required.");
      return;
    }
    if (!form.fromLocation || !form.toLocation) {
      ToasterService.error("Required field missing", "From and to locations are required.");
      return;
    }
    if (!form.productId) {
      ToasterService.error("Required field missing", "Product selection is required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Stock movement updated");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Stock movement created");
      }

      closeForm();
      fetchStockMovements();
    } catch (error) {
      ToasterService.error("Failed to save stock movement", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      movementDate: new Date().toISOString().split('T')[0],
    });
    setShowFormModal(true);
  };

  const openEdit = (movement: StockMovement) => {
    setEditingId(movement.id);
    setForm({
      movementDate: movement.movementDate || emptyForm.movementDate,
      movementType: movement.movementType || "",
      quantity: String(movement.quantity || 0),
      fromLocation: movement.fromLocation || "",
      toLocation: movement.toLocation || "",
      reference: movement.reference || "",
      productId: String(movement.productId || movement.product?.id || ""),
      warehouseId: getWarehouseId(movement.warehouse, warehouses),
      batchId: getBatchId(movement.batch, batches),
      serialNumberId: getSerialId(movement.serialNumber, serialNumbers),
    });
    setShowFormModal(true);
  };

  const openView = (movement: StockMovement) => {
    setViewingMovement(movement);
    setShowViewModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deletingMovement) return;

    try {
      await axios.delete(`${API_URL}/${deletingMovement.id}`, { headers });
      ToasterService.success("Stock movement deleted");
      setStockMovements((current) => current.filter((item) => item.id !== deletingMovement.id));
    } catch (error) {
      ToasterService.error("Failed to delete stock movement", getErrorMessage(error, "Please try again."));
    } finally {
      setDeletingMovement(null);
    }
  };

  // ---------- Filtering ----------
  const filteredStockMovements = useMemo(() => {
    const term = searchableText(search);

    return stockMovements.filter((movement) => {
      if (filterMovementType && movement.movementType !== filterMovementType) return false;
      if (filterProductId && String(movement.productId || movement.product?.id || "") !== filterProductId) return false;

      if (!term) return true;

      const productName = getProductName(
        products.find((item) => item.id === movement.productId || item.productId === movement.productId) || movement.product
      );
      const warehouseName = getWarehouseValue(movement.warehouse);
      const batchLabel = typeof movement.batch === "string" ? movement.batch : movement.batch?.batchNumber || "";
      const serialLabel = typeof movement.serialNumber === "string" ? movement.serialNumber : movement.serialNumber?.serial || "";

      const haystack = [
        getMovementTypeLabel(movement.movementType, movementTypeOptions),
        movement.fromLocation,
        movement.toLocation,
        movement.reference,
        productName,
        warehouseName,
        batchLabel,
        serialLabel,
        movement.id,
        movement.quantity,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [stockMovements, search, filterMovementType, filterProductId, products, movementTypeOptions]);

  const resetFilters = () => {
    setFilterMovementType("");
    setFilterProductId("");
  };

  // Product is displayed as productName, falling back to N/A only when
  // there is genuinely no matching product/name — no fabricated "Product #id" text.
  const getProductDisplayName = (movement: StockMovement) => {
    const productId = movement.productId ?? movement.product?.id;
    const product = products.find((p) => p.id === productId || p.productId === productId);
    const name = getProductName(product) || getProductName(movement.product);
    return name || "N/A";
  };

  const goToProduct = (productId?: number) => {
    if (!productId) return;
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, { state: { productId } });
  };

  const stats = useMemo(() => {
    // "Transfers" no longer keys off a hardcoded id like "WAREHOUSE_TRANSFER".
    // It matches whichever enum option's returned name/id contains "transfer"
    // (case-insensitive). This is a heuristic, not a guarantee — if the
    // backend doesn't use the word "transfer" anywhere in that enum entry,
    // this stat will read 0. There's no way to know the "transfer" semantic
    // purely from an id/name pair without the backend flagging it explicitly.
    const transferOptionIds = new Set(
      movementTypeOptions
        .filter((option) => /transfer/i.test(option.name) || /transfer/i.test(option.id))
        .map((option) => option.id)
    );

    return {
      total: stockMovements.length,
      totalQuantity: stockMovements.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0),
      transfers: stockMovements.filter((sm) => transferOptionIds.has(sm.movementType)).length,
      uniqueProducts: new Set(stockMovements.map((sm) => sm.productId || sm.product?.id).filter(Boolean)).size,
    };
  }, [stockMovements, movementTypeOptions]);

  // ---------- Dropdown options ----------
  // Product dropdown shows productName only (no code appended).
  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: String(product.id || product.productId || 0),
      name: getProductName(product) || `Product #${product.id}`,
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((warehouse) => ({
      id: String(warehouse.id),
      name: warehouse.code ? `${warehouse.name || `Warehouse #${warehouse.id}`} (${warehouse.code})` : warehouse.name || `Warehouse #${warehouse.id}`,
    }));
  }, [warehouses]);

  const batchOptions = useMemo(() => {
    const selectedProductId = toNumber(form.productId);
    return batches
      .filter((batch) => !selectedProductId || batch.productId === selectedProductId)
      .map((batch) => ({
        id: String(batch.id),
        name: batch.batchNumber,
      }));
  }, [batches, form.productId]);

  const serialOptions = useMemo(() => {
    const selectedProductId = toNumber(form.productId);
    return serialNumbers
      .filter((serial) => !selectedProductId || serial.productId === selectedProductId)
      .map((serial) => ({
        id: String(serial.id),
        name: serial.serial || `Serial #${serial.id}`,
      }));
  }, [serialNumbers, form.productId]);

  // ---------- Table columns ----------
  const columns: ColumnDef<StockMovement>[] = [
    {
      key: "movementDate",
      label: "Date",
      sortable: true,
      sortValueGetter: (movement) => new Date(movement.movementDate).getTime(),
      render: (movement) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {new Date(movement.movementDate).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      key: "movementType",
      label: "Type",
      sortable: true,
      sortValueGetter: (movement) => getMovementTypeLabel(movement.movementType, movementTypeOptions),
      render: (movement) => (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getMovementTypeBadge(movement.movementType)}`}>
          <ArrowsRightLeftIcon className="h-3.5 w-3.5 opacity-80" />
          {getMovementTypeLabel(movement.movementType, movementTypeOptions)}
        </span>
      ),
    },
    {
      key: "product",
      label: "Product Name",
      sortable: true,
      sortValueGetter: (movement) => getProductDisplayName(movement),
      render: (movement) => {
        const productId = movement.productId ?? movement.product?.id;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
              <CubeIcon className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goToProduct(productId);
                }}
                className="truncate text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                title="View product"
              >
                {getProductDisplayName(movement)}
              </button>
            </div>
          </div>
        );
      },
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      render: (movement) => (
        <span className="text-sm font-semibold text-slate-700">{movement.quantity}</span>
      ),
    },
    {
      key: "route",
      label: "Movement",
      sortable: false,
      render: (movement) => (
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
          <span className="truncate font-medium" title={movement.fromLocation}>
            {movement.fromLocation || "N/A"}
          </span>
          <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium" title={movement.toLocation}>
            {movement.toLocation || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      sortable: true,
      render: (movement) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ClipboardDocumentListIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium" title={movement.reference}>
            {movement.reference || "--"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (movement) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(movement)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(movement)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingMovement(movement)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ======================== RENDER ========================
  return (
    <>
      <PageMeta title="Stock Movements" description="Track and manage inventory stock movements" />
      <PageBreadcrumb pageTitle="Stock Movements" />

      <div className="w-full max-w-none px-0 py-8 ">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Stock Movement" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Movements"
            value={stats.total}
            icon={<ArrowsRightLeftIcon />}
          />
          <StatsCard
            label="Total Quantity"
            value={stats.totalQuantity.toLocaleString()}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CubeIcon />}
          />
          <StatsCard
            label="Transfers"
            value={stats.transfers}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<ArrowRightIcon />}
          />
          <StatsCard
            label="Products Moved"
            value={stats.uniqueProducts}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<ClipboardDocumentListIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md md:mt-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by type, location, reference, or product..."
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
              title="Stock Movements"
              subtitle="Filtered stock movement listing"
              reportLabel="Stock Movements Report"
              data={filteredStockMovements}
              fileName="Stock_Movements"
              disabled={loading}
              dateAccessor={(row) => row.movementDate}
              metadata={(rows) => [
                { label: "Total", value: rows.length },
                { label: "Search", value: search || "None" },
                { label: "Total Quantity", value: rows.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0) },
              ]}
              columns={[
                { header: "Date", accessor: (row) => new Date(row.movementDate).toLocaleDateString() },
                { header: "Type", accessor: (row) => getMovementTypeLabel(row.movementType, movementTypeOptions) },
                { header: "Product", accessor: (row) => getProductDisplayName(row) },
                { header: "Quantity", accessor: (row) => String(row.quantity) },
                { header: "From", accessor: (row) => row.fromLocation || "N/A" },
                { header: "To", accessor: (row) => row.toLocation || "N/A" },
                { header: "Reference", accessor: (row) => row.reference || "-" },
              ]}
            />
            <FilterPopover
              title="Filter Stock Movements"
              buttonLabel="Filters"
              widthClassName="w-[21rem] sm:w-[23rem]"
              showFooter={false}
            >
              <div className="space-y-3">
                <FloatingSelect
                  label="Movement Type"
                  name="filterMovementType"
                  value={filterMovementType}
                  onChange={(e) => setFilterMovementType(e.target.value)}
                  options={movementTypeOptions}
                />
                <FloatingSelect
                  label="Product"
                  name="filterProductId"
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  options={productOptions}
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
          data={filteredStockMovements}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="movementDate"
          defaultSortOrder="desc"
          onRowClick={openView}
          className="md:-mt-4"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ArrowsRightLeftIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No stock movements found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first stock movement
              </button>
            </div>
          }
        />
      </div>

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Stock Movement" : "Add Stock Movement"}
        subtitle="Enter stock movement details"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Movement" : "Create Movement"}
        tabs={[
          {
            label: "Details",
            fields: [
              <FloatingInput
                key="movementDate"
                label="Movement Date"
                name="movementDate"
                type="date"
                value={form.movementDate}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="movementType"
                label="Movement Type"
                name="movementType"
                value={form.movementType}
                onChange={handleChange}
                options={movementTypeOptions}
                required
              />,
              <FloatingSelect
                key="productId"
                label="Product"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                options={productOptions}
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
              <FloatingInput
                key="fromLocation"
                label="From Location"
                name="fromLocation"
                value={form.fromLocation}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="toLocation"
                label="To Location"
                name="toLocation"
                value={form.toLocation}
                onChange={handleChange}
                required
              />,
            ],
          },
          {
            label: "Additional",
            fields: [
              <FloatingInput
                key="reference"
                label="Reference"
                name="reference"
                value={form.reference}
                onChange={handleChange}
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                options={warehouseOptions}
              />,
              <FloatingSelect
                key="batchId"
                label="Batch"
                name="batchId"
                value={form.batchId}
                onChange={handleChange}
                options={batchOptions}
                disabled={!form.productId}
              />,
              <FloatingSelect
                key="serialNumberId"
                label="Serial Number"
                name="serialNumberId"
                value={form.serialNumberId}
                onChange={handleChange}
                options={serialOptions}
                disabled={!form.productId}
              />,
            ],
          },
        ]}
      />

      {/* View Details Modal */}
      {showViewModal && viewingMovement && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowViewModal(false);
                setViewingMovement(null);
              }}
            ></div>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="w-full text-center sm:text-left">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Movement Details</h3>
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        setViewingMovement(null);
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XCircleIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mb-6 rounded-lg bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Movement Date</p>
                        <p className="text-sm text-gray-700">
                          {new Date(viewingMovement.movementDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getMovementTypeBadge(viewingMovement.movementType)}`}
                        >
                          {getMovementTypeLabel(viewingMovement.movementType, movementTypeOptions)}
                        </span>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Product</p>
                        <button
                          type="button"
                          onClick={() => goToProduct(viewingMovement.productId ?? viewingMovement.product?.id)}
                          className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                        >
                          {getProductDisplayName(viewingMovement)}
                        </button>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Quantity</p>
                        <p className="text-sm font-semibold text-gray-900">{viewingMovement.quantity}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Reference</p>
                        <p className="text-sm text-gray-700">{viewingMovement.reference || "N/A"}</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">From Location</p>
                        <p className="text-sm text-gray-700">{viewingMovement.fromLocation || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">To Location</p>
                        <p className="text-sm text-gray-700">{viewingMovement.toLocation || "N/A"}</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Warehouse</p>
                        <p className="text-sm text-gray-700">
                          {getWarehouseValue(viewingMovement.warehouse) || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Batch</p>
                        <p className="text-sm text-gray-700">
                          {typeof viewingMovement.batch === "string"
                            ? viewingMovement.batch
                            : viewingMovement.batch?.batchNumber || "N/A"}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Serial Number</p>
                        <p className="text-sm text-gray-700">
                          {typeof viewingMovement.serialNumber === "string"
                            ? viewingMovement.serialNumber
                            : viewingMovement.serialNumber?.serial || "N/A"}
                        </p>
                      </div>

                      {viewingMovement.createdBy && (
                        <div>
                          <p className="text-xs text-gray-500">Created By</p>
                          <p className="text-sm text-gray-700">{viewingMovement.createdBy}</p>
                        </div>
                      )}
                      {viewingMovement.createdDate && (
                        <div>
                          <p className="text-xs text-gray-500">Created At</p>
                          <p className="text-sm text-gray-600">
                            {new Date(viewingMovement.createdDate).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    openEdit(viewingMovement);
                  }}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-cyan-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <PencilSquareIcon className="mr-2 h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingMovement(null);
                  }}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DynamicPopup
        isPopupOpen={!!deletingMovement}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingMovement(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Stock Movement"
        subText={
          deletingMovement
            ? `Are you sure you want to delete movement #${deletingMovement.id}? This action cannot be undone.`
            : "Are you sure you want to delete this stock movement?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingMovement(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default StockMovementsManager;
