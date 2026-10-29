import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  UserCheck, Clock, X, FileText, Download, RotateCw, Calendar,
  TrendingUp, AlertTriangle, Gift, Briefcase, ChevronLeft, ChevronRight,
  UserX, Percent, Home, MapPin, PenLine
} from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import StatsCard from '../../components/common/Statscard';
import { TOOL_BUTTON } from '../Payroll/hrmsUi';
import { ToasterService } from '../../Services/ToasterService';
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { ATTENDANCE_API, CalendarDay, DayKind, dayKind, DAY_KIND_BADGE, DAY_KIND_LABEL, hoursOf, leaveTypeLabel, timeOf } from './attendanceApi';
import { leadingDays, weekdayLabels, isCompanyWeekend, weekDays, dateLocale, liveMonthNames } from "../../company/format";

import { t } from "../../i18n/i18n";
// GET /v1/api/attendance/records/my-calendar/{employeeId}: one entry per day of the month, already resolved
// by the server into holidays, weekly offs, approved leave and absence
interface MyCalendarResponseModel {
  employeeId: number;
  year: number;
  month: number;
  days: CalendarDay[];
}

const monthNames = liveMonthNames("long");

const PRESENT_KINDS: DayKind[] = ['PRESENT', 'LATE', 'ON_DUTY', 'WFH', 'CHECKED_IN'];

/** Calendar colours per day kind: tinted cell, left accent and status pill. */
const KIND_STYLE: Record<DayKind, { cell: string; accent: string; pill: string }> = {
  PRESENT: { cell: 'bg-[#fff]', accent: 'border-l-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LATE: { cell: 'bg-[#fff]', accent: 'border-l-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  HALF_DAY: { cell: 'bg-sky-50/70', accent: 'border-l-sky-500', pill: 'bg-sky-50 text-sky-700 border-sky-200' },
  ABSENT: { cell: 'bg-rose-50/70', accent: 'border-l-rose-500', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
  LEAVE: { cell: 'bg-violet-50/70', accent: 'border-l-violet-500', pill: 'bg-violet-50 text-violet-700 border-violet-200' },
  HOLIDAY: { cell: 'bg-orange-50/80', accent: 'border-l-orange-400', pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  WEEK_OFF: { cell: 'bg-slate-100/80', accent: 'border-l-slate-300', pill: 'bg-slate-100 text-slate-500 border-slate-200' },
  ON_DUTY: { cell: 'bg-[#fff]', accent: 'border-l-cyan-500', pill: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  WFH: { cell: 'bg-[#fff]', accent: 'border-l-teal-500', pill: 'bg-teal-50 text-teal-700 border-teal-200' },
  CHECKED_IN: { cell: 'bg-[#fff]', accent: 'border-l-cyan-500', pill: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  NONE: { cell: 'bg-[#fff]', accent: 'border-l-transparent', pill: '' },
};

/** Summary cards double as the calendar filter. */
type Filter = 'ALL' | 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'OFF';
const matchesFilter = (d: CalendarDay | undefined, filter: Filter) => {
  if (filter === 'ALL') return true;
  const kind = dayKind(d);
  if (filter === 'PRESENT') return PRESENT_KINDS.includes(kind) || kind === 'HALF_DAY';
  if (filter === 'LATE') return kind === 'LATE' || Boolean(d?.lateMinutes && d.lateMinutes > 0);
  if (filter === 'ABSENT') return kind === 'ABSENT';
  if (filter === 'LEAVE') return kind === 'LEAVE' || Boolean(d?.halfDayLeave);
  return kind === 'HOLIDAY' || kind === 'WEEK_OFF';
};

/** Days that count towards attendance %: everything except offs, holidays and days not yet due. */
const isWorkingDay = (kind: DayKind) => kind !== 'WEEK_OFF' && kind !== 'HOLIDAY' && kind !== 'NONE';
const presentValue = (kind: DayKind) => (kind === 'HALF_DAY' ? 0.5 : PRESENT_KINDS.includes(kind) ? 1 : 0);

const formatMinutesToHoursStr = (totalMins: number = 0): string => {
  if (!totalMins || totalMins <= 0) return '0h 00m';
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
};

/** 45m under an hour, else 2h 15m. */
const shortHours = (m: number) => (m > 0 && m < 60 ? `${m}m` : hoursOf(m));

const isoOf =(d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayLabel = (d: CalendarDay) => {
  const kind = dayKind(d);
  if (kind === 'LEAVE' || d.halfDayLeave) return `${d.leaveType ? `${leaveTypeLabel(d.leaveType)} leave` : t('Leave')}${d.halfDayLeave ? ' (½ day)' : ''}`;
  if (kind === 'HOLIDAY') return d.holidayName || 'Holiday';
  return DAY_KIND_LABEL[kind];
};

const AttendanceTrackingPage: React.FC = () => {
  const { canExport, can } = usePermissions();

  // Own employee identity from the login token (no hard-coded ids)
  const currentUser = useCurrentEmployee();

  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [employeeList, setEmployeeList] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number>(currentUser.id);
  const [selectedDayRecord, setSelectedDayRecord] = useState<CalendarDay | null>(null);
  const [calendarData, setCalendarData] = useState<MyCalendarResponseModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth() + 1; // 1-12

  // Approvers and HR may look at anyone; everybody else sees their own calendar
  const canSeeOthers = can("APPROVE");

  useEffect(() => {
    if (!selectedEmpId && currentUser.id) setSelectedEmpId(currentUser.id);
  }, [currentUser.id, selectedEmpId]);

  // ── Employee picker (attendance service, needs ATTENDANCE:VIEW) ─────────
  useEffect(() => {
    if (!canSeeOthers) {
      setEmployeeList(currentUser.hasEmployee ? [{ id: currentUser.id, name: currentUser.name, code: currentUser.code }] : []);
      return;
    }
    axios.get(`${ATTENDANCE_API}/employees`)
      .then((res) => {
        const mapped = (Array.isArray(res.data) ? res.data : []).map((e: any) => ({
          id: Number(e.id),
          name: e.name || `Employee #${e.id}`,
          code: e.employeeCode || ''
        }));
        setEmployeeList(mapped);
        if (!currentUser.hasEmployee && mapped.length) setSelectedEmpId((prev) => prev || mapped[0].id);
      })
      .catch(() => setEmployeeList([]));
  }, [canSeeOthers, currentUser.hasEmployee, currentUser.id, currentUser.name, currentUser.code]);

  const fetchMyCalendarAttendance = async () => {
    const targetEmpId = selectedEmpId || currentUser.id;
    if (!targetEmpId) return;

    setLoading(true);
    try {
      const res = await axios.get<MyCalendarResponseModel>(
        `${ATTENDANCE_API}/records/my-calendar/${targetEmpId}`,
        { params: { employeeId: targetEmpId, year: selectedYear, month: selectedMonth } }
      );
      setCalendarData(res.data && Array.isArray(res.data.days) ? res.data : null);
    } catch (err: any) {
      ToasterService.error(err?.response?.data?.message || "Could not load the attendance calendar.");
      setCalendarData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmpId > 0) {
      fetchMyCalendarAttendance();
    }
  }, [currentDate, selectedEmpId]);

  const handlePrevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const handleThisMonth = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    (calendarData?.days || []).forEach(d => map.set(d.date, d));
    return map;
  }, [calendarData]);

  // ── Month summary ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const days = calendarData?.days || [];
    let working = 0, present = 0, absent = 0, late = 0, leave = 0, offs = 0, worked = 0, overtime = 0;
    days.forEach(d => {
      const kind = dayKind(d);
      if (isWorkingDay(kind)) working++;
      present += presentValue(kind);
      if (kind === 'ABSENT') absent++;
      if (kind === 'LATE' || (d.lateMinutes && d.lateMinutes > 0)) late++;
      if (kind === 'LEAVE') leave += 1;
      else if (d.halfDayLeave) leave += 0.5;
      if (kind === 'HOLIDAY' || kind === 'WEEK_OFF') offs++;
      worked += d.workedMinutes || 0;
      overtime += d.overtimeMinutes || 0;
    });
    const rate = working ? Math.round((present / working) * 100) : 0;
    return { working, present, absent, late, leave, offs, worked, overtime, rate };
  }, [calendarData]);

  // Exports follow the active filter
  const exportDays = useMemo(() => (calendarData?.days || []).filter(d => matchesFilter(d, filter)), [calendarData, filter]);
  const employeeName = employeeList.find(e => e.id === selectedEmpId)?.name || currentUser.name;

  const handleExportCSV = () => {
    const data = exportDays.map(d => ({
      "Date": d.date,
      "Status": dayLabel(d) || '-',
      "In Time": timeOf(d.inTime) || '-',
      "Out Time": timeOf(d.outTime) || '-',
      "Worked": formatMinutesToHoursStr(d.workedMinutes ?? 0),
      "Late Minutes": d.lateMinutes || 0,
      "Early Exit Minutes": d.earlyExitMinutes || 0,
      "Overtime Minutes": d.overtimeMinutes || 0,
      "Regularized": d.regularized ? "Yes" : "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `Attendance_${employeeName}_${selectedYear}_${selectedMonth}.xlsx`);
    ToasterService.success("Attendance exported to Excel.");
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Attendance - ${employeeName} - ${new Date(selectedYear, selectedMonth - 1, 1).toLocaleString("en-US", { month: "long" })} ${selectedYear}`, 14, 16);
    doc.setFontSize(9);
    doc.text(`Present ${summary.present} of ${summary.working} working days (${summary.rate}%) · Absent ${summary.absent} · Late ${summary.late} · Leave ${summary.leave} · Worked ${hoursOf(summary.worked)}`, 14, 22);
    autoTable(doc, {
      head: [["Date", "Status", "In", "Out", "Worked", "Late", "Overtime"]],
      body: exportDays.map(d => [
        d.date,
        dayLabel(d) || '-',
        timeOf(d.inTime) || '-',
        timeOf(d.outTime) || '-',
        d.workedMinutes ? hoursOf(d.workedMinutes) : '-',
        d.lateMinutes ? `${d.lateMinutes}m` : '-',
        d.overtimeMinutes ? `${d.overtimeMinutes}m` : '-',
      ]),
      startY: 27,
      styles: { fontSize: 8 },
    });
    doc.save(`Attendance_${employeeName}_${selectedYear}_${selectedMonth}.pdf`);
    ToasterService.success("Attendance exported to PDF.");
  };

  // ── Monday-first weeks covering the month ───────────────────────────────
  const weeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const offset = leadingDays(year, month);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const count = Math.ceil((offset + daysInMonth) / 7);
    return Array.from({ length: count }, (_, w) =>
      Array.from({ length: 7 }, (_, i) => new Date(year, month, 1 - offset + w * 7 + i)));
  }, [currentDate]);

  const todayStr = todayIso();
  const toggleFilter = (f: Filter) => setFilter(prev => (prev === f ? 'ALL' : f));

  const renderDay = (date: Date) => {
    const dateStr = isoOf(date);
    const inMonth = date.getMonth() === currentDate.getMonth();
    if (!inMonth) {
      return (
        <div key={dateStr} className="rounded-md border border-dashed border-slate-200/80 px-1.5 py-1 text-[11px] font-medium text-slate-300 dark:border-[#2a2a2a] dark:text-gray-600">
          {date.getDate()}
        </div>
      );
    }

    const d = dayMap.get(dateStr);
    const kind = dayKind(d);
    const style = KIND_STYLE[kind];
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const dimmed = filter !== 'ALL' && !matchesFilter(d, filter);
    const inT = timeOf(d?.inTime);
    const outT = timeOf(d?.outTime);
    const label = d ? dayLabel(d) : '';

    return (
      <button
        type="button"
        key={dateStr}
        onClick={() => d && kind !== 'NONE' && setSelectedDayRecord(d)}
        title={label ? `${dateStr} · ${label}` : dateStr}
        className={`group flex min-h-0 flex-col gap-0.5 overflow-hidden rounded-md border border-slate-200/90 border-l-[3px] px-1.5 py-1 text-left transition-all dark:border-[#2a2a2a] dark:bg-[#202020] ${style.cell} ${style.accent} ${
          kind !== 'NONE' ? 'cursor-pointer hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(15,23,42,0.10)]' : 'cursor-default'
        } ${isToday ? 'ring-2 ring-[#4DD0E1] ring-offset-0' : ''} ${dimmed ? 'opacity-30' : ''}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[11px] font-bold leading-none ${
            isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#0097a7] text-white'
              : isFuture ? 'text-slate-400 dark:text-gray-500' : 'text-slate-800 dark:text-gray-100'
          }`}>
            {date.getDate()}
          </span>
          {kind !== 'NONE' && (
            <span className={`rounded border px-1 py-px text-[9px] font-bold leading-none tracking-wide dark:border-transparent dark:bg-white/10 dark:text-gray-200 ${style.pill}`}>
              {DAY_KIND_BADGE[kind]}
            </span>
          )}
        </div>

        {(kind === 'HOLIDAY' || kind === 'LEAVE' || kind === 'WEEK_OFF' || kind === 'ABSENT' || d?.halfDayLeave) && (
          <span className="truncate text-[10px] font-semibold leading-tight text-slate-600 dark:text-gray-300">{label}</span>
        )}

        {(inT || outT) && (
          <span className="truncate font-mono text-[10px] leading-tight text-slate-600 dark:text-gray-300">
            {inT || '--:--'} – {outT || (kind === 'CHECKED_IN' ? 'now' : '--:--')}
          </span>
        )}

        {(d?.workedMinutes || d?.lateMinutes || d?.overtimeMinutes || d?.regularized) ? (
          <div className="mt-auto flex flex-wrap items-center gap-1 leading-none">
            {d?.workedMinutes ? <span className="text-[10px] font-bold text-slate-800 dark:text-gray-100">{hoursOf(d.workedMinutes)}</span> : null}
            {d?.lateMinutes ? <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">{d.lateMinutes}m late</span> : null}
            {d?.overtimeMinutes ? <span className="rounded bg-emerald-100 px-1 py-px text-[9px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">+{d.overtimeMinutes}m OT</span> : null}
            {d?.regularized ? <span title={t("Regularized")} className="rounded bg-indigo-100 px-1 py-px text-[9px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{t("REG")}</span> : null}
          </div>
        ) : null}
      </button>
    );
  };

  const renderWeekTotal = (week: Date[], index: number) => {
    let worked = 0, overtime = 0, present = 0, working = 0;
    week.forEach(date => {
      if (date.getMonth() !== currentDate.getMonth()) return;
      const d = dayMap.get(isoOf(date));
      const kind = dayKind(d);
      if (isWorkingDay(kind)) working++;
      present += presentValue(kind);
      worked += d?.workedMinutes || 0;
      overtime += d?.overtimeMinutes || 0;
    });
    return (
      <div key={`week-${index}`} className="hidden min-h-0 flex-col justify-center gap-0.5 rounded-md border border-[#cdeef3] bg-[#e0f7fa]/70 px-2 py-1 md:flex dark:border-[#2a2a2a] dark:bg-[#1c2526]">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#006f7a] dark:text-cyan-300">{t("Week")} {index + 1}</span>
        <span className="text-xs font-bold text-slate-900 dark:text-white">{worked || working ? hoursOf(worked) : '—'}</span>
        {working > 0 && <span className="text-[10px] font-medium text-slate-600 dark:text-gray-300">{present}/{working} days</span>}
        {overtime > 0 && <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">+{shortHours(overtime)} OT</span>}
      </div>
    );
  };

  const GRID_COLS = 'grid grid-cols-7 md:grid-cols-[repeat(7,minmax(0,1fr))_96px] gap-1.5';

  return (
    <>
      <div className="h-full flex flex-col min-h-0 w-full animate-in fade-in duration-200">
      <div className="shrink-0 mb-1">
        <PageMeta title={t("Attendance Tracking & Calendar Records")} description="Monthly attendance calendar with punches, hours, late arrivals and leave" />
        <PageBreadcrumb
          pageTitle="Attendance Tracking & Calendar Records"
          actions={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {employeeList.length > 0 && (
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                  className="h-7 py-0 pl-2 pr-7 bg-white dark:bg-[#191919] border border-slate-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-white focus:ring-1 focus:ring-cyan-400 outline-none cursor-pointer max-w-[240px] truncate"
                  title={t("Employee")}
                >
                  {employeeList.map(emp => (
                    <option key={emp.id} value={emp.id} className="dark:bg-[#222222]">
                      {emp.name} ({emp.code})
                    </option>
                  ))}
                </select>
              )}
              <div className="flex h-7 items-center gap-0.5 bg-white dark:bg-[#191919] px-1 rounded-lg border border-slate-200 dark:border-gray-700">
                <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer" title={t("Previous Month")}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1 text-xs font-bold text-slate-800 dark:text-white min-w-[104px] text-center">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
                <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer" title={t("Next Month")}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={fetchMyCalendarAttendance} className="p-1 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#2a2a2a] rounded-md transition cursor-pointer" title={t("Refresh")}>
                  <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <button type="button" onClick={handleThisMonth} className={TOOL_BUTTON} title={t("Go to the current month")}>
                <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                {t("Today")}
              </button>
              {canExport && (
                <button type="button" onClick={handleExportCSV} className={TOOL_BUTTON} title={t("Export Excel")}>
                  <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  {t("Excel")}
                </button>
              )}
              {canExport && (
                <button type="button" onClick={handleExportPDF} className={TOOL_BUTTON} title={t("Export PDF")}>
                  <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  {t("PDF")}
                </button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col pb-0.5">

        {/* ── Month summary (cards filter the calendar) ─────────────────── */}
        {/* No list toolbar here: the calendar has its own controls in the breadcrumb */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 shrink-0 !pr-0 [&_.stats-card-actions]:!hidden">
          <StatsCard label={t("Attendance")} value={`${summary.rate}%`} gradient="from-cyan-50" icon={<Percent />} loading={loading} />
          <StatsCard label={t("Present days")} value={`${summary.present}/${summary.working}`} gradient="from-emerald-50" icon={<UserCheck />} loading={loading}
            onClick={() => toggleFilter('PRESENT')} selected={filter === 'PRESENT'} title={t("Show present days")} />
          <StatsCard label={t("Absent")} value={summary.absent} gradient="from-rose-50" icon={<UserX />} loading={loading}
            onClick={() => toggleFilter('ABSENT')} selected={filter === 'ABSENT'} title={t("Show absent days")} />
          <StatsCard label={t("Late arrivals")} value={summary.late} gradient="from-amber-50" icon={<AlertTriangle />} loading={loading}
            onClick={() => toggleFilter('LATE')} selected={filter === 'LATE'} title={t("Show late days")} />
          <StatsCard label={t("Leave")} value={summary.leave} gradient="from-purple-50" icon={<Briefcase />} loading={loading}
            onClick={() => toggleFilter('LEAVE')} selected={filter === 'LEAVE'} title={t("Show leave days")} />
          <StatsCard label={t("Holidays & offs")} value={summary.offs} gradient="from-gray-50" icon={<Gift />} loading={loading}
            onClick={() => toggleFilter('OFF')} selected={filter === 'OFF'} title={t("Show holidays and week offs")} />
          <StatsCard label={t("Hours worked")} value={hoursOf(summary.worked)} gradient="from-cyan-50" icon={<Clock />} loading={loading} />
          <StatsCard label={t("Overtime")} value={shortHours(summary.overtime)} gradient="from-emerald-50" icon={<TrendingUp />} loading={loading} />
        </div>

        {/* ── Month calendar ─────────────────────────────────────────────── */}
        <div className="flex-1 min-h-[420px] max-h-[calc(100cqh-48px)] flex flex-col gap-1.5 rounded-xl border p-2.5 shadow-sm bg-white dark:bg-[#191919] dark:border-transparent overflow-auto">
          <div className={`${GRID_COLS} shrink-0`}>
            {weekdayLabels().map((w, i) => (
              <span key={w} className={`rounded-md py-1 text-center text-[10.5px] font-bold uppercase tracking-wider ${isCompanyWeekend(weekDays()[i]) ? 'bg-slate-200/60 text-slate-500 dark:bg-[#222] dark:text-gray-500' : 'bg-[#e0f7fa] text-[#006f7a] dark:bg-[#1c2526] dark:text-cyan-300'}`}>{w}</span>
            ))}
            <span className="hidden md:block rounded-md py-1 text-center text-[10.5px] font-bold uppercase tracking-wider bg-[#b2ebf2] text-[#006f7a] dark:bg-[#1c2526] dark:text-cyan-300">{t("Week total")}</span>
          </div>

          <div className={`flex-1 min-h-0 ${GRID_COLS}`} style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(64px, 1fr))` }}>
            {weeks.flatMap((week, i) => [...week.map(renderDay), renderWeekTotal(week, i)])}
          </div>

          {/* Legend */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/70 pt-1.5 text-[10px] font-medium text-slate-600 dark:border-[#2a2a2a] dark:text-gray-400">
            {(['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE', 'HOLIDAY', 'WEEK_OFF', 'ON_DUTY', 'WFH'] as DayKind[]).map(k => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={`rounded border px-1 py-px text-[9px] font-bold leading-none ${KIND_STYLE[k].pill}`}>{DAY_KIND_BADGE[k]}</span>
                {DAY_KIND_LABEL[k]}
              </span>
            ))}
            {filter !== 'ALL' && (
              <button type="button" onClick={() => setFilter('ALL')} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-[#006f7a] hover:bg-[#e0f7fa] cursor-pointer">
                <X className="h-3 w-3" /> {t("Clear filter")}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>

      {/* ── Day details ─────────────────────────────────────────────────── */}
      {selectedDayRecord && (() => {
        const kind = dayKind(selectedDayRecord);
        return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setSelectedDayRecord(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-transparent w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-cyan-600 dark:bg-[#222222] text-white flex items-center justify-between border-b border-transparent dark:border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-white dark:text-gray-300" />
                <div>
                  <h3 className="text-xs font-bold text-white dark:text-gray-200 uppercase">{t("Attendance Details")}</h3>
                  <span className="text-[11px] text-cyan-100 dark:text-gray-400 block">
                    {new Date(`${selectedDayRecord.date}T00:00:00`).toLocaleDateString(dateLocale("en-IN"), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {employeeName}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedDayRecord(null)} className="p-1 text-white/80 dark:text-gray-400 hover:bg-white/10 dark:hover:bg-[#2a2a2a] rounded-lg cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200 dark:border-transparent">
                <span className="text-slate-600 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">{t("Status")}</span>
                <span className="flex items-center gap-1.5">
                  {selectedDayRecord.regularized && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200"><PenLine className="h-3 w-3" /> {t("Regularized")}</span>
                  )}
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${KIND_STYLE[kind].pill}`}>
                    {dayLabel(selectedDayRecord)}
                  </span>
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-[#222222] p-3.5 rounded-xl border border-slate-200/80 dark:border-transparent space-y-2">
                {[
                  ['Check-in', timeOf(selectedDayRecord.inTime) || '-'],
                  ['Check-out', timeOf(selectedDayRecord.outTime) || '-'],
                  ['Hours worked', selectedDayRecord.workedMinutes ? formatMinutesToHoursStr(selectedDayRecord.workedMinutes) : '-'],
                  ['Late by', selectedDayRecord.lateMinutes ? `${selectedDayRecord.lateMinutes} min` : '-'],
                  ['Early exit', selectedDayRecord.earlyExitMinutes ? `${selectedDayRecord.earlyExitMinutes} min` : '-'],
                  ['Overtime', selectedDayRecord.overtimeMinutes ? `${selectedDayRecord.overtimeMinutes} min` : '-'],
                ].map(([k, v], i, all) => (
                  <div key={k} className={`flex justify-between ${i < all.length - 1 ? 'border-b border-slate-200/60 dark:border-[#2a2a2a] pb-1.5' : ''}`}>
                    <span className="text-slate-500 dark:text-gray-400 font-medium">{k}</span>
                    <span className="font-bold font-mono text-slate-800 dark:text-gray-200">{v}</span>
                  </div>
                ))}
              </div>

              {selectedDayRecord.attendanceMode && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-gray-300">
                  {selectedDayRecord.attendanceMode === 'WORK_FROM_HOME' ? <Home className="w-4 h-4 text-teal-600" /> : <MapPin className="w-4 h-4 text-cyan-600" />}
                  <span className="font-semibold">{selectedDayRecord.attendanceMode === 'WORK_FROM_HOME' ? 'Worked from home' : 'Worked from office'}</span>
                </div>
              )}

              {selectedDayRecord.holidayName && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-transparent flex items-center gap-2">
                  <Gift className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-orange-700 dark:text-orange-400 font-bold uppercase block">{t("Company holiday")}</span>
                    <span className="text-xs font-bold text-orange-900 dark:text-orange-200">{selectedDayRecord.holidayName}</span>
                  </div>
                </div>
              )}

              {selectedDayRecord.leaveType && (
                <div className="p-3 bg-violet-50 dark:bg-violet-950/20 rounded-xl border border-violet-200 dark:border-transparent flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-violet-700 dark:text-violet-400 font-bold uppercase block">{t("Approved leave")}</span>
                    <span className="text-xs font-bold text-violet-900 dark:text-violet-200">
                      {leaveTypeLabel(selectedDayRecord.leaveType)} leave{selectedDayRecord.halfDayLeave ? ' (half day)' : ''}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => setSelectedDayRecord(null)}
                  className={TOOL_BUTTON}
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
};

export default AttendanceTrackingPage;
