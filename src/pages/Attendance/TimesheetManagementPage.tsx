import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, X, Search, Calendar, AlertCircle, Clock, FileText } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { TOOL_BUTTON } from '../Payroll/hrmsUi';
import PageMeta from '../../components/common/PageMeta';
import { ToasterService } from '../../Services/ToasterService';
import { todayIso } from '../../utils/localDate';
import { apiError, CalendarDay, DAY_KIND_LABEL, dayKind, fetchMonth, hoursOf, timeOf, withBrowserOffset } from './attendanceApi';

// Attendance regularization: the employee states the correct check-in / check-out times of a past day;
// an approver applies them to the day.
const REGULARIZATION_URL = '/v1/api/attendance/regularization';

type ReasonType = 'FORGOT_IN' | 'FORGOT_OUT' | 'BOTH';

interface DateRequestCardState {
  date: string; // yyyy-MM-dd
  reasonType: ReasonType;
  inTime: string; // HH:mm
  outTime: string;
  reason: string;
}

interface RegularizationRow {
  id: number;
  attendanceDate: string;
  requestedInTime?: string | null;
  requestedOutTime?: string | null;
  reason: string;
  status: string;
  rejectionReason?: string | null;
  actionBy?: string | null;
  createdDate?: string;
}

const REASON_LABEL: Record<ReasonType, string> = {
  FORGOT_IN: 'Forgot check-in',
  FORGOT_OUT: 'Forgot check-out',
  BOTH: 'Forgot both punches',
};

const displayDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const TimesheetManagementPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = todayIso();

  // Own employee identity from the login token (no hard-coded ids)
  const currentUser = useCurrentEmployee();

  const [firstClickDate, setFirstClickDate] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<DateRequestCardState[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [viewPunchesDate, setViewPunchesDate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regularizationLogs, setRegularizationLogs] = useState<RegularizationRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Days of the shown month (and any selected month) as the server sees them
  const [days, setDays] = useState<Record<string, CalendarDay>>({});

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const fetchRegularizationLogs = useCallback(async () => {
    if (!currentUser.hasEmployee) return;
    try {
      const res = await axios.get(`${REGULARIZATION_URL}/my`);
      setRegularizationLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, 'Could not load your regularization requests.'));
    }
  }, [currentUser.hasEmployee]);

  useEffect(() => {
    fetchRegularizationLogs();
  }, [fetchRegularizationLogs]);

  const loadMonth = useCallback(async (year: number, month1: number) => {
    if (!currentUser.hasEmployee) return;
    try {
      const list = await fetchMonth(year, month1);
      setDays((prev) => ({ ...prev, ...Object.fromEntries(list.map((d) => [d.date, d])) }));
    } catch {
      // The calendar still works without day details
    }
  }, [currentUser.hasEmployee]);

  useEffect(() => {
    loadMonth(currentYear, currentMonth + 1);
  }, [loadMonth, currentYear, currentMonth]);

  const pendingDates = useMemo(
    () => new Set(regularizationLogs.filter((r) => r.status === 'PENDING').map((r) => r.attendanceDate)),
    [regularizationLogs],
  );

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  // A new card starts from what the day already has: a missing check-out keeps the real check-in
  const newCard = (date: string): DateRequestCardState => {
    const day = days[date];
    const hasIn = Boolean(day?.inTime);
    const hasOut = Boolean(day?.outTime) && day?.status !== 'CHECKED_IN';
    const reasonType: ReasonType = hasIn && !hasOut ? 'FORGOT_OUT' : !hasIn && hasOut ? 'FORGOT_IN' : 'BOTH';
    return {
      date,
      reasonType,
      inTime: timeOf(day?.inTime) || '09:00',
      outTime: hasOut ? timeOf(day?.outTime) : '18:00',
      reason: '',
    };
  };

  // Past working days only; one request per day while another is pending
  const selectable = (date: string) => {
    const day = days[date];
    return date <= today && !pendingDates.has(date) && !(day?.holidayName || day?.weeklyOff || day?.status === 'ON_LEAVE');
  };

  const datesBetween = (a: string, b: string) => {
    const [from, to] = a < b ? [a, b] : [b, a];
    const out: string[] = [];
    for (let d = new Date(`${from}T00:00:00`); ; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (key > to) break;
      out.push(key);
    }
    return out;
  };

  const handleDateClick = (date: string) => {
    if (!firstClickDate) {
      setFirstClickDate(date);
      setSelectedCards(selectable(date) ? [newCard(date)] : []);
      return;
    }
    const existing = new Map(selectedCards.map((c) => [c.date, c]));
    setSelectedCards(datesBetween(firstClickDate, date).filter(selectable).map((d) => existing.get(d) ?? newCard(d)));
    setFirstClickDate(null);
  };

  const handleDateDoubleClick = (date: string) => {
    setFirstClickDate(null);
    setSelectedCards(selectable(date) ? [newCard(date)] : []);
  };

  const removeCard = (date: string) => {
    const updated = selectedCards.filter((c) => c.date !== date);
    setSelectedCards(updated);
    if (updated.length === 0) setFirstClickDate(null);
  };

  const updateCardState = <K extends keyof DateRequestCardState>(date: string, field: K, value: DateRequestCardState[K]) => {
    setSelectedCards((prev) => prev.map((c) => (c.date === date ? { ...c, [field]: value } : c)));
  };

  const selectedDates = useMemo(() => new Set(selectedCards.map((c) => c.date)), [selectedCards]);

  const renderCalendar = () => {
    const total = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    const prevMonthDays = daysInMonth(currentMonth - 1, currentYear);
    const cells = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(
        <div key={`prev-${i}`} className="flex items-center justify-center p-0.5">
          <div className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-gray-700 text-xs font-medium">{prevMonthDays - i}</div>
        </div>
      );
    }

    for (let i = 1; i <= total; i++) {
      const date = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const day = days[date];
      const kind = dayKind(day);
      const missingPunch = date < today && (kind === 'ABSENT' || kind === 'HALF_DAY' || (day?.inTime && !day?.outTime));
      const isSelected = selectedDates.has(date) || firstClickDate === date;
      const disabled = !selectable(date);
      const title = pendingDates.has(date) ? 'A request is already pending'
        : day?.holidayName || (day?.weeklyOff ? 'Weekly off' : DAY_KIND_LABEL[kind]) || undefined;

      cells.push(
        <div key={`curr-${i}`} className="flex items-center justify-center p-0.5">
          <button
            type="button"
            title={title}
            disabled={disabled && !isSelected}
            onClick={() => handleDateClick(date)}
            onDoubleClick={() => handleDateDoubleClick(date)}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all ${
              isSelected
                ? 'bg-cyan-600 text-white shadow-xs font-bold ring-2 ring-cyan-500/20 cursor-pointer'
                : disabled
                ? 'text-slate-300 dark:text-gray-600 cursor-not-allowed'
                : pendingDates.has(date)
                ? 'border border-amber-400 text-amber-600 cursor-not-allowed'
                : missingPunch
                ? 'border border-rose-400 dark:border-rose-500/60 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer'
                : date === today
                ? 'border border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold cursor-pointer'
                : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#222222] cursor-pointer'
            }`}
          >
            {i}
          </button>
        </div>
      );
    }

    const totalCells = Math.ceil((total + firstDay) / 7) * 7;
    for (let i = 1; i <= totalCells - (total + firstDay); i++) {
      cells.push(
        <div key={`next-${i}`} className="flex items-center justify-center p-0.5">
          <div className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-gray-700 text-xs font-medium">{i}</div>
        </div>
      );
    }

    return cells;
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCards.length === 0) return ToasterService.error("Please select date(s) from the calendar");
    const missing = selectedCards.find((c) => !c.reason.trim());
    if (missing) return ToasterService.error(`Please give a reason for ${displayDate(missing.date)}`);
    const badTimes = selectedCards.find((c) => c.reasonType === 'BOTH' && c.outTime <= c.inTime);
    if (badTimes) return ToasterService.error(`Check-out must be after check-in on ${displayDate(badTimes.date)}`);

    setIsSubmitting(true);
    const failed: DateRequestCardState[] = [];
    let sent = 0;
    for (const card of selectedCards) {
      try {
        await axios.post(REGULARIZATION_URL, {
          attendanceDate: card.date,
          // Typed in the browser's time zone; the offset lets the server store the right moment
          inTime: card.reasonType !== 'FORGOT_OUT' ? withBrowserOffset(`${card.date}T${card.inTime}:00`) : null,
          outTime: card.reasonType !== 'FORGOT_IN' ? withBrowserOffset(`${card.date}T${card.outTime}:00`) : null,
          attendanceMode: 'OFFICE',
          reason: `${REASON_LABEL[card.reasonType]}: ${card.reason.trim()}`,
        });
        sent++;
      } catch (err) {
        failed.push(card);
        ToasterService.error(`${displayDate(card.date)}: ${apiError(err, 'could not be submitted')}`);
      }
    }
    if (sent) ToasterService.success(`${sent} regularization request(s) sent for approval.`);
    setSelectedCards(failed);
    setFirstClickDate(null);
    await fetchRegularizationLogs();
    setIsSubmitting(false);
  };

  const handleWithdraw = async (row: RegularizationRow) => {
    if (!window.confirm(`Withdraw the regularization request for ${displayDate(row.attendanceDate)}?`)) return;
    try {
      await axios.put(`${REGULARIZATION_URL}/${row.id}/cancel`);
      ToasterService.success('Request withdrawn.');
      fetchRegularizationLogs();
    } catch (err) {
      ToasterService.error(apiError(err, 'Could not withdraw the request.'));
    }
  };

  const filteredLogs = regularizationLogs.filter((l) =>
    JSON.stringify(l).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const punchesDay = viewPunchesDate ? days[viewPunchesDate] : undefined;

  return (
    <>
      <PageMeta
        title="Attendance Regularization Request"
        description="Apply for attendance regularization and missed punches"
      />
      <PageBreadcrumb
        pageTitle="Attendance Regularization"
        actions={
          <button type="button" onClick={() => setIsHistoryDrawerOpen(true)} className={TOOL_BUTTON}>
            <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Request History ({regularizationLogs.length})
          </button>
        }
      />

      <div className="max-w-6xl mx-auto pb-4 animate-in fade-in duration-200">

        {firstClickDate && (
          <div className="mb-3">
            <span className="text-cyan-700 dark:text-cyan-300 font-bold bg-cyan-50 dark:bg-[#222222] px-3 py-1 rounded-xl border border-cyan-200 dark:!border-transparent text-xs inline-block shadow-2xs">
              Selected start: {displayDate(firstClickDate)}. Click an end date to pick a range.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start mb-4">

          {/* Left Column: Interactive Calendar */}
          <div className="lg:col-span-5 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-4 sm:p-5 flex flex-col justify-between min-h-[380px]">
            <div>
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
                <span className="text-[11px] font-medium text-slate-400 dark:text-gray-500">Pick date(s)</span>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-2">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>

              <div className="grid grid-cols-7 gap-1 max-w-xs mx-auto lg:max-w-none">
                {renderCalendar()}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 dark:!border-transparent space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-cyan-500 bg-cyan-500/20 inline-block"></span> Today</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-rose-500 bg-rose-500/20 inline-block"></span> Missing punch</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 bg-amber-500/20 inline-block"></span> Request pending</span>
              </div>
              <div className="text-[11px] text-slate-400 dark:text-gray-500">
                Past working days only. Double click a date to select just that day.
              </div>
            </div>
          </div>

          {/* Right Column: one card per selected day */}
          <div className="lg:col-span-7 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent overflow-hidden min-h-[380px] flex flex-col justify-between">

            {selectedCards.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center my-auto">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-[#222222] border border-slate-200 dark:!border-transparent flex items-center justify-center text-slate-400 dark:text-gray-500 mb-3 shadow-2xs">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-slate-700 dark:text-gray-300 tracking-tight max-w-xs leading-snug">
                  Pick the day to correct
                </h3>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                  Days with a missing punch are marked in red
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitAll} className="flex flex-col h-full justify-between overflow-hidden">

                <div className="flex-1 overflow-y-auto no-scrollbar p-3.5 space-y-3 border-b border-slate-100 dark:!border-transparent max-h-[420px]">
                  {selectedCards.map((card) => {
                    const day = days[card.date];
                    return (
                      <div key={card.date} className="bg-slate-50/50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent shadow-2xs overflow-hidden relative">

                        <div className="bg-slate-100/80 dark:bg-[#191919] border-b border-slate-200/80 dark:!border-transparent px-3.5 py-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">
                            Request for <span className="font-mono text-cyan-600 dark:text-cyan-400">{displayDate(card.date)}</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setViewPunchesDate(card.date)}
                              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                            >
                              View Punches
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCard(card.date)}
                              className="w-5 h-5 rounded-full bg-white dark:bg-[#191919] hover:bg-rose-50 dark:hover:bg-[#2a2a2a] text-slate-400 hover:text-rose-600 border border-slate-200 dark:!border-transparent flex items-center justify-center transition-colors cursor-pointer"
                              title="Remove date"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-gray-300 font-medium bg-white dark:bg-[#191919] px-3 py-1.5 rounded-lg border border-slate-200/60 dark:!border-transparent">
                            <div>
                              Status: <span className="font-bold text-slate-900 dark:text-white">{DAY_KIND_LABEL[dayKind(day)] || 'No record'}</span>
                            </div>
                            <div>
                              Check in: <span className="font-mono">{timeOf(day?.inTime) || '--:--'}</span>
                            </div>
                            <div>
                              Check out: <span className="font-mono">{day?.status === 'CHECKED_IN' ? '--:--' : timeOf(day?.outTime) || '--:--'}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-center gap-5 py-0.5">
                            {(['FORGOT_IN', 'FORGOT_OUT', 'BOTH'] as ReasonType[]).map((type) => (
                              <label key={type} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-gray-300">
                                <input
                                  type="radio"
                                  name={`reasonType-${card.date}`}
                                  checked={card.reasonType === type}
                                  onChange={() => updateCardState(card.date, 'reasonType', type)}
                                  className="text-cyan-600 focus:ring-cyan-500 dark:bg-[#191919] cursor-pointer"
                                />
                                <span>{type === 'FORGOT_IN' ? 'Forgot In' : type === 'FORGOT_OUT' ? 'Forgot Out' : 'Both'}</span>
                              </label>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1">
                                {card.reasonType !== 'FORGOT_OUT' && <span className="text-rose-500">*</span>} Correct check-in
                              </label>
                              <input
                                type="time"
                                value={card.inTime}
                                disabled={card.reasonType === 'FORGOT_OUT'}
                                onChange={(e) => updateCardState(card.date, 'inTime', e.target.value)}
                                className="w-full h-8 px-3 py-0 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-40"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1">
                                {card.reasonType !== 'FORGOT_IN' && <span className="text-rose-500">*</span>} Correct check-out
                              </label>
                              <input
                                type="time"
                                value={card.outTime}
                                disabled={card.reasonType === 'FORGOT_IN'}
                                onChange={(e) => updateCardState(card.date, 'outTime', e.target.value)}
                                className="w-full h-8 px-3 py-0 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-40"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-gray-300 mb-1">
                              <span className="text-rose-500">*</span> Reason
                            </label>
                            <input
                              type="text"
                              value={card.reason}
                              maxLength={200}
                              placeholder="e.g. Biometric was down, punched in the register"
                              onChange={(e) => updateCardState(card.date, 'reason', e.target.value)}
                              className="w-full h-8 px-3 py-0 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-50 dark:bg-[#191919] p-3 flex justify-center shrink-0 border-t border-slate-200/80 dark:!border-transparent">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center h-9 px-8 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs disabled:opacity-50 cursor-pointer min-w-[140px]"
                  >
                    {isSubmitting ? 'Submitting...' : selectedCards.length > 1 ? `SUBMIT ${selectedCards.length} REQUESTS` : 'SUBMIT'}
                  </button>
                </div>
              </form>
            )}

          </div>

        </div>

      {/* Slide-over drawer: request history */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:!border-transparent animate-in slide-in-from-right duration-300">

            <div className="p-4 border-b border-slate-200 dark:!border-transparent bg-slate-50 dark:bg-[#222222] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Regularization Requests History</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">Track status of submitted regularization requests</p>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto no-scrollbar space-y-3">
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 text-slate-400 dark:text-gray-500 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>

              {filteredLogs.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-gray-500 text-center py-6">No regularization requests yet.</p>
              )}

              <div className="space-y-2.5">
                {filteredLogs.map((row) => {
                  const status = String(row.status || 'PENDING').toUpperCase();
                  let badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';
                  if (status === 'APPROVED') {
                    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';
                  } else if (status === 'REJECTED') {
                    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent';
                  } else if (status === 'CANCELLED') {
                    badgeClass = 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent';
                  }

                  return (
                    <div key={row.id} className="p-3 bg-slate-50/70 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent shadow-2xs hover:border-cyan-500/50 transition-all">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 font-bold">#{row.id}</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">{displayDate(row.attendanceDate)}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-gray-300 font-medium mt-0.5">
                            In {timeOf(row.requestedInTime) || '—'} · Out {timeOf(row.requestedOutTime) || '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === 'PENDING' && (
                            <button type="button" onClick={() => handleWithdraw(row)}
                              className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer">Withdraw</button>
                          )}
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${badgeClass}`}>
                            {status}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">{row.reason}</div>
                      {row.rejectionReason && (
                        <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                          Rejected{row.actionBy ? ` by ${row.actionBy}` : ''}: {row.rejectionReason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 border-t border-slate-200 dark:!border-transparent bg-slate-50 dark:bg-[#222222] flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="px-4 py-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent text-slate-700 dark:text-gray-200 rounded-xl font-semibold text-xs hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      </div>

      {/* The day's recorded punches */}
      {viewPunchesDate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 dark:!border-transparent">
            <div className="bg-amber-50/80 dark:bg-[#222222] border-b border-amber-200/60 dark:!border-transparent p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Punch Details for {displayDate(viewPunchesDate)}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewPunchesDate(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-md cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-[#222222] p-3 rounded-xl border border-slate-200/60 dark:!border-transparent">
                <div>
                  <span className="text-slate-500 dark:text-gray-400 block text-[11px]">Status</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">{DAY_KIND_LABEL[dayKind(punchesDay)] || 'No record'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 block text-[11px]">Worked</span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs font-mono">{hoursOf(punchesDay?.workedMinutes)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:!border-transparent bg-slate-50/50 dark:bg-[#222222]">
                  <span className="text-slate-600 dark:text-gray-300 font-medium">First check-in</span>
                  <span className={`font-mono font-bold text-xs ${punchesDay?.inTime ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                    {timeOf(punchesDay?.inTime) || '--:-- (Missing)'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/80 dark:!border-transparent bg-slate-50/50 dark:bg-[#222222]">
                  <span className="text-slate-600 dark:text-gray-300 font-medium">Last check-out</span>
                  <span className={`font-mono font-bold text-xs ${punchesDay?.outTime && punchesDay?.status !== 'CHECKED_IN' ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                    {punchesDay?.outTime && punchesDay?.status !== 'CHECKED_IN' ? timeOf(punchesDay.outTime) : '--:-- (Missing)'}
                  </span>
                </div>
              </div>

              {!punchesDay?.inTime && (
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-[#222222] p-3 rounded-xl border border-rose-200 dark:!border-transparent text-[11px] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>No punches recorded for this date. Submit a regularization with the correct times.</span>
                </div>
              )}
            </div>
            <div className="bg-slate-50 dark:bg-[#222222] p-3.5 border-t border-slate-200 dark:!border-transparent flex justify-end">
              <button
                type="button"
                onClick={() => setViewPunchesDate(null)}
                className="px-4 py-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent text-slate-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-[#2a2a2a] text-xs transition cursor-pointer"
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
