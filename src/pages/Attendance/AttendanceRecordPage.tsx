import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CalendarDaysIcon,
  HashtagIcon,
  UserIcon,
  ClockIcon,
  MapPinIcon,
  CheckCircleIcon,
  XCircleIcon,
  PauseCircleIcon,
  DevicePhoneMobileIcon,
  FingerPrintIcon,
  PencilIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  BuildingOfficeIcon,
  EyeIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
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
  shiftId: number;
  shiftName: string;
  startTime?: string;
  endTime?: string;
  isNightShift?: boolean;
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "ON_LEAVE";

interface AttendanceRecord {
  id?: number;
  employeeId: number;
  employeeName: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  location: string;
  method: string;
  verified: boolean;
  workHours: number | null;
  attendanceStatus: AttendanceStatus;
  shiftId: number;
  shiftName: string;
  remarks: string;
  employee?: Employee;
  shift?: Shift;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/records";
const EMPLOYEE_URL = "/v1/api/payroll/employee";
const SHIFT_URL = "/v1/api/attendance/shifts";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800",
  ABSENT: "bg-red-100 text-red-700",
  ON_LEAVE: "bg-blue-100 text-blue-800",
};

const STATUS_ICONS: Record<AttendanceStatus, React.ReactNode> = {
  PRESENT: <CheckCircleIcon className="h-3 w-3" />,
  ABSENT: <XCircleIcon className="h-3 w-3" />,
  ON_LEAVE: <PauseCircleIcon className="h-3 w-3" />,
};

const METHOD_ICONS: Record<string, React.ReactNode> = {
  mobile: <DevicePhoneMobileIcon className="h-3.5 w-3.5" />,
  biometric: <FingerPrintIcon className="h-3.5 w-3.5" />,
  manual: <PencilIcon className="h-3.5 w-3.5" />,
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: AttendanceRecord = {
  employeeId: 0,
  employeeName: "",
  date: new Date().toISOString().split('T')[0],
  checkInTime: null,
  checkOutTime: null,
  location: "",
  method: "mobile",
  verified: false,
  workHours: 0,
  attendanceStatus: "PRESENT",
  shiftId: 0,
  shiftName: "",
  remarks: "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AttendanceRecordPage: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState<AttendanceRecord>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Time picker states
  const [checkInDate, setCheckInDate] = useState<Date | null>(null);
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null);

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

  const loadShifts = async () => {
    try {
      const res = await axios.get<Shift[]>(SHIFT_URL);
      setShifts(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load shifts");
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get<AttendanceRecord[]>(API_URL);
      setRecords(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load attendance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadShifts();
    loadRecords();
  }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof AttendanceRecord, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // Handle check-in time change
  const handleCheckInTimeChange = (time: Date | null) => {
    setCheckInDate(time);
    if (time) {
      const date = form.date;
      const dateTime = new Date(`${date}T${time.toTimeString().split(' ')[0]}`);
      handleChange("checkInTime", dateTime.toISOString());

      // Recalculate work hours if check-out is also set
      if (form.checkOutTime) {
        const checkOut = new Date(form.checkOutTime);
        const hours = (checkOut.getTime() - dateTime.getTime()) / (1000 * 60 * 60);
        if (hours > 0) {
          handleChange("workHours", Math.round(hours * 100) / 100);
        }
      }
    } else {
      handleChange("checkInTime", null);
      handleChange("workHours", 0);
    }
  };

  // Handle check-out time change
  const handleCheckOutTimeChange = (time: Date | null) => {
    setCheckOutDate(time);
    if (time && form.checkInTime) {
      const date = form.date;
      const dateTime = new Date(`${date}T${time.toTimeString().split(' ')[0]}`);
      handleChange("checkOutTime", dateTime.toISOString());

      // Calculate work hours
      const checkIn = new Date(form.checkInTime);
      const hours = (dateTime.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      if (hours > 0) {
        handleChange("workHours", Math.round(hours * 100) / 100);
      }
    } else if (time && !form.checkInTime) {
      handleChange("checkOutTime", null);
      ToasterService.warning("Please set check-in time first");
    } else {
      handleChange("checkOutTime", null);
      handleChange("workHours", 0);
    }
  };

  // Handle date change
  const handleDateChange = (date: Date | null) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      handleChange("date", dateStr);

      // Update check-in and check-out times with new date
      if (form.checkInTime && checkInDate) {
        const newCheckIn = new Date(`${dateStr}T${checkInDate.toTimeString().split(' ')[0]}`);
        handleChange("checkInTime", newCheckIn.toISOString());
      }
      if (form.checkOutTime && checkOutDate) {
        const newCheckOut = new Date(`${dateStr}T${checkOutDate.toTimeString().split(' ')[0]}`);
        handleChange("checkOutTime", newCheckOut.toISOString());

        // Recalculate work hours
        if (form.checkInTime) {
          const checkIn = new Date(form.checkInTime);
          const hours = (newCheckOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          if (hours > 0) {
            handleChange("workHours", Math.round(hours * 100) / 100);
          }
        }
      }
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setCheckInDate(null);
    setCheckOutDate(null);
    setEditingRecord(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setCheckInDate(null);
    setCheckOutDate(null);
    setEditingRecord(null);
    setShowForm(true);
  };

  const openEditForm = (record: AttendanceRecord) => {
    setForm({ ...record });

    // Parse times for time pickers
    if (record.checkInTime) {
      const checkIn = new Date(record.checkInTime);
      setCheckInDate(checkIn);
    }
    if (record.checkOutTime) {
      const checkOut = new Date(record.checkOutTime);
      setCheckOutDate(checkOut);
    }

    setEditingRecord(record);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.date) {
      ToasterService.error("Date is required");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      date: form.date,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      location: form.location,
      method: form.method,
      verified: form.verified,
      workHours: form.workHours,
      attendanceStatus: form.attendanceStatus,
      shiftId: form.shiftId,
      shiftName: form.shiftName,
      remarks: form.remarks,
    };

    try {
      if (editingRecord?.id) {
        await axios.put(`${API_URL}/${editingRecord.id}`, payload);
        ToasterService.success("Attendance record updated successfully");
      } else {
        await axios.post(`${API_URL}/check-in`, payload);
        ToasterService.success("Attendance record created successfully");
      }
      await loadRecords();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this attendance record? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Attendance record deleted successfully");
      await loadRecords();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalRecords = records.length;
  const present = records.filter(r => r.attendanceStatus === "PRESENT").length;
  const absent = records.filter(r => r.attendanceStatus === "ABSENT").length;
  const onLeave = records.filter(r => r.attendanceStatus === "ON_LEAVE").length;

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(records.map(r => [r.employeeId, {
    id: r.employeeId,
    name: r.employeeName
  }])).values()];

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const formatTime = (dateTime: string | null) => {
    if (!dateTime) return "—";
    return new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const columns: ColumnDef<AttendanceRecord>[] = [
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
          <div>
            <p className="text-sm font-medium text-gray-900">{row.employeeName}</p>
            <p className="text-xs text-gray-400">{row.shiftName}</p>
          </div>
        </div>
      ),
    },
    {
      key: "checkInTime", label: "Check In", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-700">{formatTime(v as string)}</span>
        </div>
      ),
    },
    {
      key: "checkOutTime", label: "Check Out", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-red-400" />
          <span className="text-sm text-gray-700">{formatTime(v as string)}</span>
        </div>
      ),
    },
    {
      key: "workHours", label: "Hours", sortable: true,
      render: (_, v) => (
        <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
          {v != null ? `${v}h` : "—"}
        </span>
      ),
    },
    {
      key: "method", label: "Method", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1.5">
          {METHOD_ICONS[String(v)] ?? null}
          <span className="text-sm text-gray-600 capitalize">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "location", label: "Location", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[150px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "attendanceStatus", label: "Status", sortable: true,
      render: (_, v) => {
        const status = v as AttendanceStatus;
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
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
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

  // Filtered data for table
  const getFilteredData = () => {
    let filtered = [...records];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.employeeName?.toLowerCase().includes(searchTerm) ||
        r.date?.toLowerCase().includes(searchTerm) ||
        r.location?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedEmployeeFilter) {
      filtered = filtered.filter(r => r.employeeId.toString() === selectedEmployeeFilter);
    }

    if (selectedStatus) {
      filtered = filtered.filter(r => r.attendanceStatus === selectedStatus);
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  return (
    <>
      <PageMeta title="Attendance Records" description="Manage attendance logs" />
      <PageBreadcrumb pageTitle="Attendance Records" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Records</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage daily attendance check-in and check-out records</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Record</span>
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{totalRecords}</p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-full">
                <CalendarDaysIcon className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Present</p>
                <p className="text-2xl font-bold text-green-600">{present}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Absent</p>
                <p className="text-2xl font-bold text-red-600">{absent}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">On Leave</p>
                <p className="text-2xl font-bold text-blue-600">{onLeave}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <PauseCircleIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Conditional Rendering: Form OR Table */}
        {showForm ? (
          // Form View
          <div className={`${cardCls} mb-6`}>
            <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    {editingRecord ? (
                      <PencilSquareIcon className="h-5 w-5 text-cyan-600" />
                    ) : (
                      <PlusIcon className="h-5 w-5 text-cyan-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingRecord ? "Edit Attendance Record" : "Add Attendance Record"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingRecord ? "Update attendance details" : "Record new attendance entry"}
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
              {/* Employee & Schedule */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <UserIcon className="h-3 w-3" /> Employee & Schedule
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
                    <select
                      value={form.shiftId || ""}
                      onChange={e => {
                        const shiftId = Number(e.target.value);
                        const shift = shifts.find(s => s.shiftId === shiftId);
                        handleChange("shiftId", shiftId);
                        handleChange("shiftName", shift?.shiftName || "");
                      }}
                      className={inputCls}
                    >
                      <option value="">Select Shift</option>
                      {shifts.map(s => (
                        <option key={s.shiftId} value={s.shiftId}>
                          {s.shiftName} {s.startTime && s.endTime ? `(${s.startTime.substring(0, 5)} - ${s.endTime.substring(0, 5)})` : ""}
                          {s.isNightShift ? " 🌙" : " ☀️"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Date Selection */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CalendarDaysIcon className="h-3 w-3" /> Date
                </p>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Attendance Date <span className="text-red-500">*</span>
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
                </div>
              </div>

              {/* Time Tracking */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ClockIcon className="h-3 w-3" /> Time Tracking
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Check-In Time</label>
                    <DatePicker
                      selected={checkInDate}
                      onChange={handleCheckInTimeChange}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeCaption="Time"
                      dateFormat="hh:mm aa"
                      className={inputCls}
                      placeholderText="Select check-in time"
                      isClearable
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Check-Out Time</label>
                    <DatePicker
                      selected={checkOutDate}
                      onChange={handleCheckOutTimeChange}
                      showTimeSelect
                      showTimeSelectOnly
                      timeIntervals={15}
                      timeCaption="Time"
                      dateFormat="hh:mm aa"
                      className={inputCls}
                      placeholderText="Select check-out time"
                      isClearable
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Work Hours</label>
                    <input
                      type="text"
                      value={form.workHours != null ? `${form.workHours} hours` : "0 hours"}
                      className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                      readOnly
                      disabled
                    />
                    <p className="mt-1 text-xs text-gray-500">Auto-calculated from check-in/out times</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CheckCircleIcon className="h-3 w-3" /> Status
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attendance Status</label>
                    <select
                      value={form.attendanceStatus}
                      onChange={e => handleChange("attendanceStatus", e.target.value as AttendanceStatus)}
                      className={inputCls}
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                    <select
                      value={form.method}
                      onChange={e => handleChange("method", e.target.value)}
                      className={inputCls}
                    >
                      <option value="mobile">Mobile App</option>
                      <option value="biometric">Biometric Device</option>
                      <option value="manual">Manual Entry</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Location & Verification */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPinIcon className="h-3 w-3" /> Location & Verification
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => handleChange("location", e.target.value)}
                      placeholder="e.g., Office, Remote, Client Site"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.verified}
                        onChange={e => handleChange("verified", e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Mark as Verified</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={e => handleChange("remarks", e.target.value)}
                  rows={3}
                  placeholder="Add any notes or comments..."
                  className={inputCls}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {editingRecord ? (
                    <>
                      <PencilSquareIcon className="h-4 w-4" />
                      Update Record
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      Create Record
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to List
                </button>
              </div>
            </form>
          </div>
        ) : (
          // Table View - Using ReusableTable
          <>
            {/* Filter Bar for ReusableTable */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by employee, date, or location..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Employee Filter Dropdown */}
                <select
                  value={selectedEmployeeFilter}
                  onChange={e => setSelectedEmployeeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Employees</option>
                  {uniqueEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>

                {/* Status Filter Dropdown */}
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Status</option>
                  <option value="PRESENT">Present</option>
                  <option value="ABSENT">Absent</option>
                  <option value="ON_LEAVE">On Leave</option>
                </select>

                {/* Clear Filters Button */}
                {(selectedEmployeeFilter || selectedStatus || search) && (
                  <button
                    onClick={() => {
                      setSelectedEmployeeFilter("");
                      setSelectedStatus("");
                      setSearch("");
                    }}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-800 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Reusable Table */}
            <ReusableTable<AttendanceRecord>
              data={filteredData}
              columns={columns}
              loading={loading}
              searchable={false}
              pageSize={PAGE_SIZE}
              defaultSortKey="date"
              defaultSortOrder="desc"
              emptyState={
                <div className="flex flex-col items-center py-12">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <CalendarDaysIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No attendance records found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add your first record
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

export default AttendanceRecordPage;