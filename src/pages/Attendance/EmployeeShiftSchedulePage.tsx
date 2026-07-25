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
import ReusableTable, { ColumnDef } from "../../components/common/Table";
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

  const tableData = useMemo(() => {
    return schedules.map((s, index) => ({
      ...s,
      id: s.id || index,
      employeeName: s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : `Employee ID: ${s.employeeId}`,
      shiftName: s.shift?.shiftName || `Shift ID: ${s.shiftId}`,
    }));
  }, [schedules]);

  const columns: ColumnDef<any>[] = [
    {
      key: "employeeName",
      label: "Employee",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center">
            <span className="text-xs font-medium text-cyan-700">
              {row.employee?.firstName?.charAt(0) || row.employee?.lastName?.charAt(0) || 'E'}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">
              {row.employeeName}
            </div>
            {row.employee?.employeeCode && (
              <div className="text-xs text-gray-500">{row.employee.employeeCode}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "shiftName",
      label: "Shift",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-cyan-600" />
          <div>
            <span className="text-sm font-medium text-gray-900">
              {row.shiftName}
            </span>
            {row.shift && (
              <span className="text-xs text-gray-500 block">
                {row.shift.startTime} - {row.shift.endTime}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "date",
      label: "Date",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">
            {row.date ? new Date(row.date).toLocaleDateString() : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (row) => (
        <span className="text-sm text-gray-500 block max-w-xs truncate" title={row.remarks}>
          {row.remarks || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => {
        const config = STATUS_CONFIG[row.status as keyof typeof STATUS_CONFIG];
        const StatusIcon = config?.icon || PlayIcon;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color || 'bg-gray-100 text-gray-800'}`}>
            <StatusIcon className="h-3 w-3" />
            {config?.label || row.status}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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

            <FilterPopover
              title="Filter Schedules"
              buttonLabel="Filter"
              onReset={() => {
                setSelectedEmployeeFilter("");
                setSelectedStatus("");
              }}
              showFooter={true}
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
                      <option key={emp.id} value={emp.id.toString()}>
                        {emp.name} - {emp.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All Status</option>
                    {uniqueStatuses.map(status => (
                      <option key={status} value={status}>
                        {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </FilterPopover>
          </div>
        </div>

        {/* Table */}
        <ReusableTable
          data={tableData}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search schedule..."
          searchFields={["employeeName", "shiftName", "remarks"]}
          pageSize={10}
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
export default EmployeeShiftSchedulePage;
