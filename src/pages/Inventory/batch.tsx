import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
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
const BATCH_STOCK_API_URL = "/v1/api/inventory/batches/stock-details";
const PAGE_SIZE = 10;

// Static data for supplierName (if BE doesn't have it)
const STATIC_BATCH_DATA_MAP: Record<number, any> = {
  1: { supplierName: "ABC Supplies" },
  2: { supplierName: "XYZ Traders" },
  3: { supplierName: "Global Imports" },
};
const STATIC_BATCH_DATA = {
  supplierName: "Default Supplier",
};

// Fallback values (BATCH_STATUS not in enum API)
const FALLBACK_STATUS = ["GOOD", "EXPIRING_SOON", "EXPIRED", "EMPTY"];

// Generate Batch Number
const generateBatchNumber = (): string => {
  const prefix = "BATCH";
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `${prefix}-${timestamp}-${random}`;
};

const emptyForm: BatchForm = {
  batchNumber: generateBatchNumber(),
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
      className: "bg-gray-50 text-gray-700 border-gray-200",
      icon: <XCircleIcon className="h-3.5 w-3.5" />,
    };
  }
  const days = getDaysUntilExpiry(batch);
  if (days < 0) {
    return {
      label: "Expired",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircleIcon className="h-3.5 w-3.5" />,
    };
  }
  if (days <= 30) {
    return {
      label: "Expiring Soon",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
      icon: <ExclamationTriangleIcon className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: "Good",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
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

// ============ COMPONENT ============
const BatchManagement: React.FC = () => {
  const navigate = useNavigate();
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
    fetchEnums();
    fetchAllBatches();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchEnums = async (): Promise<void> => {
    // BATCH_STATUS is not provided by the enum API — FALLBACK_STATUS is authoritative for now.
    // Placeholder so enumLoading state pattern stays consistent with the other pages.
  };

  // ============ FETCH ALL BATCHES ============
  const fetchAllBatches = async () => {
    try {
      setLoading(true);

      const [batchRes, stockDetailsRes] = await Promise.all([
        axios.get<Batch[]>(API_URL, { headers }),
        axios.get(BATCH_STOCK_API_URL, { headers }),
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
        const staticData = STATIC_BATCH_DATA_MAP[batch.id] || STATIC_BATCH_DATA;

        return {
          ...batch,
          quantity: stock.quantity || 0,
          reserved: stock.reserved || 0,
          available: stock.available || 0,
          supplierName: staticData.supplierName || "--",
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
      warehouse:
        typeof batch.warehouse === "object"
          ? String(batch.warehouse?.id || "")
          : String(batch.warehouse || ""),
      supplierName: batch.supplierName || "",
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
      batchNumber: form.batchNumber.trim(),
      manufacturingDate: form.manufacturingDate,
      expiryDate: form.expiryDate,
      productId: toNumber(form.productId),
      warehouse: selectedWarehouse ? { id: selectedWarehouse.id } : null,
    };

    if (form.supplierName?.trim()) {
      payload.supplierName = form.supplierName.trim();
    }

    if (editingId) {
      payload.id = editingId;
    }

    return payload;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (
      !form.batchNumber.trim() ||
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

        setBatches((prev) => {
          return prev.map((batch) => {
            if (batch.id === editingId) {
              return {
                ...response.data,
                quantity: batch.quantity || 0,
                reserved: batch.reserved || 0,
                available: batch.available || 0,
                supplierName: payload.supplierName || batch.supplierName || "--",
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

        const newBatch = {
          ...response.data,
          quantity: 0,
          reserved: 0,
          available: 0,
          supplierName: payload.supplierName || "--",
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
      await axios.delete(`${API_URL}/${deleteBatch.id}?cascade=true`, { headers });
      ToasterService.success("Batch deleted successfully");
      setDeleteBatch(null);
      await fetchAllBatches();
    } catch (error) {
      ToasterService.error("Failed to delete batch", getErrorMessage(error, "Please try again."));
    }
  };

  // ============ STATS ============
  const stats = useMemo(() => {
    return {
      total: batches.length,
      expired: batches.filter((b) => getDaysUntilExpiry(b) < 0).length,
      expiringSoon: batches.filter(
        (b) => getDaysUntilExpiry(b) >= 0 && getDaysUntilExpiry(b) <= 30
      ).length,
      totalQuantity: batches.reduce((s, b) => s + (b.quantity || 0), 0),
      totalReserved: batches.reduce((s, b) => s + (b.reserved || 0), 0),
      totalAvailable: batches.reduce((s, b) => s + (b.available || 0), 0),
      emptyBatches: batches.filter((b) => (b.quantity || 0) <= 0).length,
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
        const p = products.find((p) => p.id === batch.productId || p.productId === batch.productId);
        return (
          <span className="text-sm text-slate-700">
            {p ? normalizeProductLabel(p) : `Product #${batch.productId}`}
          </span>
        );
      },
    },
    {
      key: "manufacturingDate",
      label: "MFG Date",
      sortable: true,
      render: (batch) => (
        <span className="text-sm text-slate-700">
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
                days < 0 ? "text-red-600" : days <= 30 ? "text-yellow-600" : "text-slate-600"
              }`}
            >
              {batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "--"}
            </span>
            {days >= 0 && <p className="text-xs text-slate-400">{days} days left</p>}
          </div>
        );
      },
    },
    {
      key: "supplierName",
      label: "Supplier",
      sortable: true,
      render: (batch) => (
        <span className="text-sm text-slate-700">{batch.supplierName || "--"}</span>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      render: (batch) => {
        const name = getWarehouseDisplay(batch);
        const warehouseId = typeof batch.warehouse === "object" && batch.warehouse !== null
          ? Number(batch.warehouse.id)
          : warehouses.find((warehouse) => String(warehouse.id) === String(batch.warehouse) || warehouse.name === batch.warehouse || warehouse.code === batch.warehouse)?.id;
        return warehouseId ? <button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/warehouse?warehouseId=${warehouseId}&warehouseName=${encodeURIComponent(name)}`); }} className="max-w-[210px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline" title={`View ${name}`}>{name}</button> : <span className="text-sm text-slate-700">{name || "--"}</span>;
      },
    },
    {
      key: "quantity",
      label: "Quantity",
      sortable: true,
      render: (batch) => (
        <div>
          <span className="text-sm font-semibold">{batch.quantity || 0}</span>
          {batch.reserved ? (
            <p className="text-xs text-orange-500">Reserved: {batch.reserved}</p>
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
        <div className="flex justify-end gap-1">
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

  return (
    <>
      <PageMeta title="Batch Management" description="Manage product batches" />
      <PageBreadcrumb
        pageTitle="Batch Management"
        actions={<AddButton onClick={openCreate} label="Add Batch" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        {/* Stats */}
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
          data={batches}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="expiryDate"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No batches found</p>
              <button
                type="button"
                onClick={() => fetchAllBatches()}
                className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reload all batches
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
                disabled={!!editingId}
                required={!editingId}
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
                emptyOptionLabel="Select warehouse"
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
            ],
          },
        ]}
      />

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={!!deleteBatch}
        setIsPopupOpen={(open) => !open && setDeleteBatch(null)}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
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
