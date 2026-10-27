import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Check, Eye, X } from 'lucide-react';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';
import { usePermissions } from '../../access/usePermissions';
import { useCurrentEmployee } from '../../access/useCurrentEmployee';
import { apiError, ATTENDANCE_API, formatDays, leaveTypeLabel, timeOf } from './attendanceApi';

/**
 * One approval desk for leave, regularization and on-duty / work-from-home requests. Each kind has its
 * own endpoints; ids are never shared between kinds.
 */
export type ApprovalKind = 'leave' | 'regularization' | 'request';
type Tab = 'pending' | 'approved' | 'rejected';

export interface ApprovalRow {
  id: number;
  employeeId: number;
  employee: string;
  employeeCode: string;
  type: string;
  dates: string;
  days?: string;
  reason: string;
  status: string;
  details: string[];
  decidedBy?: string;
  decidedOn?: string;
  remarks?: string;
}

const REQUEST_TYPE_LABEL: Record<string, string> = { ON_DUTY: 'On duty', WORK_FROM_HOME: 'Work from home' };

const range = (from?: string, to?: string) => (from ? `${from}${to && to !== from ? ` → ${to}` : ''}` : '—');
const dateOnly = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);

const CONFIG: Record<ApprovalKind, {
  list: (tab: Tab) => string;
  act: (id: number, action: 'approve' | 'reject') => string;
  body: (action: 'approve' | 'reject', remarks: string) => unknown;
  toRows: (data: any[]) => ApprovalRow[];
}> = {
  leave: {
    list: (tab) => `${ATTENDANCE_API}/leave-approvals/${tab}`,
    act: (id, action) => `${ATTENDANCE_API}/leave-approvals/${id}/${action}`,
    body: (_action, remarks) => ({ remarks }),
    toRows: (data) => data.map((l) => ({
      id: l.id,
      employeeId: l.employeeId,
      employee: l.employeeName || `Employee #${l.employeeId}`,
      employeeCode: l.employeeCode || '',
      type: `${leaveTypeLabel(l.leaveType)} leave${l.halfDay ? ` (${l.halfDaySession === 'SECOND_HALF' ? 'second' : 'first'} half)` : ''}`,
      dates: range(l.fromDate, l.toDate),
      days: `${formatDays(l.totalDays)} day(s)`,
      reason: l.reason || '',
      status: l.approvalStatus,
      details: [],
      decidedBy: l.actionBy || undefined,
      decidedOn: dateOnly(l.actionDate),
      remarks: l.approverRemarks || undefined,
    })),
  },
  regularization: {
    list: (tab) => `${ATTENDANCE_API}/regularization/${tab}`,
    act: (id, action) => `${ATTENDANCE_API}/regularization/${id}/${action}`,
    body: (action, remarks) => (action === 'reject' ? { reason: remarks } : undefined),
    toRows: (data) => data.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employee: r.employeeName || `Employee #${r.employeeId}`,
      employeeCode: r.employeeCode || '',
      type: 'Regularization',
      dates: r.attendanceDate,
      reason: r.reason || '',
      status: r.status,
      details: [`Correct check-in: ${timeOf(r.requestedInTime) || 'unchanged'}`, `Correct check-out: ${timeOf(r.requestedOutTime) || 'unchanged'}`],
      decidedBy: r.actionBy || undefined,
      decidedOn: dateOnly(r.actionDate),
      remarks: r.rejectionReason || undefined,
    })),
  },
  request: {
    list: (tab) => `${ATTENDANCE_API}/attendance-approvals/${tab}`,
    act: (id, action) => `${ATTENDANCE_API}/attendance-approvals/${id}/${action}`,
    body: (_action, remarks) => ({ remarks, approveAll: true }),
    toRows: (data) => data.map((r) => {
      // One detail per day (each with its own shift and working times); the visit / work notes are shared
      const details: any[] = (Array.isArray(r.responseDetails) ? [...r.responseDetails] : [])
        .sort((a, b) => String(a.fromDate).localeCompare(String(b.fromDate)));
      const first = details[0] || {};
      const shared = [
        first.clientName && `Client: ${first.clientName}`,
        first.visitLocation && `Location: ${first.visitLocation}`,
        first.purpose && `Purpose: ${first.purpose}`,
        first.projectTaskName && `Work: ${first.projectTaskName}`,
      ].filter(Boolean) as string[];
      const perDay = details
        .filter((d) => d.checkInTime || d.shiftInTime)
        .map((d) => `${String(d.fromDate).split('-').reverse().join('/')}: work ${timeOf(d.checkInTime) || '—'}–${timeOf(d.checkOutTime) || '—'} (shift ${timeOf(d.shiftInTime) || '—'}–${timeOf(d.shiftOutTime) || '—'})`);
      return {
        id: r.id,
        employeeId: r.employeeId,
        employee: r.employeeName || `Employee #${r.employeeId}`,
        employeeCode: r.employeeCode || '',
        type: REQUEST_TYPE_LABEL[first.requestType] || first.requestType || 'Request',
        dates: `${range(first.fromDate, details[details.length - 1]?.toDate)}${details.length > 1 ? ` (${details.length} days)` : ''}`,
        reason: first.reason || '',
        status: r.overallStatus,
        details: [...shared, ...perDay],
        decidedOn: dateOnly(r.actionDate),
        remarks: r.approverRemarks || undefined,
      };
    }),
  },
};

const statusClass = (status: string) =>
  status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent'
  : status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent'
  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';

interface ApprovalDeskProps {
  kind: ApprovalKind;
  /** Tells the parent the pending count changed (e.g. for a badge). */
  onChanged?: () => void;
}

const ApprovalDesk: React.FC<ApprovalDeskProps> = ({ kind, onChanged }) => {
  const { canApprove } = usePermissions();
  const currentUser = useCurrentEmployee();
  const config = CONFIG[kind];

  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ApprovalRow | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async (tab: Tab, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await axios.get(config.list(tab), { signal });
      setRows(config.toRows(Array.isArray(res.data) ? res.data : []));
    } catch (err: any) {
      if (axios.isCancel(err)) return;
      setRows([]);
      ToasterService.error(apiError(err, 'Could not load the requests.'));
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    const controller = new AbortController();
    load(activeTab, controller.signal);
    return () => controller.abort();
  }, [activeTab, load]);

  const open = (row: ApprovalRow, type: 'approve' | 'reject' | 'view') => {
    setSelected(row);
    setAction(type);
    setRemarks('');
  };

  const close = () => {
    setSelected(null);
    setAction(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || (action !== 'approve' && action !== 'reject')) return;
    if (action === 'reject' && !remarks.trim()) {
      ToasterService.error('Give a reason for rejecting.');
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.put(config.act(selected.id, action), config.body(action, remarks.trim()));
      ToasterService.success(`${selected.type} of ${selected.employee} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      close();
      load(activeTab);
      onChanged?.();
    } catch (err) {
      ToasterService.error(apiError(err, `Could not ${action} the request.`));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOwn = (row: ApprovalRow) => currentUser.hasEmployee && row.employeeId === currentUser.id;

  const columns: ColumnDef<ApprovalRow>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 dark:text-gray-300 bg-cyan-50 dark:bg-transparent px-2 py-0.5 rounded border border-cyan-200 dark:border-transparent">#{row.id}</span>
      ),
    },
    {
      key: 'employee',
      label: 'Employee',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 dark:text-white block">{row.employee}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{row.employeeCode}</span>
        </div>
      ),
    },
    { key: 'type', label: 'Type', sortable: true, render: (row) => <span className="font-bold text-xs text-slate-800 dark:text-gray-300">{row.type}</span> },
    {
      key: 'dates',
      label: 'Dates',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono text-slate-700 dark:text-gray-300 whitespace-nowrap">
          {row.dates}{row.days && <span className="text-slate-400 dark:text-gray-500"> · {row.days}</span>}
        </span>
      ),
    },
    { key: 'reason', label: 'Reason', render: (row) => <span className="text-xs text-slate-600 dark:text-gray-400 max-w-[220px] truncate block" title={row.reason}>{row.reason || '—'}</span> },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <span title={row.remarks} className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${statusClass(row.status)}`}>
          {String(row.status || '').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button type="button" onClick={() => open(row, 'view')} title="View"
            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-gray-200 dark:border-[#303030] rounded-lg text-gray-600 dark:text-gray-300 transition-colors cursor-pointer">
            <Eye className="w-3.5 h-3.5" />
          </button>
          {activeTab === 'pending' && canApprove && (
            isOwn(row) ? (
              <span className="text-[10px] text-slate-400 dark:text-gray-500">Your own request</span>
            ) : (
              <>
                <button type="button" onClick={() => open(row, 'approve')} title="Approve"
                  className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => open(row, 'reject')} title="Reject"
                  className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-600 dark:text-rose-300 transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-200/80 dark:border-[#2a2a2a] pb-2">
        {(['pending', 'approved', 'rejected'] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              activeTab === tab
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#191919] text-gray-600 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-[#222222] border border-gray-200/80 dark:border-transparent'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{activeTab}</h3>
            <TableToolbar onRefresh={() => load(activeTab)} />
          </div>
          <ReusableTable
            data={rows}
            columns={columns}
            loading={loading}
            pageSize={10}
            defaultSortKey="id"
            defaultSortOrder={activeTab === 'pending' ? 'asc' : 'desc'}
            enableRowDetails={false}
            emptyState={<p className="text-xs text-slate-400 dark:text-gray-500 py-6 text-center">No {activeTab} requests.</p>}
          />
        </div>
      </div>

      {selected && action && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#191919] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 dark:border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-[#2a2a2a]">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {action === 'view' ? `${selected.type} #${selected.id}` : `${action === 'approve' ? 'Approve' : 'Reject'} ${selected.type.toLowerCase()} #${selected.id}`}
              </h3>
              <button type="button" onClick={close} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/80 dark:border-[#303030] text-xs">
              <div>
                <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Employee</span>
                <span className="font-bold">{selected.employee}</span>
                <span className="block text-[10px] font-mono text-slate-500">{selected.employeeCode}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Dates</span>
                <span className="font-bold font-mono">{selected.dates}</span>
                {selected.days && <span className="block text-[10px] text-slate-500">{selected.days}</span>}
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Reason</span>
                <span>{selected.reason || '—'}</span>
              </div>
              {selected.details.length > 0 && (
                <div className="col-span-2 space-y-0.5">
                  {selected.details.map((d) => <div key={d}>{d}</div>)}
                </div>
              )}
              {(selected.decidedBy || selected.decidedOn || selected.remarks) && (
                <div className="col-span-2 border-t border-slate-200/60 dark:border-[#303030] pt-2">
                  <span className="text-slate-400 dark:text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Decision</span>
                  <span>{[selected.status, selected.decidedBy && `by ${selected.decidedBy}`, selected.decidedOn && `on ${selected.decidedOn}`].filter(Boolean).join(' ')}</span>
                  {selected.remarks && <span className="block text-slate-600 dark:text-gray-300">“{selected.remarks}”</span>}
                </div>
              )}
            </div>

            {action === 'view' ? (
              <div className="flex justify-end">
                <button type="button" onClick={close}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold cursor-pointer">
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {action === 'reject' ? 'Reason for rejecting *' : 'Remarks (optional)'}
                  </label>
                  <textarea rows={3} value={remarks} maxLength={1000} onChange={(e) => setRemarks(e.target.value)}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#303030] rounded-md text-xs text-gray-800 dark:text-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                    placeholder={action === 'reject' ? 'Tell the employee why' : 'Anything the employee should know'}
                    required={action === 'reject'} />
                </div>
                <div className="pt-3 border-t border-gray-100 dark:border-[#2a2a2a] flex items-center justify-end gap-2">
                  <button type="button" onClick={close}
                    className="px-4 py-2 border border-gray-200 dark:border-transparent bg-white dark:bg-[#222222] rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting}
                    className={`px-5 py-2 text-white rounded-lg text-xs font-bold disabled:opacity-70 cursor-pointer ${action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    {isSubmitting ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalDesk;
