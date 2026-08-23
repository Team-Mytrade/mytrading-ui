import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CalendarDays, Plus, Trash2, Eye, Edit, RotateCw, X, Calendar
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

  // Modals
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [editingCalendar, setEditingCalendar] = useState<HolidayCalendarModel | null>(null);
  
  const [isHolidayManageModalOpen, setIsHolidayManageModalOpen] = useState<boolean>(false);
  const [activeCalendarForHolidays, setActiveCalendarForHolidays] = useState<HolidayCalendarModel | null>(null);
  
  const [viewingCalendarDetails, setViewingCalendarDetails] = useState<HolidayCalendarModel | null>(null);

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

  // ── API Error Handler Helper ────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    if (backendMsg) {
      ToasterService.error(String(backendMsg));
    } else {
      ToasterService.error(defaultMsg);
    }
  };

  // ── API 2 & 3: CREATE / UPDATE CALENDAR MASTER ──────────────────────────
  // Create Endpoint: POST /v1/api/attendance/holiday-calendars
  // Update Endpoint: PUT /v1/api/attendance/holiday-calendars/{id}
  const handleCalendarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!calendarForm.calendarCode.trim() || !calendarForm.calendarName.trim()) {
      ToasterService.error("Calendar Code and Name are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCalendar?.id) {
        // PUT Update existing calendar
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
        // POST Create new calendar
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

  // ── API 4: GET BY CALENDAR ID ───────────────────────────────────────────
  // Endpoint: GET /v1/api/attendance/holiday-calendars/{id}
  const handleInspectCalendar = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    try {
      const res = await axios.get(`${BASE_CALENDAR_URL}/${cal.id}`);
      setViewingCalendarDetails(res.data || cal);
    } catch (err: any) {
      setViewingCalendarDetails(cal);
    }
  };

  // ── API 5: GET ALL HOLIDAYS BY CALENDAR ID ──────────────────────────────
  // Endpoint: GET /v1/api/attendance/holiday-calendars/{calendarId}/holidays
  const openManageHolidaysModal = async (cal: HolidayCalendarModel) => {
    if (!cal.id) return;
    setActiveCalendarForHolidays(cal);
    setLoading(true);
    setReplaceExisting(true); // Default to replaceExisting = true so removals reflect in DB

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
  // Endpoint: POST /v1/api/attendance/holiday-calendars/{calendarId}/holidays
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

      // 1. Update existing items using PUT /v1/api/attendance/holiday-calendars/{calendarId}/holidays/{holidayId}
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

      // 2. Post new items using POST /v1/api/attendance/holiday-calendars/{calendarId}/holidays
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

  // ── API 7: UPDATE SINGLE HOLIDAY ────────────────────────────────────────
  // Endpoint: PUT /v1/api/attendance/holiday-calendars/{calendarId}/holidays/{holidayId}
  const handleUpdateSingleHoliday = async (hItem: HolidayItem) => {
    if (!activeCalendarForHolidays?.id || !hItem.id) return;

    try {
      const singlePayload = {
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
        singlePayload
      );
      ToasterService.success(`Holiday '${hItem.holidayName}' updated!`);
    } catch (err: any) {
      handleApiError(err, "Failed to update single holiday.");
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
        holidayDate: '',
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
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
          row.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {row.active !== false ? 'Active' : 'Inactive'}
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
            onClick={() => handleInspectCalendar(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Inspect Calendar"
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

  return (
    <>
      <PageMeta
        title="Holiday Calendar Master"
        description="Configure company and regional holiday schedules"
      />
      <PageBreadcrumb pageTitle="Holiday Calendar Master" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Holiday Calendar Master</h2>
              <p className="text-xs text-gray-500">Manage regional holiday schedules and festival calendar dates</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={openCreateCalendarModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Create Holiday Calendar
            </button>
            <button
              type="button"
              onClick={fetchCalendars}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh List"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Master Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={calendars}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by calendar code or calendar name..."
            pageSize={5}
            defaultSortKey="calendarName"
            defaultSortOrder="asc"
          />
        </div>

      </div>

      {/* ── MODAL 1: CREATE / EDIT CALENDAR MASTER ───────────────────────── */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100 space-y-4">
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
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-3xl w-full p-5 shadow-2xl border border-gray-100 space-y-4">
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
                  <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 w-full">
                      <input
                        type="text"
                        value={h.holidayName}
                        onChange={(e) => handleHolidayFieldChange(idx, 'holidayName', e.target.value)}
                        placeholder="Holiday Name (e.g. New Year)"
                        className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded text-xs font-semibold text-gray-800"
                        required
                      />
                    </div>

                    <div className="w-full sm:w-44 relative">
                      <input
                        type="date"
                        value={h.holidayDate}
                        onChange={(e) => handleHolidayFieldChange(idx, 'holidayDate', e.target.value)}
                        className="w-full py-1.5 pl-3 pr-8 bg-white border border-gray-300 rounded text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                        required
                      />
                      <Calendar className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <div className="w-full sm:w-32">
                      <select
                        value={h.holidayType}
                        onChange={(e) => handleHolidayFieldChange(idx, 'holidayType', e.target.value)}
                        className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded text-xs font-bold text-gray-800"
                      >
                        <option value="NATIONAL">NATIONAL</option>
                        <option value="STATE">STATE</option>
                        <option value="FESTIVAL">FESTIVAL</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteSingleHoliday(idx, h)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
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
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
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

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200/80">
                <span className="text-slate-500 block font-semibold text-[11px]">Description:</span>
                <span className="font-bold text-slate-800">{viewingCalendarDetails.description || 'Holidays'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200/80">
                <span className="text-slate-500 block font-semibold text-[11px]">Active Status:</span>
                <span className="font-bold text-emerald-700">{viewingCalendarDetails.active !== false ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingCalendarDetails(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
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
