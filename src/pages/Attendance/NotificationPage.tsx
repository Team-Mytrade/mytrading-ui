import React, { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  BellIcon,
  HashtagIcon,
  UserIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  BellAlertIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import {
  saveAttendanceNotifications,
  type AttendanceNotificationRecord,
} from "../../utils/attendanceNotifications";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

type NotificationType = "ATTENDANCE" | "LEAVE" | "OVERTIME" | "PAYROLL" | "SYSTEM" | "VIOLATION";
type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type NotificationPriority = "LOW" | "MEDIUM" | "HIGH";

interface Notification extends AttendanceNotificationRecord {
  id?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/notifications";
const EMPLOYEE_API = "/v1/api/payroll/employee";

const PAGE_SIZE = 10;

const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  LOW: "bg-gray-100 text-gray-500",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-red-100 text-red-700",
};

const PRIORITY_ICONS: Record<NotificationPriority, React.ReactNode> = {
  LOW: <InformationCircleIcon className="h-3 w-3" />,
  MEDIUM: <ExclamationTriangleIcon className="h-3 w-3" />,
  HIGH: <BellAlertIcon className="h-3 w-3" />,
};

const TYPE_STYLES: Record<NotificationType, string> = {
  ATTENDANCE: "bg-cyan-100 text-cyan-800",
  LEAVE: "bg-blue-100 text-blue-800",
  OVERTIME: "bg-indigo-100 text-indigo-800",
  PAYROLL: "bg-green-100 text-green-800",
  SYSTEM: "bg-purple-100 text-purple-800",
  VIOLATION: "bg-red-100 text-red-800",
};

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  ATTENDANCE: <BellIcon className="h-3 w-3" />,
  LEAVE: <DocumentTextIcon className="h-3 w-3" />,
  OVERTIME: <ClockIcon className="h-3 w-3" />,
  PAYROLL: <CurrencyDollarIcon className="h-3 w-3" />,
  SYSTEM: <InformationCircleIcon className="h-3 w-3" />,
  VIOLATION: <ExclamationTriangleIcon className="h-3 w-3" />,
};

const CHANNEL_ICONS: Record<NotificationChannel, React.ReactNode> = {
  EMAIL: <EnvelopeIcon className="h-3.5 w-3.5" />,
  PUSH: <BellIcon className="h-3.5 w-3.5" />,
  SMS: <DevicePhoneMobileIcon className="h-3.5 w-3.5" />,
  IN_APP: <BellIcon className="h-3.5 w-3.5" />,
  WHATSAPP: <DevicePhoneMobileIcon className="h-3.5 w-3.5" />,
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: Notification = {
  employeeId: 0,
  employeeName: "",
  title: "",
  message: "",
  type: "SYSTEM",
  channel: "PUSH",
  isRead: false,
  createdAt: new Date().toISOString(),
  priority: "MEDIUM",
  referenceId: null,
  referenceType: null,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [form, setForm] = useState<Notification>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

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

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Notification[]>(`${API_URL}/user/35`);
      setNotifications(res.data);
      saveAttendanceNotifications(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadNotifications();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [notifications, search, selectedTypeFilter, selectedPriorityFilter, selectedStatusFilter, selectedEmployeeFilter, dateRange.from, dateRange.to]);

  const applyFilters = () => {
    let filtered = [...notifications];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(n =>
        n.title?.toLowerCase().includes(searchTerm) ||
        n.message?.toLowerCase().includes(searchTerm) ||
        n.employeeName?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedEmployeeFilter) {
      filtered = filtered.filter(n => n.employeeId.toString() === selectedEmployeeFilter);
    }

    if (selectedTypeFilter) {
      filtered = filtered.filter(n => n.type === selectedTypeFilter);
    }

    if (selectedPriorityFilter) {
      filtered = filtered.filter(n => n.priority === selectedPriorityFilter);
    }

    if (selectedStatusFilter !== "") {
      filtered = filtered.filter(n => n.isRead === (selectedStatusFilter === "read"));
    }

    if (dateRange.from) {
      filtered = filtered.filter(n => new Date(n.createdAt) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(n => new Date(n.createdAt) <= dateRange.to!);
    }

    setFilteredNotifications(filtered);
  };

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Notification, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      handleChange("createdAt", date.toISOString());
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm, createdAt: new Date().toISOString() });
    setEditingNotification(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, createdAt: new Date().toISOString() });
    setEditingNotification(null);
    setShowForm(true);
  };

  const openEditForm = (notification: Notification) => {
    setForm({ ...notification });
    setEditingNotification(notification);
    setShowForm(true);
  };

  const markAsRead = async (id: number) => {
    try {
      await axios.patch(`${API_URL} / ${id} / read`);
      ToasterService.success("Notification marked as read");
      await loadNotifications();
    } catch (err: any) {
      console.error("Failed to mark as read", err);
      ToasterService.error(err.response?.data?.message || "Failed to mark as read");
    }
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.title) {
      ToasterService.error("Please enter a title");
      return;
    }
    if (!form.message) {
      ToasterService.error("Please enter a message");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      title: form.title,
      message: form.message,
      type: "SYSTEM",
      channel: form.channel,
      isRead: form.isRead,
      createdAt: form.createdAt,
      priority: form.priority,
      referenceId: form.referenceId,
      referenceType: form.referenceType,
    };

    try {
      if (editingNotification?.id) {
        await axios.put(`${API_URL} / ${editingNotification.id}`, payload);
        ToasterService.success("Notification updated successfully");
      } else {
        await axios.post(`${API_URL}/create`, payload);
        ToasterService.success("Notification created successfully");
      }
      await loadNotifications();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this notification? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL} / ${id}`);
      ToasterService.success("Notification deleted successfully");
      await loadNotifications();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total: filteredNotifications.length,
    unread: filteredNotifications.filter(n => !n.isRead).length,
    high: filteredNotifications.filter(n => n.priority === "HIGH").length,
    read: filteredNotifications.filter(n => n.isRead).length,
  };

  // Get unique values for filters
  const uniqueEmployees = [...new Map(notifications.map(n => [n.employeeId, {
    id: n.employeeId,
    name: n.employeeName
  }])).values()];

  const typeOptions: NotificationType[] = ["ATTENDANCE", "LEAVE", "OVERTIME", "PAYROLL", "SYSTEM", "VIOLATION"];
  const priorityOptions: NotificationPriority[] = ["LOW", "MEDIUM", "HIGH"];
  const channelOptions: NotificationChannel[] = ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"];

  // Count active filters
  const activeFilterCount = [selectedEmployeeFilter, selectedTypeFilter, selectedPriorityFilter, selectedStatusFilter, dateRange.from, dateRange.to].filter(Boolean).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<Notification>[] = [
    {
      key: "createdAt", label: "Date", sortable: true,
      render: (_: Notification, v: unknown) => (
        <div className="flex items-center gap-2">
          <BellIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {formatDateTime(v as string)}
          </span>
        </div>
      ),
    },
    {
      key: "employeeName", label: "Employee", sortable: true,
      render: (row: Notification) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.employeeName}</span>
        </div>
      ),
    },
    {
      key: "title", label: "Title", sortable: true,
      render: (_: Notification, v: unknown) => (
        <span className="text-sm font-medium text-gray-900">{String(v)}</span>
      ),
    },
    {
      key: "message", label: "Message", sortable: true,
      render: (_: Notification, v: unknown) => (
        <span className="text-sm text-gray-500 truncate max-w-[200px] block" title={String(v)}>
          {String(v) || "—"}
        </span>
      ),
    },
    {
      key: "type", label: "Type", sortable: true,
      render: (_: Notification, v: unknown) => {
        const type = v as NotificationType;
        return (
          <span className={`inline - flex items - center gap - 1 px - 2.5 py - 0.5 rounded - full text - xs font - medium ${TYPE_STYLES[type]}`}>
            {TYPE_ICONS[type]}
            {type}
          </span>
        );
      },
    },
    {
      key: "channel", label: "Channel", sortable: true,
      render: (_: Notification, v: unknown) => (
        <div className="flex items-center gap-1.5">
          {CHANNEL_ICONS[v as NotificationChannel]}
          <span className="text-xs text-gray-600">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "priority", label: "Priority", sortable: true,
      render: (_: Notification, v: unknown) => {
        const priority = v as NotificationPriority;
        return (
          <span className={`inline - flex items - center gap - 1 px - 2.5 py - 0.5 rounded - full text - xs font - medium ${PRIORITY_STYLES[priority]}`}>
            {PRIORITY_ICONS[priority]}{priority}
          </span>
        );
      },
    },
    {
      key: "isRead", label: "Status", sortable: true,
      render: (_: Notification, v: unknown) => v
        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Read</span>
        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircleIcon className="h-3 w-3" />Unread</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row: Notification) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {!row.isRead && (
            <button
              onClick={() => markAsRead(row.id!)}
              title="Mark as Read"
              className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
            >
              <CheckCircleIcon className="h-4 w-4" />
            </button>
          )}
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
      <PageMeta title="Notifications" description="Manage employee notifications" />
      <PageBreadcrumb pageTitle="Notifications" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage employee notifications</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Notification</span>
            </button>
          )}
        </div>

        {/* Stats Cards - Hidden when form is visible */}
        {!showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-3 bg-cyan-100 rounded-full">
                  <BellIcon className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Unread</p>
                  <p className="text-2xl font-bold text-red-600">{stats.unread}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircleIcon className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">High Priority</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <BellAlertIcon className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Read</p>
                  <p className="text-2xl font-bold text-green-600">{stats.read}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conditional Rendering: Form OR Table */}
        {showForm ? (
          // Form View
          <div className={`${cardCls} mb - 6`}>
            <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <BellIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingNotification ? "Edit Notification" : "Add Notification"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingNotification ? "Update notification details" : "Create a new notification"}
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
                    disabled={!!editingNotification}
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
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    required
                    onChange={e => handleChange("title", e.target.value)}
                    placeholder="Notification title"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={form.type}
                    onChange={e => handleChange("type", e.target.value as NotificationType)}
                    className={inputCls}
                  >
                    {typeOptions.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                  <select
                    value={form.channel}
                    onChange={e => handleChange("channel", e.target.value as NotificationChannel)}
                    className={inputCls}
                  >
                    {channelOptions.map(channel => (
                      <option key={channel} value={channel}>{channel}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={form.priority}
                    onChange={e => handleChange("priority", e.target.value as NotificationPriority)}
                    className={inputCls}
                  >
                    {priorityOptions.map(priority => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>


                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.message}
                    required
                    onChange={e => handleChange("message", e.target.value)}
                    rows={3}
                    placeholder="Enter notification message..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!form.isRead}
                      onChange={e => handleChange("isRead", e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Mark as Read</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference ID</label>
                  <input
                    type="number"
                    value={form.referenceId || ""}
                    onChange={e => handleChange("referenceId", e.target.value ? Number(e.target.value) : null)}
                    placeholder="Associated record ID"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference Type</label>
                  <input
                    type="text"
                    value={form.referenceType || ""}
                    onChange={e => handleChange("referenceType", e.target.value)}
                    placeholder="e.g., AttendanceRecord, PayrollRecord"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !mb-0 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <BellIcon className="h-4 w-4" />
                  {editingNotification ? "Update Notification" : "Send Notification"}
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
                    placeholder="Search by title, message, or employee..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative px - 4 py - 2 rounded - lg border transition - all duration - 200 flex items - center gap - 2 ${showFilters || activeFilterCount > 0
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
                    setSelectedTypeFilter("");
                    setSelectedPriorityFilter("");
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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={selectedTypeFilter}
                      onChange={e => setSelectedTypeFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Types</option>
                      {typeOptions.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={selectedPriorityFilter}
                      onChange={e => setSelectedPriorityFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Priorities</option>
                      {priorityOptions.map(priority => (
                        <option key={priority} value={priority}>{priority}</option>
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
                      <option value="read">Read</option>
                      <option value="unread">Unread</option>
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
            <ReusableTable<Notification>
              data={filteredNotifications}
              columns={columns}
              loading={loading}
              searchable={false}
              pageSize={PAGE_SIZE}
              defaultSortKey="createdAt"
              defaultSortOrder="desc"
              emptyState={
                <div className="flex flex-col items-center py-12">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <BellIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No notifications found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add your first notification
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

// Missing imports
import { ClockIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";

export default NotificationPage;
