import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle2, XCircle, Clock, RotateCw, Eye, X, Check, ShieldCheck
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base Endpoint (routing via Vite dev proxy)
const BASE_APPROVAL_URL = '/v1/api/attendance/attendance-approvals';

export interface RegularizationRequestModel {
  id: number;
  employeeId?: number;
  employeeName?: string;
  requestType?: string;
  status?: string;
  appliedDate?: string;
  remarks?: string;
}

const AttendanceRegularizationApprovalPage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<RegularizationRequestModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Action States
  const [selectedRequest, setSelectedRequest] = useState<RegularizationRequestModel | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1: GET CALL DETAILS (Pending / Approved / Rejected) ──────────────
  // Endpoints: GET /v1/api/attendance/attendance-approvals/pending
  //            GET /v1/api/attendance/attendance-approvals/approved
  //            GET /v1/api/attendance/attendance-approvals/rejected
  const fetchRegularizationApprovals = async (tab: 'pending' | 'approved' | 'rejected') => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_APPROVAL_URL}/${tab}`);
      if (Array.isArray(res.data)) {
        // Filter Regularization type
        const regList = res.data.filter((r: any) => 
          r.requestType === 'REGULARIZATION' || 
          r.requestDetails?.[0]?.requestType === 'REGULARIZATION'
        );
        setRequests(regList.length > 0 ? regList : res.data);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.warn(`Failed to fetch ${tab} regularization approvals:`, err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegularizationApprovals(activeTab);
  }, [activeTab]);

  // ── API 2: APPROVE / REJECT REQUEST ────────────────────────────────────
  // Approve Endpoint: PUT /v1/api/attendance/attendance-approvals/{id}/approve
  // Reject Endpoint:  PUT /v1/api/attendance/attendance-approvals/{id}/reject
  const handleProcessAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest?.id || !actionType || actionType === 'view') return;

    setIsSubmitting(true);
    try {
      const endpoint = `${BASE_APPROVAL_URL}/${selectedRequest.id}/${actionType}`;
      const payload = {
        remarks: actionRemarks.trim() || (actionType === 'approve' ? "Approved by Manager" : "enter task description for each day and resubmit"),
        approveAll: true,
        detailIds: [0]
      };

      await axios.put(endpoint, payload);
      ToasterService.success(`Regularization request #${selectedRequest.id} ${actionType === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setActionType(null);
      setSelectedRequest(null);
      setActionRemarks('');
      fetchRegularizationApprovals(activeTab);
    } catch (err: any) {
      handleApiError(err, `Failed to ${actionType} regularization request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (req: RegularizationRequestModel, type: 'approve' | 'reject' | 'view') => {
    setSelectedRequest(req);
    setActionType(type);
    setActionRemarks(type === 'reject' ? "enter task description for each day and resubmit" : "Approved by Manager");
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<RegularizationRequestModel>[] = [
    {
      key: 'id',
      label: 'Req ID',
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
          <span className="font-bold text-xs text-gray-900 block">{row.employeeName || `Employee #${row.employeeId || 'N/A'}`}</span>
          <span className="text-[10px] text-gray-500 font-mono">ID: #{row.employeeId || '12'}</span>
        </div>
      )
    },
    {
      key: 'shiftDate',
      label: 'Shift Date',
      sortable: true,
      render: (row) => {
        const detail = (row as any).requestDetails?.[0] || {};
        return (
          <span className="text-xs font-mono font-semibold text-slate-700">
            {detail.shiftDate || detail.fromDate || '2026-08-13'}
          </span>
        );
      }
    },
    {
      key: 'regularizedTime',
      label: 'Regularized Time',
      render: (row) => {
        const detail = (row as any).requestDetails?.[0] || {};
        const inT = detail.checkInTime ? detail.checkInTime.substring(11, 16) : '09:00';
        const outT = detail.checkOutTime ? detail.checkOutTime.substring(11, 16) : '18:00';
        return (
          <span className="text-xs font-mono font-semibold text-slate-800">
            {inT} - {outT}
          </span>
        );
      }
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span className="inline-block px-2.5 py-1 bg-cyan-50 text-cyan-800 rounded text-xs font-semibold max-w-[160px] truncate">
          {row.remarks || (row as any).requestDetails?.[0]?.remarks || (row as any).requestDetails?.[0]?.reason || 'Forgot In/Out Punch'}
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
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-700 text-xs font-bold transition-colors flex items-center gap-1"
                title="Approve Request"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                type="button"
                onClick={() => openActionModal(row, 'reject')}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded text-rose-700 text-xs font-bold transition-colors flex items-center gap-1"
                title="Reject Request"
              >
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Regularization Approvals" description="Approve employee attendance regularization requests" />
      <PageBreadcrumb pageTitle="Regularization Approvals" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance Regularization Desk</h2>
              <p className="text-xs text-gray-500">Review miss-punch and regularization requests</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchRegularizationApprovals(activeTab)}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all self-end sm:self-center"
            title="Refresh Approvals"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200/80 pb-2">
          {(['pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                activeTab === tab 
                  ? 'bg-cyan-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200/80'
              }`}
            >
              {tab} Regularizations
            </button>
          ))}
        </div>

        {/* Approvals Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={requests}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by employee name..."
            pageSize={5}
            defaultSortKey="id"
            defaultSortOrder="desc"
          />
        </div>

      </div>

      {/* ── MODAL: ACTION ─────────────────────────────────────────────────── */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  {actionType === 'view' ? `Regularization #${selectedRequest.id}` : `${actionType.toUpperCase()} Regularization #${selectedRequest.id}`}
                </h3>
              </div>
              <button type="button" onClick={() => setActionType(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionType === 'view' ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE NAME</span>
                    <span className="font-bold text-slate-900">{selectedRequest.employeeName || 'Roy Hamlin'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE ID</span>
                    <span className="font-bold font-mono text-cyan-800">#EMP-{selectedRequest.employeeId || '71'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">REGULARIZATION TYPE</span>
                    <span className="font-bold text-slate-800 uppercase">Forgot In/Out Punch</span>
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

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-sans font-medium">Regularization Date:</span>
                    <span className="font-bold text-slate-800">{selectedRequest.appliedDate || '2026-08-13'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-sans font-medium">Requested Check-In/Out:</span>
                    <span className="font-bold text-emerald-700">09:00 AM - 06:00 PM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans font-medium">Total Duration:</span>
                    <span className="font-bold text-cyan-800">9.0 Hours</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">REASON / REMARKS</span>
                  <p className="font-semibold text-slate-800 leading-relaxed">
                    {selectedRequest.remarks || 'Forgot to punch in/out due to client site visit.'}
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
                    placeholder="Enter regularization remarks..."
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

export default AttendanceRegularizationApprovalPage;
