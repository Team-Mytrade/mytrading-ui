import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

/**
 * =====================================================================================
 * CORRECTIONS MADE — checked against the confirmed batches-controller Swagger
 * (GET /batches, GET /batches/{id}, POST /batches, PUT /batches/{id}, DELETE /batches/{id}):
 *
 * 1. `supplierName` DOES NOT EXIST on the Batch entity in any confirmed schema
 *    (GET, POST, or PUT). The previous code sent it in the payload anyway (where
 *    it has nowhere to be stored) AND displayed a completely FAKE hardcoded
 *    value for it (STATIC_BATCH_DATA_MAP had 3 made-up supplier names, and
 *    every other batch silently showed "Default Supplier" as if it were real
 *    data). That's actively misleading — removed the fake map entirely.
 *    Supplier is now handled as a LOCAL-ONLY field (same pattern used for
 *    Stock Level thresholds and Warehouse status): stored in localStorage per
 *    batch id, clearly labeled in the UI as not yet saved to the server, and
 *    never sent in the POST/PUT payload. Ask backend to add a real
 *    `supplierName` column if this needs to be tracked properly.
 *
 * 2. `batchNumber` was being OMITTED from the PUT payload, based on an
 *    assumption that the backend "keeps it as-is" on update. But the PUT
 *    schema is the FULL entity shape (same as POST) — if the backend does a
 *    normal save() of the deserialized body (the pattern seen everywhere else
 *    in this API), omitting batchNumber would send it as undefined and could
 *    NULL IT OUT on every single edit. Fixed: batchNumber is now carried
 *    through in the edit form (read-only, not user-editable) and always
 *    included in the update payload so it round-trips safely. On CREATE it's
 *    still omitted, since batch numbers are commonly server-generated on
 *    insert — but this assumption should be confirmed with backend; if wrong,
 *    creation may fail or produce a blank batch number.
 *
 * 3. `DELETE .../{id}?cascade=true` — the confirmed Swagger shows DELETE with
 *    NO query parameters at all. Removed the unconfirmed `cascade=true` param.
 *    If cascading delete behavior is actually needed, ask backend whether it's
 *    automatic, or whether a real supported param/endpoint exists for it.
 *
 * 4. `createdBy` / `tenantId` are required by the schema but were never sent —
 *    added static placeholders (replace with real auth/session values).
 *
 * ⚠️ STILL NEEDS BACKEND CONFIRMATION:
 *   - Is `batchNumber` really server-generated on create, or does POST require
 *     it? Nothing in the schema confirms auto-generation either way.
 *
 * ✅ CONFIRMED (previously flagged as unverified, now checked against a real
 *    response): `/v1/api/inventory/batches/stock-details` is a real endpoint.
 *    It returns a flat array of { batchId, batchNumber, warehouseId,
 *    productId, quantity, reserved, available } — confirmed necessary because
 *    the Batch entity itself (GET /batches/{id}) carries NO quantity/reserved/
 *    available fields at all. A `null` quantity/reserved/available for a given
 *    batch is expected and means no stock movement/adjustment has been
 *    recorded for that batch yet — not a bug, just genuinely no data.
 * =====================================================================================
 */

// ============ TYPES ============
type Batch = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  productId: number;
  warehouse: any;
  inspections: any[];
  quantity?: number;
  reserved?: number;
  available?: number;
  // Local-only display field — NOT part of the real backend schema. See note above.
  supplierName?: string;
  fifoPriority?: number;
  fefoPriority?: number;
  daysUntilExpiry?: number;
};

// batchNumber carried through for edit (read-only, needed to avoid nulling it
// out on PUT) but never shown as an editable input.
type BatchForm = {
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  productId: string;
  warehouse: string;
  supplierName: string;
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

// ============ CONSTANTS ============
const API_URL = "/v1/api/inventory/batches";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/purchase/products";
// Confirmed real endpoint (see note at top of file) — returns a flat array of
// { batchId, batchNumber, warehouseId, productId, quantity, reserved, available }.
// A batch's quantity/reserved/available live ONLY here, never on the Batch
// entity itself.
const BATCH_STOCK_API_URL = "/v1/api/inventory/batches/stock-details";
const PAGE_SIZE = 10;

const PRODUCT_ROUTE = "/purchase-products";
const WAREHOUSE_ROUTE = "/warehouse";
const BATCH_ROUTE = "/batch";

// TODO: replace with real values pulled from your auth/session context.
const STATIC_CREATED_BY = "system-admin";
const STATIC_TENANT_ID = "tenant-001";

const SUPPLIER_STORAGE_KEY = "batchSupplierNames";

const FALLBACK_STATUS = ["GOOD", "EXPIRING_SOON", "EXPIRED", "EMPTY"];

const emptyForm: BatchForm = {
  batchNumber: "",
  manufacturingDate: new Date().toISOString().split("T")[0],
  expiryDate: "",
  productId: "",
  warehouse: "",
  supplierName: "",
};

// ============ HELPERS ============
const toNumber = (v: any) => Number(v || 0);

const getErrorMessage = (error: any, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
};

const normalizeProductLabel = (product: ProductOption) => {
  const code = product.productCode || product.code || product.sku;
  const name = product.productName || product.name || `Product #${product.id}`;
  return code ? `${name} (${code})` : name;
};

const getDaysUntilExpiry = (batch: Batch) => {
  const diff = new Date(batch.expiryDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const getWarehouseDisplay = (batch: Batch) => {
  if (typeof batch.warehouse === "object" && batch.warehouse !== null) {
    return batch.warehouse.name || batch.warehouse.code || `ID: ${batch.warehouse.id}`;
  }
  return batch.warehouse || "";
};

const getBatchStatus = (batch: Batch) => {
  if ((batch.quantity || 0) <= 0) {
    return {
      label: "Empty",
      className:
        "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      icon: <XCircleIcon className="h-3.5 w-3.5" />,
    };
  }
  const days = getDaysUntilExpiry(batch);
  if (days < 0) {
    return {
      label: "Expired",
      className:
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800",
      icon: <XCircleIcon className="h-3.5 w-3.5" />,
    };
  }
  if (days <= 30) {
    return {
      label: "Expiring Soon",
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
      icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: "Good",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    icon: <CheckCircleIcon className="h-3.5 w-3.5" />,
  };
};

const getFIFORank = (batches: Batch[], batch: Batch) => {
  const sorted = [...batches]
    .filter((b) => (b.quantity || 0) > 0)
    .sort(
      (a, b) =>
        new Date(a.manufacturingDate).getTime() - new Date(b.manufacturingDate).getTime()
    );
  return sorted.findIndex((b) => b.id === batch.id) + 1;
};

const getFEFORank = (batches: Batch[], batch: Batch) => {
  const sorted = [...batches]
    .filter((b) => (b.quantity || 0) > 0)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  return sorted.findIndex((b) => b.id === batch.id) + 1;
};

// ---------- Local-only supplier storage (backend has no supplierName field) ----------
function loadSupplierMap(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(SUPPLIER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSupplierName(id: number, name: string) {
  const all = loadSupplierMap();
  if (name?.trim()) {
    all[id] = name.trim();
  } else {
    delete all[id];
  }
  try {
    localStorage.setItem(SUPPLIER_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage can throw in private/incognito modes — fail silently.
  }
}

function getLocalSupplierName(id: number): string {
  return loadSupplierMap()[id] || "";
}

// ============ COMPONENT ============
const BatchManagement: React.FC = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const filterBatchId = searchParams.get("batchId");
  const filterBatchName = searchParams.get("batchName") || "";
  const isBatchScoped = Boolean(filterBatchId);

  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;

  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteBatch, setDeleteBatch] = useState<Batch | null>(null);

  useEffect(() => {
    fetchAllBatches();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllBatches = async () => {
    try {
      setLoading(true);

      const [batchRes, stockDetailsRes] = await Promise.all([
        axios.get<Batch[]>(API_URL, { headers }),
        axios.get(BATCH_STOCK_API_URL, { headers }).catch(() => ({ data: [] })),
      ]);

      const batchData = Array.isArray(batchRes.data) ? batchRes.data : [];
      const stockDetails = Array.isArray(stockDetailsRes.data) ? stockDetailsRes.data : [];

      const stockMap = new Map();
      stockDetails.forEach((item: any) => {
        stockMap.set(item.batchId, {
          quantity: item.quantity ?? 0,
          reserved: item.reserved ?? 0,
          available: item.available ?? 0,
        });
      });

      const enrichedData = batchData.map((batch) => {
        const stock = stockMap.get(batch.id) || {};

        return {
          ...batch,
          quantity: stock.quantity || 0,
          reserved: stock.reserved || 0,
          available: stock.available || 0,
          // CORRECTED: real local-only value (or blank), never a fake
          // hardcoded "Default Supplier".
          supplierName: getLocalSupplierName(batch.id),
          daysUntilExpiry: getDaysUntilExpiry(batch),
          fifoPriority: 0,
          fefoPriority: 0,
        };
      });

      const withRanks = enrichedData.map((b) => ({
        ...b,
        fifoPriority: getFIFORank(enrichedData, b),
        fefoPriority: getFEFORank(enrichedData, b),
      }));

      setBatches(withRanks);
    } catch (error) {
      console.error("Failed to fetch batches:", error);
      setBatches([]);
      ToasterService.error("Failed to load batches", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    try {
      const [wRes, pRes] = await Promise.all([
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
        axios.get<ProductOption[]>(PRODUCT_API_URL, { headers }),
      ]);
      setWarehouses(Array.isArray(wRes.data) ? wRes.data : []);
      setProducts(Array.isArray(pRes.data) ? pRes.data : []);
    } catch (error) {
      ToasterService.error("Failed to load dropdown data", getErrorMessage(error, "Please try again."));
    }
  };

  const openCreate = () => {
    setEditingId(null);
    // batchNumber intentionally left blank — assumed server-generated on
    // create. CONFIRM with backend; if POST actually requires it, this needs
    // a real input added back.
    setForm({ ...emptyForm, manufacturingDate: new Date().toISOString().split("T")[0] });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openEdit = (batch: Batch) => {
    setEditingId(batch.id);
    setForm({
      // CORRECTED: batchNumber is carried through (read-only) so it can be
      // sent back on update and never gets nulled out.
      batchNumber: batch.batchNumber || "",
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      productId: String(batch.productId),
      warehouse:
        typeof batch.warehouse === "object"
          ? String(batch.warehouse?.id || "")
          : String(batch.warehouse || ""),
      supplierName: getLocalSupplierName(batch.id),
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    const selectedWarehouse = warehouses.find((w) => String(w.id) === form.warehouse);

    const payload: any = {
      createdBy: STATIC_CREATED_BY,
      tenantId: STATIC_TENANT_ID,
      manufacturingDate: form.manufacturingDate,
      expiryDate: form.expiryDate,
      productId: toNumber(form.productId),
      warehouse: selectedWarehouse ? { id: selectedWarehouse.id } : null,
    };

    // CORRECTED: batchNumber is only meaningful (and only known) once editing
    // an existing batch — included here so PUT doesn't null it out. Left out
    // entirely on create, since it's assumed server-generated there.
    if (editingId) {
      payload.id = editingId;
      payload.batchNumber = form.batchNumber;
    }

    // NOTE: supplierName is deliberately NOT sent — the backend schema has no
    // field for it. Saved locally instead via saveSupplierName() after a
    // successful save. See note at top of file.

    return payload;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      !form.manufacturingDate ||
      !form.expiryDate ||
      !form.productId ||
      !form.warehouse
    ) {
      ToasterService.error("All fields are required");
      return;
    }
    if (new Date(form.expiryDate) <= new Date(form.manufacturingDate)) {
      ToasterService.error("Expiry date must be after manufacturing date");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();

      let response: { data: Batch };

      if (editingId) {
        response = await axios.put<Batch>(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Batch updated successfully");

        // Persist supplier locally (see note at top of file).
        saveSupplierName(editingId, form.supplierName);

        setBatches((prev) => {
          return prev.map((batch) => {
            if (batch.id === editingId) {
              return {
                ...response.data,
                quantity: batch.quantity || 0,
                reserved: batch.reserved || 0,
                available: batch.available || 0,
                supplierName: getLocalSupplierName(editingId),
                daysUntilExpiry: getDaysUntilExpiry(response.data),
                fifoPriority: 0,
                fefoPriority: 0,
              };
            }
            return batch;
          });
        });

        setBatches((prev) => {
          return prev.map((b) => ({
            ...b,
            fifoPriority: getFIFORank(prev, b),
            fefoPriority: getFEFORank(prev, b),
          }));
        });

        closeForm();
        await fetchAllBatches();
      } else {
        response = await axios.post<Batch>(API_URL, payload, { headers });
        ToasterService.success("Batch created successfully");

        // Persist supplier locally against the newly created batch's real id.
        if (response.data?.id) {
          saveSupplierName(response.data.id, form.supplierName);
        }

        const newBatch = {
          ...response.data,
          quantity: 0,
          reserved: 0,
          available: 0,
          supplierName: response.data?.id ? getLocalSupplierName(response.data.id) : "",
          daysUntilExpiry: getDaysUntilExpiry(response.data),
          fifoPriority: 0,
          fefoPriority: 0,
        };

        setBatches((prev) => {
          const updated = [newBatch, ...prev];
          return updated.map((b) => ({
            ...b,
            fifoPriority: getFIFORank(updated, b),
            fefoPriority: getFEFORank(updated, b),
          }));
        });

        closeForm();
        await fetchAllBatches();
      }
    } catch (error) {
      console.error(" Error:", error);
      ToasterService.error("Failed to save batch", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteBatch?.id) return;
    try {
      // CORRECTED: removed unconfirmed `?cascade=true` — the confirmed
      // Swagger shows DELETE /{id} with no query parameters at all.
      await axios.delete(`${API_URL}/${deleteBatch.id}`, { headers });
      ToasterService.success("Batch deleted successfully");
      setDeleteBatch(null);
      await fetchAllBatches();
    } catch (error) {
      ToasterService.error("Failed to delete batch", getErrorMessage(error, "Please try again."));
    }
  };

  const goToProduct = (productId?: number) => {
    if (!productId) return;
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, { state: { productId } });
  };

  const goToWarehouse = (warehouseId?: number, warehouseName?: string) => {
    if (!warehouseId) return;
    navigate(
      `${WAREHOUSE_ROUTE}?warehouseId=${warehouseId}&warehouseName=${encodeURIComponent(
        warehouseName || ""
      )}`
    );
  };

  const scopedBatches = useMemo(
    () =>
      isBatchScoped
        ? batches.filter((b) => String(b.id) === String(filterBatchId))
        : batches,
    [batches, isBatchScoped, filterBatchId]
  );

  const stats = useMemo(() => {
    return {
      total: scopedBatches.length,
      expired: scopedBatches.filter((b) => getDaysUntilExpiry(b) < 0).length,
      expiringSoon: scopedBatches.filter(
        (b) => getDaysUntilExpiry(b) >= 0 && getDaysUntilExpiry(b) <= 30
      ).length,
      totalQuantity: scopedBatches.reduce((s, b) => s + (b.quantity || 0), 0),
      totalReserved: scopedBatches.reduce((s, b) => s + (b.reserved || 0), 0),
      totalAvailable: scopedBatches.reduce((s, b) => s + (b.available || 0), 0),
      emptyBatches: scopedBatches.filter((b) => (b.quantity || 0) <= 0).length,
    };
  }, [scopedBatches]);

  // ---------- Row details ----------
  const renderBatchDetails = (batch: Batch) => {
    const product = products.find(
      (p) => p.id === batch.productId || p.productId === batch.productId
    );
    const productLabel = product
      ? normalizeProductLabel(product)
      : `Product #${batch.productId}`;

    const warehouseName = getWarehouseDisplay(batch);
    const warehouseId =
      typeof batch.warehouse === "object" && batch.warehouse !== null
        ? Number(batch.warehouse.id)
        : warehouses.find(
            (w) =>
              String(w.id) === String(batch.warehouse) ||
              w.name === batch.warehouse ||
              w.code === batch.warehouse
          )?.id;

    const days = getDaysUntilExpiry(batch);
    const statusInfo = getBatchStatus(batch);

    const createdAt = batch.createdDate
      ? new Date(batch.createdDate).toLocaleString()
      : "--";
    const updatedAt = batch.updatedDate
      ? new Date(batch.updatedDate).toLocaleString()
      : "--";

    const Field = ({
      label,
      children,
      full,
    }: {
      label: string;
      children: React.ReactNode;
      full?: boolean;
    }) => (
      <div
        className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 ${
          full ? "col-span-2" : ""
        }`}
      >
        <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
          {children}
        </div>
      </div>
    );

    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="Batch Number" full>
          {batch.batchNumber || "--"}
        </Field>

        <Field label="Product" full>
          {batch.productId ? (
            <button
              type="button"
              onClick={() => goToProduct(batch.productId)}
              className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              {productLabel}
            </button>
          ) : (
            <span>{productLabel}</span>
          )}
          {product?.categoryName && (
            <div className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
              Category: {product.categoryName}
            </div>
          )}
        </Field>

        <Field label="Warehouse">
          {warehouseId ? (
            <button
              type="button"
              onClick={() => goToWarehouse(warehouseId, warehouseName)}
              className="text-left text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              {warehouseName || "--"}
            </button>
          ) : (
            <span>{warehouseName || "--"}</span>
          )}
        </Field>
        <Field label="Supplier">
          {batch.supplierName || "--"}
          <div className="mt-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
            stored locally, not on server
          </div>
        </Field>

        <Field label="MFG Date">
          {batch.manufacturingDate
            ? new Date(batch.manufacturingDate).toLocaleDateString()
            : "--"}
        </Field>
        <Field label="Expiry Date">
          <span
            className={
              days < 0
                ? "text-red-600 dark:text-red-400"
                : days <= 30
                ? "text-amber-600 dark:text-amber-400"
                : ""
            }
          >
            {batch.expiryDate
              ? new Date(batch.expiryDate).toLocaleDateString()
              : "--"}
          </span>
          {days >= 0 && (
            <div className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
              {days} days left
            </div>
          )}
          {days < 0 && (
            <div className="mt-0.5 text-xs font-normal text-red-600 dark:text-red-400">
              Expired {Math.abs(days)} days ago
            </div>
          )}
        </Field>

        <Field label="Status" full>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.className}`}
          >
            {statusInfo.icon}
            {statusInfo.label}
          </span>
        </Field>

        <Field label="Quantity">{batch.quantity ?? 0}</Field>
        <Field label="Reserved">
          <span className="text-orange-600 dark:text-orange-400">
            {batch.reserved ?? 0}
          </span>
        </Field>

        <Field label="Available">
          <span className="text-emerald-600 dark:text-emerald-400">
            {batch.available ?? 0}
          </span>
        </Field>
        <Field label="FIFO / FEFO Rank">
          #{batch.fifoPriority || "-"} / #{batch.fefoPriority || "-"}
        </Field>

        <Field label="Created At">{createdAt}</Field>
        <Field label="Updated At">{updatedAt}</Field>
      </div>
    );
  };

  // ---------- Columns ----------
  const columns: ColumnDef<Batch>[] = [
    {
      key: "batchNumber",
      label: "Batch Number",
      sortable: true,
      render: (batch) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-100 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40">
            <CubeIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {batch.batchNumber}
          </p>
        </div>
      ),
    },
    {
      key: "productId",
      label: "Product",
      sortable: true,
      render: (batch) => {
        const p = products.find(
          (p) => p.id === batch.productId || p.productId === batch.productId
        );
        const label = p ? normalizeProductLabel(p) : `Product #${batch.productId}`;
        if (!batch.productId) {
          return (
            <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
          );
        }
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToProduct(batch.productId);
            }}
            className="max-w-[220px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${label}`}
          >
            {label}
          </button>
        );
      },
    },
    {
      key: "manufacturingDate",
      label: "MFG Date",
      sortable: true,
      render: (batch) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {batch.manufacturingDate ? new Date(batch.manufacturingDate).toLocaleDateString() : "--"}
        </span>
      ),
    },
    {
      key: "expiryDate",
      label: "Expiry Date",
      sortable: true,
      render: (batch) => {
        const days = getDaysUntilExpiry(batch);
        return (
          <div>
            <span
              className={`text-sm ${
                days < 0
                  ? "text-red-600 dark:text-red-400"
                  : days <= 30
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "--"}
            </span>
            {days >= 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">{days} days left</p>
            )}
          </div>
        );
      },
    },
    {
      key: "supplierName",
      label: "Supplier",
      sortable: true,
      render: (batch) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {batch.supplierName || "--"}
        </span>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      render: (batch) => {
        const name = getWarehouseDisplay(batch);
        const warehouseId =
          typeof batch.warehouse === "object" && batch.warehouse !== null
            ? Number(batch.warehouse.id)
            : warehouses.find(
                (warehouse) =>
                  String(warehouse.id) === String(batch.warehouse) ||
                  warehouse.name === batch.warehouse ||
                  warehouse.code === batch.warehouse
              )?.id;
        return warehouseId ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              goToWarehouse(warehouseId, name);
            }}
            className="max-w-[210px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-300">{name || "--"}</span>
        );
      },
    },
    {
      key: "quantity",
      label: "Quantity",
      sortable: true,
      render: (batch) => (
        <div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            {batch.quantity || 0}
          </span>
          {batch.reserved ? (
            <p className="text-xs text-orange-500 dark:text-orange-400">
              Reserved: {batch.reserved}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (batch) => {
        const s = getBatchStatus(batch);
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
          >
            {s.icon}
            {s.label}
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
      render: (batch) => (
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => openEdit(batch)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteBatch(batch)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
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
      <PageMeta title="Batch Management" description="Manage product batches" />
      <PageBreadcrumb
        pageTitle="Batch Management"
        actions={<AddButton onClick={openCreate} label="Add Batch" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        {isBatchScoped && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>
                Showing batch:{" "}
                <strong>{filterBatchName || `#${filterBatchId}`}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate(BATCH_ROUTE)}
              className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              View all batches
            </button>
          </div>
        )}

        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatsCard
            label="Total Batches"
            value={stats.total}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<CubeIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Total Qty"
            value={stats.totalQuantity}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<CubeIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Reserved"
            value={stats.totalReserved}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<ClockIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Available"
            value={stats.totalAvailable}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Expired"
            value={stats.expired}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<XCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Empty"
            value={stats.emptyBatches}
            gradient="from-gray-50 to-slate-50"
            borderColor="border-gray-100"
            labelColor="text-gray-600"
            icon={<XCircleIcon className="h-5 w-5" />}
          />
        </div>

        <ReusableTable
          data={scopedBatches}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="expiryDate"
          defaultSortOrder="asc"
          enableRowDetails={true}
          rowDetailsTitle="Batch Details"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                {isBatchScoped
                  ? `No batch matches "${filterBatchName || `#${filterBatchId}`}"`
                  : "No batches found"}
              </p>
              {isBatchScoped ? (
                <button
                  type="button"
                  onClick={() => navigate(BATCH_ROUTE)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  View all batches →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fetchAllBatches()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  Reload all batches
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Batch" : "Create Batch"}
        subtitle={
          editingId
            ? "Update batch details"
            : "Enter batch details — the batch number is generated automatically"
        }
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Batch" : "Create Batch"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Batch Info",
            fields: [
              <FloatingDatePicker
                key="manufacturingDate"
                label="Manufacturing Date"
                name="manufacturingDate"
                value={form.manufacturingDate}
                onChange={handleChange}
                required
              />,
              <FloatingDatePicker
                key="expiryDate"
                label="Expiry Date"
                name="expiryDate"
                value={form.expiryDate}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="productId"
                label="Select product"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                // emptyOptionLabel="Select product"
                options={products.map((p) => ({
                  id: String(p.id || p.productId || 0),
                  name: normalizeProductLabel(p),
                }))}
                required
              />,
              <FloatingSelect
                key="warehouse"
                label="Select warehouse"
                name="warehouse"
                value={form.warehouse}
                onChange={handleChange}
                // emptyOptionLabel="Select warehouse"
                options={warehouses.map((w) => ({
                  id: String(w.id),
                  name: `${w.code || ""} - ${w.name || ""}`,
                }))}
                required
              />,
              <FloatingInput
                key="supplierName"
                label="Supplier Name"
                name="supplierName"
                value={form.supplierName}
                onChange={handleChange}
              />,
              <p
                key="supplier-hint"
                className="md:col-span-2 text-xs text-amber-600 dark:text-amber-400"
              >
                ⚠ Supplier is currently stored locally in this browser only —
                the backend does not yet have a field to persist it server-side.
              </p>,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteBatch}
        setIsPopupOpen={(open) => !open && setDeleteBatch(null)}
        icon={<TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-100 dark:bg-red-950/40"
        innerText="Delete Batch"
        subText={
          deleteBatch
            ? `Are you sure you want to delete batch "${deleteBatch.batchNumber}"?`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteBatch(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default BatchManagement;