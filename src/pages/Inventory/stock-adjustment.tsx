import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
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

interface Product {
  id: number;
  productName: string;
    productCode?: string;
  currentStock?: number;
}

interface Warehouse {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  name: string;
  code?: string;
  locationType?: "MAIN" | "SUB" | "STORE";
  location?: string;
  stockLevels?: any[];
  batches?: any[];
  serialNumbers?: any[];
  stockMovements?: any[];
  stockAdjustments?: any[];
  stockEntries?: any[];
}

interface Batch {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  batchNumber: string;
  manufacturingDate?: string;
  productId?: number;
  warehouse?: Warehouse | null;
  inspections?: any[];
  expiryDate?: string;
  quantity?: number;
}

interface SerialNumber {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  serial: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  batchId?: number;
  productId?: number;
  productNumber?: string;
  warehouse?: Warehouse | null;
  batch?: Batch | null;
  inspections?: any[];
  status?: "AVAILABLE" | "SOLD" | "DAMAGED";
}

enum AdjustmentType {
  POSITIVE = "POSITIVE",
  NEGATIVE = "NEGATIVE",
}

// Fixed set of adjustment reasons per the Inventory Module spec.
// Previously this was free text — now constrained to these six categories
// so reporting/filtering by reason is reliable.
enum AdjustmentReason {
  PHYSICAL_STOCK_COUNT = "PHYSICAL_STOCK_COUNT",
  DAMAGED_PRODUCTS = "DAMAGED_PRODUCTS",
  LOST_PRODUCTS = "LOST_PRODUCTS",
  EXPIRED_PRODUCTS = "EXPIRED_PRODUCTS",
  INVENTORY_AUDIT = "INVENTORY_AUDIT",
  MANUAL_CORRECTION = "MANUAL_CORRECTION",
}

const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  [AdjustmentReason.PHYSICAL_STOCK_COUNT]: "Physical Stock Count",
  [AdjustmentReason.DAMAGED_PRODUCTS]: "Damaged Products",
  [AdjustmentReason.LOST_PRODUCTS]: "Lost Products",
  [AdjustmentReason.EXPIRED_PRODUCTS]: "Expired Products",
  [AdjustmentReason.INVENTORY_AUDIT]: "Inventory Audit",
  [AdjustmentReason.MANUAL_CORRECTION]: "Manual Correction",
};

interface StockAdjustment {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  adjustmentDate: string;
  reason: AdjustmentReason | string;
  quantity: number;
  adjustmentType: AdjustmentType;
  productId?: number;
  product?: Product;
  warehouse?: Warehouse;
  batch?: Batch;
  serialNumber?: SerialNumber;
}

type StockAdjustmentForm = {
  adjustmentDate: string;
  reason: AdjustmentReason | "";
  quantity: string;
  adjustmentType: AdjustmentType;
  productId: string;
  warehouseId: string;
  batchId: string;
  serialNumberId: string;
};

const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase";
const PAGE_SIZE = 10;

const PRODUCT_ROUTE = "/purchase-products"; // <Route path="/purchase-products" element={<Products />} />
const WAREHOUSE_ROUTE = "/warehouse";       // <Route path="/warehouse" element={<Warehouse />} />
const BATCH_ROUTE = "/batch";               // <Route path="/batch" element={<Batch />} />

const emptyForm: StockAdjustmentForm = {
  adjustmentDate: new Date().toISOString().split('T')[0],
  reason: "",
  quantity: "",
  adjustmentType: AdjustmentType.POSITIVE,
  productId: "",
  warehouseId: "",
  batchId: "",
  serialNumberId: "",
};

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

function getTypeBadge(type: AdjustmentType) {
  if (type === "POSITIVE") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  return "bg-red-50 text-red-700 border-red-200";
}

function getTypeIcon(type: AdjustmentType) {
  if (type === "POSITIVE") {
    return <ArrowUpIcon className="h-3 w-3 mr-1" />;
  }
  return <ArrowDownIcon className="h-3 w-3 mr-1" />;
}

// Renders a human-readable label for a reason, whether it's a known enum value
// or legacy free-text data already stored from before this fix.
function getReasonLabel(reason?: string | AdjustmentReason | null) {
  if (!reason) return "-";
  const label = ADJUSTMENT_REASON_LABELS[reason as AdjustmentReason];
  return label || String(reason);
}

function getBatchWarehouseId(batch?: Batch | null) {
  return Number(batch?.warehouse && typeof batch.warehouse !== "string" ? batch.warehouse.id : 0);
}

function getBatchWarehouseName(batch?: Batch | null) {
  return batch?.warehouse && typeof batch.warehouse !== "string" ? batch.warehouse.name : "";
}

function getSerialBatchId(serial?: SerialNumber | null) {
  return Number(serial?.batch?.id ?? serial?.batchId ?? 0);
}

function getSerialWarehouseId(serial?: SerialNumber | null) {
  return Number(serial?.warehouse && typeof serial.warehouse !== "string" ? serial.warehouse.id : 0);
}

function getSerialWarehouseName(serial?: SerialNumber | null) {
  return serial?.warehouse && typeof serial.warehouse !== "string" ? serial.warehouse.name : "";
}

const StockAdjustmentManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;
  const navigate = useNavigate();

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [filteredSerialNumbers, setFilteredSerialNumbers] = useState<SerialNumber[]>([]);
  const [form, setForm] = useState<StockAdjustmentForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [deletingAdjustment, setDeletingAdjustment] = useState<StockAdjustment | null>(null);
  const [viewingAdjustment, setViewingAdjustment] = useState<StockAdjustment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAdjustments(),
        fetchProducts(),
        fetchWarehouses(),
        fetchBatches(),
        fetchSerialNumbers(),
      ]);
    } catch (error) {
      ToasterService.error("Failed to load data", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };
  const unwrapList = (resData: any): any[] => {
    let raw = resData;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (Array.isArray(raw)) return raw;
    if (raw?.content && Array.isArray(raw.content)) return raw.content;
    if (raw?.data && Array.isArray(raw.data)) return raw.data;
    if (raw?.items && Array.isArray(raw.items)) return raw.items;
    return [];
  };

  const fetchAdjustments = async () => {
    try {
      const res = await axios.get(`${API_URL}/stock-adjustments`, { headers });
      const data = unwrapList(res.data);
      setAdjustments(data);
      if (data.length === 0) ToasterService.noData("No stock adjustments found");
    } catch (error) {
      ToasterService.error("Failed to load stock adjustments", getErrorMessage(error, "Please try again."));
      setAdjustments([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${PRODUCT_URL}/products`, { headers });
      setProducts(unwrapList(res.data));
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_URL}/warehouses`, { headers });
      setWarehouses(unwrapList(res.data));
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`, { headers });
      setBatches(unwrapList(res.data));
    } catch (error) {
      ToasterService.error("Failed to load batches", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchSerialNumbers = async () => {
    try {
      const res = await axios.get(`${API_URL}/serial-numbers`, { headers });
      setSerialNumbers(unwrapList(res.data));
    } catch (error) {
      ToasterService.error("Failed to load serial numbers", getErrorMessage(error, "Please try again."));
    }
  };

  const getProductDisplayName = (adjustment: StockAdjustment) => {
    const productId = adjustment.productId ?? adjustment.product?.id;
    const product = products.find((p) => p.id === productId);
    if (product) {
      return product.productCode ? `${product.productName} (${product.productCode})` : product.productName;
    }
    return adjustment.product?.productName || "N/A";
  };

  const goToProduct = (productId?: number) => {
    if (!productId) return;
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, { state: { productId } });
  };

  const goToWarehouse = (warehouse?: Warehouse) => {
    if (!warehouse?.id) return;
    navigate(`${WAREHOUSE_ROUTE}?warehouseId=${warehouse.id}`, {
      state: { warehouseId: warehouse.id, warehouseName: warehouse.name },
    });
  };

  const goToBatch = (batch?: Batch) => {
    if (!batch?.id) return;
    navigate(`${BATCH_ROUTE}?batchId=${batch.id}`, {
      state: { batchId: batch.id, batchNumber: batch.batchNumber },
    });
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleProductChange = (productId: string) => {
    setForm((prev) => ({ ...prev, productId, batchId: "", serialNumberId: "" }));
    if (productId) {
      const filtered = batches.filter((b) => b.productId === Number(productId));
      setFilteredBatches(filtered);
    } else {
      setFilteredBatches([]);
      setFilteredSerialNumbers([]);
    }
  };

  const handleWarehouseChange = (warehouseId: string) => {
    setForm((prev) => ({ ...prev, warehouseId, batchId: "", serialNumberId: "" }));

    if (!form.productId) {
      setFilteredBatches([]);
      setFilteredSerialNumbers([]);
      return;
    }

    const filtered = batches.filter((batch) => batch.productId === Number(form.productId));
    setFilteredBatches(filtered);
    setFilteredSerialNumbers([]);
  };

  const handleBatchChange = (batchId: string) => {
    setForm((prev) => ({ ...prev, batchId, serialNumberId: "" }));
    if (batchId) {
      const filtered = serialNumbers.filter((sn) => {
        const matchesBatch = getSerialBatchId(sn) === Number(batchId);
        const matchesProduct = !form.productId || sn.productId === Number(form.productId);
        return matchesBatch && matchesProduct;
      });
      setFilteredSerialNumbers(filtered);
    } else {
      setFilteredSerialNumbers([]);
    }
  };

  const buildPayload = () => {
    const selectedWarehouse = warehouses.find((item) => item.id === Number(form.warehouseId));
    const selectedBatch = filteredBatches.find((item) => item.id === Number(form.batchId))
      || batches.find((item) => item.id === Number(form.batchId));
    const selectedSerial = filteredSerialNumbers.find((item) => item.id === Number(form.serialNumberId))
      || serialNumbers.find((item) => item.id === Number(form.serialNumberId));

    const payload: Record<string, any> = {
      adjustmentDate: form.adjustmentDate,
      reason: form.reason,
      quantity: Number(form.quantity),
      adjustmentType: form.adjustmentType,
      productId: Number(form.productId),
      warehouse: selectedWarehouse ? { id: selectedWarehouse.id } : null,
      batch: selectedBatch ? { id: selectedBatch.id } : null,
      serialNumber: selectedSerial ? { id: selectedSerial.id } : null,
    };

    if (editingId) {
      payload.id = editingId;
    }

    return payload;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const quantity = Number(form.quantity);

    if (!form.productId) {
      ToasterService.error("Required field missing", "Product selection is required.");
      return;
    }
    if (!form.warehouseId) {
      ToasterService.error("Required field missing", "Warehouse selection is required.");
      return;
    }
    if (!form.batchId) {
      ToasterService.error("Required field missing", "Batch selection is required.");
      return;
    }
    if (!quantity || quantity <= 0) {
      ToasterService.error("Invalid quantity", "Quantity must be greater than 0.");
      return;
    }
    if (!form.reason) {
      ToasterService.error("Required field missing", "Please select a reason for the adjustment.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(`${API_URL}/stock-adjustments/${editingId}`, payload, { headers });
        ToasterService.success("Stock adjustment updated");
      } else {
        await axios.post(`${API_URL}/stock-adjustments`, payload, { headers });
        ToasterService.success("Stock adjustment created");
      }

      closeForm();
      fetchAdjustments();
    } catch (error) {
      ToasterService.error("Failed to save stock adjustment", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      adjustmentDate: new Date().toISOString().split('T')[0],
    });
    setFilteredBatches([]);
    setFilteredSerialNumbers([]);
    setShowFormModal(true);
  };

  const openEdit = (adjustment: StockAdjustment) => {
    const productId = adjustment.productId ?? adjustment.product?.id;
    setEditingId(adjustment.id);
    setForm({
      adjustmentDate: adjustment.adjustmentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      // Legacy free-text values that don't match a known reason code fall back to
      // empty so the user has to pick a valid option on edit.
      reason: (Object.values(AdjustmentReason) as string[]).includes(adjustment.reason as string)
        ? (adjustment.reason as AdjustmentReason)
        : "",
      quantity: String(adjustment.quantity || 0),
      adjustmentType: adjustment.adjustmentType || AdjustmentType.POSITIVE,
      productId: String(productId || ""),
      warehouseId: String(adjustment.warehouse?.id || ""),
      batchId: String(adjustment.batch?.id || ""),
      serialNumberId: String(adjustment.serialNumber?.id || ""),
    });

    if (productId) {
      const filtered = batches.filter((b) => b.productId === productId);
      setFilteredBatches(filtered);
    }
    if (adjustment.batch?.id) {
      const filtered = serialNumbers.filter((sn) => getSerialBatchId(sn) === adjustment.batch?.id);
      setFilteredSerialNumbers(filtered);
    }

    setShowFormModal(true);
  };

  const openView = (adjustment: StockAdjustment) => {
    setViewingAdjustment(adjustment);
    setShowViewModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFilteredBatches([]);
    setFilteredSerialNumbers([]);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deletingAdjustment) return;

    try {
      await axios.delete(`${API_URL}/stock-adjustments/${deletingAdjustment.id}`, { headers });
      ToasterService.success("Stock adjustment deleted");
      setAdjustments((current) => current.filter((item) => item.id !== deletingAdjustment.id));
    } catch (error) {
      ToasterService.error("Failed to delete stock adjustment", getErrorMessage(error, "Please try again."));
    } finally {
      setDeletingAdjustment(null);
    }
  };

  const filteredAdjustments = useMemo(() => {
    const term = searchableText(search);

    return adjustments.filter((adjustment) => {
      if (filterType && adjustment.adjustmentType !== filterType) return false;
      if (filterReason && adjustment.reason !== filterReason) return false;
      if (filterDateFrom && new Date(adjustment.adjustmentDate) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(adjustment.adjustmentDate) > new Date(filterDateTo)) return false;

      if (!term) return true;

      const haystack = [
        getReasonLabel(adjustment.reason),
        adjustment.quantity,
        adjustment.adjustmentType,
        getProductDisplayName(adjustment),
        adjustment.warehouse?.name,
        adjustment.warehouse?.code,
        adjustment.batch?.batchNumber,
        adjustment.serialNumber?.serial,
        adjustment.id,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [adjustments, search, filterType, filterReason, filterDateFrom, filterDateTo, products]);

  const resetFilters = () => {
    setFilterType("");
    setFilterReason("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const stats = useMemo(
    () => ({
      total: adjustments.length,
      positive: adjustments.filter((a) => a.adjustmentType === AdjustmentType.POSITIVE).length,
      negative: adjustments.filter((a) => a.adjustmentType === AdjustmentType.NEGATIVE).length,
      totalAdded: adjustments
        .filter((a) => a.adjustmentType === AdjustmentType.POSITIVE)
        .reduce((sum, a) => sum + a.quantity, 0),
      totalRemoved: adjustments
        .filter((a) => a.adjustmentType === AdjustmentType.NEGATIVE)
        .reduce((sum, a) => sum + a.quantity, 0),
    }),
    [adjustments]
  );

  const netChange = stats.totalAdded - stats.totalRemoved;

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: String(product.id),
      name: product.productCode ? `${product.productName} (${product.productCode})` : product.productName,
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((warehouse) => ({
      id: String(warehouse.id),
      name: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
    }));
  }, [warehouses]);


  const batchOptions = useMemo(() => {
    const selectedWarehouseId = Number(form.warehouseId || 0);
    return filteredBatches.map((batch) => {
      const batchWarehouseId = getBatchWarehouseId(batch);
      const batchWarehouseName = getBatchWarehouseName(batch);
      const mismatch = selectedWarehouseId > 0 && batchWarehouseId > 0 && batchWarehouseId !== selectedWarehouseId;

      let label = batch.batchNumber;
      if (batch.expiryDate) {
        label += ` (Exp: ${new Date(batch.expiryDate).toLocaleDateString()})`;
      }
      if (mismatch) {
        label += ` — warehouse: ${batchWarehouseName || `#${batchWarehouseId}`} ⚠️ differs from selected warehouse`;
      }

      return { id: String(batch.id), name: label };
    });
  }, [filteredBatches, form.warehouseId]);

  const serialOptions = useMemo(() => {
    const selectedWarehouseId = Number(form.warehouseId || 0);
    return filteredSerialNumbers.map((serial) => {
      const serialWarehouseId = getSerialWarehouseId(serial);
      const serialWarehouseName = getSerialWarehouseName(serial);
      const mismatch = selectedWarehouseId > 0 && serialWarehouseId > 0 && serialWarehouseId !== selectedWarehouseId;

      let label = serial.status ? `${serial.serial} (${serial.status})` : serial.serial;
      if (mismatch) {
        label += ` — warehouse: ${serialWarehouseName || `#${serialWarehouseId}`} ⚠️ differs from selected warehouse`;
      }

      return { id: String(serial.id), name: label };
    });
  }, [filteredSerialNumbers, form.warehouseId]);

  const typeOptions = useMemo(() => {
    return [
      { id: "POSITIVE", name: "Stock In" },
      { id: "NEGATIVE", name: "Stock Out" },
    ];
  }, []);

  // Fixed reason dropdown options, per the spec's six Adjustment Reasons.
  const reasonOptions = useMemo(() => {
    return Object.values(AdjustmentReason).map((value) => ({
      id: value,
      name: ADJUSTMENT_REASON_LABELS[value],
    }));
  }, []);

  const columns: ColumnDef<StockAdjustment>[] = [
    {
      key: "adjustmentDate",
      label: "Date",
      sortable: true,
      sortValueGetter: (adjustment) => new Date(adjustment.adjustmentDate).getTime(),
      render: (adjustment) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {new Date(adjustment.adjustmentDate).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (adjustment) => getProductDisplayName(adjustment),
      render: (adjustment) => {
        const productId = adjustment.productId ?? adjustment.product?.id;
        return (
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToProduct(productId);
              }}
              className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
              title="View product"
            >
              {getProductDisplayName(adjustment)}
            </button>
          </div>
        );
      },
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      sortValueGetter: (adjustment) => adjustment.warehouse?.name || "",
      render: (adjustment) =>
        adjustment.warehouse?.id ? (
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goToWarehouse(adjustment.warehouse);
              }}
              className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
              title="View warehouse"
            >
              {adjustment.warehouse.name}
            </button>
            {adjustment.warehouse.code && (
              <p className="text-xs text-gray-500">{adjustment.warehouse.code}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-900">N/A</p>
        ),
    },
    {
      key: "batch",
      label: "Batch",
      sortable: true,
      sortValueGetter: (adjustment) => adjustment.batch?.batchNumber || "",
      render: (adjustment) =>
        adjustment.batch?.id ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToBatch(adjustment.batch);
            }}
            className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
            title="View batch"
          >
            {adjustment.batch.batchNumber}
          </button>
        ) : (
          <span className="text-sm text-gray-900">N/A</span>
        ),
    },
    {
      key: "adjustmentType",
      label: "Type",
      sortable: true,
      render: (adjustment) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${getTypeBadge(adjustment.adjustmentType)}`}>
          {getTypeIcon(adjustment.adjustmentType)}
          {adjustment.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out"}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      sortable: true,
      render: (adjustment) => (
        <span className={`text-sm font-semibold ${adjustment.adjustmentType === "POSITIVE" ? "text-green-600" : "text-red-600"}`}>
          {adjustment.adjustmentType === "POSITIVE" ? "+" : "-"}{adjustment.quantity}
        </span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      sortValueGetter: (adjustment) => getReasonLabel(adjustment.reason),
      render: (adjustment) => (
        <p className="text-sm text-gray-700 line-clamp-2">{getReasonLabel(adjustment.reason)}</p>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (adjustment) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(adjustment)}
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
            onClick={() => openEdit(adjustment)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingAdjustment(adjustment)}
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
      <PageMeta title="Stock Adjustment" description="Manage inventory stock adjustments" />
      <PageBreadcrumb pageTitle="Stock Adjustment" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Adjustment" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Adjustments"
            value={stats.total}
            icon={<ClipboardDocumentCheckIcon />}
          />
          <StatsCard
            label="Stock In"
            value={stats.positive}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<ArrowUpIcon />}
          />
          <StatsCard
            label="Stock Out"
            value={stats.negative}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ArrowDownIcon />}
          />
          <StatsCard
            label="Net Change"
            value={`${netChange >= 0 ? "+" : ""}${netChange.toLocaleString()}`}
            gradient="from-amber-50 to-orange-50"
            borderColor="border-amber-100"
            labelColor="text-amber-600"
            icon={<ChartBarIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product or reason..."
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
              title="Stock Adjustments"
              subtitle="Filtered stock adjustment listing"
              reportLabel="Stock Adjustments Report"
              data={filteredAdjustments}
              fileName="Stock_Adjustments"
              disabled={loading}
              dateAccessor={(row) => row.adjustmentDate}
              metadata={(rows, rangeLabel) => [
                { label: "Total", value: rows.length },
                { label: "Range", value: rangeLabel },
                { label: "Search", value: search || "None" },
                {
                  label: "Net Change",
                  value: rows.reduce((sum, a) => sum + (a.adjustmentType === "POSITIVE" ? a.quantity : -a.quantity), 0),
                },
              ]}
        
              columns={[
                { header: "Date", accessor: (row) => new Date(row.adjustmentDate).toLocaleDateString() },
                { header: "Product", accessor: (row) => getProductDisplayName(row) },
                { header: "Warehouse", accessor: (row) => row.warehouse?.name || "N/A" },
                { header: "Batch", accessor: (row) => row.batch?.batchNumber || "N/A" },
                { header: "Type", accessor: (row) => (row.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out") },
                {
                  header: "Quantity",
                  accessor: (row) => `${row.adjustmentType === "POSITIVE" ? "+" : "-"}${row.quantity}`,
                },
                { header: "Reason", accessor: (row) => getReasonLabel(row.reason) },
              ]}
            />
            <FilterPopover
              title="Filter Adjustments"
              buttonLabel="Filters"
              widthClassName="w-[21rem] sm:w-[23rem]"
              showFooter={false}
            >
              <div className="space-y-3">
                <FloatingSelect
                  label="Adjustment Type"
                  name="filterType"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  options={typeOptions}
                />
                <FloatingSelect
                  label="Reason"
                  name="filterReason"
                  value={filterReason}
                  onChange={(e) => setFilterReason(e.target.value)}
                  options={reasonOptions}
                />
                <FloatingInput
                  label="From Date"
                  name="filterDateFrom"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
                <FloatingInput
                  label="To Date"
                  name="filterDateTo"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
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
          data={filteredAdjustments}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="adjustmentDate"
          defaultSortOrder="desc"
          onRowClick={openView}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardDocumentCheckIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No stock adjustments found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first adjustment
              </button>
            </div>
          }
        />
      </div>

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Stock Adjustment" : "Add Stock Adjustment"}
        subtitle="Enter stock adjustment details"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Adjustment" : "Create Adjustment"}
        tabs={[
          {
            label: "Details",
            fields: [
              <FloatingInput
                key="adjustmentDate"
                label="Adjustment Date"
                name="adjustmentDate"
                type="date"
                value={form.adjustmentDate}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="adjustmentType"
                label="Adjustment Type"
                name="adjustmentType"
                value={form.adjustmentType}
                onChange={handleChange}
                options={typeOptions}
                required
              />,
              <FloatingSelect
                key="productId"
                label="Product"
                name="productId"
                value={form.productId}
                onChange={(e) => handleProductChange(e.target.value)}
                options={productOptions}
                required
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                options={warehouseOptions}
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
            label: "Additional",
            fields: [
              <FloatingSelect
                key="batchId"
                label="Batch"
                name="batchId"
                value={form.batchId}
                onChange={(e) => handleBatchChange(e.target.value)}
                options={batchOptions}
                disabled={!form.productId}
                required
              />,
              <FloatingSelect
                key="serialNumberId"
                label="Serial Number"
                name="serialNumberId"
                value={form.serialNumberId}
                onChange={handleChange}
                options={serialOptions}
                disabled={!form.batchId}
              />,
              // Reason is now a fixed dropdown (Physical Stock Count, Damaged
              // Products, Lost Products, Expired Products, Inventory Audit,
              // Manual Correction) instead of free text.
              <FloatingSelect
                key="reason"
                label="Reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                options={reasonOptions}
                required
              />,
            ],
          },
        ]}
      />

      {/* View Details Modal */}
      {showViewModal && viewingAdjustment && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => {
                setShowViewModal(false);
                setViewingAdjustment(null);
              }}
            ></div>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <div className="w-full text-center sm:text-left">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Adjustment Details</h3>
                    <button
                      onClick={() => {
                        setShowViewModal(false);
                        setViewingAdjustment(null);
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XCircleIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mb-6 rounded-lg bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Adjustment Date</p>
                        <p className="text-sm text-gray-700">
                          {new Date(viewingAdjustment.adjustmentDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <span
                          className={`mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getTypeBadge(viewingAdjustment.adjustmentType)}`}
                        >
                          {getTypeIcon(viewingAdjustment.adjustmentType)}
                          {viewingAdjustment.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out"}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Product</p>
                        <button
                          type="button"
                          onClick={() => goToProduct(viewingAdjustment.productId ?? viewingAdjustment.product?.id)}
                          className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                        >
                          {getProductDisplayName(viewingAdjustment)}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Quantity</p>
                        <p
                          className={`text-sm font-semibold ${viewingAdjustment.adjustmentType === "POSITIVE" ? "text-green-600" : "text-red-600"}`}
                        >
                          {viewingAdjustment.adjustmentType === "POSITIVE" ? "+" : "-"}
                          {viewingAdjustment.quantity}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Warehouse</p>
                        {viewingAdjustment.warehouse?.id ? (
                          <button
                            type="button"
                            onClick={() => goToWarehouse(viewingAdjustment.warehouse)}
                            className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                          >
                            {viewingAdjustment.warehouse.name || "N/A"}
                          </button>
                        ) : (
                          <p className="text-sm text-gray-700">N/A</p>
                        )}
                        {viewingAdjustment.warehouse?.code && (
                          <p className="mt-1 text-xs text-gray-500">{viewingAdjustment.warehouse.code}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Batch</p>
                        {viewingAdjustment.batch?.id ? (
                          <button
                            type="button"
                            onClick={() => goToBatch(viewingAdjustment.batch)}
                            className="text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline text-left"
                          >
                            {viewingAdjustment.batch.batchNumber || "N/A"}
                          </button>
                        ) : (
                          <p className="text-sm text-gray-700">N/A</p>
                        )}
                        {viewingAdjustment.batch?.expiryDate && (
                          <p className="mt-1 text-xs text-gray-500">
                            Expires: {new Date(viewingAdjustment.batch.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Serial Number</p>
                        <p className="text-sm text-gray-700">
                          {viewingAdjustment.serialNumber?.serial || "N/A"}
                          {viewingAdjustment.serialNumber?.status ? ` (${viewingAdjustment.serialNumber.status})` : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Created By</p>
                        <p className="text-sm text-gray-700">{viewingAdjustment.createdBy || "N/A"}</p>
                      </div>

                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Reason</p>
                        <p className="text-sm text-gray-700">{getReasonLabel(viewingAdjustment.reason)}</p>
                      </div>

                      {viewingAdjustment.createdDate && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Created At</p>
                          <p className="text-sm text-gray-600">
                            {new Date(viewingAdjustment.createdDate).toLocaleString()}
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
                    openEdit(viewingAdjustment);
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
                    setViewingAdjustment(null);
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
        isPopupOpen={!!deletingAdjustment}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingAdjustment(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Adjustment"
        subText={
          deletingAdjustment
            ? `Are you sure you want to delete the ${deletingAdjustment.adjustmentType === "POSITIVE" ? "stock in" : "stock out"} adjustment for "${getProductDisplayName(deletingAdjustment)}" (${deletingAdjustment.quantity} units)? This action cannot be undone.`
            : "Are you sure you want to delete this adjustment?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingAdjustment(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default StockAdjustmentManager;
