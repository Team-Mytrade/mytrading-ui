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
  PencilSquareIcon,
  TrashIcon,
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
 * WHAT CHANGED IN THIS VERSION (in plain terms):
 *
 * 1. "From Location" and "To Location" used to be free-text boxes where you could
 *    type anything (e.g. "ch", "tvm"). If what you typed didn't match a real
 *    warehouse, the backend crashed with "No value present". They are now
 *    WAREHOUSE DROPDOWNS instead — showing "Name (CODE) — LOCATION_TYPE" — so you
 *    can only pick a warehouse that actually exists.
 *
 * 2. Both dropdowns are filtered to only show warehouses where the SELECTED
 *    PRODUCT actually has a Stock Level record. This is built from the real
 *    Stock Levels data (productId + warehouse.id pairs), not guessed. If a
 *    product has no stock level at any warehouse yet, both dropdowns fall back
 *    to showing every warehouse (with a warning note) so the form isn't
 *    completely unusable — but you should create a stock level first.
 *
 * 3. The separate "Warehouse" field (which duplicated what From/To Location
 *    should already tell you) has been REMOVED. To Warehouse is now sent as the
 *    payload's single `warehouse` field, since that's the warehouse actually
 *    receiving/holding the stock after the movement. FLAG FOR BACKEND: confirm
 *    this assumption — if `warehouse` on a movement is meant to represent the
 *    SOURCE warehouse instead, this needs to send fromWarehouseId there instead.
 *
 * 4. fromLocation/toLocation are sent to the backend as the selected warehouse's
 *    `code` (falling back to `name` if no code exists) — plain strings, matching
 *    the schema's existing fromLocation/toLocation string fields. No backend
 *    schema change is required for this version.
 * =====================================================================================
 */

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
  locationType?: string;
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

// Only the fields we actually need from a StockLevel record for this page.
type StockLevel = {
  id: number;
  productId?: number;
  warehouse?: Warehouse | string;
  quantity?: number;
  reserved?: number;
  available?: number;
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
  fromWarehouseId: string;
  toWarehouseId: string;
  reference: string;
  productId: string;
  batchId: string;
  serialNumberId: string;
};

const API_URL = "/v1/api/inventory/stock-movements";
const ENUMS_API_URL = "/v1/api/inventory/enums";
const PRODUCTS_API_URL = "/v1/api/purchase/products";
const WAREHOUSES_API_URL = "/v1/api/inventory/warehouses";
const BATCHES_API_URL = "/v1/api/inventory/batches";
const SERIALS_API_URL = "/v1/api/inventory/serial-numbers";
const STOCK_LEVELS_API_URL = "/v1/api/inventory/stock-levels";
const PAGE_SIZE = 10;
const MOVEMENT_TYPE_ENUM = "MOVEMENT_TYPE";

const PRODUCT_ROUTE = "/purchase-products";

const emptyForm: MovementForm = {
  movementDate: new Date().toISOString().split("T")[0],
  movementType: "",
  quantity: "",
  fromWarehouseId: "",
  toWarehouseId: "",
  reference: "",
  productId: "",
  batchId: "",
  serialNumberId: "",
};

// Deterministic color per movement type string, so badges stay visually distinct
// without needing to know the type set in advance.
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

function getProductName(product?: Product | null): string {
  if (!product) return "";
  return product.productName || product.name || "";
}

// NOTE: the backend often returns warehouse/batch/serialNumber as a nested
// object with ONLY `id` populated (code/name/batchNumber/serial all null) —
// it doesn't fully hydrate the related entity in the movement response. So
// these resolvers always fall back to looking the id up in the already-fetched
// full list (warehouses/batches/serialNumbers), the same pattern already used
// for product display, rather than trusting the nested object's own fields.
function getWarehouseValue(
  warehouse?: Warehouse | string | null,
  warehouses: Warehouse[] = []
) {
  if (!warehouse) return "";
  if (typeof warehouse === "string") return warehouse;
  if (warehouse.code || warehouse.name) return warehouse.code || warehouse.name || "";
  const match = warehouses.find((w) => w.id === warehouse.id);
  if (match) return match.code || match.name || String(match.id);
  return warehouse.id != null ? `Warehouse #${warehouse.id}` : "";
}

function getBatchValue(
  batch?: Batch | string | null,
  batches: Batch[] = []
) {
  if (!batch) return "";
  if (typeof batch === "string") return batch;
  if (batch.batchNumber) return batch.batchNumber;
  const match = batches.find((b) => b.id === batch.id);
  if (match) return match.batchNumber || `Batch #${match.id}`;
  return batch.id != null ? `Batch #${batch.id}` : "";
}

function getSerialValue(
  serialNumber?: SerialNumber | string | null,
  serialNumbers: SerialNumber[] = []
) {
  if (!serialNumber) return "";
  if (typeof serialNumber === "string") return serialNumber;
  if (serialNumber.serial) return serialNumber.serial;
  const match = serialNumbers.find((s) => s.id === serialNumber.id);
  if (match) return match.serial || `Serial #${match.id}`;
  return serialNumber.id != null ? `Serial #${serialNumber.id}` : "";
}

// Resolves a Warehouse | string field down to a numeric warehouse id (as a
// string), used to reverse-map a movement's existing warehouse/from/to data
// back into a dropdown selection when editing.
function resolveWarehouseId(
  value: Warehouse | string | null | undefined,
  warehouses: Warehouse[]
): string {
  if (!value) return "";
  if (typeof value !== "string") return value.id != null ? String(value.id) : "";
  const match = warehouses.find((w) => w.code === value || w.name === value);
  return match?.id != null ? String(match.id) : "";
}

function getBatchId(batch: Batch | string | null | undefined, batches: Batch[]) {
  if (!batch) return "";
  if (typeof batch !== "string") return batch.id != null ? String(batch.id) : "";
  const match = batches.find((item) => item.batchNumber === batch);
  return match?.id != null ? String(match.id) : "";
}

function getSerialId(
  serialNumber: SerialNumber | string | null | undefined,
  serialNumbers: SerialNumber[]
) {
  if (!serialNumber) return "";
  if (typeof serialNumber !== "string")
    return serialNumber.id != null ? String(serialNumber.id) : "";
  const match = serialNumbers.find((item) => item.serial === serialNumber);
  return match?.id != null ? String(match.id) : "";
}

// ======================== HELPER: ENUM NORMALIZATION ========================
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

function getMovementTypeLabel(type: string | undefined | null, options: EnumOption[]) {
  if (!type) return "-";
  const match = options.find((option) => option.id === type);
  return match?.name || type;
}

// ======================== MAIN COMPONENT ========================
const StockMovementsManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;
  const navigate = useNavigate();

  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [movementTypeOptions, setMovementTypeOptions] = useState<EnumOption[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);
  const [form, setForm] = useState<MovementForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      const data = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.content || (res.data as any)?.data || [];
      setStockMovements(data);
      if (data.length === 0) ToasterService.noData("No stock movements found");
    } catch (error) {
      ToasterService.error(
        "Failed to load stock movements",
        getErrorMessage(error, "Please try again.")
      );
      setStockMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [productsRes, warehousesRes, batchesRes, serialsRes, stockLevelsRes] =
        await Promise.all([
          axios.get<Product[]>(PRODUCTS_API_URL, { headers }),
          axios.get<Warehouse[]>(WAREHOUSES_API_URL, { headers }),
          axios.get<Batch[]>(BATCHES_API_URL, { headers }),
          axios.get<SerialNumber[]>(SERIALS_API_URL, { headers }),
          axios.get<StockLevel[]>(STOCK_LEVELS_API_URL, { headers }),
        ]);

      setProducts(
        Array.isArray(productsRes.data)
          ? productsRes.data
          : (productsRes.data as any)?.content || (productsRes.data as any)?.data || []
      );
      setWarehouses(
        Array.isArray(warehousesRes.data)
          ? warehousesRes.data
          : (warehousesRes.data as any)?.content || (warehousesRes.data as any)?.data || []
      );
      setBatches(
        Array.isArray(batchesRes.data)
          ? batchesRes.data
          : (batchesRes.data as any)?.content || (batchesRes.data as any)?.data || []
      );
      setSerialNumbers(
        Array.isArray(serialsRes.data)
          ? serialsRes.data
          : (serialsRes.data as any)?.content || (serialsRes.data as any)?.data || []
      );
      setStockLevels(
        Array.isArray(stockLevelsRes.data)
          ? stockLevelsRes.data
          : (stockLevelsRes.data as any)?.content || (stockLevelsRes.data as any)?.data || []
      );
    } catch (error) {
      ToasterService.error(
        "Failed to load lookup data",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setLookupsLoaded(true);
    }
  };

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
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "productId" && value !== current.productId) {
        next.batchId = "";
        next.serialNumberId = "";
        next.fromWarehouseId = "";
        next.toWarehouseId = "";
      }
      return next;
    });
  };

  const buildPayload = () => {
    const fromWarehouse = warehouses.find((w) => String(w.id) === form.fromWarehouseId);
    const toWarehouse = warehouses.find((w) => String(w.id) === form.toWarehouseId);

    const payload: Record<string, unknown> = {
      movementDate: form.movementDate,
      movementType: form.movementType,
      quantity: toNumber(form.quantity),
      // Sent as the warehouse's code (falling back to name) — a real string
      // that matches an actual warehouse, instead of arbitrary typed text.
      fromLocation: fromWarehouse ? fromWarehouse.code || fromWarehouse.name || "" : "",
      toLocation: toWarehouse ? toWarehouse.code || toWarehouse.name || "" : "",
      reference: form.reference,
      productId: toNumber(form.productId),
    };

    if (editingId) {
      payload.id = editingId;
    }

    // ASSUMPTION (flag for backend): the single `warehouse` field on a
    // movement represents the destination/receiving warehouse. If this is
    // supposed to be the source warehouse instead, swap toWarehouseId for
    // fromWarehouseId here.
    if (form.toWarehouseId) {
      payload.warehouse = { id: toNumber(form.toWarehouseId) };
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
    if (!form.fromWarehouseId || !form.toWarehouseId) {
      ToasterService.error(
        "Required field missing",
        "From and to warehouse are both required."
      );
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
      ToasterService.error(
        "Failed to save stock movement",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      movementDate: new Date().toISOString().split("T")[0],
    });
    setShowFormModal(true);
  };

  const openEdit = (movement: StockMovement) => {
    if (!lookupsLoaded) {
      ToasterService.error(
        "Reference data still loading",
        "Please wait a moment for warehouses, batches, and serial numbers to finish loading, then try again."
      );
      return;
    }
    setEditingId(movement.id);
    setForm({
      movementDate: movement.movementDate || emptyForm.movementDate,
      movementType: movement.movementType || "",
      quantity: String(movement.quantity || 0),
      // Legacy data may have fromLocation/toLocation as free text that
      // doesn't match any real warehouse — resolveWarehouseId returns "" in
      // that case, so the dropdown just shows unselected rather than crashing.
      fromWarehouseId: resolveWarehouseId(movement.fromLocation, warehouses),
      toWarehouseId:
        resolveWarehouseId(movement.toLocation, warehouses) ||
        resolveWarehouseId(movement.warehouse, warehouses),
      reference: movement.reference || "",
      productId: String(movement.productId || movement.product?.id || ""),
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
      setStockMovements((current) =>
        current.filter((item) => item.id !== deletingMovement.id)
      );
    } catch (error) {
      ToasterService.error(
        "Failed to delete stock movement",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setDeletingMovement(null);
    }
  };

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const transferOptionIds = new Set(
      movementTypeOptions
        .filter((option) => /transfer/i.test(option.name) || /transfer/i.test(option.id))
        .map((option) => option.id)
    );

    return {
      total: stockMovements.length,
      totalQuantity: stockMovements.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0),
      transfers: stockMovements.filter((sm) => transferOptionIds.has(sm.movementType)).length,
      uniqueProducts: new Set(
        stockMovements.map((sm) => sm.productId || sm.product?.id).filter(Boolean)
      ).size,
    };
  }, [stockMovements, movementTypeOptions]);

  // ---------- Dropdown options ----------

  // Product IDs that actually have at least one StockLevel record.
  const productIdsWithStockLevel = useMemo(() => {
    const set = new Set<string>();
    stockLevels.forEach((level) => {
      if (level.productId != null) set.add(String(level.productId));
    });
    return set;
  }, [stockLevels]);

  const productOptions = useMemo(() => {
    const filtered = products.filter((product) => {
      const id = product.id ?? product.productId;
      return id != null && productIdsWithStockLevel.has(String(id));
    });

    const currentId = form.productId;
    const alreadyIncluded = filtered.some((p) => String(p.id ?? p.productId) === currentId);
    const extra =
      !alreadyIncluded && currentId
        ? products.filter((p) => String(p.id ?? p.productId) === currentId)
        : [];

    return [...filtered, ...extra].map((product) => {
      const id = product.id ?? product.productId;
      return {
        id: id != null ? String(id) : "",
        name: getProductName(product) || `Product #${id ?? "?"}`,
      };
    });
  }, [products, productIdsWithStockLevel, form.productId]);

  // Which warehouse IDs have a Stock Level for a given product — built from
  // real data, not guessed. Used to filter the From/To Warehouse dropdowns.
  const warehouseIdsByProduct = useMemo(() => {
    const map = new Map<string, Set<string>>();
    stockLevels.forEach((level) => {
      if (level.productId == null) return;
      const pid = String(level.productId);
      const wid = resolveWarehouseId(level.warehouse, warehouses);
      if (!wid) return;
      if (!map.has(pid)) map.set(pid, new Set());
      map.get(pid)!.add(wid);
    });
    return map;
  }, [stockLevels, warehouses]);

  // Label shows Name (CODE) — LOCATION_TYPE so the location type is visible
  // right in the dropdown, as requested.
  const formatWarehouseLabel = (warehouse: Warehouse) => {
    const namePart = warehouse.name || `Warehouse #${warehouse.id}`;
    const codePart = warehouse.code ? ` (${warehouse.code})` : "";
    const typePart = warehouse.locationType ? ` — ${warehouse.locationType}` : "";
    return `${namePart}${codePart}${typePart}`;
  };

  // Shared warehouse-dropdown builder for From/To. Filters down to warehouses
  // where the selected product has a real stock level; if the product has no
  // stock level anywhere yet, falls back to the full warehouse list (with a
  // hint shown in the form) so the form isn't a dead end.
  const buildWarehouseOptions = (selectedId: string) => {
    const productId = form.productId;
    const allowedIds = productId ? warehouseIdsByProduct.get(productId) : undefined;
    const hasRestriction = !!allowedIds && allowedIds.size > 0;

    const list = hasRestriction
      ? warehouses.filter((w) => allowedIds!.has(String(w.id)))
      : warehouses;

    const alreadyIncluded = list.some((w) => String(w.id) === selectedId);
    const extra =
      !alreadyIncluded && selectedId
        ? warehouses.filter((w) => String(w.id) === selectedId)
        : [];

    return [...list, ...extra].map((warehouse) => ({
      id: String(warehouse.id),
      name: formatWarehouseLabel(warehouse),
    }));
  };

  const fromWarehouseOptions = useMemo(
    () => buildWarehouseOptions(form.fromWarehouseId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warehouses, warehouseIdsByProduct, form.productId, form.fromWarehouseId]
  );

  const toWarehouseOptions = useMemo(
    () => buildWarehouseOptions(form.toWarehouseId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warehouses, warehouseIdsByProduct, form.productId, form.toWarehouseId]
  );

  const productHasNoStockLevelAnywhere =
    !!form.productId && !warehouseIdsByProduct.get(form.productId)?.size;

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
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${getMovementTypeBadge(
            movement.movementType
          )}`}
        >
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
                className="truncate text-left text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
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
            disabled={!lookupsLoaded}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
            title={lookupsLoaded ? "Edit" : "Loading reference data..."}
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
      <PageBreadcrumb
        pageTitle="Stock Movements"
        actions={<AddButton onClick={openCreate} label="Add Stock Movement" />}
      />

      <div className="w-full max-w-none space-y-6 px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Movements"
            value={stats.total}
            gradient="from-slate-50 to-gray-50"
            borderColor="border-slate-100"
            labelColor="text-slate-600"
            icon={<ArrowsRightLeftIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Total Quantity"
            value={stats.totalQuantity.toLocaleString()}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CubeIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Transfers"
            value={stats.transfers}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<ArrowRightIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Products Moved"
            value={stats.uniqueProducts}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<ClipboardDocumentListIcon className="h-5 w-5" />}
          />
        </div>

        <ReusableTable
          data={stockMovements}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="movementDate"
          defaultSortOrder="desc"
          onRowClick={openView}
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
        maxWidthClassName="max-w-2xl"
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
              <p key="product-hint" className="text-xs text-gray-500">
                Only products with an existing stock level are shown. To move a
                product that isn't listed here, create a stock level for it
                first on the Stock Levels page.
              </p>,
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
              <FloatingSelect
                key="fromWarehouseId"
                label="From Warehouse"
                name="fromWarehouseId"
                value={form.fromWarehouseId}
                onChange={handleChange}
                options={fromWarehouseOptions}
                required
              />,
              <FloatingSelect
                key="toWarehouseId"
                label="To Warehouse"
                name="toWarehouseId"
                value={form.toWarehouseId}
                onChange={handleChange}
                options={toWarehouseOptions}
                required
              />,
              productHasNoStockLevelAnywhere && (
                <p key="no-stock-warning" className="text-xs text-amber-600">
                  ⚠ This product has no stock level at any warehouse yet, so
                  every warehouse is shown. Creating this movement may fail —
                  set up a stock level for this product first.
                </p>
              ),
            ].filter(Boolean),
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
      <PaginatedPopup
        isOpen={showViewModal && !!viewingMovement}
        title="Movement Details"
        subtitle={viewingMovement ? `Stock movement #${viewingMovement.id}` : "Stock movement"}
        onClose={() => {
          setShowViewModal(false);
          setViewingMovement(null);
        }}
        submitting={false}
        maxWidthClassName="max-w-lg"
        tabs={[
          {
            label: "Details",
            fields: [
              viewingMovement && (
                <div key="view-content" className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
                    <div>
                      <p className="text-xs text-gray-500">Movement Date</p>
                      <p className="text-sm text-gray-700">
                        {new Date(viewingMovement.movementDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${getMovementTypeBadge(
                          viewingMovement.movementType
                        )}`}
                      >
                        {getMovementTypeLabel(viewingMovement.movementType, movementTypeOptions)}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Product</p>
                      <button
                        type="button"
                        onClick={() =>
                          goToProduct(viewingMovement.productId ?? viewingMovement.product?.id)
                        }
                        className="text-left text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                      >
                        {getProductDisplayName(viewingMovement)}
                      </button>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Quantity</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {viewingMovement.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Reference</p>
                      <p className="text-sm text-gray-700">{viewingMovement.reference || "N/A"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">From Location</p>
                      <p className="text-sm text-gray-700">
                        {viewingMovement.fromLocation || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">To Location</p>
                      <p className="text-sm text-gray-700">{viewingMovement.toLocation || "N/A"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">Warehouse</p>
                      <p className="text-sm text-gray-700">
                        {getWarehouseValue(viewingMovement.warehouse, warehouses) || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Batch</p>
                      <p className="text-sm text-gray-700">
                        {getBatchValue(viewingMovement.batch, batches) || "N/A"}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <p className="text-xs text-gray-500">Serial Number</p>
                      <p className="text-sm text-gray-700">
                        {getSerialValue(viewingMovement.serialNumber, serialNumbers) || "N/A"}
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
              ),
            ],
          },
        ]}
      />

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
