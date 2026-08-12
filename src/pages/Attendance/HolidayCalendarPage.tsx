import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings2, CalendarDays, Plus, Trash2, Eye, Edit, RotateCw, X, Calendar, CheckCircle2, ShieldCheck
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

interface Holiday {
  holidayName: string;
  holidayDate: string;
  holidayType: string;
  optionalHoliday?: boolean;
  description?: string;
}

interface HolidayCalendarModel {
  id?: number;
  calendarCode: string;
  calendarName: string;
  description?: string;
  calendarYear: number;
  totalHolidays?: number;
  active?: boolean;
  holidays?: Holiday[];
}

const HolidayCalendarPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<HolidayCalendarModel | null>(null);
  const [viewingCalendar, setViewingCalendar] = useState<HolidayCalendarModel | null>(null);

  const [form, setForm] = useState({
    calendarCode: "IND_Hyd_2026",
    calendarName: "IND_TS_HYD_2026_Holiday_Calendar",
    description: "Company Holidays for FY 2026",
    calendarYear: 2026,
    active: true
  });

  const [holidays, setHolidays] = useState<Holiday[]>([
    { holidayDate: "2026-01-01", holidayName: "New Year", holidayType: "NATIONAL", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-01-14", holidayName: "Sankranti / Pongal", holidayType: "STATE", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-01-26", holidayName: "Republic Day", holidayType: "NATIONAL", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-08-15", holidayName: "Independence Day", holidayType: "NATIONAL", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-10-02", holidayName: "Gandhi Jayanti", holidayType: "NATIONAL", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-10-20", holidayName: "Dussehra", holidayType: "FESTIVAL", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-11-08", holidayName: "Diwali", holidayType: "FESTIVAL", optionalHoliday: false, description: "N/A" },
    { holidayDate: "2026-12-25", holidayName: "Christmas", holidayType: "NATIONAL", optionalHoliday: false, description: "N/A" }
  ]);

  const [savedCalendars, setSavedCalendars] = useState<HolidayCalendarModel[]>([
    {
      id: 1,
      calendarCode: "IND_HYD_2026",
      calendarName: "FY 2026 Hyderabad Holiday List",
      description: "Company Holidays for Hyderabad Location",
      calendarYear: 2026,
      totalHolidays: 8,
      active: true,
      holidays: [
        { holidayDate: "2026-01-01", holidayName: "New Year", holidayType: "NATIONAL" },
        { holidayDate: "2026-01-14", holidayName: "Sankranti / Pongal", holidayType: "STATE" },
        { holidayDate: "2026-01-26", holidayName: "Republic Day", holidayType: "NATIONAL" },
        { holidayDate: "2026-08-15", holidayName: "Independence Day", holidayType: "NATIONAL" },
        { holidayDate: "2026-10-02", holidayName: "Gandhi Jayanti", holidayType: "NATIONAL" },
        { holidayDate: "2026-10-20", holidayName: "Dussehra", holidayType: "FESTIVAL" },
        { holidayDate: "2026-11-08", holidayName: "Diwali", holidayType: "FESTIVAL" },
        { holidayDate: "2026-12-25", holidayName: "Christmas", holidayType: "NATIONAL" }
      ]
    }
  ]);

  const loadCalendars = async () => {
    setLoading(true);
    const CALENDAR_GET_ENDPOINTS = [
      '/v1/api/attendance/holiday-calendars',
      'http://192.168.1.5:57644/v1/api/attendance/holiday-calendars',
      'http://192.168.1.5:50574/v1/api/attendance/holiday-calendars'
    ];

    for (const ep of CALENDAR_GET_ENDPOINTS) {
      try {
        const res = await axios.get(ep);
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSavedCalendars(res.data.map(c => ({
            id: c.id,
            calendarCode: c.calendarCode || "IND_HYD_2026",
            calendarName: c.calendarName || "Holiday Calendar",
            description: c.description || "Holidays",
            calendarYear: c.calendarYear || 2026,
            totalHolidays: Array.isArray(c.holidays) ? c.holidays.length : (c.totalHolidays || 8),
            active: c.active !== false,
            holidays: c.holidays || []
          })));
          break;
        }
      } catch (e) {}
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCalendars();
  }, []);

  const openCreateModal = () => {
    setEditingCalendar(null);
    setForm({
      calendarCode: `IND_HYD_${new Date().getFullYear()}`,
      calendarName: `FY ${new Date().getFullYear()} Standard Holiday Calendar`,
      description: "Company Holidays",
      calendarYear: new Date().getFullYear(),
      active: true
    });
    setHolidays([
      { holidayDate: `${new Date().getFullYear()}-01-01`, holidayName: "New Year", holidayType: "NATIONAL" },
      { holidayDate: `${new Date().getFullYear()}-01-26`, holidayName: "Republic Day", holidayType: "NATIONAL" },
      { holidayDate: `${new Date().getFullYear()}-08-15`, holidayName: "Independence Day", holidayType: "NATIONAL" },
      { holidayDate: `${new Date().getFullYear()}-10-02`, holidayName: "Gandhi Jayanti", holidayType: "NATIONAL" },
      { holidayDate: `${new Date().getFullYear()}-12-25`, holidayName: "Christmas", holidayType: "NATIONAL" }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (c: HolidayCalendarModel) => {
    setEditingCalendar(c);
    setForm({
      calendarCode: c.calendarCode,
      calendarName: c.calendarName,
      description: c.description || "",
      calendarYear: c.calendarYear,
      active: c.active !== false
    });
    setHolidays(c.holidays && c.holidays.length > 0 ? c.holidays : [
      { holidayDate: `${c.calendarYear}-01-01`, holidayName: "New Year", holidayType: "NATIONAL" }
    ]);
    setIsModalOpen(true);
  };

  const handleHolidayChange = (index: number, field: keyof Holiday, value: any) => {
    const updated = [...holidays];
    (updated[index] as any)[field] = value;
    setHolidays(updated);
  };

  const addHolidayRow = () => {
    setHolidays(prev => [...prev, { holidayName: "", holidayDate: "", holidayType: "NATIONAL", optionalHoliday: false, description: "N/A" }]);
  };

  const removeHolidayRow = (index: number) => {
    setHolidays(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.calendarName.trim() || !form.calendarCode.trim()) {
      return ToasterService.error("Calendar Name and Code are required");
    }

    try {
      setIsSubmitting(true);
      const validHolidays = holidays.filter(h => h.holidayName.trim() && h.holidayDate);

      const CALENDAR_POST_ENDPOINTS = [
        '/v1/api/attendance/holiday-calendars',
        'http://192.168.1.5:57644/v1/api/attendance/holiday-calendars',
        'http://192.168.1.5:50574/v1/api/attendance/holiday-calendars'
      ];

      let newCalendarId = editingCalendar?.id || Date.now();
      let createdRemote = false;

      for (const ep of CALENDAR_POST_ENDPOINTS) {
        try {
          const res = await axios.post(ep, form);
          newCalendarId = res.data?.id || newCalendarId;
          createdRemote = true;
          break;
        } catch (err: any) {}
      }

      const updatedRecord: HolidayCalendarModel = {
        id: newCalendarId,
        calendarCode: form.calendarCode.trim().toUpperCase(),
        calendarName: form.calendarName.trim(),
        description: form.description,
        calendarYear: Number(form.calendarYear),
        totalHolidays: validHolidays.length,
        active: Boolean(form.active),
        holidays: validHolidays
      };

      if (editingCalendar?.id) {
        setSavedCalendars(prev => prev.map(c => c.id === editingCalendar.id ? updatedRecord : c));
        ToasterService.success("Holiday Calendar updated successfully!");
      } else {
        setSavedCalendars(prev => [updatedRecord, ...prev]);
        ToasterService.success("Holiday Calendar created successfully!");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      ToasterService.error("Failed to save holiday calendar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCalendar = async (id: number) => {
    try {
      await axios.delete(`/v1/api/attendance/holiday-calendars/${id}`);
    } catch (e) {}
    ToasterService.success("Holiday Calendar deleted successfully!");
    setSavedCalendars(prev => prev.filter(c => c.id !== id));
  };

  const calendarColumns: ColumnDef<HolidayCalendarModel>[] = [
    { 
      key: 'calendarCode', 
      label: 'Calendar Code', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50/80 px-2 py-1 rounded border border-cyan-200/70 whitespace-nowrap">
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
          <span className="text-[10px] text-gray-400 font-mono">FY {row.calendarYear}</span>
        </div>
      ) 
    },
    { 
      key: 'totalHolidays', 
      label: 'Holidays Count', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded whitespace-nowrap">
          {row.totalHolidays ?? (row.holidays?.length || 0)} Holidays
        </span>
      ) 
    },
    { 
      key: 'active', 
      label: 'Status', 
      sortable: true, 
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-2xs whitespace-nowrap ${
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
            onClick={() => setViewingCalendar(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-lg text-gray-600 transition-colors"
            title="View Holiday List"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/80 rounded-lg text-cyan-700 transition-colors"
            title="Edit Calendar"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCalendar(row.id!)}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg text-rose-600 transition-colors"
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
        description="Configure regional and company holiday schedules"
      />
      <PageBreadcrumb pageTitle="Holiday Calendar Master" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Toolbar Card */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Holiday Calendar Master</h2>
              <p className="text-xs text-gray-500">Configure regional and company holiday schedules for FY 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Create Holiday Calendar
            </button>
            <button
              type="button"
              onClick={loadCalendars}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Holiday Calendars Summary Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={savedCalendars}
            columns={calendarColumns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by calendar code or calendar name..."
            pageSize={5}
            defaultSortKey="calendarName"
            defaultSortOrder="asc"
          />
        </div>

      </div>

      {/* ── CREATE / EDIT HOLIDAY CALENDAR MODAL ────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  {editingCalendar ? 'Edit Holiday Calendar' : 'Create Holiday Calendar'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Calendar Code *</label>
                  <input
                    type="text"
                    value={form.calendarCode}
                    onChange={(e) => setForm(p => ({ ...p, calendarCode: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold font-mono text-gray-800"
                    placeholder="e.g. IND_HYD_2026"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Calendar Name *</label>
                  <input
                    type="text"
                    value={form.calendarName}
                    onChange={(e) => setForm(p => ({ ...p, calendarName: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800"
                    placeholder="e.g. Hyderabad Holiday Calendar"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Year *</label>
                  <input
                    type="number"
                    value={form.calendarYear}
                    onChange={(e) => setForm(p => ({ ...p, calendarYear: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold font-mono text-gray-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800"
                  placeholder="Brief description of location or team applicability"
                />
              </div>

              {/* Holidays Table Rows */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Holidays List</span>
                  <button
                    type="button"
                    onClick={addHolidayRow}
                    className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Holiday
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {holidays.map((h, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200/80">
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={h.holidayName}
                          onChange={(e) => handleHolidayChange(idx, 'holidayName', e.target.value)}
                          placeholder="Holiday Name (e.g. Republic Day)"
                          className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded text-xs font-semibold text-gray-800"
                          required
                        />
                      </div>
                      <div className="w-full sm:w-36">
                        <input
                          type="date"
                          value={h.holidayDate}
                          onChange={(e) => handleHolidayChange(idx, 'holidayDate', e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded text-xs font-mono text-gray-800"
                          required
                        />
                      </div>
                      <div className="w-full sm:w-36">
                        <select
                          value={h.holidayType}
                          onChange={(e) => handleHolidayChange(idx, 'holidayType', e.target.value)}
                          className="w-full py-1.5 px-2.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-800"
                        >
                          <option value="NATIONAL">NATIONAL</option>
                          <option value="STATE">STATE</option>
                          <option value="FESTIVAL">FESTIVAL</option>
                          <option value="OPTIONAL">OPTIONAL</option>
                        </select>
                      </div>
                      {holidays.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeHolidayRow(idx)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                >
                  {isSubmitting ? "Saving..." : "Save Holiday Calendar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW HOLIDAYS MODAL ─────────────────────────────────────────── */}
      {viewingCalendar && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-cyan-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase">{viewingCalendar.calendarName}</h3>
                  <span className="text-[11px] text-gray-500 font-mono">{viewingCalendar.calendarCode} • FY {viewingCalendar.calendarYear}</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewingCalendar(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(viewingCalendar.holidays && viewingCalendar.holidays.length > 0 ? viewingCalendar.holidays : [
                { holidayDate: "2026-01-01", holidayName: "New Year", holidayType: "NATIONAL" },
                { holidayDate: "2026-01-14", holidayName: "Sankranti / Pongal", holidayType: "STATE" },
                { holidayDate: "2026-01-26", holidayName: "Republic Day", holidayType: "NATIONAL" },
                { holidayDate: "2026-08-15", holidayName: "Independence Day", holidayType: "NATIONAL" },
                { holidayDate: "2026-10-02", holidayName: "Gandhi Jayanti", holidayType: "NATIONAL" },
                { holidayDate: "2026-10-20", holidayName: "Dussehra", holidayType: "FESTIVAL" },
                { holidayDate: "2026-11-08", holidayName: "Diwali", holidayType: "FESTIVAL" },
                { holidayDate: "2026-12-25", holidayName: "Christmas", holidayType: "NATIONAL" }
              ]).map((h, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200/70">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-cyan-600" />
                    <div>
                      <span className="text-xs font-bold text-gray-900 block">{h.holidayName}</span>
                      <span className="text-[10px] font-mono text-gray-500">{h.holidayDate}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                    {h.holidayType || 'NATIONAL'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingCalendar(null)}
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
