import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus, 
  Sparkles, CheckCircle2, AlertCircle, FileText, Gift, Briefcase, UserCheck,
  Maximize2, Minimize2, X, Loader2
} from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { ToasterService } from '../../Services/ToasterService';
import { todayIso } from "../../utils/localDate";
import {
  apiError, CalendarDay, DAY_KIND_BADGE, dayKind, fetchLeaveBalances, fetchMonth, formatDays, freeDays,
  hoursOf, LeaveBalance, leaveTypeLabel, punch, timeOf,
} from "./attendanceApi";
import { formatTime, leadingDays, weekdayLabels, liveMonthNames } from "../../company/format";
import HijriMonthCaption from "../../components/common/HijriMonthCaption";

import { t } from "../../i18n/i18n";
type DayStatus = 'TODAY' | 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF' | 'ON_DUTY' | 'WFH' | 'REGULAR';

/** Short codes on the small calendar (the large one shows the full label). */
const SHORT_CODE: Record<string, string> = {
  PRESENT: 'P', LATE: 'LT', HALF_DAY: 'HD', LEAVE: 'L', ABSENT: 'A', HOLIDAY: 'H', WEEK_OFF: 'WO', ON_DUTY: 'OD', WFH: 'WFH',
};

/** Each status has its own look on the calendar: tinted cell, coloured left edge and a labelled badge. */
const STATUS_LOOK: Record<string, { cell: string; accent: string; badge: string; label: string }> = {
  PRESENT: { cell: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900', accent: 'border-l-emerald-500', badge: 'bg-emerald-600 text-white', label: 'Present' },
  LATE: { cell: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900', accent: 'border-l-amber-500', badge: 'bg-amber-500 text-white', label: 'Late' },
  HALF_DAY: { cell: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-900', accent: 'border-l-sky-500', badge: 'bg-sky-600 text-white', label: 'Half day' },
  LEAVE: { cell: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900', accent: 'border-l-violet-500', badge: 'bg-violet-600 text-white', label: 'Leave' },
  ABSENT: { cell: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900', accent: 'border-l-rose-500', badge: 'bg-rose-600 text-white', label: 'Absent' },
  HOLIDAY: { cell: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900', accent: 'border-l-orange-400', badge: 'bg-orange-500 text-white', label: 'Holiday' },
  WEEK_OFF: { cell: 'bg-slate-100 border-slate-200 dark:bg-[#1c1c1c] dark:border-[#303030]', accent: 'border-l-slate-400', badge: 'bg-slate-500 text-white', label: 'Week off' },
  ON_DUTY: { cell: 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900', accent: 'border-l-cyan-500', badge: 'bg-cyan-600 text-white', label: 'On duty' },
  WFH: { cell: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-900', accent: 'border-l-teal-500', badge: 'bg-teal-600 text-white', label: 'WFH' },
  // bg-[#fff], not bg-white: the app-wide card tint (index.css) would otherwise colour plain days like Present ones
  TODAY: { cell: 'bg-[#fff] border-slate-200 dark:bg-[#222222] dark:border-[#303030]', accent: 'border-l-transparent', badge: 'bg-[#0097a7] text-white', label: 'Today' },
  REGULAR: { cell: 'bg-[#fff] border-slate-200 dark:bg-[#222222] dark:border-[#303030]', accent: 'border-l-transparent', badge: '', label: '' },
};

export interface CalendarDayItem {
  date: string;
  dayNumber: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF';
  inTime?: string;
  outTime?: string;
  workedMinutes?: number;
  lateMinutes?: number;
  holidayName?: string;
  leaveType?: string;
}

const EmployeeSelfServicePage: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeRequestFilter, setActiveRequestFilter] = useState<string>('ALL');
  const [showRequestDropdown, setShowRequestDropdown] = useState<boolean>(false);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(false);

  // User Profile
  // Own employee identity from the login token (no hard-coded ids)
  const currentUser = useCurrentEmployee();

  // The employee comes from the login token; never guessed from names
  const resolvedEmpId = currentUser.id;

  const monthNames = liveMonthNames("long");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = todayIso();

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // The month as the server resolves it: punches, approved leave, holidays, weekly offs, absences
  const [monthDays, setMonthDays] = useState<CalendarDay[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);

  // 1-Click Punch & Quick Leave States
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState<boolean>(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL',
    fromDate: todayIso(),
    toDate: todayIso(),
    reason: ''
  });
  const [isSubmittingLeave, setIsSubmittingLeave] = useState<boolean>(false);

  // Lock body scroll when calendar or apply leave modal is open
  useEffect(() => {
    if (isCalendarExpanded || isApplyLeaveModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isCalendarExpanded, isApplyLeaveModalOpen]);

  const fetchCalendarData = useCallback(async () => {
    if (!currentUser.hasEmployee) return;
    setLoadingCalendar(true);
    try {
      const [daysRes, balRes] = await Promise.allSettled([fetchMonth(year, month + 1), fetchLeaveBalances(resolvedEmpId)]);
      setMonthDays(daysRes.status === 'fulfilled' ? daysRes.value : []);
      setBalances(balRes.status === 'fulfilled' ? balRes.value : []);
      if (daysRes.status === 'rejected') {
        ToasterService.error(apiError(daysRes.reason, 'Could not load your attendance.'));
      }
    } finally {
      setLoadingCalendar(false);
    }
  }, [resolvedEmpId, currentUser.hasEmployee, year, month]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Offer only the leave types the employee actually has
  useEffect(() => {
    if (balances.length && !balances.some((b) => b.leaveType === leaveForm.leaveType)) {
      setLeaveForm((prev) => ({ ...prev, leaveType: balances[0].leaveType }));
    }
  }, [balances, leaveForm.leaveType]);

  // Today's punch state, kept separately so it stays right while another month is shown
  const [todayDay, setTodayDay] = useState<CalendarDay | null>(null);
  const refreshToday = useCallback(async () => {
    if (!currentUser.hasEmployee) return;
    try {
      const now = new Date();
      const days = await fetchMonth(now.getFullYear(), now.getMonth() + 1);
      setTodayDay(days.find((d) => d.date === todayStr) ?? null);
    } catch {
      setTodayDay(null);
    }
  }, [currentUser.hasEmployee, todayStr]);

  useEffect(() => {
    refreshToday();
  }, [refreshToday]);

  const isCheckedIn = todayDay?.status === 'CHECKED_IN';
  const isCheckedOut = !isCheckedIn && Boolean(todayDay?.outTime);
  // A full day of approved leave: no check-in that day (the server refuses it too); a half day still can
  const onLeaveToday = !isCheckedIn && todayDay?.status === 'ON_LEAVE' && !todayDay?.halfDayLeave;
  const todayInFormatted = timeOf(todayDay?.inTime) || null;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('Good morning');
    if (hour < 17) return t('Good afternoon');
    return t('Good evening');
  }, []);

  const handleWebPunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    setIsPunching(true);
    try {
      const res = await punch(punchType === 'CHECK_IN' ? 'in' : 'out');
      ToasterService.success(res?.message || (punchType === 'CHECK_IN' ? 'Checked in.' : 'Checked out.'));
      await Promise.all([refreshToday(), fetchCalendarData()]);
    } catch (err: any) {
      ToasterService.error(apiError(err, 'Could not record your attendance.'));
    } finally {
      setIsPunching(false);
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      ToasterService.error('Please select both From and To dates.');
      return;
    }
    if (leaveForm.toDate < leaveForm.fromDate) {
      ToasterService.error('End Date cannot be before Start Date.');
      return;
    }
    if (!leaveForm.reason.trim()) {
      ToasterService.error('Please give a reason.');
      return;
    }

    setIsSubmittingLeave(true);
    try {
      // The server counts the working days and checks the balance
      const res = await axios.post('/v1/api/attendance/leave-requests', {
        leaveType: leaveForm.leaveType,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        halfDay: false,
        reason: leaveForm.reason.trim(),
      });
      ToasterService.success(`Leave request for ${formatDays(res.data?.totalDays)} day(s) sent for approval.`);
      setIsApplyLeaveModalOpen(false);
      setLeaveForm({
        leaveType: balances[0]?.leaveType || 'CASUAL',
        fromDate: todayIso(),
        toDate: todayIso(),
        reason: ''
      });
      fetchCalendarData();
    } catch (err: any) {
      ToasterService.error(apiError(err, 'Could not submit the leave request.'));
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const calendarDays = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = leadingDays(year, month);
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const days: { 
      dayNumber: number; 
      currentMonth: boolean; 
      dateStr: string;
      status?: DayStatus;
      details?: string;
      inTime?: string | null;
      outTime?: string | null;
      workedMinutes?: number;
      lateMinutes?: number | null;
      badgeText?: string;
    }[] = [];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthLastDate - i,
        currentMonth: false,
        dateStr: ''
      });
    }

    const todayStr = todayIso();

    // Current month days, as the server resolved them
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dStr === todayStr;
      const server = monthDays.find((d) => d.date === dStr);
      const kind = dayKind(server);

      let dayStatus: DayStatus = 'REGULAR';
      let dayDetails = '';
      let badge: string | undefined = DAY_KIND_BADGE[kind] || undefined;
      const inTimeVal = server?.inTime ?? null;
      const outTimeVal = server?.outTime ?? null;
      const workedMins = server?.workedMinutes ?? undefined;
      const lateMins = server?.lateMinutes ?? null;

      switch (kind) {
        case 'PRESENT':
        case 'CHECKED_IN':
          dayStatus = 'PRESENT';
          badge = 'P';
          dayDetails = `Present (${timeOf(inTimeVal) || 'checked in'}${outTimeVal && kind === 'PRESENT' ? ` - ${timeOf(outTimeVal)}` : ''})`;
          break;
        case 'LATE':
          dayStatus = 'LATE';
          badge = 'LATE';
          dayDetails = `Late by ${lateMins || 0}m (${timeOf(inTimeVal)})`;
          break;
        case 'HALF_DAY':
          dayStatus = 'HALF_DAY';
          dayDetails = `Half day (${hoursOf(workedMins)} worked)`;
          break;
        case 'ABSENT':
          dayStatus = 'ABSENT';
          dayDetails = 'Absent';
          break;
        case 'LEAVE':
          dayStatus = 'LEAVE';
          dayDetails = `${leaveTypeLabel(server?.leaveType) || 'On'} leave${server?.halfDayLeave ? ' (half day)' : ''}`;
          break;
        case 'HOLIDAY':
          dayStatus = 'HOLIDAY';
          dayDetails = server?.holidayName || 'Holiday';
          break;
        case 'WEEK_OFF':
          dayStatus = 'WEEK_OFF';
          badge = undefined;
          dayDetails = 'Weekly off';
          break;
        case 'ON_DUTY':
          dayStatus = 'ON_DUTY';
          dayDetails = 'On duty';
          break;
        case 'WFH':
          dayStatus = 'WFH';
          dayDetails = 'Work from home';
          break;
        default:
          dayStatus = isToday ? 'TODAY' : 'REGULAR';
          badge = undefined;
          dayDetails = isToday ? 'Today' : '';
      }
      if (server?.regularized && dayDetails) dayDetails += ' · regularized';

      days.push({
        dayNumber: i,
        currentMonth: true,
        dateStr: dStr,
        status: dayStatus,
        details: dayDetails,
        inTime: inTimeVal,
        outTime: outTimeVal,
        workedMinutes: workedMins,
        lateMinutes: lateMins,
        badgeText: badge
      });
    }

    return days;
  }, [year, month, monthDays]);

  // Filtered days based on filter pills
  const filteredCalendarDays = useMemo(() => {
    if (activeRequestFilter === 'ALL') return calendarDays;
    return calendarDays.map(day => {
      if (!day.currentMonth) return day;
      if (activeRequestFilter === 'PRESENT' && day.status !== 'PRESENT' && day.status !== 'TODAY') return { ...day, status: 'REGULAR' as const };
      if (activeRequestFilter === 'ABSENT' && day.status !== 'ABSENT') return { ...day, status: 'REGULAR' as const };
      if (activeRequestFilter === 'LATE' && day.status !== 'LATE') return { ...day, status: 'REGULAR' as const };
      if (activeRequestFilter === 'LEAVE' && day.status !== 'LEAVE') return { ...day, status: 'REGULAR' as const };
      if (activeRequestFilter === 'HOLIDAY' && day.status !== 'HOLIDAY') return { ...day, status: 'REGULAR' as const };
      return day;
    });
  }, [calendarDays, activeRequestFilter]);

  const handleSelectRequestType = (type: string) => {
    setShowRequestDropdown(false);
    if (type === 'On Duty') {
      navigate('/att_requests');
    } else if (type === 'Attendance Regularization') {
      navigate('/att_timesheetManagement');
    } else if (type === 'Apply Leave') {
      navigate('/att_leaveRequest');
    }
  };

  return (
    <>
      <PageMeta title={t("Employee Self Service")} description="Self Service portal for leave and attendance requests" />
      <PageBreadcrumb pageTitle="Self Service" />

      <div className="max-w-7xl mx-auto pb-8 space-y-5 animate-in fade-in duration-200">
        
        {/* Top Minimal Welcome Card with 1-Click Web Punch & Quick Apply Leave */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-[#303030] shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-[#222222] border border-slate-200/80 dark:border-[#303030] flex items-center justify-center text-slate-700 dark:text-gray-200 font-bold text-sm shrink-0 shadow-2xs">
              {currentUser.name ? currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'RH'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{currentUser.name}</h1>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300 border border-slate-200/60 dark:border-[#303030]">
                  {currentUser.code}
                </span>
                {isCheckedIn ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {t("Clocked In")} {todayInFormatted ? `at ${todayInFormatted}` : ''}
                  </span>
                ) : onLeaveToday ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-50 border border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-300">
                    {t("On leave today")}{todayDay?.leaveType ? ` (${leaveTypeLabel(todayDay.leaveType)})` : ''}
                  </span>
                ) : isCheckedOut ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] text-slate-700 dark:text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
                    {t("Clocked Out for Today")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] text-slate-600 dark:text-gray-400">
                    {t("Not Clocked In Yet")}
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-gray-400 text-xs mt-1 flex items-center gap-2.5 flex-wrap">
                <span>{t("{greeting}! Hope you have an awesome day.", { greeting })}</span>
                <span className="hidden sm:inline text-slate-300 dark:text-gray-600">•</span>
                <span className="text-slate-600 dark:text-gray-300 text-[11px]">
                  {balances.length === 0 ? t('No leave policy assigned yet') : (
                    <>Leave balance: {balances.map((b, i) => (
                      <React.Fragment key={b.id}>{i > 0 && ', '}<strong className="text-slate-800 dark:text-white">{formatDays(freeDays(b))}</strong> {leaveTypeLabel(b.leaveType)}</React.Fragment>
                    ))}</>
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons: Minimal Clean Styling */}
          <div className="flex items-center gap-2.5 w-full md:w-auto self-end md:self-center justify-end">
            <button
              onClick={() => setIsApplyLeaveModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#222222] hover:bg-slate-50 dark:hover:bg-[#2a2a2a] active:scale-95 border border-slate-200 dark:border-[#303030] text-slate-700 dark:text-gray-200 transition shadow-2xs cursor-pointer"
              title={t("Apply Leave")}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("Apply Leave")}</span>
            </button>

            {isCheckedIn ? (
              <button
                onClick={() => handleWebPunch('CHECK_OUT')}
                disabled={isPunching}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition shadow-2xs cursor-pointer"
                title={t("Clock Out")}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-900"></span>
                </span>
                <span>{t("Clock Out")}</span>
              </button>
            ) : (
              <button
                onClick={() => handleWebPunch('CHECK_IN')}
                disabled={isPunching || !currentUser.hasEmployee || onLeaveToday}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-60 disabled:cursor-not-allowed bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white transition shadow-xs cursor-pointer"
                title={onLeaveToday ? 'You are on leave today' : 'Clock In'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("Clock In")}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2-Column Main Layout matching Screenshot */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Feed & Highlights */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Highlights Card */}
            <div className="bg-white dark:bg-[#191919] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#303030] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#303030] pb-2.5">
                <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{t("Highlights")}</h3>
              </div>

              <div className="p-3 bg-slate-50/70 dark:bg-[#222222] rounded-xl border border-slate-200/60 dark:border-[#303030] flex items-start gap-3">
                <Gift className="w-4.5 h-4.5 text-slate-500 dark:text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">{t("Today's Celebration")}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">{t("Check team birthdays and work anniversaries")}</p>
                </div>
              </div>
            </div>

            {/* Activity Feed Card */}
            <div className="bg-white dark:bg-[#191919] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#303030] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#303030] pb-2.5">
                <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{t("Feed")}</h3>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition">{t("Refresh feed")}</span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50/70 dark:bg-[#222222] rounded-xl border border-slate-100 dark:border-[#303030] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">{t("Operational Support Update")}</span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">{t("1 year ago")}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-gray-300">{t("Moving forward, access all organizational updates via TEKInsider")}</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Attendance Calendar & Raise Request Popover */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Interactive Calendar Card */}
            <div className="bg-white dark:bg-[#191919] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#303030] shadow-2xs space-y-3 relative">
              
              {/* Calendar Header with Navigation & Dropdown trigger */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#303030] pb-2.5">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-2 py-0.5 rounded-xl border border-slate-200/70 dark:border-[#303030] shadow-2xs">
                  <button 
                    type="button" 
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider min-w-[110px] text-center">
                    {monthNames[month]} {year}<HijriMonthCaption year={year} month={month} />
                  </span>
                  <button 
                    type="button" 
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {/* Expand Calendar Button */}
                  <button
                    type="button"
                    onClick={() => setIsCalendarExpanded(true)}
                    className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                    title={t("Expand Calendar View")}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowRequestDropdown(prev => !prev)}
                      className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-xl text-sm font-semibold flex items-center justify-center transition cursor-pointer"
                      title={t("Raise Request Options")}
                    >
                      <span className="leading-none text-base font-bold">⋮</span>
                    </button>

                  {/* Professional Raise Request Dropdown Menu */}
                  {showRequestDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowRequestDropdown(false)} 
                      />
                      
                      <div className="absolute right-0 top-8 w-60 bg-white dark:bg-[#191919] rounded-xl shadow-2xl border border-slate-200 dark:border-[#303030] z-50 py-1.5 text-xs animate-in zoom-in-95 fade-in duration-150 ring-1 ring-black/5 divide-y divide-slate-100 dark:divide-[#303030]">
                        <div className="px-3.5 py-2 flex items-center justify-between bg-slate-50 dark:bg-[#222222]">
                          <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-gray-400 uppercase">
                            {t("Raise Request For")}
                          </span>
                          <span className="text-[9px] font-semibold bg-slate-200 dark:bg-[#303030] text-slate-700 dark:text-gray-200 px-1.5 py-0.5 rounded-full">
                            {t("Fast Action")}
                          </span>
                        </div>

                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => handleSelectRequestType('On Duty')}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-3 transition-colors group cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{t("On duty")}</div>
                              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">{t("Official client & site visits")}</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectRequestType('Attendance Regularization')}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-3 transition-colors group cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-2xs">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{t("Attendance regularization")}</div>
                              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">{t("Correct missed check-ins/outs")}</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectRequestType('Apply Leave')}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-[#222222] text-slate-700 dark:text-gray-200 hover:text-slate-900 dark:hover:text-white font-medium flex items-center gap-3 transition-colors group cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-2xs">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{t("Apply leave")}</div>
                              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">{t("Casual, sick & earned leave")}</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
              </div>

              {/* Minimal Live Leave Quotas Bar */}
              <div className="flex items-center justify-between gap-1 bg-slate-50/80 dark:bg-[#222222] px-2.5 py-1.5 rounded-xl border border-slate-200/60 dark:border-[#303030] text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mr-0.5">{t("Quotas:")}</span>
                  {balances.length === 0 && (
                    <span className="text-[9.5px] text-slate-400 dark:text-gray-500">{t("No leave policy assigned")}</span>
                  )}
                  {balances.map((b) => (
                    <div key={b.id} title={`${leaveTypeLabel(b.leaveType)}: ${formatDays(freeDays(b))} free of ${formatDays(b.allocatedLeaves)}${b.pendingApprovalLeaves ? `, ${formatDays(b.pendingApprovalLeaves)} waiting for approval` : ''}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#191919] border border-slate-200 dark:border-[#303030] text-[9.5px] font-semibold text-slate-700 dark:text-gray-200 shadow-2xs">
                      <span className="font-bold text-slate-400 dark:text-gray-500">{leaveTypeLabel(b.leaveType)}</span>
                      <span className="font-mono text-slate-900 dark:text-white font-bold">{formatDays(freeDays(b))}</span>
                      <span className="text-slate-400 dark:text-gray-500 text-[8.5px]">/{formatDays(b.allocatedLeaves)}d</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/att_leaveRequest')}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[10px] font-semibold transition shadow-xs shrink-0 cursor-pointer"
                >
                  {t("+ Apply")}
                </button>
              </div>

              {/* Month Days Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-medium text-slate-400 dark:text-gray-500 py-1 px-1 mb-1">
                {weekdayLabels("min").map((d) => <span key={d}>{d}</span>)}
              </div>

              {/* Month Days Matrix with Clean Minimal Aesthetic */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {filteredCalendarDays.map((day, idx) => {
                  if (!day.currentMonth) {
                    return (
                      <div key={idx} className="min-h-8 p-1 text-[11px] text-slate-300 dark:text-gray-600 bg-slate-50/50 dark:bg-[#191919]/40 rounded-lg border border-slate-100 dark:border-[#303030]/60 flex items-start justify-center font-medium">
                        {day.dayNumber}
                      </div>
                    );
                  }

                  const isToday = day.dateStr === todayStr;
                  const look = STATUS_LOOK[day.status as string] ?? STATUS_LOOK.REGULAR;
                  const code = SHORT_CODE[day.status as string];

                  return (
                    <div
                      key={idx}
                      onClick={() => setIsCalendarExpanded(true)}
                      title={day.details || `${isToday ? 'Today: ' : 'Date: '}${day.dateStr} (Click to expand details)`}
                      className={`h-8 px-1.5 py-1 rounded-lg border border-l-[3px] text-left flex items-center justify-between transition-all cursor-pointer hover:scale-102 overflow-hidden relative ${look.cell} ${look.accent} ${isToday ? 'ring-2 ring-[#4DD0E1]' : ''}`}
                    >
                      <span className={`text-[11px] leading-none shrink-0 ${
                        isToday ? 'w-5 h-5 rounded-full bg-[#0097a7] text-white font-semibold text-[10px] flex items-center justify-center shadow-2xs' : 'font-bold text-slate-800 dark:text-gray-100'
                      }`}>
                        {day.dayNumber}
                      </span>
                      {code && (
                        <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase leading-none shrink-0 ${look.badge}`}>{code}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend: the same colours and short codes as the days */}
              <div className="pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center text-[10px] text-slate-600 dark:text-gray-400 font-medium flex-wrap gap-x-2.5 gap-y-1">
                {['PRESENT', 'LATE', 'HALF_DAY', 'LEAVE', 'ABSENT', 'HOLIDAY', 'WEEK_OFF', 'ON_DUTY', 'WFH'].map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <span className={`rounded px-1 py-px text-[8px] font-bold ${STATUS_LOOK[s].badge}`}>{SHORT_CODE[s]}</span>
                    {t(STATUS_LOOK[s].label)}
                  </span>
                ))}
              </div>

            </div>

          </div>

        </div>

        {/* Full-Screen Expanded Minimalist Calendar Modal */}
        {isCalendarExpanded && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-150"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCalendarExpanded(false);
            }}
          >
            <div 
              className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-[#303030] w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              
              {/* Minimalist Modal Header */}
              <div className="px-6 py-3 border-b border-slate-100 dark:border-[#303030] flex items-center justify-between bg-white dark:bg-[#191919] shrink-0">
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight leading-none">{t("Attendance Calendar")}</h2>
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">{t("Monthly breakdown, punch records, and leave history")}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-50 dark:bg-[#222222] border border-slate-200/70 dark:border-[#303030] rounded-lg p-0.5">
                    <button 
                      type="button" 
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] hover:shadow-2xs rounded-md text-slate-500 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-semibold text-slate-800 dark:text-white min-w-[110px] text-center">
                      {monthNames[month]} {year}<HijriMonthCaption year={year} month={month} />
                    </span>
                    <button 
                      type="button" 
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] hover:shadow-2xs rounded-md text-slate-500 dark:text-gray-300 hover:text-slate-800 dark:hover:text-white transition-all cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => setIsCalendarExpanded(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-lg transition-colors cursor-pointer"
                    title={t("Close")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Minimalist Legend Bar */}
              <div className="px-6 py-2 bg-slate-50/50 dark:bg-[#222222] border-b border-slate-100 dark:border-[#303030] flex items-center justify-end flex-wrap gap-3.5 text-[11px] text-slate-500 dark:text-gray-400 font-normal shrink-0">
                {['PRESENT', 'LATE', 'HALF_DAY', 'LEAVE', 'ABSENT', 'HOLIDAY', 'WEEK_OFF', 'ON_DUTY', 'WFH'].map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className={`rounded px-1 py-px text-[8.5px] font-bold uppercase ${STATUS_LOOK[s].badge}`}>{t(STATUS_LOOK[s].label)}</span>
                  </div>
                ))}
              </div>

              {/* Minimal Calendar Grid Container */}
              <div className="p-2 sm:p-3 flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-[#141414] min-h-0">
                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider py-1 shrink-0 mb-1">
                  {weekdayLabels().map((d) => <span key={d}>{d}</span>)}
                </div>

                {/* Minimal Month Days Matrix */}
                <div 
                  className="grid grid-cols-7 gap-1.5 text-left flex-1 h-full min-h-0"
                  style={{ gridTemplateRows: `repeat(${Math.ceil(filteredCalendarDays.length / 7) || 5}, minmax(0, 1fr))` }}
                >
                  {filteredCalendarDays.map((day, idx) => {
                    if (!day.currentMonth) {
                      return (
                        <div key={idx} className="h-full min-h-0 p-2 text-[10px] text-slate-300 dark:text-gray-600 bg-slate-50/40 dark:bg-[#191919]/40 rounded-xl border border-slate-100 dark:border-[#303030]/50 flex items-start justify-start font-medium">
                          {day.dayNumber}
                        </div>
                      );
                    }

                    const isToday = day.dateStr === todayStr;
                    const look = STATUS_LOOK[day.status as string] ?? STATUS_LOOK.REGULAR;
                    const cardStyle = `border border-l-[3px] ${look.cell} ${look.accent} hover:shadow-2xs text-slate-800 dark:text-white ${isToday ? 'ring-2 ring-[#4DD0E1]' : ''}`;
                    const numBadgeStyle = isToday
                      ? 'w-5 h-5 rounded-full bg-[#0097a7] text-white font-semibold text-[10px] flex items-center justify-center shrink-0 shadow-2xs'
                      : 'text-slate-800 dark:text-gray-100 font-bold text-xs sm:text-[13px]';

                    const inFormatted = day.inTime ? (day.inTime.includes('T') ? formatTime(day.inTime) : day.inTime) : null;
                    const outFormatted = day.outTime ? (day.outTime.includes('T') ? formatTime(day.outTime) : day.outTime) : null;

                    return (
                      <div
                        key={idx}
                        title={day.details || `Date: ${day.dateStr}`}
                        className={`h-full min-h-0 p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer overflow-hidden ${cardStyle}`}
                      >
                        {/* Day Card Header: Day Number + Minimal Status Badge */}
                        <div className="flex items-center justify-between gap-1 leading-none shrink-0 mb-0.5">
                          <span className={`leading-none ${numBadgeStyle}`}>
                            {day.dayNumber}
                          </span>

                          {look.label && (
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${look.badge}`}>
                              {t(look.label)}
                            </span>
                          )}
                        </div>

                        {/* Minimalist Punch Times & Details */}
                        <div className="flex flex-col gap-0.5 mt-auto pt-1 border-t border-slate-100 dark:border-[#303030] shrink-0">
                          {inFormatted && (
                            <div className="flex items-center justify-between text-[8px] sm:text-[8.5px] leading-tight">
                              <span className="text-[7.5px] font-medium text-slate-400 dark:text-gray-500">{t("In")}</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-gray-200 truncate pl-1">{inFormatted}</span>
                            </div>
                          )}

                          {outFormatted && (
                            <div className="flex items-center justify-between text-[8px] sm:text-[8.5px] leading-tight">
                              <span className="text-[7.5px] font-medium text-slate-400 dark:text-gray-500">{t("Out")}</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-gray-200 truncate pl-1">{outFormatted}</span>
                            </div>
                          )}

                          {!inFormatted && !outFormatted && day.details && day.details !== 'Today' && (
                            <div className={`text-[8px] font-medium truncate ${
                              day.status === 'LEAVE' ? 'text-purple-600 dark:text-purple-400' :
                              day.status === 'HOLIDAY' ? 'text-amber-600 dark:text-amber-400' :
                              day.status === 'ABSENT' ? 'text-rose-600 dark:text-rose-400' :
                              'text-slate-500 dark:text-gray-400'
                            }`} title={day.details}>
                              {day.details}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>,
          document.body
        )}

        {/* Quick Apply Leave Modal */}
        {isApplyLeaveModalOpen && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsApplyLeaveModalOpen(false);
            }}
          >
            <div 
              className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#303030] max-w-md w-full overflow-hidden ring-1 ring-black/10 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-[#303030] bg-gray-50/70 dark:bg-[#222222]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{t("Apply Leave")}</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("Quick 1-click leave application")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#222222] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyLeaveSubmit} className="p-5 space-y-4">
                {/* Available Leave Balances */}
                {balances.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl">
                    {t("No leave policy is assigned to you yet. Ask HR to assign one before applying.")}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-[#222222] p-2.5 rounded-xl border border-slate-200/60 dark:border-[#303030] text-center">
                    {balances.map((b) => (
                      <div key={b.id}>
                        <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block">{leaveTypeLabel(b.leaveType)}</span>
                        <span className="text-xs font-extrabold text-cyan-700 dark:text-cyan-400">{formatDays(freeDays(b))} days</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("Leave Type")}</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveType: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-[#303030] rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                  >
                    {balances.map((b) => (
                      <option key={b.id} value={b.leaveType} className="dark:bg-[#222222]">
                        {leaveTypeLabel(b.leaveType)} leave ({formatDays(freeDays(b))} free)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("From Date")}</label>
                    <input
                      type="date"
                      value={leaveForm.fromDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveDate: e.target.value, fromDate: e.target.value }))}
                      required
                      className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-[#303030] rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("To Date")}</label>
                    <input
                      type="date"
                      value={leaveForm.toDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, toDate: e.target.value }))}
                      required
                      className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-[#303030] rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{t("Reason / Note")}</label>
                  <textarea
                    rows={2}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder={t("Brief reason for your leave request...")}
                    className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-[#303030] rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#303030]">
                  <button
                    type="button"
                    onClick={() => setIsApplyLeaveModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#222222] rounded-lg transition cursor-pointer"
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {isSubmittingLeave && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{t("Submit Request")}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      </div>
    </>
  );
};

export default EmployeeSelfServicePage;
