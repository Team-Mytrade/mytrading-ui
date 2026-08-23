import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Laptop, Plus, RotateCw, Eye, XCircle, X, CheckCircle2, Calendar
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base Endpoint (routing via Vite dev proxy)
const BASE_REQUESTS_URL = '/v1/api/attendance/requests';

export interface AttendanceRequestModel {
  id?: number;
  employeeId: number;
  employeeName?: string;
  requestType?: string;
  status?: string;
  requestDetails: Array<{
    fromDate: string;
    toDate: string;
    remarks?: string;
    requestType: string;
    reason?: string;
  }>;
}

const WorkFromHomeRequestPage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<AttendanceRequestModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number>(12);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<AttendanceRequestModel | null>(null);

  // Form State
  const [form, setForm] = useState({
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    projectTaskName: "Attendance Module Development",
    remarks: "Working from home due to internet installation.",
    reason: "Need to work remotely."
  });

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1: GET MY WFH REQUESTS ─────────────────────────────────────────
  // Endpoint: GET /v1/api/attendance/requests/my/{employeeId}
  const fetchMyWfhRequests = async (empId: number) => {
    if (!empId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_REQUESTS_URL}/my/${empId}`);
      if (Array.isArray(res.data)) {
        // Filter WFH requests
        const wfhList = res.data.filter((r: any) => 
          r.requestType === 'WORK_FROM_HOME' || 
          r.requestDetails?.[0]?.requestType === 'WORK_FROM_HOME'
        );
        setRequests(wfhList.length > 0 ? wfhList : res.data);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.warn("Failed to load WFH requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyWfhRequests(currentEmployeeId);
  }, [currentEmployeeId]);

  // ── API 2: CREATE WFH REQUEST ──────────────────────────────────────────
  // Endpoint: POST /v1/api/attendance/requests
  const handleCreateWfhRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fromDate || !form.toDate) {
      ToasterService.error("Please select from and to dates.");
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
            checkInTime: `${form.fromDate}T09:00:00`,
            checkOutTime: `${form.toDate}T18:30:00`,
            shiftInTime: `${form.fromDate}T09:00:00`,
            shiftOutTime: `${form.toDate}T18:00:00`,
            projectTaskId: 5001,
            projectTaskName: form.projectTaskName || "Attendance Module Development",
            remarks: form.remarks || "Working from home due to internet installation.",
            clientName: null,
            visitLocation: null,
            purpose: null,
            requestType: "WORK_FROM_HOME",
            reason: form.reason || "Need to work remotely."
          }
        ]
      };

      await axios.post(BASE_REQUESTS_URL, payload);
      ToasterService.success("Work From Home request submitted successfully!");
      setIsCreateModalOpen(false);
      fetchMyWfhRequests(currentEmployeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to submit WFH request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── API 3: CANCEL WFH REQUEST ──────────────────────────────────────────
  // Endpoint: PUT /v1/api/attendance/requests/{id}/cancel/{employeeId}
  const handleCancelWfhRequest = async (id: number) => {
    if (!id || !currentEmployeeId) return;
    try {
      await axios.put(`${BASE_REQUESTS_URL}/${id}/cancel/${currentEmployeeId}`);
      ToasterService.success("WFH request cancelled successfully!");
      fetchMyWfhRequests(currentEmployeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to cancel WFH request.");
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
      key: 'dates',
      label: 'WFH Date Range',
      render: (row) => {
        const detail = row.requestDetails?.[0];
        return (
          <span className="text-xs font-mono font-semibold text-slate-700">
            {detail?.fromDate || 'N/A'} <span className="text-gray-400">to</span> {detail?.toDate || 'N/A'}
          </span>
        );
      }
    },
    {
      key: 'remarks',
      label: 'Remarks',
      render: (row) => (
        <span className="text-xs text-slate-600 truncate max-w-xs block">
          {row.requestDetails?.[0]?.remarks || 'Working from home remotely.'}
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
            onClick={() => setViewingRequest(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Inspect WFH Request"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.id && (row.status === 'PENDING' || !row.status) && (
            <button
              type="button"
              onClick={() => handleCancelWfhRequest(row.id!)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-600 transition-colors"
              title="Cancel WFH Request"
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
      <PageMeta title="Work From Home Request" description="Apply and view WFH requests" />
      <PageBreadcrumb pageTitle="Work From Home Request" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Work From Home Requests</h2>
              <p className="text-xs text-gray-500">Submit WFH dates for manager approval</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Apply WFH
            </button>
            <button
              type="button"
              onClick={() => fetchMyWfhRequests(currentEmployeeId)}
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
            searchPlaceholder="Search by dates or status..."
            pageSize={5}
            defaultSortKey="id"
            defaultSortOrder="desc"
          />
        </div>

      </div>

      {/* ── MODAL: APPLY WFH ──────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">Apply Work From Home</h3>
              </div>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWfhRequest} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">From Date *</label>
                  <input
                    type="date"
                    value={form.fromDate}
                    onChange={(e) => setForm(p => ({ ...p, fromDate: e.target.value }))}
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
                  value={form.projectTaskName}
                  onChange={(e) => setForm(p => ({ ...p, projectTaskName: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="Attendance Module Development"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Remarks & Reason</label>
                <textarea
                  rows={2}
                  value={form.remarks}
                  onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value, reason: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                  placeholder="Working from home due to internet installation..."
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
                  {isSubmitting ? "Submitting..." : "Submit WFH Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW WFH DETAILS ───────────────────────────────────────── */}
      {viewingRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Laptop className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">WFH Request #{viewingRequest.id}</h3>
              </div>
              <button type="button" onClick={() => setViewingRequest(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200/80">
                <span className="text-slate-500 font-semibold block text-[11px]">WFH Remarks:</span>
                <span className="font-bold text-slate-800">{viewingRequest.requestDetails?.[0]?.remarks || 'Working remotely.'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WorkFromHomeRequestPage;
