import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';
import {
  BarChart3, Calendar, Users, Clock, RotateCw, Plus, X, CheckCircle2, ArrowRight, PieChart, Briefcase,
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import StatsCard from '../../components/common/Statscard';
import { useNavigate } from 'react-router-dom';
import { ToasterService } from '../../Services/ToasterService';
import { usePermissions } from '../../access/usePermissions';
import { useTheme } from '../../context/ThemeContext';
import { apiError, ATTENDANCE_API, fetchLeaveBalances, formatDays, LeaveBalance, leaveTypeLabel } from './attendanceApi';

interface ManagerDashboardModel {
  totalEmployees?: number;
  activeEmployees?: number;
  requestSummary?: { pending?: number; approved?: number; rejected?: number; cancelled?: number };
  employeesOnLeaveToday?: number;
  upcomingLeavesThisWeek?: number;
}

interface AdjustmentModel {
  id: string;
  employeeId: number;
  employeeCode?: string;
  employeeName?: string;
  leaveType: string;
  adjustmentLeaves: number;
  balanceBefore: number;
  balanceAfter: number;
  remarks: string;
  adjustedDate: string;
  adjustedBy?: string;
}

interface EmployeeOption {
  id: number;
  employeeCode?: string;
  name: string;
}

interface TrendPoint {
  label: string;
  casual: number;
  sick: number;
  earned: number;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LeaveManagerDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { canApprove } = usePermissions();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Own employee identity from the login token; the dashboard covers the user's direct reports
  const currentUser = useCurrentEmployee();

  const [dashboard, setDashboard] = useState<ManagerDashboardModel | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentModel[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [pendingQueueCounts, setPendingQueueCounts] = useState({ leave: 0, regularization: 0, onDuty: 0 });
  const [loading, setLoading] = useState(false);

  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ employeeId: 0, leaveType: '', adjustmentLeaves: 1, remarks: '' });
  const [employeeBalances, setEmployeeBalances] = useState<LeaveBalance[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    // The last six months, oldest first
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });

    const [dash, leave, reg, onDuty, adj, emps, ...trendRes] = await Promise.allSettled([
      currentUser.hasEmployee ? axios.get(`${ATTENDANCE_API}/manager-leave-dashboard/${currentUser.id}`) : Promise.reject(),
      axios.get(`${ATTENDANCE_API}/leave-approvals/pending`),
      axios.get(`${ATTENDANCE_API}/regularization/pending`),
      axios.get(`${ATTENDANCE_API}/attendance-approvals/pending`),
      axios.get(`${ATTENDANCE_API}/leave-adjustments`),
      axios.get(`${ATTENDANCE_API}/employees`),
      ...months.map((m) => currentUser.hasEmployee
        ? axios.get(`${ATTENDANCE_API}/leave-requests/dashboard/team-leave-trend/${currentUser.id}`,
          { params: { attendanceMonth: m.month, attendanceYear: m.year } })
        : Promise.reject()),
    ]);

    const len = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' && Array.isArray(r.value.data) ? r.value.data.length : 0);
    setDashboard(dash.status === 'fulfilled' ? dash.value.data : null);
    setPendingQueueCounts({ leave: len(leave), regularization: len(reg), onDuty: len(onDuty) });
    setAdjustments(adj.status === 'fulfilled' && Array.isArray(adj.value.data)
      ? adj.value.data.map((a: any, i: number) => ({ ...a, id: `${a.employeeId}-${a.adjustedDate}-${i}` }))
      : []);
    setEmployees(emps.status === 'fulfilled' && Array.isArray(emps.value.data) ? emps.value.data : []);
    setTrend(months.map((m, i) => {
      const r = trendRes[i];
      const data = r.status === 'fulfilled' ? r.value.data : null;
      return {
        label: `${MONTH_SHORT[m.month - 1]}${m.month === 1 || i === 0 ? ` ${String(m.year).slice(2)}` : ''}`,
        casual: data?.casualLeave ?? 0,
        sick: data?.sickLeave ?? 0,
        earned: data?.earnedLeave ?? 0,
      };
    }));
    setLoading(false);
  }, [currentUser.hasEmployee, currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Leave types the chosen employee has, for the adjustment form
  useEffect(() => {
    if (!isAdjustmentModalOpen || !adjustmentForm.employeeId) {
      setEmployeeBalances([]);
      return;
    }
    fetchLeaveBalances(adjustmentForm.employeeId)
      .then((list) => {
        setEmployeeBalances(list);
        setAdjustmentForm((p) => (list.some((b) => b.leaveType === p.leaveType) ? p : { ...p, leaveType: list[0]?.leaveType ?? '' }));
      })
      .catch(() => setEmployeeBalances([]));
  }, [isAdjustmentModalOpen, adjustmentForm.employeeId]);

  const openAdjustment = () => {
    const first = employees.find((e) => e.id !== currentUser.id);
    setAdjustmentForm({ employeeId: first?.id ?? 0, leaveType: '', adjustmentLeaves: 1, remarks: '' });
    setIsAdjustmentModalOpen(true);
  };

  const handlePostAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentForm.employeeId || !adjustmentForm.leaveType) {
      ToasterService.error('Choose an employee and a leave type.');
      return;
    }
    if (!adjustmentForm.adjustmentLeaves || (adjustmentForm.adjustmentLeaves * 2) % 1 !== 0) {
      ToasterService.error('Adjust by whole or half days, e.g. 1, -2 or 0.5.');
      return;
    }
    if (!adjustmentForm.remarks.trim()) {
      ToasterService.error('Please give a reason for this adjustment.');
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(`${ATTENDANCE_API}/leave-adjustments`, {
        employeeId: adjustmentForm.employeeId,
        leaveType: adjustmentForm.leaveType,
        adjustmentLeaves: Number(adjustmentForm.adjustmentLeaves),
        remarks: adjustmentForm.remarks.trim(),
      });
      ToasterService.success(`Leave balance adjusted by ${formatDays(adjustmentForm.adjustmentLeaves)} day(s).`);
      setIsAdjustmentModalOpen(false);
      loadData();
    } catch (err) {
      ToasterService.error(apiError(err, 'Could not post the adjustment.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const summary = dashboard?.requestSummary ?? {};
  const statusSeries = [summary.pending ?? 0, summary.approved ?? 0, summary.rejected ?? 0, summary.cancelled ?? 0];
  const statusTotal = statusSeries.reduce((a, b) => a + b, 0);
  const selectedBalance = useMemo(
    () => employeeBalances.find((b) => b.leaveType === adjustmentForm.leaveType),
    [employeeBalances, adjustmentForm.leaveType],
  );

  const adjustmentColumns: ColumnDef<AdjustmentModel>[] = [
    {
      key: 'adjustedDate', label: 'Date', sortable: true,
      render: (row) => {
        const d = row.adjustedDate ? new Date(row.adjustedDate) : null;
        return <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {d && !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : row.adjustedDate}
        </span>;
      }
    },
    {
      key: 'employeeName', label: 'Employee', sortable: true,
      render: (row) => (
        <div className="flex flex-col whitespace-nowrap">
          <span className="font-semibold text-gray-900 dark:text-gray-200 text-xs">{row.employeeName || `Employee #${row.employeeId}`}</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{row.employeeCode}</span>
        </div>
      )
    },
    {
      key: 'leaveType', label: 'Leave type', sortable: true,
      render: (row) => (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent whitespace-nowrap">
          {leaveTypeLabel(row.leaveType)}
        </span>
      )
    },
    {
      key: 'adjustmentLeaves', label: 'Change', sortable: true,
      render: (row) => (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${
          row.adjustmentLeaves >= 0
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-emerald-400 dark:border-transparent'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-rose-400 dark:border-transparent'
        }`}>
          {row.adjustmentLeaves >= 0 ? '+' : ''}{formatDays(row.adjustmentLeaves)}d
        </span>
      )
    },
    {
      key: 'balanceAfter', label: 'Balance', sortable: true,
      render: (row) => (
        <span className="font-mono text-xs whitespace-nowrap text-gray-900 dark:text-gray-200">
          {formatDays(row.balanceBefore)} → <strong>{formatDays(row.balanceAfter)}</strong>
        </span>
      )
    },
    {
      key: 'remarks', label: 'Remarks',
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px] block" title={row.remarks}>{row.remarks || '—'}</span>
      )
    },
    { key: 'adjustedBy', label: 'By', render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{row.adjustedBy || '—'}</span> },
  ];

  // Full class names (Tailwind only generates classes it can see written out)
  const TONES = {
    emerald: { card: 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200/80', icon: 'bg-emerald-100 text-emerald-700', badge: 'bg-emerald-600 dark:text-emerald-400', link: 'text-emerald-700' },
    amber: { card: 'bg-amber-50/50 hover:bg-amber-50 border-amber-200/80', icon: 'bg-amber-100 text-amber-700', badge: 'bg-amber-500 dark:text-amber-400', link: 'text-amber-700' },
    cyan: { card: 'bg-cyan-50/50 hover:bg-cyan-50 border-cyan-200/80', icon: 'bg-cyan-100 text-cyan-700', badge: 'bg-cyan-600 dark:text-cyan-400', link: 'text-cyan-700' },
  };

  const queueCard = (path: string, title: string, count: number, text: string, tone: keyof typeof TONES, icon: React.ReactNode) => (
    <div onClick={() => navigate(path)}
      className={`${TONES[tone].card} dark:bg-[#222222] dark:hover:bg-[#262626] rounded-xl p-3.5 border dark:border-transparent transition-all cursor-pointer group flex flex-col justify-between space-y-2 shadow-2xs`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${TONES[tone].icon} dark:bg-[#191919] dark:text-gray-300`}>{icon}</div>
          <span className="font-bold text-xs text-gray-900 dark:text-white">{title}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${TONES[tone].badge} text-white dark:bg-transparent shadow-2xs`}>
          {count} Pending
        </span>
      </div>
      <p className="text-[11px] text-gray-600 dark:text-gray-400">{text}</p>
      <div className={`flex items-center gap-1 text-xs font-bold ${TONES[tone].link} dark:text-gray-300 group-hover:translate-x-0.5 transition-all pt-1`}>
        <span>Open queue</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </div>
  );

  return (
    <div className="p-3 sm:p-4 md:p-5 space-y-4 bg-transparent min-h-screen animate-in fade-in duration-200">
      <PageMeta title="Manager Leave Dashboard | MyTrading" description="Team leave overview and approval queues" />
      <PageBreadcrumb pageTitle="Manager Leave Dashboard" />

      <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-gray-200/80 dark:border-transparent p-3.5 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-[#222222] border border-cyan-100 dark:border-transparent flex items-center justify-center text-cyan-700 dark:text-cyan-400 shadow-2xs font-extrabold text-sm">
            MGR
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white tracking-tight">Manager Leave Dashboard</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {currentUser.hasEmployee ? 'Your direct reports' : 'No employee record is linked to your account, so team figures are empty'} · approval queues cover the whole company
            </p>
          </div>
        </div>
        <button type="button" onClick={loadData} title="Refresh"
          className="p-2 border border-gray-200 dark:border-transparent hover:bg-gray-100 dark:hover:bg-[#222222] rounded-xl text-gray-600 dark:text-gray-300 transition-colors shadow-2xs cursor-pointer">
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard label="Team Members" value={String(dashboard?.totalEmployees ?? 0)} icon={<Users className="w-5 h-5 text-cyan-700" />} />
        <StatsCard label="Pending Approvals" value={String(pendingQueueCounts.leave + pendingQueueCounts.regularization + pendingQueueCounts.onDuty)} icon={<Clock className="w-5 h-5 text-amber-600" />} />
        <StatsCard label="Team On Leave Today" value={String(dashboard?.employeesOnLeaveToday ?? 0)} icon={<Briefcase className="w-5 h-5 text-emerald-600" />} />
        <StatsCard label="Team Leaves Starting This Week" value={String(dashboard?.upcomingLeavesThisWeek ?? 0)} icon={<Calendar className="w-5 h-5 text-purple-600" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        <div className="lg:col-span-5 bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 space-y-2">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
            <PieChart className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Team Leave Requests</h3>
          </div>
          <div className="pt-2">
            {statusTotal === 0 ? (
              <div className="h-[230px] flex items-center justify-center text-xs text-gray-400">No leave requests from your team yet</div>
            ) : (
              <Chart
                type="donut"
                height={230}
                series={statusSeries}
                options={{
                  chart: { type: 'donut', fontFamily: 'inherit', foreColor: isDark ? '#94a3b8' : '#64748b' },
                  labels: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
                  colors: ['#f59e0b', '#10b981', '#f43f5e', '#94a3b8'],
                  theme: { mode: isDark ? 'dark' : 'light' },
                  stroke: { colors: [isDark ? '#191919' : '#ffffff'], width: 2 },
                  legend: { position: 'bottom', fontSize: '11px', fontWeight: 600, labels: { colors: isDark ? '#cbd5e1' : '#475569' } },
                  plotOptions: {
                    pie: {
                      donut: {
                        size: '70%',
                        labels: {
                          show: true,
                          total: { show: true, label: 'Requests', fontSize: '11px', fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', formatter: () => String(statusTotal) },
                          value: { fontSize: '18px', fontWeight: 800, color: isDark ? '#ffffff' : '#0f172a' },
                        },
                      },
                    },
                  },
                  dataLabels: { enabled: true, formatter: (val: any) => `${Math.round(val)}%` },
                }}
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 space-y-2">
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
            <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Team Leave Days, Last 6 Months</h3>
          </div>
          <div className="pt-2">
            <Chart
              type="bar"
              height={230}
              series={[
                { name: 'Casual', data: trend.map((t) => t.casual) },
                { name: 'Sick', data: trend.map((t) => t.sick) },
                { name: 'Earned', data: trend.map((t) => t.earned) },
              ]}
              options={{
                chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit', foreColor: isDark ? '#94a3b8' : '#64748b' },
                theme: { mode: isDark ? 'dark' : 'light' },
                colors: ['#06b6d4', '#10b981', '#6366f1'],
                plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } },
                xaxis: {
                  categories: trend.map((t) => t.label),
                  labels: { style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px', fontWeight: 600 } },
                  axisBorder: { color: isDark ? '#303030' : '#e2e8f0' },
                  axisTicks: { color: isDark ? '#303030' : '#e2e8f0' },
                },
                yaxis: { labels: { style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }, formatter: (v: number) => formatDays(v) } },
                legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600, labels: { colors: isDark ? '#cbd5e1' : '#475569' } },
                grid: { borderColor: isDark ? '#303030' : '#f1f5f9' },
                dataLabels: { enabled: false },
                tooltip: { y: { formatter: (v: number) => `${formatDays(v)} day(s)` } },
              }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-amber-200/80 dark:border-transparent p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-[#2a2a2a] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-[#222222] text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-transparent shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">Pending Approval Queues</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Leave, regularization and on-duty requests waiting for a decision</p>
            </div>
          </div>
          {canApprove && (
            <button type="button" onClick={openAdjustment}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Adjust Leave Balance
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {queueCard('/att_attendanceApproval', 'Leave Approvals', pendingQueueCounts.leave, 'Leave applications', 'emerald', <CheckCircle2 className="w-4 h-4" />)}
          {queueCard('/att_regularizationApproval', 'Regularizations', pendingQueueCounts.regularization, 'Missed or wrong punches', 'amber', <Clock className="w-4 h-4" />)}
          {queueCard('/att_onDutyApproval', 'On-Duty & WFH', pendingQueueCounts.onDuty, 'Client visits and work-from-home days', 'cyan', <Briefcase className="w-4 h-4" />)}
        </div>
      </div>

      <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-100 dark:!border-transparent pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Leave Adjustments Log</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Manual changes to leave balances, newest first</p>
          </div>
          <TableToolbar onRefresh={loadData} />
        </div>
        <ReusableTable
          data={adjustments}
          columns={adjustmentColumns}
          loading={loading}
          pageSize={5}
          defaultSortKey="adjustedDate"
          defaultSortOrder="desc"
          emptyState={<p className="text-xs text-slate-400 dark:text-gray-500 py-6 text-center">No adjustments yet.</p>}
        />
      </div>

      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-xl border border-gray-200 dark:border-[#303030] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <div className="p-4 bg-cyan-600 !text-white flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2 !text-white">
                <Plus className="w-4 h-4" />
                <span>Adjust Leave Balance</span>
              </h3>
              <button type="button" onClick={() => setIsAdjustmentModalOpen(false)} className="p-1 rounded-lg !text-white hover:bg-white/15 transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostAdjustment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Employee</label>
                <select
                  value={adjustmentForm.employeeId || ''}
                  onChange={(e) => setAdjustmentForm((p) => ({ ...p, employeeId: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#222222] border border-gray-300 dark:border-[#303030] rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                >
                  <option value="" disabled>Choose an employee</option>
                  {employees.filter((e) => e.id !== currentUser.id).map((e) => (
                    <option key={e.id} value={e.id} className="dark:bg-[#222222]">{e.name}{e.employeeCode ? ` (${e.employeeCode})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Leave type</label>
                  <select
                    value={adjustmentForm.leaveType}
                    onChange={(e) => setAdjustmentForm((p) => ({ ...p, leaveType: e.target.value }))}
                    disabled={employeeBalances.length === 0}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#222222] border border-gray-300 dark:border-[#303030] rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer disabled:opacity-50"
                  >
                    {employeeBalances.length === 0 && <option value="">No leave policy</option>}
                    {employeeBalances.map((b) => (
                      <option key={b.id} value={b.leaveType} className="dark:bg-[#222222]">{leaveTypeLabel(b.leaveType)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Days (+ or -)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={adjustmentForm.adjustmentLeaves}
                    onChange={(e) => setAdjustmentForm((p) => ({ ...p, adjustmentLeaves: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#222222] border border-gray-300 dark:border-[#303030] rounded-xl text-xs font-mono font-bold text-gray-900 dark:text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    placeholder="e.g. 2 or -1"
                  />
                </div>
              </div>

              {selectedBalance && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Available now: <strong>{formatDays(selectedBalance.availableLeaves)}</strong> day(s) →
                  after: <strong>{formatDays(selectedBalance.availableLeaves + Number(adjustmentForm.adjustmentLeaves || 0))}</strong>
                </p>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Reason</label>
                <textarea
                  rows={3}
                  value={adjustmentForm.remarks}
                  maxLength={1000}
                  onChange={(e) => setAdjustmentForm((p) => ({ ...p, remarks: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#222222] border border-gray-300 dark:border-[#303030] rounded-xl text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                  placeholder="e.g. Compensatory off for working on 12 Oct"
                  required
                />
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-[#303030] flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-[#303030] rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222222] transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || !adjustmentForm.leaveType}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition-all cursor-pointer">
                  {isSubmitting ? 'Posting...' : 'Adjust Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveManagerDashboardPage;
