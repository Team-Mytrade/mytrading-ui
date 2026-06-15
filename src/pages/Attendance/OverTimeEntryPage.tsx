import React, { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  XMarkIcon,
  UserIcon,
  CalendarDaysIcon,
  ClockIcon,
  HashtagIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  BoltIcon,
  TagIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

interface OvertimeRule {
  id: number;
  ruleName: string;
  multiplier?: number;
}

interface OvertimeEntry {
  id?: number;
  employeeId: number;
  employeeName: string;
  attendanceRecordId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  ruleId: number | null;
  ruleName: string | null;
  totalHours: number;
  status: Status;
  remarks: string | null;
  overtimeHours: number;
  overtimeStart: string | null;
  overtimeEnd: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/overtime";
const EMPLOYEE_API = "/v1/api/payroll/employee";
const RULE_API = "/v1/api/attendance/overtime-rules";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<Status, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<Status, React.ReactNode> = {
  PENDING: <ClockIcon className="h-3 w-3" />,
  APPROVED: <CheckCircleIcon className="h-3 w-3" />,
  REJECTED: <XCircleIcon className="h-3 w-3" />,
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: OvertimeEntry = {
  employeeId: 0,
  employeeName: "",
  attendanceRecordId: null,
  date: "",
  startTime: "",
  endTime: "",
  ruleId: null,
  ruleName: null,
  totalHours: 0,
  status: "PENDING",
  remarks: null,
  overtimeHours: 0,
  overtimeStart: null,
  overtimeEnd: null,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const calculateTotalHours = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;

  // Parse time strings (format: "HH:mm:ss" or "HH:mm")
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');

  const startHour = parseInt(startParts[0]);
  const startMinute = parseInt(startParts[1]);
  const endHour = parseInt(endParts[0]);
  const endMinute = parseInt(endParts[1]);

  let totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);

  // Handle overnight (if end time is less than start time, assume next day)
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const totalHours = totalMinutes / 60;
  return Math.round(totalHours * 10) / 10;
};

const formatTimeForDisplay = (timeStr: string): string => {
  if (!timeStr) return "—";
  // Format "HH:mm:ss" to "HH:mm"
  return timeStr.substring(0, 5);
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const OverTimeEntryPage: React.FC = () => {
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<OvertimeEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rules, setRules] = useState<OvertimeRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<OvertimeEntry | null>(null);
  const [form, setForm] = useState<OvertimeEntry>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Time picker states
  const [startTimeDate, setStartTimeDate] = useState<Date | null>(null);
  const [endTimeDate, setEndTimeDate] = useState<Date | null>(null);

  // Action popup state
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<OvertimeEntry | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${EMPLOYEE_API}/all`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load employees");
    }
  };

  const loadRules = async () => {
    try {
      const res = await axios.get<OvertimeRule[]>(RULE_API);
      setRules(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load overtime rules");
    }
  };

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await axios.get<OvertimeEntry[]>(API_URL);
      setEntries(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load overtime entries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadRules();
    loadEntries();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [entries, search, selectedEmployeeFilter, selectedStatusFilter, dateRange.from, dateRange.to]);

  const applyFilters = () => {
    let filtered = [...entries];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(e =>
        e.employeeName?.toLowerCase().includes(searchTerm) ||
        e.remarks?.toLowerCase().includes(searchTerm) ||
        e.ruleName?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedEmployeeFilter) {
      filtered = filtered.filter(e => e.employeeId.toString() === selectedEmployeeFilter);
    }

    if (selectedStatusFilter) {
      filtered = filtered.filter(e => e.status === selectedStatusFilter);
    }

    if (dateRange.from) {
      filtered = filtered.filter(e => new Date(e.date) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(e => new Date(e.date) <= dateRange.to!);
    }

    setFilteredEntries(filtered);
  };

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof OvertimeEntry, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleStartTimeChange = (time: Date | null) => {
    setStartTimeDate(time);
    if (time) {
      const timeStr = time.toTimeString().split(' ')[0]; // Format: HH:mm:ss
      handleChange("startTime", timeStr);

      // Recalculate total hours when either time changes
      if (timeStr && form.endTime) {
        const totalHours = calculateTotalHours(timeStr, form.endTime);
        handleChange("totalHours", totalHours);
        handleChange("overtimeHours", totalHours);
      }
    } else {
      handleChange("startTime", "");
      handleChange("totalHours", 0);
    }
  };

  const handleEndTimeChange = (time: Date | null) => {
    setEndTimeDate(time);
    if (time) {
      const timeStr = time.toTimeString().split(' ')[0]; // Format: HH:mm:ss
      handleChange("endTime", timeStr);

      // Recalculate total hours when either time changes
      if (form.startTime && timeStr) {
        const totalHours = calculateTotalHours(form.startTime, timeStr);
        handleChange("totalHours", totalHours);
        handleChange("overtimeHours", totalHours);
      }
    } else {
      handleChange("endTime", "");
      handleChange("totalHours", 0);
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      handleChange("date", date.toISOString().split('T')[0]);
    } else {
      handleChange("date", "");
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setStartTimeDate(null);
    setEndTimeDate(null);
    setEditingEntry(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm });
    setStartTimeDate(null);
    setEndTimeDate(null);
    setEditingEntry(null);
    setShowForm(true);
  };

  const openEditForm = (entry: OvertimeEntry) => {
    setForm({ ...entry });
    // Parse times for time pickers
    if (entry.startTime) {
      const [hours, minutes] = entry.startTime.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0);
      setStartTimeDate(date);
    }
    if (entry.endTime) {
      const [hours, minutes] = entry.endTime.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0);
      setEndTimeDate(date);
    }
    setEditingEntry(entry);
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
    if (!form.startTime) {
      ToasterService.error("Please select start time");
      return;
    }
    if (!form.endTime) {
      ToasterService.error("Please select end time");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      attendanceRecordId: form.attendanceRecordId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      ruleId: form.ruleId,
      ruleName: form.ruleName,
      totalHours: form.totalHours,
      status: form.status,
      remarks: form.remarks,
      overtimeHours: form.overtimeHours,
      overtimeStart: form.overtimeStart,
      overtimeEnd: form.overtimeEnd,
    };

    try {
      if (editingEntry?.id) {
        await axios.put(`${API_URL}/${editingEntry.id}`, payload);
        ToasterService.success("Overtime entry updated successfully");
      } else {
        await axios.post(`${API_URL}/log`, payload);
        ToasterService.success("Overtime entry logged successfully");
      }
      await loadEntries();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Approve / Reject ─────────────────────────────────────────────────────────

  const openActionDialog = (entry: OvertimeEntry, type: "APPROVE" | "REJECT") => {
    setSelectedEntry(entry);
    setActionType(type);
    setActionRemarks("");
    setShowActionDialog(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedEntry || !actionType) return;

    const endpoint = actionType === "APPROVE" ? `${API_URL}/approve` : `${API_URL}/reject`;
    const successMsg = actionType === "APPROVE" ? "Overtime entry approved successfully" : "Overtime entry rejected successfully";

    try {
      await axios.post(endpoint, null, {
        params: { entryId: selectedEntry.id, remarks: actionRemarks }
      });
      ToasterService.success(successMsg);
      await loadEntries();
    } catch (err: any) {
      console.error("Failed to process request", err);
      ToasterService.error(err.response?.data?.message || "Failed to process request");
    } finally {
      setShowActionDialog(false);
      setSelectedEntry(null);
      setActionType(null);
      setActionRemarks("");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this overtime entry? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Overtime entry deleted successfully");
      await loadEntries();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalHours = filteredEntries.reduce((s, e) => s + (e.totalHours || 0), 0);
  const stats = {
    total: filteredEntries.length,
    pending: filteredEntries.filter(e => e.status === "PENDING").length,
    approved: filteredEntries.filter(e => e.status === "APPROVED").length,
    totalHrs: Math.round(totalHours * 10) / 10,
  };

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(entries.map(e => [e.employeeId, {
    id: e.employeeId,
    name: e.employeeName
  }])).values()];

  const statusOptions: Status[] = ["PENDING", "APPROVED", "REJECTED"];

  // Count active filters
  const activeFilterCount = [selectedEmployeeFilter, selectedStatusFilter, dateRange.from, dateRange.to].filter(Boolean).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<OvertimeEntry>[] = [
    {
      key: "date", label: "Date", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => (
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
      render: (row: OvertimeEntry) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.employeeName}</span>
        </div>
      ),
    },
    {
      key: "startTime", label: "Start", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-700">{formatTimeForDisplay(v as string)}</span>
        </div>
      ),
    },
    {
      key: "endTime", label: "End", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-red-400" />
          <span className="text-sm text-gray-700">{formatTimeForDisplay(v as string)}</span>
        </div>
      ),
    },
    {
      key: "ruleName", label: "Rule", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => (
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "totalHours", label: "Hours", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
          <BoltIcon className="h-3 w-3" />{String(v)}h
        </span>
      ),
    },
    {
      key: "remarks", label: "Remarks", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[150px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (_: OvertimeEntry, v: unknown) => {
        const status = v as Status;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}>
            {STATUS_ICONS[status]}{status}
          </span>
        );
      },
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row: OvertimeEntry) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {row.status === "PENDING" && (
            <>
              <button
                onClick={() => openActionDialog(row, "APPROVE")}
                title="Approve"
                className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              >
                <CheckCircleIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => openActionDialog(row, "REJECT")}
                title="Reject"
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            </>
          )}
          {row.status === "PENDING" && (
            <button
              onClick={() => openEditForm(row)}
              title="Edit"
              className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
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
      <PageMeta title="Overtime Entries" description="Manage overtime entries" />
      <PageBreadcrumb pageTitle="Overtime Entries" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overtime Entries</h1>
            <p className="text-sm text-gray-500 mt-0.5">Log and manage employee overtime records</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Log Overtime</span>
            </button>
          )}
        </div>

        {/* Stats Cards - Hidden when form is visible */}
        {!showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Entries</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-3 bg-cyan-100 rounded-full">
                  <BoltIcon className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-full">
                  <ClockIcon className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Hours</p>
                  <p className="text-2xl font-bold text-indigo-600">{stats.totalHrs}h</p>
                </div>
                <div className="p-3 bg-indigo-100 rounded-full">
                  <ClockIcon className="h-6 w-6 text-indigo-600" />
                </div>
              </div>
            </div>
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
                    <BoltIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingEntry ? "Edit Overtime Entry" : "Log Overtime"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingEntry ? "Update overtime entry details" : "Record a new overtime entry"}
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
                    disabled={!!editingEntry}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
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
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={startTimeDate}
                    onChange={handleStartTimeChange}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="Time"
                    dateFormat="hh:mm aa"
                    className={inputCls}
                    placeholderText="Select start time"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={endTimeDate}
                    onChange={handleEndTimeChange}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="Time"
                    dateFormat="hh:mm aa"
                    className={inputCls}
                    placeholderText="Select end time"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Rule</label>
                  <select
                    value={form.ruleId || ""}
                    onChange={e => {
                      const ruleId = Number(e.target.value);
                      const rule = rules.find(r => r.id === ruleId);
                      handleChange("ruleId", ruleId || null);
                      handleChange("ruleName", rule?.ruleName || null);
                    }}
                    className={inputCls}
                  >
                    <option value="">Select Rule (optional)</option>
                    {rules.map(rule => (
                      <option key={rule.id} value={rule.id}>{rule.ruleName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Hours</label>
                  <input
                    type="text"
                    value={form.totalHours ? `${form.totalHours} hours` : "0 hours"}
                    className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                    readOnly
                    disabled
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-calculated from start/end times</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={form.status}
                    onChange={e => handleChange("status", e.target.value as Status)}
                    className={inputCls}
                    disabled={!!editingEntry && editingEntry.status !== "PENDING"}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={form.remarks || ""}
                    onChange={e => handleChange("remarks", e.target.value)}
                    rows={3}
                    placeholder="Add any notes about this overtime..."
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <BoltIcon className="h-4 w-4" />
                  {editingEntry ? "Update Entry" : "Log Overtime"}
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
            {/* Search Bar and Filter Button in same line */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by employee, rule, or remarks..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative px-4 py-2 rounded-lg border transition-all duration-200 flex items-center gap-2 ${showFilters || activeFilterCount > 0
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-600'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <FunnelIcon className="h-4 w-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-2 -right-2 h-5 w-5 bg-cyan-600 text-white text-xs rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {(search || activeFilterCount > 0) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedEmployeeFilter("");
                    setSelectedStatusFilter("");
                    setDateRange({ from: null, to: null });
                    setShowFilters(false);
                  }}
                  className="px-3 py-2 text-sm text-red-600 hover:text-red-800 rounded-lg border border-red-200 hover:bg-red-50 transition-colors flex items-center gap-1"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Clear All
                </button>
              )}
            </div>

            {/* Filter Panel - Collapsible */}
            {showFilters && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                    <select
                      value={selectedEmployeeFilter}
                      onChange={e => setSelectedEmployeeFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Employees</option>
                      {uniqueEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={selectedStatusFilter}
                      onChange={e => setSelectedStatusFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Status</option>
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                    <div className="flex gap-2">
                      <DatePicker
                        selected={dateRange.from}
                        onChange={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        dateFormat="yyyy-MM-dd"
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                        placeholderText="From"
                      />
                      <DatePicker
                        selected={dateRange.to}
                        onChange={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                        dateFormat="yyyy-MM-dd"
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                        placeholderText="To"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reusable Table */}
            <ReusableTable<OvertimeEntry>
              data={filteredEntries}
              columns={columns}
              loading={loading}
              searchable={false}
              pageSize={PAGE_SIZE}
              defaultSortKey="date"
              defaultSortOrder="desc"
              emptyState={
                <div className="flex flex-col items-center py-12">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <BoltIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No overtime entries found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Log your first overtime
                  </button>
                </div>
              }
            />
          </>
        )}

        {/* Action Dialog (Approve/Reject) */}
        {showActionDialog && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowActionDialog(false)}></div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${actionType === "APPROVE" ? "bg-green-100" : "bg-red-100"
                      }`}>
                      {actionType === "APPROVE" ? (
                        <CheckCircleIcon className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircleIcon className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        {actionType === "APPROVE" ? "Approve Overtime Entry" : "Reject Overtime Entry"}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedEntry && `${actionType === "APPROVE" ? "Approving" : "Rejecting"} overtime entry for ${selectedEntry.employeeName} on ${new Date(selectedEntry.date).toLocaleDateString()}`}
                      </p>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Remarks <span className="text-gray-400">(optional)</span>
                        </label>
                        <textarea
                          value={actionRemarks}
                          onChange={e => setActionRemarks(e.target.value)}
                          rows={3}
                          placeholder="Add any remarks..."
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleActionSubmit}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${actionType === "APPROVE"
                        ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                        : "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                      }`}
                  >
                    {actionType === "APPROVE" ? "Approve" : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowActionDialog(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
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

export default OverTimeEntryPage;
