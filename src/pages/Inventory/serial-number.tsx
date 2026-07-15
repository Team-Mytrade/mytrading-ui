import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  QrCodeIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

interface Product {
  id: number;
  productName: string;
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
  serial: string;
  warrantyStart: string;
  warrantyEnd: string;
  productId: string;
  warehouseId: string;
  batchId: string;
};

const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase";
const PAGE_SIZE = 10;

const emptyForm: SerialNumberForm = {
  serial: "",
  warrantyStart: "",
  warrantyEnd: "",
  productId: "",
  warehouseId: "",
  batchId: "",
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

function isWarrantyActive(warrantyEnd: string) {
  if (!warrantyEnd) return false;
  const end = new Date(warrantyEnd);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() >= Date.now();
}

const SerialNumberManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [serialNumbers, setSerialNumbers] = useState<SerialNumber[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRef[]>([]);
  const [batches, setBatches] = useState<BatchRef[]>([]);
  const [form, setForm] = useState<SerialNumberForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterProductId, setFilterProductId] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState("");
  const [filterBatchId, setFilterBatchId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    fetchSerialNumbers();
    fetchProducts();
    fetchWarehouses();
    fetchBatches();
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
      const res = await axios.get<Product[]>(`${PRODUCT_URL}/products`, { headers });
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get<WarehouseRef[]>(`${API_URL}/warehouses`, { headers });
      setWarehouses(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await axios.get<BatchRef[]>(`${API_URL}/batches`, { headers });
      setBatches(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load batches", getErrorMessage(error, "Please try again."));
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const productId = Number(form.productId) || 0;
    const warehouseId = Number(form.warehouseId) || 0;
    const batchId = Number(form.batchId) || 0;

    return {
      id: editingId || 0,
      serial: form.serial.trim(),
      warrantyStart: form.warrantyStart,
      warrantyEnd: form.warrantyEnd,
      productId,
      productNumber: products.find((item) => item.id === productId)?.productName || "",
      warehouse: warehouseId ? { id: warehouseId } : null,
      batch: batchId ? { id: batchId } : null,
      inspections: [],
    };
  };

  // Client-side uniqueness check. The API schema does not enforce a serial
  // pattern or uniqueness constraint, so we guard against duplicates here
  // before hitting the server.
  const isDuplicateSerial = (serial: string) => {
    const normalized = serial.trim().toLowerCase();
    return serialNumbers.some(
      (sn) => sn.serial?.trim().toLowerCase() === normalized && sn.id !== editingId
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const trimmedSerial = form.serial.trim();

    if (!trimmedSerial) {
      ToasterService.error("Required field missing", "Serial number is required.");
      return;
    }
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
    if (isDuplicateSerial(trimmedSerial)) {
      ToasterService.error("Duplicate serial number", "This serial number already exists.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      editingId
        ? await axios.put(`${API_URL}/serial-numbers/${editingId}`, payload, { headers })
        : await axios.post(`${API_URL}/serial-numbers`, payload, { headers });

      ToasterService.success(editingId ? "Serial number updated" : "Serial number created");
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
      serial: sn.serial || "",
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

  const handleDelete = async (sn: SerialNumber) => {
    if (!window.confirm(`Delete serial number "${sn.serial || sn.id}"?`)) return;

    try {
      await axios.delete(`${API_URL}/serial-numbers/${sn.id}`, { headers });
      ToasterService.success("Serial number deleted");
      setSerialNumbers((current) => current.filter((item) => item.id !== sn.id));
    } catch (error) {
      ToasterService.error("Failed to delete serial number", getErrorMessage(error, "Please try again."));
    }
  };

  const filteredSerialNumbers = useMemo(() => {
    const term = searchableText(search);

    return serialNumbers.filter((sn) => {
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
    });
  }, [serialNumbers, search, filterProductId, filterWarehouseId, filterBatchId, filterStatus]);

  const activeFilterCount = [filterProductId, filterWarehouseId, filterBatchId, filterStatus].filter(
    Boolean
  ).length;

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
      render: (sn) =>
        sn.productNumber || products.find((p) => p.id === sn.productId)?.productName || "N/A",
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      render: (sn) => sn.warehouse?.name || "N/A",
    },
    {
      key: "batch",
      label: "Batch",
      sortable: true,
      render: (sn) => sn.batch?.batchNumber || "N/A",
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
      label: "Status",
      sortable: false,
      render: (sn) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            isWarrantyActive(sn.warrantyEnd) ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {isWarrantyActive(sn.warrantyEnd) ? "In Warranty" : "Expired"}
        </span>
      ),
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
            onClick={() => openEdit(sn)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(sn)}
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

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/3 h-5 w-5 -translate-y-1/2 text-gray-400" />
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

          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className={`relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showFilters || activeFilterCount > 0
                ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            Filter
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-xs font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <FloatingSelect
              label="Product"
              name="filterProductId"
              value={filterProductId}
              onChange={(e) => setFilterProductId(e.target.value)}
              options={products.map((product) => ({ id: String(product.id), name: product.productName }))}
            />
            <FloatingSelect
              label="Warehouse"
              name="filterWarehouseId"
              value={filterWarehouseId}
              onChange={(e) => setFilterWarehouseId(e.target.value)}
              options={warehouses.map((warehouse) => ({ id: String(warehouse.id), name: warehouse.name }))}
            />
            <FloatingSelect
              label="Batch"
              name="filterBatchId"
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
              options={batches.map((batch) => ({ id: String(batch.id), name: batch.batchNumber }))}
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
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}

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

      {showFormModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingId ? "Edit Serial Number" : "Create Serial Number"}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">Enter serial number details from the API schema</p>
                </div>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <FloatingInput
                    label="Serial"
                    name="serial"
                    value={form.serial}
                    onChange={handleChange}
                    required
                  />
                  <FloatingSelect
                    label="Product"
                    name="productId"
                    value={form.productId}
                    onChange={handleChange}
                    options={products.map((product) => ({ id: String(product.id), name: product.productName }))}
                  />
                  <FloatingSelect
                    label="Warehouse"
                    name="warehouseId"
                    value={form.warehouseId}
                    onChange={handleChange}
                    options={warehouses.map((warehouse) => ({ id: String(warehouse.id), name: warehouse.name }))}
                  />
                  <FloatingSelect
                    label="Batch"
                    name="batchId"
                    value={form.batchId}
                    onChange={handleChange}
                    options={batches.map((batch) => ({ id: String(batch.id), name: batch.batchNumber }))}
                  />
                  <FloatingInput
                    label="Warranty Start"
                    name="warrantyStart"
                    type="date"
                    value={form.warrantyStart}
                    onChange={handleChange}
                    required
                  />
                  <FloatingInput
                    label="Warranty End"
                    name="warrantyEnd"
                    type="date"
                    value={form.warrantyEnd}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Serial Number" : "Create Serial Number"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default SerialNumberManager;
