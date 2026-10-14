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
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Search, Eye
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

const formatMinutesShort = (totalMins: number = 0): string => {
  if (!totalMins || totalMins <= 0) return '0m';
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
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
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

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

  // Derived days list for Mini View log table (optionally filtered by clicked mini calendar date)
  const displayDaysList = useMemo(() => {
    let list = filteredDays;
    if (selectedDateStr) {
      const match = list.filter(d => d.date === selectedDateStr);
      if (match.length > 0) return match;
    }
    return [...list].sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredDays, selectedDateStr]);

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

  // ── Render Compact Mini Monthly 7-Column Calendar Grid ─────────────────
  const renderMiniMonthCalendar = () => {
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
        <div 
          key={`mini-prev-${i}`} 
          className="h-8 sm:h-8.5 text-[10.5px] text-slate-300 dark:text-gray-600 flex items-center justify-center font-medium select-none pointer-events-none"
        >
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
      const isSelected = selectedDateStr === dateStr;
      const dayOfWeek = new Date(year, month, dayNum).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const isPresent = dayData && (String(dayData.status).toUpperCase() === 'PRESENT' || String(dayData.status).toUpperCase() === 'CHECKED_IN');
      const isAbsent = dayData && String(dayData.status).toUpperCase() === 'ABSENT';
      const isLate = dayData && Boolean(dayData.lateMinutes && dayData.lateMinutes > 0);
      const isOvertime = dayData && Boolean(dayData.overtimeMinutes && dayData.overtimeMinutes > 0);
      const isLeave = dayData && (Boolean(dayData.leaveType || dayData.holidayName) || String(dayData.status).toUpperCase().includes('LEAVE') || String(dayData.status).toUpperCase().includes('HALF'));

      let cellStyle = 'bg-slate-50/50 dark:bg-[#222222]/50 hover:bg-slate-100 dark:hover:bg-[#282828] text-slate-700 dark:text-gray-200 border-transparent';
      let numStyle = 'text-slate-700 dark:text-gray-200 font-medium text-[11px]';

      if (isSelected) {
        cellStyle = 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-400 dark:border-cyan-500 shadow-2xs ring-1 ring-cyan-400 text-cyan-900 dark:text-white';
        numStyle = 'font-bold text-[11px] text-cyan-700 dark:text-cyan-300';
      } else if (isToday) {
        cellStyle = 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200 shadow-2xs';
        numStyle = 'w-4.5 h-4.5 rounded-full bg-sky-600 text-white font-semibold text-[9.5px] flex items-center justify-center shrink-0 shadow-2xs';
      } else if (isWeekend && !dayData) {
        cellStyle = 'bg-slate-50/20 dark:bg-[#1a1a1a]/30 text-slate-400 dark:text-gray-500 border-transparent';
        numStyle = 'text-slate-400 dark:text-gray-500 text-[11px] font-normal';
      }

      cells.push(
        <button
          key={dateStr}
          type="button"
          onClick={() => {
            setSelectedDateStr(prev => prev === dateStr ? null : dateStr);
          }}
          onDoubleClick={() => dayData && setSelectedDayRecord(dayData)}
          title={`${dateStr}${dayData ? ` - ${dayData.status} ${dayData.workedMinutes ? `(${formatMinutesToHoursStr(dayData.workedMinutes)})` : ''}` : ''}`}
          className={`h-8 sm:h-8.5 p-0.5 border rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer relative group ${cellStyle}`}
        >
          <span className={numStyle}>
            {dayNum}
          </span>

          {/* Mini Status Dot */}
          <div className="flex items-center gap-0.5 h-1">
            {isPresent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-2xs" />}
            {isLate && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-2xs" />}
            {isAbsent && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-2xs" />}
            {isLeave && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-2xs" />}
            {isOvertime && !isPresent && <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shadow-2xs" />}
          </div>
        </button>
      );
    }

    // 3. Trailing padding days for next month
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const trailingCount = 7 - remainder;
      for (let j = 1; j <= trailingCount; j++) {
        cells.push(
          <div 
            key={`mini-next-${j}`} 
            className="h-8 sm:h-8.5 text-[10.5px] text-slate-300 dark:text-gray-600 flex items-center justify-center font-medium select-none pointer-events-none"
          >
            {j}
          </div>
        );
      }
    }

    return cells;
  };

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
        <div 
          key={`prev-${i}`} 
          className="p-2 bg-slate-50/40 dark:bg-[#141414] text-slate-300 dark:text-gray-600 flex flex-col justify-between select-none pointer-events-none min-h-0"
        >
          <span className="text-[11px] font-medium text-slate-300 dark:text-gray-600">{pDay}</span>
          <span className="text-[9px] text-slate-300/60 dark:text-gray-700/60 font-mono">-</span>
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
      const isFuture = dateStr > todayStr;

      // Smart Plain-English Status Determination
      let statusLabel = '';
      let statusBadgeClass = '';
      let statusDotClass = '';

      if (isWeekend) {
        if (dayData && dayData.workedMinutes && dayData.workedMinutes > 0) {
          statusLabel = 'Weekend Work';
          statusBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50';
          statusDotClass = 'bg-indigo-500';
        } else {
          statusLabel = 'Weekend';
          statusBadgeClass = 'bg-slate-100/90 text-slate-500 border-slate-200/60 dark:bg-[#222222] dark:text-gray-400 dark:border-transparent';
          statusDotClass = 'bg-slate-400';
        }
      } else if (dayData?.holidayName) {
        statusLabel = 'Holiday';
        statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50';
        statusDotClass = 'bg-purple-500';
      } else if (dayData?.leaveType) {
        statusLabel = 'Leave';
        statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50';
        statusDotClass = 'bg-purple-500';
      } else if (isToday) {
        if (dayData && dayData.inTime) {
          if (!dayData.outTime) {
            statusLabel = 'Working Now';
            statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700';
            statusDotClass = 'bg-emerald-500 animate-pulse';
          } else {
            statusLabel = 'Completed';
            statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
            statusDotClass = 'bg-emerald-500';
          }
        } else {
          statusLabel = 'Today';
          statusBadgeClass = 'bg-cyan-50 text-cyan-700 border-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-700';
          statusDotClass = 'bg-cyan-500';
        }
      } else if (dayData) {
        const rawStatus = String(dayData.status || '').toUpperCase();
        if (rawStatus === 'ABSENT') {
          if (dayData.inTime) {
            statusLabel = 'Short Hours';
            statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50';
            statusDotClass = 'bg-rose-500';
          } else {
            statusLabel = 'Absent';
            statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50';
            statusDotClass = 'bg-rose-500';
          }
        } else if (rawStatus === 'CHECKED_IN') {
          if (dayData.outTime) {
            statusLabel = 'Present';
            statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
            statusDotClass = 'bg-emerald-500';
          } else {
            statusLabel = 'Missed Out';
            statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
            statusDotClass = 'bg-amber-500';
          }
        } else if (rawStatus === 'PRESENT') {
          statusLabel = 'Present';
          statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50';
          statusDotClass = 'bg-emerald-500';
        } else if (rawStatus.includes('LATE')) {
          statusLabel = 'Late';
          statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
          statusDotClass = 'bg-amber-500';
        } else {
          statusLabel = rawStatus ? rawStatus.charAt(0) + rawStatus.slice(1).toLowerCase() : 'Present';
          statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#252525] dark:text-gray-300 dark:border-transparent';
          statusDotClass = 'bg-slate-400';
        }
      } else if (isFuture) {
        statusLabel = 'Scheduled';
        statusBadgeClass = 'bg-slate-100/60 text-slate-400 border-slate-200/50 dark:bg-[#1c1c1c] dark:text-gray-500 dark:border-transparent';
        statusDotClass = 'bg-slate-300 dark:bg-gray-600';
      } else {
        statusLabel = 'No Punch';
        statusBadgeClass = 'bg-slate-100/90 text-slate-500 border-slate-200/60 dark:bg-[#202020] dark:text-gray-400 dark:border-transparent';
        statusDotClass = 'bg-slate-400';
      }

      // Background styling
      let cellBg = 'bg-white dark:bg-[#191919]';
      if (isToday) {
        cellBg = 'bg-cyan-50/40 dark:bg-cyan-950/30 ring-1 ring-cyan-500/30';
      } else if (isWeekend) {
        cellBg = 'bg-slate-50/50 dark:bg-[#151515]';
      } else if (isFuture) {
        cellBg = 'bg-slate-50/20 dark:bg-[#181818]';
      }

      cells.push(
        <div
          key={dateStr}
          onClick={() => {
            if (dayData) {
              setSelectedDayRecord(dayData);
            } else {
              setSelectedDayRecord({
                date: dateStr,
                status: isWeekend ? 'WEEKLY_OFF' : isFuture ? 'SCHEDULED' : 'NO_RECORD',
                inTime: undefined,
                outTime: undefined,
                workedMinutes: 0,
                lateMinutes: 0,
                overtimeMinutes: 0,
                earlyExitMinutes: 0,
                logs: []
              } as any);
            }
          }}
          className={`p-2 flex flex-col justify-between transition-colors hover:bg-slate-50/90 dark:hover:bg-[#202020] cursor-pointer overflow-hidden group select-none min-h-0 ${cellBg}`}
          title={`${dateStr} (${statusLabel}) - Click to inspect audit trail`}
        >
          {/* Top Row: Date Badge & Status Badge */}
          <div className="flex items-center justify-between gap-1 leading-none shrink-0">
            {isToday ? (
              <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                {dayNum}
              </span>
            ) : (
              <span className={`text-xs font-semibold ${isWeekend && !dayData ? 'text-slate-400 dark:text-gray-500' : 'text-slate-700 dark:text-gray-300 group-hover:text-cyan-600 transition-colors'}`}>
                {dayNum}
              </span>
            )}

            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none truncate max-w-[95px] border ${statusBadgeClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass}`} />
              <span className="truncate">{statusLabel}</span>
            </span>
          </div>

          {/* Middle Row: Punch Time or Context Status */}
          <div className="my-auto py-0.5">
            {dayData && (dayData.inTime || dayData.outTime) ? (
              <div className="flex items-center gap-1 font-mono text-[9.5px] text-slate-700 dark:text-gray-200 truncate">
                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                <span className="font-semibold">{formatDisplayTime(dayData.inTime)}</span>
                {dayData.outTime ? (
                  <>
                    <span className="text-slate-400">→</span>
                    <span className="font-semibold">{formatDisplayTime(dayData.outTime)}</span>
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 text-[9px] font-sans font-medium">(No Out)</span>
                )}
              </div>
            ) : dayData?.holidayName ? (
              <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 truncate">
                {dayData.holidayName}
              </div>
            ) : dayData?.leaveType ? (
              <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 truncate">
                {dayData.leaveType}
              </div>
            ) : isToday ? (
              <div className="text-[9.5px] text-cyan-600 dark:text-cyan-400 font-medium italic">
                Waiting for punch
              </div>
            ) : isWeekend ? (
              <div className="text-[9.5px] text-slate-400 dark:text-gray-500">
                Weekly Off
              </div>
            ) : isFuture ? (
              <div className="text-[9.5px] text-slate-400 dark:text-gray-600 italic">
                Upcoming Shift
              </div>
            ) : dayData && String(dayData.status).toUpperCase() === 'PRESENT' ? (
              <div className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium">
                Manual Entry
              </div>
            ) : dayData && String(dayData.status).toUpperCase() === 'ABSENT' ? (
              <div className="text-[9.5px] text-rose-500/90 font-medium">
                Unexcused Absence
              </div>
            ) : (
              <div className="text-[9.5px] text-slate-400 dark:text-gray-500">
                No Shift Log
              </div>
            )}
          </div>

          {/* Bottom Row: Duration & Deviations */}
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100 dark:border-[#222222] text-[9.5px] font-mono leading-none shrink-0">
            <div>
              {dayData && dayData.workedMinutes && dayData.workedMinutes > 0 ? (
                <span className="font-bold text-slate-800 dark:text-gray-100">
                  {formatMinutesToHoursStr(dayData.workedMinutes)}
                </span>
              ) : dayData?.holidayName || dayData?.leaveType ? (
                <span className="text-purple-600 dark:text-purple-400 font-sans font-medium text-[9px]">
                  Paid
                </span>
              ) : isWeekend ? (
                <span className="text-slate-400 dark:text-gray-500 font-sans text-[9px]">Off</span>
              ) : isFuture ? (
                <span className="text-slate-400 dark:text-gray-600 text-[9px]">-</span>
              ) : dayData && String(dayData.status).toUpperCase() === 'ABSENT' ? (
                <span className="text-rose-500 font-bold text-[9px]">0h 00m</span>
              ) : (
                <span className="text-slate-400 dark:text-gray-500 text-[9px]">0h</span>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-hidden shrink-0">
              {dayData?.lateMinutes && dayData.lateMinutes > 0 ? (
                <span 
                  className="px-1 py-0.2 rounded text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200/90 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60 truncate"
                  title={`${dayData.lateMinutes} minutes late`}
                >
                  Late {formatMinutesShort(dayData.lateMinutes)}
                </span>
              ) : null}
              {dayData?.overtimeMinutes && dayData.overtimeMinutes > 0 ? (
                <span 
                  className="px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60 truncate"
                  title={`${dayData.overtimeMinutes} minutes overtime`}
                >
                  +{formatMinutesShort(dayData.overtimeMinutes)} OT
                </span>
              ) : null}
              <span className="text-[9px] font-semibold text-cyan-600 dark:text-cyan-400 inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5">
                Log <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
        </div>
      );
    }

    // 3. Trailing padding days for next month to complete the week
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      const trailingCount = 7 - remainder;
      for (let j = 1; j <= trailingCount; j++) {
        cells.push(
          <div 
            key={`next-${j}`} 
            className="p-2 bg-slate-50/40 dark:bg-[#141414] text-slate-300 dark:text-gray-600 flex flex-col justify-between select-none pointer-events-none min-h-0"
          >
            <span className="text-[11px] font-medium text-slate-300 dark:text-gray-600">{j}</span>
            <span className="text-[9px] text-slate-300/60 dark:text-gray-700/60 font-mono">-</span>
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
        
        {/* ── TOP BANNER: EMPLOYEE SELECTION, MONTH NAVIGATION & VIEW SWITCHER ── */}
        <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-transparent py-1.5 px-3 flex items-center justify-between gap-3 shrink-0">
          
          {/* Left: Employee Selection */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#222222] border border-slate-200/80 dark:border-transparent flex items-center justify-center text-slate-700 dark:text-gray-200 font-bold text-xs shrink-0 shadow-2xs">
              {currentUser.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              {employeeList.length > 0 ? (
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                  className="py-1 px-2.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-transparent rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-slate-400 outline-none cursor-pointer max-w-[210px] truncate shadow-2xs"
                >
                  {employeeList.map(emp => (
                    <option key={emp.id} value={emp.id} className="dark:bg-[#222222]">
                      {emp.name} ({emp.code})
                    </option>
                  ))}
                </select>
              ) : (
                <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</h2>
              )}
              <span className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300 border border-slate-200/60 dark:border-transparent shrink-0">
                EMP-#{calendarData?.employeeId || selectedEmpId || currentUser.id}
              </span>
            </div>
          </div>

          {/* Right: Month Controls, View Switcher & Export */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Month Navigator */}
            <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#222222] p-0.5 rounded-xl border border-slate-200/60 dark:border-transparent">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-lg text-slate-600 dark:text-gray-300 transition cursor-pointer"
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
                className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-lg text-slate-600 dark:text-gray-300 transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              
              <button
                type="button"
                onClick={fetchMyCalendarAttendance}
                className="p-1 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-[#2a2a2a] rounded-lg transition ml-0.5 cursor-pointer"
                title="Refresh Calendar"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-600 dark:text-gray-300' : ''}`} />
              </button>
            </div>

            {/* View Mode Toggle: [ Mini | Expand ] */}
            <div className="flex items-center bg-slate-100 dark:bg-[#222222] p-0.5 rounded-xl border border-slate-200/60 dark:border-transparent text-xs">
              <button
                type="button"
                onClick={() => setIsCalendarExpanded(false)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  !isCalendarExpanded
                    ? 'bg-white dark:bg-[#2c2c2c] text-cyan-700 dark:text-cyan-300 shadow-2xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                }`}
                title="Mini Dashboard View"
              >
                <Minimize2 className="w-3 h-3" />
                <span>Mini</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCalendarExpanded(true)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  isCalendarExpanded
                    ? 'bg-white dark:bg-[#2c2c2c] text-cyan-700 dark:text-cyan-300 shadow-2xs'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                }`}
                title="Full Expanded Calendar"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Expand</span>
              </button>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 dark:bg-[#222222] dark:hover:bg-[#282828] text-white dark:text-gray-200 transition shadow-2xs cursor-pointer active:scale-95"
                title="Export Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 dark:bg-[#222222] dark:hover:bg-[#282828] text-white dark:text-gray-200 transition shadow-2xs cursor-pointer active:scale-95"
                title="Export PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── CONDITIONAL CALENDAR VIEW: MINI OR EXPANDED ─────────────── */}
        {!isCalendarExpanded ? (
          /* ── MINI CALENDAR DASHBOARD VIEW ───────────────────────────── */
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 overflow-hidden">
            
            {/* Left: Mini Calendar Card & Monthly Summary Widget */}
            <div className="w-full lg:w-[320px] 2xl:w-[335px] shrink-0 flex flex-col bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-transparent p-3 space-y-2 overflow-hidden justify-between">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-[#262626] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-cyan-50 dark:bg-[#222222] text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Mini Calendar</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDate(new Date());
                      setSelectedDateStr(new Date().toISOString().split('T')[0]);
                    }}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-[#222222] transition cursor-pointer"
                    title="Jump to Today"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCalendarExpanded(true)}
                    className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-[#222222] rounded-lg transition cursor-pointer"
                    title="Expand Full Calendar"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 dark:text-gray-500 py-0.5 shrink-0">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>

              {/* Mini Calendar 7-Column Days Grid */}
              <div className="grid grid-cols-7 gap-1 shrink-0">
                {renderMiniMonthCalendar()}
              </div>

              {/* Monthly KPI Overview Grid */}
              <div className="pt-2 border-t border-slate-100 dark:border-[#262626] space-y-1.5 shrink-0">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider px-0.5">
                  <span>Month Summary</span>
                  <span className="font-mono text-slate-500 dark:text-gray-400">{kpiStats.totalDays} Days</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                  {/* Total Worked */}
                  <div 
                    className="flex items-center justify-between p-1.5 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200/60 dark:border-transparent shadow-2xs"
                    title="Total Worked Hours"
                  >
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="text-[10px] font-sans font-medium text-slate-500 dark:text-gray-400">Worked</span>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-gray-200 text-xs">
                      {formatMinutesToHoursStr(kpiStats.totalWorkedMinutes)}
                    </span>
                  </div>

                  {/* Overtime */}
                  <div 
                    className="flex items-center justify-between p-1.5 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-200/60 dark:border-transparent shadow-2xs"
                    title="Accumulated Overtime"
                  >
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="text-[10px] font-sans font-medium text-slate-500 dark:text-gray-400">OT</span>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-gray-200 text-xs">
                      +{formatMinutesToHoursStr(kpiStats.totalOvertimeMinutes)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                  {/* Present */}
                  <button
                    type="button"
                    onClick={() => setStatusFilter(prev => prev === 'PRESENT' ? 'ALL' : 'PRESENT')}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl border text-center transition cursor-pointer active:scale-95 shadow-2xs ${
                      statusFilter === 'PRESENT'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-bold ring-1 ring-emerald-300'
                        : 'bg-slate-50 dark:bg-[#222222] border-slate-200/60 dark:border-transparent text-slate-700 dark:text-gray-300 hover:border-emerald-200 hover:bg-emerald-50/40'
                    }`}
                    title="Click to filter Present"
                  >
                    <span className="flex items-center gap-1 text-[9.5px] font-sans text-slate-500 dark:text-gray-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Present
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{kpiStats.presentDays}</span>
                  </button>

                  {/* Late */}
                  <button
                    type="button"
                    onClick={() => setStatusFilter(prev => prev === 'LATE' ? 'ALL' : 'LATE')}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl border text-center transition cursor-pointer active:scale-95 shadow-2xs ${
                      statusFilter === 'LATE'
                        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-bold ring-1 ring-amber-300'
                        : 'bg-slate-50 dark:bg-[#222222] border-slate-200/60 dark:border-transparent text-slate-700 dark:text-gray-300 hover:border-amber-200 hover:bg-amber-50/40'
                    }`}
                    title="Click to filter Late"
                  >
                    <span className="flex items-center gap-1 text-[9.5px] font-sans text-slate-500 dark:text-gray-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Late
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{kpiStats.lateCount}</span>
                  </button>

                  {/* Absent */}
                  <button
                    type="button"
                    onClick={() => setStatusFilter(prev => prev === 'ABSENT' ? 'ALL' : 'ABSENT')}
                    className={`flex flex-col items-center justify-center p-1 rounded-xl border text-center transition cursor-pointer active:scale-95 shadow-2xs ${
                      statusFilter === 'ABSENT'
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 font-bold ring-1 ring-rose-300'
                        : 'bg-slate-50 dark:bg-[#222222] border-slate-200/60 dark:border-transparent text-slate-700 dark:text-gray-300 hover:border-rose-200 hover:bg-rose-50/40'
                    }`}
                    title="Click to filter Absent"
                  >
                    <span className="flex items-center gap-1 text-[9.5px] font-sans text-slate-500 dark:text-gray-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Absent
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{kpiStats.absentDays}</span>
                  </button>
                </div>
              </div>

              {/* Mini Calendar Legend Bar */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-[#262626] flex items-center justify-between text-[9px] text-slate-400 dark:text-gray-500 font-medium shrink-0">
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Today</div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Present</div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Late</div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Leave</div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Absent</div>
              </div>

              {/* Expand Full Matrix Action Button */}
              <button
                type="button"
                onClick={() => setIsCalendarExpanded(true)}
                className="w-full py-1 px-2.5 rounded-xl bg-slate-50 hover:bg-cyan-50 dark:bg-[#222222] dark:hover:bg-[#262626] text-slate-700 hover:text-cyan-700 dark:text-gray-300 dark:hover:text-cyan-300 border border-slate-200/60 dark:border-transparent text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 shadow-2xs shrink-0"
              >
                <Maximize2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Expand Full Calendar</span>
              </button>
            </div>

            {/* Right: Monthly Attendance Records Table */}
            <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-transparent p-3 space-y-2 min-h-0 overflow-hidden">
              {/* Header with Title, Search and Status Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-[#262626] shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-[#222222] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Attendance Logs</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300">
                        {displayDaysList.length} records
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 block">
                      {selectedDateStr ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-cyan-600 dark:text-cyan-400">
                          Date: {selectedDateStr}
                          <button
                            type="button"
                            onClick={() => setSelectedDateStr(null)}
                            className="hover:underline text-[9.5px] cursor-pointer ml-1 text-slate-400"
                          >
                            (Show all days)
                          </button>
                        </span>
                      ) : (
                        `Complete punch history for ${monthNames[selectedMonth - 1]} ${selectedYear}`
                      )}
                    </span>
                  </div>
                </div>

                {/* Search & Status Filters */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-40">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search date..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-transparent rounded-xl text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-slate-400"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-[#222222] p-0.5 rounded-xl border border-slate-200/60 dark:border-transparent text-[10.5px]">
                    {(['ALL', 'PRESENT', 'LATE', 'LEAVE', 'ABSENT'] as const).map(tab => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatusFilter(tab)}
                        className={`px-2 py-0.5 rounded-lg font-semibold transition cursor-pointer ${
                          statusFilter === tab
                            ? 'bg-white dark:bg-[#2c2c2c] text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                        }`}
                      >
                        {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scrollable Table of Attendance Records */}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-100 dark:border-[#262626]">
                {displayDaysList.length === 0 ? (
                  <div className="h-full min-h-[160px] flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-gray-500">
                    <Calendar className="w-8 h-8 mb-2 stroke-1 text-slate-300 dark:text-gray-600" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-gray-400">No attendance logs found</p>
                    <p className="text-[11px] mt-0.5">Try selecting another month or changing filters</p>
                    {selectedDateStr && (
                      <button
                        type="button"
                        onClick={() => setSelectedDateStr(null)}
                        className="mt-2 text-xs font-semibold text-cyan-600 hover:underline cursor-pointer"
                      >
                        Show all month records
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50/80 dark:bg-[#202020] text-[10.5px] uppercase font-bold text-slate-400 dark:text-gray-500 sticky top-0 border-b border-slate-100 dark:border-[#2a2a2a] z-10">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">In / Out Time</th>
                        <th className="py-2 px-3">Duration</th>
                        <th className="py-2 px-3">Metrics</th>
                        <th className="py-2 px-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#252525]">
                      {displayDaysList.map(d => {
                        const st = String(d.status).toUpperCase();
                        const isP = st === 'PRESENT' || st === 'CHECKED_IN';
                        const isA = st === 'ABSENT';
                        const isL = Boolean(d.lateMinutes && d.lateMinutes > 0);
                        const isLv = Boolean(d.leaveType || d.holidayName) || st.includes('LEAVE');

                        return (
                          <tr
                            key={d.date}
                            onClick={() => setSelectedDayRecord(d)}
                            className={`hover:bg-slate-50/70 dark:hover:bg-[#222222] transition-colors cursor-pointer ${
                              selectedDateStr === d.date ? 'bg-cyan-50/40 dark:bg-cyan-950/20' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-gray-200">
                              <span className="font-mono text-xs">{d.date}</span>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 ml-1.5">
                                {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isLv ? 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60' :
                                isP ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' :
                                isA ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60' :
                                'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isLv ? 'bg-purple-500' :
                                  isP ? 'bg-emerald-500' :
                                  isA ? 'bg-rose-500' : 'bg-amber-500'
                                }`} />
                                {d.status === 'CHECKED_IN' ? 'Checked In' : d.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-gray-300">
                              {formatDisplayTime(d.inTime)} {d.outTime ? `- ${formatDisplayTime(d.outTime)}` : ''}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 dark:text-gray-200">
                              {formatMinutesToHoursStr(d.workedMinutes)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1">
                                {isL && (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                                    -{d.lateMinutes}m Late
                                  </span>
                                )}
                                {Boolean(d.overtimeMinutes && d.overtimeMinutes > 0) && (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                    +{d.overtimeMinutes}m OT
                                  </span>
                                )}
                                {d.holidayName && (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60">
                                    {d.holidayName}
                                  </span>
                                )}
                                {d.leaveType && (
                                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60">
                                    {d.leaveType}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDayRecord(d);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition cursor-pointer"
                                title="Inspect Day Record"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ── EXPANDED FULL CALENDAR GRID VIEW ────────────────────────── */
          <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-transparent p-3 space-y-2">
            {/* Expanded Calendar Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-[#262626] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-[#222222] text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Attendance Calendar Matrix
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300">
                      {monthNames[selectedMonth - 1]} {selectedYear}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-slate-400 dark:text-gray-500 block">
                    Full punch timestamps, worked duration, and daily status indicators
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* The Collapse / Minimize Button to switch back to Mini View */}
                <button
                  type="button"
                  onClick={() => setIsCalendarExpanded(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-gray-200 bg-slate-100 hover:bg-slate-200 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-slate-200/80 dark:border-transparent transition shadow-2xs cursor-pointer active:scale-95"
                  title="Switch to Mini Calendar + Log Table"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Mini View</span>
                </button>
              </div>
            </div>

            {/* Continuous Unified Frame for Calendar Grid */}
            <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-200/90 dark:border-[#262626] overflow-hidden shadow-2xs">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-500 dark:text-gray-400 bg-slate-50/90 dark:bg-[#1a1a1a] border-b border-slate-200 dark:border-[#262626] shrink-0">
                <div className="py-1.5 text-slate-400 dark:text-gray-500">Sun</div>
                <div className="py-1.5 border-l border-slate-200/60 dark:border-[#262626]">Mon</div>
                <div className="py-1.5 border-l border-slate-200/60 dark:border-[#262626]">Tue</div>
                <div className="py-1.5 border-l border-slate-200/60 dark:border-[#262626]">Wed</div>
                <div className="py-1.5 border-l border-slate-200/60 dark:border-[#262626]">Thu</div>
                <div className="py-1.5 border-l border-slate-200/60 dark:border-[#262626]">Fri</div>
                <div className="py-1.5 border-l border-slate-200/60 dark:border-[#262626] text-slate-400 dark:text-gray-500">Sat</div>
              </div>

              {/* Calendar Days Matrix (Hairline 1px grid) */}
              <div 
                className="flex-1 min-h-0 grid grid-cols-7 gap-px bg-slate-200/80 dark:bg-[#262626]"
                style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
              >
                {renderInteractiveMonthCalendar()}
              </div>
            </div>

            {/* Bottom Status Legend & Monthly Metrics Summary */}
            <div className="pt-2 border-t border-slate-100 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0">
              {/* Color Legend */}
              <div className="flex items-center gap-3 text-[10.5px] text-slate-500 dark:text-gray-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-600" />
                  <span className="font-medium">Today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium">Present</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-medium">Late / Missed Out</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="font-medium">Leave / Holiday</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="font-medium">Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-gray-600" />
                  <span className="font-medium">Weekend</span>
                </div>
              </div>

              {/* Quick Monthly Metric Snapshot */}
              <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-600 dark:text-gray-300 bg-slate-50 dark:bg-[#222222] px-2.5 py-1 rounded-xl border border-slate-200/60 dark:border-transparent">
                <span>Worked: <strong className="text-slate-900 dark:text-white font-bold">{formatMinutesToHoursStr(kpiStats.totalWorkedMinutes)}</strong></span>
                <span className="text-slate-300 dark:text-gray-600">|</span>
                <span>Present: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{kpiStats.presentDays}</strong></span>
                <span className="text-slate-300 dark:text-gray-600">|</span>
                <span>Late: <strong className="text-amber-600 dark:text-amber-400 font-bold">{kpiStats.lateCount}</strong></span>
                <span className="text-slate-300 dark:text-gray-600">|</span>
                <span>OT: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">+{formatMinutesToHoursStr(kpiStats.totalOvertimeMinutes)}</strong></span>
                <span className="text-slate-300 dark:text-gray-600">|</span>
                <span>Absent: <strong className="text-rose-600 dark:text-rose-400 font-bold">{kpiStats.absentDays}</strong></span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>

      {/* ── MODAL 1: DETAILED MINUTE BREAKDOWN DAY INSPECTOR ─────────────── */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-transparent w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-cyan-600 dark:bg-[#222222] text-white flex items-center justify-between border-b border-transparent dark:border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-white dark:text-gray-300" />
                <div>
                  <h3 className="text-xs font-bold text-white dark:text-gray-200 uppercase">Attendance Log Details</h3>
                  <span className="text-[10px] text-cyan-100 dark:text-gray-400 font-mono block">{selectedDayRecord.date}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedDayRecord(null)} className="p-1 text-white/80 dark:text-gray-400 hover:bg-white/10 dark:hover:bg-[#2a2a2a] rounded-lg cursor-pointer">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200 dark:border-transparent">
                <span className="text-slate-600 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">ATTENDANCE STATUS</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  String(selectedDayRecord.status).toUpperCase() === 'PRESENT' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-emerald-400 dark:border-transparent' 
                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-rose-400 dark:border-transparent'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${String(selectedDayRecord.status).toUpperCase() === 'PRESENT' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {selectedDayRecord.status}
                </span>
              </div>

              {/* Exact Minute Breakdown Table */}
              <div className="bg-slate-50 dark:bg-[#222222] p-3.5 rounded-xl border border-slate-200/80 dark:border-transparent space-y-2 font-mono">
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#2a2a2a] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Check-In Timestamp:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatDisplayTime(selectedDayRecord.inTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#2a2a2a] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Check-Out Timestamp:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{formatDisplayTime(selectedDayRecord.outTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#2a2a2a] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Worked Minutes:</span>
                  <span className="font-bold text-cyan-800 dark:text-gray-200">{selectedDayRecord.workedMinutes || 0} mins ({formatMinutesToHoursStr(selectedDayRecord.workedMinutes)})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#2a2a2a] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Late Minutes Penalty:</span>
                  <span className={`font-bold ${selectedDayRecord.lateMinutes ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-gray-300'}`}>
                    {selectedDayRecord.lateMinutes || 0} mins
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 dark:border-[#2a2a2a] pb-1.5">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Overtime Minutes:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">+{selectedDayRecord.overtimeMinutes || 0} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Early Exit Minutes:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{selectedDayRecord.earlyExitMinutes || 0} mins</span>
                </div>
              </div>

              {selectedDayRecord.holidayName && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-transparent flex items-center gap-2">
                  <Gift className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase block">Official Company Holiday</span>
                    <span className="text-xs font-bold text-rose-900 dark:text-rose-200">{selectedDayRecord.holidayName}</span>
                  </div>
                </div>
              )}

              {selectedDayRecord.leaveType && (
                <div className="p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-xl border border-cyan-200 dark:border-transparent flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold uppercase block">Leave Application</span>
                    <span className="text-xs font-bold text-cyan-900 dark:text-cyan-200">{selectedDayRecord.leaveType}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => setSelectedDayRecord(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-transparent bg-white dark:bg-[#222222] rounded-xl text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-[#282828] cursor-pointer transition-colors"
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
          <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-transparent w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-3.5 bg-rose-600 dark:bg-[#222222] text-white flex items-center justify-between border-b border-transparent dark:border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-white dark:text-gray-300" />
                <h3 className="text-xs font-bold text-white dark:text-gray-200 uppercase tracking-wider">Confirm Deletion</h3>
              </div>
              <button type="button" onClick={() => setDeleteConfirmDay(null)} className="p-1 text-white/80 dark:text-gray-400 hover:bg-white/10 dark:hover:bg-[#2a2a2a] rounded-lg cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed font-semibold">
                Are you sure you want to remove the attendance log for date <span className="text-rose-700 dark:text-rose-400 font-bold font-mono">{deleteConfirmDay.date}</span>?
              </p>

              <div className="bg-slate-50 dark:bg-[#222222] p-2.5 rounded-xl border border-slate-200 dark:border-transparent space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Status:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{deleteConfirmDay.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-400 font-sans font-medium">Worked Duration:</span>
                  <span className="font-bold text-slate-800 dark:text-gray-200">{formatMinutesToHoursStr(deleteConfirmDay.workedMinutes)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-[#2a2a2a]">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmDay(null)}
                  className="px-3.5 py-1.5 border border-slate-200 dark:border-transparent bg-white dark:bg-[#222222] rounded-lg text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-[#282828] cursor-pointer transition-colors"
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
