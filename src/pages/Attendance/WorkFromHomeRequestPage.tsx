import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  XMarkIcon,
  UserIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  HashtagIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  HomeModernIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ArrowPathIcon,
  MapPinIcon,
  TagIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PaginatedPopup from "../../components/common/unpopup";
import { AddButton } from "../../components/common/AddButton";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";
type WFHType = "FULL_DAY" | "HALF_DAY_MORNING" | "HALF_DAY_AFTERNOON" | "CUSTOM";

interface WorkFromHomeRequest {
  id?: number;
  employeeId: number;
  employeeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: RequestStatus;
  appliedAt: string;
  approvedAt: string | null;
  managerComment: string | null;
  wfhType: WFHType;
  location: string;
  approvedById: number | null;
  reasonCategory: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WFH_API = "/v1/api/attendance/wfh";
const EMPLOYEE_API = "/v1/api/payroll/employee";

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<RequestStatus, React.ReactNode> = {
  PENDING: <ClockIcon className="h-3 w-3" />,
  APPROVED: <CheckCircleIcon className="h-3 w-3" />,
  REJECTED: <XCircleIcon className="h-3 w-3" />,
};

const WFH_TYPE_LABELS: Record<WFHType, string> = {
  FULL_DAY: "Full Day",
  HALF_DAY_MORNING: "Half Day (Morning)",
  HALF_DAY_AFTERNOON: "Half Day (Afternoon)",
  CUSTOM: "Custom Hours",
};

const WFH_TYPE_COLORS: Record<WFHType, string> = {
  FULL_DAY: "bg-blue-100 text-blue-700",
  HALF_DAY_MORNING: "bg-purple-100 text-purple-700",
  HALF_DAY_AFTERNOON: "bg-indigo-100 text-indigo-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: WorkFromHomeRequest = {
  employeeId: 0,
  employeeName: "",
  startDate: "",
  endDate: "",
  totalDays: 0,
  reason: "",
  status: "PENDING",
  appliedAt: new Date().toISOString(),
  approvedAt: null,
  managerComment: null,
  wfhType: "FULL_DAY",
  location: "",
  approvedById: null,
  reasonCategory: "",
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

const WorkFromHomeRequestPage: React.FC = () => {
  const [requests, setRequests] = useState<WorkFromHomeRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<WorkFromHomeRequest | null>(null);
  const [form, setForm] = useState<WorkFromHomeRequest>({ ...emptyForm });
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Approve/Reject state
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<WorkFromHomeRequest | null>(null);

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

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await axios.get<WorkFromHomeRequest[]>(`${WFH_API}/employee/35?from=2026-05-07&to=2026-05-20`);
      setRequests(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load WFH requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadRequests();
  }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof WorkFromHomeRequest, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));

    // Auto-calculate total days when start or end date changes
    if (key === "startDate" || key === "endDate") {
      const newForm = { ...form, [key]: value };
      if (newForm.startDate && newForm.endDate) {
        const totalDays = calculateTotalDays(newForm.startDate, newForm.endDate);
        setForm(prev => ({ ...prev, totalDays }));
      }
    }
  };

  const handleDateChange = (date: Date | null, field: "startDate" | "endDate") => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      handleChange(field, dateStr);
    } else {
      handleChange(field, "");
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm, appliedAt: new Date().toISOString() });
    setEditingRequest(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setForm({ ...emptyForm, appliedAt: new Date().toISOString() });
    setEditingRequest(null);
    setShowForm(true);
  };

  const openEditForm = (request: WorkFromHomeRequest) => {
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
    if (!form.startDate) {
      ToasterService.error("Please select start date");
      return;
    }
    if (!form.endDate) {
      ToasterService.error("Please select end date");
      return;
    }
    if (!form.reason) {
      ToasterService.error("Please provide a reason");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays: form.totalDays,
      reason: form.reason,
      status: form.status,
      appliedAt: form.appliedAt,
      approvedAt: form.approvedAt,
      managerComment: form.managerComment,
      wfhType: form.wfhType,
      location: form.location,
      approvedById: form.approvedById,
      reasonCategory: form.reasonCategory,
    };

    try {
      if (editingRequest?.id) {
        await axios.put(`${WFH_API}/${editingRequest.id}`, payload);
        ToasterService.success("WFH request updated successfully");
      } else {
        await axios.post(`${WFH_API}/apply`, payload);
        ToasterService.success("WFH request submitted successfully");
      }
      await loadRequests();
      resetForm();
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Approve / Reject ─────────────────────────────────────────────────────────

  const openActionDialog = (request: WorkFromHomeRequest, type: "APPROVE" | "REJECT") => {
    setSelectedRequest(request);
    setActionType(type);
    setActionRemarks("");
    setShowActionDialog(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedRequest || !actionType) return;

    const endpoint = actionType === "APPROVE" ? `${WFH_API}/approve` : `${WFH_API}/reject`;
    const successMsg = actionType === "APPROVE" ? "WFH request approved successfully" : "WFH request rejected successfully";

    try {
      await axios.post(endpoint, null, {
        params: { requestId: selectedRequest.id, remarks: actionRemarks }
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
      message: "Are you sure you want to delete this WFH request? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${WFH_API}/${id}`);
      ToasterService.success("WFH request deleted successfully");
      await loadRequests();
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats & Filters ─────────────────────────────────────────────────────────

  const filteredData = useMemo(() => {
    let filtered = [...requests];

    if (selectedEmployeeFilter) {
      filtered = filtered.filter(r => r.employeeId.toString() === selectedEmployeeFilter);
    }

    if (selectedStatusFilter) {
      filtered = filtered.filter(r => r.status === selectedStatusFilter);
    }

    if (selectedTypeFilter) {
      filtered = filtered.filter(r => r.wfhType === selectedTypeFilter);
    }

    if (dateRange.from) {
      filtered = filtered.filter(r => new Date(r.startDate) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(r => new Date(r.endDate) <= dateRange.to!);
    }

    return filtered;
  }, [requests, selectedEmployeeFilter, selectedStatusFilter, selectedTypeFilter, dateRange.from, dateRange.to]);

  const stats = {
    total: filteredData.length,
    pending: filteredData.filter(r => r.status === "PENDING").length,
    approved: filteredData.filter(r => r.status === "APPROVED").length,
    rejected: filteredData.filter(r => r.status === "REJECTED").length,
  };

  // Get unique employees for filter
  const uniqueEmployees = [...new Map(requests.map(r => [r.employeeId, {
    id: r.employeeId,
    name: r.employeeName
  }])).values()];

  const statusOptions: RequestStatus[] = ["PENDING", "APPROVED", "REJECTED"];
  const wfhTypeOptions: WFHType[] = ["FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON", "CUSTOM"];

  // Count active filters
  const activeFilterCount = [selectedEmployeeFilter, selectedStatusFilter, selectedTypeFilter, dateRange.from, dateRange.to].filter(Boolean).length;

  // ── Columns for ReusableTable ───────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  const columns: ColumnDef<WorkFromHomeRequest>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "employeeName", label: "Employee", sortable: true,
      render: (row: WorkFromHomeRequest) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.employeeName}</span>
        </div>
      ),
    },
    {
      key: "startDate", label: "Start Date", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{formatDate(v as string)}</span>
        </div>
      ),
    },
    {
      key: "endDate", label: "End Date", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{formatDate(v as string)}</span>
        </div>
      ),
    },
    {
      key: "totalDays", label: "Days", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => (
        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          {Number(v) || 0} day{(Number(v) !== 1 && Number(v) !== 0) ? 's' : ''}
        </span>
      ),
    },
    {
      key: "wfhType", label: "Type", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => {
        const type = v as WFHType;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${WFH_TYPE_COLORS[type]}`}>
            <TagIcon className="h-3 w-3" />
            {WFH_TYPE_LABELS[type]}
          </span>
        );
      },
    },
    {
      key: "location", label: "Location", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => (
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate max-w-[150px]" title={String(v)}>
            {String(v) || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "reason", label: "Reason", sortable: true,
      render: (_: WorkFromHomeRequest, v: unknown) => (
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
      render: (_: WorkFromHomeRequest, v: unknown) => {
        const status = v as RequestStatus;
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
      render: (row: WorkFromHomeRequest) => (
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
      <PageMeta title="Work From Home Requests" description="Manage WFH requests" />
      <PageBreadcrumb pageTitle="Work From Home Requests" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Work From Home Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Apply and manage employee WFH requests</p>
          </div>
          <AddButton label="Apply WFH" onClick={openCreateForm} />
        </div>

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
        <ReusableTable<WorkFromHomeRequest>
          data={filteredData}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search by employee, reason, or location..."
          searchFields={["employeeName", "reason", "location"]}
          pageSize={PAGE_SIZE}
          defaultSortKey="startDate"
          defaultSortOrder="desc"
          toolbar={
            <FilterPopover
              title="Filter WFH Requests"
              buttonLabel="Filter"
              onReset={() => {
                setSelectedEmployeeFilter("");
                setSelectedStatusFilter("");
                setSelectedTypeFilter("");
                setDateRange({ from: null, to: null });
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">WFH Type</label>
                  <select
                    value={selectedTypeFilter}
                    onChange={e => setSelectedTypeFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All Types</option>
                    {wfhTypeOptions.map(type => (
                      <option key={type} value={type}>{WFH_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Date Range</label>
                  <div className="flex gap-2">
                    <DatePicker
                      selected={dateRange.from}
                      onChange={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      dateFormat="yyyy-MM-dd"
                      className="flex-1 p-2 border border-gray-200 rounded-xl text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none w-full"
                      placeholderText="From"
                    />
                    <DatePicker
                      selected={dateRange.to}
                      onChange={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      dateFormat="yyyy-MM-dd"
                      className="flex-1 p-2 border border-gray-200 rounded-xl text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none w-full"
                      placeholderText="To"
                    />
                  </div>
                </div>
              </div>
            </FilterPopover>
          }
          emptyState={
            <div className="flex flex-col items-center py-12">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <HomeModernIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No WFH requests found</p>
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

        {/* WFH Request Form Modal */}
        <PaginatedPopup
          isOpen={showForm}
          title={editingRequest ? "Edit WFH Request" : "Apply for Work From Home"}
          subtitle={editingRequest ? "Update WFH request details" : "Submit a new WFH request"}
          onClose={resetForm}
          onSubmit={submitForm}
          submitLabel={editingRequest ? "Update Request" : "Submit Request"}
          fields={[
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
                disabled={!!editingRequest}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
                  </option>
                ))}
              </select>
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WFH Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.wfhType}
                onChange={e => handleChange("wfhType", e.target.value as WFHType)}
                className={inputCls}
                required
              >
                <option value="FULL_DAY">Full Day</option>
                <option value="HALF_DAY_MORNING">Half Day (Morning)</option>
                <option value="HALF_DAY_AFTERNOON">Half Day (Afternoon)</option>
                <option value="CUSTOM">Custom Hours</option>
              </select>
            </div>,
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
            </div>,
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
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Days</label>
              <input
                type="text"
                value={form.totalDays ? `${form.totalDays} day${form.totalDays !== 1 ? 's' : ''}` : "0 days"}
                className={`${inputCls} bg-gray-50 cursor-not-allowed`}
                readOnly
                disabled
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={e => handleChange("location", e.target.value)}
                placeholder="e.g., Mumbai, India"
                className={inputCls}
              />
            </div>,
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.reason}
                onChange={e => handleChange("reason", e.target.value)}
                rows={3}
                placeholder="Briefly describe the reason for WFH..."
                className={inputCls}
                required
              />
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason Category
              </label>
              <select
                value={form.reasonCategory}
                onChange={e => handleChange("reasonCategory", e.target.value)}
                className={inputCls}
              >
                <option value="">Select Category</option>
                <option value="MEDICAL">Medical</option>
                <option value="PERSONAL">Personal</option>
                <option value="FAMILY">Family</option>
                <option value="TECHNICAL">Technical Issues</option>
                <option value="OTHER">Other</option>
              </select>
            </div>,
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={form.status}
                onChange={e => handleChange("status", e.target.value as RequestStatus)}
                className={inputCls}
                disabled={!!editingRequest && editingRequest.status !== "PENDING"}
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>,
            form.managerComment ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Manager Comment</label>
                <textarea
                  value={form.managerComment || ""}
                  rows={2}
                  className={`${inputCls} bg-gray-50`}
                  readOnly
                  disabled
                />
              </div>
            ) : null
          ]}
        />

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
                        {actionType === "APPROVE" ? "Approve WFH Request" : "Reject WFH Request"}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedRequest && `${actionType === "APPROVE" ? "Approving" : "Rejecting"} WFH request from ${selectedRequest.employeeName}`}
                      </p>
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Manager Comment <span className="text-gray-400">(optional)</span>
                        </label>
                        <textarea
                          value={actionRemarks}
                          onChange={e => setActionRemarks(e.target.value)}
                          rows={3}
                          placeholder="Add your comments..."
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

export default WorkFromHomeRequestPage;
