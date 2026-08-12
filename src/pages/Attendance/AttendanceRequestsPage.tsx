import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, X, Info, Upload, Plus, Search, CalendarDays, FileText } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

const REQUESTS_URL = '/v1/api/attendance/requests';

interface OnDutyItem {
  id: string;
  mode: 'DATE' | 'RANGE' | 'ABSENT';
  fromDate: string;
  toDate: string;
  reason: string;
  comments?: string;
  startHours: string;
  startMinutes: string;
  endHours: string;
  endMinutes: string;
  fileName?: string;
}

const AttendanceRequestsPage: React.FC = () => {
  const [addedItems, setAddedItems] = useState<OnDutyItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal State
  const [selectionMode, setSelectionMode] = useState<'DATE' | 'RANGE' | 'ABSENT'>('DATE');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [firstClickDate, setFirstClickDate] = useState<string | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  
  const [requestType, setRequestType] = useState('ON_DUTY');
  const [projectTaskId, setProjectTaskId] = useState(5001);
  const [projectTaskName, setProjectTaskName] = useState('Attendance Task');
  const [clientName, setClientName] = useState('');
  const [visitLocation, setVisitLocation] = useState('');
  const [purpose, setPurpose] = useState('');

  const [reason, setReason] = useState('Business Visit');
  const [comments, setComments] = useState('');
  const [startHours, setStartHours] = useState('09');
  const [startMinutes, setStartMinutes] = useState('00');
  const [endHours, setEndHours] = useState('18');
  const [endMinutes, setEndMinutes] = useState('00');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeEmployeeId, setActiveEmployeeId] = useState<number>(12);

  const currentUser = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const name = user.fullName || user.name || user.username || "Karthik Raj";
        const displayCode = user.employeeCode || `EMP-${activeEmployeeId}`;

        return {
          id: activeEmployeeId,
          name: name,
          code: displayCode,
          dept: user.department || "Engineering",
          location: user.location || "Hyderabad",
          email: user.email || `${name.toLowerCase().replace(/\s+/g, '')}@mytrading.com`
        };
      }
    } catch (e) {}
    return {
      id: activeEmployeeId,
      name: "Karthik Raj",
      code: `EMP-${activeEmployeeId}`,
      dept: "Engineering",
      location: "Hyderabad",
      email: "karthikraj@mytrading.com"
    };
  }, [activeEmployeeId]);

  useEffect(() => {
    const resolveUserEmployeeId = async () => {
      try {
        const empRes = await axios.get('/v1/api/payroll/employee/all');
        if (Array.isArray(empRes.data) && empRes.data.length > 0) {
          const userStr = localStorage.getItem("user");
          const user = userStr ? JSON.parse(userStr) : {};
          const uName = (user.fullName || user.name || user.username || '').toLowerCase();
          const uEmail = (user.email || '').toLowerCase();

          const match = empRes.data.find((e: any) => {
            const eName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase() || (e.name || '').toLowerCase();
            const eEmail = (e.email || '').toLowerCase();
            return (uName && (eName.includes(uName) || uName.includes(eName))) || (uEmail && eEmail === uEmail);
          });

          if (match && match.id) {
            setActiveEmployeeId(Number(match.id));
          } else if (empRes.data[0]?.id) {
            setActiveEmployeeId(Number(empRes.data[0].id));
          }
        }
      } catch (e) {}
    };
    resolveUserEmployeeId();
  }, []);

  const fetchHistoryLogs = async () => {
    try {
      const res = await axios.get(`${REQUESTS_URL}/my/${currentUser.id}`);
      if (Array.isArray(res.data)) {
        setHistoryLogs(res.data.map((r: any) => {
          const detail = (Array.isArray(r.requestDetails) && r.requestDetails[0]) || 
                         (Array.isArray(r.responseDetails) && r.responseDetails[0]) || {};
          const rawStatus = r.approvalStatus || r.status || r.overallStatus || r.requestStatus || detail.approvalStatus || detail.status || 'PENDING';
          const typeStr = (r.requestType || detail.requestType || 'ON_DUTY').replace(/_/g, ' ');
          const fromD = r.fromDate || detail.fromDate;
          const toD = r.toDate || detail.toDate;
          const datesStr = fromD ? `${fromD}${toD && toD !== fromD ? ` to ${toD}` : ''}` : 'On Duty Request';
          return {
            id: r.id,
            requestType: typeStr,
            dates: datesStr,
            reason: r.reason || detail.reason || r.remarks || detail.remarks || 'Business Request',
            taskName: r.projectTaskName || detail.projectTaskName || '',
            status: String(rawStatus).toUpperCase()
          };
        }));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchHistoryLogs();
  }, [currentUser.id]);

  const absentDates: string[] = [];
  const now = new Date();
  const todayDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const toIso = (str: string) => {
    if (!str) return '';
    const parts = str.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return str;
  };

  const getDatesInRange = (startFormatted: string, endFormatted: string): string[] => {
    const startIso = toIso(startFormatted);
    const endIso = toIso(endFormatted);
    
    const minIso = startIso < endIso ? startIso : endIso;
    const maxIso = startIso < endIso ? endIso : startIso;

    const dates: string[] = [];
    let curr = new Date(minIso);
    const end = new Date(maxIso);

    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      dates.push(`${d}/${m}/${y}`);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const handleModeChange = (mode: 'DATE' | 'RANGE' | 'ABSENT') => {
    setSelectionMode(mode);
    setFirstClickDate(null);
    if (mode === 'ABSENT') {
      setSelectedDates(absentDates);
    } else {
      setSelectedDates([]);
    }
  };

  const handleCalendarDateClick = (dayStr: string) => {
    if (selectionMode === 'ABSENT') return;

    if (selectionMode === 'DATE') {
      setSelectedDates([dayStr]);
      setFirstClickDate(dayStr);
    } else {
      // RANGE mode
      if (!firstClickDate) {
        setFirstClickDate(dayStr);
        setSelectedDates([dayStr]);
      } else {
        const range = getDatesInRange(firstClickDate, dayStr);
        setSelectedDates(range);
        setFirstClickDate(null);
      }
    }
  };

  const selectedIsoList = useMemo(() => {
    return selectedDates.map(d => toIso(d)).sort();
  }, [selectedDates]);

  const minSelectedIso = selectedIsoList.length > 0 ? selectedIsoList[0] : null;
  const maxSelectedIso = selectedIsoList.length > 0 ? selectedIsoList[selectedIsoList.length - 1] : null;

  const renderModalCalendar = () => {
    const days = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    const prevMonthDays = daysInMonth(currentMonth - 1, currentYear);
    const calendarDays = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push(
        <div key={`prev-${i}`} className="flex items-center justify-center p-0.5">
          <span className="text-gray-300 text-[11px]">{prevMonthDays - i}</span>
        </div>
      );
    }

    for (let i = 1; i <= days; i++) {
      const dayFormatted = `${String(i).padStart(2, '0')}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;
      const currIso = toIso(dayFormatted);
      
      const isSelected = selectedDates.includes(dayFormatted);
      const isStart = minSelectedIso === currIso;
      const isEnd = maxSelectedIso === currIso;
      const isInRange = minSelectedIso && maxSelectedIso && currIso >= minSelectedIso && currIso <= maxSelectedIso;

      const isAbsent = absentDates.includes(dayFormatted);
      const isToday = todayDate === dayFormatted;

      calendarDays.push(
        <div 
          key={`curr-${i}`} 
          className={`flex items-center justify-center py-0.5 relative ${
            isInRange && selectedIsoList.length > 1
              ? 'bg-emerald-100/70'
              : ''
          } ${isStart ? 'rounded-l-full' : ''} ${isEnd ? 'rounded-r-full' : ''}`}
        >
          <button
            type="button"
            onClick={() => handleCalendarDateClick(dayFormatted)}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium transition-all ${
              isSelected || isStart || isEnd
                ? 'bg-emerald-800 text-white font-bold shadow-2xs scale-105 z-10'
                : isInRange
                ? 'text-emerald-950 font-bold z-10'
                : isAbsent
                ? 'border border-rose-400 text-rose-700 font-semibold hover:bg-rose-50'
                : isToday
                ? 'border border-emerald-500 text-emerald-700 font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
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
          <span className="text-gray-300 text-[11px]">{i}</span>
        </div>
      );
    }

    return calendarDays;
  };

  const calculateHoursNote = () => {
    const sh = Number(startHours) || 0;
    const sm = Number(startMinutes) || 0;
    const eh = Number(endHours) || 0;
    const em = Number(endMinutes) || 0;

    let totalMins = (eh * 60 + em) - (sh * 60 + sm);
    if (totalMins < 0) totalMins += 24 * 60;

    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `Note : You are marking OD for ${hrs} hours ${mins} minutes`;
  };

  const handleAddModalCard = () => {
    if (selectedDates.length === 0) {
      return ToasterService.error("Please select OD date(s) from calendar");
    }

    const newRows: OnDutyItem[] = selectedDates.map(d => ({
      id: Math.random().toString(),
      mode: selectionMode,
      fromDate: d,
      toDate: d,
      reason,
      comments: comments || '-',
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      fileName: uploadedFile?.name
    }));

    setAddedItems(prev => [...prev, ...newRows]);
    ToasterService.success(`Added ${selectedDates.length} On-Duty date(s)`);
    
    setSelectedDates([]);
    setFirstClickDate(null);
    setIsModalOpen(false);
  };

  const [editingItem, setEditingItem] = useState<OnDutyItem | null>(null);

  const handleOpenEdit = (item: OnDutyItem) => {
    setEditingItem({ ...item });
  };

  const removeItemRow = (id: string) => {
    setAddedItems(prev => prev.filter(item => item.id !== id));
    ToasterService.success("Removed row");
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    setAddedItems(prev => prev.map(i => i.id === editingItem.id ? editingItem : i));
    ToasterService.success(`Updated request for ${editingItem.fromDate}`);
    setEditingItem(null);
  };

  const handleCancelRequest = async (requestId: number) => {
    try {
      await axios.put(`${REQUESTS_URL}/${requestId}/cancel/${currentUser.id}`);
      ToasterService.success("Request cancelled successfully!");
      await fetchHistoryLogs();
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || "Failed to cancel request";
      ToasterService.error(errMsg);
      await fetchHistoryLogs();
    }
  };

  const handleSubmitAllOnDuty = async () => {
    if (addedItems.length === 0) return;
    try {
      setIsSubmitting(true);
      const requestDetails = addedItems.map(item => {
        const isoFrom = toIso(item.fromDate);
        const isoTo = toIso(item.toDate);
        const sh = item.startHours ? item.startHours.padStart(2, '0') : '09';
        const sm = item.startMinutes ? item.startMinutes.padStart(2, '0') : '00';
        const eh = item.endHours ? item.endHours.padStart(2, '0') : '18';
        const em = item.endMinutes ? item.endMinutes.padStart(2, '0') : '00';
        return {
          fromDate: isoFrom,
          toDate: isoTo,
          shiftDate: isoFrom,
          checkInTime: `${isoFrom}T${sh}:${sm}:00`,
          checkOutTime: `${isoTo}T${eh}:${em}:00`,
          shiftInTime: `${isoFrom}T09:00:00`,
          shiftOutTime: `${isoTo}T18:00:00`,
          projectTaskId: projectTaskId || 5001,
          projectTaskName: projectTaskName || "Attendance Module Development",
          remarks: item.comments || item.reason || "Attendance Request",
          clientName: clientName || null,
          visitLocation: visitLocation || null,
          purpose: purpose || null,
          requestType: requestType || "ON_DUTY",
          reason: item.reason || "Attendance Request"
        };
      });

      const payload = {
        employeeId: currentUser.id,
        requestDetails
      };

      await axios.post(REQUESTS_URL, payload);

      const newHistory = addedItems.map(item => ({
        id: Math.floor(200 + Math.random() * 800),
        dates: item.fromDate,
        reason: item.reason,
        status: "PENDING"
      }));

      setHistoryLogs(prev => [...newHistory, ...prev]);
      ToasterService.success(`Submitted ${addedItems.length} On Duty Request(s) successfully!`);
      setAddedItems([]);
    } catch (e: any) {
      const errMsg = e.response?.data?.error || e.response?.data?.message || "Failed to submit requests";
      ToasterService.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="On Duty Request" description="Submit and track On Duty attendance requests" />
      <PageBreadcrumb pageTitle="On Duty Request" />

      <div className="max-w-6xl mx-auto pb-1 animate-in fade-in duration-200 mt-0.5">
        
        {/* Compact User Info Banner */}
        <div className="bg-white rounded-lg shadow-2xs border border-gray-200/80 p-2.5 mb-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7.5 h-7.5 rounded-md bg-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-gray-900">{currentUser.name}</h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[10px] text-gray-500">{currentUser.email || "super@admin.com"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="hover:underline flex items-center gap-1 bg-cyan-50 px-2.5 py-0.5 rounded text-cyan-800 border border-cyan-200 text-[11px] font-semibold shadow-2xs transition-all"
            >
              <FileText className="w-3 h-3" /> Request History ({historyLogs.length})
            </button>
            <div className="text-left sm:text-right">
              <span className="text-[9px] text-gray-400 font-medium block">Employee ID</span>
              <span className="text-[11px] font-mono font-semibold text-gray-700">#{currentUser.code}</span>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 overflow-hidden mb-2">
          
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-600">On duty dates</h2>
            {addedItems.length > 0 && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-3 py-1 border-2 border-cyan-600 text-cyan-600 hover:bg-cyan-50 rounded-md font-bold text-[11px] uppercase tracking-wider transition-all"
              >
                ADD ON DUTY DATES
              </button>
            )}
          </div>

          <div className="p-3 min-h-[220px]">
            {addedItems.length === 0 ? (
              <div className="p-6 text-center min-h-[220px] flex flex-col items-center justify-center space-y-4">
                <h3 className="text-xl md:text-2xl font-extrabold text-gray-300 tracking-tight leading-tight uppercase max-w-lg mx-auto">
                  NOTHING TO SHOW HERE PLEASE CREATE REQUEST
                </h3>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md font-bold text-xs uppercase tracking-wider transition-all shadow-xs"
                >
                  ADD ON DUTY DATES
                </button>
              </div>
            ) : (
              <div>
                <ReusableTable
                  data={addedItems}
                  columns={[
                    { key: 'fromDate', label: 'Date', sortable: true, render: (item) => <span className="font-semibold text-gray-800">{item.fromDate}</span> },
                    { key: 'shift', label: 'Shift', sortable: true, render: (item) => <span className="text-gray-700 font-medium">{item.startHours && item.endHours ? `${item.startHours.padStart(2, '0')}:00-${item.endHours.padStart(2, '0')}:00` : '09:00-18:00'}</span> },
                    { key: 'reason', label: 'Reason', sortable: true, render: (item) => <span className="text-gray-700 font-medium truncate max-w-[140px] block">{item.reason}</span> },
                    { key: 'comments', label: 'Comment', sortable: false, render: (item) => <span className="text-gray-600 truncate max-w-[140px] block">{item.comments || "—"}</span> },
                    { key: 'actions', label: 'Actions', sortable: false, render: (item) => (
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="text-cyan-600 hover:text-cyan-800"
                            title="Edit row"
                          >
                            <svg className="w-4 h-4 fill-cyan-600" viewBox="0 0 24 24">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItemRow(item.id)}
                            className="text-rose-500 hover:text-rose-700"
                            title="Remove row"
                          >
                            <svg className="w-4.5 h-4.5 fill-rose-500" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
                            </svg>
                          </button>
                        </div>
                      ) 
                    },
                  ]}
                  searchable={false}
                  pageSize={5}
                  defaultSortKey="fromDate"
                  defaultSortOrder="asc"
                />
              </div>
            )}
          </div>

          <div className="bg-gray-50/60 p-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={handleSubmitAllOnDuty}
              disabled={addedItems.length === 0 || isSubmitting}
              className={`px-8 py-2.5 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                addedItems.length > 0
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs'
                  : 'bg-cyan-200 text-white/80 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'SUBMITTING...' : 'SUBMIT'}
            </button>
          </div>

        </div>

      </div>

      {/* Modal: ON DUTY DATES matching screenshots 2, 3, 4, 5 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide border-b-2 border-emerald-800 inline-block pb-0.5">
                  ON DUTY DATES
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              
              {/* Step Headers & Radio Mode Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-2">
                    1. Select on duty date(s)
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="odMode"
                        checked={selectionMode === 'DATE'}
                        onChange={() => handleModeChange('DATE')}
                        className="w-4 h-4 text-emerald-800 focus:ring-emerald-700 border-gray-300"
                      />
                      <span className="text-xs font-medium text-gray-800">Date</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="odMode"
                        checked={selectionMode === 'RANGE'}
                        onChange={() => handleModeChange('RANGE')}
                        className="w-4 h-4 text-emerald-800 focus:ring-emerald-700 border-gray-300"
                      />
                      <span className="text-xs font-medium text-gray-800">Range</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="odMode"
                        checked={selectionMode === 'ABSENT'}
                        onChange={() => handleModeChange('ABSENT')}
                        className="w-4 h-4 text-emerald-800 focus:ring-emerald-700 border-gray-300"
                      />
                      <span className="text-xs font-medium text-gray-800">Absent</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    2. Select reason
                  </label>
                  {selectionMode === 'RANGE' && (
                    <span className="text-[11px] text-gray-500 font-normal">
                      (Same reason will be used for all selected dates)
                    </span>
                  )}
                </div>
              </div>

              {/* Grid 2-Column: Calendar Left, Form Right */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                
                {/* Modal Calendar */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-800">
                      {monthNames[currentMonth]} {currentYear}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={handlePrevMonth} className="p-1 rounded text-gray-400 hover:text-gray-700">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={handleNextMonth} className="p-1 rounded text-gray-400 hover:text-gray-700">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-gray-500 mb-1 border-b border-gray-100 pb-1">
                    <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                  </div>

                  <div className="grid grid-cols-7 gap-y-0.5 mb-3">
                    {renderModalCalendar()}
                  </div>

                  <div className="flex items-center justify-start gap-3 text-[11px] text-gray-600 border-t border-dashed border-gray-200 pt-2 mb-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm border border-emerald-500 bg-emerald-50" />
                      <span>Today</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full border border-rose-400 bg-white" />
                      <span>Absent</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-full border border-purple-400 bg-white" />
                      <span>Half day absent</span>
                    </div>
                  </div>

                  <div className="mt-2 text-center">
                    <button type="button" className="text-[11px] font-bold text-emerald-800 hover:underline">
                      View pending request
                    </button>
                  </div>
                </div>

                {/* Modal Right Form */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[300px] flex flex-col justify-between">
                  
                  {selectedDates.length === 0 ? (
                    <div className="my-auto text-center p-6">
                      <h4 className="text-xl font-extrabold text-gray-300 leading-snug">
                        Please select OD date from calendar
                      </h4>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      
                      {/* Shift details row */}
                      {selectionMode === 'DATE' && (
                        <div className="flex items-center justify-between text-[11px] text-gray-500 border-b border-gray-100 pb-2">
                          <div>Shift: <span className="font-semibold text-gray-800">04:00 - 10:00</span></div>
                          <div>Check in time: <span className="text-gray-400 font-mono">--:--</span></div>
                          <div>Check out time: <span className="text-gray-400 font-mono">--:--</span></div>
                        </div>
                      )}

                      {/* Reason Select Dropdown */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          <span className="text-rose-500">*</span> Reason for request
                        </label>
                        <select
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="w-full py-2 px-3 min-h-[38px] leading-normal bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700"
                        >
                          <option value="Business Visit">Business Visit</option>
                          <option value="External Training">External Training</option>
                          <option value="Work From Home">Work From Home</option>
                          <option value="Work From Other Location">Work From Other Location</option>
                          <option value="Work From Client Location">Work From Client Location</option>
                        </select>
                      </div>

                      {selectionMode === 'DATE' ? (
                        <>
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> From date
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={selectedDates[0] || ''}
                                  readOnly
                                  className="w-full h-7 pl-2 pr-7 bg-gray-50 border border-gray-200 rounded text-xs font-medium text-gray-800 outline-none"
                                />
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1.5 pointer-events-none" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> To date
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={selectedDates[selectedDates.length - 1] || ''}
                                  readOnly
                                  className="w-full h-7 pl-2 pr-7 bg-gray-50 border border-gray-200 rounded text-xs font-medium text-gray-800 outline-none"
                                />
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1.5 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> Start Hours
                              </label>
                              <input
                                type="text"
                                value={startHours}
                                onChange={(e) => setStartHours(e.target.value)}
                                className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-emerald-700"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> Start Mins
                              </label>
                              <input
                                type="text"
                                value={startMinutes}
                                onChange={(e) => setStartMinutes(e.target.value)}
                                className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-emerald-700"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> End Hours
                              </label>
                              <input
                                type="text"
                                value={endHours}
                                onChange={(e) => setEndHours(e.target.value)}
                                className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-emerald-700"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> End Mins
                              </label>
                              <input
                                type="text"
                                value={endMinutes}
                                onChange={(e) => setEndMinutes(e.target.value)}
                                className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-emerald-700"
                              />
                            </div>
                          </div>

                          <div className="bg-blue-50/70 border border-blue-200/80 rounded-md py-1.5 px-2.5 flex items-center gap-2 text-[11px] font-semibold text-blue-800">
                            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>{calculateHoursNote()}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              <span className="text-rose-500">*</span> Comments
                            </label>
                            <textarea
                              rows={2}
                              value={comments}
                              onChange={(e) => setComments(e.target.value)}
                              placeholder="Enter additional comments..."
                              className="w-full p-2 border border-gray-200 rounded-md text-xs outline-none focus:ring-1 focus:ring-emerald-700"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Attachment
                            </label>
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-xs font-bold uppercase tracking-wider cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>UPLOAD FILE</span>
                              <input
                                type="file"
                                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>
                            {uploadedFile && (
                              <span className="text-xs text-gray-600 font-medium block mt-1">
                                {uploadedFile.name}
                              </span>
                            )}
                          </div>
                        </>
                      )}

                    </div>
                  )}

                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 border-t border-gray-200 p-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase tracking-wider px-3 py-1.5"
              >
                ADD ANOTHER
              </button>
              <button
                type="button"
                onClick={handleAddModalCard}
                disabled={selectedDates.length === 0}
                className={`px-6 py-1.5 rounded-md font-bold text-xs uppercase tracking-wider transition-all ${
                  selectedDates.length > 0
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-2xs'
                    : 'bg-cyan-200 text-white cursor-not-allowed'
                }`}
              >
                ADD
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EDIT REQUEST FOR [DATE] Modal matching user reference screenshot */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 flex flex-col">
            
            {/* Header */}
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide border-b-2 border-gray-900 inline-block pb-0.5">
                  EDIT REQUEST FOR {editingItem.fromDate}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 text-xs">
              
              {/* Shift info row */}
              <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2 mb-3 font-medium">
                <div>Shift: <span className="font-semibold text-gray-800">{editingItem.startHours && editingItem.endHours ? `${editingItem.startHours.padStart(2, '0')}:00 - ${editingItem.endHours.padStart(2, '0')}:00` : '09:00 - 18:00'}</span></div>
                <div>Check in time: <span className="text-gray-400 font-mono">--:--</span></div>
                <div>Check out time: <span className="text-gray-400 font-mono">--:--</span></div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-700 mb-2">Request details</h3>
                
                <div className="border border-gray-200 rounded-lg p-3.5 space-y-3 bg-white">
                  
                  {/* Reason Dropdown / Input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      <span className="text-rose-500">*</span> Reason for request
                    </label>
                    <select
                      value={editingItem.reason}
                      onChange={(e) => setEditingItem({ ...editingItem, reason: e.target.value })}
                      className="w-full py-2 px-3 min-h-[38px] leading-normal bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-cyan-600"
                    >
                      <option value="Work From Home">Work From Home</option>
                      <option value="Business Visit">Business Visit</option>
                      <option value="External Training">External Training</option>
                      <option value="Work From Other Location">Work From Other Location</option>
                      <option value="Work From Client Location">Work From Client Location</option>
                      {!["Work From Home", "Business Visit", "External Training", "Work From Other Location", "Work From Client Location"].includes(editingItem.reason) && (
                        <option value={editingItem.reason}>{editingItem.reason}</option>
                      )}
                    </select>
                  </div>

                  {/* Comments Field */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Comments / Remarks
                    </label>
                    <textarea
                      rows={2}
                      value={editingItem.comments || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, comments: e.target.value })}
                      placeholder="Add comments..."
                      className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-cyan-600"
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                        <span className="text-rose-500">*</span> From date
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={editingItem.fromDate}
                          onChange={(e) => setEditingItem({ ...editingItem, fromDate: e.target.value })}
                          className="w-full h-7 pl-2 pr-7 bg-white border border-gray-200 rounded text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-cyan-600"
                        />
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1.5 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                        <span className="text-rose-500">*</span> To date
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={editingItem.toDate}
                          onChange={(e) => setEditingItem({ ...editingItem, toDate: e.target.value })}
                          className="w-full h-7 pl-2 pr-7 bg-white border border-gray-200 rounded text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-cyan-600"
                        />
                        <CalendarDays className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Timings */}
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                        <span className="text-rose-500">*</span> Start Hours
                      </label>
                      <input
                        type="text"
                        value={editingItem.startHours}
                        onChange={(e) => setEditingItem({ ...editingItem, startHours: e.target.value })}
                        className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-cyan-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                        <span className="text-rose-500">*</span> Start Minutes
                      </label>
                      <input
                        type="text"
                        value={editingItem.startMinutes}
                        onChange={(e) => setEditingItem({ ...editingItem, startMinutes: e.target.value })}
                        className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-cyan-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                        <span className="text-rose-500">*</span> End hours
                      </label>
                      <input
                        type="text"
                        value={editingItem.endHours}
                        onChange={(e) => setEditingItem({ ...editingItem, endHours: e.target.value })}
                        className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-cyan-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                        <span className="text-rose-500">*</span> End minutes
                      </label>
                      <input
                        type="text"
                        value={editingItem.endMinutes}
                        onChange={(e) => setEditingItem({ ...editingItem, endMinutes: e.target.value })}
                        className="w-full h-7 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-center outline-none focus:ring-1 focus:ring-cyan-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-100 p-3 flex justify-center">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-10 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md font-bold text-xs uppercase tracking-wider shadow-xs transition-all min-w-[140px]"
              >
                UPDATE
              </button>
            </div>

            </div>

          </div>
        </div>
      )}

      {/* Sleek Slide-Over Drawer for Request History */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-gray-200 animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">On Duty Request History</h2>
                <p className="text-[11px] text-gray-500">Track status of submitted OD requests</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Search & List Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs outline-none focus:bg-white focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              <div className="space-y-2.5">
                {historyLogs
                  .filter(h => JSON.stringify(h).toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((row) => (
                    <div key={row.id} className="p-3.5 bg-white rounded-xl border border-gray-200/90 shadow-2xs hover:border-cyan-300 transition-all space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-cyan-800">
                          <span>#{row.id}</span>
                          <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 rounded uppercase">
                            {row.requestType || 'ON DUTY'}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'APPROVED' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : row.status === 'REJECTED' || row.status === 'CANCELLED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {row.status}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-gray-900">{row.dates}</p>
                        <p className="text-[11px] text-gray-600 font-medium mt-0.5">{row.reason}</p>
                        {row.taskName && (
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">Task: {row.taskName}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md font-medium text-xs hover:bg-gray-100"
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

export default AttendanceRequestsPage;
