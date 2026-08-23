import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  FileText, Plus, RotateCw, Eye, XCircle, X, CheckCircle2, AlertCircle, Calendar, Clock, MapPin, Briefcase, User, Tag
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base Endpoint (routing via Vite dev proxy)
const BASE_REQUESTS_URL = '/v1/api/attendance/requests';

export interface RequestDetailItem {
  fromDate: string;
  toDate: string;
  shiftDate: string;
  checkInTime: string;
  checkOutTime: string;
  shiftInTime: string;
  shiftOutTime: string;
  projectTaskId?: number;
  projectTaskName?: string;
  remarks?: string;
  clientName?: string | null;
  visitLocation?: string | null;
  purpose?: string | null;
  requestType: string;
  reason?: string;
}

export interface AttendanceRequestModel {
  id?: number;
  employeeId: number;
  employeeName?: string;
  requestType?: string;
  status?: string; // PENDING, APPROVED, REJECTED, CANCELLED
  createdDate?: string;
  requestDetails: RequestDetailItem[];
}

const AttendanceRequestsPage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<AttendanceRequestModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [currentEmployeeId, setCurrentEmployeeId] = useState<number>(12);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<AttendanceRequestModel | null>(null);

  // Form State
  const [form, setForm] = useState<RequestDetailItem>({
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    shiftDate: new Date().toISOString().slice(0, 10),
    checkInTime: `${new Date().toISOString().slice(0, 10)}T09:00:00`,
    checkOutTime: `${new Date().toISOString().slice(0, 10)}T18:30:00`,
    shiftInTime: `${new Date().toISOString().slice(0, 10)}T09:00:00`,
    shiftOutTime: `${new Date().toISOString().slice(0, 10)}T18:00:00`,
    projectTaskId: 5001,
    projectTaskName: "Attendance Module Development",
    remarks: "Working from home due to internet installation.",
    clientName: null,
    visitLocation: null,
    purpose: null,
    requestType: "WORK_FROM_HOME",
    reason: "Need to work remotely."
  });

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1: GET MY REQUESTS ─────────────────────────────────────────────
  // Endpoint: GET /v1/api/attendance/requests/my/{employeeId}
  const fetchMyRequests = async (empId: number) => {
    if (!empId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_REQUESTS_URL}/my/${empId}`);
      if (Array.isArray(res.data)) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.warn("Failed to load requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests(currentEmployeeId);
  }, [currentEmployeeId]);

  // ── API 2: CREATE REQUEST ──────────────────────────────────────────────
  // Endpoint: POST /v1/api/attendance/requests
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fromDate || !form.toDate || !form.requestType) {
      ToasterService.error("Please fill in dates and request type.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        employeeId: Number(currentEmployeeId),
        requestDetails: [
          {
            fromDate: form.fromDate,
            toDate: form.toDate,
            shiftDate: form.fromDate,
            checkInTime: form.checkInTime || `${form.fromDate}T09:00:00`,
            checkOutTime: form.checkOutTime || `${form.toDate}T18:30:00`,
            shiftInTime: form.shiftInTime || `${form.fromDate}T09:00:00`,
            shiftOutTime: form.shiftOutTime || `${form.toDate}T18:00:00`,
            projectTaskId: Number(form.projectTaskId) || 5001,
            projectTaskName: form.projectTaskName || "Attendance Module Development",
            remarks: form.remarks || "Work request submission.",
            clientName: form.clientName || null,
            visitLocation: form.visitLocation || null,
            purpose: form.purpose || null,
            requestType: form.requestType,
            reason: form.reason || "Need remote request approval."
          }
        ]
      };

      await axios.post(BASE_REQUESTS_URL, payload);
      ToasterService.success("Attendance request created successfully!");
      setIsCreateModalOpen(false);
      fetchMyRequests(currentEmployeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to create attendance request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── API 3: GET BY REQUEST ID AND EMPLOYEE ID ────────────────────────────
  // Endpoint: GET /v1/api/attendance/requests/{id}/{employeeId}
  const handleInspectRequest = async (req: AttendanceRequestModel) => {
    if (!req.id) return;
    try {
      const res = await axios.get(`${BASE_REQUESTS_URL}/${req.id}/${currentEmployeeId}`);
      setViewingRequest(res.data || req);
    } catch {
      setViewingRequest(req);
    }
  };

  // ── API 4: CANCEL REQUEST ──────────────────────────────────────────────
  // Endpoint: PUT /v1/api/attendance/requests/{id}/cancel/{employeeId}
  const handleCancelRequest = async (id: number) => {
    if (!id || !currentEmployeeId) return;
    try {
      await axios.put(`${BASE_REQUESTS_URL}/${id}/cancel/${currentEmployeeId}`);
      ToasterService.success("Attendance request cancelled successfully!");
      fetchMyRequests(currentEmployeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to cancel attendance request.");
    }
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<AttendanceRequestModel>[] = [
    {
      key: 'id',
      label: 'Req ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
          #{row.id || 'NEW'}
        </span>
      )
    },
    {
      key: 'requestType',
      label: 'Request Type',
      sortable: true,
      render: (row) => {
        const detail = row.requestDetails?.[0];
        const type = row.requestType || detail?.requestType || 'GENERAL';
        return (
          <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
            {type.replace(/_/g, ' ')}
          </span>
        );
      }
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (row) => {
        const detail = row.requestDetails?.[0];
        return (
          <span className="text-xs font-mono font-semibold text-slate-700">
            {detail?.fromDate || 'N/A'} to {detail?.toDate || 'N/A'}
          </span>
        );
      }
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
            onClick={() => handleInspectRequest(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Inspect Request"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.id && (row.status === 'PENDING' || !row.status) && (
            <button
              type="button"
              onClick={() => handleCancelRequest(row.id!)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-600 transition-colors"
              title="Cancel Request"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="My Attendance Requests" description="Submit and view attendance requests" />
      <PageBreadcrumb pageTitle="Attendance Requests" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">My Attendance Requests</h2>
              <p className="text-xs text-gray-500">Track and submit work from home, regularization, and duty requests</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Create Request
            </button>
            <button
              type="button"
              onClick={() => fetchMyRequests(currentEmployeeId)}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh List"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={requests}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by request type or status..."
            pageSize={5}
            defaultSortKey="id"
            defaultSortOrder="desc"
          />
        </div>

      </div>

      {/* ── MODAL: CREATE ATTENDANCE REQUEST ──────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">Create Attendance Request</h3>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Request Type *</label>
                <select
                  value={form.requestType}
                  onChange={(e) => setForm(p => ({ ...p, requestType: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  required
                >
                  <option value="WORK_FROM_HOME">WORK FROM HOME</option>
                  <option value="REGULARIZATION">ATTENDANCE REGULARIZATION</option>
                  <option value="ON_DUTY">ON DUTY VISIT</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">From Date *</label>
                  <input
                    type="date"
                    value={form.fromDate}
                    onChange={(e) => setForm(p => ({ ...p, fromDate: e.target.value, shiftDate: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">To Date *</label>
                  <input
                    type="date"
                    value={form.toDate}
                    onChange={(e) => setForm(p => ({ ...p, toDate: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Project Task Name</label>
                <input
                  type="text"
                  value={form.projectTaskName || ''}
                  onChange={(e) => setForm(p => ({ ...p, projectTaskName: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="Attendance Module Development"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason & Remarks</label>
                <textarea
                  rows={2}
                  value={form.remarks || ''}
                  onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value, reason: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                  placeholder="Reason for remote work request..."
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
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

      {/* ── MODAL: VIEW REQUEST DETAILS ───────────────────────────────────── */}
      {viewingRequest && (() => {
        const detail = viewingRequest.requestDetails?.[0] || {} as Partial<RequestDetailItem>;
        const status = (viewingRequest.status || 'PENDING').toUpperCase();
        let statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
        if (status === 'APPROVED') statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'REJECTED') statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === 'CANCELLED') statusBadgeClass = 'bg-gray-100 text-gray-600 border-gray-200';

        const requestTypeLabel = (viewingRequest.requestType || detail.requestType || 'WORK_FROM_HOME').replace(/_/g, ' ');

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100 space-y-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 uppercase">Request Details #{viewingRequest.id || 'N/A'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusBadgeClass}`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-mono">
                      Employee ID: {viewingRequest.employeeId} {viewingRequest.employeeName ? `• ${viewingRequest.employeeName}` : ''}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setViewingRequest(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Request Type */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                    <Tag className="w-3.5 h-3.5 text-cyan-600" /> Request Type
                  </span>
                  <span className="font-bold text-slate-800 uppercase tracking-wide">
                    {requestTypeLabel}
                  </span>
                </div>

                {/* Dates */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-600" /> Date Range
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {detail.fromDate || 'N/A'} {detail.toDate && detail.toDate !== detail.fromDate ? `to ${detail.toDate}` : ''}
                  </span>
                </div>

                {/* Project Task */}
                {(detail.projectTaskName || detail.projectTaskId) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Briefcase className="w-3.5 h-3.5 text-cyan-600" /> Project / Task
                    </span>
                    <span className="font-bold text-slate-800">
                      {detail.projectTaskName || `Task #${detail.projectTaskId}`}
                    </span>
                  </div>
                )}

                {/* Timings */}
                {(detail.checkInTime || detail.checkOutTime) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-600" /> Check In / Out
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      In: {detail.checkInTime ? detail.checkInTime.replace('T', ' ') : 'N/A'}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      Out: {detail.checkOutTime ? detail.checkOutTime.replace('T', ' ') : 'N/A'}
                    </span>
                  </div>
                )}

                {(detail.shiftInTime || detail.shiftOutTime) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-600" /> Shift Timings
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      Shift Start: {detail.shiftInTime ? detail.shiftInTime.replace('T', ' ') : 'N/A'}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      Shift End: {detail.shiftOutTime ? detail.shiftOutTime.replace('T', ' ') : 'N/A'}
                    </span>
                  </div>
                )}

                {/* Client Visit Information */}
                {(detail.clientName || detail.visitLocation || detail.purpose) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2 space-y-1">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-600" /> On Duty Visit Details
                    </span>
                    {detail.clientName && (
                      <p className="text-slate-800 font-semibold text-[11px]">Client: <span className="font-bold">{detail.clientName}</span></p>
                    )}
                    {detail.visitLocation && (
                      <p className="text-slate-800 font-semibold text-[11px]">Location: <span className="font-bold">{detail.visitLocation}</span></p>
                    )}
                    {detail.purpose && (
                      <p className="text-slate-800 font-semibold text-[11px]">Purpose: <span className="font-normal text-slate-700">{detail.purpose}</span></p>
                    )}
                  </div>
                )}

                {/* Reason & Remarks */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-2">
                  <span className="text-slate-500 font-semibold block text-[11px] mb-1">Remarks & Reason:</span>
                  <p className="font-semibold text-slate-800 leading-relaxed text-xs">
                    {detail.remarks || detail.reason || viewingRequest.requestDetails?.[0]?.remarks || 'No remarks provided.'}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingRequest(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default AttendanceRequestsPage;
