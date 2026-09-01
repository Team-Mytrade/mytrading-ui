import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  FileText, Plus, RotateCw, Eye, XCircle, X, CheckCircle2, AlertCircle, Calendar, Clock, MapPin, Briefcase, User, Tag, Send, Pencil, MinusCircle, ArrowLeft, Check
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base Endpoint (routing via Vite dev proxy)
const BASE_REQUESTS_URL = '/v1/api/attendance/requests';

export interface RequestDetailItem {
  fromDate: string;
  toDate: string;
  shiftDate: string;
  checkInTime: string;
  checkOutTime: string;
  shiftInTime: string;
  shiftOutTime: string;
  projectTaskId?: number;
  projectTaskName?: string;
  remarks?: string;
  clientName?: string | null;
  visitLocation?: string | null;
  purpose?: string | null;
  requestType: string;
  reason?: string;
}

export interface AttendanceRequestModel {
  id?: number;
  employeeId: number;
  employeeName?: string;
  requestType?: string;
  status?: string; // PENDING, APPROVED, REJECTED, CANCELLED
  createdDate?: string;
  requestDetails: RequestDetailItem[];
}

export interface OnDutyDateRow {
  id: string;
  date: string; // YYYY-MM-DD
  checkInTimeStr: string;
  shiftStr: string;
  reason: string;
  comment: string;
  checkInTime: string;
  checkOutTime: string;
  shiftInTime: string;
  shiftOutTime: string;
  clientName?: string;
  visitLocation?: string;
  purpose?: string;
  projectTaskName?: string;
  requestType: string;
}

const AttendanceRequestsPage: React.FC = () => {
  // ── User Context Resolution ─────────────────────────────────────────────
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        return {
          id: parsed.id || parsed.userId || 12,
          name: parsed.fullName || parsed.name || parsed.username || "Roy Hamlin",
          role: parsed.role || parsed.roles?.[0] || "SUPER_ADMIN",
          email: parsed.email || parsed.username || "roy.hamlin@example.com"
        };
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
    return { id: 12, name: "Roy Hamlin", role: "SUPER_ADMIN", email: "roy.hamlin@example.com" };
  }, []);

  // ── States ─────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<AttendanceRequestModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'apply' | 'history'>('apply');
  const [formStep, setFormStep] = useState<'form' | 'datesBreakdown'>('form');

  const [currentEmployeeId, setCurrentEmployeeId] = useState<number>(currentUser.id || 12);
  const [employeeCode, setEmployeeCode] = useState<string>(`EMP-${currentUser.id || 12}`);

  // Step 2: Date Rows State
  const [onDutyDateRows, setOnDutyDateRows] = useState<OnDutyDateRow[]>([]);
  const [editingRow, setEditingRow] = useState<OnDutyDateRow | null>(null);
  const [isAddDateModalOpen, setIsAddDateModalOpen] = useState(false);
  const [newDateInput, setNewDateInput] = useState(new Date().toISOString().slice(0, 10));

  // Inspection Modal
  const [viewingRequest, setViewingRequest] = useState<AttendanceRequestModel | null>(null);

  // Calendar Date Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<RequestDetailItem>({
    fromDate: todayStr,
    toDate: todayStr,
    shiftDate: todayStr,
    checkInTime: `${todayStr}T09:00:00`,
    checkOutTime: `${todayStr}T18:30:00`,
    shiftInTime: `${todayStr}T09:00:00`,
    shiftOutTime: `${todayStr}T18:00:00`,
    projectTaskId: 5001,
    projectTaskName: "Attendance Module Development",
    remarks: "",
    clientName: "",
    visitLocation: "",
    purpose: "",
    requestType: "ON_DUTY",
    reason: ""
  });

  // Calculate total days for requested range
  const totalDays = useMemo(() => {
    if (!form.fromDate || !form.toDate) return 0;
    const start = new Date(form.fromDate);
    const end = new Date(form.toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [form.fromDate, form.toDate]);

  // Request Counts for top summary cards
  const wfhCount = useMemo(() => requests.filter(r => (r.requestType || r.requestDetails?.[0]?.requestType) === 'WORK_FROM_HOME').length, [requests]);
  const regCount = useMemo(() => requests.filter(r => (r.requestType || r.requestDetails?.[0]?.requestType) === 'REGULARIZATION').length, [requests]);
  const dutyCount = useMemo(() => requests.filter(r => (r.requestType || r.requestDetails?.[0]?.requestType) === 'ON_DUTY').length, [requests]);

  // ── Dynamic Employee ID Resolution ─────────────────────────────────────
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

          const selected = match || empRes.data[0];
          if (selected && selected.id) {
            setCurrentEmployeeId(Number(selected.id));
            setEmployeeCode(selected.employeeCode || `EMP-${selected.id}`);
          }
        }
      } catch (e) {
        console.warn("Failed to resolve employee ID from payroll service:", e);
      }
    };
    resolveUserEmployeeId();
  }, [currentUser]);

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1: GET MY REQUESTS ─────────────────────────────────────────────
  const fetchMyRequests = async (empId: number) => {
    if (!empId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_REQUESTS_URL}/my/${empId}`);
      if (Array.isArray(res.data)) {
        setRequests(res.data);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      console.warn("Failed to load requests:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests(currentEmployeeId);
  }, [currentEmployeeId]);

  // ── STEP 1: PROCEED TO DATES BREAKDOWN ────────────────────────────────
  const handleProceedToDatesBreakdown = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fromDate || !form.toDate || !form.requestType) {
      ToasterService.error("Please fill in dates and request type.");
      return;
    }

    if (new Date(form.toDate) < new Date(form.fromDate)) {
      ToasterService.error("End Date cannot be before Start Date.");
      return;
    }

    // Build initial rows for each date between fromDate and toDate
    const rows: OnDutyDateRow[] = [];
    const start = new Date(form.fromDate);
    const end = new Date(form.toDate);
    const curr = new Date(start);

    const typeLabel = form.requestType === 'ON_DUTY' ? 'On Duty Visit' : form.requestType === 'WORK_FROM_HOME' ? 'Work From Home' : 'Attendance Regularization';

    while (curr <= end) {
      const dStr = curr.toISOString().slice(0, 10);
      rows.push({
        id: Math.random().toString(36).substring(2, 9),
        date: dStr,
        checkInTimeStr: form.requestType === 'REGULARIZATION' ? `${form.checkInTime.slice(11, 16)} - ${form.checkOutTime.slice(11, 16)}` : '-',
        shiftStr: '04:00 - 10:00',
        reason: typeLabel,
        comment: form.remarks || form.reason || 'Submitted request details',
        checkInTime: `${dStr}T09:00:00`,
        checkOutTime: `${dStr}T18:00:00`,
        shiftInTime: `${dStr}T04:00:00`,
        shiftOutTime: `${dStr}T10:00:00`,
        clientName: form.clientName || undefined,
        visitLocation: form.visitLocation || undefined,
        purpose: form.purpose || undefined,
        projectTaskName: form.projectTaskName || undefined,
        requestType: form.requestType
      });
      curr.setDate(curr.getDate() + 1);
    }

    setOnDutyDateRows(rows);
    setFormStep('datesBreakdown');
    ToasterService.info(`Configuring ${rows.length} date entries for ${typeLabel}`);
  };

  // ── STEP 2: FINAL SUBMIT ───────────────────────────────────────────────
  const handleFinalSubmitAllDates = async () => {
    if (onDutyDateRows.length === 0) {
      ToasterService.error("Please add at least one date entry to submit.");
      return;
    }

    setIsSubmitting(true);
    try {
      const requestDetailsList: RequestDetailItem[] = onDutyDateRows.map(row => ({
        fromDate: row.date,
        toDate: row.date,
        shiftDate: row.date,
        checkInTime: row.checkInTime || `${row.date}T09:00:00`,
        checkOutTime: row.checkOutTime || `${row.date}T18:00:00`,
        shiftInTime: row.shiftInTime || `${row.date}T04:00:00`,
        shiftOutTime: row.shiftOutTime || `${row.date}T10:00:00`,
        projectTaskId: Number(form.projectTaskId) || 5001,
        projectTaskName: row.projectTaskName || form.projectTaskName || "Attendance Module Development",
        remarks: row.comment || form.remarks || "Work request submission.",
        clientName: form.requestType === "ON_DUTY" ? (row.clientName || form.clientName || null) : null,
        visitLocation: form.requestType === "ON_DUTY" ? (row.visitLocation || form.visitLocation || null) : null,
        purpose: form.requestType === "ON_DUTY" ? (row.purpose || form.purpose || null) : null,
        requestType: form.requestType,
        reason: row.reason || form.reason || "Attendance request."
      }));

      const payload = {
        employeeId: Number(currentEmployeeId),
        requestDetails: requestDetailsList
      };

      await axios.post(BASE_REQUESTS_URL, payload);
      ToasterService.success("On Duty request submitted successfully with all date breakdowns!");
      handleClearForm();
      setFormStep('form');
      fetchMyRequests(currentEmployeeId);
      setActiveTab('history');
    } catch (err: any) {
      handleApiError(err, "Failed to submit attendance request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Date Row Actions ───────────────────────────────────────────────────
  const handleDeleteDateRow = (id: string) => {
    setOnDutyDateRows(prev => prev.filter(r => r.id !== id));
    ToasterService.info("Date entry removed.");
  };

  const handleAddCustomDateRow = () => {
    if (!newDateInput) return;
    const typeLabel = form.requestType === 'ON_DUTY' ? 'On Duty Visit' : form.requestType === 'WORK_FROM_HOME' ? 'Work From Home' : 'Attendance Regularization';
    const newRow: OnDutyDateRow = {
      id: Math.random().toString(36).substring(2, 9),
      date: newDateInput,
      checkInTimeStr: '-',
      shiftStr: '04:00 - 10:00',
      reason: typeLabel,
      comment: form.remarks || 'Additional date entry',
      checkInTime: `${newDateInput}T09:00:00`,
      checkOutTime: `${newDateInput}T18:00:00`,
      shiftInTime: `${newDateInput}T04:00:00`,
      shiftOutTime: `${newDateInput}T10:00:00`,
      clientName: form.clientName || undefined,
      visitLocation: form.visitLocation || undefined,
      purpose: form.purpose || undefined,
      projectTaskName: form.projectTaskName || undefined,
      requestType: form.requestType
    };
    setOnDutyDateRows(prev => [...prev, newRow]);
    setIsAddDateModalOpen(false);
    ToasterService.success(`Added date entry for ${newDateInput}`);
  };

  const handleSaveEditedRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setOnDutyDateRows(prev => prev.map(r => r.id === editingRow.id ? editingRow : r));
    setEditingRow(null);
    ToasterService.success("Date entry updated!");
  };

  // ── API 3: GET BY REQUEST ID AND EMPLOYEE ID ────────────────────────────
  const handleInspectRequest = async (req: AttendanceRequestModel) => {
    if (!req.id) return;
    try {
      const res = await axios.get(`${BASE_REQUESTS_URL}/${req.id}/${currentEmployeeId}`);
      setViewingRequest(res.data || req);
    } catch {
      setViewingRequest(req);
    }
  };

  // ── API 4: CANCEL REQUEST ──────────────────────────────────────────────
  const handleCancelRequest = async (id: number) => {
    if (!id || !currentEmployeeId) return;
    try {
      await axios.put(`${BASE_REQUESTS_URL}/${id}/cancel/${currentEmployeeId}`);
      ToasterService.success("Attendance request cancelled successfully!");
      fetchMyRequests(currentEmployeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to cancel attendance request.");
    }
  };

  // ── Clear Form Helper ──────────────────────────────────────────────────
  const handleClearForm = () => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({
      fromDate: today,
      toDate: today,
      shiftDate: today,
      checkInTime: `${today}T09:00:00`,
      checkOutTime: `${today}T18:30:00`,
      shiftInTime: `${today}T09:00:00`,
      shiftOutTime: `${today}T18:00:00`,
      projectTaskId: 5001,
      projectTaskName: "Attendance Module Development",
      remarks: "",
      clientName: "",
      visitLocation: "",
      purpose: "",
      requestType: "ON_DUTY",
      reason: ""
    });
    setOnDutyDateRows([]);
    setFormStep('form');
  };

  // ── Week Off Helper Function ───────────────────────────────────────────
  const isWeekOffDate = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const day = d.getDay();
    return day === 0 || day === 6; // Sunday (0) or Saturday (6)
  };

  // ── Mini Calendar Functions ────────────────────────────────────────────
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
          <div className="w-6 h-6 flex items-center justify-center text-gray-300 text-[10px]">{prevMonthDays - i}</div>
        </div>
      );
    }

    for (let i = 1; i <= days; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = dateStr >= form.fromDate && dateStr <= form.toDate;

      calendarDays.push(
        <div key={`curr-${i}`} className="flex items-center justify-center py-0">
          <button 
            type="button"
            className={`w-6 h-6 flex items-center justify-center rounded-md text-[11px] font-medium transition-all ${
              isSelected 
                ? 'bg-cyan-600 text-white shadow-xs font-bold' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => {
              if (dateStr < form.fromDate) {
                setForm(p => ({ ...p, fromDate: dateStr, toDate: dateStr, shiftDate: dateStr }));
              } else {
                setForm(p => ({ ...p, toDate: dateStr }));
              }
            }}
            onDoubleClick={() => {
              setForm(p => ({ ...p, fromDate: dateStr, toDate: dateStr, shiftDate: dateStr }));
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
          <div className="w-6 h-6 flex items-center justify-center text-gray-300 text-[10px]">{i}</div>
        </div>
      );
    }

    return calendarDays;
  };

  // Format date helper: YYYY-MM-DD -> DD/MM/YYYY
  const formatDateDisplay = (dStr: string) => {
    if (!dStr) return '-';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<AttendanceRequestModel>[] = [
    {
      key: 'id',
      label: 'Req ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
          #{row.id || 'NEW'}
        </span>
      )
    },
    {
      key: 'requestType',
      label: 'Request Type',
      sortable: true,
      render: (row) => {
        const detail = row.requestDetails?.[0];
        const type = row.requestType || detail?.requestType || 'WORK_FROM_HOME';
        return (
          <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
            {type.replace(/_/g, ' ')}
          </span>
        );
      }
    },
    {
      key: 'dates',
      label: 'Dates',
      render: (row) => {
        const detail = row.requestDetails?.[0];
        return (
          <span className="text-xs font-mono font-semibold text-slate-700">
            {detail?.fromDate || 'N/A'} {detail?.toDate && detail.toDate !== detail.fromDate ? `to ${detail.toDate}` : ''}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const status = (row.status || 'PENDING').toUpperCase();
        let colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
        if (status === 'APPROVED') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'REJECTED') colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === 'CANCELLED') colorClass = 'bg-gray-100 text-gray-600 border-gray-200';

        return (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${colorClass}`}>
            {status}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => handleInspectRequest(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Inspect Request"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.id && (row.status === 'PENDING' || !row.status) && (
            <button
              type="button"
              onClick={() => handleCancelRequest(row.id!)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-600 transition-colors"
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
      <PageMeta title="On Duty & Attendance Requests" description="Submit and track work from home, regularization, and duty requests" />
      <PageBreadcrumb pageTitle="On Duty Requests" />

      <div className="max-w-6xl mx-auto pb-1 animate-in fade-in duration-200 mt-0.5">
        
        {/* User Banner matching Attendance Regularization Page */}
        <div className="bg-white rounded-lg shadow-2xs border border-gray-200/80 p-2.5 mb-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7.5 h-7.5 rounded-md bg-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-gray-900">{currentUser.name}</h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/80 uppercase">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[10px] text-gray-500">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab(activeTab === 'history' ? 'apply' : 'history');
                setFormStep('form');
              }}
              className="hover:underline flex items-center gap-1 bg-cyan-50 px-2.5 py-0.5 rounded text-cyan-800 border border-cyan-200 text-[11px] font-semibold shadow-2xs"
            >
              <FileText className="w-3 h-3" /> Request History ({requests.length})
            </button>
            <div className="text-left sm:text-right">
              <span className="text-[9px] text-gray-400 font-medium block">Employee ID</span>
              <span className="text-[11px] font-mono font-semibold text-gray-700">#{employeeCode}</span>
            </div>
          </div>
        </div>

        {/* APPLY TAB */}
        {activeTab === 'apply' && (
          <div>
            {/* ── STEP 1: INITIAL FORM VIEW ────────────────────────────────────── */}
            {formStep === 'form' && (
              <form onSubmit={handleProceedToDatesBreakdown}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start mb-2">
                  
                  {/* Left Column: Interactive Calendar matching TimesheetManagementPage */}
                  <div className="lg:col-span-5 bg-white rounded-lg shadow-2xs border border-gray-200/80 p-3 flex flex-col justify-between h-[340px]">
                    <div>
                      {/* Month Header */}
                      <div className="flex items-center justify-between mb-2">
                        <button type="button" onClick={handlePrevMonth} className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded hover:bg-gray-50">
                          &lt;
                        </button>
                        <h2 className="text-xs font-bold text-gray-800">
                          {monthNames[currentMonth]} {currentYear}
                        </h2>
                        <button type="button" onClick={handleNextMonth} className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded hover:bg-gray-50">
                          &gt;
                        </button>
                      </div>

                      {/* Weekday Labels */}
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-gray-500 mb-1 border-b border-gray-100 pb-0.5">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                      </div>

                      {/* Dates Grid */}
                      <div className="grid grid-cols-7 gap-0.5 max-w-xs mx-auto lg:max-w-none">
                        {renderCalendar()}
                      </div>
                    </div>

                    {/* Bottom Legend matching TimesheetManagementPage */}
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-cyan-600 inline-block"></span> Today</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-rose-500 inline-block"></span> Absent</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-purple-500 inline-block"></span> Half day absent</span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Dates marked "Absent": <span className="text-rose-600 font-semibold">None</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Request Configuration Desk */}
                  <div className="lg:col-span-7 bg-white rounded-lg shadow-2xs border border-gray-200/80 p-3.5 flex flex-col justify-between h-[340px] overflow-y-auto">
                    <div className="space-y-2">
                      {/* Request Type Dropdown */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-0.5">Request Type *</label>
                        <select
                          value={form.requestType}
                          onChange={(e) => setForm(p => ({ ...p, requestType: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs font-semibold text-gray-800"
                          required
                        >
                          <option value="WORK_FROM_HOME">WORK FROM HOME</option>
                          <option value="REGULARIZATION">ATTENDANCE REGULARIZATION</option>
                          <option value="ON_DUTY">ON DUTY VISIT</option>
                        </select>
                      </div>

                      {/* Duration Summary Pill */}
                      <div className="p-1.5 px-2.5 bg-cyan-50/50 rounded-md border border-cyan-100 flex items-center justify-between gap-1.5">
                        <span className="text-[11px] text-gray-600">
                          Duration: <strong className="text-gray-900">{form.fromDate}</strong> to <strong className="text-gray-900">{form.toDate}</strong>
                        </span>
                        <span className="px-2 py-0.2 bg-white text-cyan-700 border border-cyan-200 rounded text-[10px] font-bold shadow-2xs shrink-0">
                          {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                        </span>
                      </div>

                      {/* Date Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">From Date *</label>
                          <input 
                            type="date"
                            value={form.fromDate}
                            onChange={(e) => setForm(p => ({ ...p, fromDate: e.target.value, shiftDate: e.target.value }))}
                            className="w-full px-2.5 py-1 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs font-semibold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-0.5">To Date *</label>
                          <input 
                            type="date"
                            value={form.toDate}
                            onChange={(e) => setForm(p => ({ ...p, toDate: e.target.value }))}
                            className="w-full px-2.5 py-1 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs font-semibold"
                            required
                          />
                        </div>
                      </div>

                      {/* Conditional Fields based on Request Type */}
                      {form.requestType === "ON_DUTY" ? (
                        <div className="space-y-1.5 bg-slate-50 p-2 rounded-md border border-slate-200/80">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Client Name</label>
                              <input
                                type="text"
                                value={form.clientName || ''}
                                onChange={(e) => setForm(p => ({ ...p, clientName: e.target.value }))}
                                className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                placeholder="e.g. Acme Corp"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Visit Location</label>
                              <input
                                type="text"
                                value={form.visitLocation || ''}
                                onChange={(e) => setForm(p => ({ ...p, visitLocation: e.target.value }))}
                                className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                                placeholder="e.g. Downtown Office"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-600 mb-0.5">Visit Purpose</label>
                            <input
                              type="text"
                              value={form.purpose || ''}
                              onChange={(e) => setForm(p => ({ ...p, purpose: e.target.value }))}
                              className="w-full px-2 py-1 bg-white border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-cyan-500"
                              placeholder="Client discussion & deployment"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 mb-0.5">Project Task Name</label>
                          <input
                            type="text"
                            value={form.projectTaskName || ''}
                            onChange={(e) => setForm(p => ({ ...p, projectTaskName: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs"
                            placeholder="Attendance Module Development"
                          />
                        </div>
                      )}

                      {/* Reason & Remarks */}
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-0.5">Reason / Remarks *</label>
                        <textarea 
                          rows={2}
                          value={form.remarks || ''}
                          onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value, reason: e.target.value }))}
                          className="w-full px-2.5 py-1.5 bg-gray-50/50 border border-gray-200 rounded-md focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs resize-none"
                          placeholder="Provide details for your request..."
                          required
                        />
                      </div>
                    </div>

                    {/* Form Action Footer */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100 shrink-0">
                      <button
                        type="button"
                        onClick={handleClearForm}
                        className="px-3 py-1.5 text-[11px] font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        Clear Form
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit Request
                      </button>
                    </div>

                  </div>

                </div>
              </form>
            )}

            {/* ── STEP 2: ON DUTY DATES BREAKDOWN TABLE DESK ───────────────────── */}
            {formStep === 'datesBreakdown' && (
              <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 space-y-4 animate-in fade-in duration-150">
                {/* Header & Add Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">On duty dates</h3>
                    <p className="text-xs text-gray-500">Configure check-in/out, shift times, and comments for each date</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddDateModalOpen(true)}
                    className="px-3.5 py-1.5 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 uppercase tracking-wide"
                  >
                    <Plus className="w-4 h-4" /> ADD ON DUTY DATES
                  </button>
                </div>

                {/* Week Off Alert Banner if any date is a week off */}
                {onDutyDateRows.some(r => isWeekOffDate(r.date)) && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200/90 rounded-lg flex items-center gap-2.5 text-xs text-emerald-900 animate-in fade-in duration-150 shadow-2xs">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-[11px] uppercase tracking-wider block text-emerald-800">Week Off Date Allowed:</span>
                      <span>One or more selected dates fall on a <strong>Week Off</strong> (e.g. Sunday/Saturday). These dates are <strong>allowed and included</strong> in your submission.</span>
                    </div>
                  </div>
                )}

                {/* Dates Table */}
                <div className="overflow-x-auto border border-gray-200/80 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-200/80">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Check in-out</th>
                        <th className="py-2.5 px-3">Shift</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Comment</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {onDutyDateRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-400">
                            No dates configured. Click "+ ADD ON DUTY DATES" to add entries.
                          </td>
                        </tr>
                      ) : (
                        onDutyDateRows.map((row) => {
                          const isWeekOff = isWeekOffDate(row.date);
                          const rowClass = isWeekOff
                            ? "bg-amber-50/80 hover:bg-amber-100/70 border-l-4 border-l-amber-500 transition-colors"
                            : "hover:bg-slate-50/60 transition-colors";

                          return (
                            <tr key={row.id} className={rowClass}>
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{formatDateDisplay(row.date)}</span>
                                  {isWeekOff && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500 text-white uppercase tracking-wider shadow-2xs">
                                      Week Off (Allowed)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-700">
                                {row.checkInTimeStr === '-' ? '-' : (
                                  <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                                    {row.checkInTimeStr}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span>{row.shiftStr || '04:00 - 10:00'}</span>
                                  {isWeekOff && (
                                    <span className="text-[10px] text-amber-800 font-bold flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3 h-3 text-amber-600 shrink-0" />
                                      Selected date is Week Off (Allowed)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-semibold max-w-[140px] truncate">
                                {row.reason || 'On Duty Visit'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate">
                                {row.comment || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingRow(row)}
                                    className="p-1 text-emerald-700 hover:text-emerald-900 transition-colors"
                                    title="Edit Date Entry"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDateRow(row.id)}
                                    className="p-1 text-rose-600 hover:text-rose-800 transition-colors"
                                    title="Remove Date Entry"
                                  >
                                    <MinusCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setFormStep('form')}
                    className="px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Form
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalSubmitAllDates}
                    disabled={isSubmitting || onDutyDateRows.length === 0}
                    className="px-6 py-2.5 bg-[#005A36] hover:bg-[#00472a] text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? "Submitting..." : "SUBMIT"}
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3 sm:p-4 animate-in fade-in duration-150 overflow-x-auto">
            <ReusableTable
              data={requests}
              columns={columns}
              loading={loading}
              searchable={true}
              searchPlaceholder="Search by request type or status..."
              pageSize={5}
              defaultSortKey="id"
              defaultSortOrder="desc"
            />
          </div>
        )}

      </div>

      {/* ── MODAL: EDIT DATE ROW ───────────────────────────────────────────── */}
      {editingRow && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-gray-900">Edit Entry for {formatDateDisplay(editingRow.date)}</h3>
              </div>
              <button type="button" onClick={() => setEditingRow(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedRow} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Check In - Out String</label>
                <input
                  type="text"
                  value={editingRow.checkInTimeStr}
                  onChange={(e) => setEditingRow({ ...editingRow, checkInTimeStr: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 13:00 - 22:00"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Shift Timings</label>
                <input
                  type="text"
                  value={editingRow.shiftStr}
                  onChange={(e) => setEditingRow({ ...editingRow, shiftStr: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="e.g. 04:00 - 10:00"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={editingRow.reason}
                  onChange={(e) => setEditingRow({ ...editingRow, reason: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Comment</label>
                <textarea
                  rows={2}
                  value={editingRow.comment}
                  onChange={(e) => setEditingRow({ ...editingRow, comment: e.target.value })}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-3 py-1.5 border border-gray-200 rounded-md font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD CUSTOM DATE ENTRY ──────────────────────────────────── */}
      {isAddDateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-gray-900">Add On Duty Date Entry</h3>
              </div>
              <button type="button" onClick={() => setIsAddDateModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Select Date *</label>
                <input
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md font-mono outline-none focus:ring-1 focus:ring-cyan-500 font-bold text-slate-800"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddDateModalOpen(false)}
                  className="px-3 py-1.5 border border-gray-200 rounded-md font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomDateRow}
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md font-bold"
                >
                  Add Date Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW REQUEST DETAILS ───────────────────────────────────── */}
      {viewingRequest && (() => {
        const detail = viewingRequest.requestDetails?.[0] || {} as Partial<RequestDetailItem>;
        const status = (viewingRequest.status || 'PENDING').toUpperCase();
        let statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
        if (status === 'APPROVED') statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'REJECTED') statusBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === 'CANCELLED') statusBadgeClass = 'bg-gray-100 text-gray-600 border-gray-200';

        const requestTypeLabel = (viewingRequest.requestType || detail.requestType || 'WORK_FROM_HOME').replace(/_/g, ' ');

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 uppercase truncate">Request Details #{viewingRequest.id || 'N/A'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${statusBadgeClass}`}>
                        {status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 font-mono truncate">
                      Employee ID: {viewingRequest.employeeId} {viewingRequest.employeeName ? `• ${viewingRequest.employeeName}` : ''}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setViewingRequest(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Grid Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                {/* Request Type */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                    <Tag className="w-3.5 h-3.5 text-cyan-600" /> Request Type
                  </span>
                  <span className="font-bold text-slate-800 uppercase tracking-wide">
                    {requestTypeLabel}
                  </span>
                </div>

                {/* Dates */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                  <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-600" /> Date Range
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {detail.fromDate || 'N/A'} {detail.toDate && detail.toDate !== detail.fromDate ? `to ${detail.toDate}` : ''}
                  </span>
                </div>

                {/* Project Task */}
                {(detail.projectTaskName || detail.projectTaskId) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-1 sm:col-span-2">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Briefcase className="w-3.5 h-3.5 text-cyan-600" /> Project / Task
                    </span>
                    <span className="font-bold text-slate-800">
                      {detail.projectTaskName || `Task #${detail.projectTaskId}`}
                    </span>
                  </div>
                )}

                {/* Timings */}
                {(detail.checkInTime || detail.checkOutTime) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-600" /> Check In / Out
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      In: {detail.checkInTime ? detail.checkInTime.replace('T', ' ') : 'N/A'}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      Out: {detail.checkOutTime ? detail.checkOutTime.replace('T', ' ') : 'N/A'}
                    </span>
                  </div>
                )}

                {(detail.shiftInTime || detail.shiftOutTime) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-600" /> Shift Timings
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      Shift Start: {detail.shiftInTime ? detail.shiftInTime.replace('T', ' ') : 'N/A'}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 block text-[11px]">
                      Shift End: {detail.shiftOutTime ? detail.shiftOutTime.replace('T', ' ') : 'N/A'}
                    </span>
                  </div>
                )}

                {/* Client Visit Information */}
                {(detail.clientName || detail.visitLocation || detail.purpose) && (
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-1 sm:col-span-2 space-y-1">
                    <span className="text-slate-500 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-600" /> On Duty Visit Details
                    </span>
                    {detail.clientName && (
                      <p className="text-slate-800 font-semibold text-[11px]">Client: <span className="font-bold">{detail.clientName}</span></p>
                    )}
                    {detail.visitLocation && (
                      <p className="text-slate-800 font-semibold text-[11px]">Location: <span className="font-bold">{detail.visitLocation}</span></p>
                    )}
                    {detail.purpose && (
                      <p className="text-slate-800 font-semibold text-[11px]">Purpose: <span className="font-normal text-slate-700">{detail.purpose}</span></p>
                    )}
                  </div>
                )}

                {/* Reason & Remarks */}
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 col-span-1 sm:col-span-2">
                  <span className="text-slate-500 font-semibold block text-[11px] mb-1">Remarks & Reason:</span>
                  <p className="font-semibold text-slate-800 leading-relaxed text-xs">
                    {detail.remarks || detail.reason || viewingRequest.requestDetails?.[0]?.remarks || 'No remarks provided.'}
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingRequest(null)}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors text-center"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default AttendanceRequestsPage;
