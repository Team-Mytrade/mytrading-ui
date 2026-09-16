import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle2, XCircle, Clock, RotateCw, Eye, MessageSquare, X, Check, FileCheck
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base Endpoint (routing via Vite dev proxy)
const BASE_APPROVAL_URL = '/v1/api/attendance/attendance-approvals';

export interface ApprovalRequestModel {
  id: number;
  employeeId?: number;
  employeeName?: string;
  requestType?: string;
  status?: string; // PENDING, APPROVED, REJECTED
  appliedDate?: string;
  remarks?: string;
  requestDetails?: any[];
}

const AttendanceApprovalRequestPage: React.FC = () => {
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
  const fetchApprovalRequests = async (tab: 'pending' | 'approved' | 'rejected', controller?: AbortController) => {
    // If cached, show cached data instantly first
    if (cache[tab]) {
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

      setRequests(filtered);
      setCache(prev => ({ ...prev, [tab]: filtered }));
    } catch (err: any) {
      if (axios.isCancel(err) || err.name === 'CanceledError') return;
      console.warn(`Failed to fetch ${tab} approvals:`, err);
      if (!cache[tab]) setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchApprovalRequests(activeTab, controller);
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
      }

      setActionType(null);
      setSelectedRequest(null);
      setActionRemarks('');
      fetchApprovalRequests(activeTab);
    } catch (err: any) {
      handleApiError(err, `Failed to ${actionType} leave request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (req: ApprovalRequestModel, type: 'approve' | 'reject' | 'view') => {
    setSelectedRequest(req);
    setActionType(type);
    setActionRemarks(type === 'reject' ? "enter task description for each day and resubmit" : "Approved by Manager");
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<ApprovalRequestModel>[] = [
    {
      key: 'id',
      label: 'Approval ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
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
          <span className="font-bold text-xs text-gray-900 block">{row.employeeName || (row.employeeId ? `Employee #${row.employeeId}` : 'Employee')}</span>
          <span className="text-[10px] text-gray-500 font-mono">{row.employeeId ? `ID: #${row.employeeId}` : '—'}</span>
        </div>
      )
    },
    {
      key: 'requestType',
      label: 'Request Type',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-xs text-slate-800 uppercase">
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
        let colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
        if (status === 'APPROVED') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'REJECTED') colorClass = 'bg-rose-50 text-rose-700 border-rose-200';

        return (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${colorClass}`}>
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
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Inspect Request"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {activeTab === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => openActionModal(row, 'approve')}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-700 transition-colors"
                title="Approve Request"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => openActionModal(row, 'reject')}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-600 transition-colors"
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
      <PageMeta title="Attendance Approvals" description="Manage and approve employee attendance requests" />
      <PageBreadcrumb pageTitle="Attendance Approvals" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 transition-all duration-200 hover:shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200 transition-transform duration-200 hover:scale-105">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance Approval Desk</h2>
              <p className="text-xs text-gray-500">Review, approve, or reject employee attendance requests</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchApprovalRequests(activeTab)}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 self-end sm:self-center"
            title="Refresh Approvals"
          >
            <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>
        </div>

        {/* Tab Navigation with Smooth Transitions */}
        <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2">
          {(['pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all duration-200 ease-in-out transform active:scale-95 ${
                activeTab === tab 
                  ? 'bg-cyan-600 text-white shadow-xs scale-102' 
                  : 'bg-white text-gray-600 hover:bg-gray-100/80 border border-gray-200/80 hover:text-gray-900'
              }`}
            >
              {tab} Approvals
            </button>
          ))}
        </div>

        {/* Approvals Table with Responsive Horizontal Scroll */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 transition-all duration-300 overflow-x-auto">
          <div className="min-w-[600px]">
            <ReusableTable
              data={requests}
              columns={columns}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search by employee name or request type..."
              pageSize={5}
              defaultSortKey="id"
              defaultSortOrder="desc"
            />
          </div>
        </div>

      </div>

      {/* ── MODAL: APPROVE / REJECT / VIEW ACTION WITH SMOOTH POPUP ─────────────────────────── */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-out animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4 transition-all duration-300 ease-out transform animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-cyan-600 transition-transform duration-200 hover:rotate-6" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  {actionType === 'view' ? `Request #${selectedRequest.id} Details` : `${actionType.toUpperCase()} Request #${selectedRequest.id}`}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setActionType(null)} 
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionType === 'view' ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE NAME</span>
                    <span className="font-bold text-slate-900">{selectedRequest.employeeName || (selectedRequest.employeeId ? `Employee #${selectedRequest.employeeId}` : 'Employee')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE ID</span>
                    <span className="font-bold font-mono text-cyan-800">{selectedRequest.employeeId ? `#EMP-${selectedRequest.employeeId}` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">REQUEST TYPE</span>
                    <span className="font-bold text-slate-800 uppercase">{(selectedRequest.requestType || 'WORK_FROM_HOME').replace(/_/g, ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">STATUS</span>
                    <span className={`font-bold inline-block px-2 py-0.5 rounded text-[10px] ${
                      selectedRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      selectedRequest.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedRequest.status || activeTab.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Applied Date:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedRequest.appliedDate || new Date().toISOString().split('T')[0]}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Approval Category:</span>
                    <span className="font-bold text-cyan-700">Attendance & Regularization Desk</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">REMARKS / JUSTIFICATION</span>
                  <p className="font-semibold text-slate-800 leading-relaxed">
                    {selectedRequest.remarks || 'No specific remarks provided for this attendance approval request.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleProcessAction} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Approval Remarks</label>
                  <textarea
                    rows={3}
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                    placeholder="Enter approval or rejection remarks..."
                    required
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType(null)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
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
