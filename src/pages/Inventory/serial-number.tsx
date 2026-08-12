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
  CubeIcon,
  CalendarIcon,
  ShoppingBagIcon,
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

// ---------- Interfaces ----------
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
  serialNumberId?: number;
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
  // --- NEW fields ---
  purchaseDate?: string | null;   // ISO date string
  salesDate?: string | null;     // ISO date string, null if not sold
  currentStatus?: string;        // e.g., "Available", "Sold", "In Repair", "Returned"
}

type SerialNumberForm = {
  warrantyStart: string;
  warrantyEnd: string;
  productId: string;
  warehouseId: string;
  batchId: string;
  purchaseDate: string;
  salesDate: string;
  currentStatus: string;
};

// ---------- Constants ----------
const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase";
const PAGE_SIZE = 10;
const WAREHOUSE_ROUTE = "/warehouse";
const PRODUCT_ROUTE = "/product";

// Hardcoded status options
const STATUS_OPTIONS = [
  { id: "Available", name: "Available" },
  { id: "Sold", name: "Sold" },
  { id: "In Repair", name: "In Repair" },
  { id: "Returned", name: "Returned" },
];

const emptyForm: SerialNumberForm = {
  warrantyStart: "",
  warrantyEnd: "",
  productId: "",
  warehouseId: "",
  batchId: "",
  purchaseDate: "",
  salesDate: "",
  currentStatus: "Available",
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

function getInspections(sn: SerialNumber, inspectionsBySerial: Record<number, Inspection[]>): string {
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
  const [filterCurrentStatus, setFilterCurrentStatus] = useState(""); // NEW
  const [viewingSerial, setViewingSerial] = useState<SerialNumber | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [deletingSerial, setDeletingSerial] = useState<SerialNumber | null>(null);

  useEffect(() => {
    fetchSerialNumbers();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
    fetchInspections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Hardcode default values for new fields ---
  const applyDefaults = (sn: SerialNumber): SerialNumber => ({
    ...sn,
    purchaseDate: sn.purchaseDate ?? new Date().toISOString().split("T")[0],
    salesDate: sn.salesDate ?? null,
    currentStatus: sn.currentStatus ?? "Available",
  });

  const fetchSerialNumbers = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SerialNumber[]>(`${API_URL}/serial-numbers`, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      // Apply defaults
      const enriched = data.map(applyDefaults);
      setSerialNumbers(enriched);
      if (enriched.length === 0) ToasterService.noData("No serial numbers found");
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
      ToasterService.error("Failed to load quality inspections", getErrorMessage(error, "Please try again."));
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
      inspections: [],
      // NEW fields
      purchaseDate: form.purchaseDate || null,
      salesDate: form.salesDate || null,
      currentStatus: form.currentStatus || "Available",
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
    // Validate purchase/sales dates if provided
    if (form.purchaseDate && form.salesDate && new Date(form.salesDate) < new Date(form.purchaseDate)) {
      ToasterService.error("Invalid dates", "Sales date cannot be before purchase date.");
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
    setForm({
      ...emptyForm,
      purchaseDate: new Date().toISOString().split("T")[0], // default today
    });
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
      purchaseDate: sn.purchaseDate || "",
      salesDate: sn.salesDate || "",
      currentStatus: sn.currentStatus || "Available",
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

  const openView = async (sn: SerialNumber) => {
    setViewingSerial(sn);
    try {
      setViewLoading(true);
      const res = await axios.get<SerialNumber>(`${API_URL}/serial-numbers/${sn.id}`, { headers });
      if (res.data) {
        // Apply defaults to fetched data
        const enriched = applyDefaults(res.data);
        setViewingSerial(enriched);
      }
    } catch (error) {
      ToasterService.error("Failed to load serial number details", getErrorMessage(error, "Showing last known details."));
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewingSerial(null);
  };

  const goToWarehouse = (warehouse?: WarehouseRef) => {
    if (!warehouse?.id) return;
    navigate(`${WAREHOUSE_ROUTE}?warehouseId=${warehouse.id}`, {
      state: { warehouseId: warehouse.id, warehouseName: warehouse.name },
    });
  };

  const goToProduct = (productId?: number) => {
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    navigate(`${PRODUCT_ROUTE}?productId=${productId}`, {
      state: { productId, productName: product?.productName },
    });
  };

  // ---------- Filtering ----------
  const filteredSerialNumbers = useMemo(() => {
    const term = searchableText(search);

    return serialNumbers
      .filter((sn) => {
        if (filterProductId && String(sn.productId) !== filterProductId) return false;
        if (filterWarehouseId && String(sn.warehouse?.id || "") !== filterWarehouseId) return false;
        if (filterBatchId && String(sn.batch?.id || "") !== filterBatchId) return false;
        if (filterStatus === "active" && !isWarrantyActive(sn.warrantyEnd)) return false;
        if (filterStatus === "expired" && isWarrantyActive(sn.warrantyEnd)) return false;
        if (filterCurrentStatus && sn.currentStatus !== filterCurrentStatus) return false;

        if (!term) return true;

        const haystack = [
          sn.serial,
          sn.id,
          sn.productNumber,
          sn.productId,
          sn.warehouse?.name,
          sn.batch?.batchNumber,
          isWarrantyActive(sn.warrantyEnd) ? "active" : "expired",
          sn.currentStatus,
          sn.purchaseDate,
          sn.salesDate,
        ]
          .map(searchableText)
          .filter(Boolean)
          .join(" ");

        return haystack.includes(term);
      })
      .map((sn) => ({
        ...sn,
        productNumber:
          sn.productNumber || products.find((p) => p.id === sn.productId)?.productCode || "N/A",
        inspections: inspectionsBySerial[sn.id] ?? sn.inspections ?? [],
        // Ensure defaults are applied (in case we missed any)
        ...applyDefaults(sn),
      }));
  }, [serialNumbers, search, filterProductId, filterWarehouseId, filterBatchId, filterStatus, filterCurrentStatus, products, inspectionsBySerial]);

  const resetFilters = () => {
    setFilterProductId("");
    setFilterWarehouseId("");
    setFilterBatchId("");
    setFilterStatus("");
    setFilterCurrentStatus("");
  };

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const total = serialNumbers.length;
    const inWarranty = serialNumbers.filter((sn) => isWarrantyActive(sn.warrantyEnd)).length;
    const expired = total - inWarranty;
    const warehouses = new Set(serialNumbers.map((sn) => sn.warehouse?.name).filter(Boolean)).size;
    // Status counts
    const statusCounts: Record<string, number> = {};
    serialNumbers.forEach((sn) => {
      const status = sn.currentStatus || "Unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    return { total, inWarranty, expired, warehouses, statusCounts };
  }, [serialNumbers]);

  // ---------- Table columns (new columns added) ----------
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openView(sn);
              }}
              className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
              title="View serial number details"
            >
              {sn.serial || "N/A"}
            </button>
            <div className="text-xs text-slate-500">ID: {sn.id}</div>
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
            className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
            title="View product"
          >
            {name}
          </button>
        ) : (
          <span>{name}</span>
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
      key: "purchaseDate",
      label: "Purchase Date",
      sortable: true,
      render: (sn) => (sn.purchaseDate ? new Date(sn.purchaseDate).toLocaleDateString() : "N/A"),
    },
    {
      key: "salesDate",
      label: "Sales Date",
      sortable: true,
      render: (sn) => (sn.salesDate ? new Date(sn.salesDate).toLocaleDateString() : "N/A"),
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
      key: "warrantyStatus",
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
      key: "currentStatus",
      label: "Current Status",
      sortable: true,
      render: (sn) => {
        const status = sn.currentStatus || "Available";
        let colorClass = "bg-gray-50 text-gray-700";
        if (status === "Available") colorClass = "bg-green-50 text-green-700";
        else if (status === "Sold") colorClass = "bg-blue-50 text-blue-700";
        else if (status === "In Repair") colorClass = "bg-yellow-50 text-yellow-700";
        else if (status === "Returned") colorClass = "bg-red-50 text-red-700";
        return (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colorClass}`}>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <StatsCard
            label="Available"
            value={stats.statusCounts["Available"] || 0}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon />}
          />
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md md:mt-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by serial, product, warehouse, batch, status..."
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
                { header: "Product Name", accessor: (row) => getProductName(row, products) },
                { header: "Warehouse", accessor: (row) => getWarehouseName(row) },
                { header: "Batch", accessor: (row) => getBatchNumber(row) },
                {
                  header: "Purchase Date",
                  accessor: (row) => (row.purchaseDate ? new Date(row.purchaseDate).toLocaleDateString() : "N/A"),
                },
                {
                  header: "Sales Date",
                  accessor: (row) => (row.salesDate ? new Date(row.salesDate).toLocaleDateString() : "N/A"),
                },
                {
                  header: "Warranty Start",
                  accessor: (row) => (row.warrantyStart ? new Date(row.warrantyStart).toLocaleDateString() : "N/A"),
                },
                {
                  header: "Warranty End",
                  accessor: (row) => (row.warrantyEnd ? new Date(row.warrantyEnd).toLocaleDateString() : "N/A"),
                },
                { header: "Warranty Status", accessor: (row) => getWarrantyStatus(row) },
                { header: "Current Status", accessor: (row) => row.currentStatus || "Available" },
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
                  label="Product Name"
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
                <FloatingSelect
                  label="Current Status"
                  name="filterCurrentStatus"
                  value={filterCurrentStatus}
                  onChange={(e) => setFilterCurrentStatus(e.target.value)}
                  options={STATUS_OPTIONS}
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

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Serial Number" : "Create Serial Number"}
        subtitle="Enter serial number details including purchase/sales dates and current status"
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
                label="Product Name"
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
            label: "Dates & Status",
            fields: [
              <FloatingInput
                key="purchaseDate"
                label="Purchase Date"
                name="purchaseDate"
                type="date"
                value={form.purchaseDate}
                onChange={handleChange}
              />,
              <FloatingInput
                key="salesDate"
                label="Sales Date"
                name="salesDate"
                type="date"
                value={form.salesDate}
                onChange={handleChange}
              />,
              <FloatingSelect
                key="currentStatus"
                label="Current Status"
                name="currentStatus"
                value={form.currentStatus}
                onChange={handleChange}
                options={STATUS_OPTIONS}
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

      {/* Detail View Modal (updated with new fields) */}
      {viewingSerial && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={closeView}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
                  <QrCodeIcon className="h-5 w-5 text-cyan-700" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">
                    {viewingSerial.serial || "N/A"}
                  </div>
                  <div className="text-xs text-slate-500">ID: {viewingSerial.id}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeView}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            {viewLoading && <div className="mb-3 text-xs text-slate-400">Refreshing latest details…</div>}

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 text-slate-500">
                  <CubeIcon className="h-4 w-4" /> Product
                </span>
                {viewingSerial.productId ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeView();
                      goToProduct(viewingSerial.productId);
                    }}
                    className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                  >
                    {getProductName(viewingSerial, products)}
                  </button>
                ) : (
                  <span className="font-medium text-slate-800">
                    {getProductName(viewingSerial, products)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 text-slate-500">
                  <BuildingStorefrontIcon className="h-4 w-4" /> Warehouse
                </span>
                {viewingSerial.warehouse?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeView();
                      goToWarehouse(viewingSerial.warehouse);
                    }}
                    className="font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                  >
                    {getWarehouseName(viewingSerial)}
                  </button>
                ) : (
                  <span className="font-medium text-slate-800">{getWarehouseName(viewingSerial)}</span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-500">Batch</span>
                <span className="font-medium text-slate-800">{getBatchNumber(viewingSerial)}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 text-slate-500">
                  <CalendarIcon className="h-4 w-4" /> Purchase Date
                </span>
                <span className="font-medium text-slate-800">
                  {viewingSerial.purchaseDate ? new Date(viewingSerial.purchaseDate).toLocaleDateString() : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 text-slate-500">
                  <ShoppingBagIcon className="h-4 w-4" /> Sales Date
                </span>
                <span className="font-medium text-slate-800">
                  {viewingSerial.salesDate ? new Date(viewingSerial.salesDate).toLocaleDateString() : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-500">Warranty Start</span>
                <span className="font-medium text-slate-800">
                  {viewingSerial.warrantyStart ? new Date(viewingSerial.warrantyStart).toLocaleDateString() : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-500">Warranty End</span>
                <span className="font-medium text-slate-800">
                  {viewingSerial.warrantyEnd ? new Date(viewingSerial.warrantyEnd).toLocaleDateString() : "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-500">Warranty Status</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isWarrantyActive(viewingSerial.warrantyEnd)
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {getWarrantyStatus(viewingSerial)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-500">Current Status</span>
                <span className="font-medium text-slate-800">{viewingSerial.currentStatus || "Available"}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-slate-500">Inspections</span>
                <span className="font-medium text-slate-800">
                  {getInspections(viewingSerial, inspectionsBySerial)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  closeView();
                  openEdit(viewingSerial);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={closeView}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
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