import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  QrCodeIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
  EyeIcon,
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

// ---------- Product interface (sku removed - unused, productCode is source of truth) ----------
interface Product {
  id: number;
  productName: string;
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
}

interface BatchRef {
  id: number;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
}

interface Inspection {
  id: number;
  inspectionDate: string;
  inspector: string;
  result: string;
  remarks?: string;
  serialNumberId?: number;   // adjust to match your API if needed
}

interface SerialNumber {
  id: number;
  serial: string;
  warrantyStart: string;
  warrantyEnd: string;
  productId: number;
  productNumber?: string;
  warehouse?: WarehouseRef;
  batch?: BatchRef;
  inspections?: Inspection[];
}

type SerialNumberForm = {
  warrantyStart: string;
  warrantyEnd: string;
  productId: string;
  warehouseId: string;
  batchId: string;
};

// ---------- Constants ----------
const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase";
const PAGE_SIZE = 10;

// Matches: <Route path="/warehouse" element={<Warehouse />} /> in AppRouter.tsx
const WAREHOUSE_ROUTE = "/warehouse";

const emptyForm: SerialNumberForm = {
  warrantyStart: "",
  warrantyEnd: "",
  productId: "",
  warehouseId: "",
  batchId: "",
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

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function isWarrantyActive(warrantyEnd: string) {
  if (!warrantyEnd) return false;
  const end = new Date(warrantyEnd);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() >= Date.now();
}

function getProductName(sn: SerialNumber, products: Product[]) {
  const product = products.find((p) => p.id === sn.productId);
  return product?.productName || sn.productNumber || "N/A";
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

function getWarrantyStatus(sn: SerialNumber) {
  return isWarrantyActive(sn.warrantyEnd) ? "In Warranty" : "Expired";
} 

// ---------- Component ----------
const SerialNumberManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;

  const navigate = useNavigate();
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [batches, setBatches] = useState<BatchRef[]>([]);
  const [inspectionsBySerial, setInspectionsBySerial] = useState<Record<number, Inspection[]>>({});
  const [form, setForm] = useState<SerialNumberForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState("");
  const [filterBatchId, setFilterBatchId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewingSerial, setViewingSerial] = useState<SerialNumber | null>(null);
  const [deletingSerial, setDeletingSerial] = useState<SerialNumber | null>(null);

  useEffect(() => {
    fetchSerialNumbers();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
    fetchInspections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSerialNumbers = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SerialNumber[]>(`${API_URL}/serial-numbers`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setSerialNumbers(data);
      if (data.length === 0) ToasterService.noData("No serial numbers found");
    } catch (error) {
      ToasterService.error("Failed to load serial numbers", getErrorMessage(error, "Please try again."));
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
      // console.log("RAW warehouses response:", res.data); // TEMP DEBUG - remove after fixing
      let list: WarehouseRef[] = [];
      const raw = res.data;
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw?.content && Array.isArray(raw.content)) {
        list = raw.content;
      } else if (raw?.data && Array.isArray(raw.data)) {
        list = raw.data;
      } else if (raw?.items && Array.isArray(raw.items)) {
        list = raw.items;
      }
      // console.log("Parsed warehouses list:", list); // TEMP DEBUG - remove after fixing
      setWarehouses(list);
    } catch (error) {
      // console.error("Warehouses fetch error:", error); // TEMP DEBUG - remove after fixing
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get(`${API_URL}/batches`, { headers });
      // console.log("RAW batches response:", res.data); // TEMP DEBUG - remove after fixing
      let list: BatchRef[] = [];
      const raw = res.data;
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw?.content && Array.isArray(raw.content)) {
        list = raw.content;
      } else if (raw?.data && Array.isArray(raw.data)) {
        list = raw.data;
      } else if (raw?.items && Array.isArray(raw.items)) {
        list = raw.items;
      }
      // console.log("Parsed batches list:", list); // TEMP DEBUG - remove after fixing
      setBatches(list);
    } catch (error) {
      // console.error("Batches fetch error:", error); // TEMP DEBUG - remove after fixing
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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const productId = Number(form.productId) || 0;
    const warehouseId = Number(form.warehouseId) || 0;
    const batchId = Number(form.batchId) || 0;
    const product = products.find((item) => item.id === productId);
    const productNumber = product?.productCode ?? product?.productName ?? "";

    return {
      id: editingId || 0,
      warrantyStart: form.warrantyStart,
      warrantyEnd: form.warrantyEnd,
      productId,
      productNumber,
      warehouse: warehouseId ? { id: warehouseId } : null,
      batch: batchId ? { id: batchId } : null,
      inspections: [], // keep empty or fetch existing if editing
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.productId || !form.warehouseId || !form.batchId) {
      ToasterService.error("Required fields missing", "Product, warehouse, and batch are required.");
      return;
    }
    if (!form.warrantyStart || !form.warrantyEnd) {
      ToasterService.error("Required fields missing", "Warranty start and end dates are required.");
      return;
    }
    if (new Date(form.warrantyEnd) < new Date(form.warrantyStart)) {
      ToasterService.error("Invalid warranty range", "Warranty end date cannot be before the start date.");
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
      ToasterService.error("Failed to save serial number", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
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
      ToasterService.error("Failed to delete serial number", getErrorMessage(error, "Please try again."));
    } finally {
      setDeletingSerial(null);
    }
  };

  // ---------- Navigate to warehouse page for a given warehouse ----------
  // /warehouse has no :id route param (see AppRouter.tsx), so it always opens
  // the warehouse list/page as-is. We pass the id via state and a query param
  // in case Warehouse.tsx wants to read it (e.g. to auto-open/highlight that row).
  const goToWarehouse = (warehouse?: WarehouseRef) => {
    if (!warehouse?.id) return;
    navigate(`${WAREHOUSE_ROUTE}?warehouseId=${warehouse.id}`, {
      state: { warehouseId: warehouse.id, warehouseName: warehouse.name },
    });
  };

  const filteredSerialNumbers = useMemo(() => {
    const term = searchableText(search);

    return serialNumbers
      .filter((sn) => {
        if (filterProductId && String(sn.productId) !== filterProductId) return false;
        if (filterWarehouseId && String(sn.warehouse?.id || "") !== filterWarehouseId) return false;
        if (filterBatchId && String(sn.batch?.id || "") !== filterBatchId) return false;
        if (filterStatus === "active" && !isWarrantyActive(sn.warrantyEnd)) return false;
        if (filterStatus === "expired" && isWarrantyActive(sn.warrantyEnd)) return false;

        if (!term) return true;

        const haystack = [
          sn.serial,
          sn.id,
          sn.productNumber,
          sn.productId,
          sn.warehouse?.name,
          sn.batch?.batchNumber,
          isWarrantyActive(sn.warrantyEnd) ? "active" : "expired",
        ]
          .map(searchableText)
          .filter(Boolean)
          .join(" ");

        return haystack.includes(term);
      })
      .map((sn) => ({
        ...sn,
        // Resolve productNumber from the products list if the API didn't set it directly,
        // so the table's auto-generated row-detail view (Table.tsx) shows a real value
        // instead of relying on a field that isn't always populated.
        productNumber:
          sn.productNumber || products.find((p) => p.id === sn.productId)?.productCode || "N/A",
        // Overwrite the (usually empty) nested `inspections` with the ones we fetched
        // separately from /quality-inspections and grouped by serialNumberId.
        inspections: inspectionsBySerial[sn.id] ?? sn.inspections ?? [],
      }));
  }, [serialNumbers, search, filterProductId, filterWarehouseId, filterBatchId, filterStatus, products, inspectionsBySerial]);

  const resetFilters = () => {
    setFilterProductId("");
    setFilterWarehouseId("");
    setFilterBatchId("");
    setFilterStatus("");
  };

  const stats = useMemo(
    () => ({
      total: serialNumbers.length,
      inWarranty: serialNumbers.filter((sn) => isWarrantyActive(sn.warrantyEnd)).length,
      expired: serialNumbers.filter((sn) => !isWarrantyActive(sn.warrantyEnd)).length,
      warehouses: new Set(serialNumbers.map((sn) => sn.warehouse?.name).filter(Boolean)).size,
    }),
    [serialNumbers]
  );

  const columns: ColumnDef<SerialNumber>[] = [
    {
      key: "serial",
      label: "Serial Number",
      sortable: true,
      render: (sn) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
            <QrCodeIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{sn.serial || "N/A"}</div>
            <div className="text-xs text-slate-500">ID: {sn.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: "product",
      label: "Product",
      sortable: true,
      render: (sn) => getProductName(sn, products),
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
            className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
            title="View warehouse"
          >
            {getWarehouseName(sn)}
          </button>
        ) : (
          <span>{getWarehouseName(sn)}</span>
        ),
    },
    {
      key: "batch",
      label: "Batch",
      sortable: true,
      render: (sn) => getBatchNumber(sn),
    },
    {
      key: "warrantyStart",
      label: "Warranty Start",
      sortable: true,
      render: (sn) => (sn.warrantyStart ? new Date(sn.warrantyStart).toLocaleDateString() : "N/A"),
    },
    {
      key: "warrantyEnd",
      label: "Warranty End",
      sortable: true,
      render: (sn) => (sn.warrantyEnd ? new Date(sn.warrantyEnd).toLocaleDateString() : "N/A"),
    },
    {
      key: "status",
      label: "Warranty Status",
      sortable: false,
      render: (sn) => {
        const active = isWarrantyActive(sn.warrantyEnd);
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {active ? "In Warranty" : "Expired"}
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
            onClick={() => setViewingSerial(sn)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="View"
          >
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(sn)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingSerial(sn)}
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
      <PageMeta title="Serial Numbers" description="Manage inventory serial numbers" />
      <PageBreadcrumb pageTitle="Serial Numbers" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Serial Number" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by serial, product, warehouse, or batch..."
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
              title="Serial Numbers"
              subtitle="Filtered serial number listing"
              reportLabel="Serial Numbers Report"
              data={filteredSerialNumbers}
              fileName="Serial_Numbers"
              disabled={loading}
              dateAccessor={(row) => row.warrantyStart || row.warrantyEnd}
              metadata={(rows) => [
                { label: "Total", value: rows.length },
                { label: "In Warranty", value: rows.filter((sn) => isWarrantyActive(sn.warrantyEnd)).length },
                { label: "Expired", value: rows.filter((sn) => !isWarrantyActive(sn.warrantyEnd)).length },
                { label: "Search", value: search || "None" },
              ]}
              columns={[
                { header: "Serial Number", accessor: (row) => row.serial || "N/A" },
                { header: "Product", accessor: (row) => getProductName(row, products) },
                { header: "Warehouse", accessor: (row) => getWarehouseName(row) },
                { header: "Batch", accessor: (row) => getBatchNumber(row) },
                {
                  header: "Warranty Start",
                  accessor: (row) =>
                    row.warrantyStart ? new Date(row.warrantyStart).toLocaleDateString() : "N/A",
                },
                {
                  header: "Warranty End",
                  accessor: (row) =>
                    row.warrantyEnd ? new Date(row.warrantyEnd).toLocaleDateString() : "N/A",
                },
                { header: "Warranty Status", accessor: (row) => getWarrantyStatus(row) },
              ]}
            />
            <FilterPopover
              title="Filter Serial Numbers"
              buttonLabel="Filters"
              widthClassName="w-[21rem] sm:w-[23rem]"
              showFooter={false}
            >
              <div className="space-y-3">
                <FloatingSelect
                  label="Product"
                  name="filterProductId"
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  options={products.map((product) => ({
                    id: String(product.id),
                    name: product.productName,
                  }))}
                />
                <FloatingSelect
                  label="Warehouse"
                  name="filterWarehouseId"
                  value={filterWarehouseId}
                  onChange={(e) => setFilterWarehouseId(e.target.value)}
                  options={warehouses.map((warehouse) => ({
                    id: String(warehouse.id),
                    name: warehouse.name,
                  }))}
                />
                <FloatingSelect
                  label="Batch"
                  name="filterBatchId"
                  value={filterBatchId}
                  onChange={(e) => setFilterBatchId(e.target.value)}
                  options={batches.map((batch) => ({
                    id: String(batch.id),
                    name: batch.batchNumber,
                  }))}
                />
                <FloatingSelect
                  label="Warranty Status"
                  name="filterStatus"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  options={[
                    { id: "active", name: "In Warranty" },
                    { id: "expired", name: "Expired" },
                  ]}
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
          data={filteredSerialNumbers}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="serial"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <QrCodeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No serial numbers found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first serial number
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Serial Number" : "Create Serial Number"}
        subtitle="Enter serial number details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Serial Number" : "Create Serial Number"}
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
                options={products.map((product) => ({
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
                options={warehouses.map((warehouse) => ({
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
                options={batches.map((batch) => ({
                  id: String(batch.id),
                  name: batch.batchNumber,
                }))}
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

      <DynamicPopup
        isPopupOpen={!!deletingSerial}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingSerial(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Serial Number"
        subText={
          deletingSerial
            ? `Are you sure you want to delete serial number "${deletingSerial.serial || deletingSerial.id}"? This action cannot be undone.`
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
