import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
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
  BuildingOffice2Icon,
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
  status?: string;
  statusLabel?: string;
  statusIcon?: any;
};

type BatchForm = {
  // batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  productId: string;
  warehouse: string;
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

const API_URL = "/v1/api/inventory/batches";
const WAREHOUSE_API_URL = "/v1/api/inventory/warehouses";
const PRODUCT_API_URL = "/v1/api/purchase/products";
const PAGE_SIZE = 10;



const emptyForm: BatchForm = {
  // batchNumber: "",
  manufacturingDate: new Date().toISOString().split("T")[0],
  expiryDate: "",
  productId: "",
  warehouse: "",
};

function toNumber(value: string | number | undefined | null): number {
  return Number(value || 0);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function normalizeProductLabel(product: ProductOption): string {
  const code = product.productCode || product.code || product.sku;
  const name = product.productName || product.name || `Product #${product.id}`;
  return code ? `${name} (${code})` : name;
}

function getBatchStatus(batch: Batch) {
  const today = new Date();
  const expiryDate = new Date(batch.expiryDate);

  if (expiryDate < today) {
    return {
      label: "Expired",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircleIcon className="h-3.5 w-3.5" />,
    };
  }

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  if (expiryDate <= thirtyDaysFromNow) {
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
}

function getDaysUntilExpiry(batch: Batch): number {
  const today = new Date();
  const expiryDate = new Date(batch.expiryDate);
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getWarehouseDisplay(batch: Batch): string {
  if (typeof batch.warehouse === 'object' && batch.warehouse !== null) {
    return batch.warehouse.name || batch.warehouse.code || `ID: ${batch.warehouse.id}`;
  }
  return batch.warehouse || '';
}

const BatchManagement: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;
  const navigate = useNavigate();   

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
  const [deleteBatch, setDeleteBatch] = useState<Batch | null>(null);
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);

  useEffect(() => {
    fetchAllBatches();
    fetchDropdowns();
  }, []);

  const fetchAllBatches = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<Batch[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      
      const batchesWithStatus = data.map((batch) => {
  const status = getBatchStatus(batch);
  return {
    ...batch,
    status: status.label,
    // statusClass: status.className,
    // statusIcon: status.icon,
  };
});
setBatches(batchesWithStatus);     

    } catch (error) {
      setBatches([]);
      ToasterService.error("Failed to load batches", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async (): Promise<void> => {
    try {
      const [warehouseRes, productRes] = await Promise.all([
        axios.get<Warehouse[]>(WAREHOUSE_API_URL, { headers }),
        axios.get<ProductOption[]>(PRODUCT_API_URL, { headers }),
      ]);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
      setProducts(Array.isArray(productRes.data) ? productRes.data : []);
    } catch (error) {
      ToasterService.error("Failed to load dropdown data", getErrorMessage(error, "Please try again."));
    }
  };

  const openCreate = (): void => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const closeForm = (): void => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openEdit = (batch: Batch): void => {
    setEditingId(batch.id);
    setForm({
      // batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      productId: String(batch.productId),
      warehouse: typeof batch.warehouse === 'object' ? String(batch.warehouse?.id || '') : String(batch.warehouse || ''),
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const existing = batches.find((b) => b.id === editingId);
    const selectedWarehouse = warehouses.find(w => String(w.id) === form.warehouse);

    const warehouseObject = selectedWarehouse ? {
      id: selectedWarehouse.id,
      createdDate: selectedWarehouse.createdDate || new Date().toISOString(),
      updatedDate: selectedWarehouse.updatedDate || new Date().toISOString(),
      createdBy: selectedWarehouse.createdBy || "",
      tenantId: selectedWarehouse.tenantId || "",
      code: selectedWarehouse.code || "",
      name: selectedWarehouse.name || "",
      locationType: selectedWarehouse.locationType || "MAIN",
      stockLevels: selectedWarehouse.stockLevels || [],
      batches: selectedWarehouse.batches || [],
      serialNumbers: selectedWarehouse.serialNumbers || [],
      stockMovements: selectedWarehouse.stockMovements || [],
      stockAdjustments: selectedWarehouse.stockAdjustments || [],
      stockEntries: selectedWarehouse.stockEntries || [],
    } : null;

    if (!editingId) {
      return {
        // batchNumber: form.batchNumber.trim(),
        manufacturingDate: form.manufacturingDate,
        expiryDate: form.expiryDate,
        productId: toNumber(form.productId),
        warehouse: warehouseObject,
        inspections: [],
      };
    }

    return {
      id: editingId,
      createdDate: existing?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      createdBy: existing?.createdBy || "",
      tenantId: existing?.tenantId || "",
      // batchNumber: form.batchNumber.trim(),
      manufacturingDate: form.manufacturingDate,
      expiryDate: form.expiryDate,
      productId: toNumber(form.productId),
      warehouse: warehouseObject,
      inspections: existing?.inspections || [],
    };
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    // if (!form.batchNumber.trim()) {
    //   ToasterService.error("Batch Number is required");
    //   return;
    // }
    if (!form.manufacturingDate) {
      ToasterService.error("Manufacturing Date is required");
      return;
    }
    if (!form.expiryDate) {
      ToasterService.error("Expiry Date is required");
      return;
    }
    if (!form.productId) {
      ToasterService.error("Product is required");
      return;
    }
    if (!form.warehouse) {
      ToasterService.error("Warehouse is required");
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

  const confirmDelete = async (): Promise<void> => {
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

  const filteredBatches = useMemo(() => {
    const term = searchableText(search);

    return batches.filter((batch) => {
      const product = products.find((p) => p.id === batch.productId || p.productId === batch.productId);
      const productName = product ? normalizeProductLabel(product) : `Product #${batch.productId}`;
      const warehouseName = typeof batch.warehouse === 'object' ? batch.warehouse?.name || '' : batch.warehouse || '';

      const searchString = `${batch.id} ${batch.batchNumber} ${productName} ${warehouseName}`.toLowerCase();
      const matchesSearch = !term || searchString.includes(term);

      let matchesStatus = true;
      if (statusFilter === "expired") {
        matchesStatus = new Date(batch.expiryDate) < new Date();
      } else if (statusFilter === "expiring") {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        const expiry = new Date(batch.expiryDate);
        matchesStatus = expiry > today && expiry <= thirtyDaysFromNow;
      } else if (statusFilter === "good") {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        matchesStatus = new Date(batch.expiryDate) > thirtyDaysFromNow;
      }

      return matchesSearch && matchesStatus;
    });
  }, [batches, search, statusFilter, products]);

  const stats = useMemo(
    () => {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      return {
        total: batches.length,
        expired: batches.filter((b) => new Date(b.expiryDate) < today).length,
        expiringSoon: batches.filter((b) => {
          const expiry = new Date(b.expiryDate);
          return expiry > today && expiry <= thirtyDaysFromNow;
        }).length,
        withFailedInspections: batches.filter((b) => b.inspections.some((i) => i.result === "FAIL")).length,
      };
    },
    [batches]
  );

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
          <div>
            <p className="text-sm font-semibold text-slate-900">{batch.batchNumber}</p>
            {/* <p className="text-xs text-slate-400">ID: #{batch.name}</p> */}
          </div>
        </div>
      ),
    },
    {
  key: "productId",
  label: "Product",
  sortable: true,
  render: (batch) => {
    const product = products.find((p) => p.id === batch.productId || p.productId === batch.productId);
    return (
      <button
        className="text-sm text-slate-700 hover:text-cyan-600 hover:underline transition-colors"
        onClick={() => {
          const productId = batch.productId;
          if (productId) {
            navigate(`/products?productId=${productId}`);
          }
        }}
      >
        {product ? normalizeProductLabel(product) : `Product #${batch.productId}`}
      </button>
    );
  },
},
    {
  key: "warehouse",
  label: "Warehouse",
  sortable: true,
  render: (batch) => {
    const warehouseId = typeof batch.warehouse === 'object' 
      ? batch.warehouse?.id?.toString() 
      : batch.warehouse;
    
    return (
      <button
        className="flex items-center gap-2 text-sm text-slate-700 hover:text-cyan-600 transition-colors"
        onClick={() => {
          if (warehouseId) {
            navigate(`/warehouse?warehouseId=${warehouseId}`);
          }
        }}
      >
        <BuildingOffice2Icon className="h-4 w-4 text-slate-400" />
        <span>{getWarehouseDisplay(batch)}</span>
      </button>
    );
  },
},
    {
      key: "manufacturingDate",
      label: "Manufacturing",
      sortable: true,
      render: (batch) => (
        <span className="text-sm text-slate-600">
          {new Date(batch.manufacturingDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "expiryDate",
      label: "Expiry",
      sortable: true,
      render: (batch) => {
        const daysUntilExpiry = getDaysUntilExpiry(batch);
        const isExpired = daysUntilExpiry < 0;
        const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

        return (
          <div>
            <span className={`text-sm ${isExpired ? "text-red-600" : isExpiringSoon ? "text-yellow-600" : "text-slate-600"}`}>
              {new Date(batch.expiryDate).toLocaleDateString()}
            </span>
            {!isExpired && <p className="text-xs text-slate-400">{daysUntilExpiry} days left</p>}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      sortable: false,
      render: (batch) => {
        const status = getBatchStatus(batch);
        return (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.icon}
            {status.label}
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
            type="button"
            onClick={() => setViewBatch(batch)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(batch)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteBatch(batch)}
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
      <PageMeta title="Batch Management" description="Manage product batches" />
      <PageBreadcrumb pageTitle="Batch Management" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Batch" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Batches"
            value={stats.total}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<CubeIcon className="h-5 w-5" />}
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
            label="Expiring Soon"
            value={stats.expiringSoon}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-700"
            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Failed Inspections"
            value={stats.withFailedInspections}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ExclamationCircleIcon className="h-5 w-5" />}
          />
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search batches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-purple-500"
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

          <FilterPopover
            title="Filter Batches"
            buttonLabel="Filters"
            label="Status"
            value={statusFilter}
            options={[
              { label: "All Status", value: "" },
              { label: "Expired", value: "expired" },
              { label: "Expiring Soon", value: "expiring" },
              { label: "Good", value: "good" },
            ]}
            onChange={setStatusFilter}
            onReset={() => setStatusFilter("")}
            onApply={() => undefined}
          />
        </div>

        <ReusableTable
          data={filteredBatches}
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
                onClick={openCreate}
                className="text-xs font-medium text-purple-600 hover:text-purple-700"
              >
                Create your first batch
              </button>
            </div>
          }
        />
      </div>

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
        // <FloatingInput
        //   key="batchNumber"
        //   label="Batch Number"
        //   name="batchNumber"
        //   value={form.batchNumber}
        //   onChange={handleChange}
        //   required
        // />,
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
            name: `${w.name || ''}`,
          }))}
          required
        />,
      ],
    },
  ]}
/>

      <DynamicPopup
        isPopupOpen={!!deleteBatch}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteBatch(null);
        }}
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