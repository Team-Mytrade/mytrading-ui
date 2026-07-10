import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  TrashIcon,
  XMarkIcon,
  CalendarDaysIcon,
  HashtagIcon,
  UserIcon,
  ClockIcon,
  MoonIcon,
  SunIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
  CalendarIcon,
  BriefcaseIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import StatsCard from "../../components/common/Statscard";
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

interface Shift {
  id: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  isNightShift?: boolean;
  breakDuration?: string;
  gracePeriodMinutes?: number;
}

interface EmployeeShiftSchedule {
  id?: number;
  employeeId: number;
  shiftId: number;
  date: string;
  remarks: string;
  status: "PLANNED" | "CONFIRMED" | "CANCELLED";
  employee?: Employee;
  shift?: Shift;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/shift-schedules";
const EMPLOYEE_URL = "/v1/api/payroll/employee";
const SHIFT_URL = "/v1/api/attendance/shifts";

const PAGE_SIZE = 10;

const STATUS_CONFIG = {
  PLANNED: { label: "Planned", color: "bg-blue-100 text-blue-800", icon: PlayIcon },
  CONFIRMED: { label: "Confirmed", color: "bg-green-100 text-green-800", icon: CheckCircleIcon },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircleIcon },
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent";

// ─── Page ─────────────────────────────────────────────────────────────────────

const EmployeeShiftSchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<EmployeeShiftSchedule[]>([]);
  const [filteredSchedules, setFilteredSchedules] = useState<EmployeeShiftSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<EmployeeShiftSchedule | null>(null);
  const [search, setSearch] = useState<string>('');
  const [searchEmployee, setSearchEmployee] = useState<string>('');
  const [sortKey, setSortKey] = useState<keyof EmployeeShiftSchedule>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Form fields
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formShiftId, setFormShiftId] = useState("");
  const [formDate, setFormDate] = useState<Date | null>(new Date());
  const [formRemarks, setFormRemarks] = useState("");
  const [formStatus, setFormStatus] = useState<"PLANNED" | "CONFIRMED" | "CANCELLED">("PLANNED");

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadAll = async () => {
    setLoading(true);
    try {
      const [scheduleRes, empRes, shiftRes] = await Promise.all([
        axios.get<EmployeeShiftSchedule[]>(API_URL),
        axios.get<Employee[]>(`${EMPLOYEE_URL}/all`),
        axios.get<Shift[]>(SHIFT_URL),
      ]);
      setSchedules(scheduleRes.data);
      setEmployees(empRes.data);
      setShifts(shiftRes.data);
    } catch (err) {
      console.error("Error loading data:", err);
      ToasterService.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [schedules, search, searchEmployee, selectedStatus, selectedEmployeeFilter, sortKey, sortOrder]);

  const applyFilters = () => {
    let filtered = [...schedules];

    // Filter by employee name/code
    if (searchEmployee) {
      const searchTerm = searchEmployee.toLowerCase();
      filtered = filtered.filter(s =>
        s.employee?.firstName?.toLowerCase().includes(searchTerm) ||
        s.employee?.lastName?.toLowerCase().includes(searchTerm) ||
        s.employee?.employeeCode?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by selected employee dropdown
    if (selectedEmployeeFilter) {
      filtered = filtered.filter(s => s.employeeId.toString() === selectedEmployeeFilter);
    }

    // Filter by date search
    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.date?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by status
    if (selectedStatus) {
      filtered = filtered.filter(s => s.status === selectedStatus);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let valA = a[sortKey as keyof EmployeeShiftSchedule];
      let valB = b[sortKey as keyof EmployeeShiftSchedule];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      return 0;
    });

    setFilteredSchedules(sorted);
    setPage(1);
  };

  // ── Form ────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormEmployeeId("");
    setFormShiftId("");
    setFormDate(new Date());
    setFormRemarks("");
    setFormStatus("PLANNED");
    setEditingSchedule(null);
    setShowForm(false);
  };

  const openEdit = (schedule: EmployeeShiftSchedule) => {
    setFormEmployeeId(schedule.employeeId.toString());
    setFormShiftId(schedule.shiftId.toString());
    setFormDate(new Date(schedule.date));
    setFormRemarks(schedule.remarks || "");
    setFormStatus(schedule.status);
    setEditingSchedule(schedule);
    setShowForm(true);

    // Scroll to form
    document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDate) { ToasterService.error("Date is required"); return; }
    if (!formEmployeeId) { ToasterService.error("Employee is required"); return; }
    if (!formShiftId) { ToasterService.error("Shift is required"); return; }

    const payload = {
      employeeId: parseInt(formEmployeeId),
      shiftId: parseInt(formShiftId),
      date: formDate.toISOString().split('T')[0],
      remarks: formRemarks,
      status: formStatus,
    };
    const sample = { employeeId: 38, shiftId: 1, date: "2026-05-13", remarks: "Sample", status: "CONFIRMED" }

    try {
      if (editingSchedule?.id) {
        await axios.put(`${API_URL}/${editingSchedule.id}`, payload);
        ToasterService.success("Schedule updated successfully");
      } else {
        await axios.post(`/v1/api/attendance/shiftShedules/create`, sample);
        ToasterService.success("Schedule assigned successfully");
      }
      await loadAll();
      resetForm();
    } catch (err: any) {
      console.error("Save failed:", err);
      ToasterService.error(err.response?.data?.message || "Assignment failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this shift schedule? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Schedule deleted successfully");
      await loadAll();
    } catch (err: any) {
      console.error("Delete failed:", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalRecords = filteredSchedules.length;
  const totalPlanned = filteredSchedules.filter(s => s.status === "PLANNED").length;
  const totalConfirmed = filteredSchedules.filter(s => s.status === "CONFIRMED").length;
  const totalEmployees = new Set(filteredSchedules.map(s => s.employeeId).filter(Boolean)).size;

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(schedules.map(s => [s.employeeId, {
    id: s.employeeId,
    name: s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : `Employee ${s.employeeId}`,
    code: s.employee?.employeeCode || ''
  }])).values()];

  // Get unique statuses for filter
  const uniqueStatuses = [...new Set(schedules.map(s => s.status).filter(Boolean))];

  const paginated = filteredSchedules.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredSchedules.length / PAGE_SIZE);

  const handleSort = (field: keyof EmployeeShiftSchedule) => {
    if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortKey(field); setSortOrder("asc"); }
  };

  const SortIcon = ({ col }: { col: keyof EmployeeShiftSchedule }) =>
    sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

  return (
    <>
      <PageMeta title="Employee Shift Schedules" description="Manage employee shift schedules" />
      <PageBreadcrumb pageTitle="Shift Schedules" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        {!showForm && (
          <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
            <AddButton label="Assign Schedule" onClick={() => setShowForm(true)} />
          </div>
        )}

        {!showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatsCard label="Total Schedules" value={totalRecords} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<CalendarIcon className="h-6 w-6" />} />
            <StatsCard label="Planned" value={totalPlanned} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<PlayIcon className="h-6 w-6" />} />
            <StatsCard label="Confirmed" value={totalConfirmed} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
            <StatsCard label="Employees Covered" value={totalEmployees} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<UserIcon className="h-6 w-6" />} />
          </div>
        )}

        {/* Inline Form */}
        {showForm && (
          <div id="schedule-form" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSchedule ? "Edit Shift Schedule" : "Assign Shift Schedule"}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formEmployeeId}
                    onChange={e => setFormEmployeeId(e.target.value)}
                    className={inputCls}
                    required
                    disabled={!!editingSchedule}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
                      </option>
                    ))}
                  </select>
                  {editingSchedule && (
                    <p className="mt-1 text-xs text-gray-500">Employee cannot be changed while editing</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formShiftId}
                    onChange={e => setFormShiftId(e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">Select Shift</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.shiftName} ({s.startTime} – {s.endTime}) {s.isNightShift ? "🌙 Night" : "☀️ Day"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={formDate}
                    onChange={(date: Date | null) => setFormDate(date)}
                    dateFormat="yyyy-MM-dd"
                    className={inputCls}
                    placeholderText="Select date"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as "PLANNED" | "CONFIRMED" | "CANCELLED")}
                    className={inputCls}
                    required
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                  <textarea
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    rows={3}
                    className={inputCls}
                    placeholder="Enter remarks (optional)"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !text-white rounded-lg font-medium transition-colors"
                >
                  {editingSchedule ? "Update Schedule" : "Assign Schedule"}
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
        )}

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by employee..."
                value={searchEmployee}
                onChange={e => setSearchEmployee(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by date..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-48 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
                setTimeout(() => {
                  document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Assign Shift</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 shadow-sm ${showFilters
                ? 'bg-cyan-50 border-cyan-300 text-cyan-600'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <FunnelIcon className="h-4 w-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select
                  value={selectedEmployeeFilter}
                  onChange={e => setSelectedEmployeeFilter(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Employees</option>
                  {uniqueEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} - {emp.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Status</option>
                  {uniqueStatuses.map(status => (
                    <option key={status} value={status}>
                      {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status}
                    </option>
                  ))}
                </select>
              </div>
              {(selectedEmployeeFilter || selectedStatus) && (
                <button
                  onClick={() => {
                    setSelectedEmployeeFilter("");
                    setSelectedStatus("");
                  }}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("employeeId")}>
                    <span className="flex items-center">Employee <SortIcon col="employeeId" /></span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("shiftId")}>
                    <span className="flex items-center">Shift <SortIcon col="shiftId" /></span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("date")}>
                    <span className="flex items-center">Date <SortIcon col="date" /></span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("status")}>
                    <span className="flex items-center">Status <SortIcon col="status" /></span>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                        <p className="text-gray-500 text-sm">Loading schedules...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length > 0 ? paginated.map(schedule => {
                  const StatusIcon = STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG]?.icon || PlayIcon;
                  return (
                    <tr key={schedule.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-cyan-700">
                              {schedule.employee?.firstName?.charAt(0) || schedule.employee?.lastName?.charAt(0) || 'E'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {schedule.employee ? `${schedule.employee.firstName} ${schedule.employee.lastName}` : `Employee ID: ${schedule.employeeId}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              {schedule.employee?.employeeCode || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {schedule.shift?.isNightShift ? (
                            <MoonIcon className="h-4 w-4 text-indigo-400" />
                          ) : (
                            <SunIcon className="h-4 w-4 text-yellow-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{schedule.shift?.shiftName || `Shift ID: ${schedule.shiftId}`}</p>
                            <p className="text-xs text-gray-400">
                              {schedule.shift?.startTime && schedule.shift?.endTime
                                ? `${schedule.shift.startTime} – ${schedule.shift.endTime}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {schedule.date ? new Date(schedule.date).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{schedule.remarks || "—"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {STATUS_CONFIG[schedule.status as keyof typeof STATUS_CONFIG]?.label || schedule.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(schedule)}
                            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id!)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No shift schedules found</p>
                        <button
                          onClick={() => {
                            resetForm();
                            setShowForm(true);
                            setTimeout(() => {
                              document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                          }}
                          className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                        >
                          Assign your first shift →
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 0 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(page * PAGE_SIZE, filteredSchedules.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredSchedules.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                            ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

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
export default EmployeeShiftSchedulePage;
