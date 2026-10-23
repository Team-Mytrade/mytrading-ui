import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { 
  Calendar, Clock, Briefcase, Laptop, RotateCw, Search,
  Eye, XCircle, X, ChevronLeft, ChevronRight,
  Layers, Palmtree, FileText, Send
} from 'lucide-react';

import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';

type RequestType = 'ALL' | 'LEAVE' | 'REGULARIZATION' | 'ON_DUTY' | 'WORK_FROM_HOME';
type TabType = 'all' | 'leaves' | 'regularizations' | 'onDuty' | 'wfh';

interface UnifiedRequestItem {
  id: number;
  sourceType: 'LEAVE' | 'REGULARIZATION' | 'ON_DUTY' | 'WORK_FROM_HOME';
  requestTypeLabel: string;
  employeeId: number;
  employeeName?: string;
  status: string;
  startDate: string;
  endDate: string;
  durationText?: string;
  reason: string;
  appliedDate?: string;
  rawItem: any;
}

interface LeaveBalanceItem {
  leaveType: string;
  remaining: number;
  allocated?: number;
}

interface LeaveTypeItem {
  id: number;
  name: string;
}

const DEFAULT_LEAVE_TYPES: LeaveTypeItem[] = [
  { id: 1, name: 'Casual' },
  { id: 2, name: 'Sick' },
  { id: 3, name: 'Earned' },
  { id: 4, name: 'Maternity' },
  { id: 5, name: 'Paternity' },
  { id: 6, name: 'Unpaid (LOP)' }
];

const UnifiedRequestCenterPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as TabType | null;

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (queryTab === 'regularizations') return 'regularizations';
    if (queryTab === 'onDuty') return 'onDuty';
    if (queryTab === 'wfh') return 'wfh';
    if (queryTab === 'all') return 'all';
    return 'leaves';
  });

  useEffect(() => {
    if (queryTab && ['all', 'leaves', 'regularizations', 'onDuty', 'wfh'].includes(queryTab)) {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ── Current User Resolution ─────────────────────────────────────────────
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        return {
          id: Number(parsed.employeeId || parsed.id || parsed.userId || 12),
          name: parsed.fullName || parsed.name || parsed.username || "System Admin",
          role: parsed.role || parsed.roles?.[0] || "SUPER_ADMIN",
          email: parsed.email || parsed.username || "super@admin.com",
          code: parsed.employeeCode || `TEC-EMP-0001`
        };
      } catch (e) {}
    }
    return {
      id: 12,
      name: "System Admin",
      role: "SUPER_ADMIN",
      email: "super@admin.com",
      code: "TEC-EMP-0001"
    };
  }, []);

  const [activeEmployeeId, setActiveEmployeeId] = useState<number>(currentUser.id || 12);
  const [employeeCode, setEmployeeCode] = useState<string>(currentUser.code);
  const [employeeName, setEmployeeName] = useState<string>(currentUser.name);

  // ── Common Calendar States ──────────────────────────────────────────────
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  // Total Duration Calculation
  const totalDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [fromDate, toDate]);

  // ── Leave Request Form State ────────────────────────────────────────────
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>(DEFAULT_LEAVE_TYPES);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceItem[]>([
    { leaveType: 'Casual', remaining: 12 },
    { leaveType: 'Sick', remaining: 10 },
    { leaveType: 'Earned', remaining: 15 }
  ]);
  const [leaveTypeId, setLeaveTypeId] = useState<number | string>(1);
  const [dayType, setDayType] = useState<string>("Full Day");
  const [leaveComments, setLeaveComments] = useState<string>("");

  // ── Regularization Form State ───────────────────────────────────────────
  const [regReasonType, setRegReasonType] = useState<string>("Forgot to Punch In");
  const [regCheckInTime, setRegCheckInTime] = useState<string>("09:00");
  const [regCheckOutTime, setRegCheckOutTime] = useState<string>("18:00");
  const [regRemarks, setRegRemarks] = useState<string>("");

  // ── On-Duty Form State ──────────────────────────────────────────────────
  const [odCategory, setOdCategory] = useState<string>("Client Meeting & Discussion");
  const [odClientName, setOdClientName] = useState<string>("");
  const [odLocation, setOdLocation] = useState<string>("");
  const [odCheckInTime, setOdCheckInTime] = useState<string>("09:00");
  const [odCheckOutTime, setOdCheckOutTime] = useState<string>("18:00");
  const [odRemarks, setOdRemarks] = useState<string>("");

  // ── Work From Home Form State ───────────────────────────────────────────
  const [wfhReasonCategory, setWfhReasonCategory] = useState<string>("General Work From Home");
  const [wfhProjectTask, setWfhProjectTask] = useState<string>("Attendance Module Development");
  const [wfhRemarks, setWfhRemarks] = useState<string>("");

  // ── General States ──────────────────────────────────────────────────────
  const [allRequests, setAllRequests] = useState<UnifiedRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<RequestType>('ALL');

  // Inspection Modal State
  const [inspectModalItem, setInspectModalItem] = useState<UnifiedRequestItem | null>(null);

  // ── Resolve Employee Info ───────────────────────────────────────────────
  useEffect(() => {
    const resolveUserEmployeeId = async () => {
      try {
        const empRes = await axios.get('/v1/api/payroll/employee/all');
        if (Array.isArray(empRes.data) && empRes.data.length > 0) {
          const uName = (currentUser.name || '').toLowerCase();
          const uEmail = (currentUser.email || '').toLowerCase();

          const match = empRes.data.find((e: any) => {
            const eName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase() || (e.name || '').toLowerCase();
            const eEmail = (e.email || '').toLowerCase();
            return (uName && (eName.includes(uName) || uName.includes(eName))) || (uEmail && eEmail === uEmail);
          });

          const selected = match || empRes.data.find((e: any) => Number(e.id) === 12) || empRes.data[0];

          if (selected && selected.id) {
            setActiveEmployeeId(Number(selected.id));
            setEmployeeCode(selected.employeeCode || `TEC-EMP-${String(selected.id).padStart(4, '0')}`);
            setEmployeeName(`${selected.firstName || ''} ${selected.lastName || ''}`.trim() || selected.name || currentUser.name);
          }
        }
      } catch (e) {}
    };

    const fetchLeaveTypes = async () => {
      try {
        const res = await axios.get('/v1/api/attendance/leave-types');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setLeaveTypes(res.data);
          setLeaveTypeId(res.data[0].id);
        }
      } catch (e) {}
    };

    resolveUserEmployeeId();
    fetchLeaveTypes();
  }, [currentUser.name, currentUser.email]);

  // ── Load All Requests & Balances ─────────────────────────────────────────
  const loadRequests = async () => {
    setLoading(true);
    const empId = activeEmployeeId || currentUser.id || 12;

    try {
      const [leaveRes, attendanceRes, balanceRes] = await Promise.allSettled([
        axios.get('/v1/api/attendance/leave-requests'),
        axios.get(`/v1/api/attendance/requests/my/${empId}`),
        axios.get('/v1/api/attendance/employee-leave-balances')
      ]);

      const unifiedList: UnifiedRequestItem[] = [];

      // 1. Process Leave Requests
      if (leaveRes.status === 'fulfilled' && Array.isArray(leaveRes.value.data)) {
        leaveRes.value.data.forEach((item: any) => {
          if (!item.employeeId || item.employeeId === empId || currentUser.role.includes('ADMIN')) {
            unifiedList.push({
              id: item.id,
              sourceType: 'LEAVE',
              requestTypeLabel: `Leave (${item.leaveType || 'CASUAL'})`,
              employeeId: item.employeeId || empId,
              employeeName: item.employeeName || currentUser.name,
              status: (item.status || 'PENDING').toUpperCase(),
              startDate: item.fromDate || item.startDate || '-',
              endDate: item.toDate || item.endDate || item.fromDate || '-',
              durationText: `${item.totalDays || 1} day${Number(item.totalDays) > 1 ? 's' : ''}`,
              reason: item.reason || item.comments || 'Leave Application',
              appliedDate: item.createdAt || item.appliedDate || item.fromDate,
              rawItem: item
            });
          }
        });
      }

      // 2. Process Attendance Requests (Regularization, On-Duty, WFH)
      if (attendanceRes.status === 'fulfilled' && Array.isArray(attendanceRes.value.data)) {
        attendanceRes.value.data.forEach((item: any) => {
          const detail = item.requestDetails?.[0] || {};
          const rawType = (item.requestType || detail.requestType || 'REGULARIZATION').toUpperCase();

          let category: 'REGULARIZATION' | 'ON_DUTY' | 'WORK_FROM_HOME' = 'REGULARIZATION';
          let label = 'Attendance Regularization';

          if (rawType.includes('DUTY') || rawType.includes('VISIT')) {
            category = 'ON_DUTY';
            label = 'On-Duty Visit';
          } else if (rawType.includes('HOME') || rawType.includes('WFH') || rawType.includes('REMOTE')) {
            category = 'WORK_FROM_HOME';
            label = 'Work From Home';
          }

          unifiedList.push({
            id: item.id || detail.id || Math.floor(Math.random() * 10000),
            sourceType: category,
            requestTypeLabel: label,
            employeeId: item.employeeId || empId,
            employeeName: item.employeeName || currentUser.name,
            status: (item.status || 'PENDING').toUpperCase(),
            startDate: detail.fromDate || detail.shiftDate || item.createdDate || '-',
            endDate: detail.toDate || detail.fromDate || detail.shiftDate || '-',
            durationText: detail.fromDate === detail.toDate ? '1 day' : 'Multiple dates',
            reason: detail.reason || detail.remarks || detail.purpose || 'Attendance Request',
            appliedDate: item.createdDate || detail.shiftDate || detail.fromDate,
            rawItem: item
          });
        });
      }

      // 3. Process Leave Balances
      if (balanceRes.status === 'fulfilled' && Array.isArray(balanceRes.value.data)) {
        const empBalances = balanceRes.value.data.filter((b: any) => Number(b.employeeId) === empId);
        if (empBalances.length > 0) {
          const formattedBalances: LeaveBalanceItem[] = empBalances.map((b: any) => ({
            leaveType: b.leaveTypeName || b.leaveType || 'General',
            remaining: b.remainingLeaves ?? b.availableLeaves ?? b.balance ?? b.remaining ?? 0,
            allocated: b.allocatedLeaves ?? b.totalLeaves ?? 12
          }));
          setLeaveBalances(formattedBalances);
        }
      }

      unifiedList.sort((a, b) => b.id - a.id);
      setAllRequests(unifiedList);
    } catch (e) {
      console.error('Failed to load requests in hub:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [activeEmployeeId]);

  // ── Metrics Calculation ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = allRequests.length;
    const pending = allRequests.filter(r => r.status === 'PENDING').length;
    const approved = allRequests.filter(r => r.status === 'APPROVED').length;
    const rejected = allRequests.filter(r => r.status === 'REJECTED').length;

    const leavesCount = allRequests.filter(r => r.sourceType === 'LEAVE').length;
    const regCount = allRequests.filter(r => r.sourceType === 'REGULARIZATION').length;
    const odCount = allRequests.filter(r => r.sourceType === 'ON_DUTY').length;
    const wfhCount = allRequests.filter(r => r.sourceType === 'WORK_FROM_HOME').length;

    return {
      total,
      pending,
      approved,
      rejected,
      leavesCount,
      regCount,
      odCount,
      wfhCount
    };
  }, [allRequests]);

  // ── Filtered Requests for History Table ──────────────────────────────────
  const filteredRequests = useMemo(() => {
    return allRequests.filter(r => {
      if (typeFilter !== 'ALL' && r.sourceType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = String(r.id).includes(q);
        const matchType = r.requestTypeLabel.toLowerCase().includes(q);
        const matchReason = r.reason.toLowerCase().includes(q);
        const matchStatus = r.status.toLowerCase().includes(q);
        if (!matchId && !matchType && !matchReason && !matchStatus) return false;
      }

      return true;
    });
  }, [allRequests, typeFilter, statusFilter, searchQuery]);

  // ── Leave Balance Helper ────────────────────────────────────────────────
  const getBalanceForType = (typeKey: string) => {
    const item = leaveBalances.find(b => {
      const name = String(b.leaveType || '').toUpperCase();
      return name.includes(typeKey);
    });
    if (item) {
      return item.remaining;
    }
    return typeKey === 'CASUAL' ? 12 : typeKey === 'SICK' ? 10 : 15;
  };

  // ── Form Clear Handler ──────────────────────────────────────────────────
  const handleClearForm = () => {
    setFromDate(todayStr);
    setToDate(todayStr);
    setLeaveComments("");
    setRegRemarks("");
    setOdRemarks("");
    setOdClientName("");
    setOdLocation("");
    setWfhRemarks("");
  };

  // ── SUBMISSION HANDLERS FOR ALL 4 REQUESTS ───────────────────────────────

  // 1. Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return ToasterService.error("Please select valid dates");
    if (new Date(toDate) < new Date(fromDate)) return ToasterService.error("End Date cannot be before Start Date");

    const matchedType = leaveTypes.find(t => t.id === Number(leaveTypeId));
    const leaveTypeNameStr = (matchedType?.name || "CASUAL").toUpperCase().replace(/\s+/g, '_');
    const effectiveDays = dayType !== "Full Day" && totalDays === 1 ? 0.5 : totalDays;

    const payload = {
      employeeId: activeEmployeeId,
      employeeCode: employeeCode || `EMP-${activeEmployeeId}`,
      employeeName: employeeName || currentUser.name,
      leaveType: leaveTypeNameStr.includes("SICK") ? "SICK" : leaveTypeNameStr.includes("EARNED") ? "EARNED" : "CASUAL",
      fromDate: fromDate,
      toDate: toDate,
      totalDays: Number(effectiveDays),
      reason: leaveComments || "Leave Application"
    };

    try {
      setIsSubmitting(true);
      try {
        await axios.post("/v1/api/attendance/leave-requests", payload);
      } catch (firstErr: any) {
        const errMsg = (firstErr.response?.data?.message || firstErr.response?.data?.error || '').toLowerCase();
        if (errMsg.includes("balance") || errMsg.includes("policy") || firstErr.response?.status === 400 || firstErr.response?.status === 404) {
          try {
            await axios.post("/v1/api/attendance/employee-leave-balances/assign-policy", {
              employeeIds: [activeEmployeeId, 12],
              leavePolicyId: 1
            });
            await axios.post("/v1/api/attendance/leave-requests", payload);
          } catch (retryErr) {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      ToasterService.success(`Leave Request submitted for ${effectiveDays} day(s) successfully!`);
      handleClearForm();
      loadRequests();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      ToasterService.error(msg || "Failed to submit leave request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Regularization Request
  const handleSubmitRegularization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return ToasterService.error("Please select valid dates");

    const payload = {
      employeeId: activeEmployeeId,
      requestDetails: [
        {
          fromDate: fromDate,
          toDate: toDate,
          shiftDate: fromDate,
          requestType: "ATTENDANCE_REGULARIZATION",
          checkInTime: regCheckInTime,
          checkOutTime: regCheckOutTime,
          shiftInTime: "09:00",
          shiftOutTime: "18:00",
          reason: regReasonType,
          remarks: regRemarks || regReasonType
        }
      ]
    };

    try {
      setIsSubmitting(true);
      await axios.post("/v1/api/attendance/requests", payload);
      ToasterService.success("Attendance Regularization Request submitted successfully!");
      handleClearForm();
      loadRequests();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      ToasterService.error(msg || "Failed to submit regularization request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit On-Duty Request
  const handleSubmitOnDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return ToasterService.error("Please select valid dates");

    const payload = {
      employeeId: activeEmployeeId,
      requestDetails: [
        {
          fromDate: fromDate,
          toDate: toDate,
          shiftDate: fromDate,
          requestType: "ON_DUTY",
          clientName: odClientName || "Client Site",
          visitLocation: odLocation || "Official Visit",
          purpose: odCategory,
          checkInTime: odCheckInTime || "09:00",
          checkOutTime: odCheckOutTime || "18:00",
          shiftInTime: "09:00",
          shiftOutTime: "18:00",
          reason: odCategory,
          remarks: odRemarks || odCategory
        }
      ]
    };

    try {
      setIsSubmitting(true);
      await axios.post("/v1/api/attendance/requests", payload);
      ToasterService.success("On-Duty Visit Request submitted successfully!");
      handleClearForm();
      loadRequests();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      ToasterService.error(msg || "Failed to submit on-duty request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Submit Work From Home Request
  const handleSubmitWfh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) return ToasterService.error("Please select valid dates");

    const payload = {
      employeeId: activeEmployeeId,
      requestDetails: [
        {
          fromDate: fromDate,
          toDate: toDate,
          shiftDate: fromDate,
          requestType: "WORK_FROM_HOME",
          projectTaskName: wfhProjectTask || "General Sprint Tasks",
          reason: wfhReasonCategory,
          remarks: wfhRemarks || wfhReasonCategory
        }
      ]
    };

    try {
      setIsSubmitting(true);
      await axios.post("/v1/api/attendance/requests", payload);
      ToasterService.success("Work From Home Request submitted successfully!");
      handleClearForm();
      loadRequests();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      ToasterService.error(msg || "Failed to submit WFH request");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Cancel Request Handler ───────────────────────────────────────────────
  const handleCancelRequest = async (item: UnifiedRequestItem) => {
    if (!window.confirm(`Are you sure you want to cancel ${item.requestTypeLabel} #${item.id}?`)) {
      return;
    }

    try {
      if (item.sourceType === 'LEAVE') {
        await axios.post(`/v1/api/attendance/leave-requests/${item.id}/cancel`);
      } else {
        await axios.post(`/v1/api/attendance/requests/${item.id}/cancel`);
      }
      ToasterService.success(`Request #${item.id} cancelled successfully.`);
      loadRequests();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to cancel request.';
      ToasterService.error(errMsg);
    }
  };

  // ── RENDER COMMON CALENDAR ───────────────────────────────────────────────
  const renderCalendarDays = () => {
    const days = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    const prevMonthDays = daysInMonth(currentMonth - 1, currentYear);
    const calendarDays = [];

    // Trailing days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push(
        <div key={`prev-${i}`} className="flex items-center justify-center py-0.2 sm:py-0.5">
          <div className="w-full aspect-square max-w-[28px] sm:max-w-[34px] 2xl:max-w-[42px] flex items-center justify-center text-slate-300 dark:text-gray-700 text-[9.5px] sm:text-xs 2xl:text-sm font-medium">
            {prevMonthDays - i}
          </div>
        </div>
      );
    }

    // Days in current month
    for (let i = 1; i <= days; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = dateStr >= fromDate && dateStr <= toDate;

      calendarDays.push(
        <div key={`curr-${i}`} className="flex items-center justify-center py-0.2 sm:py-0.5">
          <button 
            type="button"
            className={`w-full aspect-square max-w-[28px] sm:max-w-[34px] 2xl:max-w-[42px] flex items-center justify-center rounded-md sm:rounded-lg text-[10px] sm:text-xs 2xl:text-sm font-semibold transition-all cursor-pointer ${
              isSelected 
                ? 'bg-cyan-600 text-white shadow-xs font-bold ring-2 ring-cyan-500/20' 
                : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#222222]'
            }`}
            onClick={() => {
              if (dateStr < fromDate) {
                setFromDate(dateStr);
                setToDate(dateStr);
              } else {
                setToDate(dateStr);
              }
            }}
            onDoubleClick={() => {
              setFromDate(dateStr);
              setToDate(dateStr);
            }}
          >
            {i}
          </button>
        </div>
      );
    }

    // Next month filling days
    const totalCells = Math.ceil((days + firstDay) / 7) * 7;
    for (let i = 1; i <= totalCells - (days + firstDay); i++) {
      calendarDays.push(
        <div key={`next-${i}`} className="flex items-center justify-center py-0.2 sm:py-0.5">
          <div className="w-full aspect-square max-w-[28px] sm:max-w-[34px] 2xl:max-w-[42px] flex items-center justify-center text-slate-300 dark:text-gray-700 text-[9.5px] sm:text-xs 2xl:text-sm font-medium">
            {i}
          </div>
        </div>
      );
    }

    return calendarDays;
  };

  // ── Table Column Definitions for History Tab ─────────────────────────────
  const columns: ColumnDef<UnifiedRequestItem>[] = [
    {
      key: 'id',
      label: 'Req ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold text-xs">
          #{row.id}
        </span>
      )
    },
    {
      key: 'sourceType',
      label: 'Request Category',
      sortable: true,
      render: (row) => {
        let badgeColor = 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50';
        let icon = <Palmtree className="w-3.5 h-3.5" />;

        if (row.sourceType === 'REGULARIZATION') {
          badgeColor = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50';
          icon = <Clock className="w-3.5 h-3.5" />;
        } else if (row.sourceType === 'ON_DUTY') {
          badgeColor = 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50';
          icon = <Briefcase className="w-3.5 h-3.5" />;
        } else if (row.sourceType === 'WORK_FROM_HOME') {
          badgeColor = 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50';
          icon = <Laptop className="w-3.5 h-3.5" />;
        }

        return (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 ${badgeColor}`}>
              {icon}
              <span>{row.requestTypeLabel}</span>
            </span>
          </div>
        );
      }
    },
    {
      key: 'startDate',
      label: 'Dates / Duration',
      sortable: true,
      render: (row) => (
        <div>
          <div className="text-xs font-mono font-medium text-slate-800 dark:text-gray-200 whitespace-nowrap">
            {row.startDate} {row.startDate !== row.endDate && <span>&rarr; {row.endDate}</span>}
          </div>
          {row.durationText && (
            <div className="text-[11px] text-slate-400 dark:text-gray-500 font-medium">
              {row.durationText}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'reason',
      label: 'Reason / Remarks',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-gray-400 max-w-[260px] truncate block" title={row.reason}>
          {row.reason}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const st = (row.status || 'PENDING').toUpperCase();
        let colorClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-amber-400 dark:border-amber-900/40';
        if (st.includes('APPROV')) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-emerald-400 dark:border-emerald-900/40';
        if (st.includes('REJECT')) colorClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-rose-400 dark:border-rose-900/40';
        if (st.includes('CANCEL')) colorClass = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-gray-800';

        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${colorClass}`}>
            {st}
          </span>
        );
      }
    },
    {
      key: 'appliedDate',
      label: 'Applied On',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
          {row.appliedDate ? String(row.appliedDate).slice(0, 10) : '-'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => setInspectModalItem(row)}
            className="p-1.5 bg-gray-50 dark:bg-[#222222] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] border border-gray-200 dark:!border-transparent rounded-lg text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            title="Inspect Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.status === 'PENDING' && (
            <button
              type="button"
              onClick={() => handleCancelRequest(row)}
              className="p-1.5 bg-rose-50 dark:bg-[#222222] hover:bg-rose-100 dark:hover:bg-[#2a2a2a] border border-rose-200 dark:!border-transparent rounded-lg text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              title="Cancel Request"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta
        title="Employee Request Center"
        description="Unified hub to apply for leave, attendance regularization, on-duty visits, and work from home"
      />
      <PageBreadcrumb pageTitle="Request Center" />

      {/* Screen-Adaptive Outer Container: fills viewport and scales fluidly */}
      <div className="w-full pb-1 sm:pb-2.5 animate-in fade-in duration-200 space-y-1 sm:space-y-1.5 lg:space-y-2 2xl:space-y-3 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

        {/* ── 1. UNIFIED REQUEST TABS ───────────────────────────────────── */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
          <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#282828] rounded-xl shadow-2xs">
            
            {/* All Requests */}
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 2xl:py-2 rounded-lg text-[11px] sm:text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-cyan-50 dark:bg-[#2c2c2c] text-cyan-800 dark:text-white shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
              <span>All Requests</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono bg-gray-200/70 dark:bg-[#282828] text-gray-700 dark:text-gray-300">
                {metrics.total}
              </span>
            </button>

            {/* Leave Requests */}
            <button
              type="button"
              onClick={() => handleTabChange('leaves')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 2xl:py-2 rounded-lg text-[11px] sm:text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'leaves'
                  ? 'bg-cyan-50 dark:bg-[#2c2c2c] text-cyan-800 dark:text-white shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Palmtree className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
              <span>Leave Requests</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono bg-gray-200/70 dark:bg-[#282828] text-gray-700 dark:text-gray-300">
                {metrics.leavesCount}
              </span>
            </button>

            {/* Regularization */}
            <button
              type="button"
              onClick={() => handleTabChange('regularizations')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 2xl:py-2 rounded-lg text-[11px] sm:text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'regularizations'
                  ? 'bg-cyan-50 dark:bg-[#2c2c2c] text-cyan-800 dark:text-white shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
              <span>Regularization</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono bg-gray-200/70 dark:bg-[#282828] text-gray-700 dark:text-gray-300">
                {metrics.regCount}
              </span>
            </button>

            {/* On-Duty Visits */}
            <button
              type="button"
              onClick={() => handleTabChange('onDuty')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 2xl:py-2 rounded-lg text-[11px] sm:text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'onDuty'
                  ? 'bg-cyan-50 dark:bg-[#2c2c2c] text-cyan-800 dark:text-white shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
              <span>On-Duty Visits</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono bg-gray-200/70 dark:bg-[#282828] text-gray-700 dark:text-gray-300">
                {metrics.odCount}
              </span>
            </button>

            {/* Work From Home */}
            <button
              type="button"
              onClick={() => handleTabChange('wfh')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 2xl:py-2 rounded-lg text-[11px] sm:text-xs 2xl:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'wfh'
                  ? 'bg-cyan-50 dark:bg-[#2c2c2c] text-cyan-800 dark:text-white shadow-2xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Laptop className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
              <span>Work From Home</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono bg-gray-200/70 dark:bg-[#282828] text-gray-700 dark:text-gray-300">
                {metrics.wfhCount}
              </span>
            </button>

          </div>
        </div>

        {/* ── 2. EMPLOYEE USER PROFILE BANNER (Auto-Fit & Compact) ─────────── */}
        <div className="w-full bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-xl px-2.5 sm:px-3.5 py-1 sm:py-1.5 2xl:py-2 border border-slate-200/80 dark:!border-transparent shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2 shrink-0 transition-all">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 2xl:w-8 2xl:h-8 rounded-lg bg-cyan-600 text-white font-bold text-xs 2xl:text-sm shadow-2xs flex items-center justify-center shrink-0">
              {employeeName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs 2xl:text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none truncate">
                  {employeeName}
                </h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] 2xl:text-[10px] font-bold bg-cyan-50 dark:bg-transparent text-cyan-700 dark:text-gray-300 border border-cyan-200/80 dark:border-transparent uppercase tracking-wider leading-none shrink-0">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[10px] 2xl:text-xs text-slate-500 dark:text-gray-400 leading-none truncate mt-0.5">
                {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={() => handleTabChange(activeTab === 'all' ? 'leaves' : 'all')}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-slate-200 dark:!border-transparent text-slate-700 dark:text-gray-200 text-[10.5px] sm:text-[11px] 2xl:text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <FileText className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span>{activeTab === 'all' ? 'Back to Form' : `Request History (${metrics.total})`}</span>
            </button>
            <div className="bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg px-2 py-0.5 text-right">
              <span className="text-[8px] 2xl:text-[9px] text-slate-400 dark:text-gray-500 font-medium block uppercase tracking-wider leading-none">
                Employee ID
              </span>
              <span className="text-[10.5px] sm:text-[11px] 2xl:text-xs font-mono font-bold text-slate-700 dark:text-gray-200 leading-tight">
                #{employeeCode}
              </span>
            </div>
          </div>
        </div>

        {/* ── 3. COMMON CALENDAR + DYNAMIC APPLICATION DESK ───────────────── */}
        {activeTab !== 'all' && (
          <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-1.5 sm:gap-2 2xl:gap-3 items-stretch">
              
              {/* ── LEFT COLUMN: COMMON INTERACTIVE CALENDAR ──────────────── */}
              <div className="lg:col-span-5 xl:col-span-5 bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-2 sm:p-2.5 2xl:p-4 flex flex-col justify-between">
                <div>
                  {/* Month Header Navigation */}
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5 border-b border-slate-100 dark:!border-transparent pb-1 sm:pb-1.5">
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-1.5 py-0.5 rounded-lg border border-slate-200/80 dark:!border-transparent shadow-2xs">
                      <button 
                        type="button" 
                        onClick={handlePrevMonth} 
                        className="p-0.5 sm:p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded text-slate-600 dark:text-gray-300 transition cursor-pointer"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />
                      </button>
                      <span className="text-[10px] sm:text-[11px] 2xl:text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider min-w-[90px] sm:min-w-[105px] 2xl:min-w-[120px] text-center">
                        {monthNames[currentMonth]} {currentYear}
                      </span>
                      <button 
                        type="button" 
                        onClick={handleNextMonth} 
                        className="p-0.5 sm:p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded text-slate-600 dark:text-gray-300 transition cursor-pointer"
                        title="Next Month"
                      >
                        <ChevronRight className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />
                      </button>
                    </div>
                    <span className="text-[9px] 2xl:text-[10px] font-medium text-slate-400 dark:text-gray-500">
                      Pick Date Range
                    </span>
                  </div>

                  {/* Weekday Labels (SU, MO, TU, WE, TH, FR, SA) - Responsive Width */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-[9px] sm:text-[10px] 2xl:text-xs font-bold text-slate-400 dark:text-gray-500 uppercase mb-0.5 sm:mb-1 w-full max-w-sm 2xl:max-w-md mx-auto">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>

                  {/* Dates Grid - Fluid auto-adjust to card size */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 w-full max-w-sm 2xl:max-w-md mx-auto">
                    {renderCalendarDays()}
                  </div>
                </div>

                {/* Bottom Legend */}
                <div className="mt-1 pt-1 sm:mt-1.5 sm:pt-1.5 border-t border-slate-100 dark:!border-transparent flex items-center justify-between text-[8px] sm:text-[9px] 2xl:text-[10px] text-slate-500 dark:text-gray-400 flex-wrap gap-1">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full border border-cyan-500 bg-cyan-500/20 inline-block"></span> 
                    Today
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full border border-rose-500 bg-rose-500/20 inline-block"></span> 
                    Absent
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full border border-purple-500 bg-purple-500/20 inline-block"></span> 
                    Half day
                  </span>
                  <span className="text-[8px] sm:text-[8.5px] 2xl:text-[9.5px] text-slate-400 dark:text-gray-500">
                    Double click for 1 day
                  </span>
                </div>
              </div>

              {/* ── RIGHT COLUMN: DYNAMIC APPLICATION FORM ────────────────── */}
              <div className="lg:col-span-7 xl:col-span-7 bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-2 sm:p-2.5 2xl:p-4 flex flex-col justify-between">
                
                {/* 1. LEAVE REQUEST FORM */}
                {activeTab === 'leaves' && (
                  <form onSubmit={handleSubmitLeave} className="space-y-1.5 sm:space-y-2 2xl:space-y-3 flex flex-col justify-between h-full">
                    <div className="space-y-1.5 sm:space-y-2 2xl:space-y-2.5">
                      
                      {/* Top Row: Leave Type & Duration summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5 sm:mb-1">
                            Leave Type *
                          </label>
                          <select
                            value={leaveTypeId}
                            onChange={(e) => setLeaveTypeId(e.target.value ? Number(e.target.value) : "")}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-semibold text-slate-800 dark:text-white cursor-pointer"
                            required
                          >
                            <option value="" className="dark:bg-[#222222] text-gray-400">-- Select Leave Type --</option>
                            {leaveTypes.map((lt) => {
                              const typeKey = lt.name.toLowerCase().includes("casual") ? "CASUAL" : lt.name.toLowerCase().includes("sick") ? "SICK" : "EARNED";
                              const bal = getBalanceForType(typeKey);
                              return (
                                <option key={lt.id} value={lt.id} className="dark:bg-[#222222] dark:text-white">
                                  {lt.name} — ({bal} days balance)
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Duration Summary */}
                        <div className="sm:col-span-5 py-1 px-2 2xl:py-1.5 2xl:px-2.5 bg-slate-50/80 dark:bg-[#222222] rounded-lg border border-slate-200/80 dark:!border-transparent flex items-center justify-between text-[10px] sm:text-[11px] 2xl:text-xs min-h-[30px] sm:min-h-[34px]">
                          <span className="text-slate-600 dark:text-gray-300 truncate">
                            Duration: <strong className="text-slate-900 dark:text-white font-mono">{fromDate || '---'}</strong> to <strong className="text-slate-900 dark:text-white font-mono">{toDate || '---'}</strong>
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.5 bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:!border-transparent rounded-md text-[9px] sm:text-[10px] font-bold shadow-2xs font-mono shrink-0 ml-1">
                            {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                          </span>
                        </div>
                      </div>

                      {/* Date Inputs synced with common calendar */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">From Date *</label>
                          <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono font-medium text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">To Date *</label>
                          <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono font-medium text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      {/* Day Portion Radio */}
                      <div>
                        <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Day Portion</label>
                        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                          {["Full Day", "First half", "Second half"].map((type) => {
                            const isHalfDay = type !== "Full Day";
                            const isDisabled = isHalfDay && fromDate !== toDate;
                            return (
                              <label key={type} className={`flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs 2xl:text-sm font-medium text-slate-700 dark:text-gray-300 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input 
                                  type="radio" 
                                  name="dayType" 
                                  value={type} 
                                  checked={dayType === type}
                                  onChange={(e) => setDayType(e.target.value)}
                                  className="text-cyan-600 focus:ring-cyan-500 dark:bg-[#222222] dark:border-transparent cursor-pointer"
                                />
                                {type}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Reason / Comments */}
                      <div>
                        <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Reason / Comments</label>
                        <textarea 
                          rows={2}
                          value={leaveComments}
                          onChange={(e) => setLeaveComments(e.target.value)}
                          placeholder="Provide details for your leave request..."
                          className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white resize-none min-h-[38px] sm:min-h-[44px] 2xl:min-h-[60px]"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 sm:pt-1.5 border-t border-slate-100 dark:!border-transparent mt-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleClearForm}
                        className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer"
                      >
                        Clear Form
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-3 sm:px-4 py-1 sm:py-1.5 2xl:py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-xs 2xl:text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{isSubmitting ? "Submitting..." : "Submit Leave Request"}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* 2. REGULARIZATION REQUEST FORM */}
                {activeTab === 'regularizations' && (
                  <form onSubmit={handleSubmitRegularization} className="space-y-1.5 sm:space-y-2 2xl:space-y-3 flex flex-col justify-between h-full">
                    <div className="space-y-1.5 sm:space-y-2 2xl:space-y-2.5">
                      
                      {/* Top Row: Reason Type & Duration summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5 sm:mb-1">
                            Regularization Reason *
                          </label>
                          <select
                            value={regReasonType}
                            onChange={(e) => setRegReasonType(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-semibold text-slate-800 dark:text-white cursor-pointer"
                            required
                          >
                            <option value="Forgot to Punch In">Forgot to Punch In</option>
                            <option value="Forgot to Punch Out">Forgot to Punch Out</option>
                            <option value="Missed Both Punches (Biometric Sync)">Missed Both Punches (Biometric Sync)</option>
                            <option value="Biometric Machine Failure">Biometric Machine Failure</option>
                            <option value="Client Visit / Off-site Delay">Client Visit / Off-site Delay</option>
                            <option value="Work From Client Location">Work From Client Location</option>
                          </select>
                        </div>

                        {/* Duration Summary */}
                        <div className="sm:col-span-5 py-1 px-2 2xl:py-1.5 2xl:px-2.5 bg-slate-50/80 dark:bg-[#222222] rounded-lg border border-slate-200/80 dark:!border-transparent flex items-center justify-between text-[10px] sm:text-[11px] 2xl:text-xs min-h-[30px] sm:min-h-[34px]">
                          <span className="text-slate-600 dark:text-gray-300 truncate">
                            Date: <strong className="text-slate-900 dark:text-white font-mono">{fromDate}</strong>
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.5 bg-white dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:!border-transparent rounded-md text-[9px] sm:text-[10px] font-bold shadow-2xs font-mono shrink-0 ml-1">
                            {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                          </span>
                        </div>
                      </div>

                      {/* Date Range Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Target Date *</label>
                          <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => {
                              setFromDate(e.target.value);
                              setToDate(e.target.value);
                            }}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono font-medium text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">To Date (if range)</label>
                          <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono font-medium text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      {/* Time Adjustment Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Adjusted In-Time *</label>
                          <input 
                            type="time"
                            value={regCheckInTime}
                            onChange={(e) => setRegCheckInTime(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Adjusted Out-Time *</label>
                          <input 
                            type="time"
                            value={regCheckOutTime}
                            onChange={(e) => setRegCheckOutTime(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      {/* Remarks */}
                      <div>
                        <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Reason / Explanation *</label>
                        <textarea 
                          rows={2}
                          value={regRemarks}
                          onChange={(e) => setRegRemarks(e.target.value)}
                          placeholder="Explain why the punch was missed or requires regularization..."
                          className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white resize-none min-h-[38px] sm:min-h-[44px] 2xl:min-h-[60px]"
                          required
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 sm:pt-1.5 border-t border-slate-100 dark:!border-transparent mt-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleClearForm}
                        className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer"
                      >
                        Clear Form
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-3 sm:px-4 py-1 sm:py-1.5 2xl:py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-xs 2xl:text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{isSubmitting ? "Submitting..." : "Submit Regularization Request"}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* 3. ON-DUTY REQUEST FORM */}
                {activeTab === 'onDuty' && (
                  <form onSubmit={handleSubmitOnDuty} className="space-y-1.5 sm:space-y-2 2xl:space-y-3 flex flex-col justify-between h-full">
                    <div className="space-y-1.5 sm:space-y-2 2xl:space-y-2.5">
                      
                      {/* Top Row: Category & Duration summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5 sm:mb-1">
                            Duty Category *
                          </label>
                          <select
                            value={odCategory}
                            onChange={(e) => setOdCategory(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-semibold text-slate-800 dark:text-white cursor-pointer"
                            required
                          >
                            <option value="Client Meeting & Discussion">Client Meeting & Discussion</option>
                            <option value="Site / Field Investigation">Site / Field Investigation</option>
                            <option value="Official Conference / Seminar">Official Conference / Seminar</option>
                            <option value="Inter-Branch Official Visit">Inter-Branch Official Visit</option>
                            <option value="Customer Deployment & Training">Customer Deployment & Training</option>
                          </select>
                        </div>

                        {/* Duration Summary */}
                        <div className="sm:col-span-5 py-1 px-2 2xl:py-1.5 2xl:px-2.5 bg-slate-50/80 dark:bg-[#222222] rounded-lg border border-slate-200/80 dark:!border-transparent flex items-center justify-between text-[10px] sm:text-[11px] 2xl:text-xs min-h-[30px] sm:min-h-[34px]">
                          <span className="text-slate-600 dark:text-gray-300 truncate">
                            Dates: <strong className="text-slate-900 dark:text-white font-mono">{fromDate}</strong> to <strong className="text-slate-900 dark:text-white font-mono">{toDate}</strong>
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.5 bg-white dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:!border-transparent rounded-md text-[9px] sm:text-[10px] font-bold shadow-2xs font-mono shrink-0 ml-1">
                            {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                          </span>
                        </div>
                      </div>

                      {/* Client Name & Visit Location */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Client / Org Name</label>
                          <input 
                            type="text"
                            value={odClientName}
                            onChange={(e) => setOdClientName(e.target.value)}
                            placeholder="e.g. Apex Global Solutions"
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Visit Location / City</label>
                          <input 
                            type="text"
                            value={odLocation}
                            onChange={(e) => setOdLocation(e.target.value)}
                            placeholder="e.g. Hyderabad Hitech City"
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Timings */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Expected In-Time</label>
                          <input 
                            type="time"
                            value={odCheckInTime}
                            onChange={(e) => setOdCheckInTime(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono text-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Expected Out-Time</label>
                          <input 
                            type="time"
                            value={odCheckOutTime}
                            onChange={(e) => setOdCheckOutTime(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Purpose / Remarks */}
                      <div>
                        <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Purpose / Official Remarks *</label>
                        <textarea 
                          rows={2}
                          value={odRemarks}
                          onChange={(e) => setOdRemarks(e.target.value)}
                          placeholder="Specify the agenda, client project, or work to be carried out..."
                          className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white resize-none min-h-[38px] sm:min-h-[44px] 2xl:min-h-[60px]"
                          required
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 sm:pt-1.5 border-t border-slate-100 dark:!border-transparent mt-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleClearForm}
                        className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer"
                      >
                        Clear Form
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-3 sm:px-4 py-1 sm:py-1.5 2xl:py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-xs 2xl:text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{isSubmitting ? "Submitting..." : "Submit On-Duty Request"}</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* 4. WORK FROM HOME REQUEST FORM */}
                {activeTab === 'wfh' && (
                  <form onSubmit={handleSubmitWfh} className="space-y-1.5 sm:space-y-2 2xl:space-y-3 flex flex-col justify-between h-full">
                    <div className="space-y-1.5 sm:space-y-2 2xl:space-y-2.5">
                      
                      {/* Top Row: Category & Duration summary */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-2 items-end">
                        <div className="sm:col-span-7">
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5 sm:mb-1">
                            Remote Work Reason *
                          </label>
                          <select
                            value={wfhReasonCategory}
                            onChange={(e) => setWfhReasonCategory(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-semibold text-slate-800 dark:text-white cursor-pointer"
                            required
                          >
                            <option value="General Work From Home">General Work From Home</option>
                            <option value="Focused Sprint / Feature Delivery">Focused Sprint / Feature Delivery</option>
                            <option value="Broadband / Home Facility Work">Broadband / Home Facility Work</option>
                            <option value="Personal / Medical Recovery">Personal / Medical Recovery</option>
                            <option value="Inclement Weather / Transport Issue">Inclement Weather / Transport Issue</option>
                          </select>
                        </div>

                        {/* Duration Summary */}
                        <div className="sm:col-span-5 py-1 px-2 2xl:py-1.5 2xl:px-2.5 bg-slate-50/80 dark:bg-[#222222] rounded-lg border border-slate-200/80 dark:!border-transparent flex items-center justify-between text-[10px] sm:text-[11px] 2xl:text-xs min-h-[30px] sm:min-h-[34px]">
                          <span className="text-slate-600 dark:text-gray-300 truncate">
                            Dates: <strong className="text-slate-900 dark:text-white font-mono">{fromDate}</strong> to <strong className="text-slate-900 dark:text-white font-mono">{toDate}</strong>
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.5 bg-white dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:!border-transparent rounded-md text-[9px] sm:text-[10px] font-bold shadow-2xs font-mono shrink-0 ml-1">
                            {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                          </span>
                        </div>
                      </div>

                      {/* Date Inputs synced with common calendar */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">From Date *</label>
                          <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono font-medium text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">To Date *</label>
                          <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm font-mono font-medium text-slate-800 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      {/* Project / Task Name */}
                      <div>
                        <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Project / Task Details</label>
                        <input 
                          type="text"
                          value={wfhProjectTask}
                          onChange={(e) => setWfhProjectTask(e.target.value)}
                          placeholder="e.g. Attendance Module Architecture & Refactoring"
                          className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white"
                        />
                      </div>

                      {/* Remarks */}
                      <div>
                        <label className="block text-[10px] sm:text-[11px] 2xl:text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-0.5">Reason / Deliverables</label>
                        <textarea 
                          rows={2}
                          value={wfhRemarks}
                          onChange={(e) => setWfhRemarks(e.target.value)}
                          placeholder="Provide details of remote work deliverables or justification..."
                          className="w-full px-2 sm:px-2.5 py-1 sm:py-1.5 2xl:py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs 2xl:text-sm text-slate-800 dark:text-white resize-none min-h-[38px] sm:min-h-[44px] 2xl:min-h-[60px]"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-1 sm:pt-1.5 border-t border-slate-100 dark:!border-transparent mt-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleClearForm}
                        className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer"
                      >
                        Clear Form
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-3 sm:px-4 py-1 sm:py-1.5 2xl:py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-xs 2xl:text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{isSubmitting ? "Submitting..." : "Submit WFH Request"}</span>
                      </button>
                    </div>
                  </form>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ── 4. ALL REQUESTS HISTORY TABLE VIEW ───────────────────────── */}
        {activeTab === 'all' && (
          <div className="bg-white dark:bg-[#191919] border border-slate-200/80 dark:border-[#282828] rounded-xl p-2.5 sm:p-3 2xl:p-4 shadow-2xs space-y-2 sm:space-y-2.5">
            
            {/* Filter Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Category Filter Pills */}
                <div className="flex items-center gap-1 bg-gray-50 dark:bg-[#222222] p-0.5 sm:p-1 rounded-xl border border-gray-200 dark:border-[#303030]">
                  {(['ALL', 'LEAVE', 'REGULARIZATION', 'ON_DUTY', 'WORK_FROM_HOME'] as RequestType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10.5px] sm:text-[11px] 2xl:text-xs font-semibold transition-all cursor-pointer ${
                        typeFilter === t
                          ? 'bg-white dark:bg-[#2f2f2f] text-cyan-700 dark:text-cyan-300 shadow-2xs font-bold'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {t === 'ALL' ? 'All Types' : t === 'WORK_FROM_HOME' ? 'WFH' : t.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-2 sm:px-2.5 py-1 sm:py-1.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#303030] rounded-xl text-[11px] sm:text-xs 2xl:text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                  <option value="CANCELLED">Cancelled Only</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search requests..."
                    className="pl-8 pr-2.5 py-1 sm:py-1.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#303030] rounded-xl text-xs 2xl:text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-44 sm:w-56"
                  />
                </div>

                <TableToolbar onRefresh={loadRequests} />
              </div>
            </div>

            {/* Reusable Table */}
            <div className="overflow-x-auto">
              <ReusableTable
                data={filteredRequests}
                columns={columns}
                loading={loading}
                pageSize={8}
                defaultSortKey="id"
                defaultSortOrder="desc"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── 5. UNIFIED REQUEST INSPECTION MODAL ───────────────────────── */}
      {inspectModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#303030] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 2xl:p-5 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
                  {inspectModalItem.sourceType === 'LEAVE' && <Palmtree className="w-4 h-4 sm:w-5 sm:h-5" />}
                  {inspectModalItem.sourceType === 'REGULARIZATION' && <Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
                  {inspectModalItem.sourceType === 'ON_DUTY' && <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />}
                  {inspectModalItem.sourceType === 'WORK_FROM_HOME' && <Laptop className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                    {inspectModalItem.requestTypeLabel} Details
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-cyan-100">
                    Request Reference: #{inspectModalItem.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectModalItem(null)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-4 2xl:p-5 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs 2xl:text-sm bg-gray-50 dark:bg-[#222222] p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-[#303030]">
                <div>
                  <span className="text-gray-400 block text-[9.5px] sm:text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold text-slate-900 dark:text-white">{inspectModalItem.status}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9.5px] sm:text-[10px] uppercase font-bold">Applied By</span>
                  <span className="font-bold text-slate-900 dark:text-white">{inspectModalItem.employeeName}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9.5px] sm:text-[10px] uppercase font-bold">Date Range</span>
                  <span className="font-bold font-mono text-cyan-600 dark:text-cyan-400">
                    {inspectModalItem.startDate} &rarr; {inspectModalItem.endDate}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9.5px] sm:text-[10px] uppercase font-bold">Duration</span>
                  <span className="font-bold text-slate-900 dark:text-white">{inspectModalItem.durationText || '1 day'}</span>
                </div>
              </div>

              <div>
                <span className="text-gray-400 block text-[10px] sm:text-[11px] font-bold uppercase mb-1">Reason / Comments</span>
                <div className="p-2.5 sm:p-3 bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-[#303030] rounded-xl text-xs 2xl:text-sm text-slate-700 dark:text-gray-300">
                  {inspectModalItem.reason || 'No specific remarks provided.'}
                </div>
              </div>

              {inspectModalItem.rawItem?.requestDetails?.[0] && (
                <div>
                  <span className="text-gray-400 block text-[10px] sm:text-[11px] font-bold uppercase mb-1">Additional Metadata</span>
                  <div className="p-2.5 sm:p-3 bg-gray-50 dark:bg-[#222222] border border-gray-100 dark:border-[#303030] rounded-xl text-xs 2xl:text-sm space-y-1">
                    {inspectModalItem.rawItem.requestDetails[0].visitLocation && (
                      <p><span className="text-gray-400">Location:</span> {inspectModalItem.rawItem.requestDetails[0].visitLocation}</p>
                    )}
                    {inspectModalItem.rawItem.requestDetails[0].clientName && (
                      <p><span className="text-gray-400">Client:</span> {inspectModalItem.rawItem.requestDetails[0].clientName}</p>
                    )}
                    {inspectModalItem.rawItem.requestDetails[0].checkInTime && (
                      <p><span className="text-gray-400">Punches:</span> {inspectModalItem.rawItem.requestDetails[0].checkInTime} - {inspectModalItem.rawItem.requestDetails[0].checkOutTime || '--'}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-gray-50 dark:bg-[#202020] border-t border-gray-100 dark:border-[#303030] flex items-center justify-between">
              {inspectModalItem.status === 'PENDING' ? (
                <button
                  type="button"
                  onClick={() => {
                    handleCancelRequest(inspectModalItem);
                    setInspectModalItem(null);
                  }}
                  className="px-3 sm:px-3.5 py-1 sm:py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel This Request</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setInspectModalItem(null)}
                className="px-3.5 sm:px-4 py-1 sm:py-1.5 bg-gray-200 dark:bg-[#2a2a2a] hover:bg-gray-300 dark:hover:bg-[#353535] text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default UnifiedRequestCenterPage;
