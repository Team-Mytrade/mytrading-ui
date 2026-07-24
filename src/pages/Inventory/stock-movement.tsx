import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
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
const MOVEMENT_TYPES = ["GRN", "ISSUE", "TRANSFER", "RETURN"];

const emptyForm: MovementForm = {
  movementDate: new Date().toISOString().split("T")[0],
  movementType: "GRN",
  quantity: "",
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
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [form, setForm] = useState<MovementForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMovementType, setFilterMovementType] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [deletingMovement, setDeletingMovement] = useState<StockMovement | null>(null);

  useEffect(() => {
    fetchStockMovements();
    fetchLookups();
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      // Changing the product invalidates any previously selected batch/serial
      // (they belong to a specific product), so clear them to force a
      // re-pick — this is what prevents sending a mismatched batch/serial id.
      if (name === "productId" && value !== current.productId) {
        next.batchId = "";
        next.serialNumberId = "";
      }
      return next;
    });
  };

  // Builds the request payload. Only includes `warehouse`, `batch`, and
  // `serialNumber` keys when something was actually selected — omitting the
  // key entirely (rather than sending `null`) avoids backend code paths that
  // try to eagerly resolve a reference and blow up with things like
  // "No value present" (Optional.get() on an empty Optional).
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

    // Only send id when actually editing an existing record — sending id:0
    // on create can make some JPA save() implementations try to look up an
    // existing row with that id first, which throws when none exists.
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
      movementType: movement.movementType || "GRN",
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

  const filteredStockMovements = useMemo(() => {
    const term = searchableText(search);

    return stockMovements.filter((movement) => {
      if (filterMovementType && movement.movementType !== filterMovementType) return false;
      if (filterProductId && String(movement.productId || movement.product?.id || "") !== filterProductId) return false;

      if (!term) return true;

      const productName = getProductLabel(products.find((item) => item.id === movement.productId || item.productId === movement.productId) || movement.product);
      const warehouseName = getWarehouseValue(movement.warehouse);
      const batchLabel = typeof movement.batch === "string" ? movement.batch : movement.batch?.batchNumber || "";
      const serialLabel = typeof movement.serialNumber === "string" ? movement.serialNumber : movement.serialNumber?.serial || "";

      const haystack = [
        movement.movementType,
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
  }, [stockMovements, search, filterMovementType, filterProductId, products]);

  const resetFilters = () => {
    setFilterMovementType("");
    setFilterProductId("");
  };

  const stats = useMemo(
    () => ({
      total: stockMovements.length,
      totalQuantity: stockMovements.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0),
      transfers: stockMovements.filter((sm) => sm.movementType?.toUpperCase() === "TRANSFER").length,
      uniqueProducts: new Set(stockMovements.map((sm) => sm.productId || sm.product?.id).filter(Boolean)).size,
    }),
    [stockMovements]
  );

  // Prepare options for selects
  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: String(product.id || product.productId || 0),
      name: getProductLabel(product),
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((warehouse) => ({
      id: String(warehouse.id),
      name: warehouse.code ? `${warehouse.name || `Warehouse #${warehouse.id}`} (${warehouse.code})` : warehouse.name || `Warehouse #${warehouse.id}`,
    }));
  }, [warehouses]);

  // Batches and serial numbers are scoped to a specific product. Filtering
  // these by the currently selected product prevents picking a batch/serial
  // that belongs to a different product — a mismatch that the backend may
  // reject (or accept incorrectly) since batch/serial rows carry their own
  // productId.
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

  const movementTypeOptions = useMemo(() => {
    return MOVEMENT_TYPES.map((type) => ({
      id: type,
      name: type,
    }));
  }, []);

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
      render: (movement) => (
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/40 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          <ArrowsRightLeftIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {movement.movementType}
        </span>
      ),
    },
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (movement) => getProductLabel(products.find((item) => item.id === movement.productId || item.productId === movement.productId) || movement.product),
      render: (movement) => {
        const product = products.find((item) => item.id === movement.productId || item.productId === movement.productId) || movement.product;
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
              <CubeIcon className="h-4 w-4 text-cyan-600" />
            </div>
            <span className="truncate text-sm font-semibold text-slate-900">
              {getProductLabel(product) || `Product #${movement.productId}`}
            </span>
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

  return (
    <>
      <PageMeta title="Stock Movements" description="Track and manage inventory stock movements" />
      <PageBreadcrumb pageTitle="Stock Movements" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
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
          <div className="relative w-full sm:max-w-md">
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
              metadata={(rows) => [
                { label: "Total", value: rows.length },
                { label: "Search", value: search || "None" },
                { label: "Total Quantity", value: rows.reduce((sum, sm) => sum + (Number(sm.quantity) || 0), 0) },
              ]}
              columns={[
                { key: "movementDate", header: "Date" },
                { key: "movementType", header: "Type" },
                { key: "product", header: "Product" },
                { key: "quantity", header: "Quantity" },
                { key: "fromLocation", header: "From" },
                { key: "toLocation", header: "To" },
                { key: "reference", header: "Reference" },
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
