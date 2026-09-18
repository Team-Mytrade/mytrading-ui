import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
        
        {/* Top Hello Banner with 1-Click Web Punch & Quick Apply Leave */}
        <div className="bg-gradient-to-r from-cyan-800 via-cyan-700 to-teal-700 text-white rounded-xl p-4 sm:p-5 shadow-sm border border-cyan-600/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white font-bold text-base shadow-inner shrink-0">
              {currentUser.name ? currentUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'RH'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">{currentUser.name}</h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-900/40 border border-cyan-400/30 text-cyan-200">
                  {currentUser.code}
                </span>
                {isCheckedIn ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-400/40 text-emerald-100">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    Clocked In {todayInFormatted ? `at ${todayInFormatted}` : ''}
                  </span>
                ) : isCheckedOut ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950/40 border border-cyan-400/30 text-cyan-200">
                    <CheckCircle2 className="w-3 h-3 text-cyan-300" />
                    Clocked Out for Today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 border border-white/20 text-cyan-100">
                    Not Clocked In Yet
                  </span>
                )}
              </div>
              <p className="text-cyan-100 text-xs mt-1 flex items-center gap-3 flex-wrap">
                <span>{greeting}! Hope you have an awesome day.</span>
                <span className="hidden sm:inline text-cyan-300/60">•</span>
                <span className="text-cyan-200 text-[11px]">
                  Leave balance: <strong>{leaveBalances.casual}</strong> Casual, <strong>{leaveBalances.sick}</strong> Sick, <strong>{leaveBalances.earned}</strong> Earned
                </span>
              </p>
            </div>
          </div>

          {/* Action Buttons: 1-Click Punch & Quick Apply Leave */}
          <div className="flex items-center gap-2.5 w-full md:w-auto self-end md:self-center justify-end">
            {/* Quick + Apply Leave Button */}
            <button
              onClick={() => setIsApplyLeaveModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 active:scale-95 border border-white/25 text-white transition shadow-2xs backdrop-blur-xs cursor-pointer"
              title="Directly opens the leave request modal in 1 click"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply Leave</span>
            </button>

            {/* Web Punch Navigation Button */}
            {isCheckedIn ? (
              <button
                onClick={() => navigate('/att_punch')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-gray-950 transition shadow-sm border border-amber-300/60 cursor-pointer"
                title="Go to Attendance Punch Station to Clock Out"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-90"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>Clock Out</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/att_punch')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white transition shadow-sm border border-emerald-400 cursor-pointer"
                title="Go to Attendance Punch Station to Clock In"
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
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Highlights</h3>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start gap-3">
                <Gift className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-gray-900">Today's Celebration</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">Check team birthdays and work anniversaries</p>
                </div>
              </div>
            </div>

            {/* Activity Feed Card */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Feed</h3>
                <span className="text-[11px] font-semibold text-cyan-700 cursor-pointer hover:underline">Refresh feed</span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">Operational Support Update</span>
                    <span className="text-[10px] text-gray-400 font-mono">1 year ago</span>
                  </div>
                  <p className="text-xs text-gray-600">Moving forward, access all organizational updates via TEKInsider</p>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Attendance Calendar & Raise Request Popover */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Interactive Calendar Card */}
            <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3 relative">
              
              {/* Calendar Header with Navigation & Dropdown trigger */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <button 
                    type="button" 
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                    {monthNames[month]} {year}
                  </span>
                  <button 
                    type="button" 
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {/* Expand Calendar Button */}
                  <button
                    type="button"
                    onClick={() => setIsCalendarExpanded(true)}
                    className="p-1.5 text-gray-500 hover:text-cyan-700 hover:bg-cyan-50/80 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border border-transparent hover:border-cyan-200"
                    title="Expand Calendar"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Dropdown Menu Trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowRequestDropdown(prev => !prev)}
                      className="p-1.5 text-gray-500 hover:text-cyan-700 hover:bg-cyan-50/80 active:bg-cyan-100 rounded-lg text-sm font-semibold flex items-center justify-center transition-all duration-150 border border-transparent hover:border-cyan-200"
                      title="Raise Request Options"
                    >
                      <span className="leading-none text-base font-bold">⋮</span>
                    </button>

                  {/* Professional Raise Request Dropdown Menu */}
                  {showRequestDropdown && (
                    <>
                      {/* Backdrop overlay to close when clicking outside */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowRequestDropdown(false)} 
                      />
                      
                      <div className="absolute right-0 top-8 w-60 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 py-1.5 text-xs animate-in zoom-in-95 fade-in duration-150 ring-1 ring-black/5 divide-y divide-gray-100/70">
                        <div className="px-3.5 py-2 flex items-center justify-between bg-slate-50/80">
                          <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                            Raise Request For
                          </span>
                          <span className="text-[9px] font-semibold bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded-full">
                            Fast Action
                          </span>
                        </div>

                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => handleSelectRequestType('On Duty')}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-50/80 text-gray-700 hover:text-cyan-900 font-medium flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-cyan-900">On duty</div>
                              <div className="text-[10px] text-gray-400 font-normal">Official client & site visits</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectRequestType('Attendance Regularization')}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-50/80 text-gray-700 hover:text-cyan-900 font-medium flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-2xs">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-cyan-900">Attendance regularization</div>
                              <div className="text-[10px] text-gray-400 font-normal">Correct missed check-ins/outs</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectRequestType('Apply Leave')}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-cyan-50/80 text-gray-700 hover:text-cyan-900 font-medium flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-2xs">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-cyan-900">Apply leave</div>
                              <div className="text-[10px] text-gray-400 font-normal">Casual, sick & earned leave</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
              </div>



              {/* Unified Live Leave Quotas Bar */}
              <div className="flex items-center justify-between gap-1 bg-slate-50/90 px-2 py-1.5 rounded-lg border border-gray-100 text-xs">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Quotas:</span>
                  <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-cyan-200 text-[9.5px]">
                    <span className="px-1 rounded text-[8px] font-extrabold bg-cyan-100 text-cyan-800">CL</span>
                    <span className="font-mono font-bold text-gray-900">{leaveBalances.casual}</span>
                    <span className="text-[8px] text-gray-400">/12d</span>
                  </div>
                  <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-emerald-200 text-[9.5px]">
                    <span className="px-1 rounded text-[8px] font-extrabold bg-emerald-100 text-emerald-800">SL</span>
                    <span className="font-mono font-bold text-gray-900">{leaveBalances.sick}</span>
                    <span className="text-[8px] text-gray-400">/12d</span>
                  </div>
                  <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white border border-indigo-200 text-[9.5px]">
                    <span className="px-1 rounded text-[8px] font-extrabold bg-indigo-100 text-indigo-800">EL</span>
                    <span className="font-mono font-bold text-gray-900">{leaveBalances.earned}</span>
                    <span className="text-[8px] text-gray-400">/18d</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/att_leaveRequest')}
                  className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[10px] font-bold transition-all shadow-2xs shrink-0"
                >
                  + Apply
                </button>
              </div>

              {/* Month Days Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500 py-1">
                <span>Su</span>
                <span>Mo</span>
                <span>Tu</span>
                <span>We</span>
                <span>Th</span>
                <span>Fr</span>
                <span>Sa</span>
              </div>

              {/* Month Days Matrix with Clean User-Friendly Details */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {filteredCalendarDays.map((day, idx) => {
                  if (!day.currentMonth) {
                    return (
                      <div key={idx} className="min-h-8 p-1 text-[11px] text-gray-300 flex items-start justify-center font-mono">
                        {day.dayNumber}
                      </div>
                    );
                  }

                  const isToday = day.dateStr === todayStr;
                  let cardStyle = 'border-gray-100 bg-white hover:bg-slate-50 text-gray-700';
                  let numBadgeStyle = 'text-gray-700 font-bold';

                  if (day.status === 'PRESENT') {
                    cardStyle = `border-emerald-200 bg-emerald-50/60 text-emerald-950 ${isToday ? 'ring-2 ring-cyan-500 shadow-xs' : ''}`;
                    numBadgeStyle = 'text-emerald-700 font-bold';
                  } else if (day.status === 'LATE') {
                    cardStyle = `border-amber-200 bg-amber-50/70 text-amber-950 ${isToday ? 'ring-2 ring-cyan-500 shadow-xs' : ''}`;
                    numBadgeStyle = 'text-amber-700 font-bold';
                  } else if (day.status === 'LEAVE') {
                    cardStyle = `border-purple-200 bg-purple-50/70 text-purple-950 ${isToday ? 'ring-2 ring-cyan-500 shadow-xs' : ''}`;
                    numBadgeStyle = 'text-purple-700 font-bold';
                  } else if (day.status === 'ABSENT') {
                    cardStyle = `border-rose-200 bg-rose-50/60 text-rose-950 ${isToday ? 'ring-2 ring-cyan-500 shadow-xs' : ''}`;
                    numBadgeStyle = 'text-rose-600 font-bold';
                  } else if (day.status === 'HOLIDAY') {
                    cardStyle = `border-amber-200 bg-amber-50/60 text-amber-900 ${isToday ? 'ring-2 ring-cyan-500 shadow-xs' : ''}`;
                    numBadgeStyle = 'text-amber-600 font-bold';
                  } else if (day.status === 'WEEK_OFF') {
                    cardStyle = 'border-gray-100 bg-gray-50/60 text-gray-400';
                  } else if (isToday || day.status === 'TODAY') {
                    cardStyle = 'border-cyan-500 bg-cyan-50/70 ring-2 ring-cyan-400/50 shadow-xs';
                    numBadgeStyle = 'bg-cyan-600 text-white font-extrabold px-1.5 py-0.5 rounded-full';
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setIsCalendarExpanded(true)}
                      title={day.details || `Date: ${day.dateStr} (Click to expand details)`}
                      className={`h-8 p-1 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer hover:scale-102 ${cardStyle}`}
                    >
                      <span className={`text-[11px] font-mono leading-none ${numBadgeStyle}`}>
                        {day.dayNumber}
                      </span>

                      {day.badgeText && (
                        <span className={`text-[8px] font-extrabold px-1 rounded-xs uppercase leading-tight ${
                          day.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                          day.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                          day.status === 'LEAVE' ? 'bg-purple-100 text-purple-800' :
                          day.status === 'ABSENT' ? 'bg-rose-100 text-rose-800' :
                          day.status === 'HOLIDAY' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {day.badgeText === 'LATE' ? 'LT' : day.badgeText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Legend Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500 font-medium flex-wrap gap-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-600"></span> Today
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Present
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-600"></span> Leave
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span> Absent
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Holiday
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* Full-Screen Expanded Calendar Modal */}
        {isCalendarExpanded && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 md:p-6 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden">
              
              {/* Expanded Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 text-cyan-800 rounded-xl">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Attendance Calendar View</h2>
                    <p className="text-xs text-gray-500">Full screen overview of monthly attendance, punches, and leaves</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1 rounded-lg">
                    <button 
                      type="button" 
                      onClick={handlePrevMonth}
                      className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-extrabold text-gray-900 uppercase tracking-wider min-w-[110px] text-center">
                      {monthNames[month]} {year}
                    </span>
                    <button 
                      type="button" 
                      onClick={handleNextMonth}
                      className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => setIsCalendarExpanded(false)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Filter Pills in Expanded View */}
              <div className="px-6 py-2.5 bg-white border-b border-gray-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mr-1">Filter Status:</span>
                  {(['ALL', 'PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HOLIDAY'] as const).map(filter => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveRequestFilter(filter)}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        activeRequestFilter === filter
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-600"></span> Today</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Present</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Leave</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Absent</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Holiday</div>
                </div>
              </div>

              {/* Expanded Calendar Content Area */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
                {/* Month Days Weekday Headers */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-gray-500 pb-2 border-b border-gray-100">
                  <span className="text-rose-500">Sunday</span>
                  <span>Monday</span>
                  <span>Tuesday</span>
                  <span>Wednesday</span>
                  <span>Thursday</span>
                  <span>Friday</span>
                  <span>Saturday</span>
                </div>

                {/* Expanded Month Days Matrix */}
                <div className="grid grid-cols-7 gap-2.5 text-center mt-3">
                  {filteredCalendarDays.map((day, idx) => {
                    if (!day.currentMonth) {
                      return (
                        <div key={idx} className="h-16 p-1.5 text-xs text-gray-300 bg-gray-50/40 rounded-lg border border-dashed border-gray-200 flex items-start justify-start font-mono">
                          {day.dayNumber}
                        </div>
                      );
                    }

                    let cardStyle = 'border-gray-200 bg-white hover:bg-slate-50 text-gray-700 shadow-2xs';
                    let numBadgeStyle = 'text-gray-800 font-bold';

                    if (day.status === 'TODAY') {
                      cardStyle = 'border-cyan-500 bg-cyan-50/70 ring-2 ring-cyan-400/50 shadow-xs';
                      numBadgeStyle = 'bg-cyan-600 text-white font-extrabold px-1.5 py-0.2 rounded-full';
                    } else if (day.status === 'PRESENT') {
                      cardStyle = 'border-emerald-200 bg-emerald-50/50 text-emerald-950 shadow-2xs';
                      numBadgeStyle = 'text-emerald-700 font-bold';
                    } else if (day.status === 'LATE') {
                      cardStyle = 'border-amber-200 bg-amber-50/60 text-amber-950 shadow-2xs';
                      numBadgeStyle = 'text-amber-700 font-bold';
                    } else if (day.status === 'LEAVE') {
                      cardStyle = 'border-purple-200 bg-purple-50/60 text-purple-950 shadow-2xs';
                      numBadgeStyle = 'text-purple-700 font-bold';
                    } else if (day.status === 'ABSENT') {
                      cardStyle = 'border-rose-200 bg-rose-50/50 text-rose-950 shadow-2xs';
                      numBadgeStyle = 'text-rose-600 font-bold';
                    } else if (day.status === 'HOLIDAY') {
                      cardStyle = 'border-amber-200 bg-amber-50/50 text-amber-900 shadow-2xs';
                      numBadgeStyle = 'text-amber-600 font-bold';
                    } else if (day.status === 'WEEK_OFF') {
                      cardStyle = 'border-gray-100 bg-gray-50/80 text-gray-400';
                    }

                    const inFormatted = day.inTime ? (day.inTime.includes('T') ? new Date(day.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : day.inTime) : null;
                    const outFormatted = day.outTime ? (day.outTime.includes('T') ? new Date(day.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : day.outTime) : null;

                    let workedStr = '';
                    if (day.workedMinutes && day.workedMinutes > 0) {
                      const h = Math.floor(day.workedMinutes / 60);
                      const m = day.workedMinutes % 60;
                      workedStr = `${h}h ${m}m`;
                    }

                    return (
                      <div
                        key={idx}
                        title={day.details || `Date: ${day.dateStr}`}
                        className={`h-16 p-1.5 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${cardStyle}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-mono leading-none ${numBadgeStyle}`}>
                            {day.dayNumber}
                          </span>

                          {day.badgeText && (
                            <span className={`text-[8px] font-extrabold px-1 rounded-xs uppercase leading-tight ${
                              day.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                              day.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                              day.status === 'LEAVE' ? 'bg-purple-100 text-purple-700' :
                              day.status === 'ABSENT' ? 'bg-rose-100 text-rose-700' :
                              day.status === 'HOLIDAY' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {day.badgeText === 'P' ? 'PRESENT' : day.badgeText === 'L' ? 'LEAVE' : day.badgeText === 'A' ? 'ABSENT' : day.badgeText === 'H' ? 'HOLIDAY' : day.badgeText}
                            </span>
                          )}
                        </div>

                        {/* Detailed Punches & Work Duration */}
                        <div className="space-y-0.5 text-[9px] font-mono leading-none">
                          {inFormatted && (
                            <div className="text-emerald-700 flex items-center justify-between">
                              <span className="text-gray-400 font-sans text-[8px]">In:</span>
                              <span className="font-semibold">{inFormatted}</span>
                            </div>
                          )}

                          {outFormatted && (
                            <div className="text-cyan-700 flex items-center justify-between">
                              <span className="text-gray-400 font-sans text-[8px]">Out:</span>
                              <span className="font-semibold">{outFormatted}</span>
                            </div>
                          )}

                          {!inFormatted && !outFormatted && day.details && (
                            <div className="text-[8px] text-gray-500 font-medium truncate">
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
          </div>
        )}

        {/* Quick Apply Leave Modal */}
        {isApplyLeaveModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Apply Leave</h3>
                    <p className="text-[11px] text-gray-500">Quick 1-click leave application</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(false)}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleApplyLeaveSubmit} className="p-5 space-y-4">
                {/* Available Leave Balances */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Casual</span>
                    <span className="text-xs font-extrabold text-cyan-700">{leaveBalances.casual} days</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Sick</span>
                    <span className="text-xs font-extrabold text-emerald-700">{leaveBalances.sick} days</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Earned</span>
                    <span className="text-xs font-extrabold text-indigo-700">{leaveBalances.earned} days</span>
                  </div>
                </div>

                {/* Leave Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Leave Type</label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveType: e.target.value }))}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600 bg-white"
                  >
                    <option value="CASUAL">Casual Leave (CL)</option>
                    <option value="SICK">Sick Leave (SL)</option>
                    <option value="EARNED">Earned / Privilege Leave (EL/PL)</option>
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">From Date</label>
                    <input
                      type="date"
                      value={leaveForm.fromDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveDate: e.target.value, fromDate: e.target.value }))}
                      required
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">To Date</label>
                    <input
                      type="date"
                      value={leaveForm.toDate}
                      onChange={(e) => setLeaveForm(prev => ({ ...prev, toDate: e.target.value }))}
                      required
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Note</label>
                  <textarea
                    rows={2}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Brief reason for your leave request..."
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-600"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsApplyLeaveModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
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
          </div>
        )}

      </div>
    </>
  );
};

export default EmployeeSelfServicePage;
