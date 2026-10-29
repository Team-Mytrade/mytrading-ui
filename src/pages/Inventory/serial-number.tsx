import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  CubeIcon,
  EyeIcon,
  PencilSquareIcon,
  QrCodeIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
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
import { usePermissions } from "../../access/usePermissions";

// ---------- Interfaces ----------
interface Product {
  id: number;
  productName: string;
  serialTracking?: boolean;
  batchTracking?: boolean;
  expiryTracking?: boolean;
  productCode?: string;
  categoryName?: string;
  brand?: string;
  uom?: string;
  standardCost?: number;
  sellingPrice?: number;
  stockItem?: boolean;
  serviceItem?: boolean;
  active?: boolean;
  imageName?: string | null;
  imageType?: string | null;
}

interface WarehouseRef {
  id: number;
  code?: string;
  name: string;
  locationType?: string;
  active?: boolean;
}

interface BatchRef {
  id: number;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  productId?: number;
  warehouse?: { id: number } | null;
}

interface Inspection {
  id: number;
  inspectionDate: string;
  inspector: string;
  result: string;
  remarks?: string;
  serialNumberId?: number;
}

interface EnumOption {
  id: string;
  name: string;
}

interface SerialNumber {
  id: number;
  serial: string;
  warrantyStart: string;
  warrantyEnd: string;
  // The API spells this field "purchasDate" (backend typo). The page uses the
  // correct name; fromApi()/buildPayload() translate at the API boundary.
  purchaseDate?: string | null;
  issuedAt?: string | null;
  productId: number;
  productNumber?: string;
  warehouse?: WarehouseRef;
  batch?: BatchRef;
  inspections?: Inspection[];
  currentStatus?: string;
}

type SerialNumberForm = {
  warrantyStart: string;
  warrantyEnd: string;
  productId: string;
  warehouseId: string;
  batchId: string;
  currentStatus: string;
};

// ---------- Constants ----------
const API_URL = "/v1/api/inventory";
// Products live in the product catalogue (the purchase service no longer serves them)
const PRODUCT_URL = "/v1/api/common";
const PAGE_SIZE = 10;

// 🔧 Route paths — match your app's actual routes.
const WAREHOUSE_ROUTE = "/warehouse";
const PRODUCT_ROUTE = "/purchase-products";
const BATCH_ROUTE = "/batch";   // ← change if your batch page lives elsewhere

const CURRENT_STATUS_ENUM_TYPE = "CURRENTSTATUS";

const emptyForm: SerialNumberForm = {
  warrantyStart: "",
  warrantyEnd: "",
  productId: "",
  warehouseId: "",
  batchId: "",
  currentStatus: "",
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

// API -> UI: read the misspelt "purchasDate" (and "purchaseDate" once the
// backend is fixed) into purchaseDate, and drop the misspelt key so it never
// reaches a generic details view as a "Purchas Date" label.
// The API returns UTC timestamps without "Z"; mark them as UTC so they show in
// IST. Date-only values (warranty, manufacturing, expiry) don't match and stay.
const SERVER_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;
function toUtc(value: any) {
  return typeof value === "string" && SERVER_TS.test(value)
    ? value.replace(/(\.\d{3})\d+$/, "$1") + "Z"
    : value;
}

function withUtcDates(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  return {
    ...obj,
    createdDate: toUtc(obj.createdDate),
    updatedDate: toUtc(obj.updatedDate),
    ...(obj.warehouse && typeof obj.warehouse === "object"
      ? { warehouse: withUtcDates(obj.warehouse) }
      : {}),
  };
}

function fromApi(raw: any): SerialNumber {
  if (!raw || typeof raw !== "object") return raw;
  const { purchasDate, ...rest } = raw;
  return {
    ...withUtcDates(rest),
    issuedAt: toUtc(rest.issuedAt),
    batch: rest.batch && typeof rest.batch === "object" ? withUtcDates(rest.batch) : rest.batch,
    purchaseDate: rest.purchaseDate ?? purchasDate ?? null,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isWarrantyActive(warrantyEnd: string) {
  if (!warrantyEnd) return false;
  const end = new Date(warrantyEnd);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() >= Date.now();
}

function getProductName(sn: SerialNumber, products: Product[]) {
  const product = products.find((p) => p.id === sn.productId);
  return product?.productName || "N/A";
}

function getWarehouseName(sn: SerialNumber) {
  return sn.warehouse?.name || "N/A";
}

function getBatchNumber(sn: SerialNumber) {
  return sn.batch?.batchNumber || "N/A";
}

function getInspections(
  sn: SerialNumber,
  inspectionsBySerial: Record<number, Inspection[]>
): string {
  const inspections = inspectionsBySerial[sn.id] ?? sn.inspections ?? [];
  if (inspections.length === 0) return "N/A";
  const results = inspections.map((i) => i.result).join(", ");
  return `${inspections.length} (${results})`;
}

function formatEnumResponse(raw: unknown): EnumOption[] {
  if (!Array.isArray(raw)) {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.data)) return formatEnumResponse(obj.data);
      if (Array.isArray(obj.content)) return formatEnumResponse(obj.content);
      if (Array.isArray(obj.items)) return formatEnumResponse(obj.items);
    }
    return [];
  }
  return raw
    .map((item): EnumOption | null => {
      if (typeof item === "string") return { id: item, name: item };
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const id = obj.id ?? obj.code ?? obj.value ?? obj.key;
        const name = obj.name ?? obj.label ?? obj.value ?? id;
        if (id === undefined || id === null) return null;
        return { id: String(id), name: String(name ?? id) };
      }
      return null;
    })
    .filter((item): item is EnumOption => item !== null);
}

const STATUS_BADGE_PALETTE = [
  "bg-green-50 text-green-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
];

function getStatusBadgeClass(status?: string | null) {
  if (!status) return "bg-gray-50 text-gray-700 dark:bg-slate-800 dark:text-slate-300";
  let hash = 0;
  for (let i = 0; i < status.length; i++) {
    hash = (hash * 31 + status.charCodeAt(i)) >>> 0;
  }
  return STATUS_BADGE_PALETTE[hash % STATUS_BADGE_PALETTE.length];
}

// ---------- Component ----------
const SerialNumberManager: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;

  const navigate = useNavigate();
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [batches, setBatches] = useState<BatchRef[]>([]);
  const [inspectionsBySerial, setInspectionsBySerial] = useState<Record<number, Inspection[]>>(
    {}
  );
  const [statusOptions, setStatusOptions] = useState<EnumOption[]>([]);
  const [form, setForm] = useState<SerialNumberForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewingSerial, setViewingSerial] = useState<SerialNumber | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingSerial, setDeletingSerial] = useState<SerialNumber | null>(null);

  useEffect(() => {
    fetchSerialNumbers();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
    fetchInspections();
    fetchCurrentStatusOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSerialNumbers = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SerialNumber[]>(`${API_URL}/serial-numbers`, { headers });
      const data = Array.isArray(res.data) ? res.data.map(fromApi) : [];
      setSerialNumbers(data);
      if (data.length === 0) ToasterService.noData("No serial numbers found");
    } catch (error) {
      ToasterService.error(
        "Failed to load serial numbers",
        getErrorMessage(error, "Please try again.")
      );
      setSerialNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${PRODUCT_URL}/products`, { headers });
      let productList: Product[] = [];
      const raw = res.data;
      if (Array.isArray(raw)) {
        productList = raw;
      } else if (raw?.data && Array.isArray(raw.data)) {
        productList = raw.data;
      } else if (raw?.items && Array.isArray(raw.items)) {
        productList = raw.items;
      }
      setProducts(productList);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_URL}/warehouses`, { headers });
      let list: WarehouseRef[] = [];
      const raw = res.data;
      if (Array.isArray(raw)) list = raw;
      else if (raw?.content && Array.isArray(raw.content)) list = raw.content;
      else if (raw?.data && Array.isArray(raw.data)) list = raw.data;
      else if (raw?.items && Array.isArray(raw.items)) list = raw.items;
      setWarehouses(list);
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`, { headers });
      let list: BatchRef[] = [];
      const raw = res.data;
      if (Array.isArray(raw)) list = raw;
      else if (raw?.content && Array.isArray(raw.content)) list = raw.content;
      else if (raw?.data && Array.isArray(raw.data)) list = raw.data;
      else if (raw?.items && Array.isArray(raw.items)) list = raw.items;
      setBatches(list);
    } catch (error) {
      ToasterService.error("Failed to load batches", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchInspections = async () => {
    try {
      const res = await axios.get<Inspection[]>(`${API_URL}/quality-inspections`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      const grouped: Record<number, Inspection[]> = {};
      data.forEach((inspection) => {
        const key = inspection.serialNumberId;
        if (!key) return;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(inspection);
      });
      setInspectionsBySerial(grouped);
    } catch (error) {
      ToasterService.error(
        "Failed to load quality inspections",
        getErrorMessage(error, "Please try again.")
      );
    }
  };

  const fetchCurrentStatusOptions = async () => {
    try {
      const res = await axios.get(`${API_URL}/enums`, {
        headers,
        params: { type: CURRENT_STATUS_ENUM_TYPE },
      });
      const options = formatEnumResponse(res.data);
      if (options.length === 0) {
        ToasterService.error(
          "Current Status options unavailable",
          "No values returned for CURRENTSTATUS enum."
        );
      }
      setStatusOptions(options);
    } catch (error) {
      ToasterService.error(
        "Failed to load Current Status options",
        getErrorMessage(error, "Please try again.")
      );
      setStatusOptions([]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      // A batch belongs to one product and one warehouse, so picking a
      // different product or warehouse clears it.
      if ((name === "productId" || name === "warehouseId") && value !== current[name]) {
        next.batchId = "";
      }
      return next;
    });
  };

  // Only batches of the selected product in the selected warehouse, shown once
  // both are chosen. When editing, the serial's current batch stays listed.
  const batchOptions = useMemo(() => {
    if (!form.productId || !form.warehouseId) return [];
    return batches
      .filter(
        (b) =>
          String(b.id) === form.batchId ||
          (String(b.productId) === form.productId &&
            String(b.warehouse?.id ?? "") === form.warehouseId)
      )
      .map((b) => ({ id: String(b.id), name: b.batchNumber }));
  }, [batches, form.productId, form.warehouseId, form.batchId]);

  const buildPayload = () => {
    const productId = Number(form.productId) || 0;
    const warehouseId = Number(form.warehouseId) || 0;
    const batchId = Number(form.batchId) || 0;
    const product = products.find((item) => item.id === productId);
    const productNumber = product?.productCode ?? product?.productName ?? "";
    const existing = editingId ? serialNumbers.find((sn) => sn.id === editingId) : undefined;

    return {
      id: editingId || 0,
      // Backend field name is "purchasDate" (typo). Send the current value back
      // on edit so a PUT doesn't clear it. Rename here once the backend fixes it.
      purchasDate: existing?.purchaseDate ?? null,
      warrantyStart: form.warrantyStart,
      warrantyEnd: form.warrantyEnd,
      productId,
      productNumber,
      warehouse: warehouseId ? { id: warehouseId } : null,
      batch: batchId ? { id: batchId } : null,
      inspections: [],
      currentStatus: form.currentStatus || null,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.productId || !form.warehouseId || !form.batchId) {
      ToasterService.error(
        "Required fields missing",
        "Product, warehouse, and batch are required."
      );
      return;
    }
    if (!form.warrantyStart || !form.warrantyEnd) {
      ToasterService.error(
        "Required fields missing",
        "Warranty start and end dates are required."
      );
      return;
    }
    const product = products.find((p) => String(p.id) === form.productId);
    if (product?.serialTracking === false) {
      ToasterService.error(
        "No serial tracking",
        `${product.productName} doesn't use serial numbers, so serials can't be created for it.`
      );
      return;
    }
    const batch = batches.find((b) => String(b.id) === form.batchId);
    if (
      batch &&
      (String(batch.productId) !== form.productId ||
        String(batch.warehouse?.id ?? "") !== form.warehouseId)
    ) {
      ToasterService.error(
        "Invalid batch",
        "The selected batch is for a different product or warehouse."
      );
      return;
    }
    if (new Date(form.warrantyEnd) < new Date(form.warrantyStart)) {
      ToasterService.error(
        "Invalid warranty range",
        "Warranty end date cannot be before the start date."
      );
      return;
    }
    try {
      setSubmitting(true);
      const payload = buildPayload();
      if (editingId) {
        await axios.put(`${API_URL}/serial-numbers/${editingId}`, payload, { headers });
        ToasterService.success("Serial number updated");
      } else {
        await axios.post(`${API_URL}/serial-numbers`, payload, { headers });
        ToasterService.success("Serial number created");
      }
      closeForm();
      fetchSerialNumbers();
    } catch (error) {
      ToasterService.error(
        "Failed to save serial number",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowFormModal(true);
  };

  const openEdit = (sn: SerialNumber) => {
    setEditingId(sn.id);
    setForm({
      warrantyStart: sn.warrantyStart ? sn.warrantyStart.slice(0, 10) : "",
      warrantyEnd: sn.warrantyEnd ? sn.warrantyEnd.slice(0, 10) : "",
      productId: sn.productId ? String(sn.productId) : "",
      warehouseId: sn.warehouse?.id ? String(sn.warehouse.id) : "",
      batchId: sn.batch?.id ? String(sn.batch.id) : "",
      currentStatus: sn.currentStatus ?? "",
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deletingSerial) return;
    try {
      await axios.delete(`${API_URL}/serial-numbers/${deletingSerial.id}`, { headers });
      ToasterService.success("Serial number deleted");
      setSerialNumbers((current) => current.filter((item) => item.id !== deletingSerial.id));
    } catch (error) {
      ToasterService.error(
        "Failed to delete serial number",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setDeletingSerial(null);
    }
  };

  const openView = async (sn: SerialNumber) => {
    setViewingSerial(sn);
    try {
      setViewLoading(true);
      const res = await axios.get<SerialNumber>(`${API_URL}/serial-numbers/${sn.id}`, { headers });
      if (res.data) {
        setViewingSerial(fromApi(res.data));
      }
    } catch (error) {
      ToasterService.error(
        "Failed to load serial number details",
        getErrorMessage(error, "Showing last known details.")
      );
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewingSerial(null);
  };

  useEffect(() => {
    if (!viewingSerial) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewingSerial]);

  // ---------- Navigation ----------
  const goToWarehouse = (warehouse?: WarehouseRef) => {
    if (!warehouse?.id) return;
    navigate(
      `${WAREHOUSE_ROUTE}?warehouseId=${warehouse.id}&warehouseName=${encodeURIComponent(
        warehouse.name || ""
      )}`,
      { state: { warehouseId: warehouse.id, warehouseName: warehouse.name } }
    );
  };

  const goToProduct = (productId?: number) => {
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, {
      state: { productId, productName: product?.productName },
    });
  };

  // NEW: navigate to the batch page with a filter param.
  const goToBatch = (batch?: BatchRef) => {
    if (!batch?.id) return;
    navigate(
      `${BATCH_ROUTE}?batchId=${batch.id}&batchName=${encodeURIComponent(
        batch.batchNumber || ""
      )}`,
      { state: { batchId: batch.id, batchNumber: batch.batchNumber } }
    );
  };

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const total = serialNumbers.length;
    const inWarranty = serialNumbers.filter((sn) => isWarrantyActive(sn.warrantyEnd)).length;
    const expired = total - inWarranty;
    const warehousesCount = new Set(
      serialNumbers.map((sn) => sn.warehouse?.name).filter(Boolean)
    ).size;
    return { total, inWarranty, expired, warehouses: warehousesCount };
  }, [serialNumbers]);

  // ---------- Table columns ----------
  const columns: ColumnDef<SerialNumber>[] = [
    {
      key: "serial",
      label: "Serial Number",
      sortable: true,
      headerClassName: "w-[18%] text-left whitespace-nowrap",
      className: "w-[18%]",
      render: (sn) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40">
            <QrCodeIcon className="h-4 w-4 text-cyan-700 dark:text-cyan-400" />
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openView(sn);
              }}
              className="block whitespace-nowrap text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
              title={sn.serial || "N/A"}
            >
              {sn.serial || "N/A"}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: "product",
      label: "Product Name",
      sortable: true,
      render: (sn) => {
        const name = getProductName(sn, products);
        return sn.productId ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToProduct(sn.productId);
            }}
            className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title="View product"
          >
            {name}
          </button>
        ) : (
          <span className="text-slate-700 dark:text-slate-300">{name}</span>
        );
      },
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      render: (sn) =>
        sn.warehouse?.id ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToWarehouse(sn.warehouse);
            }}
            className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title="View warehouse"
          >
            {getWarehouseName(sn)}
          </button>
        ) : (
          <span className="text-slate-700 dark:text-slate-300">{getWarehouseName(sn)}</span>
        ),
    },
    {
      // ✅ Batch is now clickable → /batch?batchId=...&batchName=...
      key: "batch",
      label: "Batch",
      sortable: true,
      render: (sn) =>
        sn.batch?.id ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToBatch(sn.batch);
            }}
            className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View batch ${sn.batch.batchNumber}`}
          >
            {getBatchNumber(sn)}
          </button>
        ) : (
          <span className="text-slate-700 dark:text-slate-300">{getBatchNumber(sn)}</span>
        ),
    },
    {
      key: "currentStatus",
      label: "Current Status",
      sortable: true,
      render: (sn) => {
        const status = sn.currentStatus;
        if (!status) {
          return <span className="text-xs text-slate-400 dark:text-slate-500">N/A</span>;
        }
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
              status
            )}`}
          >
            {status}
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
      render: (sn) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(sn)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="View"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          {canUpdate && (<button
            type="button"
            onClick={() => openEdit(sn)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>)}
          {canDelete && (<button
            type="button"
            onClick={() => setDeletingSerial(sn)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Serial Numbers" description="Manage inventory serial numbers" />
      <PageBreadcrumb
        pageTitle="Serial Numbers"
        actions={<AddButton onClick={openCreate} label="Add Serial Number" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard label="Serial Numbers" value={stats.total} icon={<QrCodeIcon />} />
          <StatsCard
            label="In Warranty"
            value={stats.inWarranty}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Expired"
            value={stats.expired}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<XCircleIcon />}
          />
          <StatsCard
            label="Warehouses"
            value={stats.warehouses}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BuildingStorefrontIcon />}
          />
        </div>

        <ReusableTable
          data={serialNumbers}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="serial"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <QrCodeIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                No serial numbers found
              </p>
              {canCreate && (<button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Create your first serial number
              </button>)}
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Serial Number" : "Create Serial Number"}
        subtitle="Enter serial number details including current status"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Serial Number" : "Create Serial Number"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Details",
            fields: [
              <FloatingSelect
                key="productId"
                label="Product Name"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                options={products
                  // Serial numbers only exist for products with serial tracking.
                  // When editing, keep the serial's current product listed.
                  .filter((p) => p.serialTracking !== false || String(p.id) === form.productId)
                  .map((product) => ({
                    id: String(product.id),
                    name: product.productName,
                  }))}
                required
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                options={warehouses
                  .filter((w) => w.active !== false || String(w.id) === form.warehouseId)
                  .map((warehouse) => ({
                    id: String(warehouse.id),
                    name: warehouse.name,
                  }))}
                required
              />,
              <FloatingSelect
                key="batchId"
                label="Batch"
                name="batchId"
                value={form.batchId}
                onChange={handleChange}
                options={batchOptions}
                disabled={!form.productId || !form.warehouseId}
                required
              />,
              form.productId && form.warehouseId && batchOptions.length === 0 ? (
                <p key="no-batch" className="text-xs text-amber-600 dark:text-amber-400">
                  No batch of this product in this warehouse. Create the batch first on the
                  Batches page.
                </p>
              ) : null,
            ].filter(Boolean),
          },
          {
            label: "Status",
            fields: [
              <FloatingSelect
                key="currentStatus"
                label="Current Status"
                name="currentStatus"
                value={form.currentStatus}
                onChange={handleChange}
                options={statusOptions}
                required
              />,
            ],
          },
          {
            label: "Warranty",
            fields: [
              <FloatingInput
                key="warrantyStart"
                label="Warranty Start"
                name="warrantyStart"
                type="date"
                value={form.warrantyStart}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="warrantyEnd"
                label="Warranty End"
                name="warrantyEnd"
                type="date"
                value={form.warrantyEnd}
                onChange={handleChange}
                required
              />,
            ],
          },
        ]}
      />

      {/* Detail view — read-only, so it only has a Close button */}
      {viewingSerial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeView}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="serial-view-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <h2
                  id="serial-view-title"
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                >
                  Serial Number Details
                </h2>
                {viewingSerial.serial && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Serial {viewingSerial.serial}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeView}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-6 py-4 text-sm">
              {viewLoading && (
                <div className="text-xs text-slate-400 dark:text-slate-500">
                  Refreshing latest details…
                </div>
              )}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <CubeIcon className="h-4 w-4" /> Product
                    </span>
                    {viewingSerial.productId ? (
                      <button
                        type="button"
                        onClick={() => {
                          closeView();
                          goToProduct(viewingSerial.productId);
                        }}
                        className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                      >
                        {getProductName(viewingSerial, products)}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {getProductName(viewingSerial, products)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <BuildingStorefrontIcon className="h-4 w-4" /> Warehouse
                    </span>
                    {viewingSerial.warehouse?.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          closeView();
                          goToWarehouse(viewingSerial.warehouse);
                        }}
                        className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                      >
                        {getWarehouseName(viewingSerial)}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {getWarehouseName(viewingSerial)}
                      </span>
                    )}
                  </div>

                  {/* NEW: Batch clickable in the view modal too */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Batch</span>
                    {viewingSerial.batch?.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          closeView();
                          goToBatch(viewingSerial.batch);
                        }}
                        className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
                      >
                        {getBatchNumber(viewingSerial)}
                      </button>
                    ) : (
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {getBatchNumber(viewingSerial)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Current Status</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {viewingSerial.currentStatus || "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Inspections</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {getInspections(viewingSerial, inspectionsBySerial)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Product Number</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {viewingSerial.productNumber || "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Warranty Start</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(viewingSerial.warrantyStart)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Warranty End</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(viewingSerial.warrantyEnd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Purchase Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatDate(viewingSerial.purchaseDate)}
                    </span>
                  </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={closeView}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <DynamicPopup
        isPopupOpen={!!deletingSerial}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingSerial(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-100 dark:bg-red-950/40"
        innerText="Delete Serial Number"
        subText={
          deletingSerial
            ? `Are you sure you want to delete serial number "${
                deletingSerial.serial || "this serial number"
              }"? This action cannot be undone.`
            : "Are you sure you want to delete this serial number?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingSerial(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default SerialNumberManager;