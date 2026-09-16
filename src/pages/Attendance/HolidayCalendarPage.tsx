import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  CalendarDays, Plus, Trash2, Eye, Edit, RotateCw, X, Calendar, Copy, Download, Sparkles, Filter, CheckCircle2, XCircle, FileSpreadsheet, Layers
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Base relative API endpoints (routing via Vite dev proxy)
const BASE_CALENDAR_URL = '/v1/api/attendance/holiday-calendars';

// Interfaces based strictly on provided Backend API Specification
export interface HolidayItem {
  id?: number;
  holidayCalendarId?: number;
  holidayDate: string;
  holidayName: string;
  holidayType: string; // e.g. "NATIONAL", "STATE", "FESTIVAL"
  description?: string;
  optionalHoliday?: boolean;
  active?: boolean;
}

export interface HolidayCalendarModel {
  id?: number;
  calendarCode: string;
  calendarName: string;
  description?: string;
  calendarYear: number;
  active?: boolean;
  holidays?: HolidayItem[];
  totalHolidays?: number;
}

const HolidayCalendarPage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [calendars, setCalendars] = useState<HolidayCalendarModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filters
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [editingCalendar, setEditingCalendar] = useState<HolidayCalendarModel | null>(null);
  
  const [isHolidayManageModalOpen, setIsHolidayManageModalOpen] = useState<boolean>(false);
  const [activeCalendarForHolidays, setActiveCalendarForHolidays] = useState<HolidayCalendarModel | null>(null);
  
  const [viewingCalendarDetails, setViewingCalendarDetails] = useState<HolidayCalendarModel | null>(null);
  const [inspectedHolidays, setInspectedHolidays] = useState<HolidayItem[]>([]);

  // Calendar Master Form State
  const [calendarForm, setCalendarForm] = useState<{
    calendarCode: string;
    calendarName: string;
    description: string;
    calendarYear: number;
    active: boolean;
  }>({
    calendarCode: '',
    calendarName: '',
    description: '',
    calendarYear: new Date().getFullYear(),
    active: true
  });

  // Child Holidays List Form State
  const [holidaysList, setHolidaysList] = useState<HolidayItem[]>([]);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [validateDuplicates, setValidateDuplicates] = useState<boolean>(true);

  // ── API 1: GET ALL CALENDARS ─────────────────────────────────────────────
  // Endpoint: GET /v1/api/attendance/holiday-calendars
  const fetchCalendars = async () => {
    setLoading(true);
    try {
      const res = await axios.get(BASE_CALENDAR_URL);
      if (Array.isArray(res.data)) {
        setCalendars(res.data);
      } else {
        setCalendars([]);
      }
    } catch (err: any) {
      console.error("Failed to load holiday calendars:", err);
      handleApiError(err, "Failed to load holiday calendars.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, []);

  // Filtered Calendars List
  const filteredCalendars = useMemo(() => {
    return calendars.filter(cal => {
      const matchesYear = yearFilter === 'ALL' || String(cal.calendarYear) === yearFilter;
      const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? cal.active !== false : cal.active === false);
      return matchesYear && matchesStatus;
    });
  }, [calendars, yearFilter, statusFilter]);

  // Available Years for filter pills
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    calendars.forEach(c => { if (c.calendarYear) years.add(String(c.calendarYear)); });
    years.add('2026');
    years.add('2027');
    return Array.from(years).sort().reverse();
  }, [calendars]);

  // ── API Error Handler Helper ────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    if (backendMsg) {
      ToasterService.error(String(backendMsg));
    } else {
      ToasterService.error(defaultMsg);
    }
  };

  // ── Toggle Calendar Active / Inactive State ─────────────────────────────
  const handleToggleCalendarActive = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    const newStatus = !(cal.active !== false);
    try {
      await axios.put(`${BASE_CALENDAR_URL}/${cal.id}`, {
        ...cal,
        active: newStatus
      });
      ToasterService.success(`Calendar '${cal.calendarCode}' set to ${newStatus ? 'Active' : 'Inactive'}!`);
      setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, active: newStatus } : c));
    } catch (err: any) {
      handleApiError(err, "Failed to update calendar status.");
    }
  };

  // ── One-Click Duplicate Calendar for Next Year ────────────────────────────
  const handleDuplicateCalendar = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    const nextYear = (cal.calendarYear || 2026) + 1;
    const codeBase = cal.calendarCode.includes('_') ? cal.calendarCode.substring(0, cal.calendarCode.lastIndexOf('_')) : cal.calendarCode;
    const newCode = `${codeBase}_${nextYear}`;

    try {
      setIsSubmitting(true);
      // 1. Fetch child holidays of existing calendar
      let childHolidays: HolidayItem[] = [];
      try {
        const holRes = await axios.get(`${BASE_CALENDAR_URL}/${cal.id}/holidays`);
        if (Array.isArray(holRes.data)) childHolidays = holRes.data;
      } catch (e) {}

      // 2. Create new calendar for next year
      const createPayload = {
        calendarCode: newCode,
        calendarName: `${cal.calendarName.replace(String(cal.calendarYear), '')} ${nextYear}`.trim(),
        description: cal.description || "Holidays",
        calendarYear: nextYear,
        active: true
      };

      const res = await axios.post(BASE_CALENDAR_URL, createPayload);
      const newCal = res.data;

      // 3. Post holidays for new calendar if available
      if (newCal?.id && childHolidays.length > 0) {
        const clonedHolidays = childHolidays.map(h => {
          const origDate = new Date(h.holidayDate);
          const newDateStr = !isNaN(origDate.getTime()) 
            ? `${nextYear}-${String(origDate.getMonth() + 1).padStart(2, '0')}-${String(origDate.getDate()).padStart(2, '0')}`
            : `${nextYear}-01-01`;
          return {
            holidayCalendarId: newCal.id,
            holidayDate: newDateStr,
            holidayName: h.holidayName,
            holidayType: h.holidayType || "NATIONAL",
            optionalHoliday: Boolean(h.optionalHoliday),
            description: h.description || "Holiday",
            active: true
          };
        });

        await axios.post(`${BASE_CALENDAR_URL}/${newCal.id}/holidays`, {
          replaceExisting: true,
          validateDuplicates: false,
          holidays: clonedHolidays
        });
      }

      ToasterService.success(`Calendar duplicated for ${nextYear} as '${newCode}'!`);
      fetchCalendars();
    } catch (err: any) {
      handleApiError(err, "Failed to duplicate calendar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Export Noticeboard CSV File ──────────────────────────────────────────
  const handleExportCSV = () => {
    if (calendars.length === 0) return ToasterService.error("No holiday calendars available to export.");
    
    let csv = "Calendar Code,Calendar Name,Year,Status,Description\n";
    calendars.forEach(c => {
      csv += `"${c.calendarCode}","${c.calendarName}",${c.calendarYear},"${c.active !== false ? 'Active' : 'Inactive'}","${c.description || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Holiday_Calendars_Noticeboard_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ToasterService.success("Holiday Noticeboard exported to CSV!");
  };

  // ── API 2 & 3: CREATE / UPDATE CALENDAR MASTER ──────────────────────────
  const handleCalendarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!calendarForm.calendarCode.trim() || !calendarForm.calendarName.trim()) {
      ToasterService.error("Calendar Code and Name are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCalendar?.id) {
        const updatePayload = {
          id: editingCalendar.id,
          calendarCode: calendarForm.calendarCode.trim(),
          calendarName: calendarForm.calendarName.trim(),
          description: calendarForm.description || "Holidays",
          calendarYear: Number(calendarForm.calendarYear) || 2026,
          active: Boolean(calendarForm.active)
        };

        await axios.put(`${BASE_CALENDAR_URL}/${editingCalendar.id}`, updatePayload);
        ToasterService.success("Holiday Calendar updated successfully!");
      } else {
        const createPayload = {
          calendarCode: calendarForm.calendarCode.trim(),
          calendarName: calendarForm.calendarName.trim(),
          description: calendarForm.description || "Holidays",
          calendarYear: Number(calendarForm.calendarYear) || 2026,
          active: Boolean(calendarForm.active)
        };

        await axios.post(BASE_CALENDAR_URL, createPayload);
        ToasterService.success("Holiday Calendar created successfully!");
      }

      setIsCalendarModalOpen(false);
      resetCalendarForm();
      fetchCalendars();
    } catch (err: any) {
      handleApiError(err, "Failed to save holiday calendar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── API 4: GET BY CALENDAR ID & INSPECT HOLIDAYS ─────────────────────────
  const handleInspectCalendar = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    setViewingCalendarDetails(cal);
    setInspectedHolidays([]);

    try {
      const res = await axios.get(`${BASE_CALENDAR_URL}/${cal.id}/holidays`);
      if (Array.isArray(res.data)) {
        setInspectedHolidays(res.data);
      }
    } catch (err: any) {
      setInspectedHolidays(cal.holidays || []);
    }
  };

  // ── Auto-load holidays helper ──────────────────────────────────────────
  const loadHolidaysForSelectedCalendar = async (calId: number) => {
    const cal = calendars.find(c => c.id === calId);
    if (cal) setActiveCalendarForHolidays(cal);

    try {
      const res = await axios.get(`${BASE_CALENDAR_URL}/${calId}/holidays`);
      if (Array.isArray(res.data)) {
        setHolidaysList(res.data);
      } else {
        setHolidaysList(cal?.holidays || []);
      }
    } catch (e) {
      setHolidaysList(cal?.holidays || []);
    }
  };

  // ── API 5: GET ALL HOLIDAYS BY CALENDAR ID ──────────────────────────────
  const openManageHolidaysModal = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    setActiveCalendarForHolidays(cal);
    setLoading(true);
    setReplaceExisting(true);

    try {
      const res = await axios.get(`${BASE_CALENDAR_URL}/${cal.id}/holidays`);
      if (Array.isArray(res.data)) {
        setHolidaysList(res.data);
      } else {
        setHolidaysList([]);
      }
    } catch (err: any) {
      console.warn("Failed to load holidays for calendar:", err);
      setHolidaysList(cal.holidays || []);
    } finally {
      setLoading(false);
      setIsHolidayManageModalOpen(true);
    }
  };

  // ── API 6: BULK HOLIDAYS CREATE ─────────────────────────────────────────
  const handleBulkCreateHolidays = async () => {
    if (!activeCalendarForHolidays?.id) return;

    const validHolidays = holidaysList.filter(h => h.holidayName.trim() && h.holidayDate);
    if (validHolidays.length === 0) {
      ToasterService.error("Please add at least one valid holiday date and name.");
      return;
    }

    setIsSubmitting(true);
    try {
      const existingItems = validHolidays.filter(h => h.id);
      const newItems = validHolidays.filter(h => !h.id);

      for (const hItem of existingItems) {
        try {
          const putPayload = {
            id: hItem.id,
            holidayCalendarId: activeCalendarForHolidays.id,
            holidayDate: hItem.holidayDate,
            holidayName: hItem.holidayName.trim(),
            holidayType: hItem.holidayType || "NATIONAL",
            description: hItem.description || "Holiday for celebration",
            optionalHoliday: Boolean(hItem.optionalHoliday),
            active: hItem.active !== false
          };
          await axios.put(
            `${BASE_CALENDAR_URL}/${activeCalendarForHolidays.id}/holidays/${hItem.id}`,
            putPayload
          );
        } catch (putErr: any) {
          console.warn(`Failed to PUT update holiday ${hItem.id}:`, putErr);
        }
      }

      if (newItems.length > 0) {
        const bulkPayload = {
          replaceExisting: Boolean(replaceExisting),
          validateDuplicates: false,
          holidays: newItems.map(h => ({
            holidayCalendarId: activeCalendarForHolidays.id,
            holidayDate: h.holidayDate,
            holidayName: h.holidayName.trim(),
            holidayType: h.holidayType || "NATIONAL",
            optionalHoliday: Boolean(h.optionalHoliday),
            description: h.description || "N/A",
            active: h.active !== false
          }))
        };

        await axios.post(`${BASE_CALENDAR_URL}/${activeCalendarForHolidays.id}/holidays`, bulkPayload);
      }

      ToasterService.success("Holidays saved successfully!");
      setIsHolidayManageModalOpen(false);
      fetchCalendars();
    } catch (err: any) {
      handleApiError(err, "Failed to save holidays.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Single Holiday Item
  const handleDeleteSingleHoliday = async (idx: number, hItem: HolidayItem) => {
    if (activeCalendarForHolidays?.id && hItem.id) {
      try {
        await axios.delete(`${BASE_CALENDAR_URL}/${activeCalendarForHolidays.id}/holidays/${hItem.id}`);
        ToasterService.success("Holiday removed from backend!");
      } catch (e) {
        console.warn("Single holiday delete endpoint not available, will sync on save:", e);
      }
    }
    removeHolidayRow(idx);
  };

  // ── API 8: DELETE CALENDAR ──────────────────────────────────────────────
  const handleDeleteCalendar = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    try {
      await axios.delete(`${BASE_CALENDAR_URL}/${cal.id}`);
      ToasterService.success(`Calendar '${cal.calendarCode}' deleted successfully!`);
      fetchCalendars();
    } catch (err: any) {
      handleApiError(err, "Failed to delete calendar. Make sure child holidays are removed first.");
    }
  };

  // ── Form Helpers ───────────────────────────────────────────────────────
  const openCreateCalendarModal = () => {
    setEditingCalendar(null);
    setCalendarForm({
      calendarCode: '',
      calendarName: '',
      description: '',
      calendarYear: new Date().getFullYear(),
      active: true
    });
    setIsCalendarModalOpen(true);
  };

  const openEditCalendarModal = (cal: HolidayCalendarModel) => {
    setEditingCalendar(cal);
    setCalendarForm({
      calendarCode: cal.calendarCode,
      calendarName: cal.calendarName,
      description: cal.description || '',
      calendarYear: cal.calendarYear,
      active: cal.active !== false
    });
    setIsCalendarModalOpen(true);
  };

  const resetCalendarForm = () => {
    setCalendarForm({
      calendarCode: '',
      calendarName: '',
      description: '',
      calendarYear: new Date().getFullYear(),
      active: true
    });
    setEditingCalendar(null);
  };

  const addHolidayRow = () => {
    setHolidaysList(prev => [
      ...prev,
      {
        holidayDate: selectedDateStr || '2026-08-27',
        holidayName: '',
        holidayType: 'NATIONAL',
        optionalHoliday: false,
        description: 'N/A',
        active: true
      }
    ]);
  };

  const removeHolidayRow = (idx: number) => {
    setHolidaysList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleHolidayFieldChange = (idx: number, field: keyof HolidayItem, value: any) => {
    setHolidaysList(prev => {
      const updated = [...prev];
      (updated[idx] as any)[field] = value;
      return updated;
    });
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<HolidayCalendarModel>[] = [
    {
      key: 'calendarCode',
      label: 'Calendar Code',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50/80 px-2.5 py-1 rounded border border-cyan-200/70 whitespace-nowrap">
          {row.calendarCode}
        </span>
      )
    },
    {
      key: 'calendarName',
      label: 'Calendar Name',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 block">{row.calendarName}</span>
          <span className="text-[10px] text-gray-400 font-mono">Year: {row.calendarYear}</span>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => (
        <span className="text-xs text-gray-600 truncate max-w-xs block">
          {row.description || 'Holidays'}
        </span>
      )
    },
    {
      key: 'active',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => handleToggleCalendarActive(row)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all shadow-2xs ${
            row.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
          }`}
          title="Click to toggle Active / Inactive"
        >
          {row.active !== false ? 'Active' : 'Inactive'}
        </button>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <button
            type="button"
            onClick={() => handleInspectCalendar(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Inspect Calendar & Holiday List"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openManageHolidaysModal(row)}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-indigo-700 transition-colors"
            title="Manage Holidays List"
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDuplicateCalendar(row)}
            className="p-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-amber-700 transition-colors"
            title="Duplicate Calendar for Next Year"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditCalendarModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg text-cyan-700 transition-colors"
            title="Edit Calendar Master"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCalendar(row)}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-600 transition-colors"
            title="Delete Calendar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  // Selected Date & Mini Calendar Month State
  const [miniCalendarDate, setMiniCalendarDate] = useState<Date>(new Date(2026, 7, 1)); // August 2026
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-08-27');
  const [selectedCalendarCodeId, setSelectedCalendarCodeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'manager' | 'table'>('manager');

  // User Profile
  const currentUser = useMemo(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        return {
          name: parsed.fullName || parsed.name || parsed.username || "Roy Hamlin",
          role: parsed.role || parsed.roles?.[0] || "SUPER_ADMIN",
          email: parsed.email || parsed.username || "roy.hamlin@mytrading.com",
          code: parsed.employeeCode || "#ADM-EMP-0067"
        };
      } catch (e) {}
    }
    return { name: "Roy Hamlin", role: "SUPER_ADMIN", email: "roy.hamlin@mytrading.com", code: "#ADM-EMP-0067" };
  }, []);

  // Sync selectedCalendarCodeId when calendars load & auto-fetch holidays
  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendarCodeId) {
      const firstId = calendars[0].id || null;
      setSelectedCalendarCodeId(firstId);
      if (firstId) loadHolidaysForSelectedCalendar(firstId);
    }
  }, [calendars]);

  // Selected calendar details for manager tab
  const activeSelectedCalendar = useMemo(() => {
    return calendars.find(c => c.id === selectedCalendarCodeId) || calendars[0] || null;
  }, [calendars, selectedCalendarCodeId]);

  // Mini Calendar Month Navigation
  const handlePrevMonth = () => {
    setMiniCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setMiniCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Render Mini Calendar Cells
  const renderMiniCalendar = () => {
    const year = miniCalendarDate.getFullYear();
    const month = miniCalendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells = [];

    // Prev Month Padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push(
        <div key={`prev-${i}`} className="flex items-center justify-center py-1">
          <span className="text-[10px] text-gray-300 font-mono">{prevMonthDays - i}</span>
        </div>
      );
    }

    // Current Month Days
    const todayStr = '2026-08-27';
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDateStr;

      // Check if day has holidays
      const dayHolidays = holidaysList.filter(h => h.holidayDate === dateStr);
      const hasNational = dayHolidays.some(h => (h.holidayType || '').toUpperCase() === 'NATIONAL');
      const hasFestival = dayHolidays.some(h => (h.holidayType || '').toUpperCase() === 'FESTIVAL');

      cells.push(
        <div key={`curr-${day}`} className="flex flex-col items-center justify-center py-1 relative">
          <button
            type="button"
            onClick={() => setSelectedDateStr(dateStr)}
            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center relative ${
              isSelected
                ? 'bg-cyan-600 text-white shadow-xs'
                : isToday
                ? 'bg-cyan-50 text-cyan-800 border border-cyan-300 font-extrabold'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {day}
            {(hasNational || hasFestival) && !isSelected && (
              <span className={`w-1.5 h-1.5 rounded-full absolute bottom-0.5 ${hasNational ? 'bg-rose-500' : 'bg-amber-500'}`} />
            )}
          </button>
        </div>
      );
    }

    // Next Month Fill
    const totalCells = Math.ceil((daysInMonth + firstDayIndex) / 7) * 7;
    for (let i = 1; i <= totalCells - (daysInMonth + firstDayIndex); i++) {
      cells.push(
        <div key={`next-${i}`} className="flex items-center justify-center py-1">
          <span className="text-[10px] text-gray-300 font-mono">{i}</span>
        </div>
      );
    }

    return cells;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <>
      <PageMeta
        title="Holiday Calendar Master"
        description="Configure company and regional holiday schedules"
      />
      <PageBreadcrumb pageTitle="Holiday Calendar Master" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-3 px-2 sm:px-4">
        
        {/* User Profile Banner matching Leave Request UI */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900">{currentUser.name}</h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 uppercase">
                  {currentUser.role.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-gray-500">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'table' ? 'manager' : 'table')}
              className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-lg border border-cyan-200 text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{activeTab === 'table' ? 'Split Calendar View' : `Master Records (${calendars.length})`}</span>
              <span className="sm:hidden">{activeTab === 'table' ? 'Calendar View' : `Records (${calendars.length})`}</span>
            </button>
            <button
              type="button"
              onClick={openCreateCalendarModal}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Create Calendar</span>
              <span className="sm:hidden">Create</span>
            </button>
            <div className="text-right hidden sm:block border-l border-gray-200 pl-3 ml-1">
              <span className="text-[9px] text-gray-400 font-medium block">Employee ID</span>
              <span className="text-xs font-mono font-bold text-gray-700">{currentUser.code}</span>
            </div>
          </div>
        </div>

        {/* ── MODE 1: SPLIT CALENDAR & MANAGER VIEW ────────────────────── */}
        {activeTab === 'manager' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            
            {/* LEFT COLUMN: Mini Calendar Widget */}
            <div className="lg:col-span-5 bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3.5 flex flex-col justify-between min-h-[380px]">
              <div>
                {/* Month Header */}
                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                  <button 
                    type="button" 
                    onClick={handlePrevMonth}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors font-bold text-sm"
                  >
                    &lt;
                  </button>
                  <div className="text-center">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      {monthNames[miniCalendarDate.getMonth()]} {miniCalendarDate.getFullYear()}
                    </h3>
                    <span className="text-[10px] text-gray-400 font-mono">Select date to inspect</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleNextMonth}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors font-bold text-sm"
                  >
                    &gt;
                  </button>
                </div>

                {/* Weekday Headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-500 mb-1">
                  <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                </div>

                {/* Days Matrix */}
                <div className="grid grid-cols-7 gap-1 max-w-xs mx-auto lg:max-w-none">
                  {renderMiniCalendar()}
                </div>
              </div>

              {/* Bottom Legend & Selected Date Holiday Inspector */}
              <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-gray-600 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-cyan-600" /> Selected
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> National
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Festival
                  </span>
                </div>

                {/* Selected Date Preview */}
                <div className="bg-cyan-50/70 p-2.5 rounded-lg border border-cyan-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-cyan-800 font-bold uppercase block">Selected Date</span>
                    <span className="text-xs font-mono font-bold text-cyan-900">{selectedDateStr}</span>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-700 bg-white px-2 py-0.5 rounded border border-cyan-200">
                    {holidaysList.filter(h => h.holidayDate === selectedDateStr).length} Holidays
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Quick Holiday Master & Manager */}
            <div className="lg:col-span-7 bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 space-y-4">
              
              {/* Select Calendar Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Holiday Calendar Master *</label>
                <select
                  value={selectedCalendarCodeId || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedCalendarCodeId(id);
                    if (id) loadHolidaysForSelectedCalendar(id);
                  }}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                >
                  {calendars.map(cal => (
                    <option key={cal.id} value={cal.id}>
                      {cal.calendarName} ({cal.calendarCode}) — Year {cal.calendarYear}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Calendar Details Card */}
              {activeSelectedCalendar && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                        {activeSelectedCalendar.calendarCode}
                      </span>
                      <h4 className="text-xs font-bold text-gray-900">{activeSelectedCalendar.calendarName}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => openManageHolidaysModal(activeSelectedCalendar)}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-[11px] font-bold shadow-2xs flex items-center gap-1"
                    >
                      <Edit className="w-3 h-3" /> Edit Holidays
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-500">{activeSelectedCalendar.description || 'Holidays schedule for employees'}</p>
                </div>
              )}

              {/* Holidays List Preview & Quick Add */}
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Holidays Schedule ({holidaysList.length})
                    </h4>
                    {selectedDateStr && (
                      <span className="px-2 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded text-[10px] font-mono font-bold">
                        Selected: {selectedDateStr}
                      </span>
                    )}
                  </div>

                  {holidaysList.length > 0 && (
                    <button
                      type="button"
                      onClick={addHolidayRow}
                      className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Holiday for {selectedDateStr || 'Today'}
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {holidaysList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-500 italic bg-slate-50 rounded-lg border border-dashed border-slate-200 space-y-2">
                      <p>No holidays configured for this calendar on <span className="font-mono font-bold text-cyan-700">{selectedDateStr}</span>.</p>
                      <button
                        type="button"
                        onClick={addHolidayRow}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-bold inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create Holiday on {selectedDateStr}
                      </button>
                    </div>
                  ) : (
                    holidaysList.map((h, idx) => {
                      const isMatchSelected = h.holidayDate === selectedDateStr;

                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            if (h.holidayDate) {
                              setSelectedDateStr(h.holidayDate);
                              const d = new Date(h.holidayDate);
                              if (!isNaN(d.getTime())) setMiniCalendarDate(d);
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                            isMatchSelected 
                              ? 'bg-cyan-50/80 border-cyan-400 ring-2 ring-cyan-400/20 shadow-2xs' 
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100/80'
                          }`}
                        >
                          {/* Row 1: Name + Date */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={h.holidayName}
                              onChange={(e) => handleHolidayFieldChange(idx, 'holidayName', e.target.value)}
                              placeholder="Holiday Name (e.g. Independence Day)"
                              className="flex-1 h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:ring-1 focus:ring-cyan-500 outline-none min-w-0"
                            />
                            <div className="w-36 sm:w-44 h-9 relative flex items-center shrink-0">
                              <input
                                type="date"
                                value={h.holidayDate}
                                onClick={(e) => {
                                  try {
                                    e.currentTarget.showPicker();
                                  } catch {}
                                }}
                                onChange={(e) => {
                                  handleHolidayFieldChange(idx, 'holidayDate', e.target.value);
                                  if (e.target.value) {
                                    setSelectedDateStr(e.target.value);
                                    const d = new Date(e.target.value);
                                    if (!isNaN(d.getTime())) setMiniCalendarDate(d);
                                  }
                                }}
                                className="w-full h-9 pl-3 pr-8 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:ring-1 focus:ring-cyan-500 cursor-pointer outline-none"
                              />
                              <Calendar className="w-4 h-4 text-gray-400 absolute right-2.5 pointer-events-none" />
                            </div>
                          </div>
                          {/* Row 2: Type + Delete */}
                          <div className="flex items-center gap-2">
                            <select
                              value={h.holidayType}
                              onChange={(e) => handleHolidayFieldChange(idx, 'holidayType', e.target.value)}
                              className="flex-1 h-9 pl-2.5 pr-8 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 cursor-pointer outline-none focus:ring-1 focus:ring-cyan-500"
                            >
                              <option value="NATIONAL">NATIONAL</option>
                              <option value="STATE">STATE</option>
                              <option value="FESTIVAL">FESTIVAL</option>
                            </select>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingleHoliday(idx, h);
                              }}
                              className="h-9 w-9 flex items-center justify-center text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-gray-300 hover:border-rose-200 rounded-lg shrink-0 transition-colors shadow-2xs"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {holidaysList.length > 0 && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleBulkCreateHolidays}
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-lg shadow-2xs disabled:opacity-70"
                    >
                      {isSubmitting ? "Saving..." : "Save Holidays Schedule"}
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ── MODE 2: FULL WIDTH MASTER RECORDS TABLE ──────────────────── */}
        {activeTab === 'table' && (
          <div className="space-y-3">
            {/* Year & Status Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-cyan-600" /> Year:
                </span>
                <button
                  type="button"
                  onClick={() => setYearFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    yearFilter === 'ALL' ? 'bg-cyan-600 text-white shadow-2xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All Years
                </button>
                {availableYears.map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setYearFilter(yr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      yearFilter === yr ? 'bg-cyan-600 text-white shadow-2xs' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    FY {yr}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Active Only
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('INACTIVE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    statusFilter === 'INACTIVE' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Inactive
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 hover:bg-cyan-100 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 sm:ml-2"
                >
                  <Download className="w-3.5 h-3.5" /> Export Noticeboard
                </button>
              </div>
            </div>

            {/* Master Table - Full 100% Width */}
            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
              <ReusableTable
                data={filteredCalendars}
                columns={columns}
                loading={loading}
                searchable={true}
                searchPlaceholder="Search by calendar code or calendar name..."
                pageSize={10}
                defaultSortKey="calendarName"
                defaultSortOrder="asc"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL 1: CREATE / EDIT CALENDAR MASTER ───────────────────────── */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-gray-100 space-y-4 my-4 sm:my-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  {editingCalendar ? 'Edit Holiday Calendar' : 'Create Holiday Calendar'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsCalendarModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCalendarSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Calendar Code *</label>
                <input
                  type="text"
                  value={calendarForm.calendarCode}
                  onChange={(e) => setCalendarForm(p => ({ ...p, calendarCode: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold font-mono text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="e.g. IND_Hyd_2026"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Calendar Name *</label>
                <input
                  type="text"
                  value={calendarForm.calendarName}
                  onChange={(e) => setCalendarForm(p => ({ ...p, calendarName: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  placeholder="e.g. IND_TS_HYD_2026_Holday_Calendar"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Calendar Year *</label>
                  <input
                    type="number"
                    value={calendarForm.calendarYear}
                    onChange={(e) => setCalendarForm(p => ({ ...p, calendarYear: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    value={calendarForm.active ? "true" : "false"}
                    onChange={(e) => setCalendarForm(p => ({ ...p, active: e.target.value === "true" }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={calendarForm.description}
                  onChange={(e) => setCalendarForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                  placeholder="Holidays"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                >
                  {isSubmitting ? "Saving..." : "Save Calendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MANAGE HOLIDAYS FOR CALENDAR ─────────────────────────── */}
      {isHolidayManageModalOpen && activeCalendarForHolidays && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-3xl w-full p-4 sm:p-5 shadow-2xl border border-gray-100 space-y-4 my-4 sm:my-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  Manage Holidays: {activeCalendarForHolidays.calendarName}
                </h3>
                <p className="text-[11px] font-mono text-cyan-700">Calendar ID: {activeCalendarForHolidays.id}</p>
              </div>
              <button type="button" onClick={() => setIsHolidayManageModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bulk Options Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded text-cyan-600"
                  />
                  <span className="font-semibold text-slate-700">Replace Existing</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={validateDuplicates}
                    onChange={(e) => setValidateDuplicates(e.target.checked)}
                    className="rounded text-cyan-600"
                  />
                  <span className="font-semibold text-slate-700">Validate Duplicates</span>
                </label>
              </div>

              <button
                type="button"
                onClick={addHolidayRow}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Holiday Row
              </button>
            </div>

            {/* Holidays Editable Rows */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {holidaysList.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">
                  No holidays added yet. Click "+ Add Holiday Row" to begin.
                </div>
              ) : (
                holidaysList.map((h, idx) => (
                  <div key={idx} className="p-2.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    {/* Row 1: Name + Date */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={h.holidayName}
                        onChange={(e) => handleHolidayFieldChange(idx, 'holidayName', e.target.value)}
                        placeholder="Holiday Name (e.g. New Year)"
                        className="flex-1 h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 focus:ring-1 focus:ring-cyan-500 outline-none min-w-0"
                        required
                      />
                      <div className="w-36 sm:w-44 h-9 relative flex items-center shrink-0">
                        <input
                          type="date"
                          value={h.holidayDate}
                          onClick={(e) => {
                            try {
                              e.currentTarget.showPicker();
                            } catch {}
                          }}
                          onChange={(e) => handleHolidayFieldChange(idx, 'holidayDate', e.target.value)}
                          className="w-full h-9 pl-3 pr-8 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                          required
                        />
                        <Calendar className="w-4 h-4 text-gray-400 absolute right-2.5 pointer-events-none" />
                      </div>
                    </div>
                    {/* Row 2: Type + Delete */}
                    <div className="flex items-center gap-2">
                      <select
                        value={h.holidayType}
                        onChange={(e) => handleHolidayFieldChange(idx, 'holidayType', e.target.value)}
                        className="flex-1 h-9 pl-2.5 pr-8 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 cursor-pointer outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="NATIONAL">NATIONAL</option>
                        <option value="STATE">STATE</option>
                        <option value="FESTIVAL">FESTIVAL</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleHoliday(idx, h)}
                        className="h-9 w-9 flex items-center justify-center text-rose-500 hover:text-rose-700 bg-white hover:bg-rose-50 border border-gray-300 hover:border-rose-200 rounded-lg shrink-0 transition-colors shadow-2xs"
                        title="Remove Holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsHolidayManageModalOpen(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkCreateHolidays}
                disabled={isSubmitting}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-70 transition-colors"
              >
                {isSubmitting ? "Saving..." : "Save Holidays"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: VIEW / INSPECT CALENDAR DETAILS ─────────────────────── */}
      {viewingCalendarDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-5 shadow-2xl border border-gray-100 space-y-4 my-4 sm:my-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-cyan-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase">{viewingCalendarDetails.calendarName}</h3>
                  <span className="text-[11px] text-gray-500 font-mono">{viewingCalendarDetails.calendarCode} • FY {viewingCalendarDetails.calendarYear}</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewingCalendarDetails(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div>
                  <span className="text-slate-500 block font-semibold text-[10px] uppercase">Description:</span>
                  <span className="font-bold text-slate-800">{viewingCalendarDetails.description || 'Holidays'}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${viewingCalendarDetails.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  {viewingCalendarDetails.active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Inspected Child Holidays List */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Holidays Included ({inspectedHolidays.length}):
                </span>
                
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {inspectedHolidays.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 italic bg-slate-50 rounded border border-dashed border-slate-200">
                      No holiday items registered for this calendar. Click Manage Holidays to add.
                    </div>
                  ) : (
                    inspectedHolidays.map((h, idx) => {
                      const isNational = (h.holidayType || '').toUpperCase() === 'NATIONAL';
                      const isFestival = (h.holidayType || '').toUpperCase() === 'FESTIVAL';

                      return (
                        <div key={idx} className="p-2 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200 flex items-center justify-between transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-600 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-900 block text-xs">{h.holidayName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{h.holidayDate}</span>
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                            isNational ? 'bg-rose-50 text-rose-700 border border-rose-200' : isFestival ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                          }`}>
                            {h.holidayType || 'HOLIDAY'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = viewingCalendarDetails;
                  setViewingCalendarDetails(null);
                  openManageHolidaysModal(target);
                }}
                className="px-3 py-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded-lg text-xs font-bold border border-cyan-200 transition-colors flex items-center gap-1"
              >
                <Edit className="w-3.5 h-3.5" /> Manage Holiday List
              </button>

              <button
                type="button"
                onClick={() => setViewingCalendarDetails(null)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors"
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

export default HolidayCalendarPage;
