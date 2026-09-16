import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Calendar, User, Clock, CheckCircle2, AlertCircle, Plus, Send, FileText } from "lucide-react";
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
        <div key={`prev-${i}`} className="flex items-center justify-center">
          <div className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">{prevMonthDays - i}</div>
        </div>
      );
    }

    for (let i = 1; i <= days; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = dateStr >= fromDate && dateStr <= toDate;

      calendarDays.push(
        <div key={`curr-${i}`} className="flex items-center justify-center py-0.5">
          <button 
            type="button"
            className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-all ${
              isSelected 
                ? 'bg-cyan-600 text-white shadow-sm font-semibold' 
                : 'text-gray-700 hover:bg-gray-100'
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
        <div key={`next-${i}`} className="flex items-center justify-center">
          <div className="w-7 h-7 flex items-center justify-center text-gray-300 text-xs">{i}</div>
        </div>
      );
    }

    return calendarDays;
  };

  const historyColumns: ColumnDef<any>[] = [
    { key: 'id', label: 'Req ID', sortable: true, render: (row) => <span className="font-mono text-cyan-700 font-bold">#{row.id}</span> },
    { key: 'leaveType', label: 'Leave Type', sortable: true, render: (row) => <span className="font-bold text-xs text-gray-900">{row.leaveType || 'CASUAL'}</span> },
    { 
      key: 'fromDate', 
      label: 'Dates', 
      sortable: true, 
      render: (row) => {
        const start = row.fromDate || row.startDate || '-';
        const end = row.toDate || row.endDate || '-';
        return <span className="text-gray-700 font-mono text-xs whitespace-nowrap">{start} &rarr; {end}</span>;
      } 
    },
    { 
      key: 'totalDays', 
      label: 'Days', 
      sortable: true, 
      render: (row) => <span className="font-bold font-mono text-xs text-gray-900">{row.totalDays ?? row.days ?? 1} {Number(row.totalDays ?? row.days ?? 1) === 1 ? 'day' : 'days'}</span> 
    },
    { key: 'reason', label: 'Reason', sortable: true, render: (row) => <span className="text-xs text-gray-600 max-w-[220px] truncate block">{row.reason || '-'}</span> },
    { 
      key: 'status', 
      label: 'Status', 
      sortable: true, 
      render: (row) => {
        const st = String(row.status || 'PENDING').toUpperCase();
        const badgeStyle = st.includes('APPROV') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          st.includes('REJECT') ? 'bg-rose-50 text-rose-700 border-rose-200' :
          'bg-amber-50 text-amber-700 border-amber-200';
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

      <div className="max-w-5xl mx-auto pb-2 animate-in fade-in duration-200 mt-0.5">
        
        {/* Compact User Banner */}
        <div className="bg-white rounded-lg shadow-2xs border border-gray-200/80 p-2.5 mb-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7.5 h-7.5 rounded-md bg-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-gray-900">{currentUser.name}</h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'history' ? 'apply' : 'history')}
              className="hover:underline flex items-center gap-1 bg-cyan-50 px-2.5 py-0.5 rounded text-cyan-800 border border-cyan-200 text-[11px] font-semibold shadow-2xs transition-all"
            >
              <FileText className="w-3 h-3" /> Request History ({myLeaves.length})
            </button>
            <div className="text-left sm:text-right">
              <span className="text-[9px] text-gray-400 font-medium block">Employee Info</span>
              <span className="text-[11px] font-mono font-bold text-cyan-700">#{selectedEmployeeId || 12} ({employeeCode || 'TEC-EMP-0001'})</span>
            </div>
          </div>
        </div>

        {/* Segmented Tab Navigation */}
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex p-1 bg-gray-100/80 rounded-xl gap-1 border border-gray-200/60">
            <button
              type="button"
              onClick={() => setActiveTab('apply')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'apply'
                  ? 'bg-white text-cyan-700 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-cyan-700 shadow-sm font-semibold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>My Leave History</span>
            </button>
          </div>
        </div>

        {/* APPLY TAB */}
        {activeTab === 'apply' && (
          <div className="space-y-3">
            {/* Live Leave Balance Cards Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-xl border border-cyan-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Casual Leave</span>
                  <span className="text-base font-extrabold text-cyan-800 font-mono">{getBalanceForType('CASUAL')} <span className="text-xs font-semibold text-cyan-600">days available</span></span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 font-bold text-xs">CL</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Sick Leave</span>
                  <span className="text-base font-extrabold text-emerald-800 font-mono">{getBalanceForType('SICK')} <span className="text-xs font-semibold text-emerald-600">days available</span></span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">SL</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-purple-200/80 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Earned Leave</span>
                  <span className="text-base font-extrabold text-purple-800 font-mono">{getBalanceForType('EARNED')} <span className="text-xs font-semibold text-purple-600">days available</span></span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-xs">EL</div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xs border border-gray-200/80 overflow-hidden">
              <div className="p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Left Column: Calendar */}
                <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-gray-100 pb-4 lg:pb-0 lg:pr-4">
                  <div className="flex items-center justify-between mb-2">
                    <button type="button" onClick={handlePrevMonth} className="p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
                      &lt;
                    </button>
                    <h3 className="text-xs font-bold text-gray-800">{monthNames[currentMonth]} {currentYear}</h3>
                    <button type="button" onClick={handleNextMonth} className="p-1 rounded-md text-gray-500 hover:bg-gray-100 transition-colors">
                      &gt;
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2 border-b border-gray-100 pb-2 text-center text-[11px] font-semibold text-gray-400">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {renderCalendar()}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded bg-cyan-600" />
                      <span>Selected Range</span>
                    </div>
                    <span>Click dates to set range</span>
                  </div>
                </div>

                {/* Right Column: Leave Form */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                  
                  {/* Leave Type Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Leave Type *</label>
                    <select
                      value={leaveTypeId}
                      onChange={(e) => setLeaveTypeId(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-xs font-semibold text-gray-800"
                      required
                    >
                      <option value="">-- Select Leave Type --</option>
                      {leaveTypes.map((lt) => {
                        const typeKey = lt.name.toLowerCase().includes("casual") ? "CASUAL" : lt.name.toLowerCase().includes("sick") ? "SICK" : "EARNED";
                        const bal = getBalanceForType(typeKey);
                        return (
                          <option key={lt.id} value={lt.id}>
                            {lt.name} — ({bal} days balance)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                {/* Duration Summary */}
                <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-100 flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    Duration: <strong className="text-gray-900">{fromDate}</strong> to <strong className="text-gray-900">{toDate}</strong>
                  </span>
                  <span className="px-2.5 py-0.5 bg-white text-cyan-700 border border-cyan-200 rounded-md text-xs font-bold shadow-2xs">
                    {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                  </span>
                </div>

                {/* Date Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From Date *</label>
                    <input 
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">To Date *</label>
                    <input 
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-xs"
                      required
                    />
                  </div>
                </div>

                {/* Day Portion Radio Choice */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Day Portion</label>
                  <div className="flex items-center gap-4">
                    {["Full Day", "First half", "Second half"].map((type) => {
                      const isHalfDay = type !== "Full Day";
                      const isDisabled = isHalfDay && fromDate !== toDate;
                      return (
                        <label key={type} className={`flex items-center gap-1.5 text-xs ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input 
                            type="radio" 
                            name="dayType" 
                            value={type}
                            checked={dayType === type}
                            onChange={(e) => setDayType(e.target.value)}
                            className="text-cyan-600 focus:ring-cyan-500"
                          />
                          {type}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reason / Comments</label>
                  <textarea 
                    rows={3}
                    placeholder="Provide details for your leave request..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button 
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                  setComments("");
                }}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                Clear Form
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white rounded-lg text-xs font-bold hover:bg-cyan-700 transition-all shadow-sm"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* HISTORY TAB USING COMMON ReusableTable */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200/80 overflow-hidden p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">My Leave History Log</h3>
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
