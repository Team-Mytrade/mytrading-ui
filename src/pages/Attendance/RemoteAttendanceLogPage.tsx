import React, { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  HashtagIcon,
  CheckCircleIcon,
  XCircleIcon,
  SignalIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  MagnifyingGlassIcon,
  ComputerDesktopIcon,
  UserIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
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

interface RemoteAttendanceLog {
  id?: number;
  employeeId: number;
  employeeName: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  ipAddress: string;
  location: string;
  device: string;
  remarks: string;
  syncedWithPayroll: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLOYEE_API = "/v1/api/payroll/employee";
const REMOTE_API = "/v1/api/attendance/remote-attendance";

const PAGE_SIZE = 10;

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: RemoteAttendanceLog = {
  employeeId: 0,
  employeeName: "",
  date: new Date().toISOString().split('T')[0],
  checkInTime: null,
  checkOutTime: null,
  ipAddress: "",
  location: "",
  device: "mobile",
  remarks: "",
  syncedWithPayroll: false,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const getCurrentIP = async (): Promise<string> => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error("Failed to fetch IP:", error);
    return "Unknown";
  }
};

const getCurrentLocation = (): Promise<string> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve("Location not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const address = response.data;
          const locationString = `${address.city || address.town || address.village || ""}, ${address.state || ""}, ${address.country || ""}`;
          resolve(locationString.trim() || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch (error) {
          console.error("Failed to get location name:", error);
          resolve(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        }
      },
      () => {
        resolve("Location unavailable");
      }
    );
  });
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const RemoteAttendancePage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<RemoteAttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<RemoteAttendanceLog | null>(null);
  const [form, setForm] = useState<RemoteAttendanceLog>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const [selectedDateRange, setSelectedDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Time picker states for form
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);

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

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedEmployeeFilter) params.employeeId = selectedEmployeeFilter;
      if (selectedDateRange.from) params.from = selectedDateRange.from.toISOString().split('T')[0];
      if (selectedDateRange.to) params.to = selectedDateRange.to.toISOString().split('T')[0];

      const res = await axios.get<RemoteAttendanceLog[]>(REMOTE_API, { params });
      setLogs(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load attendance logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadLogs();
  }, []);

  useEffect(() => {
    if (selectedEmployeeFilter || selectedDateRange.from || selectedDateRange.to) {
      loadLogs();
    }
  }, [selectedEmployeeFilter, selectedDateRange.from, selectedDateRange.to]);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof RemoteAttendanceLog, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCheckInTimeChange = (time: Date | null) => {
    setCheckInTime(time);
    if (time && form.date) {
      const dateTime = new Date(`${form.date}T${time.toTimeString().split(' ')[0]}`);
      handleChange("checkInTime", dateTime.toISOString());
    } else {
      handleChange("checkInTime", null);
    }
  };

  const handleCheckOutTimeChange = (time: Date | null) => {
    setCheckOutTime(time);
    if (time && form.date) {
      const dateTime = new Date(`${form.date}T${time.toTimeString().split(' ')[0]}`);
      handleChange("checkOutTime", dateTime.toISOString());
    } else {
      handleChange("checkOutTime", null);
    }
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      handleChange("date", dateStr);

      // Update times with new date
      if (form.checkInTime && checkInTime) {
        const newCheckIn = new Date(`${dateStr}T${checkInTime.toTimeString().split(' ')[0]}`);
        handleChange("checkInTime", newCheckIn.toISOString());
      }
      if (form.checkOutTime && checkOutTime) {
        const newCheckOut = new Date(`${dateStr}T${checkOutTime.toTimeString().split(' ')[0]}`);
        handleChange("checkOutTime", newCheckOut.toISOString());
      }
    }
  };

  const detectLocationAndIP = async () => {
    ToasterService.info("Detecting location and IP address...");
    const [ip, location] = await Promise.all([getCurrentIP(), getCurrentLocation()]);
    handleChange("ipAddress", ip);
    handleChange("location", location);
    ToasterService.success(`Location detected: ${location}`);
  };

  const resetForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setCheckInTime(null);
    setCheckOutTime(null);
    setEditingLog(null);
    setShowForm(false);
  };

  const openCreateForm = async () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setCheckInTime(null);
    setCheckOutTime(null);
    setEditingLog(null);
    setShowForm(true);

    // Auto-detect location and IP
    const [ip, location] = await Promise.all([getCurrentIP(), getCurrentLocation()]);
    setForm(prev => ({ ...prev, ipAddress: ip, location: location }));
  };

  const openEditForm = (log: RemoteAttendanceLog) => {
    setForm({ ...log });

    // Parse times for time pickers
    if (log.checkInTime) {
      setCheckInTime(new Date(log.checkInTime));
    }
    if (log.checkOutTime) {
      setCheckOutTime(new Date(log.checkOutTime));
    }

    setEditingLog(log);
    setShowForm(true);
  };

  const handleCheckIn = async () => {
    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.date) {
      ToasterService.error("Please select a date");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      date: form.date,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      ipAddress: form.ipAddress,
      location: form.location,
      device: form.device,
      remarks: form.remarks,
      syncedWithPayroll: form.syncedWithPayroll,
    };

    setLoading(true);
    try {
      if (editingLog?.id) {
        await axios.put(`${REMOTE_API}/${editingLog.id}`, payload);
        ToasterService.success("Attendance record updated successfully");
      } else {
        await axios.post(`${REMOTE_API}/check-in`, payload);
        ToasterService.success("Check-in recorded successfully");
      }
      await loadLogs();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.checkInTime) {
      ToasterService.error("Please check-in first");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      date: form.date,
      checkInTime: form.checkInTime,
      checkOutTime: form.checkOutTime,
      ipAddress: form.ipAddress,
      location: form.location,
      device: form.device,
      remarks: form.remarks,
      syncedWithPayroll: form.syncedWithPayroll,
    };

    setLoading(true);
    try {
      if (editingLog?.id) {
        await axios.put(`${REMOTE_API}/${editingLog.id}`, payload);
        ToasterService.success("Check-out recorded successfully");
      } else {
        await axios.post(`${REMOTE_API}/check-out`, payload);
        ToasterService.success("Check-out recorded successfully");
      }
      await loadLogs();
      resetForm();
    } catch (err: any) {
      console.error("Check-out failed", err);
      ToasterService.error(err.response?.data?.message || "Check-out failed");
    } finally {
      setLoading(false);
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
      await axios.delete(`${REMOTE_API}/${id}`);
      ToasterService.success("Attendance record deleted successfully");
      await loadLogs();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalLogs = logs.length;
  const syncedLogs = logs.filter(l => l.syncedWithPayroll).length;
  const checkedIn = logs.filter(l => l.checkInTime).length;
  const checkedOut = logs.filter(l => l.checkOutTime).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return "—";
    return new Date(dateTime).toLocaleString();
  };

  const formatTime = (dateTime: string | null) => {
    if (!dateTime) return "—";
    return new Date(dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const columns: ColumnDef<RemoteAttendanceLog>[] = [
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
      key: "checkInTime", label: "Check-In", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-green-400" />
          <span className="text-sm text-gray-700">{formatTime(v as string)}</span>
        </div>
      ),
    },
    {
      key: "checkOutTime", label: "Check-Out", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-red-400" />
          <span className="text-sm text-gray-700">{formatTime(v as string)}</span>
        </div>
      ),
    },
    {
      key: "ipAddress", label: "IP Address", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <SignalIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono text-gray-600">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "location", label: "Location", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[180px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "device", label: "Device", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ComputerDesktopIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600 capitalize">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "syncedWithPayroll", label: "Payroll Sync", sortable: true,
      render: (_, v) => v
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Synced</span>
        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><XCircleIcon className="h-3 w-3" />Not Synced</span>,
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

  // Filter logs for table display
  const getFilteredData = () => {
    let filtered = [...logs];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(l =>
        l.employeeName?.toLowerCase().includes(searchTerm) ||
        l.location?.toLowerCase().includes(searchTerm) ||
        l.ipAddress?.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(logs.map(l => [l.employeeId, {
    id: l.employeeId,
    name: l.employeeName
  }])).values()];

  return (
    <>
      <PageMeta title="Remote Attendance" description="Work from home attendance logs" />
      <PageBreadcrumb pageTitle="Remote Attendance" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Remote Attendance</h1>
            <p className="text-sm text-gray-500 mt-0.5">Record and view work-from-home attendance logs</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Check In / Out</span>
            </button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Logs</p>
                <p className="text-2xl font-bold text-gray-900">{totalLogs}</p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-full">
                <ComputerDesktopIcon className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Checked In</p>
                <p className="text-2xl font-bold text-green-600">{checkedIn}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ArrowRightOnRectangleIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Checked Out</p>
                <p className="text-2xl font-bold text-orange-600">{checkedOut}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <ArrowLeftOnRectangleIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Payroll Synced</p>
                <p className="text-2xl font-bold text-purple-600">{syncedLogs}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <CheckCircleIcon className="h-6 w-6 text-purple-600" />
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
                    <ComputerDesktopIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingLog ? "Edit Attendance Record" : "Remote Attendance"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingLog ? "Update attendance details" : "Record check-in or check-out"}
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

            <form onSubmit={(e) => { e.preventDefault(); }} className="p-6">
              {/* Employee Selection */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <UserIcon className="h-3 w-3" /> Employee Details
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
                    <select
                      value={form.device}
                      onChange={e => handleChange("device", e.target.value)}
                      className={inputCls}
                    >
                      <option value="mobile">Mobile</option>
                      <option value="laptop">Laptop</option>
                      <option value="desktop">Desktop</option>
                      <option value="tablet">Tablet</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <CalendarDaysIcon className="h-3 w-3" /> Date
                </p>
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

              {/* Time Tracking */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ClockIcon className="h-3 w-3" /> Time Tracking
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Check-In Time</label>
                    <DatePicker
                      selected={checkInTime}
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
                      selected={checkOutTime}
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
                </div>
              </div>

              {/* Location & IP */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPinIcon className="h-3 w-3" /> Location & Network
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">IP Address</label>
                    <input
                      type="text"
                      value={form.ipAddress}
                      onChange={e => handleChange("ipAddress", e.target.value)}
                      placeholder="Auto-detected IP"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={e => handleChange("location", e.target.value)}
                      placeholder="Auto-detected location"
                      className={inputCls}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={detectLocationAndIP}
                  className="mt-3 text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                >
                  <MapPinIcon className="h-4 w-4" />
                  Re-detect Location & IP
                </button>
              </div>

              {/* Remarks & Sync */}
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

              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!form.syncedWithPayroll}
                    onChange={e => handleChange("syncedWithPayroll", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Synced with Payroll</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={loading || !form.employeeId || !form.date}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  Check In
                </button>
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={loading || !form.employeeId || !form.checkInTime}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                  Check Out
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          // Table View
          <>
            {/* Filter Bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by employee, location, or IP..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
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

                <DatePicker
                  selected={selectedDateRange.from}
                  onChange={(date) => setSelectedDateRange(prev => ({ ...prev, from: date }))}
                  dateFormat="yyyy-MM-dd"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                  placeholderText="From Date"
                />

                <DatePicker
                  selected={selectedDateRange.to}
                  onChange={(date) => setSelectedDateRange(prev => ({ ...prev, to: date }))}
                  dateFormat="yyyy-MM-dd"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500"
                  placeholderText="To Date"
                />

                {(selectedEmployeeFilter || selectedDateRange.from || selectedDateRange.to || search) && (
                  <button
                    onClick={() => {
                      setSelectedEmployeeFilter("");
                      setSelectedDateRange({ from: null, to: null });
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
            <ReusableTable<RemoteAttendanceLog>
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
                    <ComputerDesktopIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No remote attendance logs found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Record your first attendance
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

export default RemoteAttendancePage;