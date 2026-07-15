import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
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

interface Product {
  id: number;
  productName: string;
  productSku?: string;
  currentStock?: number;
}

interface Warehouse {
  id: number;
  name: string;
  code?: string;
  location?: string;
}

interface Batch {
  id: number;
  batchNumber: string;
  productId?: number;
  expiryDate?: string;
  quantity?: number;
}

interface SerialNumber {
  id: number;
  serial: string;
  batchId?: number;
  productId?: number;
  status?: "AVAILABLE" | "SOLD" | "DAMAGED";
}

enum AdjustmentType {
  POSITIVE = "POSITIVE",
  NEGATIVE = "NEGATIVE",
}

interface StockAdjustment {
  id: number;
  adjustmentDate: string;
  reason: string;
  quantity: number;
  adjustmentType: AdjustmentType;
  product?: Product;
  warehouse?: Warehouse;
  batch?: Batch;
  serialNumber?: SerialNumber;
  reference?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

type StockAdjustmentForm = {
  adjustmentDate: string;
  reason: string;
  quantity: string;
  adjustmentType: AdjustmentType;
  productId: string;
  warehouseId: string;
  batchId: string;
  serialNumberId: string;
  reference: string;
};

const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase";
const PAGE_SIZE = 10;

const emptyForm: StockAdjustmentForm = {
  adjustmentDate: new Date().toISOString().split('T')[0],
  reason: "",
  quantity: "",
  adjustmentType: AdjustmentType.POSITIVE,
  productId: "",
  warehouseId: "",
  batchId: "",
  serialNumberId: "",
  reference: "",
};

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

function getTypeBadge(type: AdjustmentType) {
  if (type === "POSITIVE") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  return "bg-red-50 text-red-700 border-red-200";
}

function getTypeIcon(type: AdjustmentType) {
  if (type === "POSITIVE") {
    return <ArrowUpIcon className="h-3 w-3 mr-1" />;
  }
  return <ArrowDownIcon className="h-3 w-3 mr-1" />;
}

const StockAdjustmentManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [filteredSerialNumbers, setFilteredSerialNumbers] = useState<SerialNumber[]>([]);
  const [form, setForm] = useState<StockAdjustmentForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [deletingAdjustment, setDeletingAdjustment] = useState<StockAdjustment | null>(null);
  const [viewingAdjustment, setViewingAdjustment] = useState<StockAdjustment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchAdjustments(),
        fetchProducts(),
        fetchWarehouses(),
        fetchBatches(),
        fetchSerialNumbers(),
      ]);
    } catch (error) {
      ToasterService.error("Failed to load data", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const res = await axios.get<StockAdjustment[]>(`${API_URL}/stock-adjustments`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setAdjustments(data);
      if (data.length === 0) ToasterService.noData("No stock adjustments found");
    } catch (error) {
      ToasterService.error("Failed to load stock adjustments", getErrorMessage(error, "Please try again."));
      setAdjustments([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get<Product[]>(`${PRODUCT_URL}/products`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setProducts(data);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get<Warehouse[]>(`${API_URL}/warehouses`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setWarehouses(data);
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get<Batch[]>(`${API_URL}/batches`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setBatches(data);
    } catch (error) {
      ToasterService.error("Failed to load batches", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchSerialNumbers = async () => {
    try {
      const res = await axios.get<SerialNumber[]>(`${API_URL}/serial-numbers`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setSerialNumbers(data);
    } catch (error) {
      ToasterService.error("Failed to load serial numbers", getErrorMessage(error, "Please try again."));
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleProductChange = (productId: string) => {
    setForm((prev) => ({ ...prev, productId, batchId: "", serialNumberId: "" }));
    if (productId) {
      const filtered = batches.filter((b) => b.productId === Number(productId));
      setFilteredBatches(filtered);
    } else {
      setFilteredBatches([]);
      setFilteredSerialNumbers([]);
    }
  };

  const handleBatchChange = (batchId: string) => {
    setForm((prev) => ({ ...prev, batchId, serialNumberId: "" }));
    if (batchId) {
      const filtered = serialNumbers.filter((sn) => sn.batchId === Number(batchId));
      setFilteredSerialNumbers(filtered);
    } else {
      setFilteredSerialNumbers([]);
    }
  };

  const buildPayload = () => {
    return {
      id: editingId || 0,
      adjustmentDate: form.adjustmentDate,
      reason: form.reason.trim(),
      quantity: Number(form.quantity),
      adjustmentType: form.adjustmentType,
      productId: Number(form.productId),
      warehouse: form.warehouseId ? { id: Number(form.warehouseId) } : null,
      batch: form.batchId ? { id: Number(form.batchId) } : null,
      serialNumber: form.serialNumberId ? { id: Number(form.serialNumberId) } : null,
      reference: form.reference.trim() || null,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const quantity = Number(form.quantity);

    if (!form.productId) {
      ToasterService.error("Required field missing", "Product selection is required.");
      return;
    }
    if (!form.warehouseId) {
      ToasterService.error("Required field missing", "Warehouse selection is required.");
      return;
    }
    if (!quantity || quantity <= 0) {
      ToasterService.error("Invalid quantity", "Quantity must be greater than 0.");
      return;
    }
    if (!form.reason.trim()) {
      ToasterService.error("Required field missing", "Please provide a reason for the adjustment.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      
      if (editingId) {
        await axios.put(`${API_URL}/stock-adjustments/${editingId}`, payload, { headers });
        ToasterService.success("Stock adjustment updated");
      } else {
        await axios.post(`${API_URL}/stock-adjustments`, payload, { headers });
        ToasterService.success("Stock adjustment created");
      }
      
      closeForm();
      fetchAdjustments();
    } catch (error) {
      ToasterService.error("Failed to save stock adjustment", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      adjustmentDate: new Date().toISOString().split('T')[0],
    });
    setFilteredBatches([]);
    setFilteredSerialNumbers([]);
    setShowFormModal(true);
  };

  const openEdit = (adjustment: StockAdjustment) => {
    setEditingId(adjustment.id);
    setForm({
      adjustmentDate: adjustment.adjustmentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      reason: adjustment.reason || "",
      quantity: String(adjustment.quantity || 0),
      adjustmentType: adjustment.adjustmentType || AdjustmentType.POSITIVE,
      productId: String(adjustment.product?.id || ""),
      warehouseId: String(adjustment.warehouse?.id || ""),
      batchId: String(adjustment.batch?.id || ""),
      serialNumberId: String(adjustment.serialNumber?.id || ""),
      reference: adjustment.reference || "",
    });

    if (adjustment.product?.id) {
      const filtered = batches.filter((b) => b.productId === adjustment.product?.id);
      setFilteredBatches(filtered);
    }
    if (adjustment.batch?.id) {
      const filtered = serialNumbers.filter((sn) => sn.batchId === adjustment.batch?.id);
      setFilteredSerialNumbers(filtered);
    }

    setShowFormModal(true);
  };

  const openView = (adjustment: StockAdjustment) => {
    setViewingAdjustment(adjustment);
    setShowViewModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFilteredBatches([]);
    setFilteredSerialNumbers([]);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deletingAdjustment) return;

    try {
      await axios.delete(`${API_URL}/stock-adjustments/${deletingAdjustment.id}`, { headers });
      ToasterService.success("Stock adjustment deleted");
      setAdjustments((current) => current.filter((item) => item.id !== deletingAdjustment.id));
    } catch (error) {
      ToasterService.error("Failed to delete stock adjustment", getErrorMessage(error, "Please try again."));
    } finally {
      setDeletingAdjustment(null);
    }
  };

  const filteredAdjustments = useMemo(() => {
    const term = searchableText(search);

    return adjustments.filter((adjustment) => {
      if (filterType && adjustment.adjustmentType !== filterType) return false;
      if (filterDateFrom && new Date(adjustment.adjustmentDate) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(adjustment.adjustmentDate) > new Date(filterDateTo)) return false;

      if (!term) return true;

      const haystack = [
        adjustment.reason,
        adjustment.reference,
        adjustment.quantity,
        adjustment.adjustmentType,
        adjustment.product?.productName,
        adjustment.product?.productSku,
        adjustment.warehouse?.name,
        adjustment.warehouse?.code,
        adjustment.batch?.batchNumber,
        adjustment.serialNumber?.serial,
        adjustment.id,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [adjustments, search, filterType, filterDateFrom, filterDateTo]);

  const resetFilters = () => {
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const stats = useMemo(
    () => ({
      total: adjustments.length,
      positive: adjustments.filter((a) => a.adjustmentType === AdjustmentType.POSITIVE).length,
      negative: adjustments.filter((a) => a.adjustmentType === AdjustmentType.NEGATIVE).length,
      totalAdded: adjustments
        .filter((a) => a.adjustmentType === AdjustmentType.POSITIVE)
        .reduce((sum, a) => sum + a.quantity, 0),
      totalRemoved: adjustments
        .filter((a) => a.adjustmentType === AdjustmentType.NEGATIVE)
        .reduce((sum, a) => sum + a.quantity, 0),
    }),
    [adjustments]
  );

  const netChange = stats.totalAdded - stats.totalRemoved;

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: String(product.id),
      name: product.productSku ? `${product.productName} (${product.productSku})` : product.productName,
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((warehouse) => ({
      id: String(warehouse.id),
      name: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
    }));
  }, [warehouses]);

  const batchOptions = useMemo(() => {
    return filteredBatches.map((batch) => ({
      id: String(batch.id),
      name: batch.expiryDate 
        ? `${batch.batchNumber} (Exp: ${new Date(batch.expiryDate).toLocaleDateString()})`
        : batch.batchNumber,
    }));
  }, [filteredBatches]);

  const serialOptions = useMemo(() => {
    return filteredSerialNumbers.map((serial) => ({
      id: String(serial.id),
      name: serial.status ? `${serial.serial} (${serial.status})` : serial.serial,
    }));
  }, [filteredSerialNumbers]);

  const typeOptions = useMemo(() => {
    return [
      { id: "POSITIVE", name: "Stock In" },
      { id: "NEGATIVE", name: "Stock Out" },
    ];
  }, []);

  const columns: ColumnDef<StockAdjustment>[] = [
    {
      key: "adjustmentDate",
      label: "Date",
      sortable: true,
      sortValueGetter: (adjustment) => new Date(adjustment.adjustmentDate).getTime(),
      render: (adjustment) => (
        <div>
          <p className="text-sm font-medium text-gray-900">
            {new Date(adjustment.adjustmentDate).toLocaleDateString()}
          </p>
          {adjustment.createdAt && (
            <p className="text-xs text-gray-500">
              {new Date(adjustment.createdAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (adjustment) => adjustment.product?.productName || "",
      render: (adjustment) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{adjustment.product?.productName || "N/A"}</p>
          {adjustment.product?.productSku && (
            <p className="text-xs text-gray-500">SKU: {adjustment.product.productSku}</p>
          )}
        </div>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      sortValueGetter: (adjustment) => adjustment.warehouse?.name || "",
      render: (adjustment) => (
        <div>
          <p className="text-sm text-gray-900">{adjustment.warehouse?.name || "N/A"}</p>
          {adjustment.warehouse?.code && (
            <p className="text-xs text-gray-500">{adjustment.warehouse.code}</p>
          )}
        </div>
      ),
    },
    {
      key: "adjustmentType",
      label: "Type",
      sortable: true,
      render: (adjustment) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${getTypeBadge(adjustment.adjustmentType)}`}>
          {getTypeIcon(adjustment.adjustmentType)}
          {adjustment.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out"}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      sortable: true,
      render: (adjustment) => (
        <span className={`text-sm font-semibold ${adjustment.adjustmentType === "POSITIVE" ? "text-green-600" : "text-red-600"}`}>
          {adjustment.adjustmentType === "POSITIVE" ? "+" : "-"}{adjustment.quantity}
        </span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      sortable: true,
      render: (adjustment) => (
        <div>
          <p className="text-sm text-gray-700 line-clamp-2">{adjustment.reason || "-"}</p>
          {adjustment.reference && (
            <p className="text-xs text-gray-500 mt-1">Ref: {adjustment.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (adjustment) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(adjustment)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => openEdit(adjustment)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingAdjustment(adjustment)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // Render adjustment details for view modal
  const getAdjustmentDetailsText = (adjustment: StockAdjustment): string => {
    if (!adjustment) return "No adjustment details available";
    
    let details = `Adjustment Date: ${new Date(adjustment.adjustmentDate).toLocaleDateString()}`;
    details += `\nType: ${adjustment.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out"}`;
    details += `\nProduct: ${adjustment.product?.productName || "N/A"}`;
    if (adjustment.product?.productSku) {
      details += `\nSKU: ${adjustment.product.productSku}`;
    }
    details += `\nWarehouse: ${adjustment.warehouse?.name || "N/A"}`;
    if (adjustment.warehouse?.code) {
      details += ` (${adjustment.warehouse.code})`;
    }
    if (adjustment.batch) {
      details += `\nBatch: ${adjustment.batch.batchNumber}`;
      if (adjustment.batch.expiryDate) {
        details += ` (Expires: ${new Date(adjustment.batch.expiryDate).toLocaleDateString()})`;
      }
    }
    if (adjustment.serialNumber) {
      details += `\nSerial: ${adjustment.serialNumber.serial}`;
      if (adjustment.serialNumber.status) {
        details += ` (${adjustment.serialNumber.status})`;
      }
    }
    details += `\n\nQuantity: ${adjustment.adjustmentType === "POSITIVE" ? "+" : "-"}${adjustment.quantity}`;
    details += `\nReason: ${adjustment.reason || "—"}`;
    if (adjustment.reference) {
      details += `\nReference: ${adjustment.reference}`;
    }
    if (adjustment.createdBy) {
      details += `\nCreated By: ${adjustment.createdBy}`;
    }
    if (adjustment.createdAt) {
      details += `\nCreated At: ${new Date(adjustment.createdAt).toLocaleString()}`;
    }
    if (adjustment.approvedBy) {
      details += `\nApproved By: ${adjustment.approvedBy}`;
    }
    if (adjustment.approvedAt) {
      details += `\nApproved At: ${new Date(adjustment.approvedAt).toLocaleString()}`;
    }
    
    return details;
  };

  return (
    <>
      <PageMeta title="Stock Adjustment" description="Manage inventory stock adjustments" />
      <PageBreadcrumb pageTitle="Stock Adjustment" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Adjustment" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Adjustments"
            value={stats.total}
            icon={<ClipboardDocumentCheckIcon />}
          />
          <StatsCard
            label="Stock In"
            value={stats.positive}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<ArrowUpIcon />}
          />
          <StatsCard
            label="Stock Out"
            value={stats.negative}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ArrowDownIcon />}
          />
          <StatsCard
            label="Net Change"
            value={`${netChange >= 0 ? "+" : ""}${netChange.toLocaleString()}`}
            gradient="from-amber-50 to-orange-50"
            borderColor="border-amber-100"
            labelColor="text-amber-600"
            icon={<ChartBarIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product, reason, or reference..."
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
              title="Stock Adjustments"
              subtitle="Filtered stock adjustment listing"
              reportLabel="Stock Adjustments Report"
              data={filteredAdjustments}
              fileName="Stock_Adjustments"
              disabled={loading}
              metadata={(rows) => [
                { label: "Total", value: rows.length },
                { label: "Search", value: search || "None" },
                { label: "Net Change", value: rows.reduce((sum, a) => sum + (a.adjustmentType === "POSITIVE" ? a.quantity : -a.quantity), 0) },
              ]}
              columns={[
                { key: "adjustmentDate", header: "Date" },
                { key: "product", header: "Product" },
                { key: "warehouse", header: "Warehouse" },
                { key: "adjustmentType", header: "Type" },
                { key: "quantity", header: "Quantity" },
                { key: "reason", header: "Reason" },
              ]}
            />
            <FilterPopover
              title="Filter Adjustments"
              buttonLabel="Filters"
              widthClassName="w-[21rem] sm:w-[23rem]"
              showFooter={false}
            >
              <div className="space-y-3">
                <FloatingSelect
                  label="Adjustment Type"
                  name="filterType"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  options={typeOptions}
                />
                <FloatingInput
                  label="From Date"
                  name="filterDateFrom"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
                <FloatingInput
                  label="To Date"
                  name="filterDateTo"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
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
          data={filteredAdjustments}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="adjustmentDate"
          defaultSortOrder="desc"
          onRowClick={openView}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardDocumentCheckIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No stock adjustments found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first adjustment
              </button>
            </div>
          }
        />
      </div>

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Stock Adjustment" : "Add Stock Adjustment"}
        subtitle="Enter stock adjustment details"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Adjustment" : "Create Adjustment"}
        tabs={[
          {
            label: "Details",
            fields: [
              <FloatingInput
                key="adjustmentDate"
                label="Adjustment Date"
                name="adjustmentDate"
                type="date"
                value={form.adjustmentDate}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="adjustmentType"
                label="Adjustment Type"
                name="adjustmentType"
                value={form.adjustmentType}
                onChange={handleChange}
                options={typeOptions}
                required
              />,
              <FloatingSelect
                key="productId"
                label="Product"
                name="productId"
                value={form.productId}
                onChange={(e) => handleProductChange(e.target.value)}
                options={productOptions}
                required
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                options={warehouseOptions}
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
            ],
          },
          {
            label: "Additional",
            fields: [
              <FloatingSelect
                key="batchId"
                label="Batch (Optional)"
                name="batchId"
                value={form.batchId}
                onChange={(e) => handleBatchChange(e.target.value)}
                options={batchOptions}
                disabled={!form.productId}
              />,
              <FloatingSelect
                key="serialNumberId"
                label="Serial Number (Optional)"
                name="serialNumberId"
                value={form.serialNumberId}
                onChange={handleChange}
                options={serialOptions}
                disabled={!form.batchId}
              />,
              <FloatingInput
                key="reference"
                label="Reference (Optional)"
                name="reference"
                value={form.reference}
                onChange={handleChange}
              />,
              <FloatingInput
                key="reason"
                label="Reason"
                name="reason"
                value={form.reason}
                onChange={handleChange}
                required
              />,
            ],
          },
        ]}
      />

      {/* View Details Modal */}
      <DynamicPopup
        isPopupOpen={showViewModal && !!viewingAdjustment}
        setIsPopupOpen={(open: boolean) => {
          if (!open) {
            setShowViewModal(false);
            setViewingAdjustment(null);
          }
        }}
        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-cyan-600" />}
        iconBg="bg-cyan-100"
        innerText="Adjustment Details"
        subText={viewingAdjustment ? getAdjustmentDetailsText(viewingAdjustment) : "No adjustment details available"}
        confirmLabel="Edit"
        cancelLabel="Close"
        onConfirm={() => {
          if (viewingAdjustment) {
            setShowViewModal(false);
            openEdit(viewingAdjustment);
          }
        }}
        onCancel={() => {
          setShowViewModal(false);
          setViewingAdjustment(null);
        }}
        confirmBtnClass="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white"
      />

      {/* Delete Confirmation Modal */}
      <DynamicPopup
        isPopupOpen={!!deletingAdjustment}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingAdjustment(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Adjustment"
        subText={
          deletingAdjustment
            ? `Are you sure you want to delete the ${deletingAdjustment.adjustmentType === "POSITIVE" ? "stock in" : "stock out"} adjustment for "${deletingAdjustment.product?.productName || "this product"}" (${deletingAdjustment.quantity} units)? This action cannot be undone.`
            : "Are you sure you want to delete this adjustment?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingAdjustment(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default StockAdjustmentManager;