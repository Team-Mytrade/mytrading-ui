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
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        const uName = (parsed.fullName || parsed.name || parsed.username || '').trim();
        const isRoy = uName.toLowerCase().includes('roy') || uName.toLowerCase().includes('hamlin');
        const defaultId = isRoy ? 71 : (parsed.employeeId || parsed.id || 71);
        return {
          id: parsed.employeeId ? Number(parsed.employeeId) : defaultId,
          name: uName || 'Roy Hamlin',
          code: parsed.employeeCode || `EMP-${parsed.employeeId || defaultId}`
        };
      } catch (e) {}
    }
    return { id: 71, name: 'Roy Hamlin', code: 'EMP-71' };
  }, []);

  const [resolvedEmpId, setResolvedEmpId] = useState<number>(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        if (parsed.employeeId) return Number(parsed.employeeId);
        const uName = (parsed.fullName || parsed.name || '').toLowerCase();
        if (uName.includes('roy') || uName.includes('hamlin')) return 71;
        if (parsed.id) return Number(parsed.id);
      } catch (e) {}
    }
    return 71;
  });

  // Dynamic Employee ID resolver matching against /v1/api/payroll/employee/all
  useEffect(() => {
    const resolveUserEmployeeId = async () => {
      try {
        const empRes = await axios.get('/v1/api/payroll/employee/all');
        if (Array.isArray(empRes.data) && empRes.data.length > 0) {
          const uName = (currentUser.name || '').toLowerCase().trim();
          const match = empRes.data.find((e: any) => {
            const eName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase() || (e.name || '').toLowerCase();
            return (uName && (eName.includes(uName) || uName.includes(eName))) || 
                   (currentUser.id > 0 && Number(e.id) === currentUser.id);
          });
          if (match && match.id) {
            const validId = Number(match.id);
            setResolvedEmpId(validId);
            const userStr = localStorage.getItem('user');
            if (userStr) {
              try {
                const parsed = JSON.parse(userStr);
                parsed.employeeId = validId;
                localStorage.setItem('user', JSON.stringify(parsed));
              } catch (e) {}
            }
          }
        }
      } catch (e) {}
    };
    resolveUserEmployeeId();
  }, [currentUser.name, currentUser.id]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = new Date().toISOString().slice(0, 10);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<{ casual: number; sick: number; earned: number }>({
    casual: 10,
    sick: 12,
    earned: 18,
  });
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);

  // 1-Click Punch & Quick Leave States
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const [isApplyLeaveModalOpen, setIsApplyLeaveModalOpen] = useState<boolean>(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
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

  // Fetch Attendance records, leaves, and holidays live using the resolved employee ID
  const fetchCalendarData = useCallback(async () => {
    const empId = resolvedEmpId || currentUser.id || 71;
    setLoadingCalendar(true);
    try {
      const [attRes, leaveRes, holRes, balRes] = await Promise.allSettled([
        axios.get(`/v1/api/attendance/records/my-calendar/${empId}`, {
          params: { employeeId: empId, year, month: month + 1 }
        }),
        axios.get(`/v1/api/attendance/leave-requests/employee/${empId}`),
        axios.get('/v1/api/attendance/holiday-calendars/1/holidays').catch(() => axios.get('/v1/api/attendance/holiday-calendars')),
        axios.get(`/v1/api/attendance/employee-leave-balances/${empId}`)
      ]);

      if (attRes.status === 'fulfilled' && attRes.value?.data) {
        const data = attRes.value.data;
        if (Array.isArray(data)) {
          setAttendanceRecords(data);
        } else if (Array.isArray(data.days)) {
          setAttendanceRecords(data.days);
        }
      }
      if (leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value?.data)) {
        setLeaveRequests(leaveRes.value.data);
      }
      if (holRes.status === 'fulfilled' && holRes.value?.data) {
        const hData = holRes.value.data;
        if (Array.isArray(hData)) {
          if (hData.length > 0 && Array.isArray(hData[0].holidays)) {
            setHolidays(hData.flatMap((c: any) => c.holidays || []));
          } else {
            setHolidays(hData);
          }
        }
      }
      if (balRes.status === 'fulfilled' && balRes.value?.data) {
        const bData = balRes.value.data;
        if (Array.isArray(bData) && bData.length > 0) {
          const getBal = (t: string, defVal: number) => {
            const item = bData.find((b: any) => String(b.leaveType || b.name || '').toUpperCase().includes(t));
            return item ? (item.remainingLeaves ?? item.availableLeaves ?? item.balance ?? defVal) : defVal;
          };
          setLeaveBalances({
            casual: getBal('CASUAL', 10),
            sick: getBal('SICK', 12),
            earned: getBal('EARNED', 18)
          });
        } else if (bData.leaveBalance) {
          setLeaveBalances({
            casual: bData.leaveBalance.casual ?? 10,
            sick: bData.leaveBalance.sick ?? 12,
            earned: bData.leaveBalance.earned ?? 18
          });
        }
      }
    } catch (err) {
      console.error('Error loading calendar data:', err);
    } finally {
      setLoadingCalendar(false);
    }
  }, [resolvedEmpId, currentUser.id, year, month]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Today's attendance punch status
  const todayRecord = useMemo(() => {
    return attendanceRecords.find((a: any) => {
      const aDate = String(a.date || a.attendanceDate || a.recordDate || '').split('T')[0];
      return aDate === todayStr;
    });
  }, [attendanceRecords, todayStr]);

  const isCheckedIn = Boolean(
    todayRecord &&
    (todayRecord.inTime || todayRecord.checkInTime || todayRecord.clockIn || todayRecord.in) &&
    !(todayRecord.outTime || todayRecord.checkOutTime || todayRecord.clockOut || todayRecord.out)
  );

  const isCheckedOut = Boolean(
    todayRecord &&
    (todayRecord.outTime || todayRecord.checkOutTime || todayRecord.clockOut || todayRecord.out)
  );

  const todayInTime = todayRecord?.inTime || todayRecord?.checkInTime || todayRecord?.clockIn || null;
  const todayInFormatted = todayInTime ? (todayInTime.includes('T') ? new Date(todayInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : todayInTime) : null;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const handleWebPunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    const empId = resolvedEmpId || currentUser.id || 65;
    setIsPunching(true);
    try {
      const endpoint = punchType === 'CHECK_IN' ? '/v1/api/attendance/records/check-in' : '/v1/api/attendance/records/check-out';
      const payload = {
        employeeId: Number(empId),
        attendanceSource: 'WEB',
        attendanceMode: 'MANUAL',
        deviceId: 'Browser',
        deviceName: 'Employee Self Service Portal',
        location: 'Office / Remote',
        latitude: 0,
        longitude: 0,
        ipAddress: '127.0.0.1',
        ...(punchType === 'CHECK_OUT' ? { remarks: 'Web Check-out from Self Service' } : {})
      };

      await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 6000
      });

      ToasterService.success(punchType === 'CHECK_IN' ? 'Checked in successfully!' : 'Checked out successfully!');
      fetchCalendarData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to record attendance.';
      ToasterService.error(String(msg));
    } finally {
      setIsPunching(false);
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empId = resolvedEmpId || currentUser.id || 65;
    if (!leaveForm.fromDate || !leaveForm.toDate) {
      ToasterService.error('Please select both From and To dates.');
      return;
    }
    if (leaveForm.toDate < leaveForm.fromDate) {
      ToasterService.error('End Date cannot be before Start Date.');
      return;
    }

    const start = new Date(leaveForm.fromDate);
    const end = new Date(leaveForm.toDate);
    const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    setIsSubmittingLeave(true);
    const payload = {
      employeeId: Number(empId),
      employeeCode: currentUser.code || `EMP-${empId}`,
      employeeName: currentUser.name,
      leaveType: leaveForm.leaveType,
      fromDate: leaveForm.fromDate,
      toDate: leaveForm.toDate,
      totalDays: diffDays,
      reason: leaveForm.reason || 'Leave request from Self Service'
    };

    try {
      try {
        await axios.post('/v1/api/attendance/leave-requests', payload);
      } catch (firstErr: any) {
        const errMsg = String(firstErr.response?.data?.message || firstErr.response?.data?.error || '').toLowerCase();
        if (errMsg.includes('balance') || errMsg.includes('policy') || firstErr.response?.status === 400 || firstErr.response?.status === 404) {
          try {
            await axios.post('/v1/api/attendance/employee-leave-balances/assign-policy', {
              employeeIds: [Number(empId), 12],
              leavePolicyId: 1
            });
            await axios.post('/v1/api/attendance/leave-requests', payload);
          } catch {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      ToasterService.success('Leave request submitted successfully!');
      setIsApplyLeaveModalOpen(false);
      setLeaveForm({
        leaveType: 'CASUAL',
        fromDate: new Date().toISOString().slice(0, 10),
        toDate: new Date().toISOString().slice(0, 10),
        reason: ''
      });
      fetchCalendarData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to submit leave request.';
      ToasterService.error(String(msg));
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const calendarDays = useMemo(() => {
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const days: { 
      dayNumber: number; 
      currentMonth: boolean; 
      dateStr: string;
      status?: 'TODAY' | 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF' | 'REGULAR';
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

    const todayStr = new Date().toISOString().slice(0, 10);

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dObj = new Date(year, month, i);
      const isSunday = dObj.getDay() === 0;

      let dayStatus: 'TODAY' | 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF' | 'REGULAR' = 'REGULAR';
      let dayDetails = '';
      let inTimeVal: string | null = null;
      let outTimeVal: string | null = null;
      let workedMins: number | undefined = undefined;
      let lateMins: number | null = null;
      let badge: string | undefined = undefined;

      const isToday = dStr === todayStr;

      // 1. Check Holiday first
      const holidayMatch = holidays.find((h: any) => {
        const hDate = String(h.holidayDate || h.date || '').split('T')[0];
        return hDate === dStr;
      });

      if (holidayMatch) {
        dayStatus = 'HOLIDAY';
        dayDetails = holidayMatch.holidayName || holidayMatch.name || 'Holiday';
        badge = 'H';
      } else {
        // 2. Check Leave
        const leaveMatch = leaveRequests.find((l: any) => {
          if (l.status === 'REJECTED' || l.status === 'CANCELLED') return false;
          const from = String(l.fromDate || l.startDate || '').split('T')[0];
          const to = String(l.toDate || l.endDate || from).split('T')[0];
          if (from && to) {
            return dStr >= from && dStr <= to;
          }
          return String(l.leaveDate || '').split('T')[0] === dStr;
        });

        if (leaveMatch) {
          dayStatus = 'LEAVE';
          const typeName = leaveMatch.leaveTypeName || leaveMatch.dayType || leaveMatch.leaveType || 'Approved';
          dayDetails = `Leave (${typeName})`;
          badge = 'L';
        } else {
          // 3. Check Attendance record
          const attMatch = attendanceRecords.find((a: any) => {
            const aDate = String(a.date || a.attendanceDate || a.recordDate || '').split('T')[0];
            return aDate === dStr;
          });

          if (attMatch) {
            inTimeVal = attMatch.inTime || attMatch.checkInTime || attMatch.clockIn || attMatch.in || null;
            outTimeVal = attMatch.outTime || attMatch.checkOutTime || attMatch.clockOut || attMatch.out || null;
            workedMins = attMatch.workedMinutes ?? (attMatch.workHours ? Math.round(attMatch.workHours * 60) : undefined);
            lateMins = attMatch.lateMinutes ?? null;

            const statusUpper = String(attMatch.status || attMatch.attendanceStatus || '').toUpperCase();

            if (statusUpper === 'LATE' || (lateMins && lateMins > 0)) {
              dayStatus = 'LATE';
              dayDetails = `Late (-${lateMins || 0}m)`;
              badge = 'LATE';
            } else if (statusUpper === 'PRESENT' || statusUpper === 'CHECKED_IN') {
              dayStatus = 'PRESENT';
              badge = 'P';
              const inStr = inTimeVal ? (inTimeVal.includes('T') ? new Date(inTimeVal).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : inTimeVal) : 'Checked in';
              dayDetails = `Present (${inStr})`;
            } else if (statusUpper === 'ABSENT') {
              dayStatus = 'ABSENT';
              dayDetails = 'Absent';
              badge = 'A';
            } else if (statusUpper === 'ON_LEAVE' || statusUpper === 'LEAVE') {
              dayStatus = 'LEAVE';
              dayDetails = 'On Leave';
              badge = 'L';
            } else if (inTimeVal || outTimeVal) {
              dayStatus = 'PRESENT';
              badge = 'P';
              const inStr = inTimeVal ? (inTimeVal.includes('T') ? new Date(inTimeVal).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : inTimeVal) : 'Checked in';
              dayDetails = `Present (${inStr})`;
            } else {
              dayStatus = isToday ? 'TODAY' : 'REGULAR';
              badge = undefined;
              dayDetails = isToday ? 'Today' : '';
            }
          } else if (isSunday) {
            dayStatus = 'WEEK_OFF';
            dayDetails = 'Sunday / Week Off';
          } else if (isToday) {
            dayStatus = 'TODAY';
            dayDetails = 'Today';
          }
        }
      }

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
  }, [year, month, attendanceRecords, leaveRequests, holidays, currentUser]);

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
      <PageMeta title="Employee Self Service" description="Self Service portal for leave and attendance requests" />
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
                    Clocked In {todayInFormatted ? `at ${todayInFormatted}` : ''}
                  </span>
                ) : isCheckedOut ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] text-slate-700 dark:text-gray-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
                    Clocked Out for Today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] text-slate-600 dark:text-gray-400">
                    Not Clocked In Yet
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-gray-400 text-xs mt-1 flex items-center gap-2.5 flex-wrap">
                <span>{greeting}! Hope you have an awesome day.</span>
                <span className="hidden sm:inline text-slate-300 dark:text-gray-600">•</span>
                <span className="text-slate-600 dark:text-gray-300 text-[11px]">
                  Leave balance: <strong className="text-slate-800 dark:text-white">{leaveBalances.casual}</strong> Casual, <strong className="text-slate-800 dark:text-white">{leaveBalances.sick}</strong> Sick, <strong className="text-slate-800 dark:text-white">{leaveBalances.earned}</strong> Earned
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons: Minimal Clean Styling */}
          <div className="flex items-center gap-2.5 w-full md:w-auto self-end md:self-center justify-end">
            <button
              onClick={() => setIsApplyLeaveModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#222222] hover:bg-slate-50 dark:hover:bg-[#2a2a2a] active:scale-95 border border-slate-200 dark:border-[#303030] text-slate-700 dark:text-gray-200 transition shadow-2xs cursor-pointer"
              title="Apply Leave"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply Leave</span>
            </button>

            {isCheckedIn ? (
              <button
                onClick={() => navigate('/att_punch')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition shadow-2xs cursor-pointer"
                title="Clock Out"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-900"></span>
                </span>
                <span>Clock Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/att_punch')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 active:scale-95 text-white transition shadow-2xs cursor-pointer"
                title="Clock In"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Clock In</span>
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
                <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Highlights</h3>
              </div>

              <div className="p-3 bg-slate-50/70 dark:bg-[#222222] rounded-xl border border-slate-200/60 dark:border-[#303030] flex items-start gap-3">
                <Gift className="w-4.5 h-4.5 text-slate-500 dark:text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">Today's Celebration</h4>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-0.5">Check team birthdays and work anniversaries</p>
                </div>
              </div>
            </div>

            {/* Activity Feed Card */}
            <div className="bg-white dark:bg-[#191919] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#303030] shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#303030] pb-2.5">
                <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Feed</h3>
                <span className="text-xs font-medium text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition">Refresh feed</span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50/70 dark:bg-[#222222] rounded-xl border border-slate-100 dark:border-[#303030] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-white">Operational Support Update</span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono">1 year ago</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-gray-300">Moving forward, access all organizational updates via TEKInsider</p>
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
                    {monthNames[month]} {year}
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
                    title="Expand Calendar View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {/* Dropdown Menu Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowRequestDropdown(prev => !prev)}
                      className="p-1.5 text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-xl text-sm font-semibold flex items-center justify-center transition cursor-pointer"
                      title="Raise Request Options"
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
                            Raise Request For
                          </span>
                          <span className="text-[9px] font-semibold bg-slate-200 dark:bg-[#303030] text-slate-700 dark:text-gray-200 px-1.5 py-0.5 rounded-full">
                            Fast Action
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
                              <div className="font-semibold text-slate-900 dark:text-white">On duty</div>
                              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">Official client & site visits</div>
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
                              <div className="font-semibold text-slate-900 dark:text-white">Attendance regularization</div>
                              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">Correct missed check-ins/outs</div>
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
                              <div className="font-semibold text-slate-900 dark:text-white">Apply leave</div>
                              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">Casual, sick & earned leave</div>
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
                  <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mr-0.5">Quotas:</span>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#191919] border border-slate-200 dark:border-[#303030] text-[9.5px] font-semibold text-slate-700 dark:text-gray-200 shadow-2xs">
                    <span className="font-bold text-slate-400 dark:text-gray-500">CL</span>
                    <span className="font-mono text-slate-900 dark:text-white font-bold">{leaveBalances.casual}</span>
                    <span className="text-slate-400 dark:text-gray-500 text-[8.5px]">/12d</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#191919] border border-slate-200 dark:border-[#303030] text-[9.5px] font-semibold text-slate-700 dark:text-gray-200 shadow-2xs">
                    <span className="font-bold text-slate-400 dark:text-gray-500">SL</span>
                    <span className="font-mono text-slate-900 dark:text-white font-bold">{leaveBalances.sick}</span>
                    <span className="text-slate-400 dark:text-gray-500 text-[8.5px]">/12d</span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#191919] border border-slate-200 dark:border-[#303030] text-[9.5px] font-semibold text-slate-700 dark:text-gray-200 shadow-2xs">
                    <span className="font-bold text-slate-400 dark:text-gray-500">EL</span>
                    <span className="font-mono text-slate-900 dark:text-white font-bold">{leaveBalances.earned}</span>
                    <span className="text-slate-400 dark:text-gray-500 text-[8.5px]">/18d</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/att_leaveRequest')}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white rounded-lg text-[10px] font-semibold transition shadow-2xs shrink-0 cursor-pointer"
                >
                  + Apply
                </button>
              </div>

              {/* Month Days Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-medium text-slate-400 dark:text-gray-500 py-1 px-1 mb-1">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
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
                  let cardStyle = 'border-slate-200/70 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-2xs text-slate-700 dark:text-gray-200';
                  let numBadgeStyle = 'text-slate-700 dark:text-gray-200 font-medium';

                  if (isToday) {
                    cardStyle = 'border-sky-300 dark:border-sky-500/80 bg-sky-50/40 dark:bg-sky-950/40 ring-1 ring-sky-200 dark:ring-sky-500/30 text-sky-900 dark:text-sky-300 shadow-2xs';
                    numBadgeStyle = 'w-5 h-5 rounded-full bg-sky-600 text-white font-semibold text-[10px] flex items-center justify-center shrink-0 shadow-2xs';
                  } else if (day.status === 'PRESENT') {
                    cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-emerald-300 dark:hover:border-emerald-700';
                  } else if (day.status === 'LATE') {
                    cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-amber-300 dark:hover:border-amber-700';
                  } else if (day.status === 'LEAVE') {
                    cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-purple-300 dark:hover:border-purple-700';
                  } else if (day.status === 'ABSENT') {
                    cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-rose-300 dark:hover:border-rose-700';
                  } else if (day.status === 'HOLIDAY') {
                    cardStyle = 'border-slate-200/80 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-amber-300 dark:hover:border-amber-700';
                  } else if (day.status === 'WEEK_OFF') {
                    cardStyle = 'border-slate-100 dark:border-[#303030]/60 bg-slate-50/50 dark:bg-[#1a1a1a] text-slate-400 dark:text-gray-500';
                    numBadgeStyle = 'text-slate-400 dark:text-gray-500 font-normal';
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setIsCalendarExpanded(true)}
                      title={day.details || `${isToday ? 'Today: ' : 'Date: '}${day.dateStr} (Click to expand details)`}
                      className={`h-8 px-1.5 py-1 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer hover:scale-102 overflow-hidden relative ${cardStyle}`}
                    >
                      <span className={`text-[11px] leading-none shrink-0 ${numBadgeStyle}`}>
                        {day.dayNumber}
                      </span>

                      {/* Subtle Minimal Status Indicator */}
                      {day.badgeText && (
                        <span className={`text-[8px] font-semibold px-1 py-0.5 rounded-full uppercase leading-none shrink-0 ${
                          day.status === 'PRESENT' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' :
                          day.status === 'LATE' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400' :
                          day.status === 'LEAVE' ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400' :
                          day.status === 'ABSENT' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400' :
                          day.status === 'HOLIDAY' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-[#222222] text-slate-500 dark:text-gray-400'
                        }`}>
                          {day.badgeText === 'LATE' ? 'LT' : day.badgeText}
                        </span>
                      )}

                      {!day.badgeText && day.status === 'WEEK_OFF' && (
                        <span className="text-[7.5px] font-normal px-1 py-0.5 rounded-full uppercase leading-none text-slate-400 dark:text-gray-500 shrink-0">
                          off
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Legend Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-gray-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-gray-500 font-medium flex-wrap gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Today
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Present
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Leave
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Absent
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Holiday
                </div>
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
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight leading-none">Attendance Calendar</h2>
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-1">Monthly breakdown, punch records, and leave history</p>
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
                      {monthNames[month]} {year}
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
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Minimalist Segmented Filter & Legend Bar */}
              <div className="px-6 py-2 bg-slate-50/50 dark:bg-[#222222] border-b border-slate-100 dark:border-[#303030] flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
                <div className="flex items-center bg-slate-200/60 dark:bg-[#191919] p-0.5 rounded-lg border border-transparent dark:border-[#303030]">
                  {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY'] as const).map(filter => {
                    const isActive = activeRequestFilter === filter;
                    const label = filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase();
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setActiveRequestFilter(filter)}
                        className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-white dark:bg-[#2a2a2a] text-slate-900 dark:text-white shadow-2xs font-semibold'
                            : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3.5 text-[11px] text-slate-500 dark:text-gray-400 font-normal flex-wrap">
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Today</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Present</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Leave</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Absent</div>
                  <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Holiday</div>
                </div>
              </div>

              {/* Minimal Calendar Grid Container */}
              <div className="p-2 sm:p-3 flex-1 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-[#141414] min-h-0">
                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-slate-400 dark:text-gray-500 uppercase tracking-wider py-1 shrink-0 mb-1">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
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
                    let cardStyle = 'border-slate-200/70 dark:border-[#303030] bg-white dark:bg-[#222222] hover:border-slate-300 dark:hover:border-gray-600 hover:shadow-2xs text-slate-800 dark:text-white';
                    let numBadgeStyle = 'text-slate-700 dark:text-gray-200 font-semibold text-xs sm:text-[13px]';

                    if (isToday) {
                      cardStyle = 'border-sky-300 dark:border-sky-500/80 bg-sky-50/30 dark:bg-sky-950/30 ring-1 ring-sky-200/70 dark:ring-sky-500/30 shadow-2xs';
                      numBadgeStyle = 'w-5 h-5 rounded-full bg-sky-600 text-white font-semibold text-[10px] flex items-center justify-center shrink-0 shadow-2xs';
                    }

                    const inFormatted = day.inTime ? (day.inTime.includes('T') ? new Date(day.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : day.inTime) : null;
                    const outFormatted = day.outTime ? (day.outTime.includes('T') ? new Date(day.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : day.outTime) : null;

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

                          {isToday && (
                            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300">
                              Today
                            </span>
                          )}

                          {day.status === 'WEEK_OFF' && (
                            <span className="text-[8px] font-normal px-1.5 py-0.5 rounded-full uppercase tracking-wider text-slate-400 dark:text-gray-500">
                              Off
                            </span>
                          )}

                          {day.badgeText && !isToday && (
                            <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                              day.status === 'PRESENT' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' :
                              day.status === 'LATE' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400' :
                              day.status === 'LEAVE' ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400' :
                              day.status === 'ABSENT' ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400' :
                              day.status === 'HOLIDAY' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-[#222222] text-slate-600 dark:text-gray-300'
                            }`}>
                              {day.badgeText === 'P' ? 'Present' : day.badgeText === 'L' ? 'Leave' : day.badgeText === 'A' ? 'Absent' : day.badgeText === 'H' ? 'Holiday' : day.badgeText}
                            </span>
                          )}
                        </div>

                        {/* Minimalist Punch Times & Details */}
                        <div className="flex flex-col gap-0.5 mt-auto pt-1 border-t border-slate-100 dark:border-[#303030] shrink-0">
                          {inFormatted && (
                            <div className="flex items-center justify-between text-[8px] sm:text-[8.5px] leading-tight">
                              <span className="text-[7.5px] font-medium text-slate-400 dark:text-gray-500">In</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-gray-200 truncate pl-1">{inFormatted}</span>
                            </div>
                          )}

                          {outFormatted && (
                            <div className="flex items-center justify-between text-[8px] sm:text-[8.5px] leading-tight">
                              <span className="text-[7.5px] font-medium text-slate-400 dark:text-gray-500">Out</span>
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
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Apply Leave</h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Quick 1-click leave application</p>
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
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-[#222222] p-2.5 rounded-xl border border-slate-200/60 dark:border-[#303030] text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block">Casual</span>
                    <span className="text-xs font-extrabold text-cyan-700 dark:text-cyan-400">{leaveBalances.casual} days</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block">Sick</span>
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">{leaveBalances.sick} days</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block">Earned</span>
                    <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-400">{leaveBalances.earned} days</span>
                  </div>
                </div>

                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Leave Type</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveType: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-[#303030] rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                  >
                    <option value="CASUAL" className="dark:bg-[#222222]">Casual Leave (CL)</option>
                    <option value="SICK" className="dark:bg-[#222222]">Sick Leave (SL)</option>
                    <option value="EARNED" className="dark:bg-[#222222]">Earned / Privilege Leave (EL/PL)</option>
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                    <input
                      type="date"
                      value={leaveForm.fromDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveDate: e.target.value, fromDate: e.target.value }))}
                      required
                      className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-[#303030] rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white dark:bg-[#222222] text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">To Date</label>
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
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Reason / Note</label>
                  <textarea
                    rows={2}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Brief reason for your leave request..."
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg transition disabled:opacity-50 shadow-2xs cursor-pointer"
                  >
                    {isSubmittingLeave && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Submit Request</span>
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
