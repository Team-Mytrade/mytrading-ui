import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  HashtagIcon,
  TagIcon,
  ClockIcon,
  MoonIcon,
  SunIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import FilterPopover from "../../components/common/filter";
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { AddButton } from "../../components/common/AddButton";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Shift {
  id?: number | string;
  shiftId?: number;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  isNightShift: boolean;
  breakDuration: number;
  gracePeriodMinutes: number;
  overtimeAllowed: boolean;
  weekOffDays: string[];
}

interface ApiTime {
  hour?: number;
  minute?: number;
  second?: number;
  nano?: number;
}

interface ApiDuration {
  seconds?: number;
  nano?: number;
}

interface ShiftApiResponse {
  id?: number | string;
  shiftId?: number;
  shiftName?: string;
  shiftCode?: string;
  startTime?: string | ApiTime | null;
  endTime?: string | ApiTime | null;
  isNightShift?: boolean;
  breakDuration?: number | ApiDuration | null;
  gracePeriodMinutes?: number;
  overtimeAllowed?: boolean;
  weekOffDays?: string[];
  createdBy?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/shifts";

const shiftApi = axios.create();

shiftApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const PAGE_SIZE = 10;

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: Shift = {
  shiftName: "",
  shiftCode: "",
  startTime: "",
  endTime: "",
  isNightShift: false,
  breakDuration: 0,
  gracePeriodMinutes: 0,
  overtimeAllowed: false,
  weekOffDays: [],
};

const WEEK_DAYS: string[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Helper Functions ─────────────────────────────────────────────────────────

const formatTime = (timeStr: string): string => {
  if (!timeStr) return "—";
  return timeStr.substring(0, 5);
};

const padTimePart = (value?: number): string => String(value ?? 0).padStart(2, "0");

const normalizeApiTime = (time?: string | ApiTime | null): string => {
  if (!time) return "";
  if (typeof time === "string") return time.substring(0, 5);
  return `${padTimePart(time.hour)}:${padTimePart(time.minute)}`;
};

const normalizeBreakDuration = (duration?: number | ApiDuration | null): number => {
  if (duration == null) return 0;
  if (typeof duration === "number") return duration;
  return Math.round((duration.seconds ?? 0) / 60);
};

const normalizeShift = (shift: ShiftApiResponse): Shift => ({
  id: shift.id ?? shift.shiftId,
  shiftId: shift.shiftId,
  shiftName: shift.shiftName ?? "",
  shiftCode: shift.shiftCode ?? "",
  startTime: normalizeApiTime(shift.startTime),
  endTime: normalizeApiTime(shift.endTime),
  isNightShift: Boolean(shift.isNightShift),
  breakDuration: normalizeBreakDuration(shift.breakDuration),
  gracePeriodMinutes: shift.gracePeriodMinutes ?? 0,
  overtimeAllowed: Boolean(shift.overtimeAllowed),
  weekOffDays: shift.weekOffDays ?? [],
});

// ─── Page ─────────────────────────────────────────────────────────────────────

const ShiftPage: React.FC = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [form, setForm] = useState<Shift>({ ...emptyForm });
  const [selectedNightShiftFilter, setSelectedNightShiftFilter] = useState<string>("");
  const [selectedOvertimeFilter, setSelectedOvertimeFilter] = useState<string>("");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadShifts = async () => {
    setLoading(true);
    try {
      const res = await shiftApi.get<ShiftApiResponse[]>(API_URL);
      setShifts(res.data.map(normalizeShift));
    } catch (err) {
      console.error("Failed to load shifts", err);
      ToasterService.error("Failed to load shifts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const filteredShifts = useMemo(() => {
    let filtered = [...shifts];

    if (selectedNightShiftFilter !== "") {
      filtered = filtered.filter(s => s.isNightShift === (selectedNightShiftFilter === "night"));
    }

    if (selectedOvertimeFilter !== "") {
      filtered = filtered.filter(s => s.overtimeAllowed === (selectedOvertimeFilter === "yes"));
    }

    return filtered;
  }, [shifts, selectedNightShiftFilter, selectedOvertimeFilter]);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Shift, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingShift(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setEditingShift(null);
    setShowForm(true);
  };

  const openEditForm = async (shift: Shift) => {
    const shiftId = shift.shiftId ?? shift.id;

    if (!shiftId) {
      setForm({ ...shift });
      setEditingShift(shift);
      setShowForm(true);
      return;
    }

    try {
      setLoading(true);
      const res = await shiftApi.get<ShiftApiResponse>(`${API_URL}/${shiftId}`);
      const latestShift = normalizeShift(res.data);
      setForm({ ...latestShift });
      setEditingShift(latestShift);
    } catch (err) {
      console.error("Failed to load shift details", err);
      ToasterService.error("Failed to load shift details");
      setForm({ ...shift });
      setEditingShift(shift);
    } finally {
      setLoading(false);
      setShowForm(true);
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.shiftName) {
      ToasterService.error("Please enter shift name");
      return;
    }
    if (!form.shiftCode) {
      ToasterService.error("Please enter shift code");
      return;
    }
    if (!form.startTime) {
      ToasterService.error("Please select start time");
      return;
    }
    if (!form.endTime) {
      ToasterService.error("Please select end time");
      return;
    }

    const payload = {
      shiftName: form.shiftName,
      shiftCode: form.shiftCode,
      startTime: form.startTime,
      endTime: form.endTime,
      isNightShift: form.isNightShift,
      breakDuration: form.breakDuration,
      gracePeriodMinutes: form.gracePeriodMinutes,
      overtimeAllowed: form.overtimeAllowed,
      weekOffDays: form.weekOffDays,
    };

    try {
      if (editingShift?.shiftId) {
        await shiftApi.put(`${API_URL}/${editingShift.shiftId}`, payload);
        ToasterService.success("Shift updated successfully");
      } else {
        await shiftApi.post(API_URL, payload);
        ToasterService.success("Shift created successfully");
      }
      await loadShifts();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number | string) => {

    const ok = await confirm({
      message: "Are you sure you want to delete this shift? This may affect existing shift schedules.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await shiftApi.delete(`${API_URL}/${id}`);
      ToasterService.success("Shift deleted successfully");
      await loadShifts();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: filteredShifts.length,
    nightShift: filteredShifts.filter(s => s.isNightShift).length,
    dayShift: filteredShifts.filter(s => !s.isNightShift).length,
    overtimeAllowed: filteredShifts.filter(s => s.overtimeAllowed).length,
  };

  // Count active filters
  const activeFilterCount = [selectedNightShiftFilter, selectedOvertimeFilter].filter(Boolean).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<Shift>[] = [
    {
      key: "shiftName", label: "Shift Name", sortable: true,
      render: (row: Shift, v: unknown) => (
        <div className="flex items-center gap-2">
          {row.isNightShift
            ? <MoonIcon className="h-4 w-4 text-indigo-400" />
            : <SunIcon className="h-4 w-4 text-yellow-400" />}
          <div>
            <p className="text-sm font-semibold text-gray-900">{String(v)}</p>
            <p className="text-xs text-gray-400">{row.isNightShift ? "Night Shift" : "Day Shift"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "startTime", label: "Start Time", sortable: true,
      render: (_: Shift, v: unknown) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-700">{formatTime(v as string)}</span>
        </div>
      ),
    },
    {
      key: "endTime", label: "End Time", sortable: true,
      render: (_: Shift, v: unknown) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-red-400" />
          <span className="text-sm text-gray-700">{formatTime(v as string)}</span>
        </div>
      ),
    },
    {
      key: "breakDuration", label: "Break", sortable: true,
      render: (_: Shift, v: unknown) => (
        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
          {Number(v) || 0} min
        </span>
      ),
    },
    {
      key: "gracePeriodMinutes", label: "Grace", sortable: true,
      render: (_: Shift, v: unknown) => (
        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
          {Number(v) || 0} min
        </span>
      ),
    },
    {
      key: "overtimeAllowed", label: "Overtime", sortable: true,
      render: (_: Shift, v: unknown) => v
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Allowed</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircleIcon className="h-3 w-3" />Not Allowed</span>,
    },
    {
      key: "weekOffDays", label: "Week Off", sortable: false,
      render: (row: Shift) => (
        <div className="flex flex-wrap gap-1">
          {row.weekOffDays?.slice(0, 2).map(day => (
            <span key={day} className="px-1.5 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded">
              {day.substring(0, 3)}
            </span>
          ))}
          {row.weekOffDays && row.weekOffDays.length > 2 && (
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              +{row.weekOffDays.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row: Shift) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => openEditForm(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.shiftId!)}
            title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Shift Management" description="Manage work shifts" />
      <PageBreadcrumb pageTitle="Shift Management" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shifts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Configure shift timings, breaks, and grace periods</p>
          </div>
          <AddButton label="Add Shift" onClick={openCreateForm} />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Shifts"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<ClockIcon className="h-6 w-6" />}
          />
          <StatsCard
            label="Day Shifts"
            value={stats.dayShift}
            gradient="from-amber-50 to-yellow-50"
            borderColor="border-amber-100"
            labelColor="text-yellow-600"
            icon={<SunIcon className="h-6 w-6" />}
          />
          <StatsCard
            label="Night Shifts"
            value={stats.nightShift}
            gradient="from-indigo-50 to-blue-50"
            borderColor="border-indigo-100"
            labelColor="text-indigo-600"
            icon={<MoonIcon className="h-6 w-6" />}
          />
          <StatsCard
            label="Overtime Allowed"
            value={stats.overtimeAllowed}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon className="h-6 w-6" />}
          />
        </div>

        {/* Reusable Table */}
        <ReusableTable<Shift>
          data={filteredShifts}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search by shift name or code..."
          searchFields={["shiftName", "shiftCode"]}
          pageSize={PAGE_SIZE}
          defaultSortKey="shiftName"
          defaultSortOrder="asc"
          toolbar={
            <FilterPopover
              title="Filter Shifts"
              buttonLabel="Filter"
              onReset={() => {
                setSelectedNightShiftFilter("");
                setSelectedOvertimeFilter("");
              }}
              showFooter={true}
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shift Type</label>
                  <select
                    value={selectedNightShiftFilter}
                    onChange={e => setSelectedNightShiftFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All Shifts</option>
                    <option value="day">Day Shift</option>
                    <option value="night">Night Shift</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Overtime</label>
                  <select
                    value={selectedOvertimeFilter}
                    onChange={e => setSelectedOvertimeFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All</option>
                    <option value="yes">Overtime Allowed</option>
                    <option value="no">Overtime Not Allowed</option>
                  </select>
                </div>
              </div>
            </FilterPopover>
          }
          emptyState={
            <div className="flex flex-col items-center py-12">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ClockIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No shifts found</p>
              <button
                onClick={openCreateForm}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
              >
                <PlusIcon className="h-4 w-4" />
                Add your first shift
              </button>
            </div>
          }
        />

        {/* Shift Form Modal */}
        <PaginatedPopup
          isOpen={showForm}
          title={editingShift ? "Edit Shift" : "Add Shift"}
          subtitle={editingShift ? "Update shift details" : "Configure a new work shift"}
          onClose={resetForm}
          onSubmit={submitForm}
          submitLabel={editingShift ? "Update Shift" : "Add Shift"}
          fields={[
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.shiftName}
                required
                onChange={e => handleChange("shiftName", e.target.value)}
                placeholder="e.g. Morning Shift"
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shift Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.shiftCode}
                required
                onChange={e => handleChange("shiftCode", e.target.value.toUpperCase())}
                placeholder="e.g. MOR"
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.startTime}
                required
                onChange={e => handleChange("startTime", e.target.value)}
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.endTime}
                required
                onChange={e => handleChange("endTime", e.target.value)}
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Break Duration (minutes)</label>
              <input
                type="number"
                min={0}
                value={form.breakDuration}
                onChange={e => handleChange("breakDuration", Number(e.target.value))}
                className={inputCls}
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Grace Period (minutes)</label>
              <input
                type="number"
                min={0}
                value={form.gracePeriodMinutes}
                onChange={e => handleChange("gracePeriodMinutes", Number(e.target.value))}
                className={inputCls}
              />
            </div>,
            <label className="flex items-center gap-3 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={!!form.isNightShift}
                onChange={e => handleChange("isNightShift", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-gray-700">Night Shift</span>
            </label>,
            <label className="flex items-center gap-3 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={!!form.overtimeAllowed}
                onChange={e => handleChange("overtimeAllowed", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm font-medium text-gray-700">Overtime Allowed</span>
            </label>,
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Week Off Days</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WEEK_DAYS.map(day => (
                  <label key={day} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.weekOffDays?.includes(day)}
                      onChange={e => {
                        const days = form.weekOffDays || [];
                        if (e.target.checked) {
                          handleChange("weekOffDays", [...days, day]);
                        } else {
                          handleChange("weekOffDays", days.filter(d => d !== day));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-gray-700">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          ]}
        />

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    </>
  );
};

export default ShiftPage;
