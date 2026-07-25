import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  XMarkIcon,
  UserIcon,
  TagIcon,
  HashtagIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import FilterPopover from "../../components/common/filter";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { AddButton } from "../../components/common/AddButton";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

interface LeaveType {
  id: number;
  name: string;
  code?: string;
}

interface LeaveBalance {
  id?: number;
  employeeId: number;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  totalAllocated: number;
  used: number;
  remaining: number;
}

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

interface LeaveRequest {
  id?: number;
  employeeId: number;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  approvedDate: string | null;
  approverRemarks: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "/v1/api/attendance/leaves";
const EMPLOYEE_URL = "/v1/api/payroll/employee";
const LEAVETYPE_URL = "/v1/api/attendance/leave-types";
const LEAVE_BALANCE_URL = "/v1/api/attendance/leave-balances";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
};

const STATUS_ICONS: Record<LeaveStatus, React.ReactNode> = {
  PENDING: <ClockIcon className="h-3 w-3" />,
  APPROVED: <CheckCircleIcon className="h-3 w-3" />,
  REJECTED: <XCircleIcon className="h-3 w-3" />,
  CANCELLED: <XCircleIcon className="h-3 w-3" />,
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: LeaveRequest = {
  employeeId: 0,
  employeeName: "",
  leaveTypeId: 0,
  leaveTypeName: "",
  startDate: "",
  endDate: "",
  totalDays: 0,
  reason: "",
  status: "PENDING",
  appliedDate: new Date().toISOString().split('T')[0],
  approvedDate: null,
  approverRemarks: null,
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

const calculateTotalDays = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const LeaveRequestPage: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [form, setForm] = useState<LeaveRequest>({ ...emptyForm });
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
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

  const loadLeaveTypes = async () => {
    try {
      const res = await axios.get<LeaveType[]>(`${LEAVETYPE_URL}`);
      setLeaveTypes(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load leave types");
    }
  };

  const loadLeaveBalances = async (empId: number) => {
    if (!empId) return [];
    try {
      const res = await axios.get<LeaveBalance[]>(`${LEAVE_BALANCE_URL}/employee/${empId}`);
      setLeaveBalances(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to load leave balances", err);
      ToasterService.error("Failed to load leave balances");
      return [];
    }
  };



  const loadLeaveRequests = async (empId: number) => {
    setLoading(true);
    try {
      const res = await axios.get<LeaveRequest[]>(`${BASE_URL}/employee/${empId}`);
      setLeaveRequests(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadLeaveTypes();
  }, []);

  // Run when selectedEmployeeId changes - fetch leave balances
  useEffect(() => {
    if (selectedEmployeeId) {
      loadLeaveBalances(selectedEmployeeId);
      loadLeaveRequests(selectedEmployeeId);
    } else {
      setLeaveBalances([]);
      setLeaveRequests([]);
    }
  }, [selectedEmployeeId]);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof LeaveRequest, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleEmployeeChange = async (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    handleChange("employeeId", employeeId);
    handleChange("employeeName", employee ? `${employee.firstName} ${employee.lastName}` : "");

    // Load leave balances for the selected employee
    if (employeeId) {
      await loadLeaveBalances(employeeId);
    } else {
      setLeaveBalances([]);
    }
  };

  const handleSelectedEmployeeChange = (employeeId: number | null) => {
    if (showForm) {
      resetForm();
    }
    setSelectedEmployeeId(employeeId);
  };

  const handleLeaveTypeChange = (leaveTypeId: number) => {
    const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
    handleChange("leaveTypeId", leaveTypeId);
    handleChange("leaveTypeName", leaveType?.name || "");
  };

  const handleDateChange = (date: Date | null, field: "startDate" | "endDate") => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      handleChange(field, dateStr);

      // Auto-calculate total days when both dates are set
      const newStartDate = field === "startDate" ? dateStr : form.startDate;
      const newEndDate = field === "endDate" ? dateStr : form.endDate;
      if (newStartDate && newEndDate) {
        const totalDays = calculateTotalDays(newStartDate, newEndDate);
        handleChange("totalDays", totalDays);
      }
    } else {
      handleChange(field, "");
      if (field === "startDate" && form.endDate) {
        handleChange("totalDays", calculateTotalDays("", form.endDate));
      } else if (field === "endDate" && form.startDate) {
        handleChange("totalDays", calculateTotalDays(form.startDate, ""));
      } else {
        handleChange("totalDays", 0);
      }
    }
  };

  // Check if employee has sufficient leave balance
  const checkLeaveBalance = (leaveTypeId: number, requestedDays: number): { eligible: boolean; remaining: number; message: string } => {
    const balance = leaveBalances.find(b => b.leaveTypeId === leaveTypeId);

    if (!balance) {
      return {
        eligible: false,
        remaining: 0,
        message: "No leave balance found for this leave type. Please contact HR/Admin."
      };
    }

    if (balance.remaining < requestedDays) {
      return {
        eligible: false,
        remaining: balance.remaining,
        message: `No Remaining Leaves of the selected leave type available. Only ${balance.remaining} day(s) remaining. Contact HR/Admin`
      };
    }

    return {
      eligible: true,
      remaining: balance.remaining,
      message: ""
    };
  };

  const resetForm = () => {
    setForm({ ...emptyForm, appliedDate: new Date().toISOString().split('T')[0] });
    setEditingRequest(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, appliedDate: new Date().toISOString().split('T')[0] });
    setEditingRequest(null);
    setShowForm(true);
  };

  const openEditForm = (request: LeaveRequest) => {
    setForm({ ...request });
    setEditingRequest(request);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.leaveTypeId) {
      ToasterService.error("Please select a leave type");
      return;
    }
    if (!form.startDate) {
      ToasterService.error("Please select start date");
      return;
    }
    if (!form.endDate) {
      ToasterService.error("Please select end date");
      return;
    }
    if (form.totalDays <= 0) {
      ToasterService.error("Total days must be greater than 0");
      return;
    }

    // Check leave balance before submitting
    const balanceCheck = checkLeaveBalance(form.leaveTypeId, form.totalDays);
    if (!balanceCheck.eligible) {
      ToasterService.error(balanceCheck.message);
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      leaveTypeId: form.leaveTypeId,
      leaveTypeName: form.leaveTypeName,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays: form.totalDays,
      reason: form.reason,
      status: form.status,
      appliedDate: form.appliedDate,
      approvedDate: form.approvedDate,
      approverRemarks: form.approverRemarks,
    };

    try {
      if (editingRequest?.id) {
        await axios.put(`${BASE_URL}/${editingRequest.id}`, payload);
        ToasterService.success("Leave request updated successfully");
      } else {
        await axios.post(`${BASE_URL}/apply`, payload);
        ToasterService.success("Leave request submitted successfully");
      }
      await loadLeaveRequests(form.employeeId);
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  const updateStatus = async (id: number, newStatus: LeaveStatus, remarks?: string) => {
    try {
      await axios.patch(`${BASE_URL}/${id}/status`, { status: newStatus, remarks });
      ToasterService.success(`Leave request ${newStatus.toLowerCase()} successfully`);
      await loadLeaveRequests(form.employeeId);
    } catch (err: any) {
      console.error("Status update failed", err);
      ToasterService.error(err.response?.data?.message || "Status update failed");
    }
  };

  const handleApprove = async (request: LeaveRequest) => {
    const ok = await confirm({
      message: `Approve leave request for ${request.employeeName}?`,
      confirmLabel: "Approve",
      variant: "info",
    });
    if (!ok) return;
    await updateStatus(request.id!, "APPROVED");
  };

  const handleReject = async (request: LeaveRequest) => {
    const ok = await confirm({
      message: `Reject leave request for ${request.employeeName}?`,
      confirmLabel: "Reject",
      variant: "danger",
    });
    if (!ok) return;
    await updateStatus(request.id!, "REJECTED");
  };

  const handleCancelRequest = async (request: LeaveRequest) => {
    const ok = await confirm({
      message: `Cancel leave request for ${request.employeeName}?`,
      confirmLabel: "Cancel",
      variant: "warning",
    });
    if (!ok) return;
    await updateStatus(request.id!, "CANCELLED");
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this leave request? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${BASE_URL}/${id}`);
      ToasterService.success("Leave request deleted successfully");
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const filteredLeaveRequests = useMemo(() => {
    let list = [...leaveRequests];
    if (selectedEmployeeFilter) {
      list = list.filter(r => r.employeeId.toString() === selectedEmployeeFilter);
    }
    if (selectedStatusFilter) {
      list = list.filter(r => r.status === selectedStatusFilter);
    }
    return list;
  }, [leaveRequests, selectedEmployeeFilter, selectedStatusFilter]);

  const stats = {
    total: filteredLeaveRequests.length,
    pending: filteredLeaveRequests.filter(r => r.status === "PENDING").length,
    approved: filteredLeaveRequests.filter(r => r.status === "APPROVED").length,
    rejected: filteredLeaveRequests.filter(r => r.status === "REJECTED").length,
  };

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(leaveRequests.map(r => [r.employeeId, {
    id: r.employeeId,
    name: r.employeeName
  }])).values()];

  const statusOptions: LeaveStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

  // Count active filters
  const activeFilterCount = [selectedEmployeeFilter, selectedStatusFilter].filter(Boolean).length;

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Get leave balance for selected leave type
  const getSelectedLeaveBalance = () => {
    if (!form.leaveTypeId) return null;
    return leaveBalances.find(b => b.leaveTypeId === form.leaveTypeId);
  };

  const selectedBalance = getSelectedLeaveBalance();
  const isLeaveEligible = selectedBalance && selectedBalance.remaining >= form.totalDays;

  // ─── Columns for ReusableTable ───────────────────────────────────────────────
  const columns: ColumnDef<LeaveRequest>[] = [
    {
      key: "appliedDate", label: "Applied Date", sortable: true,
      render: (_: LeaveRequest, v: unknown) => (
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
      render: (row: LeaveRequest) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.employeeName}</span>
        </div>
      ),
    },
    {
      key: "leaveTypeName", label: "Leave Type", sortable: true,
      render: (_: LeaveRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "startDate", label: "Start Date", sortable: true,
      render: (_: LeaveRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">
            {v ? new Date(String(v)).toLocaleDateString() : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "endDate", label: "End Date", sortable: true,
      render: (_: LeaveRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">
            {v ? new Date(String(v)).toLocaleDateString() : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "totalDays", label: "Days", sortable: true,
      render: (row: LeaveRequest) => {
        const days = calculateTotalDays(row.startDate, row.endDate);

        return (
          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {days} day{days !== 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      key: "reason", label: "Reason", sortable: true,
      render: (_: LeaveRequest, v: unknown) => (
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
      render: (_: LeaveRequest, v: unknown) => {
        const status = v as LeaveStatus;
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
      render: (row: LeaveRequest) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          {row.status === "PENDING" && (
            <>
              <button
                onClick={() => handleApprove(row)}
                title="Approve"
                className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
              >
                <CheckCircleIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleReject(row)}
                title="Reject"
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <XCircleIcon className="h-4 w-4" />
              </button>
            </>
          )}
          {(row.status === "APPROVED" || row.status === "PENDING") && (
            <button
              onClick={() => handleCancelRequest(row)}
              title="Cancel"
              className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <XCircleIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => openEditForm(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
            disabled={row.status !== "PENDING"}
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
      <PageMeta title="Leave Requests" description="Manage leave requests" />
      <PageBreadcrumb pageTitle="Leave Requests" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Employee Selection Card */}
        <div className={`${cardCls} mb-6`}>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <UserIcon className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Select Employee</h2>
                  <p className="text-sm text-gray-500">Choose an employee to view or manage leave requests</p>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <select
                  value={selectedEmployeeId || ""}
                  onChange={e => handleSelectedEmployeeChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">— Choose an employee —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {!selectedEmployeeId ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Employee Selected</h3>
              <p className="text-sm text-gray-500">Please select an employee to view their leave requests</p>
            </div>
          </div>
        ) : (
          <>
            {/* Employee Info Banner */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-100 p-4 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-cyan-200 flex items-center justify-center">
                    <span className="text-lg font-bold text-cyan-700">
                      {selectedEmployee?.firstName?.charAt(0)}{selectedEmployee?.lastName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedEmployee?.firstName} {selectedEmployee?.lastName}</h3>
                    <p className="text-sm text-gray-500">{selectedEmployee?.employeeCode}</p>
                  </div>
                </div>
                  <AddButton label="Apply Leave" onClick={openCreateForm} />
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
                        {editingRequest ? (
                          <PencilSquareIcon className="h-5 w-5 text-cyan-600" />
                        ) : (
                          <PlusIcon className="h-5 w-5 text-cyan-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {editingRequest ? "Edit Leave Request" : "Apply for Leave"}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {editingRequest ? "Update leave request details" : "Submit a new leave request"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetForm}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Back to table"
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
                        onChange={e => handleEmployeeChange(Number(e.target.value))}
                        className={inputCls}
                        disabled={!!editingRequest}
                      >
                        <option value="">Select Employee</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
                          </option>
                        ))}
                      </select>
                      {editingRequest && (
                        <p className="mt-1 text-xs text-gray-500">Employee cannot be changed while editing</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Leave Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.leaveTypeId || ""}
                        required
                        onChange={e => handleLeaveTypeChange(Number(e.target.value))}
                        className={inputCls}
                      >
                        <option value="">Select Leave Type</option>
                        {leaveTypes.map(lt => {
                          const balance = leaveBalances.find(b => b.leaveTypeId === lt.id);
                          return (
                            <option key={lt.id} value={lt.id}>
                              {lt.name} {balance ? `(Remaining: ${balance.remaining} days)` : "(No balance)"}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        selected={form.startDate ? new Date(form.startDate) : null}
                        onChange={(date) => handleDateChange(date, "startDate")}
                        dateFormat="yyyy-MM-dd"
                        className={inputCls}
                        placeholderText="Select start date"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <DatePicker
                        selected={form.endDate ? new Date(form.endDate) : null}
                        onChange={(date) => handleDateChange(date, "endDate")}
                        dateFormat="yyyy-MM-dd"
                        className={inputCls}
                        placeholderText="Select end date"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Total Days</label>
                      <input
                        type="text"
                        value={form.totalDays ? `${form.totalDays} day${form.totalDays !== 1 ? 's' : ''}` : "0 days"}
                        className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                        readOnly
                        disabled
                      />
                      <p className="mt-1 text-xs text-gray-500">Auto-calculated from selected dates</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Status
                      </label>
                      <select
                        value={form.status}
                        onChange={e => handleChange("status", e.target.value as LeaveStatus)}
                        className={inputCls}
                        disabled={!!editingRequest && editingRequest.status !== "PENDING"}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="CANCELLED">Cancelled</option>
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
                        placeholder="Briefly describe the reason for leave..."
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

                  {/* Leave Balance Warning */}
                  {form.leaveTypeId > 0 && form.totalDays > 0 && selectedBalance && (
                    <div className={`mt-4 p-4 rounded-lg border ${isLeaveEligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Leave Balance Status</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Available: {selectedBalance.remaining} days | Requested: {form.totalDays} days
                          </p>
                        </div>
                        {isLeaveEligible ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircleIcon className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      {!isLeaveEligible && (
                        <p className="mt-2 text-sm text-red-600">
                          No Remaining Leaves of the selected leave type available. Only {selectedBalance.remaining} day(s) remaining. Contact HR/Admin.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={Boolean(form.leaveTypeId > 0 && form.totalDays > 0 && selectedBalance && !isLeaveEligible)}
                      className={`px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 ${form.leaveTypeId > 0 && form.totalDays > 0 && selectedBalance && !isLeaveEligible
                        ? 'bg-gray-400 cursor-not-allowed !text-white'
                        : 'bg-cyan-600 hover:bg-cyan-700 !text-white'
                        }`}
                    >
                      {editingRequest ? (
                        <>
                          <PencilSquareIcon className="h-4 w-4" />
                          Update Request
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-4 w-4" />
                          Submit Request
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
              // Table View
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <StatsCard
                    label="Total Requests"
                    value={stats.total}
                    gradient="from-cyan-50 to-blue-50"
                    borderColor="border-cyan-100"
                    labelColor="text-cyan-600"
                    icon={<DocumentTextIcon className="h-6 w-6" />}
                  />
                  <StatsCard
                    label="Pending"
                    value={stats.pending}
                    gradient="from-amber-50 to-yellow-50"
                    borderColor="border-amber-100"
                    labelColor="text-yellow-600"
                    icon={<ClockIcon className="h-6 w-6" />}
                  />
                  <StatsCard
                    label="Approved"
                    value={stats.approved}
                    gradient="from-green-50 to-emerald-50"
                    borderColor="border-green-100"
                    labelColor="text-green-600"
                    icon={<CheckCircleIcon className="h-6 w-6" />}
                  />
                  <StatsCard
                    label="Rejected"
                    value={stats.rejected}
                    gradient="from-red-50 to-rose-50"
                    borderColor="border-red-100"
                    labelColor="text-red-600"
                    icon={<XCircleIcon className="h-6 w-6" />}
                  />
                </div>

                {/* Reusable Table */}
                <ReusableTable<LeaveRequest>
                  data={filteredLeaveRequests}
                  columns={columns}
                  loading={loading}
                  searchable={true}
                  searchPlaceholder="Search by leave type or reason..."
                  searchFields={["leaveTypeName", "reason", "employeeName"]}
                  pageSize={PAGE_SIZE}
                  defaultSortKey="appliedDate"
                  defaultSortOrder="desc"
                  toolbar={
                    <FilterPopover
                      title="Filter Leave Requests"
                      buttonLabel="Filter"
                      onReset={() => {
                        setSelectedEmployeeFilter("");
                        setSelectedStatusFilter("");
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
                              <option key={emp.id} value={emp.id.toString()}>{emp.name}</option>
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
                            {statusOptions.map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </FilterPopover>
                  }
                  emptyState={
                    <div className="flex flex-col items-center py-12">
                      <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <CalendarDaysIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 text-sm font-medium mb-2">No leave requests found</p>
                      <button
                        onClick={openCreateForm}
                        className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Apply for leave
                      </button>
                    </div>
                  }
                />
              </>
            )}
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

export default LeaveRequestPage;
