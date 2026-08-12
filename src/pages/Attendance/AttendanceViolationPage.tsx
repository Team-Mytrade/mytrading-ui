import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  CalendarDaysIcon,
  HashtagIcon,
  UserIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  FunnelIcon,
  ArrowPathIcon,
  BeakerIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import FilterPopover from "../../components/common/filter";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

type ViolationType =
  | "LATE_ARRIVAL"
  | "EARLY_EXIT"
  | "MISSING_CHECKIN"
  | "MISSING_CHECKOUT"
  | "UNAUTHORIZED_ABSENCE"
  | "SHIFT_MISMATCH"
  | "OTHER";

interface AttendanceViolation {
  id?: number;
  employeeId: number;
  employeeName: string;
  date: string;
  violationType: ViolationType;
  duration: string;
  reason: string;
  resolved: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "/v1/api/attendance/violations";
const EMPLOYEE_URL = "/v1/api/payroll/employee";

const PAGE_SIZE = 10;

const VIOLATION_STYLES: Record<ViolationType, string> = {
  LATE_ARRIVAL: "bg-yellow-100 text-yellow-700",
  EARLY_EXIT: "bg-orange-100 text-orange-700",
  MISSING_CHECKIN: "bg-purple-100 text-purple-700",
  MISSING_CHECKOUT: "bg-indigo-100 text-indigo-700",
  UNAUTHORIZED_ABSENCE: "bg-red-100 text-red-700",
  SHIFT_MISMATCH: "bg-pink-100 text-pink-700",
  OTHER: "bg-gray-100 text-gray-700",
};

const VIOLATION_LABELS: Record<ViolationType, string> = {
  LATE_ARRIVAL: "Late Arrival",
  EARLY_EXIT: "Early Exit",
  MISSING_CHECKIN: "Missing Check-in",
  MISSING_CHECKOUT: "Missing Check-out",
  UNAUTHORIZED_ABSENCE: "Unauthorized Absence",
  SHIFT_MISMATCH: "Shift Mismatch",
  OTHER: "Other",
};

const VIOLATION_ICONS: Record<ViolationType, React.ReactNode> = {
  LATE_ARRIVAL: <ClockIcon className="h-3 w-3" />,
  EARLY_EXIT: <ClockIcon className="h-3 w-3" />,
  MISSING_CHECKIN: <ExclamationTriangleIcon className="h-3 w-3" />,
  MISSING_CHECKOUT: <ExclamationTriangleIcon className="h-3 w-3" />,
  UNAUTHORIZED_ABSENCE: <XCircleIcon className="h-3 w-3" />,
  SHIFT_MISMATCH: <ExclamationTriangleIcon className="h-3 w-3" />,
  OTHER: <DocumentTextIcon className="h-3 w-3" />,
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: AttendanceViolation = {
  employeeId: 0,
  employeeName: "",
  date: new Date().toISOString().split('T')[0],
  violationType: "LATE_ARRIVAL",
  duration: "",
  reason: "",
  resolved: false,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const formatDuration = (duration: string): string => {
  if (!duration) return "—";

  // Handle both formats: with or without PT prefix
  let cleanDuration = duration;
  if (cleanDuration.startsWith("PT")) {
    cleanDuration = cleanDuration.substring(2);
  }

  const match = cleanDuration.match(/(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    const hours = match[1] ? parseInt(match[1]) : 0;
    const minutes = match[2] ? parseInt(match[2]) : 0;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
  }
  return duration;
};

// Convert duration value and unit to API format (without PT prefix)
const formatDurationForAPI = (value: string, unit: "M" | "H"): string => {
  if (!value || parseInt(value) <= 0) return "";
  return `${value}${unit}`;
};

// Parse duration from API format to value and unit
const parseDurationFromAPI = (duration: string): { value: string; unit: "M" | "H" } => {
  if (!duration) return { value: "", unit: "M" };

  let cleanDuration = duration;
  if (cleanDuration.startsWith("PT")) {
    cleanDuration = cleanDuration.substring(2);
  }

  const hoursMatch = cleanDuration.match(/(\d+)H/);
  const minutesMatch = cleanDuration.match(/(\d+)M/);

  if (hoursMatch) {
    return { value: hoursMatch[1], unit: "H" };
  } else if (minutesMatch) {
    return { value: minutesMatch[1], unit: "M" };
  }

  return { value: "", unit: "M" };
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AttendanceViolationPage: React.FC = () => {
  const [violations, setViolations] = useState<AttendanceViolation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingViolation, setEditingViolation] = useState<AttendanceViolation | null>(null);
  const [form, setForm] = useState<AttendanceViolation>({ ...emptyForm });
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");

  // Duration fields
  const [durationValue, setDurationValue] = useState<string>("");
  const [durationUnit, setDurationUnit] = useState<"M" | "H">("M");
  const [durationError, setDurationError] = useState<string>("");

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${EMPLOYEE_URL}/all`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load employees");
    }
  };

  const loadViolations = async () => {
    setLoading(true);
    try {
      const res = await axios.get<AttendanceViolation[]>(BASE_URL);
      setViolations(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load violations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadViolations();
  }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof AttendanceViolation, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      handleChange("date", date.toISOString().split('T')[0]);
    }
  };

  // Handle duration with validation
  const handleDurationChange = (value: string, unit: "M" | "H") => {
    setDurationValue(value);
    setDurationUnit(unit);
    setDurationError("");

    if (value && parseInt(value) > 0) {
      // Validate minutes (cannot exceed 60)
      if (unit === "M" && parseInt(value) > 60) {
        setDurationError("Minutes cannot exceed 60. For longer durations, please use Hours.");
        handleChange("duration", "");
        return;
      }

      // Format without PT prefix
      const duration = formatDurationForAPI(value, unit);
      handleChange("duration", duration);
    } else {
      handleChange("duration", "");
    }
  };

  // Parse existing duration for edit form
  const parseDurationForEdit = (duration: string) => {
    if (!duration) {
      setDurationValue("");
      setDurationUnit("M");
      return;
    }
    const { value, unit } = parseDurationFromAPI(duration);
    setDurationValue(value);
    setDurationUnit(unit);
  };

  const resetForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setDurationValue("");
    setDurationUnit("M");
    setDurationError("");
    setEditingViolation(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setDurationValue("");
    setDurationUnit("M");
    setDurationError("");
    setEditingViolation(null);
    setShowForm(true);
  };

  const openEditForm = (violation: AttendanceViolation) => {
    setForm({ ...violation });
    parseDurationForEdit(violation.duration);
    setEditingViolation(violation);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.date) {
      ToasterService.error("Please select a date");
      return;
    }

    // Validate duration before submit
    if (durationValue && parseInt(durationValue) > 0) {
      if (durationUnit === "M" && parseInt(durationValue) > 60) {
        ToasterService.error("Minutes cannot exceed 60. Please use Hours for longer durations.");
        return;
      }
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      date: form.date,
      violationType: form.violationType,
      duration: form.duration, // Already formatted without PT prefix
      reason: form.reason,
      resolved: form.resolved,
    };

    try {
      if (editingViolation?.id) {
        await axios.put(`${BASE_URL}/${editingViolation.id}`, payload);
        ToasterService.success("Violation updated successfully");
      } else {
        await axios.post(`${BASE_URL}/create`, payload);
        ToasterService.success("Violation recorded successfully");
      }
      await loadViolations();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  const evaluateViolation = async () => {
    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.date) {
      ToasterService.error("Please select a date");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${BASE_URL}/evaluate?employeeId=${form.employeeId}&date=${form.date}`);
      ToasterService.success("Violation evaluation completed");
      await loadViolations();
      resetForm();
    } catch (err: any) {
      console.error("Evaluation failed", err);
      ToasterService.error(err.response?.data?.message || "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this violation record? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${BASE_URL}/${id}`);
      ToasterService.success("Violation deleted successfully");
      await loadViolations();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  const toggleResolved = async (violation: AttendanceViolation) => {
    const updatedViolation = { ...violation, resolved: !violation.resolved };
    try {
      await axios.put(`${BASE_URL}/${violation.id}`, updatedViolation);
      ToasterService.success(`Violation marked as ${updatedViolation.resolved ? "resolved" : "unresolved"}`);
      await loadViolations();
    } catch (err: any) {
      console.error("Update failed", err);
      ToasterService.error(err.response?.data?.message || "Update failed");
    }
  };

  // ── Stats & Filters ─────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    let filtered = [...violations];

    if (selectedEmployeeFilter) {
      filtered = filtered.filter(v => v.employeeId.toString() === selectedEmployeeFilter);
    }

    if (selectedTypeFilter) {
      filtered = filtered.filter(v => v.violationType === selectedTypeFilter);
    }

    if (selectedStatusFilter !== "") {
      filtered = filtered.filter(v => v.resolved === (selectedStatusFilter === "resolved"));
    }

    return filtered;
  }, [violations, selectedEmployeeFilter, selectedTypeFilter, selectedStatusFilter]);

  const stats = {
    total: filteredData.length,
    late: filteredData.filter(v => v.violationType === "LATE_ARRIVAL").length,
    absent: filteredData.filter(v => v.violationType === "UNAUTHORIZED_ABSENCE").length,
    resolved: filteredData.filter(v => v.resolved).length,
  };

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(violations.map(v => [v.employeeId, {
    id: v.employeeId,
    name: v.employeeName
  }])).values()];

  const violationTypes = Object.keys(VIOLATION_LABELS) as ViolationType[];

  // Count active filters
  const activeFilterCount = [selectedEmployeeFilter, selectedTypeFilter, selectedStatusFilter].filter(Boolean).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<AttendanceViolation>[] = [
    {
      key: "date", label: "Date", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {v ? new Date(String(v)).toLocaleDateString() : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "employeeName", label: "Employee", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.employeeName}</span>
        </div>
      ),
    },
    {
      key: "violationType", label: "Violation", sortable: true,
      render: (_, v) => {
        const type = v as ViolationType;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${VIOLATION_STYLES[type]}`}>
            {VIOLATION_ICONS[type]}
            {VIOLATION_LABELS[type]}
          </span>
        );
      },
    },
    {
      key: "duration", label: "Duration", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{formatDuration(v as string)}</span>
        </div>
      ),
    },
    {
      key: "reason", label: "Reason", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[200px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "resolved", label: "Status", sortable: true,
      render: (_, v) => v
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Resolved</span>
        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircleIcon className="h-3 w-3" />Pending</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => toggleResolved(row)}
            title={row.resolved ? "Mark as Pending" : "Mark as Resolved"}
            className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
          >
            <CheckCircleIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => openEditForm(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
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
      <PageMeta title="Attendance Violations" description="Manage attendance violations" />
      <PageBreadcrumb pageTitle="Attendance Violations" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        {!showForm && (
          <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
            <AddButton label="Add Violation" onClick={openCreateForm} />
          </div>
        )}

        {!showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard label="Total Violations" value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<ExclamationTriangleIcon className="h-6 w-6" />} />
            <StatsCard label="Late Arrivals" value={stats.late} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-6 w-6" />} />
            <StatsCard label="Absent" value={stats.absent} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" icon={<XCircleIcon className="h-6 w-6" />} />
            <StatsCard label="Resolved" value={stats.resolved} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
          </div>
        )}

        {/* Conditional Rendering: Form OR Table */}
        {showForm ? (
          // Form View
          <div className={`${cardCls} mb-6`}>
            <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <ExclamationTriangleIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingViolation ? "Edit Violation" : "Record Violation"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingViolation ? "Update violation details" : "Record a new attendance violation"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to list"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={submitForm} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.employeeId || ""}
                    required
                    onChange={e => {
                      const employeeId = Number(e.target.value);
                      const employee = employees.find(emp => emp.id === employeeId);
                      handleChange("employeeId", employeeId);
                      handleChange("employeeName", employee ? `${employee.firstName} ${employee.lastName}` : "");
                    }}
                    className={inputCls}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={form.date ? new Date(form.date) : null}
                    onChange={handleDateChange}
                    dateFormat="yyyy-MM-dd"
                    className={inputCls}
                    placeholderText="Select date"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Violation Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.violationType}
                    onChange={e => handleChange("violationType", e.target.value as ViolationType)}
                    className={inputCls}
                    required
                  >
                    {violationTypes.map(type => (
                      <option key={type} value={type}>{VIOLATION_LABELS[type]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={durationValue}
                      onChange={e => handleDurationChange(e.target.value, durationUnit)}
                      placeholder="Enter duration"
                      className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${durationError ? 'border-red-500' : 'border-gray-300'
                        }`}
                    />
                    <select
                      value={durationUnit}
                      onChange={e => handleDurationChange(durationValue, e.target.value as "M" | "H")}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    >
                      <option value="M">Minutes</option>
                      <option value="H">Hours</option>
                    </select>
                  </div>
                  {durationError && (
                    <p className="mt-1 text-xs text-red-500">{durationError}</p>
                  )}
                  {!durationError && (
                    <p className="mt-1 text-xs text-gray-500">Minutes cannot exceed 60. Use Hours for longer durations.</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                  <textarea
                    value={form.reason}
                    onChange={e => handleChange("reason", e.target.value)}
                    rows={3}
                    placeholder="Describe the reason for this violation..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.resolved}
                      onChange={e => handleChange("resolved", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Mark as Resolved</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !mb-0 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {editingViolation ? (
                    <>
                      <PencilSquareIcon className="h-4 w-4" />
                      Update Violation
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Create Violation
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={evaluateViolation}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 !mb-0 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <BeakerIcon className="h-4 w-4" />
                  Auto-Evaluate
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          // Table View
          <>
            {/* Reusable Table */}
            <ReusableTable<AttendanceViolation>
              data={filteredData}
              columns={columns}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search by employee or reason..."
              searchFields={["employeeName", "reason"]}
              pageSize={PAGE_SIZE}
              defaultSortKey="date"
              defaultSortOrder="desc"
              toolbar={
                <FilterPopover
                  title="Filter Violations"
                  buttonLabel="Filter"
                  onReset={() => {
                    setSelectedEmployeeFilter("");
                    setSelectedTypeFilter("");
                    setSelectedStatusFilter("");
                  }}
                  showFooter={true}
                  widthClassName="w-72"
                >
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Employee</label>
                      <select
                        value={selectedEmployeeFilter}
                        onChange={e => setSelectedEmployeeFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      >
                        <option value="">All Employees</option>
                        {uniqueEmployees.map(emp => (
                          <option key={emp.id} value={emp.id.toString()}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Violation Type</label>
                      <select
                        value={selectedTypeFilter}
                        onChange={e => setSelectedTypeFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      >
                        <option value="">All Types</option>
                        {violationTypes.map(type => (
                          <option key={type} value={type}>{VIOLATION_LABELS[type]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={selectedStatusFilter}
                        onChange={e => setSelectedStatusFilter(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                      >
                        <option value="">All Status</option>
                        <option value="resolved">Resolved</option>
                        <option value="pending">Pending</option>
                      </select>
                    </div>
                  </div>
                </FilterPopover>
              }
              emptyState={
                <div className="flex flex-col items-center py-12">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ExclamationTriangleIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No violations found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Record a violation
                  </button>
                </div>
              }
            />
          </>
        )}

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

export default AttendanceViolationPage;
