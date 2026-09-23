import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  FunnelIcon,
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
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type WarehouseLocationType = string;
type WarehouseStatus = string;

type Warehouse = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code: string;
  name: string;
  locationType: WarehouseLocationType;
  stockLevels?: any[];
  batches?: any[];
  serialNumbers?: any[];
  stockMovements?: any[];
  stockAdjustments?: any[];
  stockEntries?: any[];
  stockCount?: number;
  status?: WarehouseStatus;
};

type WarehouseForm = {
  name: string;
  locationType: string;
  status: string;
};

const API_URL = "/v1/api/inventory/warehouses";
const ENUM_API_URL = "/v1/api/inventory/enums";
const PAGE_SIZE = 10;

// 🔧 Route paths — matches your app's actual routes.
const WAREHOUSE_ROUTE = "/warehouse";

const FALLBACK_LOCATION_TYPES = ["MAIN", "DISTRIBUTION", "TRANSIT", "RETURN_CENTER"];
const FALLBACK_STATUS = ["ACTIVE", "INACTIVE"];

const STATIC_CREATED_BY = "system-admin";
const STATIC_TENANT_ID = "tenant-001";

const LOCAL_STATUS_STORAGE_KEY = "warehouseLocalStatus";

const emptyForm: WarehouseForm = {
  name: "",
  locationType: "",
  status: "ACTIVE",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function resolveWarehouseCode(code: unknown, id: unknown): string {
  const trimmed = typeof code === "string" ? code.trim() : "";
  if (trimmed && trimmed !== "null" && trimmed !== "undefined") return trimmed;
  if (typeof id === "number" && Number.isFinite(id)) {
    return `WH-${String(id).padStart(6, "0")}`;
  }
  return "WH-UNKNOWN";
}

function getLocationTypeColor(type: string) {
  switch (type) {
    case "MAIN":
      return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800";
    case "DISTRIBUTION":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800";
    case "TRANSIT":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800";
    case "RETURN_CENTER":
      return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 border-green-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800";
    case "INACTIVE":
      return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  }
}

// ---------------------------------------------------------------------------
// Local-only status storage
// ---------------------------------------------------------------------------

function loadLocalStatusMap(): Record<number, WarehouseStatus> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_STATUS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalStatus(id: number, status: WarehouseStatus) {
  if (typeof id !== "number" || !Number.isFinite(id)) return;
  const all = loadLocalStatusMap();
  all[id] = status;
  try {
    localStorage.setItem(LOCAL_STATUS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // fail silently
  }
}

function getDisplayStatus(id: number): WarehouseStatus {
  return loadLocalStatusMap()[id] ?? "ACTIVE";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WarehousePage: React.FC = () => {
  const token = localStorage.getItem("accessToken");

  // ── NEW: read URL filter params ─────────────────────────────────
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filterWarehouseId = searchParams.get("warehouseId");
  const filterWarehouseName = searchParams.get("warehouseName") || "";
  const isWarehouseScoped = Boolean(filterWarehouseId);

  const headers = useMemo(
    () =>
      token
        ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
        : undefined,
    [token]
  );

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteWarehouse, setDeleteWarehouse] = useState<Warehouse | null>(null);

  const [locationTypeOptions, setLocationTypeOptions] = useState<string[]>(
    FALLBACK_LOCATION_TYPES
  );
  const [enumLoading, setEnumLoading] = useState(true);

  const savingRowsRef = useRef<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    fetchEnums(controller.signal);
    fetchWarehouses(controller.signal);

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  // -----------------------------------------------------------------------
  // Fetches
  // -----------------------------------------------------------------------

  const fetchEnums = async (signal?: AbortSignal): Promise<void> => {
    try {
      setEnumLoading(true);
      const locationRes = await axios.get(`${ENUM_API_URL}?type=LOCATION_TYPE`, {
        headers,
        signal,
      });

      let locationCodes: string[] = [];
      const rawData = locationRes.data;

      if (Array.isArray(rawData)) {
        if (rawData.length > 0 && typeof rawData[0] === "object" && rawData[0]?.code) {
          locationCodes = rawData.map((item: any) => item.code);
        } else {
          locationCodes = rawData;
        }
      }

      const resolved = locationCodes.length > 0 ? locationCodes : FALLBACK_LOCATION_TYPES;
      setLocationTypeOptions(resolved);

      setForm((prev) => {
        if (prev.name || prev.locationType) return prev;
        return {
          ...prev,
          locationType: resolved[0] ?? "",
          status: prev.status || "ACTIVE",
        };
      });
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Failed to fetch enums:", error);
      setLocationTypeOptions(FALLBACK_LOCATION_TYPES);
    } finally {
      setEnumLoading(false);
    }
  };

  const fetchWarehouses = async (signal?: AbortSignal): Promise<void> => {
    try {
      setLoading(true);

      const response = await axios.get<Warehouse[]>(API_URL, { headers, signal });

      const rawData: Warehouse[] = Array.isArray(response.data)
        ? response.data
        : (response.data as any)?.content || (response.data as any)?.data || [];

      const enrichedData = await Promise.all(
        rawData.map(async (warehouse) => {
          let fullData: Warehouse = warehouse;

          if (!Array.isArray(warehouse.stockLevels)) {
            try {
              const detailRes = await axios.get(`${API_URL}/${warehouse.id}`, {
                headers,
                signal,
              });
              fullData = detailRes.data;
            } catch (detailError) {
              if (axios.isCancel(detailError)) throw detailError;
              fullData = warehouse;
            }
          }

          const stockCount =
            fullData.stockLevels?.reduce(
              (sum: number, level: any) => sum + (Number(level?.quantity) || 0),
              0
            ) || 0;

          const code = resolveWarehouseCode(
            fullData.code ?? warehouse.code,
            warehouse.id
          );

          return {
            ...fullData,
            code,
            locationType: fullData.locationType || warehouse.locationType || "MAIN",
            stockCount,
            status: getDisplayStatus(warehouse.id),
          };
        })
      );

      setWarehouses(enrichedData);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Failed to load warehouses:", error);
      setWarehouses([]);
      ToasterService.error(
        "Failed to load warehouses",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Modal handlers
  // -----------------------------------------------------------------------

  const openCreate = (): void => {
    setEditingId(null);
    setForm({
      name: "",
      locationType: locationTypeOptions[0] || "",
      status: "ACTIVE",
    });
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
      name: warehouse.name ?? "",
      locationType: warehouse.locationType ?? "",
      status: warehouse.status || "ACTIVE",
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  // -----------------------------------------------------------------------
  // Inline table update
  // -----------------------------------------------------------------------

  const handleTableUpdate = async (
    id: number,
    field: "locationType" | "status",
    value: string
  ): Promise<void> => {
    if (savingRowsRef.current.has(id)) return;

    const previous = warehouses.find((w) => w.id === id);
    if (!previous) return;

    if (field === "status") {
      saveLocalStatus(id, value);
      setWarehouses((prev) =>
        prev.map((w) => (w.id === id ? { ...w, status: value } : w))
      );
      ToasterService.success(
        "Status updated (saved locally — not yet supported by the server)"
      );
      return;
    }

    savingRowsRef.current.add(id);

    const optimistic: Warehouse = { ...previous, locationType: value };
    setWarehouses((prev) => prev.map((w) => (w.id === id ? optimistic : w)));

    try {
      await axios.put(
        `${API_URL}/${id}`,
        {
          id,
          createdBy: previous.createdBy || STATIC_CREATED_BY,
          tenantId: previous.tenantId || STATIC_TENANT_ID,
          name: previous.name,
          locationType: value,
        },
        { headers }
      );
      ToasterService.success(`${field} updated successfully`);
    } catch (error) {
      setWarehouses((prev) =>
        prev.map((w) => (w.id === id ? { ...w, locationType: previous.locationType } : w))
      );
      ToasterService.error(
        `Failed to update ${field}`,
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      savingRowsRef.current.delete(id);
    }
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const buildPayload = () => {
    const base = {
      createdBy: STATIC_CREATED_BY,
      tenantId: STATIC_TENANT_ID,
      name: form.name.trim(),
      locationType: form.locationType,
    };
    return editingId ? { id: editingId, ...base } : base;
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    const trimmedName = form.name.trim();

    if (!trimmedName) {
      ToasterService.error("Warehouse Name is required");
      return;
    }
    if (trimmedName.length < 2) {
      ToasterService.error("Warehouse Name must be at least 2 characters");
      return;
    }
    if (!form.locationType) {
      ToasterService.error("Location Type is required");
      return;
    }

    const duplicate = warehouses.find(
      (w) =>
        (w.name ?? "").trim().toLowerCase() === trimmedName.toLowerCase() &&
        w.id !== editingId
    );
    if (duplicate) {
      ToasterService.error("A warehouse with this name already exists");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Warehouse updated successfully");

        saveLocalStatus(editingId, form.status);

        setWarehouses((prev) =>
          prev.map((w) => {
            if (w.id !== editingId) return w;
            return {
              ...w,
              name: payload.name,
              locationType: payload.locationType,
              status: form.status,
              code: resolveWarehouseCode(w.code, w.id),
            };
          })
        );
      } else {
        const response = await axios.post(API_URL, payload, { headers });
        ToasterService.success("Warehouse created successfully");

        const code = resolveWarehouseCode(response.data?.code, response.data?.id);

        if (typeof response.data?.id === "number") {
          saveLocalStatus(response.data.id, form.status || "ACTIVE");
        }

        const newWarehouse: Warehouse = {
          ...response.data,
          code,
          locationType: payload.locationType,
          status: form.status || "ACTIVE",
        };
        setWarehouses((prev) => [newWarehouse, ...prev]);
      }

      closeForm();
    } catch (error) {
      ToasterService.error(
        "Failed to save warehouse",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const confirmDelete = async (): Promise<void> => {
    if (!deleteWarehouse?.id) return;

    try {
      await axios.delete(`${API_URL}/${deleteWarehouse.id}`, { headers });
      ToasterService.success("Warehouse deleted successfully");
      setDeleteWarehouse(null);
      await fetchWarehouses();
    } catch (error) {
      ToasterService.error(
        "Failed to delete warehouse",
        getErrorMessage(error, "Please try again.")
      );
    }
  };

  // -----------------------------------------------------------------------
  // NEW: scoped list — filters to a single warehouse when URL has ?warehouseId=
  // -----------------------------------------------------------------------

  const scopedWarehouses = useMemo(
    () =>
      isWarehouseScoped
        ? warehouses.filter((w) => String(w.id) === String(filterWarehouseId))
        : warehouses,
    [warehouses, isWarehouseScoped, filterWarehouseId]
  );

  // -----------------------------------------------------------------------
  // Derived stats (using scoped list so stats reflect the filter)
  // -----------------------------------------------------------------------

  const stats = useMemo(
    () => ({
      total: scopedWarehouses.length,
      active: scopedWarehouses.filter((w) => w.status === "ACTIVE").length,
      inactive: scopedWarehouses.filter((w) => w.status === "INACTIVE").length,
      main: scopedWarehouses.filter((w) => w.locationType === "MAIN").length,
      distribution: scopedWarehouses.filter((w) => w.locationType === "DISTRIBUTION")
        .length,
    }),
    [scopedWarehouses]
  );

  const statusOptions = useMemo(() => {
    const seen = new Set<string>(FALLBACK_STATUS);
    warehouses.forEach((w) => {
      if (w.status) seen.add(w.status);
    });
    return Array.from(seen);
  }, [warehouses]);

  // -----------------------------------------------------------------------
  // Columns
  // -----------------------------------------------------------------------

  const columns: ColumnDef<Warehouse>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      render: (warehouse) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/40">
            <BuildingOffice2Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {warehouse.code}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              ID: #{warehouse.id}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (warehouse) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {warehouse.name}
        </span>
      ),
    },
    {
      key: "locationType",
      label: "Location Type",
      sortable: true,
      render: (warehouse) => (
        <select
          aria-label={`Location type for ${warehouse.name}`}
          value={warehouse.locationType}
          onChange={(e) => handleTableUpdate(warehouse.id, "locationType", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={`w-[150px] rounded-lg border px-2.5 py-1 text-xs font-medium outline-none ${getLocationTypeColor(
            warehouse.locationType
          )}`}
        >
          {locationTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (warehouse) => {
        const status = warehouse.status || "ACTIVE";
        return (
          <select
            aria-label={`Status for ${warehouse.name}`}
            value={status}
            onChange={(e) => handleTableUpdate(warehouse.id, "status", e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`w-[100px] rounded-lg border px-2.5 py-1 text-xs font-medium outline-none ${getStatusColor(
              status
            )}`}
            title="Stored locally only — not yet supported by the server"
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "stockCount",
      label: "Stock Items",
      sortable: true,
      render: (warehouse) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {warehouse.stockCount || 0}
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
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEdit(warehouse)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit"
            aria-label={`Edit ${warehouse.name}`}
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteWarehouse(warehouse)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete"
            aria-label={`Delete ${warehouse.name}`}
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
      <PageBreadcrumb
        pageTitle="Warehouses"
        actions={<AddButton onClick={openCreate} label="Add Warehouse" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        {/* ── NEW: filter banner (matches customers / users pages) ── */}
        {isWarehouseScoped && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>
                Showing warehouse:{" "}
                <strong>
                  {filterWarehouseName || `#${filterWarehouseId}`}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate(WAREHOUSE_ROUTE)}
              className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            >
              View all warehouses
            </button>
          </div>
        )}

        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Warehouses"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Inactive"
            value={stats.inactive}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<XCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Main / Distribution"
            value={`${stats.main} / ${stats.distribution}`}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
        </div>

        <ReusableTable
          data={scopedWarehouses}
          columns={columns}
          loading={loading || enumLoading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          enableRowDetails={true}
          rowDetailsTitle="Warehouse Details"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                {isWarehouseScoped
                  ? `No warehouse matches "${filterWarehouseName || `#${filterWarehouseId}`}"`
                  : "No warehouses found"}
              </p>
              {isWarehouseScoped ? (
                <button
                  type="button"
                  onClick={() => navigate(WAREHOUSE_ROUTE)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  View all warehouses →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fetchWarehouses()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  <ArrowPathIcon className="h-3.5 w-3.5" />
                  Reload all warehouses
                </button>
              )}
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Warehouse" : "Create Warehouse"}
        subtitle="Enter warehouse information"
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
                key="name"
                label="Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="locationType"
                label="Location Type"
                name="locationType"
                value={form.locationType}
                onChange={handleChange}
                includeEmptyOption={false}
                options={locationTypeOptions.map((type) => ({ id: type, name: type }))}
              />,
              <FloatingSelect
                key="status"
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                includeEmptyOption={false}
                options={statusOptions.map((status) => ({ id: status, name: status }))}
              />,
              <p
                key="status-hint"
                className="text-xs text-amber-600 dark:text-amber-400"
              >
                ⚠ Status is currently stored locally in this browser only — the
                backend does not yet have a field to persist it server-side.
              </p>,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteWarehouse}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteWarehouse(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-100 dark:bg-red-950/40"
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