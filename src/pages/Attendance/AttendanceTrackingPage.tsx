import React, { useState, useEffect, useMemo, useContext } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Users, UserCheck, Clock, AlertCircle, Search, Plus, X, 
  FileText, Download, Printer, Edit, Trash2, MapPin, RotateCw, Calendar,
  LayoutGrid, List, Eye, Laptop, ArrowRight, TrendingUp, AlertTriangle, Gift, Briefcase
} from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import StatsCard from '../../components/common/Statscard';
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
  const [viewDisplayMode, setViewDisplayMode] = useState<'calendar' | 'table' | 'grid'>('calendar');

  // Modals & Action States
  const [deleteConfirmDay, setDeleteConfirmDay] = useState<CalendarDayModel | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingDay, setEditingDay] = useState<CalendarDayModel | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    inTime: '',
    outTime: '',
    status: 'PRESENT',
    reason: ''
  });

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
        <div key={`prev-${i}`} className="bg-slate-50/40 p-1 border border-slate-100/60 h-[56px] text-slate-300 pointer-events-none rounded-md">
          <span className="font-mono text-[10px] font-medium">{pDay}</span>
        </div>
      );
    }

    // 2. Current Month Days
    const todayStr = new Date().toISOString().split('T')[0];

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const dayData = dayMap.get(dateStr);
      const isToday = dateStr === todayStr;

      const isFilteredMatch = statusFilter === 'ALL' || (dayData && filteredDaysSet.has(dateStr));

      const isPresent = dayData && (String(dayData.status).toUpperCase() === 'PRESENT' || String(dayData.status).toUpperCase() === 'CHECKED_IN');
      const isAbsent = dayData && String(dayData.status).toUpperCase() === 'ABSENT';
      const isLate = dayData && Boolean(dayData.lateMinutes && dayData.lateMinutes > 0);
      const isOvertime = dayData && Boolean(dayData.overtimeMinutes && dayData.overtimeMinutes > 0);
      const isLeave = dayData && (Boolean(dayData.leaveType || dayData.holidayName) || String(dayData.status).toUpperCase().includes('LEAVE') || String(dayData.status).toUpperCase().includes('HALF'));

      const hasWorked = dayData && dayData.workedMinutes && dayData.workedMinutes > 0;
      const hasPunch = dayData && (dayData.inTime || dayData.outTime);

      cells.push(
        <div
          key={dateStr}
          onClick={() => dayData && setSelectedDayRecord(dayData)}
          className={`p-1 border transition-all h-[56px] flex flex-col justify-between cursor-pointer rounded-md overflow-hidden ${
            !isFilteredMatch
              ? 'opacity-25 grayscale border-dashed border-gray-200 bg-gray-50/50 hover:opacity-100'
              : isToday 
              ? 'bg-cyan-50/90 border-cyan-400 ring-2 ring-cyan-400/20 shadow-2xs' 
              : isLeave
              ? 'bg-purple-50/40 border-purple-200 hover:border-purple-400 hover:bg-purple-50/70'
              : isPresent 
              ? 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-50/70' 
              : isAbsent 
              ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-400 hover:bg-rose-50/70' 
              : 'bg-white border-gray-200/80 hover:border-cyan-300 hover:shadow-2xs'
          }`}
        >
          {/* Top Row: Date & Status Badge */}
          <div className="flex items-center justify-between gap-1 leading-none">
            <span className={`font-mono text-[11px] font-extrabold ${isToday ? 'bg-cyan-600 text-white px-1.5 rounded-full' : 'text-slate-800'}`}>
              {dayNum}
            </span>
            {dayData && (
              <span className={`px-1 py-0.2 rounded text-[8px] font-bold border truncate max-w-[55px] ${
                isLeave ? 'bg-purple-50 text-purple-700 border-purple-200' :
                isPresent ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                isAbsent ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {dayData.status}
              </span>
            )}
          </div>

          {/* Compact Punch Info */}
          {dayData && (hasPunch || hasWorked || dayData.holidayName || dayData.leaveType) ? (
            <div className="space-y-0.2 font-mono text-[8.5px] leading-tight">
              {hasPunch && (
                <div className="text-slate-700 font-medium truncate text-[8.5px]">
                  {formatDisplayTime(dayData.inTime)} {dayData.outTime ? `- ${formatDisplayTime(dayData.outTime)}` : ''}
                </div>
              )}

              <div className="flex items-center justify-between gap-1">
                {hasWorked ? (
                  <span className="font-extrabold text-cyan-800 text-[9px]">
                    {formatMinutesToHoursStr(dayData.workedMinutes)}
                  </span>
                ) : <span />}

                {/* Compact Badges */}
                <div className="flex items-center gap-0.5 overflow-hidden">
                  {isLate && (
                    <span className="px-1 rounded text-[7.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 truncate">
                      -{dayData.lateMinutes}m
                    </span>
                  )}
                  {isOvertime && (
                    <span className="px-1 rounded text-[7.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 truncate">
                      +{dayData.overtimeMinutes}m
                    </span>
                  )}
                  {dayData.holidayName && (
                    <span className="px-1 rounded text-[7.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 truncate max-w-[50px]">
                      {dayData.holidayName}
                    </span>
                  )}
                  {dayData.leaveType && (
                    <span className="px-1 rounded text-[7.5px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 truncate max-w-[50px]">
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

    return cells;
  };

  // Table Column Definitions
  const columns: ColumnDef<CalendarDayModel>[] = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (row) => (
        <div 
          onClick={() => setSelectedDayRecord(row)}
          className="flex items-center gap-2 cursor-pointer group whitespace-nowrap"
        >
          <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-800 font-mono font-extrabold text-xs flex items-center justify-center border border-cyan-200 group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-2xs">
            {row.date.split('-')[2]}
          </div>
          <div>
            <span className="font-mono font-bold text-xs text-gray-900 group-hover:text-cyan-700 transition-colors block">
              {row.date}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              {new Date(row.date).toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const st = String(row.status).toUpperCase();
        let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (st === 'ABSENT') badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
        if (row.lateMinutes && row.lateMinutes > 0) badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
        if (row.leaveType) badgeStyle = "bg-cyan-50 text-cyan-700 border-cyan-200";

        return (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${badgeStyle}`}>
            {st}
          </span>
        );
      }
    },
    {
      key: 'inTime',
      label: 'Check-In',
      sortable: true,
      render: (row) => (
        <span className={`font-mono text-xs font-bold whitespace-nowrap ${row.lateMinutes ? 'text-amber-600' : 'text-gray-900'}`}>
          {formatDisplayTime(row.inTime)}
        </span>
      )
    },
    {
      key: 'outTime',
      label: 'Check-Out',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-gray-600 whitespace-nowrap">
          {formatDisplayTime(row.outTime)}
        </span>
      )
    },
    {
      key: 'workedMinutes',
      label: 'Worked Duration',
      sortable: true,
      render: (row) => (
        <div className="whitespace-nowrap">
          <span className="font-mono text-xs font-extrabold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
            {formatMinutesToHoursStr(row.workedMinutes)}
          </span>
        </div>
      )
    },
    {
      key: 'lateMinutes',
      label: 'Late Penalty',
      sortable: true,
      render: (row) => (
        row.lateMinutes && row.lateMinutes > 0 ? (
          <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap flex items-center gap-1 w-fit">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> {row.lateMinutes}m Late
          </span>
        ) : (
          <span className="text-gray-400 font-mono text-xs">-</span>
        )
      )
    },
    {
      key: 'overtimeMinutes',
      label: 'Overtime',
      sortable: true,
      render: (row) => (
        row.overtimeMinutes && row.overtimeMinutes > 0 ? (
          <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap flex items-center gap-1 w-fit">
            <TrendingUp className="w-3 h-3 text-emerald-600" /> +{row.overtimeMinutes}m OT
          </span>
        ) : (
          <span className="text-gray-400 font-mono text-xs">-</span>
        )
      )
    },
    {
      key: 'notes',
      label: 'Holiday / Leave',
      render: (row) => {
        if (row.holidayName) {
          return (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap flex items-center gap-1 w-fit">
              <Gift className="w-3 h-3" /> {row.holidayName}
            </span>
          );
        }
        if (row.leaveType) {
          return (
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 whitespace-nowrap flex items-center gap-1 w-fit">
              <Briefcase className="w-3 h-3 text-cyan-600" /> {row.leaveType}
            </span>
          );
        }
        return <span className="text-gray-400 text-xs italic">-</span>;
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setSelectedDayRecord(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-colors"
            title="Inspect Minute Breakdown"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-700" />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingDay(row);
              setForm({
                date: row.date,
                inTime: row.inTime ? row.inTime.substring(11, 16) : '09:00',
                outTime: row.outTime ? row.outTime.substring(11, 16) : '18:00',
                status: row.status,
                reason: row.holidayName || row.leaveType || ''
              });
              setIsManualModalOpen(true);
            }}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg transition-colors"
            title="Edit Punch"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirmDay(row)}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg transition-colors"
            title="Delete Record"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Attendance Tracking & Calendar Records" description="Live monthly attendance calendar logs, minute breakdowns, and punch audit trails" />
      <PageBreadcrumb pageTitle="Attendance Tracking & Calendar Records" />

      <div className="max-w-7xl mx-auto pb-6 space-y-3.5 animate-in fade-in duration-200">
        
        {/* ── TOP BANNER & MONTH NAVIGATION ───────────────────────────── */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-600 text-white flex items-center justify-center font-extrabold text-sm shadow-2xs border border-cyan-500 shrink-0">
              {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {employeeList.length > 0 ? (
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(Number(e.target.value))}
                    className="py-1 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-extrabold text-gray-900 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                  >
                    {employeeList.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.code}) — ID #{emp.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h2 className="text-sm font-extrabold text-gray-900">{currentUser.name}</h2>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                  ID #{calendarData?.employeeId || selectedEmpId || currentUser.id}
                </span>
              </div>
            </div>
          </div>

          {/* Month Navigator Controls */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-white text-gray-700 font-bold transition-all shadow-2xs"
            >
              &lt;
            </button>
            <div className="px-3 text-center min-w-[120px]">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-white text-gray-700 font-bold transition-all shadow-2xs"
            >
              &gt;
            </button>
            
            <button
              type="button"
              onClick={fetchMyCalendarAttendance}
              className="p-1.5 text-cyan-700 hover:bg-white rounded-lg transition-all ml-1"
              title="Refresh Calendar API"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPI METRICS CARDS USING REUSABLE StatsCard COMPONENT ────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <StatsCard
            label="Total Worked"
            value={formatMinutesToHoursStr(kpiStats.totalWorkedMinutes)}
            gradient="cyan"
            borderColor="border-cyan-200"
            labelColor="text-cyan-800"
            icon={<Clock className="w-4 h-4 text-cyan-600" />}
          />
          <StatsCard
            label="Present"
            value={`${kpiStats.presentDays}/${kpiStats.totalDays}`}
            gradient="emerald"
            borderColor="border-emerald-200"
            labelColor="text-emerald-700"
            icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
          />
          <StatsCard
            label="Late"
            value={kpiStats.lateCount}
            gradient="amber"
            borderColor="border-amber-200"
            labelColor="text-amber-700"
            icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          />
          <StatsCard
            label="Overtime"
            value={`+${formatMinutesToHoursStr(kpiStats.totalOvertimeMinutes)}`}
            gradient="emerald"
            borderColor="border-emerald-200"
            labelColor="text-emerald-700"
            icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
          />
          <StatsCard
            label="Absent"
            value={kpiStats.absentDays}
            gradient="rose"
            borderColor="border-rose-200"
            labelColor="text-rose-700"
            icon={<Gift className="w-4 h-4 text-rose-600" />}
          />
        </div>

        {/* ── FILTER TOOLBAR & VIEW CONTROLS ─────────────────────────────── */}
        <div className="bg-white p-3.5 rounded-xl shadow-2xs border border-gray-200/80 flex flex-wrap items-center justify-between gap-3">
          
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Filter Status:</span>
            {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === st 
                    ? 'bg-cyan-600 text-white shadow-2xs' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Export Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Excel
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* ── EXCLUSIVE INTERACTIVE 7-COLUMN MONTHLY CALENDAR GRID ───────── */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 space-y-3">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-gray-600 uppercase tracking-wider py-1 border-b border-gray-100">
            <span className="text-rose-600">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-cyan-700">Sat</span>
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-2">
            {renderInteractiveMonthCalendar()}
          </div>
        </div>

      </div>

      {/* ── MODAL 1: DETAILED MINUTE BREAKDOWN DAY INSPECTOR ─────────────── */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-cyan-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-white" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase">Attendance Log Details</h3>
                  <span className="text-[10px] text-cyan-100 font-mono block">{selectedDayRecord.date}</span>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedDayRecord(null)} className="p-1 text-white/80 hover:bg-white/10 rounded-lg">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">ATTENDANCE STATUS</span>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  String(selectedDayRecord.status).toUpperCase() === 'PRESENT' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {selectedDayRecord.status}
                </span>
              </div>

              {/* Exact Minute Breakdown Table */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2 font-mono">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-sans font-medium">Check-In Timestamp:</span>
                  <span className="font-bold text-emerald-700">{formatDisplayTime(selectedDayRecord.inTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-sans font-medium">Check-Out Timestamp:</span>
                  <span className="font-bold text-slate-800">{formatDisplayTime(selectedDayRecord.outTime)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-sans font-medium">Worked Minutes:</span>
                  <span className="font-bold text-cyan-800">{selectedDayRecord.workedMinutes || 0} mins ({formatMinutesToHoursStr(selectedDayRecord.workedMinutes)})</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-sans font-medium">Late Minutes Penalty:</span>
                  <span className={`font-bold ${selectedDayRecord.lateMinutes ? 'text-amber-600' : 'text-slate-700'}`}>
                    {selectedDayRecord.lateMinutes || 0} mins
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500 font-sans font-medium">Overtime Minutes:</span>
                  <span className="font-bold text-emerald-700">+{selectedDayRecord.overtimeMinutes || 0} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-medium">Early Exit Minutes:</span>
                  <span className="font-bold text-slate-800">{selectedDayRecord.earlyExitMinutes || 0} mins</span>
                </div>
              </div>

              {selectedDayRecord.holidayName && (
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-rose-600 font-bold uppercase block">Official Company Holiday</span>
                    <span className="text-xs font-bold text-rose-900">{selectedDayRecord.holidayName}</span>
                  </div>
                </div>
              )}

              {selectedDayRecord.leaveType && (
                <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-200 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-cyan-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-cyan-700 font-bold uppercase block">Leave Application</span>
                    <span className="text-xs font-bold text-cyan-900">{selectedDayRecord.leaveType}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDayRecord(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-3.5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-white" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Confirm Deletion</h3>
              </div>
              <button type="button" onClick={() => setDeleteConfirmDay(null)} className="p-1 text-white/80 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-700 leading-relaxed font-semibold">
                Are you sure you want to remove the attendance log for date <span className="text-rose-700 font-bold font-mono">{deleteConfirmDay.date}</span>?
              </p>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-medium">Status:</span>
                  <span className="font-bold text-slate-800">{deleteConfirmDay.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans font-medium">Worked Duration:</span>
                  <span className="font-bold text-slate-800">{formatMinutesToHoursStr(deleteConfirmDay.workedMinutes)}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmDay(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteDayRecord}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all"
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
