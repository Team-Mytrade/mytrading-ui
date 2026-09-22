import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { 
  CheckCircle2, XCircle, Clock, RotateCw, Eye, X, Check, ShieldCheck, Plus, AlertCircle, Ban
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
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
  [key: string]: any;
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
  const [employeeMap, setEmployeeMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    axios.get('/v1/api/payroll/employee/all')
      .then(res => {
        if (Array.isArray(res.data)) {
          const map: Record<number, string> = {};
          res.data.forEach((e: any) => {
            const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.fullName;
            if (e.id && name) {
              map[Number(e.id)] = name;
            }
          });
          setEmployeeMap(map);
        }
      })
      .catch(() => {});
  }, []);

  // Modals & Action States
  const [selectedRequest, setSelectedRequest] = useState<RegularizationItemModel | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'cancel' | 'view' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1: GET REGULARIZATIONS (BY ACTIVE TAB) ──────────────────────────
  const fetchRegularizations = async (tab: 'pending' | 'approved' | 'rejected') => {
    setLoading(true);
    try {
      // 1. Try tab-specific endpoint
      let res = await axios.get(`${REGULARIZATION_BASE_URL}/${tab}`).catch(() => null);

      // 2. If tab-specific endpoint failed or wasn't array, try base endpoint
      if (!res || !Array.isArray(res.data)) {
        res = await axios.get(REGULARIZATION_BASE_URL).catch(() => null);
      }

      if (res && Array.isArray(res.data)) {
        const filtered = res.data.filter((item: any) => {
          const s = (item.status || 'PENDING').toUpperCase();
          return s === tab.toUpperCase();
        });

        if (tab === 'pending' && filtered.length === 0 && res.data.length > 0 && !res.data[0].status) {
          setRequests(res.data);
        } else {
          setRequests(filtered);
        }
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.warn(`Failed to fetch ${tab} regularizations:`, err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegularizations(activeTab);
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
      fetchRegularizations(activeTab);
    } catch (err: any) {
      handleApiError(err, `Failed to process ${actionType} action.`);
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

  // ── Normalized Data for Clean Display & Drawer ──────────────────────────
  const normalizedRequests = useMemo(() => {
    return requests.map((req, index) => {
      const id = req.id || index + 1;
      const empName = req.employeeName || (req.employeeId ? employeeMap[req.employeeId] : null) || 'Employee';
      const empLabel = empName;

      const inTime = formatTimeStr(req.requestedInTime);
      const outTime = formatTimeStr(req.requestedOutTime);
      const timingsStr = (inTime !== 'N/A' || outTime !== 'N/A') ? `${inTime} - ${outTime}` : 'N/A';

      const formatDate = (dStr?: string) => {
        if (!dStr) return '';
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? dStr : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      const appliedOnStr = req.createdDate ? formatDate(req.createdDate) : undefined;
      const statusStr = (req.status || 'PENDING').toUpperCase();

      // Enumerable properties visible in Table & drawer:
      // First 4 columns: id, employee, attendanceDate, status -> top 4 summary metric cards
      const rowItem: Record<string, any> = {
        id: Number(id) || 1,
        employee: empLabel,
        attendanceDate: req.attendanceDate,
        status: statusStr,
        requestedTiming: timingsStr,
        reason: req.reason || 'Forgot punch in/out',
      };

      if (appliedOnStr) {
        rowItem.appliedOn = appliedOnStr;
      }

      if (req.rejectionReason) {
        rowItem.rejectionReason = req.rejectionReason;
      }

      // Non-enumerable properties: accessible by code, modals, and actions
      Object.defineProperties(rowItem, {
        _raw: { value: req, enumerable: false, writable: true },
        employeeId: { value: req.employeeId || 12, enumerable: false, writable: true },
        employeeName: { value: empName, enumerable: false, writable: true },
        requestedInTime: { value: req.requestedInTime, enumerable: false, writable: true },
        requestedOutTime: { value: req.requestedOutTime, enumerable: false, writable: true },
        createdDate: { value: req.createdDate, enumerable: false, writable: true },
        updatedDate: { value: req.updatedDate, enumerable: false, writable: true },
      });

      return rowItem as RegularizationItemModel;
    });
  }, [requests, employeeMap]);

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<RegularizationItemModel>[] = [
    {
      key: 'id',
      label: 'Req ID',
      sortable: true,
      headerClassName: 'w-[7%] min-w-[55px]',
      className: 'whitespace-nowrap font-mono font-bold text-xs text-cyan-700 dark:text-gray-300',
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 dark:text-gray-300 bg-cyan-50 dark:bg-transparent px-1.5 py-0.5 rounded border border-cyan-200 dark:border-transparent">
          #{row.id}
        </span>
      )
    },
    {
      key: 'employee',
      label: 'Employee',
      sortable: true,
      headerClassName: 'w-[18%] min-w-[130px]',
      className: 'whitespace-nowrap',
      sortValueGetter: (row) => row.employeeName || String(row.employee || ''),
      render: (row) => (
        <div className="min-w-0">
          <span className="font-bold text-xs text-gray-900 dark:text-white block truncate">
            {row.employeeName || (row.employeeId ? employeeMap[row.employeeId] : null) || 'Employee'}
          </span>
        </div>
      )
    },
    {
      key: 'attendanceDate',
      label: 'Date',
      sortable: true,
      headerClassName: 'w-[12%] min-w-[95px]',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-xs font-mono font-semibold text-slate-800 dark:text-gray-300 whitespace-nowrap">
          {row.attendanceDate}
        </span>
      )
    },
    {
      key: 'requestedTiming',
      label: 'Requested In / Out',
      headerClassName: 'w-[20%] min-w-[160px]',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="text-[11px] font-mono font-semibold text-slate-800 dark:text-gray-300 flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-emerald-700 dark:text-gray-300 bg-emerald-50 dark:bg-transparent px-1.5 py-0.5 rounded border border-emerald-200 dark:border-transparent">
            {formatTimeStr(row.requestedInTime)}
          </span>
          <span className="text-gray-400 dark:text-gray-600">-</span>
          <span className="text-rose-700 dark:text-gray-300 bg-rose-50 dark:bg-transparent px-1.5 py-0.5 rounded border border-rose-200 dark:border-transparent">
            {formatTimeStr(row.requestedOutTime)}
          </span>
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Reason',
      headerClassName: 'w-[17%] min-w-[120px]',
      render: (row) => (
        <span className="inline-block px-2 py-0.5 bg-cyan-50 dark:bg-transparent text-cyan-800 dark:text-gray-300 rounded text-xs font-normal truncate max-w-full" title={row.reason}>
          {row.reason || 'Forgot punch in/out'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      headerClassName: 'w-[10%] min-w-[85px] text-center',
      className: 'whitespace-nowrap text-center',
      render: (row) => {
        const status = (row.status || 'PENDING').toUpperCase();
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
        if (status === 'CANCELLED') {
          colorClass = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent';
          dotClass = 'bg-gray-400';
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${colorClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            {status}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: 'w-[16%] min-w-[175px] !pr-10 whitespace-nowrap',
      className: 'whitespace-nowrap text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {activeTab === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => openActionModal(row._raw || row, 'approve')}
                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                title="Approve Request"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              
              <button
                type="button"
                onClick={() => openActionModal(row._raw || row, 'reject')}
                className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-600 dark:text-rose-300 transition-colors cursor-pointer"
                title="Reject Request"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => openActionModal(row._raw || row, 'view')}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-gray-200 dark:border-[#303030] rounded-lg text-gray-600 dark:text-gray-300 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors cursor-pointer"
            title="Inspect Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          
          {activeTab === 'pending' && (
            <button
              type="button"
              onClick={() => openActionModal(row._raw || row, 'cancel')}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#222222] border border-transparent hover:border-gray-200 dark:hover:border-[#303030] rounded-lg transition-colors cursor-pointer"
              title="Cancel Request"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Attendance Regularization" description="Manage and approve employee attendance regularization requests" />
      <PageBreadcrumb pageTitle="Attendance Regularization" />

      <div className="w-full pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 dark:bg-[#222222] text-cyan-700 dark:text-cyan-400 rounded-lg border border-cyan-200 dark:border-transparent">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Attendance Regularization Desk</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Review and approve employee missed punch regularizations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchRegularizations(activeTab)}
              className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-transparent rounded-lg transition-all"
              title="Refresh Queue"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-gray-200/80 dark:border-[#2a2a2a] pb-2">
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
              {tab} Regularizations
            </button>
          ))}
        </div>

        {/* Regularization Data Table */}
        <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {activeTab} Regularizations
            </h3>
            <TableToolbar onRefresh={() => fetchRegularizations(activeTab)} />
          </div>
          <ReusableTable
            className="[&_th]:!px-2 [&_td]:!px-2 [&_th]:!py-2.5 [&_td]:!py-2"
            data={normalizedRequests}
            columns={columns}
            loading={loading}
            pageSize={10}
            defaultSortKey="id"
            defaultSortOrder="desc"
            rowDetailsTitle={(row) => `Regularization Request #${row.id}`}
            rowDetailsSubtitle="Missed punch regularization review and approval details"
          />
        </div>

      </div>

      {/* ── MODAL: ACTION (APPROVE / REJECT / CANCEL / VIEW) ───────────── */}
      {selectedRequest && actionType && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 dark:border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                  {actionType === 'view' ? `Regularization #${selectedRequest.id}` : `${actionType.toUpperCase()} Regularization #${selectedRequest.id}`}
                </h3>
              </div>
              <button type="button" onClick={() => setActionType(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionType === 'view' ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/80 dark:border-[#303030]">
                  <div>
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">EMPLOYEE</span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {selectedRequest.employeeName || (selectedRequest.employeeId ? employeeMap[selectedRequest.employeeId] : null) || 'Employee'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">STATUS</span>
                    <span className={`font-bold inline-block px-2 py-0.5 rounded text-[10px] ${
                      selectedRequest.status === 'APPROVED' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300' :
                      selectedRequest.status === 'REJECTED' ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                    }`}>
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/80 dark:border-[#303030] space-y-2 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                    <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Attendance Date:</span>
                    <span className="font-bold text-slate-800 dark:text-white">{selectedRequest.attendanceDate}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                    <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Requested Check-In:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatTimeStr(selectedRequest.requestedInTime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Requested Check-Out:</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400">{formatTimeStr(selectedRequest.requestedOutTime)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:border-[#303030] space-y-1">
                  <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">REASON / REMARKS</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedRequest.reason || 'Forgot punch in/out due to on site visit.'}
                  </p>
                </div>

                {selectedRequest.rejectionReason && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1">
                    <span className="text-rose-500 dark:text-rose-400 font-semibold block text-[10px] uppercase tracking-wider">REJECTION REASON</span>
                    <p className="font-semibold text-rose-800 dark:text-rose-300">{selectedRequest.rejectionReason}</p>
                  </div>
                )}

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
                {actionType === 'reject' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Rejection Reason *</label>
                    <textarea
                      rows={3}
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#303030] rounded-md text-xs text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                      placeholder="e.g. Not approved by manager"
                      required
                    />
                  </div>
                )}

                {actionType === 'approve' && (
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Are you sure you want to approve regularization request <b>#{selectedRequest.id}</b> for date <b>{selectedRequest.attendanceDate}</b>?
                  </p>
                )}

                {actionType === 'cancel' && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    Are you sure you want to cancel regularization request <b>#{selectedRequest.id}</b>?
                  </p>
                )}

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
