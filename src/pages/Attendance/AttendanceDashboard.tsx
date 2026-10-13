import React, { useContext, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Calendar,
  AlertTriangle,
  Clock,
  FileText,
  Home,
  TrendingUp,
  UserCircle,
  Fingerprint,
  ClipboardCheck,
  Briefcase,
  CalendarClock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AuthContext } from "../../context/AuthContext";
import { canAccessPath, hasPermission } from "../../access/access";
import {
  CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  formatDate, formatNumber, getList, isoDate, titleCase, useDashboardSources, type DashboardTile,
} from "../Dashboard/dashboardKit";

// Live attendance overview built from the attendance service. Day figures are tenant-wide.

interface DayStats {
  attendanceDate?: string;
  totalEmployees?: number;
  present?: number;
  absent?: number;
  leave?: number;
  lateCheckIn?: number;
  attendancePercentage?: number;
}

interface LeaveSummary {
  pending?: number;
  approved?: number;
  rejected?: number;
  onLeaveToday?: number;
}

interface LeaveRequest {
  id: number;
  employeeName?: string;
  employeeCode?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
  totalDays?: number;
  halfDay?: boolean;
  submittedDate?: string;
}

interface AttendanceRequest {
  id: number;
  responseDetails?: { requestType?: string }[];
}

const ATTENDANCE = "/v1/api/attendance";
const dayStats = async (date: Date): Promise<DayStats> =>
  (await axios.get(`${ATTENDANCE}/dashboard`, { params: { attendanceDate: isoDate(date) } })).data ?? {};

const SOURCES = {
  today: () => dayStats(new Date()),
  // The six days before today; a day that fails to load is left out of the chart
  week: async () => {
    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const results = await Promise.allSettled(days.map(dayStats));
    return results.flatMap((r, i) => (r.status === "fulfilled" ? [{ ...r.value, attendanceDate: isoDate(days[i]) }] : []));
  },
  leaveSummary: async (): Promise<LeaveSummary> => (await axios.get(`${ATTENDANCE}/leave-dashboard/status-summary`)).data ?? {},
  pendingLeaves: () => getList<LeaveRequest>(`${ATTENDANCE}/leave-approvals/pending`),
  pendingRequests: () => getList<AttendanceRequest>(`${ATTENDANCE}/attendance-approvals/pending`),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  today: "today's attendance",
  week: "last week's attendance",
  leaveSummary: "leave summary",
  pendingLeaves: "pending leave requests",
  pendingRequests: "pending attendance requests",
};

const dayLabel = (iso?: string) => {
  const [y, m, d] = String(iso ?? "").split("-").map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "2-digit" }) : "—";
};

const AttendanceDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const { loading, data, failed } = useDashboardSources(SOURCES, LABELS);

  const today = data.today as DayStats | undefined;
  const summary = data.leaveSummary as LeaveSummary | undefined;
  const pendingLeaves = (data.pendingLeaves as LeaveRequest[] | undefined) ?? [];
  const pendingRequests = (data.pendingRequests as AttendanceRequest[] | undefined) ?? [];

  const trend = useMemo(() => {
    const week = (data.week as DayStats[] | undefined) ?? [];
    const days = today ? [...week, { ...today, attendanceDate: isoDate(new Date()) }] : week;
    return days.map((d) => ({
      day: dayLabel(d.attendanceDate),
      present: Number(d.present) || 0,
      absent: Number(d.absent) || 0,
      late: Number(d.lateCheckIn) || 0,
    }));
  }, [data.week, today]);
  const hasTrendData = trend.some((d) => d.present || d.absent || d.late);

  const leaveChart = summary ? [
    { name: "Pending", count: Number(summary.pending) || 0, color: "#f59e0b" },
    { name: "Approved", count: Number(summary.approved) || 0, color: "#10b981" },
    { name: "Rejected", count: Number(summary.rejected) || 0, color: "#ef4444" },
  ] : [];

  const requestsOfType = (...types: string[]) =>
    pendingRequests.filter((r) => (r.responseDetails ?? []).some((d) => types.includes(String(d.requestType)))).length;
  const pendingLeaveCount = data.pendingLeaves ? pendingLeaves.length : Number(summary?.pending) || 0;
  const approvals = [
    { type: "Leave requests", count: pendingLeaveCount, icon: Calendar, tone: "text-blue-600 bg-blue-50", route: "/att_attendanceApproval" },
    { type: "Regularization", count: requestsOfType("REGULARIZATION"), icon: FileText, tone: "text-orange-600 bg-orange-50", route: "/att_regularizationApproval" },
    { type: "On-duty", count: requestsOfType("ON_DUTY"), icon: Briefcase, tone: "text-emerald-600 bg-emerald-50", route: "/att_onDutyApproval" },
    { type: "WFH & permission", count: requestsOfType("WORK_FROM_HOME", "PERMISSION"), icon: Home, tone: "text-purple-600 bg-purple-50", route: "/att_attendanceApproval" },
  ];

  // Same rules as the sidebar: hide pages this user can't open
  const allTiles: (DashboardTile & { permission?: string })[] = [
    { name: "Self Service", icon: UserCircle, route: "/att_selfService", tone: "blue" },
    { name: "Attendance Tracking", icon: TrendingUp, route: "/att_attendanceTracking", tone: "emerald" },
    { name: "Attendance Punch", icon: Fingerprint, route: "/att_punch", tone: "orange" },
    { name: "Leave Requests", icon: Calendar, route: "/att_leaveRequest", tone: "pink" },
    { name: "Regularization", icon: FileText, route: "/att_timesheetManagement", tone: "purple" },
    { name: "Leave Approvals", icon: ClipboardCheck, route: "/att_attendanceApproval", tone: "teal", permission: "ATTENDANCE:APPROVE", count: data.pendingLeaves ? pendingLeaves.length : null },
    { name: "Shift Roster", icon: CalendarClock, route: "/att_shiftSchedule", tone: "indigo", permission: "ATTENDANCE:UPDATE" },
    { name: "Attendance Reports", icon: FileText, route: "/att_reports", tone: "cyan" },
  ];
  const tiles = allTiles.filter((t) => canAccessPath(access, t.route) && (!t.permission || hasPermission(access, t.permission)));

  const pendingTable = [...pendingLeaves]
    .sort((a, b) => String(a.fromDate ?? "").localeCompare(String(b.fromDate ?? "")))
    .slice(0, 6);

  return (
    <>
      <PageMeta title="Attendance Dashboard" description="Attendance and leave overview" />
      <PageBreadcrumb pageTitle="Attendance Dashboard" />

      <div className="mx-auto max-w-7xl p-6">
        <LoadNotice failed={failed} />
        <ModuleTiles tiles={tiles} loading={loading} />

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Employees" value={today ? formatNumber(Number(today.totalEmployees) || 0) : "—"} icon={Users} tone="blue" loading={loading} />
          <KpiCard label="Present Today" value={today ? formatNumber(Number(today.present) || 0) : "—"} hint={today ? `${(Number(today.attendancePercentage) || 0).toFixed(1)}% attendance` : undefined} icon={CheckCircle} tone="emerald" loading={loading} />
          <KpiCard label="Absent Today" value={today ? formatNumber(Number(today.absent) || 0) : "—"} hint={today ? `${formatNumber(Number(today.lateCheckIn) || 0)} late check-ins` : undefined} icon={AlertTriangle} tone="orange" loading={loading} />
          <KpiCard label="On Leave Today" value={today ? formatNumber(Number(today.leave ?? summary?.onLeaveToday) || 0) : summary ? formatNumber(Number(summary.onLeaveToday) || 0) : "—"} hint={summary ? `${formatNumber(Number(summary.pending) || 0)} leave requests pending` : undefined} icon={Calendar} tone="purple" loading={loading} />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Attendance Trend" subtitle="Last 7 days, all employees" icon={TrendingUp} iconClass="text-emerald-500">
            {!hasTrendData ? (
              <EmptyState loading={loading}>No attendance recorded in the last 7 days.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Leave Requests" subtitle="All leave requests by status" icon={Calendar} iconClass="text-purple-500">
            {leaveChart.every((l) => l.count === 0) ? (
              <EmptyState loading={loading}>{summary ? "No leave requests yet." : "Leave summary unavailable."}</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={leaveChart} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={80} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value, "Requests"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {leaveChart.map((l) => <Cell key={l.name} fill={l.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel title="Pending Leave Requests" subtitle="Waiting for a decision, earliest first" bodyClass="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className={TABLE_HEAD}>Employee</th>
                    <th className={TABLE_HEAD}>Type</th>
                    <th className={TABLE_HEAD}>Days</th>
                    <th className={TABLE_HEAD}>From</th>
                    <th className={TABLE_HEAD}>Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pendingTable.length === 0 && (
                    <tr><td colSpan={5} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : data.pendingLeaves ? "No leave requests are waiting." : "Not available."}</td></tr>
                  )}
                  {pendingTable.map((l) => (
                    <tr key={l.id} onClick={() => navigate("/att_attendanceApproval")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{l.employeeName || l.employeeCode || "—"}</td>
                      <td className={TABLE_CELL}>{titleCase(l.leaveType)}</td>
                      <td className={TABLE_CELL}>{l.halfDay ? "0.5" : formatNumber(Number(l.totalDays) || 0)}</td>
                      <td className={TABLE_CELL}>{formatDate(l.fromDate)}</td>
                      <td className={TABLE_CELL}>{formatDate(l.submittedDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Pending Approvals" subtitle="Requests waiting for a manager" icon={Clock} iconClass="text-amber-500">
            <div className="space-y-3">
              {approvals.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.type} type="button" onClick={() => navigate(a.route)}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-100 p-3 text-left transition hover:shadow-sm dark:border-gray-800">
                    <span className="flex items-center gap-3">
                      <span className={`rounded-lg p-2 ${a.tone}`}><Icon className="h-4 w-4" /></span>
                      <span className="text-sm text-gray-700 dark:text-gray-200">{a.type}</span>
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{loading ? "…" : formatNumber(a.count)}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
};

export default AttendanceDashboard;
