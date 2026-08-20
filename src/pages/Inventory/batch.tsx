import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CubeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
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
  reservedQty?: number;
  availableQty?: number;
  supplierName?: string;
  fifoPriority?: number;
  fefoPriority?: number;
  daysUntilExpiry?: number;
};

type BatchForm = {
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  productId: string;
  warehouse: string;
  quantity: string;
  reservedQty: string;
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
const ENUM_API_URL = "/v1/api/inventory/enums";
const PAGE_SIZE = 10;

// ✅ Static data for missing fields (BE doesn't have these yet)
const STATIC_BATCH_DATA_MAP: Record<number, any> = {
  1: { quantity: 150, reservedQty: 20, availableQty: 130, supplierName: "ABC Supplies" },
  2: { quantity: 200, reservedQty: 50, availableQty: 150, supplierName: "XYZ Traders" },
  3: { quantity: 100, reservedQty: 10, availableQty: 90, supplierName: "Global Imports" },
};
const STATIC_BATCH_DATA = { 
  quantity: 100, 
  reservedQty: 20, 
  availableQty: 80, 
  supplierName: "Default Supplier" 
};

// ✅ Fallback values (BATCH_STATUS not in enum API)
const FALLBACK_STATUS = ["GOOD", "EXPIRING_SOON", "EXPIRED", "EMPTY"];

// ✅ Generate Batch Number
const generateBatchNumber = (): string => {
  const prefix = "BATCH";
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `${prefix}-${timestamp}-${random}`;
};

const emptyForm: BatchForm = {
  batchNumber: generateBatchNumber(),
  manufacturingDate: new Date().toISOString().split("T")[0],
  expiryDate: "",
  productId: "",
  warehouse: "",
  quantity: "0",
  reservedQty: "0",
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
const searchableText = (v: any) => (v === null || v === undefined ? "" : String(v).toLowerCase().trim());

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
    return { label: "Empty", className: "bg-gray-50 text-gray-700 border-gray-200", icon: <XCircleIcon className="h-3.5 w-3.5" /> };
  }
  const days = getDaysUntilExpiry(batch);
  if (days < 0) {
    return { label: "Expired", className: "bg-red-50 text-red-700 border-red-200", icon: <XCircleIcon className="h-3.5 w-3.5" /> };
  }
  if (days <= 30) {
    return { label: "Expiring Soon", className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" /> };
  }
  return { label: "Good", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircleIcon className="h-3.5 w-3.5" /> };
};

const getFIFORank = (batches: Batch[], batch: Batch) => {
  const sorted = [...batches]
    .filter(b => (b.quantity || 0) > 0)
    .sort((a, b) => new Date(a.manufacturingDate).getTime() - new Date(b.manufacturingDate).getTime());
  return sorted.findIndex(b => b.id === batch.id) + 1;
};

const getFEFORank = (batches: Batch[], batch: Batch) => {
  const sorted = [...batches]
    .filter(b => (b.quantity || 0) > 0)
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  return sorted.findIndex(b => b.id === batch.id) + 1;
};

// ============ COMPONENT ============
const BatchManagement: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fifoFilter, setFifoFilter] = useState("");
  const [fefoFilter, setFefoFilter] = useState("");
  const [deleteBatch, setDeleteBatch] = useState<Batch | null>(null);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);

  // ✅ Enum options from BE (fallback since BATCH_STATUS not in enum API)
  const [batchStatusOptions, setBatchStatusOptions] = useState<string[]>(FALLBACK_STATUS);
  const [enumLoading, setEnumLoading] = useState(false);

  useEffect(() => {
    fetchEnums();
    fetchAllBatches();
    fetchDropdowns();
  }, []);

  // ✅ BATCH_STATUS is not in enum API, use fallback
  const fetchEnums = async (): Promise<void> => {
    try {
      setEnumLoading(true);
      // ✅ BATCH_STATUS is not in enum API, use fallback directly
      setBatchStatusOptions(FALLBACK_STATUS);
    } catch (error) {
      setBatchStatusOptions(FALLBACK_STATUS);
    } finally {
      setEnumLoading(false);
    }
  };

  const fetchAllBatches = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Batch[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];

      // ✅ Enrich with static data (quantity, reserved, available, supplier)
      const enriched = data.map(b => {
        const staticData = STATIC_BATCH_DATA_MAP[b.id] || STATIC_BATCH_DATA;
        return {
          ...b,
          quantity: staticData.quantity || 0,
          reservedQty: staticData.reservedQty || 0,
          availableQty: staticData.availableQty || (staticData.quantity || 0) - (staticData.reservedQty || 0),
          supplierName: staticData.supplierName || '--',
          daysUntilExpiry: getDaysUntilExpiry(b),
          fifoPriority: 0,
          fefoPriority: 0,
        };
      });

      // ✅ Calculate FIFO/FEFO ranks
      const withRanks = enriched.map(b => ({
        ...b,
        fifoPriority: getFIFORank(enriched, b),
        fefoPriority: getFEFORank(enriched, b),
      }));

      setBatches(withRanks);
    } catch (error) {
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
    setForm({ ...emptyForm, batchNumber: generateBatchNumber() });
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
      batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      productId: String(batch.productId),
      warehouse: typeof batch.warehouse === "object" ? String(batch.warehouse?.id || "") : String(batch.warehouse || ""),
      quantity: String(batch.quantity || 0),
      reservedQty: String(batch.reservedQty || 0),
      supplierName: batch.supplierName || '',
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const buildPayload = () => {
    const selectedWarehouse = warehouses.find(w => String(w.id) === form.warehouse);
    const warehouseObject = selectedWarehouse ? { id: selectedWarehouse.id } : null;

    const base = {
      batchNumber: form.batchNumber.trim(),
      manufacturingDate: form.manufacturingDate,
      expiryDate: form.expiryDate,
      productId: toNumber(form.productId),
      warehouse: warehouseObject,
      quantity: toNumber(form.quantity),
      reservedQty: toNumber(form.reservedQty),
      supplierName: form.supplierName,
    };

    if (editingId) return { id: editingId, ...base };
    return { ...base, inspections: [] };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.batchNumber.trim() || !form.manufacturingDate || !form.expiryDate || !form.productId || !form.warehouse) {
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
      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Batch updated successfully");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Batch created successfully");
      }
      closeForm();
      await fetchAllBatches();
    } catch (error) {
      ToasterService.error("Failed to save batch", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteBatch?.id) return;
    try {
      await axios.delete(`${API_URL}/${deleteBatch.id}?cascade=true`, { headers });
      ToasterService.success("Batch deleted successfully");
      setDeleteBatch(null);
      await fetchAllBatches();
    } catch (error) {
      ToasterService.error("Failed to delete batch", getErrorMessage(error, "Please try again."));
    }
  };

  // ============ FILTERS ============
  const filteredBatches = useMemo(() => {
    const term = searchableText(search);
    return batches.filter(b => {
      const product = products.find(p => p.id === b.productId || p.productId === b.productId);
      const searchStr =
        `${b.id} ${b.batchNumber} ${product ? normalizeProductLabel(product) : ""} ${getWarehouseDisplay(b)} ${b.supplierName || ""}`
          .toLowerCase();
      if (term && !searchStr.includes(term)) return false;

      // Status filter
      if (statusFilter === "expired" && getDaysUntilExpiry(b) >= 0) return false;
      if (statusFilter === "expiring" && (getDaysUntilExpiry(b) < 0 || getDaysUntilExpiry(b) > 30)) return false;
      if (statusFilter === "good" && getDaysUntilExpiry(b) <= 30) return false;
      if (statusFilter === "empty" && (b.quantity || 0) > 0) return false;

      // FIFO/FEFO filters
      if (fifoFilter && b.fifoPriority !== toNumber(fifoFilter)) return false;
      if (fefoFilter && b.fefoPriority !== toNumber(fefoFilter)) return false;

      return true;
    });
  }, [batches, search, statusFilter, fifoFilter, fefoFilter, products]);

  // ============ STATS ============
  const stats = useMemo(() => {
    const active = batches.filter(b => (b.quantity || 0) > 0);
    return {
      total: batches.length,
      expired: batches.filter(b => getDaysUntilExpiry(b) < 0).length,
      expiringSoon: batches.filter(b => getDaysUntilExpiry(b) >= 0 && getDaysUntilExpiry(b) <= 30).length,
      totalQuantity: batches.reduce((s, b) => s + (b.quantity || 0), 0),
      totalReserved: batches.reduce((s, b) => s + (b.reservedQty || 0), 0),
      totalAvailable: batches.reduce((s, b) => s + (b.availableQty || 0), 0),
      emptyBatches: batches.filter(b => (b.quantity || 0) <= 0).length,
    };
  }, [batches]);

  // ============ COLUMNS ============
  const columns: ColumnDef<Batch>[] = [
    {
      key: "batchNumber",
      label: "Batch Number",
      sortable: true,
      render: (batch) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-100 bg-purple-50">
            <CubeIcon className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-sm font-semibold text-slate-900">{batch.batchNumber}</p>
        </div>
      ),
    },
    {
      key: "productId",
      label: "Product",
      sortable: true,
      render: (batch) => {
        const p = products.find(p => p.id === batch.productId || p.productId === batch.productId);
        return <span className="text-sm text-slate-700">{p ? normalizeProductLabel(p) : `Product #${batch.productId}`}</span>;
      },
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      render: (batch) => <span className="text-sm text-slate-700">{getWarehouseDisplay(batch)}</span>,
    },
    {
      key: "quantity",
      label: "Total Qty",
      sortable: true,
      render: (batch) => <span className="text-sm font-semibold">{batch.quantity || 0}</span>,
    },
    {
      key: "reservedQty",
      label: "Reserved",
      sortable: true,
      render: (batch) => <span className="text-sm text-orange-600">{batch.reservedQty || 0}</span>,
    },
    {
      key: "availableQty",
      label: "Available",
      sortable: true,
      render: (batch) => <span className="text-sm text-green-600">{batch.availableQty || 0}</span>,
    },
    // {
    //   key: "supplierName",
    //   label: "Supplier",
    //   sortable: true,
    //   render: (batch) => <span className="text-sm">{batch.supplierName || "--"}</span>,
    // },
    {
      key: "expiryDate",
      label: "Expiry",
      sortable: true,
      render: (batch) => {
        const days = getDaysUntilExpiry(batch);
        return (
          <div>
            <span className={`text-sm ${days < 0 ? "text-red-600" : days <= 30 ? "text-yellow-600" : "text-slate-600"}`}>
              {new Date(batch.expiryDate).toLocaleDateString()}
            </span>
            {days >= 0 && <p className="text-xs text-slate-400">{days} days left</p>}
          </div>
        );
      },
    },
    // {
    //   key: "fifoPriority",
    //   label: "FIFO",
    //   sortable: true,
    //   render: (batch) => {
    //     const p = batch.fifoPriority || 0;
    //     return (
    //       <span
    //         className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
    //           p === 1 ? "bg-green-100 text-green-700" : p <= 3 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
    //         }`}
    //       >
    //         #{p || "--"}
    //       </span>
    //     );
    //   },
    // },
    // {
    //   key: "fefoPriority",
    //   label: "FEFO",
    //   sortable: true,
    //   render: (batch) => {
    //     const p = batch.fefoPriority || 0;
    //     return (
    //       <span
    //         className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
    //           p === 1 ? "bg-green-100 text-green-700" : p <= 3 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
    //         }`}
    //       >
    //         #{p || "--"}
    //       </span>
    //     );
    //   },
    // },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (batch) => {
        const s = getBatchStatus(batch);
        return (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}>
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
        <div className="flex justify-end gap-1">
          <button
            onClick={() => setViewBatch(batch)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
            title="View"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEdit(batch)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteBatch(batch)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ============ FILTER OPTIONS ============
  const statusFilterOptions = useMemo(() => {
    return [
      { label: "All Status", value: "" },
      ...FALLBACK_STATUS.map((status) => ({
        label: status.replace('_', ' '),
        value: status.toLowerCase(),
      })),
    ];
  }, []);

  const fifoFilterOptions = [
    { label: "All", value: "" },
    { label: "Priority 1 (Oldest)", value: "1" },
    { label: "Priority 2", value: "2" },
    { label: "Priority 3", value: "3" },
    { label: "Priority 4+", value: "4" },
  ];

  const fefoFilterOptions = [
    { label: "All", value: "" },
    { label: "Priority 1 (Earliest Expiry)", value: "1" },
    { label: "Priority 2", value: "2" },
    { label: "Priority 3", value: "3" },
    { label: "Priority 4+", value: "4" },
  ];

  return (
    <>
      <PageMeta title="Batch Management" description="Manage product batches" />
      <PageBreadcrumb pageTitle="Batch Management" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-end -mt-12">
          <AddButton onClick={openCreate} label="Add Batch" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
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

        {/* Search & Filter */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search batches..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-purple-500"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <FilterPopover
              title="Filter Batches"
              buttonLabel="Filter"
              label="Status"
              value={statusFilter}
              options={statusFilterOptions}
              onChange={setStatusFilter}
              onReset={() => {
                setStatusFilter("");
                setFifoFilter("");
                setFefoFilter("");
              }}
              widthClassName="w-72"
            >
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All Status</option>
                    {FALLBACK_STATUS.map((status) => (
                      <option key={status} value={status.toLowerCase()}>
                        {status.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">FIFO Priority</label>
                  <select
                    value={fifoFilter}
                    onChange={e => setFifoFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    <option value="1">Priority 1 (Oldest)</option>
                    <option value="2">Priority 2</option>
                    <option value="3">Priority 3</option>
                    <option value="4">Priority 4+</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">FEFO Priority</label>
                  <select
                    value={fefoFilter}
                    onChange={e => setFefoFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All</option>
                    <option value="1">Priority 1 (Earliest Expiry)</option>
                    <option value="2">Priority 2</option>
                    <option value="3">Priority 3</option>
                    <option value="4">Priority 4+</option>
                  </select>
                </div>
              </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredBatches}
          columns={columns}
          loading={loading || enumLoading}
          pageSize={PAGE_SIZE}
          defaultSortKey="expiryDate"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No batches found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                Create your first batch
              </button>
            </div>
          }
        />
      </div>

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Batch" : "Create Batch"}
        subtitle="Create a new product batch"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Batch" : "Create Batch"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Batch Info",
            fields: [
              <FloatingInput
                key="batchNumber"
                label="Batch Number"
                name="batchNumber"
                value={form.batchNumber}
                onChange={handleChange}
                required
              />,
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
                emptyOptionLabel="Select product"
                options={products.map(p => ({
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
                emptyOptionLabel="Select warehouse"
                options={warehouses.map(w => ({
                  id: String(w.id),
                  name: `${w.code || ""} - ${w.name || ""}`,
                }))}
                required
              />,
              <FloatingInput
                key="quantity"
                label="Total Quantity"
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="reservedQty"
                label="Reserved Quantity"
                name="reservedQty"
                type="number"
                value={form.reservedQty}
                onChange={handleChange}
              />,
              <FloatingInput
                key="supplierName"
                label="Supplier Name"
                name="supplierName"
                value={form.supplierName}
                onChange={handleChange}
              />,
            ],
          },
        ]}
      />

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={!!deleteBatch}
        setIsPopupOpen={open => !open && setDeleteBatch(null)}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Batch"
        subText={deleteBatch ? `Are you sure you want to delete batch "${deleteBatch.batchNumber}"?` : "Are you sure?"}
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