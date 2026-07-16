// pages/WarehousePage.tsx

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  QueueListIcon,
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
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type Warehouse = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code: string;
  name: string;
  locationType: "MAIN" | "SUB" | "STORE";
  stockLevels?: any[];
  batches?: any[];
  serialNumbers?: any[];
  stockMovements?: any[];
  stockAdjustments?: any[];
  stockEntries?: any[];
};

type WarehouseForm = {
  code: string;
  name: string;
  locationType: string;
};

const API_URL = "/v1/api/inventory/warehouses";
const BATCH_API_URL = "/v1/api/inventory/batches";
const STOCK_LEVEL_API_URL = "/v1/api/inventory/stock-levels";
const SERIAL_API_URL = "/v1/api/inventory/serial-numbers";
const PAGE_SIZE = 10;
const locationTypeOptions = ["MAIN", "SUB", "STORE"];

const emptyForm: WarehouseForm = {
  code: "",
  name: "",
  locationType: "MAIN",
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

function getLocationTypeColor(type: string) {
  switch (type) {
    case "MAIN": return "bg-purple-100 text-purple-800 border-purple-200";
    case "SUB": return "bg-blue-100 text-blue-800 border-blue-200";
    case "STORE": return "bg-green-100 text-green-800 border-green-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

const WarehousePage: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteWarehouse, setDeleteWarehouse] = useState<Warehouse | null>(null);
  const [viewWarehouse, setViewWarehouse] = useState<Warehouse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<Warehouse[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      setWarehouses(data);
    } catch (error) {
      setWarehouses([]);
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
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

  const openEdit = (warehouse: Warehouse): void => {
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      locationType: warehouse.locationType,
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    const existing = warehouses.find((w) => w.id === editingId);

    if (!editingId) {
      return {
        code: form.code.trim(),
        name: form.name.trim(),
        locationType: form.locationType,
      };
    }

    return {
      id: editingId,
      createdDate: existing?.createdDate || new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      createdBy: existing?.createdBy || "",
      tenantId: existing?.tenantId || "",
      code: form.code.trim(),
      name: form.name.trim(),
      locationType: form.locationType,
      stockLevels: existing?.stockLevels || [],
      batches: existing?.batches || [],
      serialNumbers: existing?.serialNumbers || [],
      stockMovements: existing?.stockMovements || [],
      stockAdjustments: existing?.stockAdjustments || [],
      stockEntries: existing?.stockEntries || [],
    };
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Warehouse updated successfully");
      } else {
        await axios.post(API_URL, payload, { headers });
        ToasterService.success("Warehouse created successfully");
      }

      closeForm();
      await fetchWarehouses();
    } catch (error) {
      ToasterService.error("Failed to save warehouse", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteWarehouse?.id) return;

    try {
      await axios.delete(`${API_URL}/${deleteWarehouse.id}?cascade=true`, { headers });
      ToasterService.success("Warehouse deleted successfully");
      setDeleteWarehouse(null);
      await fetchWarehouses();
    } catch (error) {
      ToasterService.error("Failed to delete warehouse", getErrorMessage(error, "Please try again."));
    }
  };

  // ✅ Fetch warehouse with ALL related data
  const handleView = async (warehouse: Warehouse) => {
    try {
      setViewLoading(true);
      
      // Fetch all related data in parallel
      const [warehouseRes, batchesRes, stockRes, serialRes] = await Promise.all([
        axios.get(`${API_URL}/${warehouse.id}`, { headers }),
        axios.get(`${BATCH_API_URL}?warehouseId=${warehouse.id}`, { headers }),
        axios.get(`${STOCK_LEVEL_API_URL}?warehouseId=${warehouse.id}`, { headers }),
        axios.get(`${SERIAL_API_URL}?warehouseId=${warehouse.id}`, { headers }),
      ]);
      
      // Combine all data
      setViewWarehouse({
        ...warehouseRes.data,
        batches: batchesRes.data || [],
        stockLevels: stockRes.data || [],
        serialNumbers: serialRes.data || [],
      });
      
    } catch (error) {
      console.error("Failed to load warehouse details:", error);
      ToasterService.error("Failed to load warehouse details");
    } finally {
      setViewLoading(false);
    }
  };

  const filteredWarehouses = useMemo(() => {
    const term = searchableText(search);

    return warehouses.filter((warehouse) => {
      const matchesType = typeFilter === "" || warehouse.locationType === typeFilter;
      const searchString = `${warehouse.id} ${warehouse.code} ${warehouse.name} ${warehouse.locationType}`.toLowerCase();
      const matchesSearch = !term || searchString.includes(term);
      return matchesType && matchesSearch;
    });
  }, [warehouses, search, typeFilter]);

  const stats = useMemo(
    () => ({
      total: warehouses.length,
      main: warehouses.filter((w) => w.locationType === "MAIN").length,
      sub: warehouses.filter((w) => w.locationType === "SUB").length,
      store: warehouses.filter((w) => w.locationType === "STORE").length,
    }),
    [warehouses]
  );

  const getTotalStock = (warehouse: Warehouse): number => {
    return warehouse.stockLevels?.reduce((sum, level) => sum + level.quantity, 0) || 0;
  };

  const columns: ColumnDef<Warehouse>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      render: (warehouse) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50">
            <BuildingOffice2Icon className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{warehouse.code}</p>
            <p className="text-xs text-slate-400">Name: #{warehouse.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (warehouse) => (
        <span className="text-sm text-slate-700">{warehouse.name}</span>
      ),
    },
    {
      key: "locationType",
      label: "Location Type",
      sortable: true,
      render: (warehouse) => (
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getLocationTypeColor(warehouse.locationType)}`}>
          {warehouse.locationType}
        </span>
      ),
    },
    {
      key: "stockCount",
      label: "Stock Items",
      sortable: true,
      render: (warehouse) => (
        <span className="text-sm text-slate-600">
          {getTotalStock(warehouse)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (warehouse) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => handleView(warehouse)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openEdit(warehouse)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteWarehouse(warehouse)}
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
      <PageMeta title="Warehouses" description="Manage warehouses" />
      <PageBreadcrumb pageTitle="Warehouses" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Warehouse" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Warehouses"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Main"
            value={stats.main}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Sub"
            value={stats.sub}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Store"
            value={stats.store}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search warehouses..."
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

          <FilterPopover
            title="Filter Warehouses"
            buttonLabel="Filters"
            label="Location Type"
            value={typeFilter}
            options={[
              { label: "All Types", value: "" },
              ...locationTypeOptions.map((type) => ({
                label: type,
                value: type,
              })),
            ]}
            onChange={setTypeFilter}
            onReset={() => setTypeFilter("")}
            onApply={() => undefined}
          />
        </div>

        <ReusableTable
          data={filteredWarehouses}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No warehouses found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first warehouse
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Warehouse" : "Create Warehouse"}
        subtitle="Enter warehouse details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Warehouse" : "Create Warehouse"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Warehouse Details",
            fields: [
              <FloatingInput
                label="Code"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                label="Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                label="Location Type"
                name="locationType"
                value={form.locationType}
                onChange={handleChange}
                includeEmptyOption={false}
                options={locationTypeOptions.map((type) => ({
                  id: type,
                  name: type,
                }))}
              />,
            ],
          },
        ]}
      />

      {/* ✅ View Popup with Full Details */}
      {viewWarehouse && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 py-8">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setViewWarehouse(null)} />
            <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl">
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Warehouse Details</h3>
                <button
                  type="button"
                  onClick={() => setViewWarehouse(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading details...</p>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-gray-500">Code</p>
                      <p className="font-medium text-gray-900">{viewWarehouse.code}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{viewWarehouse.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Location Type</p>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getLocationTypeColor(viewWarehouse.locationType)}`}>
                        {viewWarehouse.locationType}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Stock</p>
                      <p className="font-medium text-gray-900">{getTotalStock(viewWarehouse)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="font-medium text-gray-900">
                        {viewWarehouse.createdDate ? new Date(viewWarehouse.createdDate).toLocaleDateString() : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Updated</p>
                      <p className="font-medium text-gray-900">
                        {viewWarehouse.updatedDate ? new Date(viewWarehouse.updatedDate).toLocaleDateString() : "-"}
                      </p>
                    </div>
                  </div>

                  {/* Stock Levels */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <ClipboardDocumentListIcon className="h-4 w-4" />
                      Stock Levels ({viewWarehouse.stockLevels?.length || 0})
                    </h4>
                    {viewWarehouse.stockLevels && viewWarehouse.stockLevels.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Product ID</th>
                              <th className="px-3 py-2 text-right">Quantity</th>
                              <th className="px-3 py-2 text-right">Reserved</th>
                              <th className="px-3 py-2 text-right">Available</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewWarehouse.stockLevels.map((level, index) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="px-3 py-2">{level.productId}</td>
                                <td className="px-3 py-2 text-right">{level.quantity}</td>
                                <td className="px-3 py-2 text-right">{level.reserved || 0}</td>
                                <td className="px-3 py-2 text-right font-medium">{level.available || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No stock levels found</p>
                    )}
                  </div>

                  {/* Batches */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <CubeIcon className="h-4 w-4" />
                      Batches ({viewWarehouse.batches?.length || 0})
                    </h4>
                    {viewWarehouse.batches && viewWarehouse.batches.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Batch Number</th>
                              <th className="px-3 py-2 text-left">Product ID</th>
                              <th className="px-3 py-2 text-left">Manufacturing</th>
                              <th className="px-3 py-2 text-left">Expiry</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewWarehouse.batches.map((batch, index) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">{batch.batchNumber}</td>
                                <td className="px-3 py-2">{batch.productId}</td>
                                <td className="px-3 py-2">{batch.manufacturingDate ? new Date(batch.manufacturingDate).toLocaleDateString() : "-"}</td>
                                <td className="px-3 py-2">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No batches found</p>
                    )}
                  </div>

                  {/* Serial Numbers */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <QueueListIcon className="h-4 w-4" />
                      Serial Numbers ({viewWarehouse.serialNumbers?.length || 0})
                    </h4>
                    {viewWarehouse.serialNumbers && viewWarehouse.serialNumbers.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-2 text-left">Serial</th>
                              <th className="px-3 py-2 text-left">Product ID</th>
                              <th className="px-3 py-2 text-left">Warranty Start</th>
                              <th className="px-3 py-2 text-left">Warranty End</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewWarehouse.serialNumbers.map((serial, index) => (
                              <tr key={index} className="border-b hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-sm">{serial.serial}</td>
                                <td className="px-3 py-2">{serial.productId}</td>
                                <td className="px-3 py-2">{serial.warrantyStart ? new Date(serial.warrantyStart).toLocaleDateString() : "-"}</td>
                                <td className="px-3 py-2">{serial.warrantyEnd ? new Date(serial.warrantyEnd).toLocaleDateString() : "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No serial numbers found</p>
                    )}
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 text-right">
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
        isPopupOpen={!!deleteWarehouse}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteWarehouse(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Warehouse"
        subText={
          deleteWarehouse
            ? `Are you sure you want to delete "${deleteWarehouse.name}"?`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteWarehouse(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default WarehousePage;