import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { FileText, Send, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import TableToolbar from "../../components/common/TableToolbar";
import { ToasterService } from "../../Services/ToasterService";
import { todayIso } from "../../utils/localDate";
import {
  apiError, CalendarDay, fetchLeaveBalances, fetchMonth, formatDays, freeDays, LeaveBalance, leaveTypeLabel,
} from "./attendanceApi";

const LEAVE_API_URL = "/v1/api/attendance/leave-requests";

interface LeaveRow {
  id: number;
  leaveType: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  halfDay?: boolean;
  halfDaySession?: string | null;
  approvalStatus: string;
  reason?: string;
  approverRemarks?: string | null;
  actionBy?: string | null;
  createdDate?: string;
}

const DAY_TYPES = [
  { label: "Full Day", session: null },
  { label: "First half", session: "FIRST_HALF" },
  { label: "Second half", session: "SECOND_HALF" },
] as const;

// Months (year, month1) touched by a date range
const monthsBetween = (from: string, to: string) => {
  const out: [number, number][] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endKey = Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7));
  while (y * 12 + m <= endKey && out.length < 13) {
    out.push([y, m]);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
};

const LeaveRequestPage: React.FC = () => {
  // Own employee identity from the login token; leave is always applied for yourself
  const currentUser = useCurrentEmployee();
  const employeeId = currentUser.id;

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [dayType, setDayType] = useState<string>("Full Day");
  const [leaveType, setLeaveType] = useState<string>("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myLeaves, setMyLeaves] = useState<LeaveRow[]>([]);
  const [activeTab, setActiveTab] = useState<'apply' | 'history'>('apply');
  const [currentDate, setCurrentDate] = useState(new Date());
  // Weekly offs and holidays by date, for the picker and the day estimate
  const [offDays, setOffDays] = useState<Record<string, string>>({});

  const loadMyLeaves = useCallback(async () => {
    if (!currentUser.hasEmployee) return;
    try {
      const res = await axios.get(`${LEAVE_API_URL}/employee/${employeeId}`);
      setMyLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load your leave requests."));
    }
  }, [currentUser.hasEmployee, employeeId]);

  const loadLeaveBalances = useCallback(async () => {
    if (!currentUser.hasEmployee) return;
    try {
      setBalances(await fetchLeaveBalances(employeeId));
    } catch {
      setBalances([]);
    }
  }, [currentUser.hasEmployee, employeeId]);

  useEffect(() => {
    loadMyLeaves();
    loadLeaveBalances();
  }, [loadMyLeaves, loadLeaveBalances]);

  // Default to the first leave type the employee has
  useEffect(() => {
    if (balances.length && !balances.some((b) => b.leaveType === leaveType)) {
      setLeaveType(balances[0].leaveType);
    }
  }, [balances, leaveType]);

  // Off days for the shown month and the selected range
  useEffect(() => {
    if (!currentUser.hasEmployee) return;
    const months = new Map<string, [number, number]>();
    months.set(`${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`, [currentDate.getFullYear(), currentDate.getMonth() + 1]);
    if (fromDate && toDate && fromDate <= toDate) {
      monthsBetween(fromDate, toDate).forEach(([y, m]) => months.set(`${y}-${m}`, [y, m]));
    }
    let cancelled = false;
    Promise.all([...months.values()].map(([y, m]) => fetchMonth(y, m).catch(() => [] as CalendarDay[])))
      .then((all) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        all.flat().forEach((d) => {
          if (d.holidayName) map[d.date] = d.holidayName;
          else if (d.weeklyOff) map[d.date] = "Weekly off";
        });
        setOffDays((prev) => ({ ...prev, ...map }));
      });
    return () => { cancelled = true; };
  }, [currentUser.hasEmployee, currentDate, fromDate, toDate]);

  useEffect(() => {
    if (fromDate && toDate && fromDate !== toDate && dayType !== "Full Day") {
      setDayType("Full Day");
    }
  }, [fromDate, toDate, dayType]);

  const isHalfDay = dayType !== "Full Day";

  // Estimate only; the server counts the working days when the request is sent
  const totalDays = useMemo(() => {
    if (!fromDate || !toDate || toDate < fromDate) return 0;
    let count = 0;
    for (let d = new Date(`${fromDate}T00:00:00`); ; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (key > toDate) break;
      if (!offDays[key]) count += 1;
    }
    return isHalfDay && count > 0 ? 0.5 : count;
  }, [fromDate, toDate, isHalfDay, offDays]);

  const selectedBalance = balances.find((b) => b.leaveType === leaveType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.hasEmployee) return ToasterService.error("No employee record is linked to your account.");
    if (!leaveType) return ToasterService.error("Please select a leave type");
    if (!fromDate || !toDate) return ToasterService.error("Please select valid dates");
    if (toDate < fromDate) return ToasterService.error("End Date cannot be before Start Date");
    if (!comments.trim()) return ToasterService.error("Please give a reason");

    try {
      setIsSubmitting(true);
      const res = await axios.post(LEAVE_API_URL, {
        leaveType,
        fromDate,
        toDate,
        halfDay: isHalfDay,
        halfDaySession: DAY_TYPES.find((t) => t.label === dayType)?.session ?? null,
        reason: comments.trim(),
      });
      ToasterService.success(`Leave request for ${formatDays(res.data?.totalDays)} day(s) sent for approval.`);
      setComments("");
      loadMyLeaves();
      loadLeaveBalances();
    } catch (err: any) {
      ToasterService.error(apiError(err, "Failed to submit leave request"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (row: LeaveRow) => {
    if (!window.confirm(`Withdraw your ${leaveTypeLabel(row.leaveType).toLowerCase()} leave request for ${row.fromDate}${row.toDate !== row.fromDate ? ` to ${row.toDate}` : ""}?`)) return;
    try {
      await axios.delete(`${LEAVE_API_URL}/${row.id}`);
      ToasterService.success("Leave request withdrawn.");
      loadMyLeaves();
      loadLeaveBalances();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not withdraw the request."));
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
      const off = offDays[dateStr];

      calendarDays.push(
        <div key={`curr-${i}`} className="flex items-center justify-center p-0.5">
          <button 
            type="button"
            title={off || undefined}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isSelected 
                ? (off ? 'bg-cyan-600/40 text-white' : 'bg-cyan-600 text-white shadow-xs font-bold ring-2 ring-cyan-500/20')
                : off ? 'text-slate-400 dark:text-gray-600 line-through' : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#222222]'
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

  const today = todayIso();
  const canWithdraw = (row: LeaveRow) => row.approvalStatus === 'PENDING' || (row.approvalStatus === 'APPROVED' && row.fromDate > today);

  const historyColumns: ColumnDef<LeaveRow>[] = [
    { key: 'id', label: 'Req ID', sortable: true, render: (row) => <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">#{row.id}</span> },
    { key: 'leaveType', label: 'Leave Type', sortable: true, render: (row) => <span className="font-bold text-xs text-slate-900 dark:text-white">{leaveTypeLabel(row.leaveType)}{row.halfDay ? ` (${row.halfDaySession === 'SECOND_HALF' ? 'second' : 'first'} half)` : ''}</span> },
    { 
      key: 'fromDate', 
      label: 'Dates', 
      sortable: true, 
      render: (row) => <span className="text-slate-700 dark:text-gray-300 font-mono text-xs whitespace-nowrap">{row.fromDate}{row.toDate !== row.fromDate && <> &rarr; {row.toDate}</>}</span>
    },
    { 
      key: 'totalDays', 
      label: 'Days', 
      sortable: true, 
      render: (row) => <span className="font-bold font-mono text-xs text-slate-900 dark:text-white">{formatDays(row.totalDays)} {Number(row.totalDays) === 1 ? 'day' : 'days'}</span> 
    },
    { key: 'reason', label: 'Reason', sortable: true, render: (row) => <span className="text-xs text-slate-600 dark:text-gray-400 max-w-[220px] truncate block" title={row.reason}>{row.reason || '-'}</span> },
    { 
      key: 'approvalStatus', 
      label: 'Status', 
      sortable: true, 
      render: (row) => {
        const st = String(row.approvalStatus || 'PENDING').toUpperCase();
        const badgeStyle = st === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent' :
          st === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent' :
          st === 'CANCELLED' ? 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-transparent dark:text-gray-500 dark:border-transparent' :
          'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';
        return (
          <span title={row.approverRemarks ? `${row.actionBy ? `${row.actionBy}: ` : ''}${row.approverRemarks}` : undefined}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeStyle}`}>
            {st.charAt(0) + st.slice(1).toLowerCase()}
          </span>
        );
      } 
    },
    {
      key: 'actions',
      label: '',
      render: (row) => canWithdraw(row) ? (
        <button type="button" onClick={() => handleCancel(row)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 cursor-pointer">
          <XCircle className="w-3.5 h-3.5" /> Withdraw
        </button>
      ) : null,
    },
  ];

  return (
    <>
      <PageMeta title="Leave Request" description="Submit and track leave applications" />
      <PageBreadcrumb pageTitle="Leave Request" />

      <div className="max-w-6xl mx-auto pb-4 animate-in fade-in duration-200 mt-1">
        
        {/* User Banner matching Punch Station theme */}
        <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:!border-transparent shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-cyan-600 text-white font-bold text-sm shadow-2xs flex items-center justify-center shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{currentUser.name}</h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 dark:bg-transparent text-cyan-700 dark:text-gray-300 border border-cyan-200/80 dark:border-transparent uppercase tracking-wider">
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] border border-slate-200 dark:!border-transparent text-slate-700 dark:text-gray-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{activeTab === 'history' ? 'Back to Apply' : `Request History (${myLeaves.length})`}</span>
            </button>
            <div className="bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl px-3 py-1.5 text-right">
              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-medium block uppercase tracking-wider">Employee ID</span>
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-gray-200">#{currentUser.code || '—'}</span>
            </div>
          </div>
        </div>

        {/* APPLY TAB */}
        {activeTab === 'apply' && (
          <div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start mb-4">
                
                {/* Left Column: Interactive Calendar */}
                <div className="lg:col-span-5 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-4 sm:p-5 flex flex-col justify-between min-h-[380px]">
                  <div>
                    {/* Month Header */}
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:!border-transparent pb-2.5">
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-2 py-1 rounded-xl border border-slate-200/80 dark:!border-transparent shadow-2xs">
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
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:!border-transparent space-y-1.5">
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
                <div className="lg:col-span-7 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-4 sm:p-5 flex flex-col justify-between min-h-[380px]">
                  <div className="space-y-3">
                    {/* Leave Type Dropdown */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">Leave Type *</label>
                      {balances.length === 0 ? (
                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl">
                          No leave policy is assigned to you yet. Ask HR to assign one before applying.
                        </p>
                      ) : (
                        <select
                          value={leaveType}
                          onChange={(e) => setLeaveType(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs font-semibold text-slate-800 dark:text-white cursor-pointer"
                          required
                        >
                          {balances.map((b) => (
                            <option key={b.id} value={b.leaveType} className="dark:bg-[#222222] dark:text-white">
                              {leaveTypeLabel(b.leaveType)} leave — {formatDays(freeDays(b))} of {formatDays(b.allocatedLeaves)} days free
                              {b.pendingApprovalLeaves ? ` (${formatDays(b.pendingApprovalLeaves)} waiting for approval)` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Duration Summary */}
                    <div className="p-2.5 px-3.5 bg-slate-50/80 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent flex items-center justify-between">
                      <span className="text-xs text-slate-600 dark:text-gray-300">
                        Duration: <strong className="text-slate-900 dark:text-white font-mono">{fromDate || '---'}</strong> to <strong className="text-slate-900 dark:text-white font-mono">{toDate || '---'}</strong>
                      </span>
                      <span title="Working days only; weekly offs and holidays are not counted"
                        className={`px-2.5 py-0.5 bg-white dark:bg-cyan-500/20 border dark:!border-transparent rounded-lg text-[11px] font-bold shadow-2xs font-mono ${
                          selectedBalance && totalDays > freeDays(selectedBalance) ? 'text-rose-700 border-rose-200' : 'text-cyan-700 dark:text-cyan-300 border-cyan-200'}`}>
                        {formatDays(totalDays)} {totalDays === 1 ? 'Day' : 'Days'}
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
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs font-mono font-medium text-slate-800 dark:text-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">To Date *</label>
                        <input 
                          type="date"
                          value={toDate}
                          onChange={(e) => setToDate(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs font-mono font-medium text-slate-800 dark:text-white"
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
                                className="text-cyan-600 focus:ring-cyan-500 dark:bg-[#222222] dark:border-transparent cursor-pointer"
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
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all outline-none text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 resize-none"
                      />
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 dark:!border-transparent flex items-center justify-end gap-2.5 shrink-0 mt-3">
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
          <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent overflow-hidden p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">My Leave History Log</h3>
              <TableToolbar onRefresh={() => loadMyLeaves()} />
            </div>
            <ReusableTable
              data={myLeaves}
              columns={historyColumns}
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