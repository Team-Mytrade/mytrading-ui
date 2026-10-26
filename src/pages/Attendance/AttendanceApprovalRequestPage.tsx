import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  RotateCw, Eye, X, Check, FileCheck
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';
import { usePermissions } from "../../access/usePermissions";

// Relative API Base Endpoint (routing via Vite dev proxy)
const BASE_APPROVAL_URL = '/v1/api/attendance/attendance-approvals';

export interface ApprovalRequestModel {
  id: number;
  employeeId?: number;
  employeeName?: string;
  employeeCode?: string;
  requestType?: string;
  status?: string; // PENDING, APPROVED, REJECTED
  appliedDate?: string;
  remarks?: string;
  dates?: string;
  schedule?: string[];
  requestDetails?: any[];
  [key: string]: any;
}

export interface AttendanceApprovalRequestPageProps {
  isEmbedded?: boolean;
  onActionComplete?: () => void;
}

const AttendanceApprovalRequestPage: React.FC<AttendanceApprovalRequestPageProps> = ({ 
  isEmbedded = false, 
  onActionComplete 
}) => {
  const { canApprove } = usePermissions();
  // ── States ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<ApprovalRequestModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Action States
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequestModel | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // Cache map for instant tab switching
  const [cache, setCache] = useState<Record<string, ApprovalRequestModel[]>>({});

  // ── API 1: GET CALL DETAILS (Pending / Approved / Rejected with AbortController & Cache) ──
  const fetchApprovalRequests = useCallback(async (
    tab: 'pending' | 'approved' | 'rejected',
    controller?: AbortController,
    skipCache = false
  ) => {
    // If cached (and not forced refresh), show cached data instantly first
    if (!skipCache && cache[tab]) {
      setRequests(cache[tab]);
    } else {
      setLoading(true);
    }

    try {
      const [leaveApprovalRes, masterApprovalRes] = await Promise.allSettled([
        axios.get(`/v1/api/attendance/leave-approvals/${tab}`, { signal: controller?.signal }),
        axios.get(`${BASE_APPROVAL_URL}/${tab}`, { signal: controller?.signal })
      ]);

      const rawList: any[] = [];

      if (leaveApprovalRes.status === 'fulfilled' && Array.isArray(leaveApprovalRes.value.data)) {
        leaveApprovalRes.value.data.forEach(item => {
          rawList.push({
            ...item,
            requestType: item.leaveType || item.requestType || 'CASUAL'
          });
        });
      }

      if (masterApprovalRes.status === 'fulfilled' && Array.isArray(masterApprovalRes.value.data)) {
        masterApprovalRes.value.data.forEach(item => {
          if (!rawList.some(r => r.id === item.id)) {
            rawList.push(item);
          }
        });
      }

      // Filter OUT Regularization requests
      const filtered = rawList.filter((item: any) => {
        const mainType = (item.requestType || '').toUpperCase();
        const detailType = (item.requestDetails?.[0]?.requestType || item.responseDetails?.[0]?.requestType || '').toUpperCase();
        const projectTaskName = (item.requestDetails?.[0]?.projectTaskName || item.responseDetails?.[0]?.projectTaskName || '').toLowerCase();
        
        const isReg = mainType === 'REGULARIZATION' || 
                      detailType === 'REGULARIZATION' || 
                      projectTaskName.includes('regularization');
        return !isReg;
      });

      // Sanitize each request for the table and drawer so it's concise and unscrollable
      const cleaned = filtered.map((item: any) => {
        const detailList = (Array.isArray(item.responseDetails) && item.responseDetails.length > 0)
          ? item.responseDetails
          : (Array.isArray(item.requestDetails) ? item.requestDetails : []);

        const fromD = item.fromDate || detailList[0]?.fromDate || detailList[0]?.shiftDate || '';
        const toD = item.toDate || detailList[detailList.length - 1]?.toDate || detailList[detailList.length - 1]?.fromDate || '';
        const datesStr = fromD ? `${fromD}${toD && toD !== fromD ? ` to ${toD}` : ''}` : 'N/A';

        const empCode = item.employeeCode || (item.employeeId ? `EMP-${item.employeeId}` : '');
        const empName = item.employeeName || (item.employeeId ? `Employee #${item.employeeId}` : 'Employee');
        const empLabel = `${empName}${empCode ? ` (${empCode})` : ''}`;

        const rawType = item.requestType || item.leaveType || detailList[0]?.requestType || 'WORK_FROM_HOME';
        const requestTypeStr = String(rawType).replace(/_/g, ' ');

        // Normalise status from both leave-approvals and attendance-approvals responses
        const statusStr = String(item.status || item.approvalStatus || tab).toUpperCase();

        const formatTimeOnly = (t?: string) => {
          if (!t) return '';
          if (t.includes('T')) {
            const part = t.split('T')[1];
            return part ? part.slice(0, 5) : '';
          }
          return t.slice(0, 5);
        };

        const formatDateOnly = (dStr?: string) => {
          if (!dStr) return '';
          const dateObj = new Date(dStr);
          if (isNaN(dateObj.getTime())) return dStr.split('T')[0];
          return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        };

        const schedule = detailList.length > 0 ? detailList.map((d: any) => {
          const dDate = d.fromDate || d.shiftDate || '';
          const inT = formatTimeOnly(d.checkInTime);
          const outT = formatTimeOnly(d.checkOutTime);
          const timings = (inT || outT) ? ` (${inT || '--:--'} - ${outT || '--:--'})` : '';
          const dTask = d.projectTaskName ? ` [${d.projectTaskName}]` : '';
          const dRemarks = d.remarks ? `: ${d.remarks}` : '';
          return `${dDate}${timings}${dTask}${dRemarks}`;
        }) : undefined;

        const reasonText = item.remarks || item.reason || detailList[0]?.remarks || detailList[0]?.reason;
        const createdOn = item.createdDate || item.appliedDate;
        const appliedOnDisplay = formatDateOnly(createdOn);

        const rowItem: ApprovalRequestModel = {
          id: item.id,
          employee: empLabel,
          requestType: requestTypeStr,
          status: statusStr,
          dates: datesStr,
          // ── Display-safe fields for the view modal (always consistent regardless of API source) ──
          _displayEmployeeName: empName,
          _displayEmployeeCode: empCode,
          _displayEmployeeId: item.employeeId,
          _displayStatus: statusStr,
          _displayRequestType: requestTypeStr,
          _displayAppliedOn: appliedOnDisplay || '',
          _displayRemarks: reasonText || '',
          _displayDates: datesStr,
          _displaySchedule: schedule || [],
        };

        if (appliedOnDisplay) rowItem.appliedOn = appliedOnDisplay;
        if (reasonText) rowItem.reason = reasonText;
        if (schedule && schedule.length > 0) rowItem.schedule = schedule;

        // Attach raw request non-enumerably so Table.tsx's Object.keys() does NOT inspect it
        Object.defineProperties(rowItem, {
          _raw: { value: item, enumerable: false, writable: true },
          employeeName: { value: empName, enumerable: false, writable: true },
          employeeCode: { value: empCode, enumerable: false, writable: true },
          employeeId: { value: item.employeeId, enumerable: false, writable: true },
        });

        return rowItem;
      });

      setRequests(cleaned);
      setCache(prev => ({ ...prev, [tab]: cleaned }));
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === 'CanceledError') return;
      console.warn(`Failed to fetch ${tab} approvals:`, err);
      if (!cache[tab]) setRequests([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    fetchApprovalRequests(activeTab, controller, false);
    return () => {
      controller.abort();
    };
  }, [activeTab]);

  // ── API 2: APPROVE / REJECT REQUEST ────────────────────────────────────
  // Primary Endpoint: PUT /v1/api/attendance/leave-approvals/{id}/approve
  // Fallback Endpoint: PUT /v1/api/attendance/attendance-approvals/{id}/approve
  const handleProcessAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest?.id || !actionType || actionType === 'view') return;

    setIsSubmitting(true);
    const defaultRemark = actionType === 'approve' 
      ? "Approved and before going on leave please complete the work as discussed" 
      : "Rejected reason";

    const payload = {
      remarks: actionRemarks.trim() || defaultRemark
    };

    try {
      let actionSuccess = false;

      // 1. Try Leave Approvals Endpoint: PUT /v1/api/attendance/leave-approvals/{id}/approve or reject
      try {
        await axios.put(`/v1/api/attendance/leave-approvals/${selectedRequest.id}/${actionType}`, payload);
        actionSuccess = true;
      } catch (err1) {
        // 2. Fallback to Master Attendance Approvals Endpoint
        try {
          await axios.put(`${BASE_APPROVAL_URL}/${selectedRequest.id}/${actionType}`, {
            ...payload,
            approveAll: true,
            detailIds: [0]
          });
          actionSuccess = true;
        } catch (err2) {
          throw err1;
        }
      }

      if (actionSuccess) {
        ToasterService.success(`Leave request #${selectedRequest.id} ${actionType === 'approve' ? 'approved' : 'rejected'} successfully!`);
        onActionComplete?.();
      }

      setActionType(null);
      setSelectedRequest(null);
      setActionRemarks('');
      // Invalidate cache for this tab so the re-fetch always shows fresh data
      setCache(prev => { const next = { ...prev }; delete next[activeTab]; return next; });
      fetchApprovalRequests(activeTab, undefined, true);
    } catch (err: any) {
      handleApiError(err, `Failed to ${actionType} leave request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (req: ApprovalRequestModel, type: 'approve' | 'reject' | 'view') => {
    // Use the cleaned display row directly — its _display* fields are always consistent
    // regardless of whether the record came from leave-approvals or attendance-approvals API.
    setSelectedRequest(req);
    setActionType(type);
    // Pre-fill remarks only for approve/reject; leave view mode blank
    if (type === 'approve') {
      setActionRemarks('Approved and before going on leave please complete the work as discussed');
    } else if (type === 'reject') {
      setActionRemarks('enter task description for each day and resubmit');
    } else {
      setActionRemarks('');
    }
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<ApprovalRequestModel>[] = [
    {
      key: 'id',
      label: 'Approval ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 dark:text-gray-300 bg-cyan-50 dark:bg-transparent px-2 py-0.5 rounded border border-cyan-200 dark:border-transparent">
          #{row.id}
        </span>
      )
    },
    {
      key: 'employee',
      label: 'Employee',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 dark:text-white block">{row.employeeName || row.employee || (row.employeeId ? `Employee #${row.employeeId}` : 'Employee')}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{row.employeeCode || (row.employeeId ? `ID: #${row.employeeId}` : '—')}</span>
        </div>
      )
    },
    {
      key: 'requestType',
      label: 'Request Type',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-xs text-slate-800 dark:text-gray-300 uppercase">
          {(row.requestType || 'WORK_FROM_HOME').replace(/_/g, ' ')}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const status = (row.status || activeTab).toUpperCase();
        let colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';
        let dotClass = 'bg-amber-500';
        if (status === 'APPROVED') {
          colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';
          dotClass = 'bg-emerald-500';
        }
        if (status === 'REJECTED') {
          colorClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';
          dotClass = 'bg-rose-500';
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${colorClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            {status}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => openActionModal(row, 'view')}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-gray-200 dark:border-[#303030] rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
            title="Inspect Request"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {activeTab === 'pending' && canApprove && (
            <>
              <button
                type="button"
                onClick={() => openActionModal(row, 'approve')}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-emerald-700 dark:text-emerald-300 transition-colors"
                title="Approve Request"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openActionModal(row, 'reject')}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-600 dark:text-rose-300 transition-colors"
                title="Reject Request"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      {!isEmbedded && (
        <>
          <PageMeta title="Attendance Approvals" description="Manage and approve employee attendance requests" />
          <PageBreadcrumb pageTitle="Attendance Approvals" />
        </>
      )}

      <div className={isEmbedded ? "w-full pb-2 animate-in fade-in duration-200 space-y-4" : "max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4"}>
        
        {/* Header Bar (Shown only in standalone view) */}
        {!isEmbedded && (
          <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all duration-200 hover:shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-50 dark:bg-[#222222] text-cyan-700 dark:text-cyan-400 rounded-lg border border-cyan-200 dark:border-transparent transition-transform duration-200 hover:scale-105">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Attendance Approval Desk</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Review, approve, or reject employee attendance requests</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchApprovalRequests(activeTab)}
              className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-transparent rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 self-end sm:self-center"
              title="Refresh Approvals"
            >
              <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${loading ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} />
            </button>
          </div>
        )}

        {/* Tab Navigation with Smooth Transitions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/80 dark:border-[#2a2a2a] pb-2">
          <div className="flex items-center gap-2">
            {(['pending', 'approved', 'rejected'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all duration-200 ease-in-out transform active:scale-95 ${
                  activeTab === tab 
                  ? 'bg-cyan-600 text-white shadow-xs scale-102' 
                  : 'bg-white dark:bg-[#191919] text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-[#222222] border border-gray-200/80 dark:border-transparent hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab} Approvals
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <TableToolbar onRefresh={() => fetchApprovalRequests(activeTab)} />
          </div>
        </div>

        {/* Approvals Table with Responsive Horizontal Scroll */}
        <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 transition-all duration-300 overflow-x-auto">
          <div className="min-w-[600px]">
            <ReusableTable
              data={requests}
              columns={columns}
              loading={loading}
              pageSize={5}
              defaultSortKey="id"
              defaultSortOrder="desc"
              rowDetailsTitle={(row) => `Approval Request #${row.id}`}
              rowDetailsSubtitle="Review request details and employee information"
            />
          </div>
        </div>

      </div>

      {/* ── MODAL: APPROVE / REJECT / VIEW ACTION WITH SMOOTH POPUP ─────────────────────────── */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-out animate-in fade-in">
          <div className="bg-white dark:bg-[#191919] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 dark:border-transparent space-y-4 text-slate-900 dark:text-white transition-all duration-300 ease-out transform animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400 transition-transform duration-200 hover:rotate-6" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                  {actionType === 'view' ? `Request #${selectedRequest.id} Details` : `${actionType.toUpperCase()} Request #${selectedRequest.id}`}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setActionType(null)} 
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#222222] rounded-lg transition-all duration-200 active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionType === 'view' ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/80 dark:border-[#303030]">
                  <div>
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE NAME</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedRequest._displayEmployeeName || selectedRequest.employee || 'Employee'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE ID</span>
                    <span className="font-bold font-mono text-cyan-800 dark:text-cyan-400">
                      {selectedRequest._displayEmployeeCode
                        ? `#${selectedRequest._displayEmployeeCode}`
                        : selectedRequest._displayEmployeeId
                          ? `#EMP-${selectedRequest._displayEmployeeId}`
                          : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">REQUEST TYPE</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase">
                      {selectedRequest._displayRequestType || selectedRequest.requestType || 'WORK FROM HOME'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">STATUS</span>
                    {(() => {
                      const st = selectedRequest._displayStatus || selectedRequest.status || activeTab.toUpperCase();
                      const stClass = st === 'APPROVED'
                        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : st === 'REJECTED'
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300';
                      return <span className={`font-bold inline-block px-2 py-0.5 rounded text-[10px] ${stClass}`}>{st}</span>;
                    })()}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/80 dark:border-[#303030] space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                    <span className="text-slate-500 dark:text-gray-400 font-medium">Applied Date:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {selectedRequest._displayAppliedOn || selectedRequest.appliedOn || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                    <span className="text-slate-500 dark:text-gray-400 font-medium">Leave / Shift Dates:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-white">
                      {selectedRequest._displayDates || selectedRequest.dates || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-gray-400 font-medium">Approval Category:</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400">Attendance & Leave Desk</span>
                  </div>
                </div>

                {selectedRequest._displaySchedule && selectedRequest._displaySchedule.length > 0 && (
                  <div className="bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/80 dark:border-[#303030] space-y-1">
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">SCHEDULE BREAKDOWN</span>
                    <ul className="space-y-0.5">
                      {(selectedRequest._displaySchedule as string[]).map((s, i) => (
                        <li key={i} className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-[#191919] px-2 py-1 rounded border border-slate-100 dark:border-[#303030]">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:border-[#303030] space-y-1">
                  <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">REMARKS / JUSTIFICATION</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedRequest._displayRemarks || selectedRequest.reason || 'No specific remarks provided for this attendance approval request.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-[#2a2a2a] flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProcessAction} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Approval Remarks</label>
                  <textarea
                    rows={3}
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#303030] rounded-md text-xs text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                    placeholder="Enter approval or rejection remarks..."
                    required
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-[#2a2a2a] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2 border border-gray-200 dark:border-transparent bg-white dark:bg-[#222222] rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-5 py-2 text-white rounded-lg text-xs font-bold disabled:opacity-70 ${
                      actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {isSubmitting ? "Processing..." : (actionType === 'approve' ? "Confirm Approve" : "Confirm Reject")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AttendanceApprovalRequestPage;
