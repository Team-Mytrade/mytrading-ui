import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Plus, RotateCw, Eye, Edit2, Trash2, CalendarDays, 
  Clock, ShieldCheck, X, CheckCircle2, Layers
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base URLs (routing via Vite dev proxy)
const BASE_SHIFT_URL = '/v1/api/attendance/shifts';

// Backend Weekly Off Enums
export const DAY_OF_WEEK_ENUMS = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"
] as const;

export const WEEK_OCCURRENCE_ENUMS = [
  "EVERY", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "LAST"
] as const;

export type DayOfWeekType = typeof DAY_OF_WEEK_ENUMS[number];
export type WeekOccurrenceType = typeof WEEK_OCCURRENCE_ENUMS[number];

export interface WeeklyOffItem {
  id?: number;
  dayOfWeek: DayOfWeekType;
  weekOccurrence: WeekOccurrenceType;
  active: boolean;
}

export interface ShiftModel {
  id?: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  workingHours?: number;
  breakMinutes: number;
  gracePeriodMinutes: number;
  nightShift?: boolean;
  overtimeAllowed: boolean;
  attendanceFinalizeBufferMinutes?: number;
  active: boolean;
  weeklyOffs?: WeeklyOffItem[];
  [key: string]: any;
}

const ShiftPage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [shifts, setShifts] = useState<ShiftModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Drawers
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftModel | null>(null);
  const [viewingShiftDetails, setViewingShiftDetails] = useState<ShiftModel | null>(null);

  // Weekly Off Drawer State
  const [isWeeklyOffDrawerOpen, setIsWeeklyOffDrawerOpen] = useState(false);
  const [activeShiftForWeeklyOff, setActiveShiftForWeeklyOff] = useState<ShiftModel | null>(null);
  const [weeklyOffsList, setWeeklyOffsList] = useState<WeeklyOffItem[]>([]);
  const [weeklyOffForm, setWeeklyOffForm] = useState<WeeklyOffItem>({
    dayOfWeek: "SUNDAY",
    weekOccurrence: "EVERY",
    active: true
  });
  const [editingWeeklyOffId, setEditingWeeklyOffId] = useState<number | null>(null);

  // Form State
  const [form, setForm] = useState<{
    shiftCode: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    gracePeriodMinutes: number;
    overtimeAllowed: boolean;
    attendanceFinalizeBufferMinutes: number;
    active: boolean;
  }>({
    shiftCode: "",
    shiftName: "",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    gracePeriodMinutes: 15,
    overtimeAllowed: true,
    attendanceFinalizeBufferMinutes: 360,
    active: true
  });

  // ── Error Extraction Helper ────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── API 1 & 2: GET ALL SHIFTS & GET ACTIVE SHIFTS ────────────────────────
  // Endpoints: GET /v1/api/attendance/shifts | GET /v1/api/attendance/shifts/active
  const fetchShifts = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await axios.get(BASE_SHIFT_URL);
      } catch {
        res = await axios.get(`${BASE_SHIFT_URL}/active`);
      }
      if (Array.isArray(res.data)) {
        const formatTimeOnly = (t?: string) => {
          if (!t) return '';
          const parts = t.split(':');
          if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
          return t;
        };

        const cleaned = res.data.map((s: any) => {
          const start = formatTimeOnly(s.startTime);
          const end = formatTimeOnly(s.endTime);
          const timingsStr = (start || end) ? `${start || '--:--'} - ${end || '--:--'}` : 'N/A';

          const workingMins = s.workingHours ?? 480;
          const hoursStr = `${(workingMins / 60).toFixed(1)} hrs (${workingMins} mins)`;

          const isNight = Boolean(s.nightShift || (end && start && end < start));
          const shiftTypeLabel = isNight ? 'Night Shift' : 'Day Shift';
          const statusLabel = s.active !== false ? 'Active' : 'Inactive';

          const weeklyOffsList = Array.isArray(s.weeklyOffs) && s.weeklyOffs.length > 0
            ? s.weeklyOffs.map((w: any) => {
                const occ = w.weekOccurrence && w.weekOccurrence !== 'EVERY' ? `${w.weekOccurrence} ` : '';
                const day = w.dayOfWeek ? `${w.dayOfWeek.charAt(0)}${w.dayOfWeek.slice(1).toLowerCase()}` : '';
                return `${occ}${day}`.trim();
              }).filter(Boolean)
            : undefined;

          // The first 4 scalar properties will become the top 4 highlight summary metrics in Table drawer:
          // 1. shiftCode -> SHIFT CODE
          // 2. shiftName -> SHIFT NAME
          // 3. timings -> TIMINGS
          // 4. status -> STATUS
          const rowItem: Record<string, any> = {
            id: s.id,
            shiftCode: s.shiftCode,
            shiftName: s.shiftName,
            timings: timingsStr,
            status: statusLabel,
            shiftType: shiftTypeLabel,
            netDuration: hoursStr,
            breakTime: `${s.breakMinutes ?? 60} mins`,
            gracePeriod: `${s.gracePeriodMinutes ?? 15} mins`,
            overtime: s.overtimeAllowed !== false ? 'Allowed' : 'Not Allowed',
          };

          if (weeklyOffsList && weeklyOffsList.length > 0) {
            rowItem.weeklyOffs = weeklyOffsList;
          }

          // Attach raw reference non-enumerably so Table.tsx's Object.keys() does NOT inspect it
          Object.defineProperty(rowItem, '_raw', {
            value: s,
            enumerable: false,
            writable: true,
          });

          return rowItem;
        });

        setShifts(cleaned);
      } else {
        setShifts([]);
      }
    } catch (err: any) {
      console.error("Failed to load shifts:", err);
      handleApiError(err, "Failed to load shifts list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  // ── Computations ───────────────────────────────────────────────────────
  const computedWorkingMinutes = useMemo(() => {
    try {
      if (!form.startTime || !form.endTime) return 480;
      const [sh, sm] = form.startTime.split(':').map(Number);
      const [eh, em] = form.endTime.split(':').map(Number);
      let diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
      if (diff <= 0) diff += 24 * 60; // Overnight
      const net = diff - (Number(form.breakMinutes) || 0);
      return net > 0 ? net : 0;
    } catch {
      return 480;
    }
  }, [form.startTime, form.endTime, form.breakMinutes]);

  const computedNightShift = useMemo(() => {
    if (!form.startTime || !form.endTime) return false;
    const [sh] = form.startTime.split(':').map(Number);
    const [eh] = form.endTime.split(':').map(Number);
    return eh < sh || (eh === sh && form.endTime < form.startTime);
  }, [form.startTime, form.endTime]);

  // ── API 3 & 4: CREATE / UPDATE SHIFT MASTER ─────────────────────────────
  // Create Endpoint: POST /v1/api/attendance/shifts
  // Update Endpoint: PUT /v1/api/attendance/shifts/{id}
  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.shiftCode.trim() || !form.shiftName.trim()) {
      ToasterService.error("Shift Code and Shift Name are required.");
      return;
    }

    const formatTime = (t: string) => {
      if (!t) return "09:00:00";
      const parts = t.split(':');
      if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
      return t;
    };

    setIsSubmitting(true);
    try {
      if (editingShift?.id) {
        // PUT Update Shift
        const updatePayload = {
          shiftCode: form.shiftCode.trim().toUpperCase(),
          shiftName: form.shiftName.trim(),
          startTime: formatTime(form.startTime),
          endTime: formatTime(form.endTime),
          workingHours: computedWorkingMinutes,
          breakMinutes: Number(form.breakMinutes) || 60,
          gracePeriodMinutes: Number(form.gracePeriodMinutes) || 15,
          nightShift: Boolean(computedNightShift),
          overtimeAllowed: Boolean(form.overtimeAllowed),
          active: Boolean(form.active)
        };

        await axios.put(`${BASE_SHIFT_URL}/${editingShift.id}`, updatePayload);
        ToasterService.success("Shift updated successfully!");
      } else {
        // POST Create Shift
        const createPayload = {
          shiftCode: form.shiftCode.trim().toUpperCase(),
          shiftName: form.shiftName.trim(),
          startTime: formatTime(form.startTime),
          endTime: formatTime(form.endTime),
          breakMinutes: Number(form.breakMinutes) || 60,
          gracePeriodMinutes: Number(form.gracePeriodMinutes) || 15,
          overtimeAllowed: Boolean(form.overtimeAllowed),
          attendanceFinalizeBufferMinutes: Number(form.attendanceFinalizeBufferMinutes) || 360,
          active: Boolean(form.active)
        };

        await axios.post(BASE_SHIFT_URL, createPayload);
        ToasterService.success("Shift created successfully!");
      }

      setIsShiftModalOpen(false);
      resetShiftForm();
      fetchShifts();
    } catch (err: any) {
      handleApiError(err, "Failed to save shift.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── API 5: GET SHIFT BY ID ──────────────────────────────────────────────
  // Endpoint: GET /v1/api/attendance/shifts/{id}
  const handleInspectShift = async (shiftItem: ShiftModel) => {
    const rawShift = (shiftItem as any)._raw || shiftItem;
    const shiftId = shiftItem.id || rawShift.id;
    if (!shiftId) return;
    try {
      const res = await axios.get(`${BASE_SHIFT_URL}/${shiftId}`);
      setViewingShiftDetails(res.data || rawShift);
    } catch {
      setViewingShiftDetails(rawShift);
    }
  };

  // ── API 6: GET ALL WEEKLY-OFFS FOR SHIFT ────────────────────────────────
  // Endpoint: GET /v1/api/attendance/shifts/{shiftId}/weekly-offs
  const openWeeklyOffDrawer = async (shiftItem: ShiftModel) => {
    const rawShift = (shiftItem as any)._raw || shiftItem;
    const shiftId = shiftItem.id || rawShift.id;
    if (!shiftId) return;
    setActiveShiftForWeeklyOff(rawShift);
    setLoading(true);

    try {
      const res = await axios.get(`${BASE_SHIFT_URL}/${shiftId}/weekly-offs`);
      if (Array.isArray(res.data)) {
        setWeeklyOffsList(res.data);
      } else {
        setWeeklyOffsList(rawShift.weeklyOffs || []);
      }
    } catch {
      setWeeklyOffsList(rawShift.weeklyOffs || []);
    } finally {
      setLoading(false);
      setIsWeeklyOffDrawerOpen(true);
    }
  };

  // ── API 7 & 8: CREATE / UPDATE WEEKLY-OFF RULE ───────────────────────────
  // Create Endpoint: POST /v1/api/attendance/shifts/{shiftId}/weekly-offs
  // Update Endpoint: PUT /v1/api/attendance/shifts/{shiftId}/weekly-offs/{id}
  const handleSaveWeeklyOffRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShiftForWeeklyOff?.id) return;

    try {
      if (editingWeeklyOffId) {
        // PUT Single Weekly Off
        const putPayload = {
          dayOfWeek: weeklyOffForm.dayOfWeek,
          weekOccurrence: weeklyOffForm.weekOccurrence,
          active: Boolean(weeklyOffForm.active)
        };
        await axios.put(`${BASE_SHIFT_URL}/${activeShiftForWeeklyOff.id}/weekly-offs/${editingWeeklyOffId}`, putPayload);
        ToasterService.success("Weekly Off rule updated!");
      } else {
        // POST Bulk Weekly Offs
        const postPayload = {
          weeklyOffs: [
            {
              dayOfWeek: weeklyOffForm.dayOfWeek,
              weekOccurrence: weeklyOffForm.weekOccurrence,
              active: Boolean(weeklyOffForm.active)
            }
          ]
        };
        await axios.post(`${BASE_SHIFT_URL}/${activeShiftForWeeklyOff.id}/weekly-offs`, postPayload);
        ToasterService.success("Weekly Off rule added!");
      }

      setEditingWeeklyOffId(null);
      setWeeklyOffForm({ dayOfWeek: "SUNDAY", weekOccurrence: "EVERY", active: true });
      openWeeklyOffDrawer(activeShiftForWeeklyOff);
    } catch (err: any) {
      handleApiError(err, "Failed to save weekly off rule.");
    }
  };

  // ── API 9: DELETE WEEKLY-OFF RULE ───────────────────────────────────────
  // Endpoint: DELETE /v1/api/attendance/shifts/{shiftId}/weekly-offs/{id}
  const handleDeleteWeeklyOff = async (id: number) => {
    if (!activeShiftForWeeklyOff?.id || !id) return;

    try {
      await axios.delete(`${BASE_SHIFT_URL}/${activeShiftForWeeklyOff.id}/weekly-offs/${id}`);
      ToasterService.success("Weekly Off rule removed!");
      openWeeklyOffDrawer(activeShiftForWeeklyOff);
    } catch (err: any) {
      handleApiError(err, "Failed to delete weekly off rule.");
    }
  };

  // ── Form Reset Helpers ─────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingShift(null);
    setForm({
      shiftCode: "",
      shiftName: "",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      gracePeriodMinutes: 15,
      overtimeAllowed: true,
      attendanceFinalizeBufferMinutes: 360,
      active: true
    });
    setIsShiftModalOpen(true);
  };

  const openEditModal = (s: ShiftModel) => {
    const rawShift = (s as any)._raw || s;
    setEditingShift(rawShift);
    setForm({
      shiftCode: rawShift.shiftCode,
      shiftName: rawShift.shiftName,
      startTime: rawShift.startTime ? rawShift.startTime.substring(0, 5) : "09:00",
      endTime: rawShift.endTime ? rawShift.endTime.substring(0, 5) : "18:00",
      breakMinutes: rawShift.breakMinutes ?? 60,
      gracePeriodMinutes: rawShift.gracePeriodMinutes ?? 15,
      overtimeAllowed: rawShift.overtimeAllowed !== false,
      attendanceFinalizeBufferMinutes: rawShift.attendanceFinalizeBufferMinutes ?? 360,
      active: rawShift.active !== false
    });
    setIsShiftModalOpen(true);
  };

  const resetShiftForm = () => {
    setEditingShift(null);
    setForm({
      shiftCode: "",
      shiftName: "",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: 60,
      gracePeriodMinutes: 15,
      overtimeAllowed: true,
      attendanceFinalizeBufferMinutes: 360,
      active: true
    });
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<ShiftModel>[] = [
    {
      key: 'shiftCode',
      label: 'Shift Code',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 dark:text-gray-300 bg-cyan-50/80 dark:bg-transparent px-2.5 py-1 rounded border border-cyan-200/70 dark:border-transparent whitespace-nowrap">
          {row.shiftCode}
        </span>
      )
    },
    {
      key: 'shiftName',
      label: 'Shift Name',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 dark:text-white block">{row.shiftName}</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            {row.timings || `${row.startTime?.substring(0, 5)} - ${row.endTime?.substring(0, 5)}`}
          </span>
        </div>
      )
    },
    {
      key: 'timings',
      label: 'Timings',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 dark:text-gray-300">
          {row.timings || `${row.startTime?.substring(0, 5)} - ${row.endTime?.substring(0, 5)}`}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const isActive = row.status === 'Active' || row.active !== false;
        return (
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border ${
            isActive 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent' 
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent'
          }`}>
            {isActive ? 'Active' : 'Inactive'}
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
            onClick={() => handleInspectShift(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-transparent dark:hover:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-lg text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors cursor-pointer"
            title="Inspect Shift Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openWeeklyOffDrawer(row)}
            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-transparent dark:hover:bg-[#222222] border border-indigo-200 dark:!border-transparent rounded-lg text-indigo-700 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            title="Manage Weekly Off Rules"
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 dark:bg-transparent dark:hover:bg-[#222222] border border-cyan-200 dark:!border-transparent rounded-lg text-cyan-700 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors cursor-pointer"
            title="Edit Shift Master"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Shift Master" description="Configure work shift timings and weekly off rules" />
      <PageBreadcrumb pageTitle="Shift Master" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:!border-transparent p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 dark:bg-[#222222] text-cyan-700 dark:text-cyan-400 rounded-lg border border-cyan-200 dark:!border-transparent">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Shift Master</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure General, Morning, and Night shifts with weekly off policies</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Shift
            </button>
            <button
              type="button"
              onClick={fetchShifts}
              className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:!border-transparent rounded-lg transition-all cursor-pointer shadow-2xs"
              title="Refresh Shift List"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Master Table */}
        <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:!border-transparent p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shift Master</h3>
            <TableToolbar onRefresh={fetchShifts} />
          </div>
          <ReusableTable
            data={shifts}
            columns={columns}
            loading={loading}
            pageSize={5}
            defaultSortKey="shiftName"
            defaultSortOrder="asc"
            rowDetailsTitle={(row) => `${row.shiftName} (${row.shiftCode})`}
            rowDetailsSubtitle="Shift timings and configuration summary"
          />
        </div>

      </div>

      {/* ── MODAL 1: CREATE / EDIT SHIFT MASTER ───────────────────────────── */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:!border-transparent">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                  {editingShift ? 'Edit Shift Master' : 'Create New Shift'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsShiftModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleShiftSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Shift Code *</label>
                  <input
                    type="text"
                    value={form.shiftCode}
                    onChange={(e) => setForm(p => ({ ...p, shiftCode: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-bold font-mono text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                    placeholder="e.g. GEN, A, N"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Shift Name *</label>
                  <input
                    type="text"
                    value={form.shiftName}
                    onChange={(e) => setForm(p => ({ ...p, shiftName: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-semibold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                    placeholder="e.g. General Shift"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">End Time *</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#222222] border border-slate-200/80 dark:!border-transparent rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 dark:text-gray-400 font-semibold block text-[11px]">Calculated Working Hours:</span>
                  <span className="font-mono font-bold text-cyan-800 dark:text-cyan-300">{computedWorkingMinutes} mins ({(computedWorkingMinutes / 60).toFixed(1)}h)</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 font-semibold block text-[11px]">Night Shift Status:</span>
                  <span className={`font-bold ${computedNightShift ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-gray-300'}`}>
                    {computedNightShift ? 'YES (Night Shift)' : 'NO (Day Shift)'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Break Minutes</label>
                  <input
                    type="number"
                    value={form.breakMinutes}
                    onChange={(e) => setForm(p => ({ ...p, breakMinutes: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Grace Period Mins</label>
                  <input
                    type="number"
                    value={form.gracePeriodMinutes}
                    onChange={(e) => setForm(p => ({ ...p, gracePeriodMinutes: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Finalize Buffer Mins</label>
                  <input
                    type="number"
                    value={form.attendanceFinalizeBufferMinutes}
                    onChange={(e) => setForm(p => ({ ...p, attendanceFinalizeBufferMinutes: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-xl text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] focus:ring-1 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.overtimeAllowed}
                    onChange={(e) => setForm(p => ({ ...p, overtimeAllowed: e.target.checked }))}
                    className="rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>Overtime Permitted</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm(p => ({ ...p, active: e.target.checked }))}
                    className="rounded text-cyan-600 focus:ring-cyan-500"
                  />
                  <span>Active Shift Status</span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:!border-transparent flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:!border-transparent rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-xl text-xs font-bold disabled:opacity-70 transition-all cursor-pointer shadow-xs"
                >
                  {isSubmitting ? "Saving..." : (editingShift ? "Update Shift" : "Create Shift")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: MANAGE WEEKLY OFF RULES ─────────────────────────────── */}
      {isWeeklyOffDrawerOpen && activeShiftForWeeklyOff && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:!border-transparent">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                  Weekly Off Rules: {activeShiftForWeeklyOff.shiftName}
                </h3>
                <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400">Shift Code: {activeShiftForWeeklyOff.shiftCode} (ID: {activeShiftForWeeklyOff.id})</span>
              </div>
              <button type="button" onClick={() => setIsWeeklyOffDrawerOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Weekly Off Create/Edit Form */}
            <form onSubmit={handleSaveWeeklyOffRule} className="p-3 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-gray-200 block">
                {editingWeeklyOffId ? 'Edit Weekly Off Rule' : 'Add Weekly Off Rule'}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-300 mb-1">Day of Week</label>
                  <select
                    value={weeklyOffForm.dayOfWeek}
                    onChange={(e) => setWeeklyOffForm(p => ({ ...p, dayOfWeek: e.target.value as DayOfWeekType }))}
                    className="w-full py-1.5 px-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs font-bold text-slate-800 dark:text-white outline-none"
                  >
                    {DAY_OF_WEEK_ENUMS.map(d => (
                      <option key={d} value={d} className="dark:bg-[#191919]">{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-300 mb-1">Week Occurrence</label>
                  <select
                    value={weeklyOffForm.weekOccurrence}
                    onChange={(e) => setWeeklyOffForm(p => ({ ...p, weekOccurrence: e.target.value as WeekOccurrenceType }))}
                    className="w-full py-1.5 px-2 bg-white dark:bg-[#191919] border border-slate-200 dark:!border-transparent rounded-lg text-xs font-bold text-slate-800 dark:text-white outline-none"
                  >
                    {WEEK_OCCURRENCE_ENUMS.map(w => (
                      <option key={w} value={w} className="dark:bg-[#191919]">{w}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    {editingWeeklyOffId ? 'Update Rule' : 'Add Rule'}
                  </button>
                </div>
              </div>
            </form>

            {/* Weekly Off Rules Table */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {weeklyOffsList.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
                  No weekly off rules configured for this shift.
                </div>
              ) : (
                weeklyOffsList.map((wo, idx) => (
                  <div key={wo.id || idx} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[#222222] rounded-xl border border-gray-200/80 dark:!border-transparent">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-indigo-700 dark:text-gray-300 bg-indigo-50 dark:bg-transparent border border-indigo-200 dark:border-transparent px-2 py-0.5 rounded">
                        {wo.dayOfWeek}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 dark:text-gray-300">
                        Occurrence: <strong className="text-slate-900 dark:text-white">{wo.weekOccurrence}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {wo.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWeeklyOffId(wo.id!);
                            setWeeklyOffForm({ dayOfWeek: wo.dayOfWeek, weekOccurrence: wo.weekOccurrence, active: wo.active !== false });
                          }}
                          className="p-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 cursor-pointer"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {wo.id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteWeeklyOff(wo.id!)}
                          className="p-1 text-rose-600 dark:text-rose-400 hover:text-rose-800 cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:!border-transparent flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsWeeklyOffDrawerOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: VIEW SHIFT DETAILS ───────────────────────────────────── */}
      {viewingShiftDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-2xl max-w-md w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:!border-transparent">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">{viewingShiftDetails.shiftName}</h3>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">Code: {viewingShiftDetails.shiftCode} (ID: {viewingShiftDetails.id})</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewingShiftDetails(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-semibold">Timings:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{viewingShiftDetails.startTime} - {viewingShiftDetails.endTime}</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-semibold">Break & Grace:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-white">{viewingShiftDetails.breakMinutes}m break / {viewingShiftDetails.gracePeriodMinutes}m grace</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-[#222222] rounded-xl border border-slate-200/80 dark:!border-transparent flex items-center justify-between">
                <span className="text-slate-500 dark:text-gray-400 font-semibold">Overtime Permitted:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{viewingShiftDetails.overtimeAllowed ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:!border-transparent flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingShiftDetails(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
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

export default ShiftPage;
