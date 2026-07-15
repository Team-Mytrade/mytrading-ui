import React, { ChangeEvent, FormEvent, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowRightIcon,
  ArrowsRightLeftIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";

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
const PRODUCTS_API_URL = "/v1/api/purchase/products";
const WAREHOUSES_API_URL = "/v1/api/inventory/warehouses";
const BATCHES_API_URL = "/v1/api/inventory/batches";
const SERIALS_API_URL = "/v1/api/inventory/serial-numbers";
const PAGE_SIZE = 10;
const MOVEMENT_TYPES = ["GRN", "TRANSFER", "ADJUSTMENT", "RETURN", "SALE"];

const emptyForm: MovementForm = {
  movementDate: new Date().toISOString().split("T")[0],
  movementType: "GRN",
  quantity: "0",
  fromLocation: "",
  toLocation: "",
  reference: "",
  productId: "",
  warehouseId: "",
  batchId: "",
  serialNumberId: "",
};

function toNumber(value: string | number | undefined | null) {
  return Number(value || 0);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null") || {};
  } catch {
    return {};
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function getProductLabel(product?: Product) {
  if (!product) return "";
  const name = product.productName || product.name || `Product #${product.id}`;
  const code = product.productCode || product.code;
  return code ? `${name} (${code})` : name;
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

const StockMovementsManager: React.FC = () => {
  const { user } = useContext(AuthContext);
  const authUser = getStoredUser();
  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, []);

  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingMovement, setDeletingMovement] = useState<StockMovement | null>(null);
  const [form, setForm] = useState<MovementForm>(emptyForm);

  useEffect(() => {
    void fetchStockMovements();
    void fetchLookups();
  }, []);

  const fetchStockMovements = async () => {
    try {
      setLoading(true);
      const res = await axios.get<StockMovement[]>(API_URL, { headers });
      setStockMovements(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setStockMovements([]);
      ToasterService.error("Failed to load stock movements", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    const [productsRes, warehousesRes, batchesRes, serialsRes] = await Promise.allSettled([
      axios.get<Product[]>(PRODUCTS_API_URL, { headers }),
      axios.get<Warehouse[]>(WAREHOUSES_API_URL, { headers }),
      axios.get<Batch[]>(BATCHES_API_URL, { headers }),
      axios.get<SerialNumber[]>(SERIALS_API_URL, { headers }),
    ]);

    setProducts(productsRes.status === "fulfilled" && Array.isArray(productsRes.value.data) ? productsRes.value.data : []);
    setWarehouses(warehousesRes.status === "fulfilled" && Array.isArray(warehousesRes.value.data) ? warehousesRes.value.data : []);
    setBatches(batchesRes.status === "fulfilled" && Array.isArray(batchesRes.value.data) ? batchesRes.value.data : []);
    setSerialNumbers(serialsRes.status === "fulfilled" && Array.isArray(serialsRes.value.data) ? serialsRes.value.data : []);
  };

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Movement ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<StockMovement>(`${API_URL}/${lookupId}`, { headers });
      setStockMovements(res.data ? [res.data] : []);
      ToasterService.success("Stock movement loaded");
    } catch (error) {
      ToasterService.error("Failed to load stock movement", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Builds the POST/PUT payload for a Stock Movement.
   *
   * IMPORTANT: this only sends fields the frontend actually owns.
   * - id: 0 for create, or the existing id when editing.
   * - warehouse / batch / serialNumber: sent as a bare `{ id }` reference.
   *   The backend looks up the full entity from that id — you never need
   *   to construct or send the nested stockLevels/batches/serialNumbers/
   *   inspections graph that shows up in the Swagger GET/response schema.
   *   That nested data is server-generated output, not client input.
   * - createdDate / updatedDate / createdBy / tenantId are NOT set here.
   *   Those are server-managed audit fields — the backend should stamp
   *   them (from the authenticated session / DB triggers), not the
   *   frontend. Sending fabricated values for these from the client is
   *   both unnecessary and risks the backend trusting client-supplied
   *   audit data it shouldn't.
   */
  const buildPayload = () => {
    const selectedWarehouse = warehouses.find((item) => item.id === toNumber(form.warehouseId));
    const selectedBatch = batches.find((item) => item.id === toNumber(form.batchId));
    const selectedSerial = serialNumbers.find((item) => item.id === toNumber(form.serialNumberId));

    return {
      id: editingId || 0,
      movementDate: form.movementDate,
      movementType: form.movementType,
      quantity: toNumber(form.quantity),
      fromLocation: form.fromLocation,
      toLocation: form.toLocation,
      reference: form.reference,
      productId: toNumber(form.productId),
      warehouse: selectedWarehouse ? { id: selectedWarehouse.id } : null,
      batch: selectedBatch ? { id: selectedBatch.id } : null,
      serialNumber: selectedSerial ? { id: selectedSerial.id } : null,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, buildPayload(), { headers });
        ToasterService.success("Stock movement updated");
      } else {
        await axios.post(API_URL, buildPayload(), { headers });
        ToasterService.success("Stock movement created");
      }
      clearForm();
      await fetchStockMovements();
    } catch (error) {
      ToasterService.error("Failed to save stock movement", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (sm: StockMovement) => {
    setEditingId(sm.id);
    setForm({
      movementDate: sm.movementDate || emptyForm.movementDate,
      movementType: sm.movementType || "GRN",
      quantity: String(sm.quantity || 0),
      fromLocation: sm.fromLocation || "",
      toLocation: sm.toLocation || "",
      reference: sm.reference || "",
      productId: String(sm.productId || sm.product?.id || ""),
      warehouseId: getWarehouseId(sm.warehouse, warehouses),
      batchId: getBatchId(sm.batch, batches),
      serialNumberId: getSerialId(sm.serialNumber, serialNumbers),
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deletingMovement?.id) return;

    try {
      await axios.delete(`${API_URL}/${deletingMovement.id}`, { headers });
      ToasterService.success("Stock movement deleted");
      setDeletingMovement(null);
      await fetchStockMovements();
    } catch (error) {
      ToasterService.error("Failed to delete stock movement", getErrorMessage(error, "Please try again."));
    }
  };

  const filtered = stockMovements.filter((sm) => {
    const productName = getProductLabel(products.find((item) => item.id === sm.productId || item.productId === sm.productId) || sm.product);
    const warehouseName = getWarehouseValue(sm.warehouse);
    const batchLabel = typeof sm.batch === "string" ? sm.batch : sm.batch?.batchNumber || "";
    const serialLabel = typeof sm.serialNumber === "string" ? sm.serialNumber : sm.serialNumber?.serial || "";

    return `${sm.movementType || ""} ${sm.fromLocation || ""} ${sm.toLocation || ""} ${sm.reference || ""} ${productName} ${warehouseName} ${batchLabel} ${serialLabel}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const totalMovements = stockMovements.length;
  const totalQuantity = stockMovements.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0);
  const transferCount = stockMovements.filter((sm) => sm.movementType?.toUpperCase() === "TRANSFER").length;
  const uniqueProducts = new Set(stockMovements.map((sm) => sm.productId || sm.product?.id).filter(Boolean)).size;

  const tableColumns: ColumnDef<StockMovement>[] = [
    {
      key: "movementDate",
      label: "Date",
      sortable: true,
      sortValueGetter: (sm) => new Date(sm.movementDate).getTime(),
      render: (sm) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="font-medium">{new Date(sm.movementDate).toLocaleDateString()}</span>
        </div>
      ),
    },
    {
      key: "movementType",
      label: "Type",
      sortable: true,
      render: (sm) => (
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/40 bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
          <ArrowsRightLeftIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {sm.movementType}
        </span>
      ),
    },
    {
      key: "productId",
      label: "Product",
      sortable: true,
      sortValueGetter: (sm) => getProductLabel(products.find((item) => item.id === sm.productId || item.productId === sm.productId) || sm.product),
      render: (sm) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
            <CubeIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="truncate text-sm font-semibold leading-snug text-slate-900">
            {getProductLabel(products.find((item) => item.id === sm.productId || item.productId === sm.productId) || sm.product) || `Product #${sm.productId}`}
          </span>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      render: (sm) => <span className="text-sm font-semibold text-slate-700">{sm.quantity}</span>,
    },
    {
      key: "route",
      label: "Movement",
      sortable: false,
      render: (sm) => (
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
          <span className="truncate font-medium" title={sm.fromLocation}>{sm.fromLocation || "N/A"}</span>
          <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium" title={sm.toLocation}>{sm.toLocation || "N/A"}</span>
        </div>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      sortable: true,
      render: (sm) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ClipboardDocumentListIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium" title={sm.reference}>{sm.reference || "--"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right pr-4",
      className: "text-right",
      render: (sm) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleEdit(sm)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Stock Movement"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingMovement(sm)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Stock Movement"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Stock Movements" description="Track and manage inventory stock movements" />
      <PageBreadcrumb pageTitle="Stock Movements" />

      <div className="w-full max-w-none space-y-6 px-0 py-8">
        {!showForm && (
          <>
            <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
              <AddButton
                label="Add Stock Movement"
                onClick={() => {
                  clearForm();
                  setShowForm(true);
                }}
              />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                label="Total Movements"
                value={totalMovements}
                gradient="from-cyan-50 to-blue-50"
                borderColor="border-cyan-100"
                labelColor="text-cyan-600"
                icon={<ArrowsRightLeftIcon />}
              />
              <StatsCard
                label="Total Quantity"
                value={totalQuantity.toLocaleString()}
                gradient="from-green-50 to-emerald-50"
                borderColor="border-green-100"
                labelColor="text-green-600"
                icon={<CubeIcon />}
              />
              <StatsCard
                label="Transfers"
                value={transferCount}
                gradient="from-blue-50 to-indigo-50"
                borderColor="border-blue-100"
                labelColor="text-blue-600"
                icon={<ArrowRightIcon />}
              />
              <StatsCard
                label="Products Moved"
                value={uniqueProducts}
                gradient="from-orange-50 to-yellow-50"
                borderColor="border-orange-100"
                labelColor="text-orange-600"
                icon={<ClipboardDocumentListIcon />}
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
                <FloatingInput
                  label="Movement ID"
                  type="number"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                />
                <button
                  type="button"
                  onClick={fetchById}
                  className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Get By ID
                </button>
                <button
                  type="button"
                  onClick={fetchStockMovements}
                  className="h-[52px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Load All
                </button>
              </div>
            </div>

            <div className="relative w-full max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by type, location, reference, or product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </>
        )}

        {showForm && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Stock Movement" : "Create Stock Movement"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">Form aligned to the stock movement swagger payload</p>
              </div>
              <button type="button" onClick={clearForm} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FloatingDatePicker
                  label="Movement Date"
                  name="movementDate"
                  value={form.movementDate}
                  onChange={handleChange}
                  required
                />
                <FloatingSelect
                  label="Movement Type"
                  name="movementType"
                  value={form.movementType}
                  onChange={handleChange}
                  includeEmptyOption={false}
                  options={MOVEMENT_TYPES.map((type) => ({ id: type, name: type }))}
                />
                <FloatingInput
                  label="Quantity"
                  name="quantity"
                  type="number"
                  value={form.quantity}
                  onChange={handleChange}
                  required
                />
                <FloatingSelect
                  label="Product"
                  name="productId"
                  value={form.productId}
                  onChange={handleChange}
                  emptyOptionLabel="Select product"
                  options={products.map((product) => ({
                    id: String(product.id || product.productId || 0),
                    name: getProductLabel(product),
                  }))}
                  required
                />
                <FloatingSelect
                  label="Warehouse"
                  name="warehouseId"
                  value={form.warehouseId}
                  onChange={handleChange}
                  emptyOptionLabel="Select warehouse"
                  options={warehouses.map((warehouse) => ({
                    id: String(warehouse.id),
                    name: warehouse.code ? `${warehouse.name || `Warehouse #${warehouse.id}`} (${warehouse.code})` : warehouse.name || `Warehouse #${warehouse.id}`,
                  }))}
                  required
                />
                <FloatingInput
                  label="Reference"
                  name="reference"
                  value={form.reference}
                  onChange={handleChange}
                  required
                />
                <FloatingInput
                  label="From Location"
                  name="fromLocation"
                  value={form.fromLocation}
                  onChange={handleChange}
                  required
                />
                <FloatingInput
                  label="To Location"
                  name="toLocation"
                  value={form.toLocation}
                  onChange={handleChange}
                  required
                />
                <FloatingSelect
                  label="Batch"
                  name="batchId"
                  value={form.batchId}
                  onChange={handleChange}
                  emptyOptionLabel="Select batch"
                  options={batches.map((batch) => ({
                    id: String(batch.id),
                    name: batch.batchNumber,
                  }))}
                />
                <FloatingSelect
                  label="Serial Number"
                  name="serialNumberId"
                  value={form.serialNumberId}
                  onChange={handleChange}
                  emptyOptionLabel="Select serial"
                  options={serialNumbers.map((serial) => ({
                    id: String(serial.id),
                    name: serial.serial || `Serial #${serial.id}`,
                  }))}
                />
              </div>

              <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={clearForm}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Saving..." : editingId ? "Update Stock Movement" : "Create Stock Movement"}
                </button>
              </div>
            </form>
          </div>
        )}

        {!showForm && (
          <ReusableTable
            data={filtered}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="movementDate"
            defaultSortOrder="desc"
            loading={loading}
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowsRightLeftIcon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No stock movements found</p>
                <p className="text-xs text-gray-400">Click "Add Stock Movement" to create one</p>
              </div>
            }
          />
        )}
      </div>

      <DynamicPopup
        isPopupOpen={!!deletingMovement}
        setIsPopupOpen={(open) => {
          if (!open) setDeletingMovement(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Stock Movement"
        subText={deletingMovement ? `Are you sure you want to delete movement #${deletingMovement.id}?` : "Are you sure?"}
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
