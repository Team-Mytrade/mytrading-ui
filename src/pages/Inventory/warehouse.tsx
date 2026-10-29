import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
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
import { usePermissions } from "../../access/usePermissions";

type WarehouseLocationType = string;
type WarehouseStatus = string;

type Warehouse = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code: string; // "" when the server has no code (never a made-up value)
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
  active?: boolean;
};

type WarehouseForm = {
  code: string;
  name: string;
  locationType: string;
  status: string;
};

type PendingChange = {
  warehouse: Warehouse;
  field: "locationType" | "status";
  value: string;
};

const API_URL = "/v1/api/inventory/warehouses";
const ENUM_API_URL = "/v1/api/inventory/enums";
const PAGE_SIZE = 10;

const WAREHOUSE_ROUTE = "/warehouse";

const FALLBACK_LOCATION_TYPES = ["MAIN", "DISTRIBUTION", "TRANSIT", "RETURN_CENTER"];
const FALLBACK_STATUS = ["ACTIVE", "INACTIVE"];

// FIX (code validation): uppercase letters/digits in hyphen-separated parts,
// e.g. W-001, WH-001, WH-HYD-001. No spaces, no lowercase, no symbols.
const CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const CODE_MIN_LENGTH = 3;
const CODE_MAX_LENGTH = 20;

const emptyForm: WarehouseForm = {
  code: "",
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

// FIX: the old resolveWarehouseCode() invented codes like "WH-000003" for
// warehouses with no code. That hid real bad data and could save the fake
// code back to the server on edit. Now a missing code stays empty.
function normalizeCode(code: unknown): string {
  const trimmed = typeof code === "string" ? code.trim() : "";
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return "";
  return trimmed;
}

// Treat records flagged as deleted by the backend as gone (soft delete).
function isDeletedRecord(w: any): boolean {
  return w?.deleted === true || w?.isDeleted === true || Boolean(w?.deletedAt);
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

const FIELD_LABELS: Record<PendingChange["field"], string> = {
  locationType: "location type",
  status: "status",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WarehousePage: React.FC = () => {
  const { canUpdate, canDelete } = usePermissions();
  const token = localStorage.getItem("accessToken");

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
  // FIX (inline dropdowns): changes wait here until the user confirms.
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const [locationTypeOptions, setLocationTypeOptions] = useState<string[]>(
    FALLBACK_LOCATION_TYPES
  );
  const [enumLoading, setEnumLoading] = useState(true);

  const savingRowsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
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

      const enrichedData = rawData
        // FIX (soft delete): hide records the backend marks as deleted.
        .filter((warehouse) => !isDeletedRecord(warehouse))
        .map((warehouse) => {
          const stockCount =
            warehouse.stockCount ??
            warehouse.stockLevels?.reduce(
              (sum: number, level: any) => sum + (Number(level?.quantity) || 0),
              0
            ) ??
            0;

          return {
            ...warehouse,
            code: normalizeCode(warehouse.code),
            locationType: warehouse.locationType || "MAIN",
            stockCount,
            status: warehouse.active === false ? "INACTIVE" : "ACTIVE",
          };
        });

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

  // FIX (refresh): one function that re-runs every GET this page needs.
  const refreshAll = async (): Promise<void> => {
    await Promise.all([fetchEnums(), fetchWarehouses()]);
  };

  // -----------------------------------------------------------------------
  // Modal handlers
  // -----------------------------------------------------------------------

  const openCreate = (): void => {
    setEditingId(null);
    setForm({
      code: "",
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
      code: warehouse.code ?? "",
      name: warehouse.name ?? "",
      locationType: warehouse.locationType ?? "",
      status: warehouse.status || "ACTIVE",
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    // FIX (code validation): force uppercase and drop spaces while typing.
    const next = name === "code" ? value.toUpperCase().replace(/\s+/g, "") : value;
    setForm((current) => ({ ...current, [name]: next }));
  };

  // -----------------------------------------------------------------------
  // Inline table update (runs only after confirmation)
  // -----------------------------------------------------------------------

  const requestTableUpdate = (
    warehouse: Warehouse,
    field: PendingChange["field"],
    value: string
  ): void => {
    const current = field === "status" ? warehouse.status || "ACTIVE" : warehouse.locationType;
    if (value === current) return;
    setPendingChange({ warehouse, field, value });
  };

  const handleTableUpdate = async (
    id: number,
    field: PendingChange["field"],
    value: string
  ): Promise<void> => {
    if (savingRowsRef.current.has(id)) return;

    const previous = warehouses.find((w) => w.id === id);
    if (!previous) return;

    const nextLocationType = field === "locationType" ? value : previous.locationType;
    const nextActive = field === "status" ? value === "ACTIVE" : previous.active !== false;

    savingRowsRef.current.add(id);
    try {
      await axios.put(
        `${API_URL}/${id}`,
        {
          id,
          // Send the real code (null if none) — never a placeholder.
          code: previous.code || null,
          name: previous.name,
          locationType: nextLocationType,
          active: nextActive,
        },
        { headers }
      );

      setWarehouses((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                locationType: nextLocationType,
                active: nextActive,
                status: nextActive ? "ACTIVE" : "INACTIVE",
              }
            : w
        )
      );
      ToasterService.success(
        field === "status"
          ? "Warehouse status updated successfully"
          : "Location type updated successfully"
      );
    } catch (error) {
      ToasterService.error(
        `Failed to update ${FIELD_LABELS[field]}`,
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      savingRowsRef.current.delete(id);
    }
  };

  const confirmTableUpdate = async (): Promise<void> => {
    if (!pendingChange) return;
    const { warehouse, field, value } = pendingChange;
    setPendingChange(null);
    await handleTableUpdate(warehouse.id, field, value);
  };

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const buildPayload = () => {
    const base = {
      code: form.code.trim(),
      name: form.name.trim(),
      locationType: form.locationType,
      active: form.status === "ACTIVE",
    };
    return editingId ? { id: editingId, ...base } : base;
  };

  const validateForm = (): string | null => {
    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim();

    if (!trimmedCode) return "Warehouse Code is required";
    if (trimmedCode.length < CODE_MIN_LENGTH || trimmedCode.length > CODE_MAX_LENGTH) {
      return `Warehouse Code must be ${CODE_MIN_LENGTH}–${CODE_MAX_LENGTH} characters`;
    }
    if (!CODE_PATTERN.test(trimmedCode)) {
      return "Warehouse Code can only use capital letters, numbers and hyphens (e.g. WH-001)";
    }
    const duplicateCode = warehouses.find(
      (w) => (w.code ?? "").toUpperCase() === trimmedCode && w.id !== editingId
    );
    if (duplicateCode) return `Warehouse Code "${trimmedCode}" is already used`;

    if (!trimmedName) return "Warehouse Name is required";
    if (trimmedName.length < 2) return "Warehouse Name must be at least 2 characters";
    const duplicateName = warehouses.find(
      (w) =>
        (w.name ?? "").trim().toLowerCase() === trimmedName.toLowerCase() &&
        w.id !== editingId
    );
    if (duplicateName) return "A warehouse with this name already exists";

    if (!form.locationType) return "Location Type is required";
    return null;
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      ToasterService.error(validationError);
      return;
    }

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
      // Reload from the server so the list, counts and stock items are accurate.
      await fetchWarehouses();
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
    const deletedId = deleteWarehouse.id;

    try {
      await axios.delete(`${API_URL}/${deletedId}`, { headers });
      ToasterService.success("Warehouse deleted successfully");
      setDeleteWarehouse(null);
      // Remove it from the screen immediately, then reload from the server.
      setWarehouses((prev) => prev.filter((w) => w.id !== deletedId));
      await fetchWarehouses();
    } catch (error) {
      ToasterService.error(
        "Failed to delete warehouse",
        getErrorMessage(error, "Please try again.")
      );
    }
  };

  // -----------------------------------------------------------------------
  // Scoped list — filters to a single warehouse when URL has ?warehouseId=
  // -----------------------------------------------------------------------

  const scopedWarehouses = useMemo(
    () =>
      isWarehouseScoped
        ? warehouses.filter((w) => String(w.id) === String(filterWarehouseId))
        : warehouses,
    [warehouses, isWarehouseScoped, filterWarehouseId]
  );

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

  const statusOptions = FALLBACK_STATUS;

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
            {warehouse.code ? (
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {warehouse.code}
              </p>
            ) : (
              <p
                className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 dark:text-amber-400"
                title="This warehouse has no code saved. Edit it to add one."
              >
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                No code
              </p>
            )}
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
      render: (warehouse) =>
        !canUpdate ? (
          <span
            className={`inline-flex w-[150px] rounded-lg border px-2.5 py-1 text-xs font-medium ${getLocationTypeColor(
              warehouse.locationType
            )}`}
          >
            {warehouse.locationType}
          </span>
        ) : (
          <select
            aria-label={`Location type for ${warehouse.name}`}
            value={warehouse.locationType}
            onChange={(e) => requestTableUpdate(warehouse, "locationType", e.target.value)}
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
        if (!canUpdate) {
          return (
            <span
              className={`inline-flex w-[100px] rounded-lg border px-2.5 py-1 text-xs font-medium ${getStatusColor(
                status
              )}`}
            >
              {status}
            </span>
          );
        }
        return (
          <select
            aria-label={`Status for ${warehouse.name}`}
            value={status}
            onChange={(e) => requestTableUpdate(warehouse, "status", e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className={`w-[100px] rounded-lg border px-2.5 py-1 text-xs font-medium outline-none ${getStatusColor(
              status
            )}`}
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
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canUpdate && (
            <button
              type="button"
              onClick={() => openEdit(warehouse)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
              title="Edit"
              aria-label={`Edit ${warehouse.name}`}
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteWarehouse(warehouse)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              title="Delete"
              aria-label={`Delete ${warehouse.name}`}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const pendingLabel = pendingChange
    ? `${pendingChange.warehouse.code || pendingChange.warehouse.name}`
    : "";
  const pendingFrom = pendingChange
    ? pendingChange.field === "status"
      ? pendingChange.warehouse.status || "ACTIVE"
      : pendingChange.warehouse.locationType
    : "";

  return (
    <>
      <PageMeta title="Warehouses" description="Manage warehouses" />
      <PageBreadcrumb
        pageTitle="Warehouses"
        actions={<AddButton onClick={openCreate} label="Add Warehouse" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        {isWarehouseScoped && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200">
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>
                Showing warehouse:{" "}
                <strong>{filterWarehouseName || "selected warehouse"}</strong>
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
                  ? `No warehouse matches "${filterWarehouseName || "selected warehouse"}"`
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
                  onClick={() => refreshAll()}
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
                key="code"
                label="Warehouse Code (e.g. WH-001)"
                name="code"
                value={form.code}
                onChange={handleChange}
                required
              />,
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
              // Removed: developer-facing "Status is saved to the warehouse API…" note.
            ],
          },
        ]}
      />

      {/* FIX (inline dropdowns): confirm before changing a live record */}
      <DynamicPopup
        isPopupOpen={!!pendingChange}
        setIsPopupOpen={(open) => {
          if (!open) setPendingChange(null);
        }}
        icon={<ExclamationTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-100 dark:bg-amber-950/40"
        innerText={
          pendingChange ? `Change ${FIELD_LABELS[pendingChange.field]}?` : "Confirm change"
        }
        subText={
          pendingChange
            ? `Change ${FIELD_LABELS[pendingChange.field]} of "${pendingLabel}" from ${pendingFrom} to ${pendingChange.value}?`
            : "Are you sure?"
        }
        confirmLabel="Change"
        cancelLabel="Cancel"
        onConfirm={confirmTableUpdate}
        onCancel={() => setPendingChange(null)}
        confirmBtnClass="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white"
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
