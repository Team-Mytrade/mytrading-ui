import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  UserCheck, Calendar, Users, Edit2, Clock, 
  RotateCw, Plus, X, Search, CheckCircle2 
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

// Relative API Base URL (routing via Vite dev proxy)
const BASE_SCHEDULE_URL = '/v1/api/attendance/shiftShedules';

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
  shiftName?: string;
  shiftCode?: string;
  startTime?: string;
  endTime?: string;
  workingHours?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

const EmployeeShiftSchedulePage: React.FC = () => {
  // ── States ─────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [assignments, setAssignments] = useState<AssignmentModel[]>([]);
  const [currentShiftInfo, setCurrentShiftInfo] = useState<CurrentShiftModel | null>(null);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentModel | null>(null);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number>(() => {
    const saved = localStorage.getItem('last_selected_shift_emp_id');
    return saved ? Number(saved) : 0;
  });

  const handleSelectEmployee = (empId: number) => {
    setSelectedEmployeeId(empId);
    if (empId > 0) {
      localStorage.setItem('last_selected_shift_emp_id', String(empId));
    }
  };

  const [form, setForm] = useState<{
    employeeId: number;
    shiftId: number;
    effectiveFrom: string;
    effectiveTo: string;
  }>({
    employeeId: 0,
    shiftId: 3,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  });

  // ── Error Helper ───────────────────────────────────────────────────────
  const handleApiError = (err: any, defaultMsg: string) => {
    const backendMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail;
    ToasterService.error(backendMsg ? String(backendMsg) : defaultMsg);
  };

  // ── Initial Load: Employees & Shifts Dropdowns ─────────────────────────
  const fetchDropdowns = async () => {
    // 1. Employees Dropdown
    try {
      const empRes = await axios.get('/v1/api/payroll/employee/all');
      if (Array.isArray(empRes.data) && empRes.data.length > 0) {
        const mappedEmps = empRes.data.map((e: any) => ({
          id: Number(e.id),
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.fullName || `Employee #${e.id}`,
          code: e.employeeCode || `EMP-${e.id}`
        }));
        setEmployees(mappedEmps);
        
        // Use saved selected ID or default to first employee
        const savedId = localStorage.getItem('last_selected_shift_emp_id');
        if (savedId && mappedEmps.some(e => e.id === Number(savedId))) {
          setSelectedEmployeeId(Number(savedId));
        } else if (mappedEmps.length > 0) {
          setSelectedEmployeeId(mappedEmps[0].id);
          localStorage.setItem('last_selected_shift_emp_id', String(mappedEmps[0].id));
        }
      }
    } catch {
      setEmployees([
        { id: 12, name: "John Doe", code: "EMP-12" },
        { id: 1, name: "Alice Smith", code: "EMP-01" },
        { id: 2, name: "Bob Johnson", code: "EMP-02" }
      ]);
      const savedId = localStorage.getItem('last_selected_shift_emp_id');
      if (!savedId) {
        setSelectedEmployeeId(12);
      }
    }

    // 2. Active Shifts Dropdown
    try {
      const shiftRes = await axios.get('/v1/api/attendance/shifts');
      if (Array.isArray(shiftRes.data) && shiftRes.data.length > 0) {
        const mappedShifts = shiftRes.data.map((s: any) => ({
          id: Number(s.id),
          code: s.shiftCode || 'GEN',
          name: s.shiftName || 'General Shift',
          timings: `${s.startTime?.substring(0, 5) || '09:00'} - ${s.endTime?.substring(0, 5) || '18:00'}`
        }));
        setShifts(mappedShifts);
      }
    } catch {
      setShifts([
        { id: 3, code: "GEN", name: "General Shift", timings: "09:00 - 18:00" },
        { id: 1, code: "A", name: "Morning Shift", timings: "06:00 - 14:00" },
        { id: 2, code: "N", name: "Night Shift", timings: "22:00 - 06:00" }
      ]);
    }
  };

  // ── API 1 & 2: GET ALL SCHEDULES & GET CURRENT SHIFT FOR EMPLOYEE ──────
  // Endpoints: GET /v1/api/attendance/shiftShedules/employee/{empId}
  //            GET /v1/api/attendance/shiftShedules/employee/{empId}/current
  const loadEmployeeSchedules = async (empId: number) => {
    if (!empId) return;
    setLoading(true);

    // GET All Employee Assignments
    try {
      const res = await axios.get(`${BASE_SCHEDULE_URL}/employee/${empId}`);
      if (Array.isArray(res.data)) {
        setAssignments(res.data);
      } else {
        setAssignments([]);
      }
    } catch (err: any) {
      console.warn("Failed to load employee shift schedules:", err);
      setAssignments([]);
    }

    // GET Current Shift for Employee
    try {
      const curRes = await axios.get(`${BASE_SCHEDULE_URL}/employee/${empId}/current`);
      if (curRes.data && typeof curRes.data === 'object') {
        setCurrentShiftInfo(curRes.data);
      } else {
        setCurrentShiftInfo(null);
      }
    } catch {
      setCurrentShiftInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId > 0) {
      loadEmployeeSchedules(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // ── API 3 & 4: CREATE / UPDATE SHIFT ASSIGNMENT ─────────────────────────
  // Create Endpoint: POST /v1/api/attendance/shiftShedules
  // Update Endpoint: PUT /v1/api/attendance/shiftShedules/{id}
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId || !form.shiftId || !form.effectiveFrom || !form.effectiveTo) {
      ToasterService.error("Please fill in Employee, Shift, Effective From, and Effective To dates.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAssignment?.id) {
        // PUT Update Assignment
        const updatePayload = {
          employeeId: Number(form.employeeId),
          shiftId: Number(form.shiftId),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo
        };

        await axios.put(`${BASE_SCHEDULE_URL}/${editingAssignment.id}`, updatePayload);
        ToasterService.success("Employee shift assignment updated successfully!");
      } else {
        // POST Create Assignment
        const createPayload = {
          employeeId: Number(form.employeeId),
          shiftId: Number(form.shiftId),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo
        };

        await axios.post(BASE_SCHEDULE_URL, createPayload);
        ToasterService.success("Shift assigned to employee successfully!");
      }

      setIsModalOpen(false);
      resetForm();
      loadEmployeeSchedules(form.employeeId);
    } catch (err: any) {
      handleApiError(err, "Failed to save employee shift schedule.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setEditingAssignment(null);
    setForm({
      employeeId: selectedEmployeeId || 12,
      shiftId: shifts[0]?.id || 3,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    });
    setIsModalOpen(true);
  };

  const openEditModal = (a: AssignmentModel) => {
    setEditingAssignment(a);
    setForm({
      employeeId: a.employeeId,
      shiftId: a.shiftId,
      effectiveFrom: a.effectiveFrom,
      effectiveTo: a.effectiveTo
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingAssignment(null);
    setForm({
      employeeId: selectedEmployeeId || 12,
      shiftId: shifts[0]?.id || 3,
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    });
  };

  // ── Table Column Definitions ───────────────────────────────────────────
  const columns: ColumnDef<AssignmentModel>[] = [
    {
      key: 'employeeId',
      label: 'Employee',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 block">
            {row.employeeName || `Employee #${row.employeeId}`}
          </span>
          <span className="text-[10px] text-cyan-700 font-mono">ID: {row.employeeId}</span>
        </div>
      )
    },
    {
      key: 'shiftId',
      label: 'Shift',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-slate-800 block">
            {row.shiftName || `Shift #${row.shiftId}`}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">
            {row.shiftCode ? `Code: ${row.shiftCode}` : ''} {row.timings ? `(${row.timings})` : ''}
          </span>
        </div>
      )
    },
    {
      key: 'effectiveFrom',
      label: 'Effective Range',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-mono font-semibold text-slate-700">
          {row.effectiveFrom} <span className="text-gray-400">to</span> {row.effectiveTo}
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
            onClick={() => openEditModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg text-cyan-700 transition-colors"
            title="Edit Assignment"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageMeta title="Employee Shift Schedule" description="Assign and manage work shifts for employees" />
      <PageBreadcrumb pageTitle="Employee Shift Schedule" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Employee Shift Roster & Schedule</h2>
              <p className="text-xs text-gray-500">Assign work shifts and date ranges to individual employees</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Assign Shift
            </button>
            <button
              type="button"
              onClick={() => loadEmployeeSchedules(selectedEmployeeId)}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh Roster"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Employee Selector Bar & Active Shift Status Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-2xs border border-gray-200/80 space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">Select Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => handleSelectEmployee(Number(e.target.value))}
              className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.code}) - ID #{e.id}
                </option>
              ))}
            </select>
          </div>

          {/* Active Current Shift Card */}
          <div className="md:col-span-2 bg-white p-4 rounded-xl shadow-2xs border border-gray-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${currentShiftInfo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {currentShiftInfo ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Active Current Shift</span>
                  {currentShiftInfo ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">Active</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">Unassigned / Out of Shift</span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {currentShiftInfo ? (currentShiftInfo.shiftName || `Shift #${currentShiftInfo.shiftId}`) : 'No active shift assigned'}
                </h3>
                {currentShiftInfo && (
                  <div className="flex items-center gap-3 mt-1 text-[11px] font-mono">
                    {currentShiftInfo.shiftCode && (
                      <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded text-[10px] font-bold">
                        Code: {currentShiftInfo.shiftCode}
                      </span>
                    )}
                    {currentShiftInfo.startTime && (
                      <span className="text-cyan-700 font-semibold">
                        Timings: {currentShiftInfo.startTime} - {currentShiftInfo.endTime}
                      </span>
                    )}
                    {currentShiftInfo.effectiveTo && (
                      <span className="text-slate-500">
                        Effective till: <span className="font-bold text-slate-700">{currentShiftInfo.effectiveTo}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Assignments Master Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={assignments}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by shift or employee..."
            pageSize={5}
            defaultSortKey="effectiveFrom"
            defaultSortOrder="desc"
          />
        </div>

      </div>

      {/* ── MODAL: ASSIGN / EDIT EMPLOYEE SHIFT ──────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  {editingAssignment ? 'Edit Shift Schedule' : 'Assign Shift to Employee'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Employee *</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => setForm(p => ({ ...p, employeeId: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                  required
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.code}) - ID #{e.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Shift *</label>
                <select
                  value={form.shiftId}
                  onChange={(e) => setForm(p => ({ ...p, shiftId: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                  required
                >
                  {shifts.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - [{s.timings}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Effective To *</label>
                  <input
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => setForm(p => ({ ...p, effectiveTo: e.target.value }))}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 outline-none cursor-pointer"
                    required
                  />
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
                  {isSubmitting ? "Saving..." : (editingAssignment ? "Update Schedule" : "Assign Shift")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeShiftSchedulePage;
