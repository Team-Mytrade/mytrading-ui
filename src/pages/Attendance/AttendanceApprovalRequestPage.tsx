import React, { useEffect, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  HashtagIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserDto {
  userId: string;
  username: string;
  fullName: string;
  email?: string;
  active?: boolean;
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
  email?: string;
  userDto?: UserDto;
}

interface AttendanceRecord {
  id: number;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  shiftName?: string;
  employeeName?: string;
  attendanceStatus?: string;
  workHours?: number;
  location?: string;
  method?: string;
  verified?: boolean;
  remarks?: string;
}

interface DecodedToken {
  tenantId: string;
  superAdmin: boolean;
  roles: string[];
  permissions: string[];
  userId: string;
  active: boolean;
  fullName: string;
  username: string;
  sub: string;
  iss: string;
  iat: number;
  exp: number;
}

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

interface AttendanceApprovalRequest {
  id?: number;
  attendanceRecordId: number;
  attendanceRecord?: AttendanceRecord;
  requestedById: number;
  requestedByName: string;
  approverId: number;
  approverName: string;
  requestedAt: string;
  reason: string;
  status: ApprovalStatus;
  actionedAt: string | null;
  approverRemarks: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/attendance/attendance-approvals";
const EMPLOYEE_API = "/v1/api/payroll/employee";
const RECORD_API = "/v1/api/attendance/records";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<ApprovalStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<ApprovalStatus, React.ReactNode> = {
  PENDING: <ClockIcon className="h-3 w-3" />,
  APPROVED: <CheckCircleIcon className="h-3 w-3" />,
  REJECTED: <XCircleIcon className="h-3 w-3" />,
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm = {
  attendanceRecordId: 0,
  requestedById: 0,
  requestedByName: "",
  approverId: 0,
  approverName: "",
  reason: "",
  status: "PENDING" as ApprovalStatus,
  requestedAt: new Date().toISOString(),
  actionedAt: null,
  approverRemarks: null,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const decodeToken = (): DecodedToken | null => {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (error) {
    console.error("Failed to decode token", error);
    return null;
  }
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const AttendanceApprovalRequestPage: React.FC = () => {
  const [requests, setRequests] = useState<AttendanceApprovalRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AttendanceApprovalRequest | null>(null);
  const [form, setForm] = useState<AttendanceApprovalRequest>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [selectedRequesterFilter, setSelectedRequesterFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  // View log detail modal
  const [showLogDetailModal, setShowLogDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AttendanceRecord | null>(null);

  // Current approver (logged in user)
  const [currentApprover, setCurrentApprover] = useState<{ id: number; name: string } | null>(null);

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Action popup state
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AttendanceApprovalRequest | null>(null);

  // ── Get Current User from Token matching employee.userDto.userId ─────────────

  const getCurrentUserFromToken = async (employeeList: Employee[]) => {
    const decoded = decodeToken();
    if (!decoded) {
      console.warn("No valid token found");
      return;
    }

    const matchingEmployee = employeeList.find(emp =>
      emp.userDto?.userId === decoded.userId
    );

    if (matchingEmployee) {
      setCurrentApprover({
        id: matchingEmployee.id,
        name: `${matchingEmployee.firstName} ${matchingEmployee.lastName}`
      });
      setForm(prev => ({
        ...prev,
        approverId: matchingEmployee.id,
        approverName: `${matchingEmployee.firstName} ${matchingEmployee.lastName}`
      }));
    } else {
      const fallbackMatch = employeeList.find(emp =>
        emp.email?.toLowerCase() === decoded.username?.toLowerCase() ||
        `${emp.firstName} ${emp.lastName}`.toLowerCase() === decoded.fullName?.toLowerCase()
      );

      if (fallbackMatch) {
        setCurrentApprover({
          id: fallbackMatch.id,
          name: `${fallbackMatch.firstName} ${fallbackMatch.lastName}`
        });
        setForm(prev => ({
          ...prev,
          approverId: fallbackMatch.id,
          approverName: `${fallbackMatch.firstName} ${fallbackMatch.lastName}`
        }));
      } else {
        setCurrentApprover({
          id: 0,
          name: decoded.fullName || "System Admin"
        });
        setForm(prev => ({
          ...prev,
          approverId: 0,
          approverName: decoded.fullName || "System Admin"
        }));
      }
    }
  };

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${EMPLOYEE_API}/all`);
      setEmployees(res.data);
      return res.data;
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load employees");
      return [];
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const res = await axios.get<AttendanceRecord[]>(RECORD_API);
      setRecords(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load attendance records");
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get<AttendanceApprovalRequest[]>(`${API_URL}/employee/35`);
      setRequests(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load approval requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const empList = await loadEmployees();
      await loadAttendanceRecords();
      await loadRequests();
      if (empList.length > 0) {
        await getCurrentUserFromToken(empList);
      }
    };
    init();
  }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof typeof form, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      requestedAt: new Date().toISOString(),
      approverId: currentApprover?.id || 0,
      approverName: currentApprover?.name || "",
    });
    setEditingRequest(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({
      ...emptyForm,
      requestedAt: new Date().toISOString(),
      approverId: currentApprover?.id || 0,
      approverName: currentApprover?.name || "",
    });
    setEditingRequest(null);
    setShowForm(true);
  };

  const openEditForm = (request: AttendanceApprovalRequest) => {
    setForm({ ...request });
    setEditingRequest(request);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.attendanceRecordId) {
      ToasterService.error("Please select an attendance record");
      return;
    }
    if (!form.requestedById) {
      ToasterService.error("Please select a requester");
      return;
    }

    const payload = {
      attendanceRecordId: form.attendanceRecordId,
      requestedById: form.requestedById,
      requestedByName: form.requestedByName,
      approverId: form.approverId,
      approverName: form.approverName,
      requestedAt: form.requestedAt,
      reason: form.reason,
      status: form.status,
      actionedAt: form.actionedAt,
      approverRemarks: form.approverRemarks,
    };

    try {
      if (editingRequest?.id) {
        await axios.put(`${API_URL}/${editingRequest.id}`, payload);
        ToasterService.success("Request updated successfully");
      } else {
        await axios.post(`${API_URL}/submit`, {
          ...payload,
          actionedAt: new Date().toISOString(),
        });
        ToasterService.success("Request submitted successfully");
      }
      await loadRequests();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Approve / Reject with current timestamp ─────────────────────────────────

  const openActionDialog = (request: AttendanceApprovalRequest, type: "APPROVE" | "REJECT") => {
    setSelectedRequest(request);
    setActionType(type);
    setActionRemarks("");
    setShowActionDialog(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedRequest || !actionType) return;

    const endpoint = actionType === "APPROVE" ? `${API_URL}/approve` : `${API_URL}/reject`;
    const successMsg = actionType === "APPROVE" ? "Request approved successfully" : "Request rejected successfully";

    try {
      await axios.post(endpoint, null, {
        params: {
          requestId: selectedRequest.id,
          remarks: actionRemarks,
          actionedAt: new Date().toISOString()
        }
      });
      ToasterService.success(successMsg);
      await loadRequests();
    } catch (err: any) {
      console.error("Failed to process request", err);
      ToasterService.error(err.response?.data?.message || "Failed to process request");
    } finally {
      setShowActionDialog(false);
      setSelectedRequest(null);
      setActionType(null);
      setActionRemarks("");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this approval request? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Request deleted successfully");
      await loadRequests();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── View Log Detail ─────────────────────────────────────────────────────────

  const viewLogDetail = (record: AttendanceRecord) => {
    setSelectedLog(record);
    setShowLogDetailModal(true);
  };

  // ── Stats & Filters ─────────────────────────────────────────────────────────

  const getFilteredData = () => {
    let filtered = [...requests];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.requestedByName?.toLowerCase().includes(searchTerm) ||
        r.reason?.toLowerCase().includes(searchTerm) ||
        r.approverName?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedRequesterFilter) {
      filtered = filtered.filter(r => r.requestedById.toString() === selectedRequesterFilter);
    }

    if (selectedStatusFilter) {
      filtered = filtered.filter(r => r.status === selectedStatusFilter);
    }

    if (dateRange.from) {
      filtered = filtered.filter(r => new Date(r.requestedAt) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(r => new Date(r.requestedAt) <= dateRange.to!);
    }

    return filtered;
  };

  const filteredData = getFilteredData();

  const stats = {
    total: filteredData.length,
    pending: filteredData.filter(r => r.status === "PENDING").length,
    approved: filteredData.filter(r => r.status === "APPROVED").length,
    rejected: filteredData.filter(r => r.status === "REJECTED").length,
  };

  const uniqueRequesters = [...new Map(requests.map(r => [r.requestedById, {
    id: r.requestedById,
    name: r.requestedByName
  }])).values()];

  const statusOptions: ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED"];
  const activeFilterCount = [selectedRequesterFilter, selectedStatusFilter, dateRange.from, dateRange.to].filter(Boolean).length;

  // ── Format Helpers ──────────────────────────────────────────────────────────

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "—";
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRecordDisplayText = (record: AttendanceRecord) => {
    const shiftName = record.shiftName || "Shift";
    const employeeName = record.employeeName || `Record ${record.id}`;
    const date = record.date ? new Date(record.date).toLocaleDateString() : "";
    return `${employeeName} - ${shiftName} (${date})`;
  };

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const columns: ColumnDef<AttendanceApprovalRequest>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (_: AttendanceApprovalRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "requestedByName", label: "Requested By", sortable: true,
      render: (row: AttendanceApprovalRequest) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.requestedByName}</span>
        </div>
      ),
    },
    {
      key: "attendanceRecord", label: "Log Date", sortable: false,
      render: (row: AttendanceApprovalRequest) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">
            {row.attendanceRecord?.date ? formatDate(row.attendanceRecord.date) : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "approverName", label: "Approver", sortable: true,
      render: (row: AttendanceApprovalRequest) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{row.approverName}</span>
        </div>
      ),
    },
    {
      key: "requestedAt", label: "Requested At", sortable: true,
      render: (_: AttendanceApprovalRequest, v: unknown) => (
        <span className="text-sm text-gray-600">{formatDateTime(v as string)}</span>
      ),
    },
    {
      key: "reason", label: "Reason", sortable: true,
      render: (_: AttendanceApprovalRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[180px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (_: AttendanceApprovalRequest, v: unknown) => {
        const status = v as ApprovalStatus;
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
      render: (row: AttendanceApprovalRequest) => (
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
          {row.status === "PENDING" && row.attendanceRecord && (
            <button
              onClick={() => viewLogDetail(row.attendanceRecord!)}
              title="View Log Details"
              className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
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
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Attendance Approval Requests" description="Manage attendance approval requests" />
      <PageBreadcrumb pageTitle="Attendance Approval Requests" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Approval Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Submit and manage attendance approval requests</p>
          </div>
          {!showForm && (
            <button
              onClick={openCreateForm}
              className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>New Request</span>
            </button>
          )}
        </div>

        {/* Stats Cards */}
        {!showForm && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="p-3 bg-cyan-100 rounded-full">
                  <DocumentTextIcon className="h-6 w-6 text-cyan-600" />
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
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <XCircleIcon className="h-6 w-6 text-red-600" />
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
                    <PaperAirplaneIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingRequest ? "Edit Request" : "Submit New Request"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {editingRequest ? "Update request details" : "Submit a new attendance approval request"}
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
                    Attendance Log <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.attendanceRecordId || ""}
                    required
                    onChange={e => handleChange("attendanceRecordId", Number(e.target.value))}
                    className={inputCls}
                    disabled={!!editingRequest}
                  >
                    <option value="">Select Attendance Record</option>
                    {records.map(record => (
                      <option key={record.id} value={record.id}>
                        {getRecordDisplayText(record)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requester <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.requestedById || ""}
                    required
                    onChange={e => {
                      const employeeId = Number(e.target.value);
                      const employee = employees.find(emp => emp.id === employeeId);
                      handleChange("requestedById", employeeId);
                      handleChange("requestedByName", employee ? `${employee.firstName} ${employee.lastName}` : "");
                    }}
                    className={inputCls}
                    disabled={!!editingRequest}
                  >
                    <option value="">Select Requester</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} {emp.userDto?.userId ? `(${emp.userDto.userId})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approver <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.approverName || (currentApprover?.name || "")}
                    className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                    readOnly
                    disabled
                    placeholder="Auto-detected from login"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Approver is automatically set to the currently logged-in user
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={e => handleChange("status", e.target.value as ApprovalStatus)}
                    className={inputCls}
                    disabled={!!editingRequest && editingRequest.status !== "PENDING"}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={e => handleChange("reason", e.target.value)}
                    rows={3}
                    placeholder="Briefly describe the reason for this request..."
                    className={inputCls}
                  />
                </div>

                {form.approverRemarks && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Approver Remarks</label>
                    <textarea
                      value={form.approverRemarks || ""}
                      rows={2}
                      className={`${inputCls} bg-gray-50`}
                      readOnly
                      disabled
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !mb-0 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {editingRequest ? "Update Request" : "Submit Request"}
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
            {/* Search Bar and Filter Button */}
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[250px]">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by requester, approver, or reason..."
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
                    setSelectedRequesterFilter("");
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

            {/* Filter Panel */}
            {showFilters && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requester</label>
                    <select
                      value={selectedRequesterFilter}
                      onChange={e => setSelectedRequesterFilter(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="">All Requesters</option>
                      {uniqueRequesters.map(emp => (
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
            <ReusableTable<AttendanceApprovalRequest>
              data={filteredData}
              columns={columns}
              loading={loading}
              searchable={false}
              pageSize={PAGE_SIZE}
              defaultSortKey="requestedAt"
              defaultSortOrder="desc"
              emptyState={
                <div className="flex flex-col items-center py-12">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <DocumentTextIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No approval requests found</p>
                  <button
                    onClick={openCreateForm}
                    className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Submit your first request
                  </button>
                </div>
              }
            />
          </>
        )}

        {/* View Log Detail Modal */}
        {showLogDetailModal && selectedLog && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowLogDetailModal(false)}></div>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Attendance Record Details
                        </h3>
                        <button
                          onClick={() => setShowLogDetailModal(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Employee</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.employeeName || "—"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Date</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.date || "—"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Shift</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.shiftName || "General Shift"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Status</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.attendanceStatus || "—"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Check In</p>
                            <p className="text-sm font-medium text-green-600">{formatTime(selectedLog.checkInTime)}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Check Out</p>
                            <p className="text-sm font-medium text-red-600">{formatTime(selectedLog.checkOutTime)}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Work Hours</p>
                            <p className="text-sm font-medium text-blue-600">{selectedLog.workHours ? `${selectedLog.workHours}h` : "—"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Method</p>
                            <p className="text-sm font-medium text-gray-900 capitalize">{selectedLog.method || "—"}</p>
                          </div>
                          <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                            <p className="text-xs text-gray-500">Location</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.location || "—"}</p>
                          </div>
                          {selectedLog.remarks && (
                            <div className="bg-gray-50 p-3 rounded-lg col-span-2">
                              <p className="text-xs text-gray-500">Remarks</p>
                              <p className="text-sm font-medium text-gray-900">{selectedLog.remarks}</p>
                            </div>
                          )}
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-500">Verified</p>
                            <p className="text-sm font-medium text-gray-900">{selectedLog.verified ? "Yes" : "No"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setShowLogDetailModal(false)}
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:w-auto sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
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
                        {actionType === "APPROVE" ? "Approve Request" : "Reject Request"}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedRequest && `${actionType === "APPROVE" ? "Approving" : "Rejecting"} request from ${selectedRequest.requestedByName}`}
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

export default AttendanceApprovalRequestPage;
