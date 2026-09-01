import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { 
  CheckCircle2, XCircle, Clock, RotateCw, Eye, X, Check, ShieldCheck, Plus, AlertCircle, Ban
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';
import { AuthContext } from '../../context/AuthContext';

// ── Attendance Regularization API Base Endpoints ─────────────────────────
// POST   /v1/api/attendance/regularization
// GET    /v1/api/attendance/regularization/pending
// PUT    /v1/api/attendance/regularization/{id}/approve
// PUT    /v1/api/attendance/regularization/{id}/reject?reason={reason}
// PUT    /v1/api/attendance/regularization/{id}/cancel?employeeId={empId}
const REGULARIZATION_BASE_URL = '/v1/api/attendance/regularization';

export interface RegularizationItemModel {
  id: number;
  employeeId: number;
  employeeName?: string;
  attendanceDate: string;
  requestedInTime?: string;
  requestedOutTime?: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  createdDate?: string;
  updatedDate?: string;
  rejectionReason?: string | null;
}

const AttendanceRegularizationApprovalPage: React.FC = () => {
  const { user } = useContext(AuthContext);

  const currentUser = {
    id: user?.id || 12,
    name: user?.fullName || user?.username || 'User',
    role: user?.role || 'SUPER_ADMIN'
  };

  // ── States ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [requests, setRequests] = useState<RegularizationItemModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Action States
  const [selectedRequest, setSelectedRequest] = useState<RegularizationItemModel | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'cancel' | 'view' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');

  // New Regularization Form Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({
    attendanceDate: new Date().toISOString().slice(0, 10),
    inTime: `${new Date().toISOString().slice(0, 10)}T09:00:00.000Z`,
    outTime: `${new Date().toISOString().slice(0, 10)}T18:00:00.000Z`,
    reason: 'On Site visit and not able to swipe in and out',
    employeedId: currentUser.id || 12,
    attendanceMode: 'ON_DUTY'
  });

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1: GET ALL PENDING REGULARIZATIONS ──────────────────────────────
  // Endpoint: GET /v1/api/attendance/regularization/pending
  const fetchPendingRegularizations = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${REGULARIZATION_BASE_URL}/pending`);
      if (Array.isArray(res.data)) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.warn("Failed to fetch pending regularizations:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingRegularizations();
  }, [activeTab]);

  // ── API 2, 3, 4: APPROVE / REJECT / CANCEL REGULARIZATION ───────────────
  // Approve: PUT /v1/api/attendance/regularization/{id}/approve
  // Reject:  PUT /v1/api/attendance/regularization/{id}/reject?reason={reason}
  // Cancel:  PUT /v1/api/attendance/regularization/{id}/cancel?employeeId={empId}
  const handleProcessAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest?.id || !actionType || actionType === 'view') return;

    setIsSubmitting(true);
    try {
      if (actionType === 'approve') {
        await axios.put(`${REGULARIZATION_BASE_URL}/${selectedRequest.id}/approve`);
        ToasterService.success(`Regularization request #${selectedRequest.id} approved successfully!`);
      } else if (actionType === 'reject') {
        const reasonParam = encodeURIComponent(actionRemarks.trim() || 'Not approved by manager');
        await axios.put(`${REGULARIZATION_BASE_URL}/${selectedRequest.id}/reject?reason=${reasonParam}`);
        ToasterService.success(`Regularization request #${selectedRequest.id} rejected.`);
      } else if (actionType === 'cancel') {
        const empId = selectedRequest.employeeId || currentUser.id || 12;
        await axios.put(`${REGULARIZATION_BASE_URL}/${selectedRequest.id}/cancel?employeeId=${empId}`);
        ToasterService.success(`Regularization request #${selectedRequest.id} cancelled.`);
      }

      setActionType(null);
      setSelectedRequest(null);
      setActionRemarks('');
      fetchPendingRegularizations();
    } catch (err: any) {
      handleApiError(err, `Failed to process ${actionType} action.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── API 5: POST CREATE REGULARIZATION REQUEST ───────────────────────────
  // Endpoint: POST /v1/api/attendance/regularization
  const handleCreateRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyForm.attendanceDate || !applyForm.reason.trim()) {
      ToasterService.error("Please provide attendance date and reason.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        attendanceDate: applyForm.attendanceDate,
        inTime: applyForm.inTime.includes('T') ? applyForm.inTime : `${applyForm.attendanceDate}T${applyForm.inTime}:00.000Z`,
        outTime: applyForm.outTime.includes('T') ? applyForm.outTime : `${applyForm.attendanceDate}T${applyForm.outTime}:00.000Z`,
        reason: applyForm.reason.trim(),
        employeedId: Number(applyForm.employeedId) || currentUser.id || 12,
        attendanceMode: applyForm.attendanceMode || "ON_DUTY"
      };

      await axios.post(REGULARIZATION_BASE_URL, payload);
      ToasterService.success("Attendance Regularization request submitted successfully!");
      setIsApplyModalOpen(false);
      fetchPendingRegularizations();
    } catch (err: any) {
      handleApiError(err, "Failed to submit regularization request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionModal = (req: RegularizationItemModel, type: 'approve' | 'reject' | 'cancel' | 'view') => {
    setSelectedRequest(req);
    setActionType(type);
    setActionRemarks(type === 'reject' ? "Not approved by manager" : "");
  };

  // Helper formatting for time
  const formatTimeStr = (raw?: string | null) => {
    if (!raw) return 'N/A';
    if (raw.includes('T')) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return raw;
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<RegularizationItemModel>[] = [
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
      key: 'employeeId',
      label: 'Employee',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 block">{row.employeeName || `Employee #${row.employeeId}`}</span>
          <span className="text-[10px] text-gray-500 font-mono">Emp ID: #{row.employeeId}</span>
        </div>
      )
    },
    {
      key: 'attendanceDate',
      label: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono font-semibold text-slate-800">
          {row.attendanceDate}
        </span>
      )
    },
    {
      key: 'requestedTime',
      label: 'Requested In / Out',
      render: (row) => (
        <div className="text-xs font-mono font-semibold text-slate-800 flex items-center gap-1">
          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            {formatTimeStr(row.requestedInTime)}
          </span>
          <span>-</span>
          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            {formatTimeStr(row.requestedOutTime)}
          </span>
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => (
        <span className="inline-block px-2.5 py-1 bg-cyan-50 text-cyan-800 rounded text-xs font-semibold max-w-[180px] truncate" title={row.reason}>
          {row.reason || 'Forgot punch in/out'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const status = (row.status || 'PENDING').toUpperCase();
        let colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
        if (status === 'APPROVED') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'REJECTED') colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === 'CANCELLED') colorClass = 'bg-gray-100 text-gray-600 border-gray-200';

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
            title="Inspect Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          
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

          <button
            type="button"
            onClick={() => openActionModal(row, 'cancel')}
            className="p-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-gray-600 transition-colors"
            title="Cancel Request"
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Attendance Regularization" description="Manage and approve employee attendance regularization requests" />
      <PageBreadcrumb pageTitle="Attendance Regularization" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance Regularization Desk</h2>
              <p className="text-xs text-gray-500">Submit and approve missed punch regularizations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(true)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Apply Regularization
            </button>

            <button
              type="button"
              onClick={fetchPendingRegularizations}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh Queue"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Regularization Data Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={requests}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by reason or employee ID..."
            pageSize={10}
            defaultSortKey="id"
            defaultSortOrder="desc"
          />
        </div>

      </div>

      {/* ── MODAL 1: APPLY NEW REGULARIZATION ────────────────────────────── */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  Apply Attendance Regularization
                </h3>
              </div>
              <button type="button" onClick={() => setIsApplyModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRegularization} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID *</label>
                <input
                  type="number"
                  value={applyForm.employeedId}
                  onChange={(e) => setApplyForm(p => ({ ...p, employeedId: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Attendance Date *</label>
                <input
                  type="date"
                  value={applyForm.attendanceDate}
                  onChange={(e) => {
                    const date = e.target.value;
                    setApplyForm(p => ({
                      ...p,
                      attendanceDate: date,
                      inTime: `${date}T09:21:07.273Z`,
                      outTime: `${date}T19:21:07.273Z`
                    }));
                  }}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">In Time *</label>
                  <input
                    type="text"
                    value={applyForm.inTime}
                    onChange={(e) => setApplyForm(p => ({ ...p, inTime: e.target.value }))}
                    className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800 focus:bg-white"
                    placeholder="2026-08-24T09:21:07.273Z"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Out Time *</label>
                  <input
                    type="text"
                    value={applyForm.outTime}
                    onChange={(e) => setApplyForm(p => ({ ...p, outTime: e.target.value }))}
                    className="w-full py-1.5 px-2 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800 focus:bg-white"
                    placeholder="2026-08-24T19:21:07.273Z"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Attendance Mode *</label>
                <select
                  value={applyForm.attendanceMode}
                  onChange={(e) => setApplyForm(p => ({ ...p, attendanceMode: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800"
                >
                  <option value="ON_DUTY">ON_DUTY</option>
                  <option value="MISSED_PUNCH">MISSED_PUNCH</option>
                  <option value="WFH">WFH</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason *</label>
                <textarea
                  rows={3}
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="On Site visit and not able to swipe in and out"
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                  required
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ACTION (APPROVE / REJECT / CANCEL / VIEW) ───────────── */}
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
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE ID</span>
                    <span className="font-bold font-mono text-cyan-800">#{selectedRequest.employeeId}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">STATUS</span>
                    <span className={`font-bold inline-block px-2 py-0.5 rounded text-[10px] ${
                      selectedRequest.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      selectedRequest.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-sans font-medium">Attendance Date:</span>
                    <span className="font-bold text-slate-800">{selectedRequest.attendanceDate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-sans font-medium">Requested Check-In:</span>
                    <span className="font-bold text-emerald-700">{formatTimeStr(selectedRequest.requestedInTime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-sans font-medium">Requested Check-Out:</span>
                    <span className="font-bold text-rose-700">{formatTimeStr(selectedRequest.requestedOutTime)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase tracking-wider">REASON / REMARKS</span>
                  <p className="font-semibold text-slate-800 leading-relaxed">
                    {selectedRequest.reason || 'Forgot punch in/out due to on site visit.'}
                  </p>
                </div>

                {selectedRequest.rejectionReason && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
                    <span className="text-rose-500 font-semibold block text-[10px] uppercase tracking-wider">REJECTION REASON</span>
                    <p className="font-semibold text-rose-800">{selectedRequest.rejectionReason}</p>
                  </div>
                )}

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
                {actionType === 'reject' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Rejection Reason *</label>
                    <textarea
                      rows={3}
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                      placeholder="e.g. Not approved by manager"
                      required
                    />
                  </div>
                )}

                {actionType === 'approve' && (
                  <p className="text-xs text-gray-600">
                    Are you sure you want to approve regularization request <b>#{selectedRequest.id}</b> for date <b>{selectedRequest.attendanceDate}</b>?
                  </p>
                )}

                {actionType === 'cancel' && (
                  <p className="text-xs text-rose-600 font-medium">
                    Are you sure you want to cancel regularization request <b>#{selectedRequest.id}</b>?
                  </p>
                )}

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
                      actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 
                      actionType === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {isSubmitting ? "Processing..." : `Confirm ${actionType.toUpperCase()}`}
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
