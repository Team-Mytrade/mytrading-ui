import React, { ChangeEvent, FormEvent, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PrinterIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import DynamicPopup from "../../components/common/Popup";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { AuthContext } from "../../context/AuthContext";

type WarehouseLocationType = "MAIN" | "SUB" | "STORE";

interface StockLevel {
  id: number;
  quantity: number;
  reserved: number;
  available: number;
  productId: number;
  warehouse: string;
}

interface Batch {
  id: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  productId: number;
  warehouse: string;
  inspections: any[];
}

interface SerialNumber {
  id: number;
  serial: string;
  warrantyStart: string;
  warrantyEnd: string;
  productId: number;
  productNumber: string;
  warehouse: string;
  batch: Batch;
  inspections: any[];
}

interface StockMovement {
  id: number;
  movementDate: string;
  movementType: "GRN" | "SALES_ORDER" | "TRANSFER_OUT" | "TRANSFER_IN" | "RETURN" | "ADJUSTMENT";
  quantity: number;
  fromLocation: string;
  toLocation: string;
  reference: string;
  productId: number;
  warehouse: string;
  batch: Batch;
  serialNumber: SerialNumber;
}

interface StockAdjustment {
  id: number;
  adjustmentDate: string;
  reason: string;
  quantity: number;
  adjustmentType: "POSITIVE" | "NEGATIVE";
  productId: number;
  warehouse: string;
  batch: Batch;
  serialNumber: SerialNumber;
}

interface StockEntry {
  id: number;
  type: "GRN" | "SALES_ORDER" | "TRANSFER" | "ADJUSTMENT";
  quantity: number;
  movementDate: string;
  referenceNo: string;
  productId: number;
  reservedQty: number;
  minStockLevel: number;
  warehouse: string;
}

interface Warehouse {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code: string;
  name: string;
  locationType: WarehouseLocationType;
  stockLevels: StockLevel[];
  batches: Batch[];
  serialNumbers: SerialNumber[];
  stockMovements: StockMovement[];
  stockAdjustments: StockAdjustment[];
  stockEntries: StockEntry[];
}

interface WarehouseForm {
  code: string;
  name: string;
  locationType: WarehouseLocationType;
}

const API_URL = "/v1/api/inventory/warehouses";
const PAGE_SIZE = 10;
const locationTypeOptions: WarehouseLocationType[] = ["MAIN", "SUB", "STORE"];

const emptyForm: WarehouseForm = {
  code: "",
  name: "",
  locationType: "MAIN",
};

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
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function getLocationTypeColor(type: WarehouseLocationType) {
  switch (type) {
    case "MAIN":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "SUB":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "STORE":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

const WarehousePage: React.FC = () => {
  const { user } = useContext(AuthContext);
  const authUser = getStoredUser();

  const headers = useMemo(() => {
    const token = localStorage.getItem("accessToken");
    const tenantId = user?.tenantId || authUser.tenantId || "";
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
    };
  }, [authUser.tenantId, user?.tenantId]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);
  const [viewWarehouse, setViewWarehouse] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [locationTypeFilter, setLocationTypeFilter] = useState("");

  useEffect(() => {
    void fetchWarehouses();
  }, []);

  const fetchWarehouses = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<Warehouse[]>(API_URL, { headers });
      setWarehouses(response.data);
    } catch (error) {
      setWarehouses([]);
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouseById = async (): Promise<void> => {
    if (!lookupId.trim()) {
      ToasterService.error("Warehouse ID is required");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get<Warehouse>(`${API_URL}/${lookupId.trim()}`, { headers });
      setWarehouses([response.data]);
      ToasterService.success("Warehouse loaded");
    } catch (error) {
      ToasterService.error("Failed to load warehouse", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouseByCode = async (): Promise<void> => {
    if (!lookupCode.trim()) {
      ToasterService.error("Warehouse code is required");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get<Warehouse>(`${API_URL}/code/${encodeURIComponent(lookupCode.trim())}`, { headers });
      setWarehouses([response.data]);
      ToasterService.success("Warehouse loaded");
    } catch (error) {
      ToasterService.error("Failed to load warehouse by code", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async (): Promise<void> => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (locationTypeFilter) params.set("location", locationTypeFilter);
      if (search.trim()) params.set("name", search.trim());

      const response = await axios.get<{ content: Warehouse[] }>(`${API_URL}/filter?${params.toString()}`, { headers });
      setWarehouses(response.data.content || []);
      setShowFilters(false);
    } catch (error) {
      ToasterService.error("Failed to apply filters", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = async (): Promise<void> => {
    setLocationTypeFilter("");
    setSearch("");
    await fetchWarehouses();
    setShowFilters(false);
  };

  const clearForm = (): void => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateWarehouse = (): void => {
    clearForm();
    setShowForm(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleEdit = async (warehouse: Warehouse): Promise<void> => {
    try {
      const response = await axios.get<Warehouse>(`${API_URL}/${warehouse.id}`, { headers });
      const fullData = response.data;

      setEditingId(warehouse.id);
      setForm({
        code: fullData.code,
        name: fullData.name,
        locationType: fullData.locationType,
      });
      setShowForm(true);
    } catch (error) {
      ToasterService.error("Failed to load warehouse details", getErrorMessage(error, "Please try again."));
    }
  };

  const buildWarehousePayload = (mode: "create" | "update") => {
    const existing = warehouses.find((item) => item.id === editingId);

    if (mode === "update" && existing) {
      return {
        id: existing.id,
        createdDate: existing.createdDate || new Date().toISOString(),
        updatedDate: new Date().toISOString(),
        createdBy: existing.createdBy || user?.userId || authUser.userId || "",
        tenantId: existing.tenantId || user?.tenantId || authUser.tenantId || "",
        code: form.code.trim(),
        name: form.name.trim(),
        locationType: form.locationType,
        stockLevels: existing.stockLevels || [],
        batches: existing.batches || [],
        serialNumbers: existing.serialNumbers || [],
        stockMovements: existing.stockMovements || [],
        stockAdjustments: existing.stockAdjustments || [],
        stockEntries: existing.stockEntries || [],
      };
    }

    return {
      tenantId: user?.tenantId || authUser.tenantId || "",
      code: form.code.trim(),
      name: form.name.trim(),
      locationType: form.locationType,
      stockLevels: [],
      batches: [],
      serialNumbers: [],
      stockMovements: [],
      stockAdjustments: [],
      stockEntries: [],
    };
  };

  const handleSave = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    try {
      setSubmitting(true);

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, buildWarehousePayload("update"), {
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        });
        ToasterService.success("Warehouse updated successfully");
      } else {
        await axios.post(API_URL, buildWarehousePayload("create"), {
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        });
        ToasterService.success("Warehouse created successfully");
      }

      await fetchWarehouses();
      clearForm();
    } catch (error) {
      ToasterService.error("Failed to save warehouse", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const getTotalStock = (warehouse: Warehouse): number => {
    return warehouse.stockLevels.reduce((sum, level) => sum + level.quantity, 0);
  };

  const canDeleteWarehouse = (warehouse: Warehouse): boolean => {
    return getTotalStock(warehouse) === 0 &&
           warehouse.stockLevels.length === 0 &&
           warehouse.batches.length === 0 &&
           warehouse.serialNumbers.length === 0;
  };

  const handleDeleteClick = (warehouse: Warehouse): void => {
    if (!canDeleteWarehouse(warehouse)) {
      ToasterService.warning(
        "Cannot delete warehouse with existing stock. Please remove all stock first.",
        "Delete Blocked"
      );
      return;
    }
    setDeletingWarehouse(warehouse);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deletingWarehouse?.id) return;

    try {
      setSubmitting(true);
      const warehouseId = deletingWarehouse.id;

      try {
        await axios.delete(`${API_URL}/${warehouseId}?cascade=true`, { headers });
        ToasterService.success("Warehouse deleted successfully");
        setDeletingWarehouse(null);
        await fetchWarehouses();
        return;
      } catch (cascadeError) {
        const response = await axios.get<Warehouse>(`${API_URL}/${warehouseId}`, { headers });
        const warehouse = response.data;

        if (warehouse.stockLevels.length > 0 || warehouse.batches.length > 0 || warehouse.serialNumbers.length > 0) {
          ToasterService.warning(
            "This warehouse has stock. Please remove all stock before deleting.",
            "Cannot Delete"
          );
          setDeletingWarehouse(null);
          return;
        }

        await axios.delete(`${API_URL}/${warehouseId}`, { headers });
        ToasterService.success("Warehouse deleted successfully");
        setDeletingWarehouse(null);
        await fetchWarehouses();
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error, "Please try again.");
      if (errorMessage.includes("foreign key") || errorMessage.includes("constraint")) {
        ToasterService.error(
          "Cannot delete warehouse with existing stock. Please remove all stock first.",
          "Delete Failed"
        );
      } else {
        ToasterService.error("Delete failed", errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = warehouses.filter((warehouse) => {
    const matchesType = locationTypeFilter ? warehouse.locationType === locationTypeFilter : true;
    const searchBlob = `${warehouse.code} ${warehouse.name}`.toLowerCase();
    const matchesSearch = search.trim() ? searchBlob.includes(search.toLowerCase()) : true;
    return matchesType && matchesSearch;
  });

  const totalWarehouses = warehouses.length;
  const mainWarehouses = warehouses.filter((item) => item.locationType === "MAIN").length;
  const subWarehouses = warehouses.filter((item) => item.locationType === "SUB").length;
  const storeWarehouses = warehouses.filter((item) => item.locationType === "STORE").length;

  const exportPDF = (): void => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Warehouses Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
    doc.text(`Total Warehouses: ${filtered.length}`, 14, 28);

    autoTable(doc, {
      head: [["Code", "Name", "Location Type"]],
      body: filtered.map((warehouse) => [warehouse.code, warehouse.name, warehouse.locationType]),
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 182, 212] },
    });

    doc.save(`Warehouses_${new Date().toISOString().split("T")[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportExcel = (): void => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((warehouse) => ({
        Code: warehouse.code,
        Name: warehouse.name,
        "Location Type": warehouse.locationType,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Warehouses");
    XLSX.writeFile(wb, `Warehouses_${new Date().toISOString().split("T")[0]}.xlsx`);
    setShowExportMenu(false);
  };

  return (
    <>
      <PageMeta title="Warehouses" description="Manage your warehouses and storage locations" />
      <PageBreadcrumb pageTitle="Warehouses" />

      <div className="w-full max-w-none space-y-6 px-0 py-8">
        {!showForm && (
          <>
            <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
              <AddButton onClick={openCreateWarehouse} label="Add Warehouse" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard
                label="Total Warehouses"
                value={totalWarehouses}
                gradient="from-cyan-50 to-blue-50"
                borderColor="border-cyan-100"
                labelColor="text-cyan-600"
              />
              <StatsCard
                label="Main Warehouses"
                value={mainWarehouses}
                gradient="from-purple-50 to-pink-50"
                borderColor="border-purple-100"
                labelColor="text-purple-600"
              />
              <StatsCard
                label="Sub Warehouses"
                value={subWarehouses}
                gradient="from-blue-50 to-indigo-50"
                borderColor="border-blue-100"
                labelColor="text-blue-600"
              />
              <StatsCard
                label="Stores"
                value={storeWarehouses}
                gradient="from-green-50 to-emerald-50"
                borderColor="border-green-100"
                labelColor="text-green-600"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <FloatingInput
                  label="Warehouse ID"
                  type="number"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                />
                <button
                  type="button"
                  onClick={fetchWarehouseById}
                  className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Get By ID
                </button>
                <FloatingInput
                  label="Warehouse Code"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={fetchWarehouseByCode}
                  className="h-[52px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700"
                >
                  Get By Code
                </button>
                <button
                  type="button"
                  onClick={fetchWarehouses}
                  className="h-[52px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Load All
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by code or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu((current) => !current)}
                    className="rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-50"
                    disabled={warehouses.length === 0}
                  >
                    <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                      <button
                        type="button"
                        onClick={exportPDF}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                        Export PDF
                      </button>
                      <button
                        type="button"
                        onClick={exportExcel}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <DocumentArrowDownIcon className="h-4 w-4 text-green-600" />
                        Export Excel
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-50"
                  disabled={warehouses.length === 0}
                >
                  <PrinterIcon className="h-5 w-5 text-gray-600" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFilters((current) => !current)}
                  className={`rounded-lg border p-2 ${
                    showFilters ? "border-cyan-300 bg-cyan-50" : "border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Location Type</label>
                    <select
                      value={locationTypeFilter}
                      onChange={(e) => setLocationTypeFilter(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 p-2 focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Types</option>
                      {locationTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-white transition-colors hover:bg-cyan-700"
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {showForm && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 border-b border-gray-100 pb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit Warehouse" : "Create Warehouse"}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500">Integrated with the warehouse controller payload</p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FloatingInput
                  label="Code"
                  name="code"
                  value={form.code}
                  onChange={handleChange}
                  required
                />
                <FloatingInput
                  label="Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
                <FloatingSelect
                  label="Location Type"
                  name="locationType"
                  value={form.locationType}
                  onChange={handleChange}
                  includeEmptyOption={false}
                  options={locationTypeOptions.map((option) => ({ id: option, name: option }))}
                />
              </div>

              <div className="flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
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
                  {submitting ? "Saving..." : editingId ? "Update Warehouse" : "Create Warehouse"}
                </button>
              </div>
            </form>
          </div>
        )}

        {!showForm && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center px-4 py-10 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <BuildingOffice2Icon className="h-7 w-7 text-gray-400" />
                </div>
                <p className="mb-1.5 text-sm font-medium text-gray-500">No warehouses found</p>
                <button
                  type="button"
                  onClick={openCreateWarehouse}
                  className="text-sm font-medium text-cyan-600 hover:text-cyan-700"
                >
                  Add your first warehouse
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                        Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                        Warehouse Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                        Location Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                        Total Stock
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filtered.slice(0, PAGE_SIZE).map((warehouse) => (
                      <tr key={`${warehouse.id}-${warehouse.code}`} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs font-mono text-gray-600">{warehouse.code}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-100">
                              <BuildingOffice2Icon className="h-3.5 w-3.5 text-cyan-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{warehouse.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getLocationTypeColor(
                              warehouse.locationType
                            )}`}
                          >
                            {warehouse.locationType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {getTotalStock(warehouse)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => setViewWarehouse(warehouse)}
                              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                              title="View Warehouse"
                            >
                              <MagnifyingGlassIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(warehouse)}
                              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                              title="Edit Warehouse"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(warehouse)}
                              className={`rounded-lg p-1.5 transition-all ${
                                canDeleteWarehouse(warehouse)
                                  ? "text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  : "text-gray-300 cursor-not-allowed"
                              }`}
                              title={canDeleteWarehouse(warehouse) ? "Delete Warehouse" : "Cannot delete - has stock"}
                              disabled={!canDeleteWarehouse(warehouse)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {viewWarehouse && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 py-8">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setViewWarehouse(null)} />
              <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">Warehouse Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 p-6 text-sm">
                  <div>
                    <p className="text-gray-500">Code</p>
                    <p className="font-medium text-gray-900">{viewWarehouse.code}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="font-medium text-gray-900">{viewWarehouse.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Location Type</p>
                    <p className="font-medium text-gray-900">{viewWarehouse.locationType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Stock</p>
                    <p className="font-medium text-gray-900">{getTotalStock(viewWarehouse)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium text-gray-900">
                      {viewWarehouse.createdDate ? new Date(viewWarehouse.createdDate).toLocaleDateString() : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Updated</p>
                    <p className="font-medium text-gray-900">
                      {viewWarehouse.updatedDate ? new Date(viewWarehouse.updatedDate).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-100 px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => setViewWarehouse(null)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <DynamicPopup
          isPopupOpen={Boolean(deletingWarehouse)}
          setIsPopupOpen={(value) => {
            if (!value) setDeletingWarehouse(null);
          }}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          innerText="Delete Warehouse"
          subText={
            deletingWarehouse && !canDeleteWarehouse(deletingWarehouse)
              ? `Cannot delete "${deletingWarehouse.name}" - it has stock or related data. Please remove all stock first.`
              : `Are you sure you want to delete "${deletingWarehouse?.name || ""}"?`
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          iconBg="bg-red-100"
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default WarehousePage;