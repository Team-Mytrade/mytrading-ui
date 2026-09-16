import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, X, Search, Calendar, AlertCircle, Clock, CalendarDays, FileText } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import { ToasterService } from '../../Services/ToasterService';

const REQUESTS_URL = '/v1/api/attendance/requests';

interface DateRequestCardState {
  dateStr: string;
  fromDate: string;
  toDate: string;
  reasonType: 'FORGOT_IN' | 'FORGOT_OUT' | 'BOTH';
  startHours: string;
  startMinutes: string;
  endHours: string;
  endMinutes: string;
  clientName?: string;
  visitLocation?: string;
  purpose?: string;
  remarks?: string;
}

const TimesheetManagementPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Date Range selection state
  const [firstClickDate, setFirstClickDate] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<DateRequestCardState[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [viewPunchesDate, setViewPunchesDate] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [regularizationLogs, setRegularizationLogs] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');

  const getNumericEmployeeId = (val: any): number => {
    if (typeof val === 'number' && !isNaN(val) && val > 0 && val < 1000000) {
      return val;
    }
    if (typeof val === 'string') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0 && num < 1000000) {
        return num;
      }
    }
    return 12;
  };

  const [activeEmployeeId, setActiveEmployeeId] = useState<number>(12);

  const currentUser = useMemo(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const name = user.fullName || user.name || user.username || "Karthik Raj";
        const email = user.email || `${name.toLowerCase().replace(/\s+/g, '')}@mytrading.com`;
        const displayCode = user.employeeCode || `EMP-${activeEmployeeId}`;

        return {
          id: activeEmployeeId,
          name: name,
          code: displayCode,
          role: user.role || user.userType || "SUPER_ADMIN",
          email: email,
          dept: user.department || "Engineering",
          location: user.location || "Hyderabad"
        };
      }
    } catch (e) {}
    return {
      id: activeEmployeeId,
      name: "Karthik Raj",
      code: `EMP-${activeEmployeeId}`,
      role: "SUPER_ADMIN",
      email: "karthikraj@mytrading.com",
      dept: "Engineering",
      location: "Hyderabad"
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

  const fetchRegularizationLogs = async () => {
    try {
      const res = await axios.get(`${REQUESTS_URL}/my/${currentUser.id}`);
      if (Array.isArray(res.data)) {
        const list = res.data.map((r: any) => {
          const detail = (Array.isArray(r.requestDetails) && r.requestDetails[0]) || 
                         (Array.isArray(r.responseDetails) && r.responseDetails[0]) || {};
          const rawStatus = r.approvalStatus || r.status || r.overallStatus || r.requestStatus || detail.approvalStatus || detail.status || 'PENDING';
          const fromD = r.fromDate || detail.fromDate;
          const toD = r.toDate || detail.toDate;
          const datesStr = fromD ? `${fromD}${toD && toD !== fromD ? ` to ${toD}` : ''}` : 'Regularization Request';
          return {
            id: r.id,
            date: datesStr,
            type: r.reason || detail.reason || r.requestType || 'Attendance Regularization',
            hours: detail.checkInTime && detail.checkOutTime 
              ? `${String(detail.checkInTime).slice(11, 16)} - ${String(detail.checkOutTime).slice(11, 16)}` 
              : '09:00 - 18:00',
            status: String(rawStatus).toUpperCase()
          };
        });
        setRegularizationLogs(list);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchRegularizationLogs();
  }, [currentUser.id]);

  const absentDates: string[] = [];

  const now = new Date();
  const todayDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  const handleDateClick = (dayStr: string) => {
    if (!firstClickDate) {
      // Step 1: First click selects 1 date
      setFirstClickDate(dayStr);
      setSelectedCards([{
        dateStr: dayStr,
        fromDate: dayStr,
        toDate: dayStr,
        reasonType: 'BOTH',
        startHours: '09',
        startMinutes: '00',
        endHours: '18',
        endMinutes: '00'
      }]);
    } else {
      // Step 2: Second click creates range from firstClickDate to dayStr
      const dates = getDatesInRange(firstClickDate, dayStr);
      const rangeStart = dates[0];
      const rangeEnd = dates[dates.length - 1];
      
      const cardMap = new Map(selectedCards.map(c => [c.dateStr, c]));
      const newCards = dates.map(d => {
        const existing = cardMap.get(d);
        if (existing) {
          return { ...existing, fromDate: rangeStart, toDate: rangeEnd };
        }
        return {
          dateStr: d,
          fromDate: rangeStart,
          toDate: rangeEnd,
          reasonType: 'BOTH' as const,
          startHours: '09',
          startMinutes: '00',
          endHours: '18',
          endMinutes: '00'
        };
      });

      setSelectedCards(newCards);
      setFirstClickDate(null);
    }
  };

  const handleDateDoubleClick = (dayStr: string) => {
    setFirstClickDate(null);
    setSelectedCards([{
      dateStr: dayStr,
      fromDate: dayStr,
      toDate: dayStr,
      reasonType: 'BOTH',
      startHours: '09',
      startMinutes: '00',
      endHours: '18',
      endMinutes: '00'
    }]);
  };

  const removeCard = (dateStr: string) => {
    const updated = selectedCards.filter(c => c.dateStr !== dateStr);
    setSelectedCards(updated);
    if (updated.length === 0) {
      setFirstClickDate(null);
    }
  };

  const updateCardState = (dateStr: string, field: keyof DateRequestCardState, value: any) => {
    setSelectedCards(prev => prev.map(c => c.dateStr === dateStr ? { ...c, [field]: value } : c));
  };

  const selectedIsoList = useMemo(() => {
    return selectedCards.map(c => toIso(c.dateStr)).sort();
  }, [selectedCards]);

  const minSelectedIso = selectedIsoList.length > 0 ? selectedIsoList[0] : null;
  const maxSelectedIso = selectedIsoList.length > 0 ? selectedIsoList[selectedIsoList.length - 1] : null;

  const renderCalendar = () => {
    const days = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    const prevMonthDays = daysInMonth(currentMonth - 1, currentYear);
    const calendarDays = [];

    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      calendarDays.push(
        <div key={`prev-${i}`} className="flex items-center justify-center p-0.5">
          <span className="text-gray-300 text-[11px]">{prevMonthDays - i}</span>
        </div>
      );
    }

    // Current month days
    for (let i = 1; i <= days; i++) {
      const dayFormatted = `${String(i).padStart(2, '0')}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;
      const currIso = toIso(dayFormatted);
      
      const isStart = minSelectedIso === currIso;
      const isEnd = maxSelectedIso === currIso;
      const isInRange = minSelectedIso && maxSelectedIso && currIso >= minSelectedIso && currIso <= maxSelectedIso;
      const isFirstClick = firstClickDate === dayFormatted;

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
            onClick={() => handleDateClick(dayFormatted)}
            onDoubleClick={() => handleDateDoubleClick(dayFormatted)}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium transition-all ${
              isStart || isEnd || isFirstClick
                ? 'bg-emerald-700 text-white font-bold shadow-2xs scale-105 z-10'
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

    // Next month filler
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

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCards.length === 0) return ToasterService.error("Please select date(s) from the calendar");

    try {
      setIsSubmitting(true);

      const requestDetails = selectedCards.map(card => {
        const isoDate = toIso(card.dateStr);
        const startTime = `${card.startHours.padStart(2, '0')}:${card.startMinutes.padStart(2, '0')}:00`;
        const endTime = `${card.endHours.padStart(2, '0')}:${card.endMinutes.padStart(2, '0')}:00`;
        const reasonStr = card.reasonType === 'BOTH' ? 'Forgot In/Out Punch' : card.reasonType === 'FORGOT_IN' ? 'Forgot In Punch' : 'Forgot Out Punch';

        return {
          fromDate: toIso(card.fromDate),
          toDate: toIso(card.toDate),
          shiftDate: isoDate,
          checkInTime: `${isoDate}T${startTime}`,
          checkOutTime: `${isoDate}T${endTime}`,
          shiftInTime: `${isoDate}T09:00:00`,
          shiftOutTime: `${isoDate}T18:00:00`,
          projectTaskId: 5001,
          projectTaskName: "Attendance Regularization",
          remarks: card.remarks?.trim() || `Regularization request (${reasonStr})`,
          clientName: card.clientName?.trim() || null,
          visitLocation: card.visitLocation?.trim() || null,
          purpose: card.purpose?.trim() || null,
          requestType: "WORK_FROM_HOME",
          reason: reasonStr
        };
      });

      const payload = {
        employeeId: currentUser.id,
        requestDetails
      };

      await axios.post(REQUESTS_URL, payload);

      ToasterService.success(`Submitted ${selectedCards.length} Regularization Request(s) successfully!`);
      await fetchRegularizationLogs();

      setSelectedCards([]);
      setFirstClickDate(null);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Failed to submit regularization requests";
      ToasterService.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredLogs = regularizationLogs.filter(l =>
    JSON.stringify(l).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <PageMeta
        title="Attendance Regularization Request"
        description="Apply for attendance regularization and missed punches"
      />
      <PageBreadcrumb pageTitle="Attendance Regularization" />

      <div className="max-w-6xl mx-auto pb-1 animate-in fade-in duration-200 mt-0.5">
        
        {/* Compact User Banner matching Image 2 */}
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
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="hover:underline flex items-center gap-1 bg-cyan-50 px-2.5 py-0.5 rounded text-cyan-800 border border-cyan-200 text-[11px] font-semibold shadow-2xs"
            >
              <FileText className="w-3 h-3" /> Request History ({regularizationLogs.length})
            </button>
            <div className="text-left sm:text-right">
              <span className="text-[9px] text-gray-400 font-medium block">Employee ID</span>
              <span className="text-[11px] font-mono font-semibold text-gray-700">#{currentUser.code}</span>
            </div>
          </div>
        </div>

        {/* Selection Hint Badge when range is active */}
        {firstClickDate && (
          <div className="mb-2">
            <span className="text-cyan-700 font-bold bg-cyan-50 px-2.5 py-0.5 rounded border border-cyan-200 text-[10px] inline-block shadow-2xs">
              Selected start: {firstClickDate}. Click end date to finish range!
            </span>
          </div>
        )}

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start mb-2">
          
          {/* Left Column: Interactive Calendar */}
          <div className="lg:col-span-5 bg-white rounded-lg shadow-2xs border border-gray-200/80 p-3 flex flex-col justify-between h-[340px]">
            <div>
              {/* Month Header */}
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={handlePrevMonth} className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded hover:bg-gray-50">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <h2 className="text-xs font-bold text-gray-800">
                  {monthNames[currentMonth]} {currentYear}
                </h2>
                <button type="button" onClick={handleNextMonth} className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded hover:bg-gray-50">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-gray-500 mb-1 border-b border-gray-100 pb-0.5">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>

              {/* Dates Grid with Connected Range Bar */}
              <div className="grid grid-cols-7 gap-y-0.5 mb-1">
                {renderCalendar()}
              </div>
            </div>

            <div>
              {/* Legend */}
              <div className="flex items-center justify-start gap-2 text-[10px] text-gray-600 border-t border-dashed border-gray-200 pt-1.5 mb-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm border border-emerald-500 bg-emerald-50" />
                  <span>Today</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full border border-rose-400 bg-white" />
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full border border-purple-400 bg-white" />
                  <span>Half day absent</span>
                </div>
              </div>

              <p className="text-[9.5px] text-gray-500 truncate">
                Dates marked "Absent": <span className="font-semibold text-rose-700">{absentDates.length > 0 ? absentDates.join(', ') : 'None'}</span>
              </p>
            </div>
          </div>

          {/* Right Column: Ultra-Compact Multi-Card Container */}
          <div className="lg:col-span-7 bg-white rounded-lg shadow-2xs border border-gray-200/80 overflow-hidden h-[340px] flex flex-col justify-between">
            
            {selectedCards.length === 0 ? (
              /* State 1: Placeholder before selecting date */
              <div className="p-6 text-center flex flex-col items-center justify-center my-auto">
                <h3 className="text-xl md:text-2xl font-extrabold text-gray-300 tracking-tight max-w-xs leading-snug">
                  Please select AR date from calendar
                </h3>
              </div>
            ) : (
              /* State 2: Ultra-compact Cards for each selected date in range */
              <form onSubmit={handleSubmitAll} className="flex flex-col h-full justify-between overflow-hidden">
                
                {/* Scrollable Cards Container */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 pr-1.5 border-b border-gray-100">
                  {selectedCards.map((card) => (
                    <div key={card.dateStr} className="bg-white rounded-md border border-gray-200/90 shadow-2xs overflow-hidden relative">
                      
                      {/* Top Bar with Request Date and Remove Button */}
                      <div className="bg-cyan-50/80 border-b border-cyan-200/60 px-3 py-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-800">
                          Request for <span className="text-gray-900 font-black">{card.dateStr}</span>
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setViewPunchesDate(card.dateStr)}
                            className="text-[11px] font-semibold text-cyan-700 hover:underline"
                          >
                            View Punches
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCard(card.dateStr)}
                            className="w-4 h-4 rounded-full bg-white/90 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 flex items-center justify-center transition-colors"
                            title="Remove date"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 space-y-2">
                        {/* Shift info header row */}
                        <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium bg-gray-50/80 px-2 py-1 rounded border border-gray-100">
                          <div>
                            Shift: <span className="font-bold text-gray-900">04:00 - 10:00</span>
                          </div>
                          <div>
                            Check in: <span className="text-gray-400 font-mono">--:--</span>
                          </div>
                          <div>
                            Check out: <span className="text-gray-400 font-mono">--:--</span>
                          </div>
                        </div>

                        {/* Radio Choices */}
                        <div className="flex items-center justify-center gap-4 py-0">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`reasonType-${card.dateStr}`}
                              checked={card.reasonType === 'FORGOT_IN'}
                              onChange={() => updateCardState(card.dateStr, 'reasonType', 'FORGOT_IN')}
                              className="w-3 h-3 text-cyan-600 focus:ring-cyan-500 border-gray-300"
                            />
                            <span className="text-[11px] font-medium text-gray-700">Forgot In</span>
                          </label>

                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`reasonType-${card.dateStr}`}
                              checked={card.reasonType === 'FORGOT_OUT'}
                              onChange={() => updateCardState(card.dateStr, 'reasonType', 'FORGOT_OUT')}
                              className="w-3 h-3 text-cyan-600 focus:ring-cyan-500 border-gray-300"
                            />
                            <span className="text-[11px] font-medium text-gray-700">Forgot Out</span>
                          </label>

                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name={`reasonType-${card.dateStr}`}
                              checked={card.reasonType === 'BOTH'}
                              onChange={() => updateCardState(card.dateStr, 'reasonType', 'BOTH')}
                              className="w-3 h-3 text-cyan-600 focus:ring-cyan-500 border-gray-300"
                            />
                            <span className="text-[11px] font-bold text-gray-900">Both</span>
                          </label>
                        </div>

                        {/* Form Inputs Grid */}
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> From date
                              </label>
                              <div className="relative">
                                <input
                                  type="date"
                                  value={toIso(card.fromDate)}
                                  onClick={(e) => {
                                    try { e.currentTarget.showPicker(); } catch {}
                                  }}
                                  onChange={(e) => {
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                      updateCardState(card.dateStr, 'fromDate', formatted);
                                    }
                                  }}
                                  className="w-full h-6.5 pl-2 pr-6 py-0 bg-white border border-gray-200 rounded text-[11px] font-medium text-gray-800 outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
                                />
                                <CalendarDays className="w-3 h-3 text-gray-400 absolute right-1.5 top-1.5 pointer-events-none" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> To date
                              </label>
                              <div className="relative">
                                <input
                                  type="date"
                                  value={toIso(card.toDate)}
                                  onClick={(e) => {
                                    try { e.currentTarget.showPicker(); } catch {}
                                  }}
                                  onChange={(e) => {
                                    const parts = e.target.value.split('-');
                                    if (parts.length === 3) {
                                      const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                      updateCardState(card.dateStr, 'toDate', formatted);
                                    }
                                  }}
                                  className="w-full h-6.5 pl-2 pr-6 py-0 bg-white border border-gray-200 rounded text-[11px] font-medium text-gray-800 outline-none focus:ring-1 focus:ring-cyan-500 transition-all cursor-pointer"
                                />
                                <CalendarDays className="w-3 h-3 text-gray-400 absolute right-1.5 top-1.5 pointer-events-none" />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5">
                            <div>
                              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> Start Hours
                              </label>
                              <input
                                type="text"
                                value={card.startHours}
                                onChange={(e) => updateCardState(card.dateStr, 'startHours', e.target.value)}
                                className="w-full h-6.5 px-1 py-0 bg-white border border-gray-200 rounded text-[11px] font-medium text-center outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> Start Mins
                              </label>
                              <input
                                type="text"
                                value={card.startMinutes}
                                onChange={(e) => updateCardState(card.dateStr, 'startMinutes', e.target.value)}
                                className="w-full h-6.5 px-1 py-0 bg-white border border-gray-200 rounded text-[11px] font-medium text-center outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> End Hours
                              </label>
                              <input
                                type="text"
                                value={card.endHours}
                                onChange={(e) => updateCardState(card.dateStr, 'endHours', e.target.value)}
                                className="w-full h-6.5 px-1 py-0 bg-white border border-gray-200 rounded text-[11px] font-medium text-center outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-medium text-gray-700 mb-0.5">
                                <span className="text-rose-500">*</span> End Mins
                              </label>
                              <input
                                type="text"
                                value={card.endMinutes}
                                onChange={(e) => updateCardState(card.dateStr, 'endMinutes', e.target.value)}
                                className="w-full h-6.5 px-1 py-0 bg-white border border-gray-200 rounded text-[11px] font-medium text-center outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>

                {/* Fixed Bottom Submit Bar */}
                <div className="bg-cyan-50/30 p-2 flex justify-center shrink-0 border-t border-cyan-100">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center h-8.5 px-8 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md font-bold text-[11px] uppercase tracking-wider transition-all shadow-xs disabled:opacity-70 min-w-[130px]"
                  >
                    {isSubmitting ? 'Submitting...' : 'SUBMIT'}
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      {/* Sleek Slide-Over Drawer for Regularization Request History */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-gray-200 animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Regularization Requests History</h2>
                <p className="text-[11px] text-gray-500">Track status of submitted regularization requests</p>
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
                {filteredLogs.map((row) => (
                  <div key={row.id} className="p-3 bg-white rounded-lg border border-gray-200/80 shadow-2xs hover:border-cyan-300 transition-all flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400 font-medium">#{row.id}</span>
                        <span className="text-xs font-bold text-gray-900">{row.date}</span>
                      </div>
                      <div className="text-[11px] text-cyan-700 font-semibold mt-0.5">{row.type} ({row.hours})</div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {row.status}
                    </span>
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

      </div>

      {/* View Punches Modal */}
      {viewPunchesDate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="bg-amber-50/80 border-b border-amber-200/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>Punch Details for {viewPunchesDate}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewPunchesDate(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200/60">
                <div>
                  <span className="text-gray-500 block text-[11px]">Assigned Shift</span>
                  <span className="font-bold text-gray-900 text-xs">09:00 - 18:00</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Shift Duration</span>
                  <span className="font-bold text-gray-900 text-xs">9 Hours</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-md border border-gray-100 bg-white">
                  <span className="text-gray-600 font-medium">Check-In Punch</span>
                  <span className="font-mono text-rose-600 font-bold text-[11px]">--:-- (Missing)</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-md border border-gray-100 bg-white">
                  <span className="text-gray-600 font-medium">Check-Out Punch</span>
                  <span className="font-mono text-rose-600 font-bold text-[11px]">--:-- (Missing)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-2.5 rounded-md border border-rose-100 text-[11px] font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>No punch records found for this date. Submit Attendance Regularization to request manual punch entry.</span>
              </div>
            </div>
            <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewPunchesDate(null)}
                className="px-4 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md font-medium hover:bg-gray-100 text-xs"
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

export default TimesheetManagementPage;
