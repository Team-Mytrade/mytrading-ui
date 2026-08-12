import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  HashtagIcon,
  UserIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  CalendarDaysIcon,
  MapPinIcon,
  BriefcaseIcon,
  SparklesIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";

// ─── Types & Interfaces ────────────────────────────────────────────────────────

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
type ActiveTab = "pending" | "approved" | "rejected";

interface AttendanceApprovalRequest {
  id: number;
  isLeaveApproval?: boolean;
  employeeId?: number;
  employeeCode?: string;
  requestedById?: number;
  requestedByName?: string;
  employeeName?: string;
  approverId?: number;
  approverName?: string;
  requestType?: string;
  fromDate?: string;
  toDate?: string;
  shiftDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  shiftInTime?: string;
  shiftOutTime?: string;
  projectTaskId?: number;
  projectTaskName?: string;
  clientName?: string;
  visitLocation?: string;
  purpose?: string;
  requestedAt?: string;
  createdDate?: string;
  reason?: string;
  remarks?: string;
  status: ApprovalStatus;
  actionedAt?: string | null;
  approverRemarks?: string | null;
}

const LEAVE_APPROVAL_API = "/v1/api/attendance/leave-approvals";
const ATTENDANCE_APPROVAL_API = "/v1/api/attendance/attendance-approvals";

const STATUS_CONFIG: Record<ApprovalStatus, { style: string; badge: string; icon: React.ReactNode }> = {
  PENDING: {
    style: "border-amber-200/80 bg-amber-50/70 text-amber-700",
    badge: "bg-amber-500",
    icon: <ClockIcon className="w-3.5 h-3.5" />,
  },
  APPROVED: {
    style: "border-emerald-200/80 bg-emerald-50/70 text-emerald-700",
    badge: "bg-emerald-500",
    icon: <CheckCircleIcon className="w-3.5 h-3.5" />,
  },
  REJECTED: {
    style: "border-rose-200/80 bg-rose-50/70 text-rose-700",
    badge: "bg-rose-500",
    icon: <XCircleIcon className="w-3.5 h-3.5" />,
  },
};

const AttendanceApprovalRequestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("pending");
  const [requests, setRequests] = useState<AttendanceApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Detail View Drawer state
  const [selectedDetailRequest, setSelectedDetailRequest] = useState<AttendanceApprovalRequest | null>(null);

  // Action modal state (Approve / Reject)
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(null);
  const [actionRemarks, setActionRemarks] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<AttendanceApprovalRequest | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const currentUser = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          id: user.id || user.userId || 12,
          name: user.fullName || user.name || user.username || "Karthik Raj",
          code: user.employeeCode || String(user.id || 12),
        };
      }
    } catch (e) {}
    return { id: 12, name: "Karthik Raj", code: "12" };
  }, []);

  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get('/v1/api/payroll/employee/all');
        if (Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          res.data.forEach((e: any) => {
            const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.fullName;
            if (fullName) {
              map[String(e.id)] = fullName;
            }
          });
          setEmployeesMap(map);
        }
      } catch (e) {}
    };
    fetchEmployees();
  }, []);

  // ── Fetch Approval Requests by Tab ──────────────────────────────────────────

  const loadRequestsByStatus = async (tab: ActiveTab) => {
    setLoading(true);
    let allRaw: { data: any[]; isLeave: boolean }[] = [];

    // 1. Fetch Leave Approvals: only /pending exists in backend controller
    if (tab === 'pending') {
      try {
        const res = await axios.get<any[]>(`${LEAVE_APPROVAL_API}/pending`);
        if (Array.isArray(res.data)) {
          allRaw.push({ data: res.data, isLeave: true });
        }
      } catch (e) {}
    } else {
      // Fetch Approved / Rejected leave requests from leave-requests endpoint
      try {
        const res = await axios.get<any[]>(`/v1/api/attendance/leave-requests/employee/12`);
        if (Array.isArray(res.data)) {
          const filtered = res.data.filter(r => String(r.status || '').toLowerCase() === tab.toLowerCase());
          allRaw.push({ data: filtered, isLeave: true });
        }
      } catch (e) {}
    }

    // 2. Fetch Attendance Approvals: /v1/api/attendance/attendance-approvals/{tab}
    try {
      const res = await axios.get<any[]>(`${ATTENDANCE_APPROVAL_API}/${tab}`);
      if (Array.isArray(res.data)) {
        allRaw.push({ data: res.data, isLeave: false });
      }
    } catch (e) {}

    const normalizedList: AttendanceApprovalRequest[] = [];

    allRaw.forEach(({ data, isLeave }) => {
      data.forEach((r: any) => {
        const detail = (Array.isArray(r.requestDetails) && r.requestDetails[0]) || 
                       (Array.isArray(r.responseDetails) && r.responseDetails[0]) || {};
        const statusVal = r.approvalStatus || r.status || detail.approvalStatus || detail.status || tab.toUpperCase();
        const empId = r.employeeId || r.requestedById || detail.employeeId || currentUser.id;
        
        let resolvedName = r.employeeName || r.requestedByName || detail.employeeName || detail.requestedByName || r.userName || detail.userName;
        if (employeesMap[String(empId)]) {
          resolvedName = employeesMap[String(empId)];
        } else if (!resolvedName || String(empId) === String(currentUser.id)) {
          resolvedName = currentUser.name;
        }

        const reqTypeStr = isLeave 
          ? `${(r.leaveType || detail.leaveType || "CASUAL").toUpperCase()} LEAVE`
          : (r.requestType || detail.requestType || "ATTENDANCE_REGULARIZATION").replace(/_/g, ' ');

        normalizedList.push({
          id: r.id,
          isLeaveApproval: isLeave,
          employeeId: empId,
          employeeCode: r.employeeCode || `TEC-EMP-${String(empId).padStart(4, '0')}`,
          employeeName: resolvedName,
          requestedByName: resolvedName,
          requestType: reqTypeStr,
          fromDate: r.fromDate || detail.fromDate || r.startDate || "—",
          toDate: r.toDate || detail.toDate || r.endDate || "—",
          shiftDate: r.shiftDate || detail.shiftDate || r.fromDate || detail.fromDate || "—",
          checkInTime: r.checkInTime || detail.checkInTime || "—",
          checkOutTime: r.checkOutTime || detail.checkOutTime || "—",
          projectTaskId: r.projectTaskId || detail.projectTaskId || "—",
          projectTaskName: r.projectTaskName || detail.projectTaskName || "—",
          reason: r.reason || detail.reason || r.remarks || detail.remarks || "—",
          status: String(statusVal).toUpperCase() as ApprovalStatus,
          createdDate: r.createdDate || r.requestedAt || "—",
          actionedAt: r.actionDate || r.actionedAt || "—"
        });
      });
    });

    setRequests(normalizedList);
    setLoading(false);
  };

  useEffect(() => {
    loadRequestsByStatus(activeTab);
  }, [activeTab]);

  // ── Tab Handler ─────────────────────────────────────────────────────────────

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
  };

  // ── Action Handlers ─────────────────────────────────────────────────────────

  const openActionDialog = (request: AttendanceApprovalRequest, type: "APPROVE" | "REJECT") => {
    setSelectedRequest(request);
    setActionType(type);
    setActionRemarks(type === "REJECT" ? "Rejected reason" : "Approved and before going on leave please complete the work as discussed");
    setShowActionDialog(true);
  };

  const handleActionSubmit = async () => {
    if (!selectedRequest || !selectedRequest.id || !actionType) return;

    const action = actionType === "APPROVE" ? "approve" : "reject";
    const apiBase = selectedRequest.isLeaveApproval ? LEAVE_APPROVAL_API : ATTENDANCE_APPROVAL_API;
    const endpoint = `${apiBase}/${selectedRequest.id}/${action}`;
    const defaultRemark = actionType === "APPROVE" ? "Approved" : "Rejected reason";

    try {
      setIsSubmittingAction(true);
      const payload = selectedRequest.isLeaveApproval
        ? { remarks: actionRemarks.trim() || (actionType === "APPROVE" ? "Approved and before going on leave please complete the work as discussed" : "Rejected reason") }
        : { remarks: actionRemarks.trim() || defaultRemark, approveAll: true, detailIds: [0] };

      await axios.put(endpoint, payload);

      ToasterService.success(`Request ${actionType === "APPROVE" ? "approved" : "rejected"} successfully!`);
      await loadRequestsByStatus(activeTab);
    } catch (err: any) {
      console.error(`Failed to ${action} request:`, err);
      ToasterService.error(err.response?.data?.message || err.response?.data?.error || `Failed to ${action} request`);
    } finally {
      setIsSubmittingAction(false);
      setShowActionDialog(false);
      setSelectedRequest(null);
      setActionType(null);
      setActionRemarks("");
    }
  };

  // ── Client-side Filtered Search ─────────────────────────────────────────────

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    const query = searchQuery.toLowerCase();
    return requests.filter(r =>
      String(r.id).includes(query) ||
      (r.requestedByName && r.requestedByName.toLowerCase().includes(query)) ||
      (r.employeeName && r.employeeName.toLowerCase().includes(query)) ||
      (r.reason && r.reason.toLowerCase().includes(query)) ||
      (r.requestType && r.requestType.toLowerCase().includes(query)) ||
      (r.projectTaskName && r.projectTaskName.toLowerCase().includes(query))
    );
  }, [requests, searchQuery]);

  // ── Table Column Definitions ────────────────────────────────────────────────

  const columns: ColumnDef<AttendanceApprovalRequest>[] = [
    {
      key: "id",
      label: "Request ID",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-cyan-800">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span>
          <span>#{row.id}</span>
        </div>
      ),
    },
    {
      key: "requestedByName",
      label: "Employee",
      sortable: true,
      render: (row) => {
        const empName = row.employeeName || row.requestedByName || (String(row.employeeId) === String(currentUser.id) ? currentUser.name : `Employee #${row.employeeId || row.requestedById || '—'}`);
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center text-xs font-extrabold shadow-2xs shrink-0">
              {empName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-900 tracking-tight truncate" title={empName}>{empName}</p>
              <span className="text-[10px] text-gray-400 font-mono">ID: #{row.employeeId || row.requestedById || '—'}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "requestType",
      label: "Request Type",
      sortable: true,
      render: (row) => {
        const typeStr = row.requestType ? row.requestType.replace(/_/g, ' ') : 'ATTENDANCE REQUEST';
        return (
          <div className="space-y-0.5 max-w-[180px]">
            <span className="inline-block text-[10px] font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200/60 px-2 py-0.5 rounded-md uppercase whitespace-nowrap">
              {typeStr}
            </span>
            {row.projectTaskName && (
              <p className="text-[10px] text-gray-500 font-medium truncate" title={row.projectTaskName}>
                {row.projectTaskName}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "fromDate",
      label: "Requested Schedule",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
          <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>
            {row.fromDate ? `${row.fromDate} ${row.toDate && row.toDate !== row.fromDate ? `to ${row.toDate}` : ''}` : (row.requestedAt ? new Date(row.requestedAt).toLocaleDateString() : "—")}
          </span>
        </div>
      ),
    },
    {
      key: "reason",
      label: "Reason & Notes",
      sortable: true,
      className: "max-w-[180px]",
      render: (row) => (
        <div className="max-w-[180px] overflow-hidden">
          <p className="text-xs text-gray-800 font-medium truncate" title={row.reason || row.remarks}>
            {row.reason || row.remarks || "—"}
          </p>
          {row.approverRemarks && (
            <p className="text-[10px] text-gray-500 italic truncate mt-0.5" title={`Manager Note: ${row.approverRemarks}`}>
              Manager Note: {row.approverRemarks}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => {
        const rawStatus = (row.status || "PENDING").toUpperCase() as ApprovalStatus;
        const config = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.PENDING;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${config.style}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.badge}`}></span>
            {rawStatus}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Details",
      headerClassName: "!text-right pr-6",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedDetailRequest(row)}
            type="button"
            title="View Request Details"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors"
          >
            <EyeIcon className="w-3.5 h-3.5" />
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Attendance Approvals" description="Review and approve employee attendance requests" />
      <PageBreadcrumb pageTitle="Attendance Approvals" />

      <div className="max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
        
        {/* Header Stats using common StatsCard component */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div onClick={() => handleTabChange("pending")} className="cursor-pointer">
            <StatsCard
              label="PENDING APPROVALS"
              value={activeTab === "pending" ? filteredRequests.length : "—"}
              gradient="bg-yellow-50"
              borderColor={activeTab === "pending" ? "border-yellow-400 ring-2 ring-yellow-400/40" : "border-yellow-200"}
              labelColor="text-yellow-700"
              icon={<ClockIcon className="w-5 h-5 text-yellow-600" />}
            />
          </div>

          <div onClick={() => handleTabChange("approved")} className="cursor-pointer">
            <StatsCard
              label="APPROVED REQUESTS"
              value={activeTab === "approved" ? filteredRequests.length : "—"}
              gradient="bg-green-50"
              borderColor={activeTab === "approved" ? "border-green-400 ring-2 ring-green-400/40" : "border-green-200"}
              labelColor="text-green-700"
              icon={<CheckCircleIcon className="w-5 h-5 text-green-600" />}
            />
          </div>

          <div onClick={() => handleTabChange("rejected")} className="cursor-pointer">
            <StatsCard
              label="REJECTED REQUESTS"
              value={activeTab === "rejected" ? filteredRequests.length : "—"}
              gradient="bg-red-50"
              borderColor={activeTab === "rejected" ? "border-red-400 ring-2 ring-red-400/40" : "border-red-200"}
              labelColor="text-red-700"
              icon={<XCircleIcon className="w-5 h-5 text-red-600" />}
            />
          </div>
        </div>

        {/* Tab Selection Bar & Search */}
        <div className="bg-white rounded-xl border border-gray-200/90 p-3 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-gray-100/80 rounded-lg w-full md:w-auto">
            <button
              onClick={() => handleTabChange("pending")}
              type="button"
              className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "pending"
                  ? "bg-white text-amber-700 shadow-2xs border border-amber-200/60"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Pending Requests
            </button>
            <button
              onClick={() => handleTabChange("approved")}
              type="button"
              className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "approved"
                  ? "bg-white text-emerald-700 shadow-2xs border border-emerald-200/60"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Approved Requests
            </button>
            <button
              onClick={() => handleTabChange("rejected")}
              type="button"
              className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                activeTab === "rejected"
                  ? "bg-white text-rose-700 shadow-2xs border border-rose-200/60"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Rejected Requests
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-72">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, name, or reason..."
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none"
              />
            </div>
            <button
              onClick={() => loadRequestsByStatus(activeTab)}
              type="button"
              title="Refresh Requests"
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Requests Data Table */}
        <ReusableTable<AttendanceApprovalRequest>
          data={filteredRequests}
          columns={columns}
          loading={loading}
          emptyState={
            <div className="py-8 text-center text-xs text-gray-500 font-medium">
              No {activeTab} attendance requests found.
            </div>
          }
        />

        {/* Request Detail Modal Drawer */}
        {selectedDetailRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold text-xs">
                    #{selectedDetailRequest.id}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Attendance Request Details</h3>
                    <p className="text-[11px] text-gray-500">Submitted by {selectedDetailRequest.requestedByName || selectedDetailRequest.employeeName || 'Employee'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDetailRequest(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Request Type</p>
                  <p className="font-bold text-gray-900 mt-0.5">{selectedDetailRequest.requestType || "WORK FROM HOME"}</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Status</p>
                  <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_CONFIG[selectedDetailRequest.status || 'PENDING']?.style}`}>
                    {selectedDetailRequest.status}
                  </span>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">From Date</p>
                  <p className="font-bold text-gray-900 mt-0.5">{selectedDetailRequest.fromDate || "—"}</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">To Date</p>
                  <p className="font-bold text-gray-900 mt-0.5">{selectedDetailRequest.toDate || "—"}</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 col-span-2">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Project / Task</p>
                  <p className="font-bold text-gray-900 mt-0.5">{selectedDetailRequest.projectTaskName || "Attendance Module Development"}</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100 col-span-2">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase">Reason</p>
                  <p className="font-medium text-gray-800 mt-0.5">{selectedDetailRequest.reason || selectedDetailRequest.remarks || "—"}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-gray-100">
                {selectedDetailRequest.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => {
                        const req = selectedDetailRequest;
                        setSelectedDetailRequest(null);
                        openActionDialog(req, "APPROVE");
                      }}
                      type="button"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs"
                    >
                      Approve Request
                    </button>
                    <button
                      onClick={() => {
                        const req = selectedDetailRequest;
                        setSelectedDetailRequest(null);
                        openActionDialog(req, "REJECT");
                      }}
                      type="button"
                      className="px-3.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs hover:bg-rose-100"
                    >
                      Reject Request
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedDetailRequest(null)}
                  type="button"
                  className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve / Reject Modal Dialog */}
        {showActionDialog && selectedRequest && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-2xs ${
                  actionType === "APPROVE" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                }`}>
                  {actionType === "APPROVE" ? <CheckCircleIcon className="w-6 h-6" /> : <XCircleIcon className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {actionType === "APPROVE" ? "Approve Attendance Request" : "Reject Attendance Request"}
                  </h3>
                  <p className="text-[11px] text-gray-500">Request #{selectedRequest.id}</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                  <p className="text-xs font-bold text-gray-800">
                    Employee: {selectedRequest.requestedByName || selectedRequest.employeeName || `ID #${selectedRequest.employeeId}`}
                  </p>
                  <p className="text-xs text-gray-600">
                    Reason: {selectedRequest.reason || selectedRequest.remarks || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Approval Remarks / Manager Comments
                  </label>
                  <textarea
                    rows={3}
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    placeholder="Enter specific remarks..."
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowActionDialog(false)}
                    type="button"
                    disabled={isSubmittingAction}
                    className="px-3.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleActionSubmit}
                    type="button"
                    disabled={isSubmittingAction}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-2xs transition-all ${
                      actionType === "APPROVE"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-rose-600 hover:bg-rose-700"
                    } ${isSubmittingAction ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSubmittingAction ? "Processing..." : (actionType === "APPROVE" ? "Confirm Approve" : "Confirm Reject")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default AttendanceApprovalRequestPage;
