import { t } from "../../i18n/i18n";
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Calendar, Clock, LayoutDashboard, RefreshCw, UserX, X } from 'lucide-react';
import DaySwitcher from '../../components/common/DaySwitcher';
import MonthSwitcher from '../../components/common/MonthSwitcher';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { TOOL_BUTTON } from '../Payroll/hrmsUi';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';
import { todayIso } from '../../utils/localDate';
import { apiError, ATTENDANCE_API, hoursOf, timeOf } from './attendanceApi';

// Reports straight from the attendance service. Paged endpoints are read in one large page.
const PAGE = { page: 0, size: 2000 };

interface DashboardData {
  attendanceDate?: string;
  totalEmployees?: number;
  present?: number;
  absent?: number;
  halfDay?: number;
  holiday?: number;
  weekOff?: number;
  leave?: number;
  wfh?: number;
  onDuty?: number;
  lateCheckIn?: number;
  earlyExit?: number;
  missingCheckOut?: number;
  overtimeEmployees?: number;
  attendancePercentage?: number;
}

interface DailyRow {
  id: number;
  employeeId: number;
  employeeCode?: string;
  employeeName?: string;
  attendanceDate: string;
  shiftName?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  workedMinutes?: number | null;
  lateMinutes?: number | null;
  earlyExitMinutes?: number | null;
  overtimeMinutes?: number | null;
  attendanceStatus?: string;
  attendanceMode?: string;
}

interface MonthlyRow {
  id: number;
  employeeId: number;
  employeeCode?: string;
  employeeName?: string;
  shiftName?: string | null;
  presentDays?: number;
  absentDays?: number;
  halfDays?: number;
  leaveDays?: number;
  holidayDays?: number;
  weekOffDays?: number;
  wfhDays?: number;
  onDutyDays?: number;
  lateCount?: number;
  earlyExitCount?: number;
  overtimeMinutes?: number;
  workedMinutes?: number;
}

interface LateRow {
  id: number;
  employeeId: number;
  employeeCode?: string;
  employeeName?: string;
  attendanceDate: string;
  shiftName?: string | null;
  shiftStartTime?: string | null;
  actualCheckIn?: string | null;
  lateMinutes?: number;
}

interface MissingRow {
  id: number;
  employeeId: number;
  employeeCode?: string;
  employeeName?: string;
  attendanceDate: string;
  shiftName?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  attendanceStatus?: string;
}

type Tab = 'dashboard' | 'daily' | 'monthly' | 'late' | 'missing';

// A summary card opens the Daily Report narrowed to its people
type DayFilter = 'present' | 'late' | 'absent' | 'onDuty' | 'wfh' | 'overtime' | 'holiday';
const DAY_FILTERS: Record<DayFilter, { label: string; test: (r: DailyRow) => boolean }> = {
  present: { label: 'Present', test: (r) => Boolean(r.checkInTime) },
  late: { label: 'Late / early exit', test: (r) => (r.lateMinutes ?? 0) > 0 || (r.earlyExitMinutes ?? 0) > 0 },
  absent: { label: 'Absent / leave', test: (r) => ['ABSENT', 'ON_LEAVE', 'HALF_DAY'].includes(r.attendanceStatus || '') },
  onDuty: { label: 'On duty', test: (r) => r.attendanceStatus === 'ON_DUTY' || r.attendanceMode === 'ON_DUTY' },
  wfh: { label: 'Work from home', test: (r) => r.attendanceStatus === 'WFH' || r.attendanceMode === 'WORK_FROM_HOME' },
  overtime: { label: 'Overtime', test: (r) => (r.overtimeMinutes ?? 0) > 0 },
  holiday: { label: 'Holiday / week off', test: (r) => ['HOLIDAY', 'WEEK_OFF'].includes(r.attendanceStatus || '') },
};

// The people the viewer may see (an admin: everyone; a manager: their team), for "Not punched yet"
interface EmployeeOption {
  id: number;
  employeeCode?: string;
  name?: string;
  designation?: string;
}

const pageContent = (data: any) => (Array.isArray(data) ? data : Array.isArray(data?.content) ? data.content : []);
const label = (s?: string | null) => (s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—');
const employeeCell = (row: { employeeName?: string; employeeCode?: string; employeeId: number }) => (
  <div>
    <span className="font-bold text-xs text-gray-900 dark:text-white block">{row.employeeName || `Employee #${row.employeeId}`}</span>
    <span className="text-[10px] text-gray-400 font-mono">{row.employeeCode}</span>
  </div>
);

const AttendanceReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [dateFilter, setDateFilter] = useState<string>(todayIso());
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1);

  const [dashboardData, setDashboardData] = useState<DashboardData>({});
  const [dailyData, setDailyData] = useState<DailyRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [lateData, setLateData] = useState<LateRow[]>([]);
  const [missingData, setMissingData] = useState<MissingRow[]>([]);
  const [dayFilter, setDayFilter] = useState<DayFilter | null>(null);
  const [roster, setRoster] = useState<EmployeeOption[]>([]);
  const [showNotPunched, setShowNotPunched] = useState(false);

  const monthRange = useCallback(() => {
    const from = `${yearFilter}-${String(monthFilter).padStart(2, '0')}-01`;
    const last = new Date(yearFilter, monthFilter, 0).getDate();
    const end = `${yearFilter}-${String(monthFilter).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    const today = todayIso();
    return { fromDate: from, toDate: end > today ? today : end };
  }, [yearFilter, monthFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        // The counts, the day's records and the roster (who hasn't punched = roster without a record)
        const [summary, daily, people] = await Promise.all([
          axios.get(`${ATTENDANCE_API}/dashboard`, { params: { attendanceDate: dateFilter } }),
          axios.get(`${ATTENDANCE_API}/reports/daily`, { params: { attendanceDate: dateFilter, ...PAGE } }),
          axios.get(`${ATTENDANCE_API}/employees`).catch(() => ({ data: [] })),
        ]);
        setDashboardData(summary.data || {});
        setDailyData(pageContent(daily.data).map((r: any) => ({ ...r, id: r.attendanceId })));
        setRoster(Array.isArray(people.data) ? people.data : []);
      } else if (activeTab === 'daily') {
        const res = await axios.get(`${ATTENDANCE_API}/reports/daily`, { params: { attendanceDate: dateFilter, ...PAGE } });
        setDailyData(pageContent(res.data).map((r: any) => ({ ...r, id: r.attendanceId })));
      } else if (activeTab === 'monthly') {
        const res = await axios.get(`${ATTENDANCE_API}/reports/monthly`, { params: { year: yearFilter, month: monthFilter, ...PAGE } });
        setMonthlyData(pageContent(res.data).map((r: any) => ({ ...r, id: r.employeeId })));
      } else if (activeTab === 'late') {
        const res = await axios.get(`${ATTENDANCE_API}/reports/late-arrivals`, { params: { ...monthRange(), ...PAGE } });
        setLateData(pageContent(res.data).map((r: any) => ({ ...r, id: r.attendanceId })));
      } else {
        const res = await axios.get(`${ATTENDANCE_API}/reports/missing-punch`, { params: { ...monthRange(), ...PAGE } });
        setMissingData(pageContent(res.data).map((r: any) => ({ ...r, id: r.attendanceId })));
      }
    } catch (err) {
      ToasterService.error(apiError(err, 'Could not load the report.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFilter, yearFilter, monthFilter, monthRange]);

  useEffect(() => {
    load();
  }, [load]);

  const filterBySearch = <T extends Record<string, any>>(list: T[]): T[] => {
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((item) => Object.values(item).some((val) => val != null && String(val).toLowerCase().includes(term)));
  };

  const dailyColumns: ColumnDef<DailyRow>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: employeeCell },
    { key: 'shiftName', label: 'Shift', render: (r) => r.shiftName || '—' },
    { key: 'checkInTime', label: 'Check in', sortable: true, render: (r) => timeOf(r.checkInTime) || '—' },
    { key: 'checkOutTime', label: 'Check out', sortable: true, render: (r) => timeOf(r.checkOutTime) || '—' },
    { key: 'workedMinutes', label: 'Worked', sortable: true, render: (r) => hoursOf(r.workedMinutes) },
    { key: 'lateMinutes', label: 'Late', sortable: true, render: (r) => (r.lateMinutes ? `${r.lateMinutes}m` : '—') },
    { key: 'attendanceMode', label: 'Mode', render: (r) => label(r.attendanceMode) },
    {
      key: 'attendanceStatus', label: 'Status', sortable: true,
      render: (r) => {
        const st = r.attendanceStatus || '';
        const badge = st === 'ABSENT' ? 'bg-rose-50 text-rose-700 border-rose-200'
          : st === 'HALF_DAY' || (r.lateMinutes ?? 0) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200';
        return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge}`}>{label(st)}</span>;
      },
    },
  ];

  const monthlyColumns: ColumnDef<MonthlyRow>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: employeeCell },
    { key: 'presentDays', label: 'Present', sortable: true },
    { key: 'halfDays', label: 'Half days', sortable: true },
    { key: 'absentDays', label: 'Absent', sortable: true },
    { key: 'leaveDays', label: 'Leave', sortable: true },
    { key: 'onDutyDays', label: 'On duty', sortable: true },
    { key: 'wfhDays', label: 'WFH', sortable: true },
    { key: 'lateCount', label: 'Late', sortable: true },
    { key: 'workedMinutes', label: 'Worked', sortable: true, render: (r) => hoursOf(r.workedMinutes) },
    { key: 'overtimeMinutes', label: 'Overtime', sortable: true, render: (r) => hoursOf(r.overtimeMinutes) },
  ];

  const lateColumns: ColumnDef<LateRow>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: employeeCell },
    { key: 'attendanceDate', label: 'Date', sortable: true },
    { key: 'shiftName', label: 'Shift', render: (r) => `${r.shiftName || '—'}${r.shiftStartTime ? ` (${String(r.shiftStartTime).slice(0, 5)})` : ''}` },
    { key: 'actualCheckIn', label: 'Checked in', render: (r) => (r.actualCheckIn ? String(r.actualCheckIn).slice(0, 5) : '—') },
    {
      key: 'lateMinutes', label: 'Late by', sortable: true,
      render: (r) => <span className="font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">{r.lateMinutes ?? 0} min</span>,
    },
  ];

  const missingColumns: ColumnDef<MissingRow>[] = [
    { key: 'employeeName', label: 'Employee', sortable: true, render: employeeCell },
    { key: 'attendanceDate', label: 'Date', sortable: true },
    { key: 'shiftName', label: 'Shift', render: (r) => r.shiftName || '—' },
    { key: 'checkInTime', label: 'Check in', render: (r) => timeOf(r.checkInTime) || <span className="text-rose-600 font-bold">{t("missing")}</span> },
    { key: 'checkOutTime', label: 'Check out', render: (r) => timeOf(r.checkOutTime) || <span className="text-rose-600 font-bold">{t("missing")}</span> },
    { key: 'attendanceStatus', label: 'Status', render: (r) => label(r.attendanceStatus) },
  ];

  const d = dashboardData;
  const punched = new Set(dailyData.map((r) => r.employeeId));
  const notPunched = roster.filter((e) => !punched.has(e.id));
  const openDaily = (filter: DayFilter) => {
    setDayFilter(filter);
    setSearchTerm('');
    setActiveTab('daily');
  };
  const dailyShown = dayFilter ? dailyData.filter(DAY_FILTERS[dayFilter].test) : dailyData;
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard', label: 'Day Summary', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { key: 'daily', label: 'Daily Report', icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: 'monthly', label: 'Monthly Report', icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: 'late', label: 'Late Arrivals', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'missing', label: 'Missing Punches', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ];

  const kpi = (title: string, value: React.ReactNode, sub: string, tone: string, onOpen?: () => void, active = false) => {
    const body = (
      <>
        <span className="flex items-center justify-between text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
          {onOpen && <span aria-hidden="true" className="text-sm leading-none text-cyan-700 dark:text-cyan-400">›</span>}
        </span>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold text-gray-900 dark:text-white font-mono">{value}</span>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{sub}</span>
        </div>
      </>
    );
    const box = `bg-white dark:bg-[#191919] rounded-xl shadow-2xs border ${tone} dark:border-transparent p-3 space-y-1 text-left w-full`;
    return onOpen ? (
      <button type="button" onClick={onOpen} title={`${t("Show who")}: ${title}`}
        className={`${box} transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${active ? 'ring-2 ring-cyan-500' : ''}`}>
        {body}
      </button>
    ) : <div className={box}>{body}</div>;
  };

  const inputClass = 'px-2.5 h-7 py-0 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#191919] text-gray-800 dark:text-white';
  const showDate = activeTab === 'dashboard' || activeTab === 'daily';

  return (
    <>
      <PageMeta title={t("Attendance Reports")} description="Daily and monthly attendance, late arrivals and missing punches" />
      <PageBreadcrumb
        pageTitle="Attendance Reports"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {showDate ? (
              <DaySwitcher value={dateFilter} max={todayIso()} onChange={setDateFilter} ariaLabel={t("Attendance date")} />
            ) : (
              <MonthSwitcher value={`${yearFilter}-${String(monthFilter).padStart(2, '0')}`} max={todayIso().slice(0, 7)} ariaLabel={t("Report month")}
                onChange={(month) => {
                  const [y, m] = month.split('-').map(Number);
                  setYearFilter(y);
                  setMonthFilter(m);
                }} />
            )}
            <button type="button" onClick={load} disabled={loading} className={TOOL_BUTTON} title={t("Refresh")}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
              {t("Refresh")}
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto pb-4 space-y-2.5 animate-in fade-in duration-200">
        <div className="flex items-center w-fit max-w-full bg-gray-100/80 dark:bg-[#222222] p-0.5 rounded-lg text-[11px] font-semibold overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} type="button" onClick={() => { setDayFilter(null); setActiveTab(t.key); }}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === t.key ? 'bg-cyan-600 text-white shadow-2xs font-bold' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {kpi('Active employees', d.totalEmployees ?? 0, 'on the roster', 'border-cyan-200/80')}
              {kpi('Present', d.present ?? 0, `${d.attendancePercentage ?? 0}% of employees`, 'border-emerald-200/80', () => openDaily('present'))}
              {kpi('Late / early exit', `${d.lateCheckIn ?? 0} / ${d.earlyExit ?? 0}`, `${d.missingCheckOut ?? 0} without check-out`, 'border-amber-200/80', () => openDaily('late'))}
              {kpi('Absent / leave', `${d.absent ?? 0} / ${d.leave ?? 0}`, `${d.halfDay ?? 0} half day`, 'border-rose-200/80', () => openDaily('absent'))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {kpi('Not punched yet', notPunched.length, 'no record for the day', 'border-rose-300', () => setShowNotPunched((v) => !v), showNotPunched)}
              {kpi('On duty', d.onDuty ?? 0, 'client visits', 'border-gray-200/80', () => openDaily('onDuty'))}
              {kpi('Work from home', d.wfh ?? 0, 'approved WFH', 'border-gray-200/80', () => openDaily('wfh'))}
              {kpi('Overtime', d.overtimeEmployees ?? 0, 'employees', 'border-gray-200/80', () => openDaily('overtime'))}
              {kpi('Holiday / week off', `${d.holiday ?? 0} / ${d.weekOff ?? 0}`, 'records', 'border-gray-200/80', () => openDaily('holiday'))}
            </div>
            {showNotPunched && (
              <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-rose-200/80 dark:border-transparent p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <UserX className="h-3.5 w-3.5 text-rose-600" />{t("Not punched yet")} ({notPunched.length})
                  </span>
                  <button type="button" onClick={() => setShowNotPunched(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#222222]" aria-label={t("Close")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {notPunched.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-500">{t("Everyone has an attendance record for this day.")}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {notPunched.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5 dark:border-gray-800">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                          {(e.name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-bold text-gray-900 dark:text-white">{e.name || `Employee #${e.id}`}</span>
                          <span className="block truncate text-[10px] text-gray-500 dark:text-gray-400">{[e.employeeCode, e.designation].filter(Boolean).join(' · ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-gray-400">{t("Active employees you can see with no attendance record for")} {d.attendanceDate || dateFilter}. {t("On weekends and holidays everyone may show here.")}</p>
              </div>
            )}
            <p className="text-[11px] text-gray-400 dark:text-gray-500 px-1">
              {t("Counts come from attendance records of")} {d.attendanceDate || dateFilter}. Click a card to see who. Employees with no
              record that day are under "Not punched yet", not counted as absent.
            </p>
          </div>
        )}

        {activeTab !== 'dashboard' && (
          <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:border-transparent p-4 space-y-3">
            <input type="text" placeholder={t("Search employee, status...")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className={`${inputClass} w-full max-w-md`} />

            {activeTab === 'daily' && dayFilter && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">{t("Showing")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 font-semibold text-cyan-800 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:ring-cyan-900">
                  {t(DAY_FILTERS[dayFilter].label)} ({dailyShown.length})
                  <button type="button" onClick={() => setDayFilter(null)} className="ml-0.5 rounded-full hover:bg-cyan-100 dark:hover:bg-cyan-900" aria-label={t("Show everyone")}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
            {activeTab === 'daily' && <ReusableTable data={filterBySearch(dailyShown)} columns={dailyColumns} loading={loading} pageSize={10} />}
            {activeTab === 'monthly' && <ReusableTable data={filterBySearch(monthlyData)} columns={monthlyColumns} loading={loading} pageSize={10} />}
            {activeTab === 'late' && <ReusableTable data={filterBySearch(lateData)} columns={lateColumns} loading={loading} pageSize={10} />}
            {activeTab === 'missing' && <ReusableTable data={filterBySearch(missingData)} columns={missingColumns} loading={loading} pageSize={10} />}
          </div>
        )}
      </div>
    </>
  );
};

export default AttendanceReportsPage;
