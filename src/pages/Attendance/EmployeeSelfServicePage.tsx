import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Plus, 
  Sparkles, CheckCircle2, AlertCircle, FileText, Briefcase, UserCheck,
  Maximize2, Minimize2, X, Loader2, Fingerprint, ArrowRight, Plane,
  BarChart3, Compass, Info, Check, LogIn, LogOut, Coffee, ChevronDown
} from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { ToasterService } from '../../Services/ToasterService';
import { AuthContext } from '../../context/AuthContext';

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

interface LoggedInEmployee {
  id: number;
  name: string;
  code: string;
  department: string;
  designation: string;
  email?: string;
  initials: string;
}

// Helper to extract initials safely
const getInitials = (name?: string): string => {
  if (!name) return 'SA';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SA';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const extractString = (val: any, fallback: string): string => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.title || val.departmentName || val.designationName || fallback;
  }
  return String(val);
};

const EmployeeSelfServicePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [liveClock, setLiveClock] = useState<Date>(new Date());
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(false);

  // 1-second live ticking clock
  useEffect(() => {
    const timer = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamically resolved Logged-In Employee
  const [currentUser, setCurrentUser] = useState<LoggedInEmployee>(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        const name = (parsed.fullName || parsed.name || parsed.username || 'System Admin').trim();
        const rawId = parsed.employeeId || parsed.id || parsed.userId || 12;
        const numId = Number(rawId) || 12;
        return {
          id: numId,
          name: name,
          code: parsed.employeeCode || `EMP-${numId}`,
          department: parsed.department || 'Operations',
          designation: parsed.role || parsed.roles?.[0] || 'Administrator',
          email: parsed.email || '',
          initials: getInitials(name)
        };
      } catch (e) {}
    }
    return {
      id: 12,
      name: 'System Admin',
      code: 'EMP-12',
      department: 'Operations',
      designation: 'Administrator',
      email: 'admin@system.com',
      initials: 'SA'
    };
  });

  const [resolvedEmpId, setResolvedEmpId] = useState<number>(currentUser.id);

  // Dynamic Employee resolver matching against /v1/api/payroll/employee/all
  useEffect(() => {
    let isMounted = true;
    const resolveUserEmployee = async () => {
      try {
        const authUser = user || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null);
        const uName = (authUser?.fullName || authUser?.name || authUser?.username || '').trim().toLowerCase();
        const uEmail = (authUser?.email || '').trim().toLowerCase();
        const uId = Number(authUser?.employeeId || authUser?.id || authUser?.userId || 0);

        const empRes = await axios.get('/v1/api/payroll/employee/all');
        if (isMounted && Array.isArray(empRes.data) && empRes.data.length > 0) {
          const match = empRes.data.find((e: any) => {
            const eEmail = (e.email || '').trim().toLowerCase();
            const eName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase() || (e.name || '').trim().toLowerCase();
            const eId = Number(e.id || 0);
            const eUserId = Number(e.userId || 0);

            if (uEmail && eEmail === uEmail) return true;
            if (uId > 0 && (eId === uId || eUserId === uId)) return true;
            if (uName && (eName.includes(uName) || uName.includes(eName))) return true;
            return false;
          });

          const selected = match || empRes.data.find((e: any) => Number(e.id) === 12) || empRes.data[0];
          if (selected && selected.id) {
            const validId = Number(selected.id);
            const empName = `${selected.firstName || ''} ${selected.lastName || ''}`.trim() || selected.name || selected.fullName || authUser?.fullName || 'Employee';
            const empCode = selected.employeeCode || `EMP-${selected.id}`;
            const empDept = extractString(selected.departmentName || selected.department, 'Operations');
            const empDesig = extractString(selected.designationName || selected.designation, authUser?.role || 'Staff');

            setResolvedEmpId(validId);
            setCurrentUser({
              id: validId,
              name: empName,
              code: empCode,
              department: empDept,
              designation: empDesig,
              email: selected.email || authUser?.email,
              initials: getInitials(empName)
            });
          }
        }
      } catch (e) {
        console.warn('Could not auto-resolve employee record:', e);
      }
    };
    resolveUserEmployee();
    return () => { isMounted = false; };
  }, [user]);

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
  const [leaveBalances, setLeaveBalances] = useState<{
    casual: { remaining: number; allocated: number; used: number };
    sick: { remaining: number; allocated: number; used: number };
    earned: { remaining: number; allocated: number; used: number };
    policyName: string;
    totalRemaining: number;
    totalAllocated: number;
  }>({
    casual: { remaining: 12, allocated: 12, used: 0 },
    sick: { remaining: 10, allocated: 10, used: 0 },
    earned: { remaining: 15, allocated: 15, used: 0 },
    policyName: 'Standard Leave Policy',
    totalRemaining: 37,
    totalAllocated: 37,
  });
  const [isLeavePopoverOpen, setIsLeavePopoverOpen] = useState<boolean>(false);
  const leavePopoverRef = useRef<HTMLDivElement>(null);

  // Close leave popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (leavePopoverRef.current && !leavePopoverRef.current.contains(event.target as Node)) {
        setIsLeavePopoverOpen(false);
      }
    };
    if (isLeavePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLeavePopoverOpen]);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);

  // Punch & Leave States
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
    const empId = resolvedEmpId || currentUser.id || 12;
    setLoadingCalendar(true);
    try {
      const [attRes, leaveRes, holRes, balRes, policyRes] = await Promise.allSettled([
        axios.get(`/v1/api/attendance/records/my-calendar/${empId}`, {
          params: { employeeId: empId, year, month: month + 1 }
        }),
        axios.get(`/v1/api/attendance/leave-requests/employee/${empId}`),
        axios.get('/v1/api/attendance/holiday-calendars/1/holidays').catch(() => axios.get('/v1/api/attendance/holiday-calendars')),
        axios.get(`/v1/api/attendance/employee-leave-balances/${empId}`),
        axios.get('/v1/api/attendance/leave-policies')
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

      // ── Resolve Active Leave Policy & Quotas ───────────────────────
      let activePolicy: any = null;
      if (policyRes.status === 'fulfilled' && Array.isArray(policyRes.value?.data) && policyRes.value.data.length > 0) {
        activePolicy = policyRes.value.data.find((p: any) => p.active !== false) || policyRes.value.data[0];
      }

      let policyCasualAlloc = 12;
      let policySickAlloc = 10;
      let policyEarnedAlloc = 15;
      const policyTitle = activePolicy?.policyName || 'Standard Leave Policy';

      if (activePolicy && Array.isArray(activePolicy.policyDetails)) {
        const cD = activePolicy.policyDetails.find((d: any) => String(d.leaveType || '').toUpperCase().includes('CASUAL'));
        const sD = activePolicy.policyDetails.find((d: any) => String(d.leaveType || '').toUpperCase().includes('SICK'));
        const eD = activePolicy.policyDetails.find((d: any) => String(d.leaveType || '').toUpperCase().includes('EARNED'));
        if (cD && Number(cD.allocatedLeaves) > 0) policyCasualAlloc = Number(cD.allocatedLeaves);
        if (sD && Number(sD.allocatedLeaves) > 0) policySickAlloc = Number(sD.allocatedLeaves);
        if (eD && Number(eD.allocatedLeaves) > 0) policyEarnedAlloc = Number(eD.allocatedLeaves);
      }

      // Robust Leave Balance Resolution
      let fetchedBalances: any[] = [];
      if (balRes.status === 'fulfilled' && balRes.value?.data) {
        const bData = balRes.value.data;
        if (Array.isArray(bData) && bData.length > 0) {
          fetchedBalances = bData;
        } else if (bData && typeof bData === 'object' && bData.leaveBalance) {
          fetchedBalances = [
            { leaveType: 'CASUAL', remainingLeaves: bData.leaveBalance.casual },
            { leaveType: 'SICK', remainingLeaves: bData.leaveBalance.sick },
            { leaveType: 'EARNED', remainingLeaves: bData.leaveBalance.earned }
          ];
        }
      }

      // If specific endpoint had no balance rows, query collection endpoint
      if (fetchedBalances.length === 0) {
        try {
          const allBalRes = await axios.get('/v1/api/attendance/employee-leave-balances');
          if (Array.isArray(allBalRes.data) && allBalRes.data.length > 0) {
            const forEmp = allBalRes.data.filter((b: any) => Number(b.employeeId) === empId);
            if (forEmp.length > 0) {
              fetchedBalances = forEmp;
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Calculate approved leaves taken by this employee
      const approvedList = Array.isArray(leaveRes.status === 'fulfilled' ? leaveRes.value?.data : [])
        ? (leaveRes.value?.data as any[]).filter((l: any) => (l.status || '').toUpperCase() === 'APPROVED')
        : [];

      const getTakenDays = (typeKey: string) => {
        return approvedList
          .filter((l: any) => String(l.leaveType || '').toUpperCase().includes(typeKey))
          .reduce((sum: number, l: any) => sum + (Number(l.totalDays) || 1), 0);
      };

      const casualUsed = getTakenDays('CASUAL');
      const sickUsed = getTakenDays('SICK');
      const earnedUsed = getTakenDays('EARNED');

      // Check if DB balances are all zero or empty
      const dbAllZeroOrMissing = fetchedBalances.length === 0 || fetchedBalances.every((b: any) => {
        const v = b.remainingLeaves ?? b.availableLeaves ?? b.balance ?? b.remaining ?? 0;
        return Number(v) === 0;
      });

      // If DB has no assignment or all 0 balances, auto-assign active policy in backend asynchronously
      if (dbAllZeroOrMissing && activePolicy?.id) {
        try {
          await axios.post('/v1/api/attendance/employee-leave-balances/assign-policy', {
            employeeIds: [empId],
            leavePolicyId: activePolicy.id
          });
        } catch (e) {
          // ignore non-blocking error
        }
      }

      const computeBalance = (typeKey: string, allocated: number, used: number) => {
        let dbRemaining: number | null = null;
        if (fetchedBalances.length > 0) {
          const item = fetchedBalances.find((b: any) =>
            String(b.leaveType || b.leaveTypeName || b.name || '').toUpperCase().includes(typeKey)
          );
          if (item) {
            const val = item.remainingLeaves ?? item.availableLeaves ?? item.balance ?? item.remaining;
            // Only use db value if it's positive OR if employee actually exhausted their quota
            if (val !== undefined && val !== null && (Number(val) > 0 || used >= allocated)) {
              dbRemaining = Number(val);
            }
          }
        }

        const remaining = dbRemaining !== null ? dbRemaining : Math.max(0, allocated - used);
        return {
          remaining,
          allocated,
          used
        };
      };

      const casualData = computeBalance('CASUAL', policyCasualAlloc, casualUsed);
      const sickData = computeBalance('SICK', policySickAlloc, sickUsed);
      const earnedData = computeBalance('EARNED', policyEarnedAlloc, earnedUsed);

      setLeaveBalances({
        casual: casualData,
        sick: sickData,
        earned: earnedData,
        policyName: policyTitle,
        totalRemaining: casualData.remaining + sickData.remaining + earnedData.remaining,
        totalAllocated: casualData.allocated + sickData.allocated + earnedData.allocated,
      });
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
  const todayOutTime = todayRecord?.outTime || todayRecord?.checkOutTime || todayRecord?.clockOut || null;

  const todayInFormatted = useMemo(() => {
    if (!todayInTime) return null;
    return todayInTime.includes('T')
      ? new Date(todayInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      : todayInTime;
  }, [todayInTime]);

  const todayOutFormatted = useMemo(() => {
    if (!todayOutTime) return null;
    return todayOutTime.includes('T')
      ? new Date(todayOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      : todayOutTime;
  }, [todayOutTime]);

  // Elapsed total hours calculation
  const totalWorkedFormatted = useMemo(() => {
    if (todayRecord?.workedMinutes) {
      const hrs = Math.floor(todayRecord.workedMinutes / 60);
      const mins = todayRecord.workedMinutes % 60;
      return `${hrs}h ${mins}m`;
    }
    if (todayRecord?.workHours) {
      const hrs = Math.floor(todayRecord.workHours);
      const mins = Math.round((todayRecord.workHours - hrs) * 60);
      return `${hrs}h ${mins}m`;
    }
    if (todayInTime && !todayOutTime) {
      try {
        const inDate = todayInTime.includes('T') ? new Date(todayInTime) : new Date(`${todayStr}T${todayInTime}`);
        const diffMs = liveClock.getTime() - inDate.getTime();
        if (diffMs > 0) {
          const totalMins = Math.floor(diffMs / (1000 * 60));
          const hrs = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          return `${hrs}h ${mins}m`;
        }
      } catch (e) {}
    }
    return null;
  }, [todayRecord, todayInTime, todayOutTime, liveClock, todayStr]);

  const greeting = useMemo(() => {
    const hour = liveClock.getHours();
    if (hour < 12) return 'Good morning! Have a great day ahead.';
    if (hour < 17) return 'Good afternoon! Hope your day is going well.';
    return 'Good evening! Hope you had an awesome day.';
  }, [liveClock]);

  // Record 1-Click Web Punch matching Swagger AttendanceCheckInRequest & AttendanceCheckOutRequest
  const handleWebPunch = async (punchType: 'CHECK_IN' | 'CHECK_OUT') => {
    const empId = resolvedEmpId || currentUser.id || 12;
    setIsPunching(true);
    try {
      const endpoint = punchType === 'CHECK_IN' ? '/v1/api/attendance/records/check-in' : '/v1/api/attendance/records/check-out';
      
      const payload: any = {
        employeeId: Number(empId),
        attendanceSource: 'WEB',
        attendanceMode: 'OFFICE',
        deviceId: 'Browser',
        deviceName: 'Employee Self Service Portal',
        location: 'HYD Office',
        latitude: 17.3850,
        longitude: 78.4867,
        ipAddress: '192.168.1.100'
      };

      if (punchType === 'CHECK_OUT') {
        payload.remarks = 'Web checkout from Self Service';
      }

      const res = await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 6000
      });

      const successMsg = res.data?.message || (punchType === 'CHECK_IN' ? 'Check-in recorded successfully!' : 'Check-out recorded successfully!');
      ToasterService.success(successMsg);

      // Immediately update local records with backend response data for zero-latency UI
      if (res.data) {
        const pTime = res.data.punchTime || new Date().toISOString();
        setAttendanceRecords((prev: any[]) => {
          const existing = prev.find((a: any) => String(a.date || '').split('T')[0] === todayStr) || { date: todayStr };
          const others = prev.filter((a: any) => String(a.date || '').split('T')[0] !== todayStr);
          
          const updated = {
            ...existing,
            date: todayStr,
            status: res.data.attendanceStatus || (punchType === 'CHECK_IN' ? 'PRESENT' : 'CHECKED_OUT'),
            inTime: punchType === 'CHECK_IN' ? pTime : (existing.inTime || pTime),
            outTime: punchType === 'CHECK_OUT' ? pTime : existing.outTime,
            workedMinutes: res.data.workedMinutes ?? existing.workedMinutes ?? 0,
            lateMinutes: res.data.lateByMinutes ?? existing.lateMinutes ?? 0
          };

          return [updated, ...others];
        });
      }

      fetchCalendarData();
    } catch (err: any) {
      console.error('Punch Error:', err);
      let rawMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to record attendance.';
      if (typeof rawMsg === 'object') {
        rawMsg = JSON.stringify(rawMsg);
      }
      ToasterService.error(String(rawMsg));
    } finally {
      setIsPunching(false);
    }
  };

  const handleApplyLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empId = resolvedEmpId || currentUser.id || 12;
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

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dStr === todayStr;

      let dayStatus: 'TODAY' | 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'HOLIDAY' | 'WEEK_OFF' | 'REGULAR' = 'REGULAR';
      let dayDetails = '';
      let badge: string | undefined = undefined;

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
            const statusUpper = String(attMatch.status || attMatch.attendanceStatus || '').toUpperCase();
            if (statusUpper === 'PRESENT' || statusUpper === 'CHECKED_IN' || attMatch.inTime || attMatch.checkInTime) {
              dayStatus = 'PRESENT';
              badge = 'P';
            } else if (statusUpper === 'ABSENT') {
              dayStatus = 'ABSENT';
              badge = 'A';
            } else {
              dayStatus = isToday ? 'TODAY' : 'REGULAR';
            }
          } else {
            dayStatus = isToday ? 'TODAY' : 'REGULAR';
          }
        }
      }

      days.push({
        dayNumber: i,
        currentMonth: true,
        dateStr: dStr,
        status: dayStatus,
        details: dayDetails,
        badgeText: badge
      });
    }

    // Trailing days padding to complete standard 35 or 42 grid
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        dayNumber: i,
        currentMonth: false,
        dateStr: ''
      });
    }

    return days;
  }, [year, month, todayStr, holidays, leaveRequests, attendanceRecords]);

  return (
    <>
      <PageMeta title="Employee Self Service" description="Employee dashboard for attendance punching, leave balances, and activity tracking" />
      <PageBreadcrumb pageTitle="Self Service" />

      <div className="max-w-7xl mx-auto space-y-2 sm:space-y-2.5 pb-2 animate-in fade-in duration-200">
        
        {/* ── 1. UNIFIED THEMED USER HERO BANNER (Compact & Sleek) ──────── */}
        <div className="bg-white dark:bg-[#191919] px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-200/80 dark:border-transparent shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all">
          
          {/* User Profile & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-600 dark:bg-[#262626] dark:text-gray-200 dark:border dark:border-[#383838] text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
              {currentUser.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                  {currentUser.name}
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-[#252525] text-slate-700 dark:text-gray-300 border border-slate-200/80 dark:border-transparent">
                  #{currentUser.code}
                </span>
                
                {/* Live Shift State Pill */}
                <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold border ${
                  isCheckedIn 
                    ? 'bg-emerald-50 dark:bg-[#242424] text-emerald-700 dark:text-gray-300 border-emerald-200/80 dark:border-[#333333]'
                    : isCheckedOut
                    ? 'bg-blue-50 dark:bg-[#242424] text-blue-700 dark:text-gray-300 border-blue-200/80 dark:border-[#333333]'
                    : 'bg-slate-100 dark:bg-[#242424] text-slate-600 dark:text-gray-400 border-slate-200/60 dark:border-[#333333]'
                }`}>
                  <Clock className="w-2.5 h-2.5" />
                  {isCheckedIn ? 'Currently at Work' : isCheckedOut ? 'Clocked Out Today' : 'Not Clocked In'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 leading-none truncate mt-0.5">
                {greeting}
              </p>
            </div>
          </div>

          {/* Right: Work Mode & Leave Balances Pill Cards */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap shrink-0">
            
            {/* Work Mode */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#222222] px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-[#2e2e2e] shadow-2xs">
              <CalendarIcon className="w-3.5 h-3.5 text-cyan-600 dark:text-gray-400 shrink-0" />
              <div className="text-left text-[11px]">
                <span className="text-slate-400 dark:text-gray-500 mr-1 uppercase text-[9px] font-semibold">Mode:</span>
                <span className="font-bold text-slate-800 dark:text-gray-200">Office</span>
              </div>
            </div>

            {/* Leave Balance - Idiot-Proof Interactive Widget */}
            <div className="relative" ref={leavePopoverRef}>
              <button
                type="button"
                onClick={() => setIsLeavePopoverOpen(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer shadow-2xs select-none ${
                  isLeavePopoverOpen
                    ? 'bg-purple-50/90 dark:bg-[#282828] border-purple-300 dark:border-[#3a3a3a]'
                    : 'bg-slate-50 hover:bg-slate-100/80 dark:bg-[#222222] dark:hover:bg-[#282828] border-slate-200/80 dark:border-[#2e2e2e]'
                }`}
                title="Click to view detailed leave balances and quota breakdown"
              >
                <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-gray-400 shrink-0" />
                
                <div className="text-left text-[11px] flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-gray-500 uppercase text-[9px] font-sans font-semibold">Leaves:</span>
                  <div className="flex items-center gap-1 font-medium text-[10.5px]">
                    <span className="px-1.5 py-0.2 rounded bg-white dark:bg-[#1a1a1a] border border-slate-200/70 dark:border-[#303030] text-slate-700 dark:text-gray-300 font-semibold" title="Casual Leave Remaining">
                      Casual <span className="font-bold text-purple-700 dark:text-gray-200">{leaveBalances.casual.remaining}d</span>
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-white dark:bg-[#1a1a1a] border border-slate-200/70 dark:border-[#303030] text-slate-700 dark:text-gray-300 font-semibold" title="Sick Leave Remaining">
                      Sick <span className="font-bold text-amber-700 dark:text-gray-200">{leaveBalances.sick.remaining}d</span>
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-white dark:bg-[#1a1a1a] border border-slate-200/70 dark:border-[#303030] text-slate-700 dark:text-gray-300 font-semibold" title="Earned Leave Remaining">
                      Earned <span className="font-bold text-emerald-700 dark:text-gray-200">{leaveBalances.earned.remaining}d</span>
                    </span>
                  </div>
                </div>

                <ChevronDown className={`w-3 h-3 text-slate-400 dark:text-gray-400 transition-transform duration-200 ml-0.5 shrink-0 ${isLeavePopoverOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Idiot-Proof Rich Popover Breakdown Card */}
              {isLeavePopoverOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-76 sm:w-80 bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200/90 dark:border-[#333333] shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-[#282828]">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-purple-600 dark:text-gray-400" />
                        Leave Quotas & Balances
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-gray-500 truncate max-w-[180px]">
                        Policy: {leaveBalances.policyName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase font-semibold text-slate-400 dark:text-gray-500 block leading-tight">Total Available</span>
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-white font-mono">
                        {leaveBalances.totalRemaining} / {leaveBalances.totalAllocated} Days
                      </span>
                    </div>
                  </div>

                  {/* 3 Detailed Breakdown Cards */}
                  <div className="space-y-2">
                    {/* Casual Leave */}
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#242424] border border-slate-200/70 dark:border-[#2e2e2e]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-500 dark:bg-gray-400"></span>
                          Casual Leave (CL)
                        </span>
                        <span className="font-extrabold text-purple-700 dark:text-white font-mono text-[11px]">
                          {leaveBalances.casual.remaining} days left
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-400 mb-1.5">
                        <span>Allocated: {leaveBalances.casual.allocated}d</span>
                        <span>Used: {leaveBalances.casual.used}d</span>
                      </div>
                      {/* Visual progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-[#333] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-purple-500 dark:bg-gray-300 h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (leaveBalances.casual.remaining / (leaveBalances.casual.allocated || 1)) * 100))}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* Sick Leave */}
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#242424] border border-slate-200/70 dark:border-[#2e2e2e]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-gray-400"></span>
                          Sick Leave (SL)
                        </span>
                        <span className="font-extrabold text-amber-700 dark:text-white font-mono text-[11px]">
                          {leaveBalances.sick.remaining} days left
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-400 mb-1.5">
                        <span>Allocated: {leaveBalances.sick.allocated}d</span>
                        <span>Used: {leaveBalances.sick.used}d</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[#333] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 dark:bg-gray-300 h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (leaveBalances.sick.remaining / (leaveBalances.sick.allocated || 1)) * 100))}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* Earned Leave */}
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#242424] border border-slate-200/70 dark:border-[#2e2e2e]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-800 dark:text-gray-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-gray-400"></span>
                          Earned Leave (EL)
                        </span>
                        <span className="font-extrabold text-emerald-700 dark:text-white font-mono text-[11px]">
                          {leaveBalances.earned.remaining} days left
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-gray-400 mb-1.5">
                        <span>Allocated: {leaveBalances.earned.allocated}d</span>
                        <span>Used: {leaveBalances.earned.used}d</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-[#333] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 dark:bg-gray-300 h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, (leaveBalances.earned.remaining / (leaveBalances.earned.allocated || 1)) * 100))}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Popover Action Buttons */}
                  <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-[#282828] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsLeavePopoverOpen(false);
                        setIsApplyLeaveModalOpen(true);
                      }}
                      className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-slate-900 font-bold rounded-lg text-xs text-center transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Apply for Leave
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLeavePopoverOpen(false);
                        navigate('/att_requestCenter');
                      }}
                      className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#262626] dark:hover:bg-[#303030] text-slate-700 dark:text-gray-300 font-semibold rounded-lg text-xs text-center transition cursor-pointer"
                      title="View all requests & history"
                    >
                      History
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ── 2. TWO-COLUMN BALANCED DASHBOARD ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-2.5 items-start">
          
          {/* ── LEFT COLUMN: PUNCH STATION & TODAY'S OVERVIEW (7 COLS) ───── */}
          <div className="lg:col-span-7 space-y-2 sm:space-y-2.5">
            
            {/* HERO PUNCH IN / OUT CARD */}
            <div className="bg-white dark:bg-[#191919] rounded-xl border border-slate-200/80 dark:border-transparent p-3 sm:p-3.5 shadow-2xs relative overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-50 dark:bg-[#252525] text-cyan-600 dark:text-gray-300 dark:border dark:border-[#303030] flex items-center justify-center shrink-0">
                  <Fingerprint className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                    Punch In / Out
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-gray-500">
                    Track your daily attendance with a single click.
                  </p>
                </div>
              </div>

              {/* 3-Section Interior Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                
                {/* Section 1: Live Digital Clock & Status (4 Cols) */}
                <div className="sm:col-span-4 space-y-0.5">
                  <div className="text-2xl sm:text-3xl font-mono font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {liveClock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400">
                    {liveClock.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div className="pt-0.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-gray-300">
                      <span className={`w-1.5 h-1.5 rounded-full ${isCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-gray-600'}`}></span>
                      {isCheckedIn ? 'Currently at Work' : isCheckedOut ? 'Shift Ended' : 'Not Clocked In'}
                    </span>
                  </div>
                </div>

                {/* Section 2: Punch Action Buttons (5 Cols) */}
                <div className="sm:col-span-5 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleWebPunch('CHECK_IN')}
                    disabled={isPunching || isCheckedIn}
                    className={`w-full py-1.5 sm:py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98 ${
                      isCheckedIn 
                        ? 'bg-slate-100 dark:bg-[#252525] text-slate-400 dark:text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 dark:bg-[#252525] dark:hover:bg-[#2e2e2e] dark:text-gray-200 dark:border dark:border-[#383838] dark:shadow-none'
                    }`}
                  >
                    {isPunching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
                    <span>{isCheckedIn ? 'Punched In' : 'Punch In'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleWebPunch('CHECK_OUT')}
                    disabled={isPunching || !isCheckedIn}
                    className={`w-full py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border cursor-pointer active:scale-98 ${
                      isCheckedIn
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border-transparent shadow-xs shadow-amber-600/20 dark:bg-[#252525] dark:hover:bg-[#2e2e2e] dark:text-gray-200 dark:border-[#383838] dark:shadow-none'
                        : 'bg-slate-50 dark:bg-[#222222] text-slate-400 dark:text-gray-500 border-slate-200/80 dark:border-[#2e2e2e] cursor-not-allowed'
                    }`}
                  >
                    {isPunching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                    <span>Punch Out</span>
                  </button>

                  <div className="text-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => navigate('/att_punch')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 dark:text-gray-400 dark:hover:text-gray-200 hover:underline cursor-pointer"
                    >
                      <Fingerprint className="w-3 h-3" />
                      <span>View Attendance Details</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Section 3: Biometric Graphic (3 Cols) */}
                <div className="sm:col-span-3 hidden sm:flex items-center justify-center">
                  <div className="relative w-16 h-20 rounded-xl bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600 dark:from-[#292929] dark:via-[#202020] dark:to-[#171717] dark:border dark:border-[#333333] p-1 shadow-md shadow-cyan-500/20 dark:shadow-none flex flex-col items-center justify-between">
                    <div className="w-full h-0.5 bg-white/40 dark:bg-[#333333] rounded-full mt-0.5"></div>
                    <div className="w-12 h-14 bg-white dark:bg-[#141414] rounded-lg flex items-center justify-center shadow-inner dark:border dark:border-[#262626]">
                      <Fingerprint className={`w-6 h-6 ${isCheckedIn ? 'text-emerald-500 dark:text-gray-200 animate-pulse' : 'text-cyan-500 dark:text-gray-400'}`} />
                    </div>
                    <div className="w-2.5 h-0.5 bg-white/50 dark:bg-[#333333] rounded-full mb-0.5"></div>
                  </div>
                </div>

              </div>

            </div>

            {/* TODAY'S OVERVIEW (4 MINI CARDS) */}
            <div className="bg-white dark:bg-[#191919] rounded-xl border border-slate-200/80 dark:border-transparent p-3 sm:p-3.5 shadow-2xs space-y-2">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#262626] pb-1.5">
                <h3 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Today's Overview
                </h3>
                <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500">
                  {liveClock.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* 4 Overview Mini Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                
                {/* 1. Punch In */}
                <div className="p-2 bg-slate-50/70 dark:bg-[#222222] rounded-lg border border-slate-200/60 dark:border-[#2a2a2a] space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="w-5 h-5 rounded-md bg-emerald-50 dark:bg-[#2a2a2a] text-emerald-600 dark:text-gray-300 flex items-center justify-center">
                      <Clock className="w-3 h-3" />
                    </div>
                    <span className={`px-1 py-0.2 rounded text-[8.5px] font-semibold ${
                      todayInFormatted 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-[#282828] dark:text-gray-200' 
                        : 'bg-slate-200 text-slate-600 dark:bg-[#2a2a2a] dark:text-gray-400'
                    }`}>
                      {todayInFormatted ? 'On Time' : 'Pending'}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-medium text-slate-400 dark:text-gray-400 block leading-none">
                    Punch In
                  </span>
                  <div className="text-[11.5px] font-bold text-slate-900 dark:text-white font-mono leading-none">
                    {todayInFormatted || 'Not Done'}
                  </div>
                </div>

                {/* 2. Lunch Break */}
                <div className="p-2 bg-slate-50/70 dark:bg-[#222222] rounded-lg border border-slate-200/60 dark:border-[#2a2a2a] space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-[#2a2a2a] text-blue-600 dark:text-gray-300 flex items-center justify-center">
                      <Coffee className="w-3 h-3" />
                    </div>
                    <span className="text-[8.5px] text-slate-400 dark:text-gray-500">—</span>
                  </div>
                  <span className="text-[9.5px] font-medium text-slate-400 dark:text-gray-400 block leading-none">
                    Lunch Break
                  </span>
                  <div className="text-[11.5px] font-bold text-slate-900 dark:text-white font-mono leading-none">
                    Not Taken
                  </div>
                </div>

                {/* 3. Punch Out */}
                <div className="p-2 bg-slate-50/70 dark:bg-[#222222] rounded-lg border border-slate-200/60 dark:border-[#2a2a2a] space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-[#2a2a2a] text-purple-600 dark:text-gray-300 flex items-center justify-center">
                      <Clock className="w-3 h-3" />
                    </div>
                    <span className="text-[8.5px] text-slate-400 dark:text-gray-500">—</span>
                  </div>
                  <span className="text-[9.5px] font-medium text-slate-400 dark:text-gray-400 block leading-none">
                    Punch Out
                  </span>
                  <div className="text-[11.5px] font-bold text-slate-900 dark:text-white font-mono leading-none">
                    {todayOutFormatted || 'Not Done'}
                  </div>
                </div>

                {/* 4. Total Hours */}
                <div className="p-2 bg-slate-50/70 dark:bg-[#222222] rounded-lg border border-slate-200/60 dark:border-[#2a2a2a] space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="w-5 h-5 rounded-md bg-cyan-50 dark:bg-[#2a2a2a] text-cyan-600 dark:text-gray-300 flex items-center justify-center">
                      <Clock className="w-3 h-3" />
                    </div>
                    <span className="text-[8.5px] text-cyan-600 dark:text-gray-400 font-semibold">
                      {isCheckedIn ? 'Live' : isCheckedOut ? 'Done' : '—'}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-medium text-slate-400 dark:text-gray-400 block leading-none">
                    Total Hours
                  </span>
                  <div className="text-[11.5px] font-bold text-slate-900 dark:text-white font-mono leading-none">
                    {totalWorkedFormatted || '—'}
                  </div>
                </div>

              </div>

              {/* Bottom Wellness Notice */}
              <div className="py-1 px-2.5 bg-cyan-50/50 dark:bg-[#202020] rounded-lg border border-cyan-100/70 dark:border-[#2a2a2a] flex items-center gap-2 text-[10.5px] text-cyan-900 dark:text-gray-400">
                <Info className="w-3.5 h-3.5 text-cyan-600 dark:text-gray-400 shrink-0" />
                <span>A healthy work-life balance leads to greater productivity. Remember to take scheduled breaks.</span>
              </div>

            </div>

          </div>

          {/* ── RIGHT COLUMN: CALENDAR & INTEGRATED STATUS/ACTIONS (5 COLS) ─ */}
          <div className="lg:col-span-5 space-y-2 sm:space-y-2.5">
            
            {/* 1. CALENDAR CARD (Compact) */}
            <div className="bg-white dark:bg-[#191919] p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-transparent shadow-2xs space-y-1.5">
              
              {/* Header Navigation */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#262626] pb-1.5">
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-1.5 py-0.5 rounded-lg border border-slate-200/70 dark:border-transparent shadow-2xs">
                  <button 
                    type="button" 
                    onClick={handlePrevMonth}
                    className="p-0.5 hover:bg-white dark:hover:bg-[#2a2a2a] rounded text-slate-600 dark:text-gray-300 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-white uppercase tracking-wider min-w-[95px] text-center">
                    {monthNames[month]} {year}
                  </span>
                  <button 
                    type="button" 
                    onClick={handleNextMonth}
                    className="p-0.5 hover:bg-white dark:hover:bg-[#2a2a2a] rounded text-slate-600 dark:text-gray-300 transition cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCalendarExpanded(true)}
                  className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#222222] rounded-lg transition cursor-pointer"
                  title="Expand Calendar"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Day Name Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>

              {/* Day Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((d, idx) => {
                  if (!d.currentMonth) {
                    return (
                      <div key={`empty-${idx}`} className="h-6 sm:h-7 flex items-center justify-center text-[10px] text-slate-300 dark:text-gray-700">
                        {d.dayNumber}
                      </div>
                    );
                  }

                  const isToday = d.dateStr === todayStr;

                  return (
                    <div
                      key={`day-${idx}`}
                      className={`h-6 sm:h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold relative transition cursor-default ${
                        isToday 
                          ? 'bg-cyan-600 text-white font-bold shadow-xs dark:bg-[#323232] dark:text-white dark:border dark:border-gray-500 dark:shadow-none'
                          : d.status === 'PRESENT'
                          ? 'bg-emerald-50 dark:bg-[#222222] text-emerald-700 dark:text-gray-200 font-bold'
                          : d.status === 'LEAVE'
                          ? 'bg-purple-50 dark:bg-[#222222] text-purple-700 dark:text-gray-300 font-bold'
                          : d.status === 'HOLIDAY'
                          ? 'bg-amber-50 dark:bg-[#222222] text-amber-700 dark:text-gray-400 font-bold'
                          : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#222222]'
                      }`}
                    >
                      <span>{d.dayNumber}</span>
                      {d.status === 'PRESENT' && !isToday && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500 dark:bg-gray-400"></span>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

            {/* 2. TODAY'S STATUS & QUICK ACTIONS (Integrated Compact Strip) */}
            <div className="bg-white dark:bg-[#191919] p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-transparent shadow-2xs space-y-2">
              
              {/* Status Header Bar */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-[#262626]">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                    isCheckedIn 
                      ? 'bg-emerald-500 text-white shadow-2xs dark:bg-[#252525] dark:text-gray-200 dark:border dark:border-[#383838] dark:shadow-none' 
                      : isCheckedOut 
                      ? 'bg-blue-600 text-white shadow-2xs dark:bg-[#252525] dark:text-gray-200 dark:border dark:border-[#383838] dark:shadow-none'
                      : 'bg-slate-200 text-slate-600 dark:bg-[#282828] dark:text-gray-300'
                  }`}>
                    <Check className="w-3 h-3" />
                    {isCheckedIn ? 'Present' : isCheckedOut ? 'Checked Out' : 'Not Clocked In'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 truncate max-w-[140px]">
                    {isCheckedIn && todayInFormatted 
                      ? `In: ${todayInFormatted}` 
                      : isCheckedOut && todayOutFormatted
                      ? `Out: ${todayOutFormatted}`
                      : 'No check-in'}
                  </span>
                </div>

                <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                  Quick Actions
                </span>
              </div>

              {/* 4 Compact Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                
                {/* 1. Apply Leave */}
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(true)}
                  className="p-1.5 sm:p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#282828] border border-slate-200/70 dark:border-[#2e2e2e] text-left flex items-center gap-2 transition cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-pink-50 dark:bg-[#282828] text-pink-600 dark:text-gray-300 dark:border dark:border-[#333333] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-200 leading-tight">
                    Apply Leave
                  </span>
                </button>

                {/* 2. View Attendance */}
                <button
                  type="button"
                  onClick={() => navigate('/att_attendanceTracking')}
                  className="p-1.5 sm:p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#282828] border border-slate-200/70 dark:border-[#2e2e2e] text-left flex items-center gap-2 transition cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-[#282828] text-blue-600 dark:text-gray-300 dark:border dark:border-[#333333] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-200 leading-tight">
                    Attendance
                  </span>
                </button>

                {/* 3. Request Hub */}
                <button
                  type="button"
                  onClick={() => navigate('/att_requestCenter')}
                  className="p-1.5 sm:p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#282828] border border-slate-200/70 dark:border-[#2e2e2e] text-left flex items-center gap-2 transition cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-[#282828] text-indigo-600 dark:text-gray-300 dark:border dark:border-[#333333] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Plane className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-200 leading-tight">
                    Request Center
                  </span>
                </button>

                {/* 4. View Reports */}
                <button
                  type="button"
                  onClick={() => navigate('/att_reports')}
                  className="p-1.5 sm:p-2 rounded-lg bg-slate-50/80 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#282828] border border-slate-200/70 dark:border-[#2e2e2e] text-left flex items-center gap-2 transition cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-md bg-cyan-50 dark:bg-[#282828] text-cyan-600 dark:text-gray-300 dark:border dark:border-[#333333] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-200 leading-tight">
                    Reports
                  </span>
                </button>

              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── 4. QUICK APPLY LEAVE MODAL ─────────────────────────────────────── */}
      {isApplyLeaveModalOpen && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsApplyLeaveModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#303030] w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-[#252525] text-cyan-600 dark:text-gray-300 dark:border dark:border-[#333333] flex items-center justify-center shadow-2xs">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Quick Apply Leave</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsApplyLeaveModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#282828] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyLeaveSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveForm.leaveType}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveType: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-medium text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-gray-500 cursor-pointer"
                >
                  <option value="CASUAL">Casual Leave ({leaveBalances.casual.remaining} remaining)</option>
                  <option value="SICK">Sick Leave ({leaveBalances.sick.remaining} remaining)</option>
                  <option value="EARNED">Earned Leave ({leaveBalances.earned.remaining} remaining)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.fromDate}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, fromDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.toDate}
                    onChange={(e) => setLeaveForm(prev => ({ ...prev, toDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs font-mono text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-gray-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for requesting leave..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#333333] rounded-xl text-xs text-slate-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-gray-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#2c2c2c] rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLeave}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 dark:bg-[#2c2c2c] dark:hover:bg-[#383838] dark:border dark:border-[#404040] rounded-xl shadow-2xs dark:shadow-none transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingLeave ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── 5. FULL EXPANDED CALENDAR MODAL ────────────────────────────────── */}
      {isCalendarExpanded && createPortal(
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsCalendarExpanded(false)}
        >
          <div 
            className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#303030] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:px-6 border-b border-slate-100 dark:border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-[#252525] text-cyan-600 dark:text-gray-300 dark:border dark:border-[#333333] flex items-center justify-center shadow-2xs">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Attendance Calendar — {monthNames[month]} {year}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-gray-400">
                    Detailed daily shifts, leaves, and holidays log for {currentUser.name}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsCalendarExpanded(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#282828] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 dark:text-gray-500 uppercase">
                <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((d, idx) => {
                  if (!d.currentMonth) {
                    return (
                      <div key={`exp-empty-${idx}`} className="h-16 rounded-xl border border-dashed border-slate-100 dark:border-[#262626] p-1.5 text-slate-300 dark:text-gray-700 text-xs">
                        {d.dayNumber}
                      </div>
                    );
                  }

                  const isToday = d.dateStr === todayStr;

                  return (
                    <div
                      key={`exp-day-${idx}`}
                      className={`h-16 rounded-xl p-1.5 border flex flex-col justify-between text-xs transition ${
                        isToday 
                          ? 'border-cyan-500 bg-cyan-50/40 dark:border-gray-500 dark:bg-[#282828]' 
                          : d.status === 'PRESENT'
                          ? 'border-emerald-200/80 bg-emerald-50/50 dark:bg-[#222222] dark:border-[#2e2e2e]'
                          : d.status === 'LEAVE'
                          ? 'border-purple-200/80 bg-purple-50/50 dark:bg-[#222222] dark:border-[#2e2e2e]'
                          : d.status === 'HOLIDAY'
                          ? 'border-amber-200/80 bg-amber-50/50 dark:bg-[#222222] dark:border-[#2e2e2e]'
                          : 'border-slate-200/60 dark:border-[#262626] bg-slate-50/30 dark:bg-[#202020]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isToday ? 'text-cyan-600 dark:text-white' : 'text-slate-800 dark:text-gray-200'}`}>
                          {d.dayNumber}
                        </span>
                        {d.badgeText && (
                          <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                            d.badgeText === 'P' ? 'bg-emerald-100 text-emerald-800 dark:bg-[#282828] dark:text-gray-200' :
                            d.badgeText === 'L' ? 'bg-purple-100 text-purple-800 dark:bg-[#282828] dark:text-gray-300' :
                            d.badgeText === 'H' ? 'bg-amber-100 text-amber-800 dark:bg-[#282828] dark:text-gray-300' :
                            'bg-slate-200 text-slate-700 dark:bg-[#282828] dark:text-gray-300'
                          }`}>
                            {d.badgeText}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                        {d.details || (isToday ? 'Today' : '')}
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
    </>
  );
};

export default React.memo(EmployeeSelfServicePage);
