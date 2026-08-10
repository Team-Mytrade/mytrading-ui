import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Plus, Search, RotateCw, Eye, Edit2, Trash2, CalendarDays, 
  Clock, ShieldCheck, X, CheckCircle2, AlertCircle, Layers, Settings
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Candidate Endpoints according to backend specifications
const SHIFT_BASE_URL = '/v1/api/shifts';
const SHIFT_FALLBACK_URL = '/v1/api/attendance/shifts';

// Backend Enums Constants
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
  graceInMinutes?: number;
  graceOutMinutes?: number;
  nightShift?: boolean;
  overtimeAllowed: boolean;
  holidayCalendarId?: number;
  attendancePolicyId?: number;
  attendanceFinalizeBufferMinutes?: number;
  active: boolean;
  weeklyOffs?: WeeklyOffItem[];
}

const ShiftPage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [shifts, setShifts] = useState<ShiftModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftModel | null>(null);
  const [viewingShift, setViewingShift] = useState<ShiftModel | null>(null);
  const [managingWeeklyOffShift, setManagingWeeklyOffShift] = useState<ShiftModel | null>(null);

  // Form State
  const [form, setForm] = useState<ShiftModel>({
    shiftCode: "GEN",
    shiftName: "General Shift",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    gracePeriodMinutes: 15,
    graceInMinutes: 15,
    graceOutMinutes: 15,
    holidayCalendarId: 1,
    attendancePolicyId: 1,
    attendanceFinalizeBufferMinutes: 360,
    overtimeAllowed: true,
    active: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Weekly Off Form State
  const [selectedWeeklyOffDays, setSelectedWeeklyOffDays] = useState<DayOfWeekType[]>(["SUNDAY"]);
  const [selectedWeekOccurrence, setSelectedWeekOccurrence] = useState<WeekOccurrenceType>("EVERY");
  const [shiftWeeklyOffs, setShiftWeeklyOffs] = useState<WeeklyOffItem[]>([]);
  const [editingWeeklyOffId, setEditingWeeklyOffId] = useState<number | null>(null);
  const [isWeeklyOffSubmitting, setIsWeeklyOffSubmitting] = useState(false);

  // ── Utility Calculations ───────────────────────────────────────────────
  const formatTimeWithSeconds = (t: string): string => {
    if (!t) return "00:00:00";
    const parts = t.trim().split(':');
    if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`;
    if (parts.length === 3) return t;
    return `${t}:00:00`;
  };

  const calculateTotalShiftMinutes = useCallback((start: string, end: string): number => {
    try {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      let diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
      if (diff <= 0) diff += 24 * 60; // Overnight wrapped shift
      return diff;
    } catch {
      return 540;
    }
  }, []);

  const computedNightShift = useMemo(() => {
    if (!form.startTime || !form.endTime) return false;
    const [sh] = form.startTime.split(':').map(Number);
    const [eh] = form.endTime.split(':').map(Number);
    return eh < sh || (eh === sh && form.endTime < form.startTime);
  }, [form.startTime, form.endTime]);

  const computedWorkingHours = useMemo(() => {
    const totalDuration = calculateTotalShiftMinutes(form.startTime, form.endTime);
    const netMins = totalDuration - (Number(form.breakMinutes) || 0);
    return netMins > 0 ? netMins : 0;
  }, [form.startTime, form.endTime, form.breakMinutes, calculateTotalShiftMinutes]);

  // ── Error Extraction Helper ────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const status = err.response?.status;
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    
    if (status === 409) {
      ToasterService.error(backendMsg || "Shift code already exists (409 Conflict).");
    } else if (status === 400 || status === 422) {
      ToasterService.error(backendMsg || "Validation Error (400 Bad Request). Please check form inputs.");
    } else if (status === 401 || status === 403) {
      ToasterService.error("Unauthorized / Permission Denied.");
    } else if (status === 404) {
      ToasterService.error("Shift resource not found (404).");
    } else if (status >= 500) {
      ToasterService.error(backendMsg || "Server Error (500). Please try again later.");
    } else {
      ToasterService.error(backendMsg || defaultMsg);
    }
  };

  // ── Fetch Shifts List ──────────────────────────────────────────────────
  const fetchShifts = async () => {
    setLoading(true);
    try {
      let res;
      try {
        res = await axios.get(SHIFT_BASE_URL);
      } catch (e) {
        try {
          res = await axios.get(`${SHIFT_BASE_URL}/active`);
        } catch (e2) {
          try {
            res = await axios.get(SHIFT_FALLBACK_URL);
          } catch (e3) {
            res = await axios.get(`${SHIFT_FALLBACK_URL}/active`);
          }
        }
      }

      if (Array.isArray(res.data)) {
        setShifts(res.data.map((s: any) => ({
          id: s.id,
          shiftCode: s.shiftCode || "",
          shiftName: s.shiftName || "",
          startTime: s.startTime || "09:00",
          endTime: s.endTime || "18:00",
          workingHours: s.workingHours ?? 480,
          breakMinutes: s.breakMinutes ?? 60,
          gracePeriodMinutes: s.graceInMinutes ?? s.gracePeriodMinutes ?? 15,
          graceInMinutes: s.graceInMinutes ?? 15,
          graceOutMinutes: s.graceOutMinutes ?? 15,
          nightShift: Boolean(s.nightShift),
          overtimeAllowed: s.overtimeAllowed !== false,
          holidayCalendarId: s.holidayCalendarId ?? 1,
          attendancePolicyId: s.attendancePolicyId ?? 1,
          attendanceFinalizeBufferMinutes: s.attendanceFinalizeBufferMinutes ?? 360,
          active: s.active !== false,
          weeklyOffs: Array.isArray(s.weeklyOffs) ? s.weeklyOffs : []
        })));
      } else {
        setShifts([]);
      }
    } catch (err) {
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  // ── Form Validation ────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.shiftCode.trim()) {
      errors.shiftCode = "Shift Code is required.";
    }

    if (!form.shiftName.trim()) {
      errors.shiftName = "Shift Name is required.";
    }

    if (!form.startTime) {
      errors.startTime = "Start Time is required.";
    }

    if (!form.endTime) {
      errors.endTime = "End Time is required.";
    }

    if (form.startTime && form.endTime && form.startTime === form.endTime) {
      errors.endTime = "Start Time and End Time cannot be equal.";
    }

    const totalShiftDuration = calculateTotalShiftMinutes(form.startTime, form.endTime);
    if ((Number(form.breakMinutes) || 0) >= totalShiftDuration) {
      errors.breakMinutes = `Break Minutes (${form.breakMinutes}m) cannot equal or exceed shift duration (${totalShiftDuration}m).`;
    }

    const graceVal = Number(form.graceInMinutes ?? form.gracePeriodMinutes) || 0;
    const netWorkingDuration = totalShiftDuration - (Number(form.breakMinutes) || 0);
    if (graceVal >= netWorkingDuration) {
      errors.gracePeriodMinutes = `Grace Period (${graceVal}m) cannot equal or exceed working duration (${netWorkingDuration}m).`;
    }

    // Check code uniqueness locally
    const isDuplicate = shifts.some(
      s => s.shiftCode.trim().toLowerCase() === form.shiftCode.trim().toLowerCase() && s.id !== editingShift?.id
    );
    if (isDuplicate) {
      errors.shiftCode = `Shift Code '${form.shiftCode}' is already taken. Please enter a unique code.`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Create or Update Shift Submission ──────────────────────────────────
  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const shortStart = form.startTime.length > 5 ? form.startTime.substring(0, 5) : form.startTime;
    const shortEnd = form.endTime.length > 5 ? form.endTime.substring(0, 5) : form.endTime;
    const netWorkingMins = computedWorkingHours;
    const isNight = computedNightShift;

    try {
      setIsSubmitting(true);

      const postPayload = {
        shiftCode: form.shiftCode.trim().toUpperCase(),
        shiftName: form.shiftName.trim(),
        startTime: shortStart,
        endTime: shortEnd,
        graceInMinutes: Number(form.graceInMinutes ?? form.gracePeriodMinutes ?? 15),
        graceOutMinutes: Number(form.graceOutMinutes ?? form.gracePeriodMinutes ?? 15),
        nightShift: Boolean(isNight),
        holidayCalendarId: Number(form.holidayCalendarId) || 1,
        attendancePolicyId: Number(form.attendancePolicyId) || 1,
        active: Boolean(form.active)
      };

      if (editingShift?.id) {
        let res;
        try {
          res = await axios.put(`${SHIFT_BASE_URL}/${editingShift.id}`, postPayload);
        } catch (err) {
          res = await axios.put(`${SHIFT_FALLBACK_URL}/${editingShift.id}`, postPayload);
        }
        const updatedShift = res.data || { ...editingShift, ...postPayload };

        setShifts(prev => prev.map(s => s.id === editingShift.id ? updatedShift : s));
        ToasterService.success("Shift updated successfully!");
        setEditingShift(null);
      } else {
        let res;
        try {
          res = await axios.post(SHIFT_BASE_URL, postPayload);
        } catch (err) {
          res = await axios.post(SHIFT_FALLBACK_URL, postPayload);
        }
        const createdShift = res.data || { ...postPayload, id: Date.now(), workingHours: netWorkingMins };

        setShifts(prev => [createdShift, ...prev]);
        ToasterService.success("Shift created.");
        setIsCreateModalOpen(false);
      }

      resetForm();
    } catch (err: any) {
      handleApiError(err, "Failed to save shift details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      shiftCode: "GEN",
      shiftName: "General Shift",
      startTime: "09:00:00",
      endTime: "18:00:00",
      breakMinutes: 60,
      gracePeriodMinutes: 15,
      attendanceFinalizeBufferMinutes: 360,
      overtimeAllowed: true,
      active: true
    });
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setEditingShift(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (shift: ShiftModel) => {
    setEditingShift(shift);
    setForm({
      shiftCode: shift.shiftCode,
      shiftName: shift.shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      attendanceFinalizeBufferMinutes: shift.attendanceFinalizeBufferMinutes || 360,
      workingHours: shift.workingHours,
      nightShift: shift.nightShift,
      overtimeAllowed: shift.overtimeAllowed,
      active: shift.active
    });
    setFormErrors({});
  };

  // ── Weekly Off Handlers ──────────────────────────────────────────────────
  const fetchWeeklyOffs = async (shiftId: number) => {
    try {
      const res = await axios.get(`${SHIFT_BASE_URL}/${shiftId}/weekly-offs`);
      if (Array.isArray(res.data)) {
        setShiftWeeklyOffs(res.data);
      }
    } catch (e) {
      setShiftWeeklyOffs([]);
    }
  };

  const openWeeklyOffModal = (shift: ShiftModel) => {
    setManagingWeeklyOffShift(shift);
    setSelectedWeeklyOffDays(["SUNDAY"]);
    setSelectedWeekOccurrence("EVERY");
    setEditingWeeklyOffId(null);
    if (shift.id) {
      fetchWeeklyOffs(shift.id);
    }
  };

  const handleAddOrUpdateWeeklyOff = async () => {
    if (!managingWeeklyOffShift?.id || selectedWeeklyOffDays.length === 0) return;

    try {
      setIsWeeklyOffSubmitting(true);

      if (editingWeeklyOffId) {
        // PUT /v1/api/attendance/shifts/{shiftId}/weekly-offs/{id}
        const putPayload = {
          dayOfWeek: selectedWeeklyOffDays[0],
          weekOccurrence: selectedWeekOccurrence,
          active: true
        };
        await axios.put(`${SHIFT_BASE_URL}/${managingWeeklyOffShift.id}/weekly-offs/${editingWeeklyOffId}`, putPayload);
        ToasterService.success("Weekly off pattern updated successfully!");
      } else {
        // POST /v1/api/attendance/shifts/{shiftId}/weekly-offs
        const postPayload = {
          weeklyOffs: selectedWeeklyOffDays.map(day => ({
            dayOfWeek: day,
            weekOccurrence: selectedWeekOccurrence,
            active: true
          }))
        };
        await axios.post(`${SHIFT_BASE_URL}/${managingWeeklyOffShift.id}/weekly-offs`, postPayload);
        ToasterService.success("Weekly off pattern configured successfully!");
      }

      setEditingWeeklyOffId(null);
      fetchWeeklyOffs(managingWeeklyOffShift.id);
      fetchShifts();
    } catch (err: any) {
      handleApiError(err, "Failed to configure weekly offs.");
    } finally {
      setIsWeeklyOffSubmitting(false);
    }
  };

  const handleDeleteWeeklyOff = async (weeklyOffId: number) => {
    if (!managingWeeklyOffShift?.id || !weeklyOffId) return;

    try {
      await axios.delete(`${SHIFT_BASE_URL}/${managingWeeklyOffShift.id}/weekly-offs/${weeklyOffId}`);
      ToasterService.success("Weekly off removed successfully!");
      setShiftWeeklyOffs(prev => prev.filter(w => w.id !== weeklyOffId));
      fetchShifts();
    } catch (err: any) {
      handleApiError(err, "Failed to delete weekly off.");
    }
  };

  // ── Search & Filter ──────────────────────────────────────────────────────
  const filteredShifts = useMemo(() => {
    if (!searchQuery.trim()) return shifts;
    const q = searchQuery.toLowerCase();
    return shifts.filter(
      s => s.shiftCode.toLowerCase().includes(q) || s.shiftName.toLowerCase().includes(q)
    );
  }, [shifts, searchQuery]);

  // ── Table Column Definitions ─────────────────────────────────────────────
  const columns: ColumnDef<ShiftModel>[] = [
    { 
      key: 'shiftCode', 
      label: 'Shift Code', 
      sortable: true, 
      render: (row) => <span className="font-mono font-bold text-cyan-700">{row.shiftCode}</span> 
    },
    { 
      key: 'shiftName', 
      label: 'Shift Name', 
      sortable: true, 
      render: (row) => <span className="font-semibold text-gray-900">{row.shiftName}</span> 
    },
    { 
      key: 'startTime', 
      label: 'Start / End Time', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200/80 px-2 py-0.5 rounded">
          {row.startTime} - {row.endTime} {row.nightShift ? '(Night)' : ''}
        </span>
      ) 
    },
    { 
      key: 'workingHours', 
      label: 'Working Hours', 
      sortable: true, 
      render: (row) => {
        const netMins = row.workingHours || calculateTotalShiftMinutes(row.startTime, row.endTime) - row.breakMinutes;
        const hrs = (netMins / 60).toFixed(1);
        return <span className="text-xs font-bold text-gray-800">{netMins} mins ({hrs}h)</span>;
      } 
    },
    { 
      key: 'breakMinutes', 
      label: 'Break Mins', 
      sortable: true, 
      render: (row) => <span className="text-xs text-gray-600">{row.breakMinutes} mins</span> 
    },
    { 
      key: 'gracePeriodMinutes', 
      label: 'Grace Period', 
      sortable: true, 
      render: (row) => <span className="text-xs text-gray-600">{row.gracePeriodMinutes} mins</span> 
    },
    { 
      key: 'overtimeAllowed', 
      label: 'Overtime', 
      sortable: true, 
      render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.overtimeAllowed ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-500'}`}>
          {row.overtimeAllowed ? 'Permitted' : 'No'}
        </span>
      ) 
    },
    { 
      key: 'active', 
      label: 'Active Status', 
      sortable: true, 
      render: (row) => (
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          row.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {row.active ? 'Active' : 'Inactive'}
        </span>
      ) 
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewingShift(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-gray-600 transition-colors"
            title="View Shift"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-700 rounded transition-colors"
            title="Edit Shift"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openWeeklyOffModal(row)}
            className="p-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded transition-colors"
            title="Manage Weekly Offs"
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Shift Management" description="Manage organization shift definitions, working hours, grace periods, and weekly off rules" />
      <PageBreadcrumb pageTitle="Shift Management" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Toolbar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-600" />
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Shift Master List</h2>
              <p className="text-xs text-gray-500">Configure shifts, working durations, and weekly off schedules</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={fetchShifts}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh Shifts List"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Create New Shift
            </button>
          </div>
        </div>

        {/* Shift List Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={filteredShifts}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by shift code or shift name..."
            pageSize={5}
            defaultSortKey="shiftCode"
            defaultSortOrder="asc"
          />
        </div>

        {/* ── CREATE / EDIT SHIFT MODAL ────────────────────────────────────── */}
        {(isCreateModalOpen || editingShift) && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-2xl w-full p-5 shadow-2xl border border-gray-100">
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">
                    {editingShift ? `Edit Shift #${editingShift.id}` : "Create New Shift"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setEditingShift(null); }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleShiftSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Shift Code *</label>
                    <input
                      type="text"
                      name="shiftCode"
                      value={form.shiftCode}
                      onChange={(e) => setForm(p => ({ ...p, shiftCode: e.target.value }))}
                      placeholder="e.g., GEN, MOR, NITE"
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800 uppercase"
                      required
                    />
                    {formErrors.shiftCode && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.shiftCode}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Shift Name *</label>
                    <input
                      type="text"
                      name="shiftName"
                      value={form.shiftName}
                      onChange={(e) => setForm(p => ({ ...p, shiftName: e.target.value }))}
                      placeholder="e.g., General Shift"
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800"
                      required
                    />
                    {formErrors.shiftName && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.shiftName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time *</label>
                    <input
                      type="time"
                      step="1"
                      name="startTime"
                      value={form.startTime}
                      onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800"
                      required
                    />
                    {formErrors.startTime && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.startTime}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">End Time *</label>
                    <input
                      type="time"
                      step="1"
                      name="endTime"
                      value={form.endTime}
                      onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800"
                      required
                    />
                    {formErrors.endTime && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.endTime}</p>}
                  </div>
                </div>

                {/* Automated Calculations Preview */}
                <div className="bg-cyan-50/70 border border-cyan-200/80 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500 font-medium block text-[11px]">Calculated Working Hours:</span>
                    <span className="font-bold text-cyan-800 font-mono">{computedWorkingHours} mins ({(computedWorkingHours / 60).toFixed(1)}h)</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium block text-[11px]">Night Shift Status:</span>
                    <span className={`font-bold font-mono ${computedNightShift ? 'text-purple-700' : 'text-gray-700'}`}>
                      {computedNightShift ? 'YES (Overnight Wrap)' : 'NO (Day Shift)'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Break Minutes</label>
                    <input
                      type="number"
                      name="breakMinutes"
                      value={form.breakMinutes}
                      onChange={(e) => setForm(p => ({ ...p, breakMinutes: Number(e.target.value) }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800"
                    />
                    {formErrors.breakMinutes && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.breakMinutes}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Grace Period Minutes</label>
                    <input
                      type="number"
                      name="gracePeriodMinutes"
                      value={form.gracePeriodMinutes}
                      onChange={(e) => setForm(p => ({ ...p, gracePeriodMinutes: Number(e.target.value) }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800"
                    />
                    {formErrors.gracePeriodMinutes && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.gracePeriodMinutes}</p>}
                  </div>

                  {!editingShift && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Finalize Buffer Mins</label>
                      <input
                        type="number"
                        name="attendanceFinalizeBufferMinutes"
                        value={form.attendanceFinalizeBufferMinutes}
                        onChange={(e) => setForm(p => ({ ...p, attendanceFinalizeBufferMinutes: Number(e.target.value) }))}
                        className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none text-xs font-semibold text-gray-800"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.overtimeAllowed}
                      onChange={(e) => setForm(p => ({ ...p, overtimeAllowed: e.target.checked }))}
                      className="rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-xs font-semibold text-gray-700">Overtime Permitted</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm(p => ({ ...p, active: e.target.checked }))}
                      className="rounded text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-xs font-semibold text-gray-700">Active Shift Status</span>
                  </label>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsCreateModalOpen(false); setEditingShift(null); }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                  >
                    {isSubmitting ? "Saving..." : editingShift ? "Update Shift" : "Create Shift"}
                  </button>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* ── VIEW SHIFT MODAL ────────────────────────────────────────────── */}
        {viewingShift && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase">Shift Details ({viewingShift.shiftCode})</h3>
                <button type="button" onClick={() => setViewingShift(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Shift Name:</span>
                  <span className="font-bold text-gray-900">{viewingShift.shiftName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Timings:</span>
                  <span className="font-mono font-bold text-cyan-700">{viewingShift.startTime} - {viewingShift.endTime}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Working Hours:</span>
                  <span className="font-semibold text-gray-800">{viewingShift.workingHours || calculateTotalShiftMinutes(viewingShift.startTime, viewingShift.endTime) - viewingShift.breakMinutes} mins</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Break Duration:</span>
                  <span className="font-semibold text-gray-800">{viewingShift.breakMinutes} mins</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Grace Period:</span>
                  <span className="font-semibold text-gray-800">{viewingShift.gracePeriodMinutes} mins</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Night Shift:</span>
                  <span className="font-semibold text-purple-700">{viewingShift.nightShift ? 'YES' : 'NO'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Overtime Permitted:</span>
                  <span className="font-semibold text-blue-700">{viewingShift.overtimeAllowed ? 'Permitted' : 'No'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500 font-medium">Active Status:</span>
                  <span className={`font-bold ${viewingShift.active ? 'text-emerald-600' : 'text-rose-600'}`}>{viewingShift.active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-gray-100 text-right">
                <button
                  type="button"
                  onClick={() => setViewingShift(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── WEEKLY OFF MANAGEMENT MODAL ─────────────────────────────────── */}
        {managingWeeklyOffShift && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100">
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">
                    Weekly Offs ({managingWeeklyOffShift.shiftCode} - {managingWeeklyOffShift.shiftName})
                  </h3>
                </div>
                <button type="button" onClick={() => setManagingWeeklyOffShift(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Add or Edit Weekly Off Pattern */}
                <div className="bg-purple-50/70 border border-purple-200/80 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                      {editingWeeklyOffId ? `Edit Pattern #${editingWeeklyOffId}` : "Add Weekly Off Pattern"}
                    </h4>
                    {editingWeeklyOffId && (
                      <button
                        type="button"
                        onClick={() => { setEditingWeeklyOffId(null); setSelectedWeeklyOffDays(["SUNDAY"]); setSelectedWeekOccurrence("EVERY"); }}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Week Occurrence ENUM</label>
                      <select
                        value={selectedWeekOccurrence}
                        onChange={(e) => setSelectedWeekOccurrence(e.target.value as WeekOccurrenceType)}
                        className="w-full py-1.5 px-2 bg-white border border-gray-200 rounded text-xs font-semibold text-gray-800"
                      >
                        {WEEK_OCCURRENCE_ENUMS.map(occ => (
                          <option key={occ} value={occ}>{occ}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Day of Week ENUM</label>
                      <div className="flex flex-wrap gap-1">
                        {DAY_OF_WEEK_ENUMS.map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSelectedWeeklyOffDays(prev => 
                                editingWeeklyOffId ? [day] : (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
                              );
                            }}
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                              selectedWeeklyOffDays.includes(day) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-200'
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isWeeklyOffSubmitting || selectedWeeklyOffDays.length === 0}
                    onClick={handleAddOrUpdateWeeklyOff}
                    className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-bold transition-all disabled:opacity-60"
                  >
                    {isWeeklyOffSubmitting ? "Saving..." : editingWeeklyOffId ? "Update Weekly Off Pattern" : "Save Weekly Off Pattern"}
                  </button>
                </div>

                {/* Configured Weekly Off Patterns List */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Configured Weekly Off Patterns</h4>
                  {shiftWeeklyOffs.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-2">No weekly off patterns configured for this shift.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {shiftWeeklyOffs.map((w, idx) => (
                        <div key={w.id || idx} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200/80 rounded text-xs">
                          <span className="font-bold text-purple-900 font-mono">
                            {w.weekOccurrence} {w.dayOfWeek}
                          </span>
                          <div className="flex items-center gap-1">
                            {w.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingWeeklyOffId(w.id!);
                                  setSelectedWeeklyOffDays([w.dayOfWeek]);
                                  setSelectedWeekOccurrence(w.weekOccurrence);
                                }}
                                className="text-cyan-600 hover:text-cyan-800 p-1 rounded hover:bg-cyan-50"
                                title="Edit pattern"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {w.id && (
                              <button
                                type="button"
                                onClick={() => handleDeleteWeeklyOff(w.id!)}
                                className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50"
                                title="Delete pattern"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className="pt-4 mt-3 border-t border-gray-100 text-right">
                <button
                  type="button"
                  onClick={() => setManagingWeeklyOffShift(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default ShiftPage;
