import { useCurrentEmployee } from "../../access/useCurrentEmployee";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  FileText, Eye, XCircle, X, Calendar, MapPin, Briefcase, Tag, Send, ChevronLeft, ChevronRight
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { TOOL_BUTTON } from '../Payroll/hrmsUi';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';
import { todayIso } from "../../utils/localDate";
import { apiError, CalendarDay, fetchMonth, timeOf, withBrowserOffset } from './attendanceApi';
import { leadingDays, weekdayLabels, liveMonthNames, liveWeekdayNames } from "../../company/format";

import { t } from "../../i18n/i18n";
// On-duty visits and work-from-home days. Missed punches are corrected on the regularization page.
const BASE_REQUESTS_URL = '/v1/api/attendance/requests';

type RequestType = 'ON_DUTY' | 'WORK_FROM_HOME';

const TYPE_LABEL: Record<string, string> = {
  ON_DUTY: 'On duty',
  WORK_FROM_HOME: 'Work from home',
  REGULARIZATION: 'Regularization',
  PERMISSION: 'Permission',
};

export interface RequestDetail {
  id?: number;
  fromDate: string;
  toDate: string;
  requestType: string;
  approvalStatus?: string;
  reason?: string;
  remarks?: string | null;
  projectTaskId?: number | null;
  projectTaskName?: string | null;
  clientName?: string | null;
  visitLocation?: string | null;
  purpose?: string | null;
}

export interface AttendanceRequestModel {
  id: number;
  employeeId: number;
  employeeName?: string;
  overallStatus?: string;
  approverRemarks?: string | null;
  createdDate?: string;
  actionDate?: string | null;
  responseDetails: RequestDetail[];
}

interface RequestForm {
  requestType: RequestType;
  fromDate: string;
  toDate: string;
  clientName: string;
  visitLocation: string;
  purpose: string;
  projectTaskId: string;
  projectTaskName: string;
  reason: string;
  remarks: string;
}

/** One day of the request on the review tab: its shift and planned working times can be changed. */
interface ReviewDay {
  date: string;
  /** Holiday name or "Weekly off" when the day is not a working day, else null */
  off: string | null;
  include: boolean;
  shiftIn: string;
  shiftOut: string;
  workFrom: string;
  workTo: string;
}

const DEFAULT_SHIFT = { start: '09:00', end: '18:00' };
const WEEKDAY = liveWeekdayNames("short");

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "2026-08-10" + "18:00" → "2026-08-10T18:00:00"; an end time before the start belongs to the next day (night shift). */
const dateTime = (date: string, time: string, startTime?: string) => {
  if (!time) return null;
  let day = date;
  if (startTime && time <= startTime) {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    day = isoDay(next);
  }
  return withBrowserOffset(`${day}T${time}:00`);
};

const emptyForm = (): RequestForm => ({
  requestType: 'ON_DUTY',
  fromDate: todayIso(),
  toDate: todayIso(),
  clientName: '',
  visitLocation: '',
  purpose: '',
  projectTaskId: '',
  projectTaskName: '',
  reason: '',
  remarks: '',
});

const formatDateDisplay = (dStr?: string) => {
  if (!dStr) return '-';
  const parts = dStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
};

const statusClass = (status: string) =>
  status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent'
  : status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent'
  : status === 'CANCELLED' ? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent'
  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent';

const AttendanceRequestsPage: React.FC = () => {
  // Own employee identity from the login token (no hard-coded ids)
  const currentUser = useCurrentEmployee();
  const employeeId = currentUser.id;

  const [requests, setRequests] = useState<AttendanceRequestModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'apply' | 'history'>('apply');
  // Apply has two steps: the request details, then every day of the range to check and adjust times
  const [step, setStep] = useState<'details' | 'review'>('details');
  const [reviewDays, setReviewDays] = useState<ReviewDay[]>([]);
  const [shiftTimes, setShiftTimes] = useState(DEFAULT_SHIFT);
  const [viewingRequest, setViewingRequest] = useState<AttendanceRequestModel | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [form, setForm] = useState<RequestForm>(emptyForm);
  const [days, setDays] = useState<Record<string, CalendarDay>>({});

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthNames = liveMonthNames("long");

  const fetchMyRequests = useCallback(async () => {
    if (!currentUser.hasEmployee) return;
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_REQUESTS_URL}/my/${employeeId}`);
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, 'Could not load your requests.'));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser.hasEmployee, employeeId]);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  // Weekly offs and holidays of the shown month, so the range shows which days count
  useEffect(() => {
    if (!currentUser.hasEmployee) return;
    fetchMonth(currentYear, currentMonth + 1)
      .then((list) => setDays((prev) => ({ ...prev, ...Object.fromEntries(list.map((d) => [d.date, d])) })))
      .catch(() => undefined);
  }, [currentUser.hasEmployee, currentYear, currentMonth]);

  // The employee's current shift gives the default times on the review tab (09:00–18:00 when there is none)
  useEffect(() => {
    if (!currentUser.hasEmployee) return;
    axios.get(`${BASE_REQUESTS_URL.replace('/requests', '')}/shiftShedules/employee/${employeeId}/current`)
      .then((res) => res.data?.shiftId ? axios.get(`${BASE_REQUESTS_URL.replace('/requests', '')}/shifts/${res.data.shiftId}`) : null)
      .then((res) => {
        const start = String(res?.data?.startTime || '').slice(0, 5);
        const end = String(res?.data?.endTime || '').slice(0, 5);
        if (start && end) setShiftTimes({ start, end });
      })
      .catch(() => undefined);
  }, [currentUser.hasEmployee, employeeId]);

  const isOff = (date: string) => Boolean(days[date]?.holidayName || days[date]?.weeklyOff);

  // Working days in the range (only these are marked when approved)
  const totalDays = useMemo(() => {
    if (!form.fromDate || !form.toDate || form.toDate < form.fromDate) return 0;
    let count = 0;
    for (let d = new Date(`${form.fromDate}T00:00:00`); ; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (key > form.toDate) break;
      if (!isOff(key)) count += 1;
    }
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fromDate, form.toDate, days]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.hasEmployee) return ToasterService.error('No employee record is linked to your account.');
    if (!form.fromDate || !form.toDate) return ToasterService.error('Please pick the dates.');
    if (form.toDate < form.fromDate) return ToasterService.error('End Date cannot be before Start Date.');
    if (!form.reason.trim()) return ToasterService.error('Please give a reason.');
    if (form.requestType === 'ON_DUTY' && !form.clientName.trim() && !form.visitLocation.trim()) {
      return ToasterService.error('Give the client or the place you are visiting.');
    }

    // Weekly offs and holidays of every month in the range (the calendar only loaded the shown month)
    const known = { ...days };
    const months = new Set<string>();
    for (let d = new Date(`${form.fromDate}T00:00:00`); isoDay(d) <= form.toDate; d.setDate(d.getDate() + 1)) months.add(isoDay(d).slice(0, 7));
    await Promise.all([...months].filter((m) => !Object.keys(known).some((k) => k.startsWith(m))).map(async (m) => {
      try {
        const list = await fetchMonth(Number(m.slice(0, 4)), Number(m.slice(5, 7)));
        list.forEach((day) => { known[day.date] = day; });
      } catch { /* shown as working days */ }
    }));
    setDays(known);

    const rows: ReviewDay[] = [];
    for (let d = new Date(`${form.fromDate}T00:00:00`); isoDay(d) <= form.toDate; d.setDate(d.getDate() + 1)) {
      const date = isoDay(d);
      const off = known[date]?.holidayName || (known[date]?.weeklyOff ? 'Weekly off' : null);
      rows.push({ date, off, include: !off, shiftIn: shiftTimes.start, shiftOut: shiftTimes.end, workFrom: shiftTimes.start, workTo: shiftTimes.end });
    }
    setReviewDays(rows);
    setStep('review');
  };

  const updateDay = (date: string, patch: Partial<ReviewDay>) =>
    setReviewDays((prev) => prev.map((d) => (d.date === date ? { ...d, ...patch } : d)));

  const includedDays = reviewDays.filter((d) => d.include);

  // Sends the request: one detail per chosen day with its shift and working times
  const handleConfirm = async () => {
    if (includedDays.length === 0) return ToasterService.error('Choose at least one day.');
    const bad = includedDays.find((d) => !d.shiftIn || !d.shiftOut || !d.workFrom || !d.workTo);
    if (bad) return ToasterService.error(`Fill in the times for ${formatDateDisplay(bad.date)}.`);

    setIsSubmitting(true);
    try {
      const onDuty = form.requestType === 'ON_DUTY';
      const taskId = Number(form.projectTaskId);
      await axios.post(BASE_REQUESTS_URL, {
        employeeId,
        requestDetails: includedDays.map((d) => ({
          requestType: form.requestType,
          fromDate: d.date,
          toDate: d.date,
          shiftDate: d.date,
          shiftInTime: dateTime(d.date, d.shiftIn),
          shiftOutTime: dateTime(d.date, d.shiftOut, d.shiftIn),
          checkInTime: dateTime(d.date, d.workFrom),
          checkOutTime: dateTime(d.date, d.workTo, d.workFrom),
          reason: form.reason.trim(),
          remarks: form.remarks.trim() || null,
          clientName: onDuty ? form.clientName.trim() || null : null,
          visitLocation: onDuty ? form.visitLocation.trim() || null : null,
          purpose: onDuty ? form.purpose.trim() || null : null,
          projectTaskId: !onDuty && taskId > 0 ? taskId : null,
          projectTaskName: !onDuty ? form.projectTaskName.trim() || null : null,
        })),
      });
      ToasterService.success(`${TYPE_LABEL[form.requestType]} request for ${includedDays.length} ${includedDays.length === 1 ? 'day' : 'days'} sent for approval.`);
      setForm(emptyForm());
      setReviewDays([]);
      setStep('details');
      fetchMyRequests();
      setActiveTab('history');
    } catch (err) {
      ToasterService.error(apiError(err, 'Failed to submit the request.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (row: AttendanceRequestModel) => {
    if (!window.confirm(`Withdraw request #${row.id}?`)) return;
    try {
      await axios.put(`${BASE_REQUESTS_URL}/${row.id}/cancel/${employeeId}`);
      ToasterService.success('Request withdrawn.');
      fetchMyRequests();
    } catch (err) {
      ToasterService.error(apiError(err, 'Failed to withdraw the request.'));
    }
  };

  const daysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month: number, year: number) => leadingDays(year, month);

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

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
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = dateStr >= form.fromDate && dateStr <= form.toDate;
      const off = isOff(dateStr);

      cells.push(
        <div key={`curr-${i}`} className="flex items-center justify-center p-0.5">
          <button
            type="button"
            title={days[dateStr]?.holidayName || (days[dateStr]?.weeklyOff ? 'Weekly off' : undefined)}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isSelected
                ? (off ? 'bg-cyan-600/40 text-white' : 'bg-cyan-600 text-white shadow-xs font-bold ring-2 ring-cyan-500/20')
                : off ? 'text-slate-400 dark:text-gray-600 line-through' : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-[#222222]'
            }`}
            onClick={() => {
              if (dateStr < form.fromDate) {
                setForm((p) => ({ ...p, fromDate: dateStr, toDate: dateStr }));
              } else {
                setForm((p) => ({ ...p, toDate: dateStr }));
              }
            }}
            onDoubleClick={() => setForm((p) => ({ ...p, fromDate: dateStr, toDate: dateStr }))}
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

  const firstDetail = (r: AttendanceRequestModel): RequestDetail | undefined => r.responseDetails?.[0];
  // A request holds one detail per day; its dates run from the earliest to the latest of them
  const rangeOf = (r: AttendanceRequestModel) => {
    const list = r.responseDetails || [];
    const from = list.map((d) => d.fromDate).filter(Boolean).sort()[0];
    const to = list.map((d) => d.toDate || d.fromDate).filter(Boolean).sort().slice(-1)[0];
    return { from, to, count: list.length };
  };
  const rangeText = (r: AttendanceRequestModel) => {
    const { from, to, count } = rangeOf(r);
    return `${formatDateDisplay(from)}${to && to !== from ? ` to ${formatDateDisplay(to)}` : ''}${count > 1 ? ` (${count} days)` : ''}`;
  };
  const clock = (value?: string | null) => timeOf(value) || '—';

  const columns: ColumnDef<AttendanceRequestModel>[] = [
    {
      key: 'id',
      label: 'Req ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-transparent px-2 py-0.5 rounded border border-cyan-200 dark:border-transparent">
          #{row.id}
        </span>
      )
    },
    {
      key: 'requestType',
      label: 'Request Type',
      sortValueGetter: (row) => firstDetail(row)?.requestType || '',
      sortable: true,
      render: (row) => (
        <span className="font-bold text-xs text-slate-800 dark:text-white">
          {TYPE_LABEL[firstDetail(row)?.requestType || ''] || firstDetail(row)?.requestType}
        </span>
      )
    },
    {
      key: 'dates',
      label: 'Dates',
      sortable: true,
      sortValueGetter: (row) => rangeOf(row).from || '',
      render: (row) => (
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-gray-300">{rangeText(row)}</span>
      )
    },
    {
      key: 'overallStatus',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const status = (row.overallStatus || 'PENDING').toUpperCase();
        return (
          <span title={row.approverRemarks || undefined} className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${statusClass(status)}`}>
            {status.replace(/_/g, ' ')}
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
            onClick={() => setViewingRequest(row)}
            className="p-1.5 bg-gray-50 dark:bg-[#222222] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] border border-gray-200 dark:!border-transparent rounded-lg text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
            title={t("View request")}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {row.overallStatus === 'PENDING' && (
            <button
              type="button"
              onClick={() => handleCancelRequest(row)}
              className="p-1.5 bg-rose-50 dark:bg-[#222222] hover:bg-rose-100 dark:hover:bg-[#2a2a2a] border border-rose-200 dark:!border-transparent rounded-lg text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              title={t("Withdraw request")}
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const inputClass = "w-full h-8 px-2.5 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-xl focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 transition-all outline-none text-xs text-slate-800 dark:text-white";

  return (
    <>
      <PageMeta title={t("On Duty & Work From Home Requests")} description="Request on-duty visits and work-from-home days" />
      <PageBreadcrumb
        pageTitle="On Duty Requests"
        actions={
          <button type="button" onClick={() => setActiveTab(activeTab === 'history' ? 'apply' : 'history')} className={TOOL_BUTTON}>
            <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            {activeTab === 'history' ? t('Back to Apply') : `${t("Request History")} (${requests.length})`}
          </button>
        }
      />

      <div className="max-w-6xl mx-auto pb-2 animate-in fade-in duration-200">

        {activeTab === 'apply' && (
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
            {(['details', 'review'] as const).map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                <button
                  type="button"
                  disabled={s === 'review' && reviewDays.length === 0}
                  onClick={() => setStep(s)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    step === s ? 'bg-[#e0f7fa] text-[#006f7a]' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className={`grid h-4.5 w-4.5 place-items-center rounded-full text-[10px] ${step === s ? 'bg-[#0097a7] text-white' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
                  {s === 'details' ? 'Request details' : 'Review days & times'}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {activeTab === 'apply' && step === 'review' && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-transparent dark:bg-[#191919]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {TYPE_LABEL[form.requestType]} · {formatDateDisplay(form.fromDate)}{form.toDate !== form.fromDate ? ` to ${formatDateDisplay(form.toDate)}` : ''}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">
                  {t("Check each day and change the shift or working times if needed. Weekly offs and holidays are highlighted and left out unless you tick them.")}
                </p>
              </div>
              <span className="rounded-lg bg-[#e0f7fa] px-2.5 py-1 text-xs font-bold text-[#006f7a]">
                {includedDays.length} of {reviewDays.length} {reviewDays.length === 1 ? 'day' : 'days'} included
              </span>
            </div>

            <div className="max-h-[calc(100cqh-230px)] overflow-auto rounded-lg border border-slate-200 dark:border-[#2a2a2a]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-[1] bg-[#e8f3dc] text-left text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-gray-800/70 dark:text-gray-200">
                  <tr>
                    <th className="w-10 px-2 py-2 text-center">{t("Include")}</th>
                    <th className="px-2 py-2">{t("Date")}</th>
                    <th className="px-2 py-2">{t("Day type")}</th>
                    <th className="px-2 py-2">{t("Shift in")}</th>
                    <th className="px-2 py-2">{t("Shift out")}</th>
                    <th className="px-2 py-2">{form.requestType === 'ON_DUTY' ? 'On duty from' : 'Work from'}</th>
                    <th className="px-2 py-2">{form.requestType === 'ON_DUTY' ? 'On duty to' : 'Work to'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                  {reviewDays.map((d) => {
                    const weekday = WEEKDAY[new Date(`${d.date}T00:00:00`).getDay()];
                    const holiday = d.off && d.off !== 'Weekly off';
                    const time = (field: 'shiftIn' | 'shiftOut' | 'workFrom' | 'workTo') => (
                      <input
                        type="time"
                        value={d[field]}
                        disabled={!d.include}
                        onChange={(e) => updateDay(d.date, { [field]: e.target.value })}
                        className="h-8 w-[110px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-400 dark:border-gray-700 dark:bg-[#222222] dark:text-white"
                      />
                    );
                    return (
                      <tr key={d.date} className={holiday ? 'bg-orange-50/80 dark:bg-orange-950/20' : d.off ? 'bg-slate-100/80 dark:bg-[#222222]' : ''}>
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={d.include} onChange={(e) => updateDay(d.date, { include: e.target.checked })} aria-label={`Include ${d.date}`} className="h-4 w-4 accent-[#0097a7]" />
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-slate-800 dark:text-gray-100">
                          {formatDateDisplay(d.date)} <span className="font-normal text-slate-500">{weekday}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          {d.off ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${holiday ? 'border-orange-200 bg-orange-100 text-orange-800' : 'border-slate-300 bg-slate-200 text-slate-700'}`}>
                              {holiday ? `Holiday · ${d.off}` : t('Weekly off')}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("Working day")}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">{time('shiftIn')}</td>
                        <td className="px-2 py-1.5">{time('shiftOut')}</td>
                        <td className="px-2 py-1.5">{time('workFrom')}</td>
                        <td className="px-2 py-1.5">{time('workTo')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-[#2a2a2a]">
              <button type="button" onClick={() => setStep('details')} className={TOOL_BUTTON}>
                <ChevronLeft className="h-3.5 w-3.5" /> {t("Back to details")}
              </button>
              <button type="button" onClick={handleConfirm} disabled={isSubmitting || includedDays.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50">
                <Send className="h-3.5 w-3.5" />
                {isSubmitting ? t('Submitting...') : `Confirm & submit (${includedDays.length} ${includedDays.length === 1 ? 'day' : 'days'})`}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'apply' && step === 'details' && (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch mb-2">

              <div className="lg:col-span-5 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-3 sm:p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2 border-b border-slate-100 dark:!border-transparent pb-2">
                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#222222] px-1.5 py-0.5 rounded-xl border border-slate-200/80 dark:!border-transparent shadow-2xs">
                      <button type="button" onClick={handlePrevMonth} className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer">
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-extrabold text-slate-800 dark:text-white uppercase tracking-wider min-w-[110px] text-center">
                        {monthNames[currentMonth]} {currentYear}
                      </span>
                      <button type="button" onClick={handleNextMonth} className="p-1 hover:bg-white dark:hover:bg-[#2a2a2a] rounded-md text-slate-600 dark:text-gray-300 transition cursor-pointer">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500">{t("Pick Date Range")}</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase mb-1.5">
                    {weekdayLabels("min").map((d) => <span key={d}>{d}</span>)}
                  </div>

                  <div className="grid grid-cols-7 gap-1 max-w-xs mx-auto lg:max-w-none">
                    {renderCalendar()}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 dark:!border-transparent text-[10px] text-slate-400 dark:text-gray-500">
                  {t("Struck-out days are weekly offs or holidays and are not marked. Double click a date to select just that day.")}
                </div>
              </div>

              <div className="lg:col-span-7 bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-3 sm:p-3.5 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-7">
                      <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("Request Type *")}</label>
                      <select
                        value={form.requestType}
                        onChange={(e) => setForm((p) => ({ ...p, requestType: e.target.value as RequestType }))}
                        className={`${inputClass} font-semibold cursor-pointer`}
                        required
                      >
                        <option value="ON_DUTY" className="dark:bg-[#222222]">{t("On duty visit")}</option>
                        <option value="WORK_FROM_HOME" className="dark:bg-[#222222]">{t("Work from home")}</option>
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <div className="h-8 px-2.5 bg-slate-50/80 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent flex items-center justify-between">
                        <span className="text-[10.5px] text-slate-500 dark:text-gray-400 font-medium truncate">{t("Working days")}</span>
                        <span className="px-2 py-0.5 bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:!border-transparent rounded-md text-[10px] font-bold font-mono shadow-2xs shrink-0">
                          {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("From Date *")}</label>
                      <input type="date" value={form.fromDate} onChange={(e) => setForm((p) => ({ ...p, fromDate: e.target.value }))}
                        className={`${inputClass} font-mono cursor-pointer`} required />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("To Date *")}</label>
                      <input type="date" value={form.toDate} min={form.fromDate} onChange={(e) => setForm((p) => ({ ...p, toDate: e.target.value }))}
                        className={`${inputClass} font-mono cursor-pointer`} required />
                    </div>
                  </div>

                  {form.requestType === "ON_DUTY" ? (
                    <div className="p-2 bg-slate-50/50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-gray-400 mb-0.5 truncate">{t("Client Name")}</label>
                          <input type="text" value={form.clientName} maxLength={200} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                            className="w-full h-7.5 px-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500" placeholder={t("e.g. Acme Corp")} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-gray-400 mb-0.5 truncate">{t("Visit Location")}</label>
                          <input type="text" value={form.visitLocation} maxLength={200} onChange={(e) => setForm((p) => ({ ...p, visitLocation: e.target.value }))}
                            className="w-full h-7.5 px-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500" placeholder={t("e.g. Pune office")} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-gray-400 mb-0.5 truncate">{t("Visit Purpose")}</label>
                          <input type="text" value={form.purpose} maxLength={500} onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                            className="w-full h-7.5 px-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-cyan-500" placeholder={t("e.g. Product demo")} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("Task ID")}</label>
                        <input type="number" min={1} value={form.projectTaskId} onChange={(e) => setForm((p) => ({ ...p, projectTaskId: e.target.value }))}
                          className={`${inputClass} font-mono`} placeholder={t("Optional")} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("Work / project (optional)")}</label>
                        <input type="text" value={form.projectTaskName} maxLength={200} onChange={(e) => setForm((p) => ({ ...p, projectTaskName: e.target.value }))}
                          className={inputClass} placeholder={t("What you will work on")} />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("Reason *")}</label>
                    <input type="text" value={form.reason} maxLength={1000} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                      className={inputClass} placeholder={t("Why you need this")} required />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-1">{t("Remarks (optional)")}</label>
                    <input type="text" value={form.remarks} maxLength={1000} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                      className={inputClass} placeholder={t("Anything else the approver should know")} />
                  </div>

                  <p className="text-[10.5px] text-slate-400 dark:text-gray-500">
                    {t("Forgot to punch? Use")} <Link to="/att_timesheetManagement" className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">{t("Attendance Regularization")}</Link> {t("instead.")}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:!border-transparent shrink-0 mt-1.5">
                  <button type="button" onClick={() => { setForm(emptyForm()); setReviewDays([]); }}
                    className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer">
                    {t("Clear Form")}
                  </button>
                  <button type="submit" disabled={!form.fromDate || !form.toDate || form.toDate < form.fromDate}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50">
                    <ChevronRight className="w-3.5 h-3.5" />
                    {t("Review days & times")}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {activeTab === 'history' && (
          <div className="bg-white dark:bg-[#191919] rounded-2xl shadow-2xs border border-slate-200/80 dark:!border-transparent p-4 sm:p-5 animate-in fade-in duration-150 overflow-x-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{t("My Requests")}</h3>
              <TableToolbar onRefresh={() => fetchMyRequests()} />
            </div>
            <ReusableTable
              data={requests}
              columns={columns}
              loading={loading}
              pageSize={10}
              defaultSortKey="id"
              defaultSortOrder="desc"
            />
          </div>
        )}

      </div>

      {viewingRequest && (() => {
        const detail = firstDetail(viewingRequest) || ({} as RequestDetail);
        const status = (viewingRequest.overallStatus || 'PENDING').toUpperCase();
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#191919] text-slate-900 dark:text-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-slate-200 dark:!border-transparent space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:!border-transparent">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-cyan-50 dark:bg-[#222222] text-cyan-700 dark:text-cyan-300 rounded-xl border border-cyan-200 dark:!border-transparent shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{t("Request #")}{viewingRequest.id}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${statusClass(status)}`}>
                        {status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">{viewingRequest.employeeName}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setViewingRequest(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg shrink-0 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent">
                  <span className="text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1 text-[11px] mb-1">
                    <Tag className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> {t("Request Type")}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-white">{TYPE_LABEL[detail.requestType] || detail.requestType}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent">
                  <span className="text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1 text-[11px] mb-1">
                    <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> {t("Dates")}
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">{rangeText(viewingRequest)}</span>
                </div>

                {(viewingRequest.responseDetails || []).some((d: any) => d.shiftInTime || d.checkInTime) && (
                  <div className="col-span-1 sm:col-span-2 overflow-hidden rounded-xl border border-slate-200/80 dark:!border-transparent">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-50 text-left font-semibold text-slate-600 dark:bg-[#222222] dark:text-gray-300">
                        <tr><th className="px-2 py-1.5">{t("Date")}</th><th className="px-2 py-1.5">{t("Shift")}</th><th className="px-2 py-1.5">{t("Working")}</th><th className="px-2 py-1.5">{t("Status")}</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                        {[...(viewingRequest.responseDetails || [])].sort((a, b) => a.fromDate.localeCompare(b.fromDate)).map((d: any) => (
                          <tr key={d.id ?? d.fromDate}>
                            <td className="px-2 py-1.5 font-mono">{formatDateDisplay(d.fromDate)}</td>
                            <td className="px-2 py-1.5 font-mono">{clock(d.shiftInTime)} – {clock(d.shiftOutTime)}</td>
                            <td className="px-2 py-1.5 font-mono">{clock(d.checkInTime)} – {clock(d.checkOutTime)}</td>
                            <td className="px-2 py-1.5">{String(d.approvalStatus || 'PENDING').replace(/_/g, ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {detail.projectTaskName && (
                  <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent col-span-1 sm:col-span-2">
                    <span className="text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <Briefcase className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> {t("Work / project")}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-white">
                      {detail.projectTaskId ? <span className="font-mono text-slate-500 dark:text-gray-400 mr-1.5">#{detail.projectTaskId}</span> : null}
                      {detail.projectTaskName}
                    </span>
                  </div>
                )}

                {(detail.clientName || detail.visitLocation || detail.purpose) && (
                  <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent col-span-1 sm:col-span-2 space-y-1">
                    <span className="text-slate-500 dark:text-gray-400 font-semibold flex items-center gap-1 text-[11px] mb-1">
                      <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> {t("Visit")}
                    </span>
                    {detail.clientName && <p className="text-slate-800 dark:text-white font-semibold text-[11px]">{t("Client:")} <span className="font-bold">{detail.clientName}</span></p>}
                    {detail.visitLocation && <p className="text-slate-800 dark:text-white font-semibold text-[11px]">{t("Location:")} <span className="font-bold">{detail.visitLocation}</span></p>}
                    {detail.purpose && <p className="text-slate-800 dark:text-white font-semibold text-[11px]">{t("Purpose:")} <span className="font-normal text-slate-700 dark:text-gray-300">{detail.purpose}</span></p>}
                  </div>
                )}

                <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent col-span-1 sm:col-span-2">
                  <span className="text-slate-500 dark:text-gray-400 font-semibold block text-[11px] mb-1">{t("Reason")}</span>
                  <p className="font-semibold text-slate-800 dark:text-white leading-relaxed text-xs">{detail.reason || '—'}</p>
                </div>

                {detail.remarks && (
                  <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent col-span-1 sm:col-span-2">
                    <span className="text-slate-500 dark:text-gray-400 font-semibold block text-[11px] mb-1">{t("Remarks")}</span>
                    <p className="text-slate-800 dark:text-white leading-relaxed text-xs">{detail.remarks}</p>
                  </div>
                )}

                {viewingRequest.approverRemarks && (
                  <div className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent col-span-1 sm:col-span-2">
                    <span className="text-slate-500 dark:text-gray-400 font-semibold block text-[11px] mb-1">{t("Approver's remarks")}</span>
                    <p className="text-slate-800 dark:text-white text-xs">{viewingRequest.approverRemarks}</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:!border-transparent flex items-center justify-end">
                <button type="button" onClick={() => setViewingRequest(null)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 dark:bg-[#222222] hover:bg-slate-200 dark:hover:bg-[#2a2a2a] text-slate-700 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors text-center cursor-pointer">
                  {t("Close")}
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
