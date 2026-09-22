import React, { useState, useEffect, useMemo, useContext } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  UserCheck, Clock, AlertCircle, X, 
  FileText, Download, RotateCw, Calendar,
  TrendingUp, AlertTriangle, Gift, Briefcase,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { ToasterService } from '../../Services/ToasterService';
import { AuthContext } from '../../context/AuthContext';

// ── API Schema Interfaces for GET /v1/api/attendance/records/my-calendar/{employeeId}
export interface CalendarDayModel {
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | string;
  inTime?: string | null;
  outTime?: string | null;
  workedMinutes?: number;
  lateMinutes?: number | null;
  earlyExitMinutes?: number;
  overtimeMinutes?: number;
  leaveType?: string | null;
  holidayName?: string | null;
}

export interface MyCalendarResponseModel {
  employeeId: number;
  year: number;
  month: number;
  days: CalendarDayModel[];
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatDisplayTime = (timeStr?: string | null): string => {
  if (!timeStr || timeStr === '-' || timeStr === 'N/A') return '-';
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }
  return timeStr;
};

const formatMinutesToHoursStr = (totalMins: number = 0): string => {
  if (!totalMins || totalMins <= 0) return '0h 00m';
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
};

const AttendanceTrackingPage: React.FC = () => {
  const { user } = useContext(AuthContext);

  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        const rawId = parsed.employeeId || parsed.id || parsed.userId;
        return {
          id: rawId ? Number(rawId) : 0,
          name: parsed.fullName || parsed.name || parsed.username || 'User',
          role: parsed.role || parsed.roles?.[0] || ''
        };
      } catch (e) {}
    }
    return {
      id: user?.id ? Number(user.id) : 0,
      name: user?.fullName || user?.username || 'User',
      role: user?.role || ''
    };
  }, [user]);

  // ── Dynamic States ──────────────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); // Dynamic current system date
  const [employeeList, setEmployeeList] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<number>(0);
  const [selectedDayRecord, setSelectedDayRecord] = useState<CalendarDayModel | null>(null);
  const [calendarData, setCalendarData] = useState<MyCalendarResponseModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'>('ALL');
  const [deleteConfirmDay, setDeleteConfirmDay] = useState<CalendarDayModel | null>(null);

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth() + 1; // 1-12

  // ── Fetch Employee Master Dropdown ─────────────────────────────────────
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get('/v1/api/payroll/employee/all');
        if (Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((e: any) => ({
            id: Number(e.id),
            name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.fullName || `Employee #${e.id}`,
            code: e.employeeCode || `EMP-${e.id}`
          }));
          setEmployeeList(mapped);

          // Find match for logged-in user or select first employee
          const uName = (currentUser.name || '').toLowerCase().trim();
          const match = mapped.find(e => e.name.toLowerCase().includes(uName) || uName.includes(e.name.toLowerCase()));
          const initialId = match ? match.id : (currentUser.id || mapped[0].id);
          setSelectedEmpId(initialId);
        }
      } catch (e) {
        console.warn("Failed to fetch employee list:", e);
      }
    };
    fetchEmployees();
  }, [currentUser]);

  // ── API: GET ATTENDANCE CALENDAR RECORDS BY EMPLOYEE ID ───────────────
  // GET -> /v1/api/attendance/records/my-calendar/{employeeId}?employeeId={empId}&year={year}&month={month}
  const fetchMyCalendarAttendance = async () => {
    const targetEmpId = selectedEmpId || currentUser.id;
    if (!targetEmpId) return;

    setLoading(true);
    try {
      const res = await axios.get<MyCalendarResponseModel>(
        `/v1/api/attendance/records/my-calendar/${targetEmpId}`,
        {
          params: {
            employeeId: targetEmpId,
            year: selectedYear,
            month: selectedMonth
          }
        }
      );

      if (res.data && Array.isArray(res.data.days)) {
        setCalendarData(res.data);
      } else {
        setCalendarData(null);
      }
    } catch (err: any) {
      console.warn("Failed to fetch attendance calendar records:", err);
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

  // Month Switcher
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Derived KPI Stats from API payload
  const kpiStats = useMemo(() => {
    const days = calendarData?.days || [];
    const totalDays = days.length;
    const presentDays = days.filter(d => String(d.status).toUpperCase() === 'PRESENT').length;
    const absentDays = days.filter(d => String(d.status).toUpperCase() === 'ABSENT').length;
    const lateDays = days.filter(d => Boolean(d.lateMinutes && d.lateMinutes > 0));
    const totalLateMinutes = lateDays.reduce((acc, d) => acc + (d.lateMinutes || 0), 0);
    const totalOvertimeMinutes = days.reduce((acc, d) => acc + (d.overtimeMinutes || 0), 0);
    const totalWorkedMinutes = days.reduce((acc, d) => acc + (d.workedMinutes || 0), 0);
    const leaveDays = days.filter(d => Boolean(d.leaveType || d.holidayName)).length;

    return {
      totalDays,
      presentDays,
      absentDays,
      lateCount: lateDays.length,
      totalLateMinutes,
      totalOvertimeMinutes,
      totalWorkedMinutes,
      leaveDays
    };
  }, [calendarData]);

  // Filtered List for Search & Status Pills
  const filteredDays = useMemo(() => {
    const days = calendarData?.days || [];
    return days.filter(d => {
      const matchesSearch = !searchQuery || 
        d.date.includes(searchQuery) || 
        (d.holidayName && d.holidayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.leaveType && d.leaveType.toLowerCase().includes(searchQuery.toLowerCase()));

      const st = String(d.status).toUpperCase();
      let matchesStatus = true;
      if (statusFilter === 'PRESENT') matchesStatus = st === 'PRESENT';
      if (statusFilter === 'ABSENT') matchesStatus = st === 'ABSENT';
      if (statusFilter === 'LATE') matchesStatus = Boolean(d.lateMinutes && d.lateMinutes > 0);
      if (statusFilter === 'LEAVE') matchesStatus = Boolean(d.leaveType || d.holidayName);

      return matchesSearch && matchesStatus;
    });
  }, [calendarData, searchQuery, statusFilter]);

  // Export CSV
  const handleExportCSV = () => {
    const data = filteredDays.map(d => ({
      "Date": d.date,
      "Status": d.status,
      "In Time": formatDisplayTime(d.inTime),
      "Out Time": formatDisplayTime(d.outTime),
      "Worked Duration": formatMinutesToHoursStr(d.workedMinutes),
      "Late Minutes": d.lateMinutes || 0,
      "Overtime Minutes": d.overtimeMinutes || 0,
      "Early Exit Minutes": d.earlyExitMinutes || 0,
      "Holiday / Leave": d.holidayName || d.leaveType || "N/A"
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance_Calendar");
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `Attendance_Calendar_${selectedYear}_${selectedMonth}.xlsx`);
    ToasterService.success("Attendance Excel Noticeboard exported!");
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`Attendance Calendar Record - ${monthNames[selectedMonth - 1]} ${selectedYear}`, 14, 16);
    autoTable(doc, {
      head: [["Date", "Status", "In Time", "Out Time", "Worked", "Late", "Overtime", "Remarks"]],
      body: filteredDays.map(d => [
        d.date,
        d.status,
        formatDisplayTime(d.inTime),
        formatDisplayTime(d.outTime),
        formatMinutesToHoursStr(d.workedMinutes),
        d.lateMinutes ? `${d.lateMinutes}m` : '-',
        d.overtimeMinutes ? `${d.overtimeMinutes}m` : '-',
        d.holidayName || d.leaveType || '-'
      ]),
      startY: 22,
    });
    doc.save(`Attendance_Calendar_${selectedYear}_${selectedMonth}.pdf`);
    ToasterService.success("PDF exported!");
  };

  // Delete Action Confirmation
  const confirmDeleteDayRecord = () => {
    if (!deleteConfirmDay) return;
    setCalendarData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        days: prev.days.filter(d => d.date !== deleteConfirmDay.date)
      };
    });
    setDeleteConfirmDay(null);
    ToasterService.success(`Attendance log for ${deleteConfirmDay.date} removed.`);
  };

  // Filtered Days Set for Calendar Matrix
  const filteredDaysSet = useMemo(() => {
    const set = new Set<string>();
    const days = calendarData?.days || [];
    days.forEach(d => {
      const st = String(d.status || '').toUpperCase();
      let matchesStatus = true;

      if (statusFilter === 'PRESENT') {
        matchesStatus = st === 'PRESENT' || st === 'CHECKED_IN';
      } else if (statusFilter === 'ABSENT') {
        matchesStatus = st === 'ABSENT';
      } else if (statusFilter === 'LATE') {
        matchesStatus = Boolean(d.lateMinutes && d.lateMinutes > 0) || st.includes('LATE');
      } else if (statusFilter === 'LEAVE') {
        matchesStatus = Boolean(d.leaveType || d.holidayName) || st.includes('LEAVE') || st.includes('HALF') || st.includes('ON_LEAVE');
      }

      const matchesSearch = !searchQuery || 
        d.date.includes(searchQuery) || 
        (d.holidayName && d.holidayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.leaveType && d.leaveType.toLowerCase().includes(searchQuery.toLowerCase()));

      if (matchesStatus && matchesSearch) {
        set.add(d.date);
      }
    });
    return set;
  }, [calendarData, searchQuery, statusFilter]);

  const totalWeeks = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayWeekday = new Date(year, month, 1).getDay();
    const totalDays = firstDayWeekday + daysInMonth;
    return Math.ceil(totalDays / 7);
  }, [currentDate]);

  // ── Render Ultra-Compact Interactive Monthly 7-Column Calendar Grid ─────
  const renderInteractiveMonthCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-11
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
    const prevMonthDays = new Date(year, month, 0).getDate();

    const dayMap = new Map<string, CalendarDayModel>();
    (calendarData?.days || []).forEach(d => {
      dayMap.set(d.date, d);
    });

    const cells = [];

    // 1. Padding days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const pDay = prevMonthDays - i;
      cells.push(
        <div key={`prev-${i}`} className="p-1 text-[11px] text-slate-300 dark:text-gray-600 bg-slate-50/50 dark:bg-[#191919]/40 rounded-lg border border-slate-100 dark:border-[#303030]/60 flex items-start justify-center font-medium h-full min-h-0 pointer-events-none">
          {pDay}
        </div>
      );
    }

    // 2. Current Month Days
    const todayStr = new Date().toISOString().split('T')[0];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayData = dayMap.get(dateStr);
      const isToday = dateStr === todayStr;
      const dayOfWeek = new Date(year, month, dayNum).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const isFilteredMatch = statusFilter === 'ALL' || (dayData && filteredDaysSet.has(dateStr));

      const isPresent = dayData && (String(dayData.status).toUpperCase() === 'PRESENT' || String(dayData.status).toUpperCase() === 'CHECKED_IN');
      const isAbsent = dayData && String(dayData.status).toUpperCase() === 'ABSENT';
      const isLate = dayData && Boolean(dayData.lateMinutes && dayData.lateMinutes > 0);
      const isOvertime = dayData && Boolean(dayData.overtimeMinutes && dayData.overtimeMinutes > 0);
      const isLeave = dayData && (Boolean(dayData.leaveType || dayData.holidayName) || String(dayData.status).toUpperCase().includes('LEAVE') || String(dayData.status).toUpperCase().includes('HALF'));

      const hasWorked = dayData && dayData.workedMinutes && dayData.workedMinutes > 0;
      const hasPunch = dayData && (dayData.inTime || dayData.outTime);

      let cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-2xs text-slate-700 dark:text-gray-200';
      let numBadgeStyle = 'text-slate-700 dark:text-gray-200 font-medium text-[11px]';

      if (isToday) {
        cardStyle = 'border-sky-300 dark:border-sky-500/80 bg-sky-50/40 dark:bg-sky-950/40 ring-1 ring-sky-200 dark:ring-sky-500/30 text-sky-900 dark:text-sky-300 shadow-2xs';
        numBadgeStyle = 'w-5 h-5 rounded-full bg-sky-600 text-white font-semibold text-[10px] flex items-center justify-center shrink-0 shadow-2xs';
      } else if (isPresent) {
        cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs';
      } else if (isLate) {
        cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs';
      } else if (isLeave) {
        cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-purple-300 dark:hover:border-purple-700 shadow-2xs';
      } else if (isAbsent) {
        cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-rose-300 dark:hover:border-rose-700 shadow-2xs';
      } else if (isWeekend && !dayData) {
        cardStyle = 'border-slate-100 dark:border-[#303030]/60 bg-slate-50/50 dark:bg-[#1a1a1a] text-slate-400 dark:text-gray-500';
        numBadgeStyle = 'text-slate-400 dark:text-gray-500 font-normal text-[11px]';
      }

      cells.push(
        <div
          key={dateStr}
          onClick={() => dayData && setSelectedDayRecord(dayData)}
          className={`p-1.5 border rounded-lg transition-all h-full min-h-0 flex flex-col justify-between cursor-pointer overflow-hidden ${
            !isFilteredMatch ? 'opacity-25 grayscale border-dashed' : ''
          } ${cardStyle}`}
        >
          {/* Top Row: Date Badge & Status Badge */}
          <div className="flex items-center justify-between gap-1 leading-none">
            <span className={numBadgeStyle}>
              {dayNum}
            </span>
            {dayData?.status && String(dayData.status).trim() !== '' && (
              <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full uppercase leading-none truncate max-w-[65px] ${
                isLeave ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200/80' :
                isPresent ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80' :
                isAbsent ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200/80' : 
                isLate ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80' :
                'bg-slate-100 dark:bg-[#222222] text-slate-500 dark:text-gray-400 border border-slate-200'
              }`}>
                {dayData.status}
              </span>
            )}
          </div>

          {/* Compact Punch Info */}
          {dayData && (hasPunch || hasWorked || dayData.holidayName || dayData.leaveType) ? (
            <div className="space-y-0.5 font-mono text-[8.5px] leading-tight">
              {hasPunch && (
                <div className="text-slate-500 dark:text-gray-400 font-medium truncate">
                  {formatDisplayTime(dayData.inTime)} {dayData.outTime ? `- ${formatDisplayTime(dayData.outTime)}` : ''}
                </div>
              )}

              <div className="flex items-center justify-between gap-1">
                {hasWorked ? (
                  <span className="font-semibold text-slate-800 dark:text-gray-200">
                    {formatMinutesToHoursStr(dayData.workedMinutes)}
                  </span>
                ) : <span />}

                {/* Compact Badges */}
                <div className="flex items-center gap-0.5 overflow-hidden">
                  {isLate && (
                    <span className="px-1 py-0.2 rounded text-[7.5px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 truncate">
                      -{dayData.lateMinutes}m
                    </span>
                  )}
                  {isOvertime && (
                    <span className="px-1 py-0.2 rounded text-[7.5px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 truncate">
                      +{dayData.overtimeMinutes}m
                    </span>
                  )}
                  {dayData.holidayName && (
                    <span className="px-1 py-0.2 rounded text-[7.5px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 truncate max-w-[50px]">
                      {dayData.holidayName}
                    </span>
                  )}
                  {dayData.leaveType && (
                    <span className="px-1 py-0.2 rounded text-[7.5px] font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200/80 truncate max-w-[50px]">
                      {dayData.leaveType}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>
      );
    }

    // 3. Trailing padding days for next month to complete the week
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const trailingCount = 7 - remainder;
      for (let j = 1; j <= trailingCount; j++) {
        cells.push(
          <div key={`next-${j}`} className="p-1 text-[11px] text-slate-300 dark:text-gray-600 bg-slate-50/50 dark:bg-[#191919]/40 rounded-lg border border-slate-100 dark:border-[#303030]/60 flex items-start justify-center font-medium h-full min-h-0 pointer-events-none">
            {j}
          </div>
        );
      }
    }

    return cells;
  };

  return (
    <>
      <div className="h-full flex flex-col min-h-0 w-full animate-in fade-in duration-200">
      <div className="shrink-0 mb-1">
        <PageMeta title="Attendance Tracking & Calendar Records" description="Live monthly attendance calendar logs, minute breakdowns, and punch audit trails" />
        <PageBreadcrumb pageTitle="Attendance Tracking & Calendar Records" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col space-y-1.5 pb-0.5">
        
        {/* ── TOP BANNER & MONTH NAVIGATION ───────────────────────────── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] py-2 px-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#222222] border border-slate-200/80 dark:border-[#303030] flex items-center justify-center text-slate-700 dark:text-gray-200 font-bold text-xs shrink-0 shadow-2xs">
              {currentUser.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {employeeList.length > 0 ? (
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                    className="py-1 px-2.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-slate-400 outline-none cursor-pointer max-w-[260px] truncate shadow-2xs"
                  >
                    {employeeList.map(emp => (
                      <option key={emp.id} value={emp.id} className="dark:bg-[#222222]">
                        {emp.name} ({emp.code}) — ID #{emp.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</h2>
                )}
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300 border border-slate-200/60 dark:border-[#303030]">
                  EMP-#{calendarData?.employeeId || selectedEmpId || currentUser.id}
                </span>
              </div>
            </div>
          </div>

          {/* Controls: Month Navigator & Export */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-2 py-1 rounded-xl border border-slate-200/60 dark:border-[#303030]">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="px-2 text-center min-w-[110px]">
                <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider block">
                  {monthNames[selectedMonth - 1]} {selectedYear}
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              
              <button
                type="button"
                onClick={fetchMyCalendarAttendance}
                className="p-1 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md transition ml-0.5 cursor-pointer"
                title="Refresh Calendar API"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600 dark:text-gray-300' : ''}`} />
              </button>
            </div>

            {/* Export Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white transition shadow-xs cursor-pointer"
                title="Export Excel"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white transition shadow-xs cursor-pointer"
                title="Export PDF"
              >
                <FileText className="w-3.5 h-3.5 text-white" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── KPI METRICS CHIPS ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
          <div className="flex items-center gap-2.5 bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#303030] rounded-xl px-3 py-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block truncate leading-tight">Total Worked</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block leading-tight">{formatMinutesToHoursStr(kpiStats.totalWorkedMinutes)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#303030] rounded-xl px-3 py-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block truncate leading-tight">Present</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block leading-tight">{kpiStats.presentDays}/{kpiStats.totalDays}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#303030] rounded-xl px-3 py-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block truncate leading-tight">Late</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block leading-tight">{kpiStats.lateCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#303030] rounded-xl px-3 py-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block truncate leading-tight">Overtime</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block leading-tight">+{formatMinutesToHoursStr(kpiStats.totalOvertimeMinutes)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#303030] rounded-xl px-3 py-2 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Gift className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider block truncate leading-tight">Absent</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono block leading-tight">{kpiStats.absentDays}</span>
            </div>
          </div>
        </div>

        {/* ── EXCLUSIVE INTERACTIVE 7-COLUMN MONTHLY CALENDAR GRID ───────── */}
        <div className="flex-1 min-h-0 max-h-[calc(100vh-200px)] flex flex-col bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] p-3 space-y-1.5">
          {/* Weekday Headers matching SelfService Page */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-medium text-slate-400 dark:text-gray-500 py-1 px-1 shrink-0">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Calendar Days Matrix */}
          <div 
            className="flex-1 min-h-0 grid grid-cols-7 gap-1.5"
            style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
          >
            {renderInteractiveMonthCalendar()}
          </div>
        </div>

      </div>
    </div>

      {/* ── MODAL 1: DETAILED MINUTE BREAKDOWN DAY INSPECTOR ─────────────── */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-[#303030] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-cyan-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-white" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase">Attendance Log Details</h3>
                  <span className="text-[10px] text-cyan-100 font-mono block">{selectedDayRecord.date}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedDayRecord(null)} className="p-1 text-white/80 hover:bg-white/10 rounded-lg cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200 dark:border-[#303030]">
                <span className="text-slate-600 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">ATTENDANCE STATUS</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  String(selectedDayRecord.status).toUpperCase() === 'PRESENT' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                }`}>
                  {selectedDayRecord.status}
                </span>
              </div>

              {/* Exact Minute Breakdown Table */}
              <div className="bg-slate-50 dark:bg-[#222222] p-3.5 rounded-xl border border-slate-200/80 dark:border-[#303030] space-y-2 font-mono">
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Check-In Timestamp:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatDisplayTime(selectedDayRecord.inTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Check-Out Timestamp:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{formatDisplayTime(selectedDayRecord.outTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Worked Minutes:</span>
                  <span className="font-bold text-cyan-800 dark:text-cyan-400">{selectedDayRecord.workedMinutes || 0} mins ({formatMinutesToHoursStr(selectedDayRecord.workedMinutes)})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Late Minutes Penalty:</span>
                  <span className={`font-bold ${selectedDayRecord.lateMinutes ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-gray-300'}`}>
                    {selectedDayRecord.lateMinutes || 0} mins
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#303030] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Overtime Minutes:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">+{selectedDayRecord.overtimeMinutes || 0} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Early Exit Minutes:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{selectedDayRecord.earlyExitMinutes || 0} mins</span>
                </div>
              </div>

              {selectedDayRecord.holidayName && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/80 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase block">Official Company Holiday</span>
                    <span className="text-xs font-bold text-rose-900 dark:text-rose-200">{selectedDayRecord.holidayName}</span>
                  </div>
                </div>
              )}

              {selectedDayRecord.leaveType && (
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl border border-cyan-200 dark:border-cyan-800/80 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold uppercase block">Leave Application</span>
                    <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200">{selectedDayRecord.leaveType}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#303030]">
                <button
                  type="button"
                  onClick={() => setSelectedDayRecord(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-[#303030] rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-[#222222] cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CUSTOM DELETE CONFIRMATION MODAL ───────────────────── */}
      {deleteConfirmDay && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-[#303030] w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-3.5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Confirm Deletion</h3>
              </div>
              <button type="button" onClick={() => setDeleteConfirmDay(null)} className="p-1 text-white/80 hover:bg-white/10 rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed font-semibold">
                Are you sure you want to remove the attendance log for date <span className="text-rose-700 dark:text-rose-400 font-bold font-mono">{deleteConfirmDay.date}</span>?
              </p>

              <div className="bg-slate-50 dark:bg-[#222222] p-2.5 rounded-xl border border-slate-200 dark:border-[#303030] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Status:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{deleteConfirmDay.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Worked Duration:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{formatMinutesToHoursStr(deleteConfirmDay.workedMinutes)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#303030]">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmDay(null)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-[#303030] rounded-lg text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-[#222222] cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteDayRecord}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendanceTrackingPage;
