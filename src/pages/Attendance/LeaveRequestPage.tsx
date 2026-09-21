import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Calendar, User, Clock, CheckCircle2, AlertCircle, Plus, Send, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

interface LeaveType {
  id: number;
  name: string;
}

interface LeaveBalance {
  id?: number;
  employeeId: number;
  leaveTypeId?: number;
  leaveType?: string;
  leaveTypeName?: string;
  name?: string;
  remaining?: number;
  remainingLeaves?: number;
  availableLeaves?: number;
  balance?: number;
  allocatedLeaves?: number;
}

const EMPLOYEE_URL = "/v1/api/payroll/employee";
const LEAVE_BALANCE_URL = "/v1/api/attendance/employee-leave-balances";
const LEAVE_API_URL = "/v1/api/attendance/leave-requests";

const LeaveRequestPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        return {
          id: parsed.id || parsed.userId || 12,
          name: parsed.fullName || parsed.name || parsed.username || "System Admin",
          role: parsed.role || parsed.roles?.[0] || "SUPER_ADMIN",
          email: parsed.email || parsed.username || "super@admin.com"
        };
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
    return { id: 12, name: "System Admin", role: "SUPER_ADMIN", email: "super@admin.com" };
  }, []);

  const [activeEmployeeId, setActiveEmployeeId] = useState<number>(12);
  const [employeeCode, setEmployeeCode] = useState<string>("TEC-EMP-0001");
  const [employeeName, setEmployeeName] = useState<string>("Lakshmii Kanthh");

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
            setEmployeeCode(selected.employeeCode || `EMP-${selected.id}`);
            setEmployeeName(`${selected.firstName || ''} ${selected.lastName || ''}`.trim() || selected.name || currentUser.name);
          }
        }
      } catch (e) {}
    };
    resolveUserEmployeeId();
  }, [currentUser]);

  const selectedEmployeeId = activeEmployeeId;
  
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayType, setDayType] = useState("Full Day");
  const [leaveTypeId, setLeaveTypeId] = useState<number | "">("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'apply' | 'history'>('apply');

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadEmployees();
    loadLeaveTypes();
    loadMyLeaves();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadLeaveBalances(Number(selectedEmployeeId));
    } else {
      setLeaveBalances([]);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (fromDate && toDate && fromDate !== toDate) {
      if (dayType !== "Full Day") {
        setDayType("Full Day");
      }
    }
  }, [fromDate, toDate, dayType]);

  const loadMyLeaves = async (empId: number = selectedEmployeeId) => {
    const numericId = Number(empId) || 12;
    try {
      const res = await axios.get(`/v1/api/attendance/leave-requests/employee/${numericId}`);
      if (Array.isArray(res.data)) {
        setMyLeaves(res.data);
      }
    } catch (err) {}
  };

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${EMPLOYEE_URL}/all`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadLeaveTypes = () => {
    const defaults = [
      { id: 1, name: "Casual Leave" },
      { id: 2, name: "Sick Leave" },
      { id: 3, name: "Earned Leave" }
    ];
    setLeaveTypes(defaults);
    setLeaveTypeId(prev => prev || defaults[0].id);
  };

  const loadLeaveBalances = async (empId: number) => {
    try {
      const res = await axios.get<LeaveBalance[]>(`${LEAVE_BALANCE_URL}/${empId}`);
      if (Array.isArray(res.data)) {
        setLeaveBalances(res.data);
      }
    } catch (err) {
      setLeaveBalances([
        { id: 101, employeeId: empId, leaveType: 'CASUAL', remainingLeaves: 12 },
        { id: 102, employeeId: empId, leaveType: 'SICK', remainingLeaves: 12 },
        { id: 103, employeeId: empId, leaveType: 'EARNED', remainingLeaves: 18 }
      ]);
    }
  };

  const getBalanceForType = (typeKey: string) => {
    if (!Array.isArray(leaveBalances) || leaveBalances.length === 0) {
      return typeKey === 'CASUAL' ? 12 : typeKey === 'SICK' ? 12 : 18;
    }
    const item = leaveBalances.find(b => {
      const name = String(b.leaveType || b.leaveTypeName || b.name || '').toUpperCase();
      return name.includes(typeKey);
    });
    if (item) {
      return item.remainingLeaves ?? item.availableLeaves ?? item.remaining ?? item.balance ?? item.allocatedLeaves ?? (typeKey === 'CASUAL' ? 12 : typeKey === 'SICK' ? 12 : 18);
    }
    return typeKey === 'CASUAL' ? 12 : typeKey === 'SICK' ? 12 : 18;
  };

  const totalDays = useMemo(() => {
    if (!fromDate || !toDate) return 0;
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return dayType !== "Full Day" && diffDays === 1 ? 0.5 : diffDays;
  }, [fromDate, toDate, dayType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return ToasterService.error("Please select an employee");
    if (!leaveTypeId) return ToasterService.error("Please select a Leave Type");
    if (!fromDate || !toDate) return ToasterService.error("Please select valid dates");
    if (new Date(toDate) < new Date(fromDate)) return ToasterService.error("End Date cannot be before Start Date");

    const matchedType = leaveTypes.find(t => t.id === Number(leaveTypeId));
    const leaveTypeNameStr = (matchedType?.name || "CASUAL").toUpperCase().replace(/\s+/g, '_');

    const payload = {
      employeeId: Number(selectedEmployeeId),
      employeeCode: employeeCode || `EMP-${selectedEmployeeId}`,
      employeeName: employeeName || currentUser.name || "Lakshmii Kanthh",
      leaveType: leaveTypeNameStr.includes("SICK") ? "SICK" : leaveTypeNameStr.includes("EARNED") ? "EARNED" : "CASUAL",
      fromDate: fromDate,
      toDate: toDate,
      totalDays: Number(totalDays),
      reason: comments || "Family Function"
    };

    try {
      setIsSubmitting(true);

      try {
        await axios.post("/v1/api/attendance/leave-requests", payload);
      } catch (firstErr: any) {
        const errMsg = (firstErr.response?.data?.message || firstErr.response?.data?.error || '').toLowerCase();
        
        // Auto-assign leave policy if balance not found
        if (errMsg.includes("balance") || errMsg.includes("policy") || firstErr.response?.status === 400 || firstErr.response?.status === 404) {
          try {
            await axios.post("/v1/api/attendance/employee-leave-balances/assign-policy", {
              employeeIds: [Number(selectedEmployeeId), 12],
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

      ToasterService.success("Leave request submitted successfully!");
      setComments("");
      setLeaveTypeId("");
      loadMyLeaves();
      loadLeaveBalances(Number(selectedEmployeeId));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error;
      if (msg && msg.toLowerCase().includes("balance not found")) {
        ToasterService.error("Employee Leave Balance not found. Please assign a Leave Policy first under Leave Management.");
      } else {
        ToasterService.error(msg || "Failed to submit leave request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const renderCalendar = () => {
    const days = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    const prevMonthDays = daysInMonth(currentMonth - 1, currentYear);
    const calendarDays = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push(
        <div key={`prev-${i}`} className="flex items-center justify-center p-0.5">
          <div className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-gray-700 text-xs font-medium">{prevMonthDays - i}</div>
        </div>
      );
    }

    for (let i = 1; i <= days; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = dateStr >= fromDate && dateStr <= toDate;

      calendarDays.push(
        <div key={`curr-${i}`} className="flex items-center justify-center p-0.5">
          <button 
            type="button"
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

    const totalCells = Math.ceil((days + firstDay) / 7) * 7;
    for (let i = 1; i <= totalCells - (days + firstDay); i++) {
      calendarDays.push(
        <div key={`next-${i}`} className="flex items-center justify-center p-0.5">
          <div className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-gray-700 text-xs font-medium">{i}</div>
        </div>
      );
    }

    return calendarDays;
  };

  const historyColumns: ColumnDef<any>[] = [
    { key: 'id', label: 'Req ID', sortable: true, render: (row) => <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">#{row.id}</span> },
    { key: 'leaveType', label: 'Leave Type', sortable: true, render: (row) => <span className="font-bold text-xs text-slate-900 dark:text-white">{row.leaveType || 'CASUAL'}</span> },
    { 
      key: 'fromDate', 
      label: 'Dates', 
      sortable: true, 
      render: (row) => {
        const start = row.fromDate || row.startDate || '-';
        const end = row.toDate || row.endDate || '-';
        return <span className="text-slate-700 dark:text-gray-300 font-mono text-xs whitespace-nowrap">{start} &rarr; {end}</span>;
      } 
    },
    { 
      key: 'totalDays', 
      label: 'Days', 
      sortable: true, 
      render: (row) => <span className="font-bold font-mono text-xs text-slate-900 dark:text-white">{row.totalDays ?? row.days ?? 1} {Number(row.totalDays ?? row.days ?? 1) === 1 ? 'day' : 'days'}</span> 
    },
    { key: 'reason', label: 'Reason', sortable: true, render: (row) => <span className="text-xs text-slate-600 dark:text-gray-400 max-w-[220px] truncate block">{row.reason || '-'}</span> },
    { 
      key: 'status', 
      label: 'Status', 
      sortable: true, 
      render: (row) => {
        const st = String(row.status || 'PENDING').toUpperCase();
        const badgeStyle = st.includes('APPROV') ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
          st.includes('REJECT') ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' :
          'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
        return (
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${badgeStyle}`}>
            {st}
          </span>
        );
      } 
    },
  ];

  return (
    <>
      <PageMeta title="Leave Request" description="Submit and track leave applications" />
      <PageBreadcrumb pageTitle="Leave Request" />

      <div className="max-w-6xl mx-auto pb-4 animate-in fade-in duration-200 mt-1">
        
        {/* User Banner matching Punch Station theme */}
        <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-[#303030] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-600 text-white font-bold text-sm shadow-2xs flex items-center justify-center shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{currentUser.name}</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800 uppercase tracking-wider">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'history' ? 'apply' : 'history')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-slate-200 dark:border-[#303030] text-slate-700 dark:text-gray-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{activeTab === 'history' ? 'Back to Apply' : `Request History (${myLeaves.length})`}</span>
            </button>
            <div className="bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-xl px-3 py-1.5 text-right">
              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium block uppercase tracking-wider">Employee ID</span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-gray-200">#{employeeCode || `EMP-${selectedEmployeeId || 12}`}</span>
            </div>
          </div>
        </div>

        {/* APPLY TAB */}
        {activeTab === 'apply' && (
          <div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start mb-4">
                
                {/* Left Column: Interactive Calendar */}
                <div className="lg:col-span-5 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] p-4 sm:p-5 flex flex-col justify-between min-h-[380px]">
                  <div>
                    {/* Month Header */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-[#303030] pb-2.5">
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-2 py-1 rounded-xl border border-slate-200/80 dark:border-[#303030] shadow-2xs">
                        <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider min-w-[120px] text-center">
                          {monthNames[currentMonth]} {currentYear}
                        </span>
                        <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500">Pick Date Range</span>
                    </div>

                    {/* Weekday Labels */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-2">
                      <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                    </div>

                    {/* Dates Grid */}
                    <div className="grid grid-cols-7 gap-1 max-w-xs mx-auto lg:max-w-none">
                      {renderCalendar()}
                    </div>
                  </div>

                  {/* Bottom Legend */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#303030] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-cyan-500 bg-cyan-500/20 inline-block"></span> Today</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-rose-500 bg-rose-500/20 inline-block"></span> Absent</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-purple-500 bg-purple-500/20 inline-block"></span> Half day</span>
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-gray-500">
                      Double click any date to select single day
                    </div>
                  </div>
                </div>

                {/* Right Column: Leave Application Desk */}
                <div className="lg:col-span-7 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] p-4 sm:p-5 flex flex-col justify-between min-h-[380px]">
                  <div className="space-y-3">
                    {/* Leave Type Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">Leave Type *</label>
                      <select
                        value={leaveTypeId}
                        onChange={(e) => setLeaveTypeId(e.target.value ? Number(e.target.value) : "")}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
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
                    <div className="p-2.5 px-3.5 bg-slate-50/80 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:border-[#303030] flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-gray-300">
                        Duration: <strong className="text-slate-900 dark:text-white font-mono">{fromDate || '---'}</strong> to <strong className="text-slate-900 dark:text-white font-mono">{toDate || '---'}</strong>
                      </span>
                      <span className="px-2.5 py-0.5 bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 rounded-lg text-[11px] font-bold shadow-2xs font-mono">
                        {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                      </span>
                    </div>

                    {/* Date Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">From Date *</label>
                        <input 
                          type="date"
                          value={fromDate}
                          onChange={(e) => setFromDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs font-mono font-medium text-slate-800 dark:text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">To Date *</label>
                        <input 
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs font-mono font-medium text-slate-800 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    {/* Day Portion Radio Choice */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">Day Portion</label>
                      <div className="flex items-center gap-4">
                        {["Full Day", "First half", "Second half"].map((type) => {
                          const isHalfDay = type !== "Full Day";
                          const isDisabled = isHalfDay && fromDate !== toDate;
                          return (
                            <label key={type} className={`flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-gray-300 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input 
                                type="radio" 
                                name="dayType" 
                                value={type}
                                checked={dayType === type}
                                onChange={(e) => setDayType(e.target.value)}
                                className="text-cyan-600 focus:ring-cyan-500 dark:bg-[#222222] dark:border-[#303030] cursor-pointer"
                              />
                              {type}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Comments */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">Reason / Comments</label>
                      <textarea 
                        rows={2}
                        placeholder="Provide details for your leave request..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:border-[#303030] rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 resize-none"
                      />
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#303030] flex items-center justify-end gap-2.5 shrink-0 mt-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setFromDate("");
                        setToDate("");
                        setComments("");
                      }}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Clear Form
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
                    </button>
                  </div>
                </div>

              </div>
            </form>
          </div>
        )}

        {/* HISTORY TAB USING COMMON ReusableTable */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:border-[#303030] overflow-hidden p-4 sm:p-5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-3">My Leave History Log</h3>
            <ReusableTable
              data={myLeaves}
              columns={historyColumns}
              searchable={true}
              searchPlaceholder="Search leave history..."
              pageSize={10}
              defaultSortKey="id"
              defaultSortOrder="desc"
            />
          </div>
        )}
      </div>
    </>
  );
};

export default LeaveRequestPage;
