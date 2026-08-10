import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  UserCheck, Calendar, Users, Layers, Edit2, ShieldCheck, Clock, 
  RotateCw, Plus, X, Search, AlertCircle, CheckCircle2 
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

const SCHEDULE_BASE_URL = '/v1/api/attendance/shiftShedules';

export interface EmployeeOption {
  id: number;
  name: string;
  code: string;
}

export interface ShiftOption {
  id: number;
  code: string;
  name: string;
  timings: string;
  workingHours?: number;
}

export interface AssignmentModel {
  id?: number;
  employeeId: number;
  employeeName?: string;
  shiftId: number;
  shiftName?: string;
  shiftCode?: string;
  timings?: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface CurrentShiftModel {
  employeeId: number;
  employeeName?: string;
  shiftId: number;
  shiftName: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  workingHours: number;
}

const EmployeeShiftSchedulePage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentModel[]>([]);
  const [currentShiftInfo, setCurrentShiftInfo] = useState<CurrentShiftModel | null>(null);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentModel | null>(null);

  const [form, setForm] = useState<{
    employeeId: number;
    shiftId: number;
    effectiveFrom: string;
    effectiveTo: string;
  }>({
    employeeId: 0,
    shiftId: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Error Extraction Helper ────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const status = err.response?.status;
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    
    if (status === 409) {
      ToasterService.error(backendMsg || "Overlapping shift assignment detected for this employee (409 Conflict).");
    } else if (status === 400 || status === 422) {
      ToasterService.error(backendMsg || "Validation Error (400 Bad Request). Check dates and selections.");
    } else if (status === 401 || status === 403) {
      ToasterService.error("Unauthorized / Permission Denied.");
    } else if (status === 404) {
      ToasterService.error("Assignment or Employee not found (404).");
    } else if (status >= 500) {
      ToasterService.error(backendMsg || "Server Error (500). Please try again later.");
    } else {
      ToasterService.error(backendMsg || defaultMsg);
    }
  };

  // ── Load Employees & Active Shifts Dynamic APIs ──────────────────────────
  const fetchInitialDropdowns = async () => {
    let empList: EmployeeOption[] = [];
    let shiftList: ShiftOption[] = [];

    // 1. Employee Dropdown: GET /v1/api/payroll/employee/all
    try {
      const empRes = await axios.get('/v1/api/payroll/employee/all');
      if (Array.isArray(empRes.data) && empRes.data.length > 0) {
        empList = empRes.data.map((e: any) => ({
          id: Number(e.id),
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.fullName || `Employee #${e.id}`,
          code: e.employeeCode || `EMP-${e.id}`
        }));
        setEmployees(empList);
      }
    } catch (e) {}

    // 2. Active Shifts Dropdown: GET /v1/api/attendance/shifts/active
    try {
      let shiftRes;
      try {
        shiftRes = await axios.get('/v1/api/attendance/shifts/active');
      } catch (e) {
        shiftRes = await axios.get('/v1/api/attendance/shifts');
      }

      if (Array.isArray(shiftRes.data) && shiftRes.data.length > 0) {
        shiftList = shiftRes.data.map((s: any) => ({
          id: Number(s.id),
          code: s.shiftCode || 'GEN',
          name: s.shiftName || 'General Shift',
          timings: `${s.startTime || '09:00:00'} - ${s.endTime || '18:00:00'}`,
          workingHours: s.workingHours || 480
        }));
        setShifts(shiftList);
      }
    } catch (e) {}

    const defaultEmpId = empList[0]?.id || 0;
    const defaultShiftId = shiftList[0]?.id || 0;

    setForm(prev => ({
      ...prev,
      employeeId: prev.employeeId || defaultEmpId,
      shiftId: prev.shiftId || defaultShiftId
    }));

    if (defaultEmpId > 0) {
      loadEmployeeSchedules(defaultEmpId, empList, shiftList);
    }
  };

  // ── Load Employee Shift History & Current Shift ─────────────────────────
  const loadEmployeeSchedules = async (
    empId: number,
    empOptions: EmployeeOption[] = employees,
    shiftOptions: ShiftOption[] = shifts
  ) => {
    if (!empId) return;
    setLoading(true);

    // 1. Shift History: GET /shiftShedules/employee/{employeeId}
    try {
      const historyRes = await axios.get(`${SCHEDULE_BASE_URL}/employee/${empId}`);
      if (Array.isArray(historyRes.data)) {
        const mapped = historyRes.data.map((a: any) => {
          const empMatch = empOptions.find(e => e.id === Number(a.employeeId));
          const shiftMatch = shiftOptions.find(s => s.id === Number(a.shiftId));

          return {
            id: Number(a.id),
            employeeId: Number(a.employeeId),
            employeeName: empMatch?.name || `Employee #${a.employeeId}`,
            shiftId: Number(a.shiftId),
            shiftName: shiftMatch?.name || `Shift #${a.shiftId}`,
            shiftCode: shiftMatch?.code || 'GEN',
            timings: shiftMatch?.timings || '09:00:00 - 18:00:00',
            effectiveFrom: String(a.effectiveFrom || '').slice(0, 10),
            effectiveTo: String(a.effectiveTo || '').slice(0, 10)
          };
        });
        setAssignments(mapped);
      } else {
        setAssignments([]);
      }
    } catch (e) {
      setAssignments([]);
    } finally {
      setLoading(false);
    }

    // 2. Current Shift: GET /shiftShedules/employee/{employeeId}/current
    try {
      const currentRes = await axios.get(`${SCHEDULE_BASE_URL}/employee/${empId}/current`);
      if (currentRes.data) {
        const c = currentRes.data;
        const empMatch = empOptions.find(e => e.id === empId);
        setCurrentShiftInfo({
          employeeId: empId,
          employeeName: empMatch?.name || `Employee #${empId}`,
          shiftId: Number(c.shiftId || c.id || 0),
          shiftName: c.shiftName || "General Shift",
          shiftCode: c.shiftCode || "GEN",
          startTime: c.startTime || "09:00:00",
          endTime: c.endTime || "18:00:00",
          workingHours: c.workingHours || 480
        });
      } else {
        setCurrentShiftInfo(null);
      }
    } catch (e) {
      setCurrentShiftInfo(null);
    }
  };

  useEffect(() => {
    fetchInitialDropdowns();
  }, []);

  const handleSelectedEmployeeChange = (empId: number) => {
    setForm(p => ({ ...p, employeeId: empId }));
    loadEmployeeSchedules(empId);
  };

  // ── Validation ─────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.employeeId) errors.employeeId = "Please select an Employee.";
    if (!form.shiftId) errors.shiftId = "Please select a Shift.";
    if (!form.effectiveFrom) errors.effectiveFrom = "Effective From Date is required.";
    if (!form.effectiveTo) errors.effectiveTo = "Effective To Date is required.";

    if (form.effectiveFrom && form.effectiveTo) {
      if (new Date(form.effectiveTo) < new Date(form.effectiveFrom)) {
        errors.effectiveTo = "Effective To date must be greater than or equal to Effective From date.";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit Create or Update Assignment ─────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      if (editingAssignment?.id) {
        // PUT /v1/api/attendance/shiftShedules/{id}
        const putPayload = {
          id: editingAssignment.id,
          employeeId: Number(form.employeeId),
          shiftId: Number(form.shiftId),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo
        };

        const res = await axios.put(`${SCHEDULE_BASE_URL}/${editingAssignment.id}`, putPayload);
        const empMatch = employees.find(e => e.id === Number(form.employeeId));
        const shiftMatch = shifts.find(s => s.id === Number(form.shiftId));

        const updatedRecord: AssignmentModel = res.data || {
          ...putPayload,
          employeeName: empMatch?.name,
          shiftName: shiftMatch?.name,
          shiftCode: shiftMatch?.code,
          timings: shiftMatch?.timings
        };

        setAssignments(prev => prev.map(a => a.id === editingAssignment.id ? updatedRecord : a));
        ToasterService.success("Shift schedule updated successfully!");
        setEditingAssignment(null);
      } else {
        // POST /v1/api/attendance/shiftShedules
        const postPayload = {
          employeeId: Number(form.employeeId),
          shiftId: Number(form.shiftId),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo
        };

        const res = await axios.post(SCHEDULE_BASE_URL, postPayload);
        const empMatch = employees.find(e => e.id === Number(form.employeeId));
        const shiftMatch = shifts.find(s => s.id === Number(form.shiftId));

        const createdRecord: AssignmentModel = res.data || {
          ...postPayload,
          id: Date.now(),
          employeeName: empMatch?.name,
          shiftName: shiftMatch?.name,
          shiftCode: shiftMatch?.code,
          timings: shiftMatch?.timings
        };

        setAssignments(prev => [createdRecord, ...prev]);
        ToasterService.success("Shift assigned successfully!");
        setIsModalOpen(false);
      }

      loadEmployeeSchedules(form.employeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to save shift assignment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setEditingAssignment(null);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (row: AssignmentModel) => {
    setEditingAssignment(row);
    setForm({
      employeeId: row.employeeId,
      shiftId: row.shiftId,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // ── Table Search Filter ────────────────────────────────────────────────
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const q = searchQuery.toLowerCase();
    return assignments.filter(
      a => (a.employeeName || '').toLowerCase().includes(q) || (a.shiftName || '').toLowerCase().includes(q)
    );
  }, [assignments, searchQuery]);

  // ── Table Column Definitions ─────────────────────────────────────────────
  const columns: ColumnDef<AssignmentModel>[] = [
    { key: 'employeeName', label: 'Employee Name', sortable: true, render: (row) => <span className="font-semibold text-gray-900">{row.employeeName}</span> },
    { key: 'employeeId', label: 'Emp ID', sortable: true, render: (row) => <span className="font-mono text-cyan-700 font-bold">#{row.employeeId}</span> },
    { key: 'shiftName', label: 'Assigned Shift', sortable: true, render: (row) => <span className="text-cyan-700 font-bold">{row.shiftName} ({row.shiftCode})</span> },
    { key: 'timings', label: 'Shift Timings', sortable: true, render: (row) => <span className="text-gray-600 font-mono text-xs">{row.timings}</span> },
    { key: 'effectiveFrom', label: 'Effective Date Range', sortable: true, render: (row) => (
        <span className="text-gray-700 text-xs font-mono font-medium">
          {row.effectiveFrom} to {row.effectiveTo}
        </span>
      ) 
    },
    { key: 'actions', label: 'Actions', render: (row) => (
        <button
          type="button"
          onClick={() => openEditModal(row)}
          className="px-2.5 py-1 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-md text-xs font-bold hover:bg-cyan-100 transition-colors flex items-center gap-1"
        >
          <Edit2 className="w-3 h-3" /> Edit Schedule
        </button>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Employee Shift Assignment" description="Assign shifts to employees and view active current shift schedules" />
      <PageBreadcrumb pageTitle="Shift Roster & Schedule" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Current Shift Summary Banner */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-cyan-100 uppercase tracking-widest">Active Current Shift</p>
              <h3 className="text-sm font-extrabold text-white">
                {currentShiftInfo
                  ? `${currentShiftInfo.employeeName} — ${currentShiftInfo.shiftName} (${currentShiftInfo.shiftCode}) [${currentShiftInfo.startTime} - ${currentShiftInfo.endTime}]`
                  : "Select an employee below to load active current shift details"}
              </h3>
            </div>
          </div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-xs text-white text-xs font-bold rounded-full border border-white/30">
            Current Shift
          </span>
        </div>

        {/* Employee Filter & Action Toolbar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-bold text-gray-700 whitespace-nowrap flex items-center gap-1">
              <Users className="w-4 h-4 text-cyan-600" /> Select Employee:
            </label>
            <select
              value={form.employeeId}
              onChange={(e) => handleSelectedEmployeeChange(Number(e.target.value))}
              className="py-1.5 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 outline-none"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => loadEmployeeSchedules(form.employeeId)}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh Assignments"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Assign New Shift
            </button>
          </div>
        </div>

        {/* Employee Shift History Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Employee Shift History & Assignments</h3>
          <ReusableTable
            data={filteredAssignments}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search active schedules..."
            pageSize={5}
            defaultSortKey="employeeName"
            defaultSortOrder="asc"
          />
        </div>

        {/* ── CREATE / EDIT ASSIGNMENT MODAL ─────────────────────────────── */}
        {(isModalOpen || editingAssignment) && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl border border-gray-100">
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">
                    {editingAssignment ? `Edit Assignment #${editingAssignment.id}` : "Assign Shift to Employee"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingAssignment(null); }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Employee Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Employee (Loaded from API) *</label>
                  <select
                    name="employeeId"
                    value={form.employeeId}
                    onChange={(e) => setForm(p => ({ ...p, employeeId: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 outline-none text-xs font-semibold text-gray-800"
                    required
                  >
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>
                    ))}
                  </select>
                  {formErrors.employeeId && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.employeeId}</p>}
                </div>

                {/* Shift Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shift (Loaded from Active Shift API) *</label>
                  <select
                    name="shiftId"
                    value={form.shiftId}
                    onChange={(e) => setForm(p => ({ ...p, shiftId: Number(e.target.value) }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 outline-none text-xs font-semibold text-gray-800"
                    required
                  >
                    {shifts.map(shift => (
                      <option key={shift.id} value={shift.id}>{shift.name} ({shift.timings})</option>
                    ))}
                  </select>
                  {formErrors.shiftId && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.shiftId}</p>}
                </div>

                {/* Date Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Effective From *</label>
                    <input
                      type="date"
                      name="effectiveFrom"
                      value={form.effectiveFrom}
                      onChange={(e) => setForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 outline-none text-xs font-semibold text-gray-800"
                      required
                    />
                    {formErrors.effectiveFrom && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.effectiveFrom}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Effective To *</label>
                    <input
                      type="date"
                      name="effectiveTo"
                      value={form.effectiveTo}
                      onChange={(e) => setForm(p => ({ ...p, effectiveTo: e.target.value }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md focus:bg-white focus:ring-2 focus:ring-cyan-500/20 outline-none text-xs font-semibold text-gray-800"
                      required
                    />
                    {formErrors.effectiveTo && <p className="text-[10px] text-rose-600 mt-0.5">{formErrors.effectiveTo}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setEditingAssignment(null); }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                  >
                    {isSubmitting ? "Saving..." : editingAssignment ? "Update Schedule" : "Assign Shift"}
                  </button>
                </div>

              </form>

            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default EmployeeShiftSchedulePage;
