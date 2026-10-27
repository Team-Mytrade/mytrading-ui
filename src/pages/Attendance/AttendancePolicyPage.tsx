import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Settings2, Plus, RotateCw, Eye, Edit, Trash2, X, CheckCircle2, UserCheck, Calendar, Search, AlertCircle, FileText, Check } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import TableToolbar from '../../components/common/TableToolbar';
import { ToasterService } from '../../Services/ToasterService';
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "./attendanceApi";

const ATTENDANCE_POLICY_URL = '/v1/api/attendance/attendance-policies';
const ASSIGNMENT_API_URL = '/v1/api/attendance/employee-attendance-policy-assignments';

interface AttendancePolicyModel {
  id?: number;
  policyName: string;
  fullDayMinimumMinutes: number;
  halfDayMinimumMinutes: number;
  gracePeriodMinutes: number;
  lateMarkAfterMinutes: number;
  earlyExitBeforeMinutes: number;
  overtimeAfterMinutes: number;
  maxBreakMinutes: number;
  allowWorkFromHome: boolean;
  allowRegularization: boolean;
  allowOnDuty: boolean;
  permissionHoursPerMonth: number;
  active: boolean;
}

export interface EmployeePolicyAssignment {
  id?: number;
  employeeId: number;
  attendancePolicyId: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  attendancePolicyName?: string;
  active?: boolean;
}

const AttendancePolicyPage: React.FC = () => {
  const { canCreate, canDelete, canUpdate } = usePermissions();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'assignments' | 'policies'>('assignments');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Policy Master States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AttendancePolicyModel | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<AttendancePolicyModel | null>(null);
  const [form, setForm] = useState<AttendancePolicyModel>({
    policyName: "Standard HQ Policy",
    fullDayMinimumMinutes: 480,
    halfDayMinimumMinutes: 240,
    gracePeriodMinutes: 15,
    lateMarkAfterMinutes: 15,
    earlyExitBeforeMinutes: 15,
    overtimeAfterMinutes: 30,
    maxBreakMinutes: 90,
    allowWorkFromHome: true,
    allowRegularization: true,
    allowOnDuty: true,
    permissionHoursPerMonth: 8,
    active: true
  });
  const [savedPolicies, setSavedPolicies] = useState<AttendancePolicyModel[]>([]);

  // Policy Assignment States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignments, setAssignments] = useState<EmployeePolicyAssignment[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string; employeeCode?: string }[]>([]);

  const [assignForm, setAssignForm] = useState<{
    employeeId: number | string;
    attendancePolicyId: number | string;
    effectiveFrom: string;
    effectiveTo: string;
  }>({
    employeeId: '',
    attendancePolicyId: '',
    effectiveFrom: todayIso(),
    effectiveTo: ''
  });

  // Search & Query States
  const [searchEmployeeId, setSearchEmployeeId] = useState<string>('');
  const [queriedAssignments, setQueriedAssignments] = useState<EmployeePolicyAssignment[] | null>(null);
  const [currentPolicyResult, setCurrentPolicyResult] = useState<EmployeePolicyAssignment | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const employeeName = (id: number) => employees.find((e) => e.id === id)?.name ?? `Employee #${id}`;

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(ATTENDANCE_POLICY_URL);
      setSavedPolicies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load attendance policies."));
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(ASSIGNMENT_API_URL);
      setAssignments(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load policy assignments."));
    } finally {
      setLoading(false);
    }
  };

  // Access follows the ATTENDANCE module permissions (route guard and buttons), not the old role names
  useEffect(() => {
    loadPolicies();
    loadAssignments();
    axios.get('/v1/api/attendance/employees')
      .then((res) => setEmployees(Array.isArray(res.data) ? res.data : []))
      .catch(() => setEmployees([]));
  }, []);

  // Handle Policy Master CRUD
  const openCreateModal = () => {
    setEditingPolicy(null);
    setForm({
      policyName: "",
      fullDayMinimumMinutes: 480,
      halfDayMinimumMinutes: 240,
      gracePeriodMinutes: 15,
      lateMarkAfterMinutes: 15,
      earlyExitBeforeMinutes: 15,
      overtimeAfterMinutes: 30,
      maxBreakMinutes: 90,
      allowWorkFromHome: true,
      allowRegularization: true,
      allowOnDuty: true,
      permissionHoursPerMonth: 8,
      active: savedPolicies.every((p) => !p.active)
    });
    setIsModalOpen(true);
  };

  const openEditModal = (policy: AttendancePolicyModel) => {
    setEditingPolicy(policy);
    setForm(policy);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.policyName.trim()) {
      return ToasterService.error("Policy Name is required");
    }
    if (form.halfDayMinimumMinutes > form.fullDayMinimumMinutes) {
      return ToasterService.error("The half-day minimum can't be more than the full-day minimum.");
    }

    setIsSubmitting(true);
    try {
      const payload = { ...form, policyName: form.policyName.trim() };
      if (editingPolicy?.id) {
        await axios.put(`${ATTENDANCE_POLICY_URL}/${editingPolicy.id}`, payload);
        ToasterService.success("Attendance policy updated.");
      } else {
        await axios.post(ATTENDANCE_POLICY_URL, payload);
        ToasterService.success("Attendance policy created.");
      }
      setIsModalOpen(false);
      loadPolicies();
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to save the attendance policy."));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Only one policy is the company default (used for everyone without an assignment)
  const handleMakeDefault = async (policy: AttendancePolicyModel) => {
    try {
      await axios.put(`${ATTENDANCE_POLICY_URL}/${policy.id}`, { ...policy, active: true });
      ToasterService.success(`'${policy.policyName}' is now the company default.`);
      loadPolicies();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not change the default policy."));
    }
  };

  const handleSoftDelete = async (policy: AttendancePolicyModel) => {
    if (!window.confirm(`Stop using '${policy.policyName}' as the company default? Employees without an assigned policy won't be able to punch until another policy is the default.`)) return;
    try {
      await axios.delete(`${ATTENDANCE_POLICY_URL}/${policy.id}`);
      ToasterService.success(`'${policy.policyName}' is no longer the default.`);
      loadPolicies();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not change the policy."));
    }
  };

  // Handle Policy Assignments API calls
  const handleAssignPolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empIdNum = Number(assignForm.employeeId);
    const polIdNum = Number(assignForm.attendancePolicyId);

    if (!empIdNum) return ToasterService.error("Choose an employee");
    if (!polIdNum) return ToasterService.error("Choose a policy");
    if (!assignForm.effectiveFrom) return ToasterService.error("Effective from is required");
    if (assignForm.effectiveTo && assignForm.effectiveTo < assignForm.effectiveFrom) {
      return ToasterService.error("Effective to can't be before effective from");
    }

    setIsSubmitting(true);
    try {
      await axios.post(ASSIGNMENT_API_URL, {
        employeeId: empIdNum,
        attendancePolicyId: polIdNum,
        effectiveFrom: assignForm.effectiveFrom,
        effectiveTo: assignForm.effectiveTo || null
      });
      ToasterService.success(`Policy assigned to ${employeeName(empIdNum)}.`);
      setIsAssignModalOpen(false);
      loadAssignments();
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to assign the attendance policy."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchEmployeeAssignments = async () => {
    const empIdNum = Number(searchEmployeeId);
    if (!empIdNum) return ToasterService.error("Choose an employee");

    setIsQuerying(true);
    setQueryError(null);
    setCurrentPolicyResult(null);
    setQueriedAssignments(null);
    try {
      const res = await axios.get(`${ASSIGNMENT_API_URL}/employee/${empIdNum}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setQueriedAssignments(data);
      if (data.length === 0) setQueryError(`${employeeName(empIdNum)} has no policy assignments; the company default applies.`);
    } catch (err) {
      setQueryError(apiError(err, "Failed to fetch policy assignment history."));
    } finally {
      setIsQuerying(false);
    }
  };

  const handleFetchCurrentEmployeePolicy = async () => {
    const empIdNum = Number(searchEmployeeId);
    if (!empIdNum) return ToasterService.error("Choose an employee");

    setIsQuerying(true);
    setQueryError(null);
    setCurrentPolicyResult(null);
    setQueriedAssignments(null);
    try {
      const res = await axios.get(`${ASSIGNMENT_API_URL}/employee/${empIdNum}/current`);
      setCurrentPolicyResult(res.data);
    } catch {
      const fallback = savedPolicies.find((p) => p.active);
      setQueryError(`${employeeName(empIdNum)} has no assigned policy today, so ${fallback ? `the company default '${fallback.policyName}'` : 'no policy (none is set as default)'} applies.`);
    } finally {
      setIsQuerying(false);
    }
  };

  // Confirmation Modal State for Delete Assignment
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<number | null>(null);

  const confirmDeleteAssignment = async () => {
    if (!deletingAssignmentId) return;
    try {
      await axios.delete(`${ASSIGNMENT_API_URL}/${deletingAssignmentId}`);
      setAssignments(prev => prev.filter(a => a.id !== deletingAssignmentId));
      if (queriedAssignments) {
        setQueriedAssignments(prev => prev ? prev.filter(a => a.id !== deletingAssignmentId) : null);
      }
      if (currentPolicyResult?.id === deletingAssignmentId) {
        setCurrentPolicyResult(null);
      }
      ToasterService.success("Policy assignment removed");
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to remove the policy assignment"));
    } finally {
      setDeletingAssignmentId(null);
    }
  };
  const policyColumns: ColumnDef<AttendancePolicyModel>[] = [
    { 
      key: 'policyName', 
      label: 'Policy Name', 
      sortable: true, 
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 dark:text-white block">{row.policyName}</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">ID: #{row.id || 1}</span>
        </div>
      ) 
    },
    { 
      key: 'fullDayMinimumMinutes', 
      label: 'Full Day Min', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-bold text-cyan-800 dark:text-gray-300 bg-cyan-50 dark:bg-transparent border border-cyan-200 dark:border-transparent px-2 py-0.5 rounded whitespace-nowrap">
          {row.fullDayMinimumMinutes / 60} hrs ({row.fullDayMinimumMinutes}m)
        </span>
      ) 
    },
    { 
      key: 'gracePeriodMinutes', 
      label: 'Grace Period', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {row.gracePeriodMinutes} mins
        </span>
      ) 
    },
    { 
      key: 'maxBreakMinutes', 
      label: 'Max Break', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {row.maxBreakMinutes} mins
        </span>
      ) 
    },
    { 
      key: 'rules', 
      label: 'Permissions (WFH/OD)', 
      render: (row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {row.allowWorkFromHome && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 dark:bg-transparent text-blue-700 dark:text-gray-300 border border-blue-200 dark:border-transparent rounded">WFH</span>}
          {row.allowOnDuty && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-50 dark:bg-transparent text-purple-700 dark:text-gray-300 border border-purple-200 dark:border-transparent rounded">OD</span>}
          {row.allowRegularization && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 dark:bg-transparent text-emerald-700 dark:text-gray-300 border border-emerald-200 dark:border-transparent rounded">REG</span>}
        </div>
      ) 
    },
    { 
      key: 'active', 
      label: 'Status', 
      sortable: true, 
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-2xs whitespace-nowrap border ${
          row.active
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent' 
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent'
        }`}>
          {row.active ? 'Company default' : 'Assignable'}
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
            onClick={() => setViewingPolicy(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 dark:bg-transparent dark:hover:bg-[#222222] border border-gray-200/80 dark:!border-transparent rounded-lg text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="View Policy Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {canUpdate && (<button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 dark:bg-transparent dark:hover:bg-[#222222] border border-cyan-200/80 dark:!border-transparent rounded-lg text-cyan-700 dark:text-gray-400 dark:hover:text-cyan-400 transition-colors"
            title="Edit Policy"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>)}
          {!row.active && canUpdate && (
            <button
              type="button"
              onClick={() => handleMakeDefault(row)}
              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-transparent dark:hover:bg-[#222222] border border-emerald-200/80 dark:!border-transparent rounded-lg text-emerald-700 dark:text-gray-400 text-[10px] font-bold transition-colors"
              title="Use this policy for everyone without an assigned policy"
            >
              Make default
            </button>
          )}
          {row.active && (
            canUpdate && <button
              type="button"
              onClick={() => handleSoftDelete(row)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-transparent dark:hover:bg-[#222222] border border-rose-200/80 dark:!border-transparent rounded-lg text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 transition-colors"
              title="Stop using as the company default"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  const assignmentColumns: ColumnDef<EmployeePolicyAssignment>[] = [
    {
      key: 'id',
      label: 'Assignment ID',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-700 dark:text-gray-300">#{row.id || '-'}</span>
      )
    },
    {
      key: 'employeeId',
      label: 'Employee ID',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-100 dark:bg-[#222222] text-cyan-800 dark:text-gray-300 flex items-center justify-center font-bold text-xs">
            {employeeName(row.employeeId).charAt(0)}
          </div>
          <div>
            <span className="font-bold text-xs text-gray-900 dark:text-white block">
              {employeeName(row.employeeId)}
            </span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">ID: {row.employeeId}</span>
          </div>
        </div>
      )
    },
    {
      key: 'attendancePolicyId',
      label: 'Assigned Policy',
      sortable: true,
      render: (row) => {
        const matchedPol = savedPolicies.find(p => p.id === row.attendancePolicyId);
        return (
          <div>
            <span className="font-bold text-xs text-cyan-900 dark:text-cyan-300 block">
              {row.attendancePolicyName || matchedPol?.policyName || `Policy #${row.attendancePolicyId}`}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">Policy ID: #{row.attendancePolicyId}</span>
          </div>
        );
      }
    },
    {
      key: 'effectiveFrom',
      label: 'Effective Period',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-xs font-mono text-gray-700 dark:text-gray-300">
          <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
          <span>{row.effectiveFrom}</span>
          <span className="text-gray-400 dark:text-gray-500">→</span>
          <span>{row.effectiveTo || 'ongoing'}</span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        canDelete && <button
          type="button"
          onClick={() => row.id && setDeletingAssignmentId(row.id)}
          className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-transparent dark:hover:bg-[#222222] text-rose-600 dark:text-gray-400 dark:hover:text-rose-400 border border-rose-200/80 dark:!border-transparent rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
          title="Delete Assignment"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
      )
    }
  ];

  return (
    <>
      <PageMeta
        title="Employee Attendance Policy Assignments"
        description="Assign and manage employee attendance policies"
      />
      <PageBreadcrumb pageTitle="Attendance Policy & Assignments" />

      <div className="max-w-7xl mx-auto pb-4 space-y-2.5 animate-in fade-in duration-200">
        
        {/* Navigation Tabs */}
        <div className="flex items-center w-fit bg-gray-100/80 dark:bg-[#222222] p-0.5 rounded-lg border border-gray-200/70 dark:!border-transparent text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'assignments'
                  ? 'bg-white dark:bg-[#191919] text-cyan-700 dark:text-cyan-400 shadow-2xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <UserCheck className="w-3 h-3" /> Policy Assignments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('policies')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'policies'
                  ? 'bg-white dark:bg-[#191919] text-cyan-700 dark:text-cyan-400 shadow-2xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3" /> Policy Master
            </button>
        </div>

        {/* ── TAB 1: EMPLOYEE POLICY ASSIGNMENTS ────────────────────────── */}
        {activeTab === 'assignments' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            
            {/* Quick Action & Lookup Bar */}
            <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:!border-transparent p-2.5">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                
                {/* Left Side: Search Input with Action Query Buttons */}
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-cyan-600 dark:text-cyan-400" />
                    <select
                      value={searchEmployeeId}
                      onChange={(e) => setSearchEmployeeId(e.target.value)}
                      className="w-full pl-9 pr-3 h-8 bg-slate-50 dark:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-[#191919] focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                    >
                      <option value="">Choose an employee to look up...</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}{e.employeeCode ? ` (${e.employeeCode})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleFetchEmployeeAssignments}
                      disabled={isQuerying}
                      className="h-8 px-3 bg-cyan-50 hover:bg-cyan-100 dark:bg-transparent dark:hover:bg-[#222222] text-cyan-700 dark:text-gray-300 border border-cyan-200/80 dark:!border-transparent rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Fetch All Policy History for Employee ID"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>All History</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFetchCurrentEmployeePolicy}
                      disabled={isQuerying}
                      className="h-8 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-transparent dark:hover:bg-[#222222] text-emerald-700 dark:text-gray-300 border border-emerald-200/80 dark:!border-transparent rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Fetch Active Policy Today for Employee ID"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Current Active</span>
                    </button>

                    {(queriedAssignments || currentPolicyResult || queryError) && (
                      <button
                        type="button"
                        onClick={() => {
                          setQueriedAssignments(null);
                          setCurrentPolicyResult(null);
                          setQueryError(null);
                          setSearchEmployeeId('');
                        }}
                        className="h-8 w-8 flex items-center justify-center text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-[#222222] border border-slate-200 dark:!border-transparent rounded-lg transition-all"
                        title="Clear Filter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Side: Assign Policy CTA Button (Consistent sizing & alignment) */}
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignForm({
                        employeeId: '',
                        attendancePolicyId: savedPolicies[0]?.id || '',
                        effectiveFrom: todayIso(),
                        effectiveTo: ''
                      });
                      setIsAssignModalOpen(true);
                    }}
                    className="h-8 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Assign Policy to Employee</span>
                  </button>
                )}

              </div>

              {/* Single Result View for /current */}
              {currentPolicyResult && (
                <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:!border-transparent rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Current policy of {employeeName(currentPolicyResult.employeeId)}
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase">Active Today</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white dark:bg-[#222222] p-3 rounded-lg border border-emerald-100 dark:!border-transparent font-mono">
                    <div>
                      <span className="text-gray-400 dark:text-gray-500 block text-[10px]">ASSIGNMENT ID</span>
                      <span className="font-bold text-slate-800 dark:text-white">#{currentPolicyResult.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500 block text-[10px]">EMPLOYEE ID</span>
                      <span className="font-bold text-slate-800 dark:text-white">#{currentPolicyResult.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500 block text-[10px]">POLICY ID</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">{currentPolicyResult.attendancePolicyName || `#${currentPolicyResult.attendancePolicyId}`}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500 block text-[10px]">EFFECTIVE DATES</span>
                      <span className="font-bold text-slate-800 dark:text-white">{currentPolicyResult.effectiveFrom} to {currentPolicyResult.effectiveTo || 'ongoing'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Box for lookup */}
              {queryError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:!border-transparent rounded-lg text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{queryError}</span>
                </div>
              )}
            </div>

            {/* Assignments Table */}
            <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:!border-transparent p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-gray-800 dark:text-white tracking-wider">
                  {queriedAssignments ? `Filtered Assignments (${queriedAssignments.length})` : 'All Employee Policy Assignments'}
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Total: {(queriedAssignments || assignments).length} record(s)
                  </span>
                  <TableToolbar onRefresh={loadAssignments} />
                </div>
              </div>

              <ReusableTable
                data={queriedAssignments || assignments}
                columns={assignmentColumns}
                loading={loading || isQuerying}
                pageSize={10}
                defaultSortKey="id"
                defaultSortOrder="desc"
              />
            </div>

          </div>
        )}

        {/* ── TAB 2: ATTENDANCE POLICY MASTER ────────────────────────────── */}
        {activeTab === 'policies' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:!border-transparent p-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-800 dark:text-white tracking-wider">Configured Policy Rules</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">Define working hours, grace period, overtime, and permission parameters</p>
              </div>

              <div className="flex items-center gap-2">
                {canCreate && (
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Create Policy
                  </button>
                )}
                <button
                  type="button"
                  onClick={loadPolicies}
                  className="p-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 border border-gray-200 dark:!border-transparent rounded-lg transition-all"
                  title="Refresh Policies"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600 dark:text-cyan-400' : ''}`} />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#191919] rounded-xl shadow-2xs border border-gray-200/80 dark:!border-transparent p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase text-gray-800 dark:text-white tracking-wider">Configured Policy Rules</h3>
                <TableToolbar onRefresh={loadPolicies} />
              </div>
              <ReusableTable
                data={savedPolicies}
                columns={policyColumns}
                loading={loading}
                pageSize={10}
                defaultSortKey="policyName"
                defaultSortOrder="asc"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── ASSIGN POLICY MODAL ───────────────────────────────────────── */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:!border-transparent">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                  Assign Attendance Policy
                </h3>
              </div>
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPolicySubmit} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
                <select
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm(p => ({ ...p, employeeId: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-md text-xs font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                  required
                >
                  <option value="">Choose an employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}{e.employeeCode ? ` (${e.employeeCode})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Select Attendance Policy *</label>
                <select
                  value={assignForm.attendancePolicyId}
                  onChange={(e) => setAssignForm(p => ({ ...p, attendancePolicyId: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-md text-xs font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                  required
                >
                  {savedPolicies.map(pol => (
                    <option key={pol.id} value={pol.id}>
                      {pol.policyName}{pol.active ? ' (company default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={assignForm.effectiveFrom}
                    onChange={(e) => setAssignForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                    className="w-full py-2 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-md text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Effective To (blank = ongoing)</label>
                  <input
                    type="date"
                    value={assignForm.effectiveTo}
                    min={assignForm.effectiveFrom}
                    onChange={(e) => setAssignForm(p => ({ ...p, effectiveTo: e.target.value }))}
                    className="w-full py-2 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-md text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:!border-transparent flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:!border-transparent rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                >
                  {isSubmitting ? "Assigning..." : "Assign Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT ATTENDANCE POLICY MODAL ───────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-xl max-w-xl w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:!border-transparent">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                  {editingPolicy ? 'Edit Attendance Policy' : 'Create Attendance Policy'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Policy Name *</label>
                  <input
                    type="text"
                    value={form.policyName}
                    onChange={(e) => setForm(p => ({ ...p, policyName: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-md text-xs font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    placeholder="e.g. Standard HQ Policy"
                    required
                  />
                </div>

                <div className="pt-6">
                  <label className="flex items-center cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm(p => ({ ...p, active: e.target.checked }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Active Policy</span>
                  </label>
                </div>
              </div>

              {/* Time Thresholds */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:!border-transparent">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">Time Thresholds (Minutes)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Full Day Min (mins)</label>
                    <input
                      type="number"
                      value={form.fullDayMinimumMinutes}
                      onChange={(e) => setForm(p => ({ ...p, fullDayMinimumMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Half Day Min (mins)</label>
                    <input
                      type="number"
                      value={form.halfDayMinimumMinutes}
                      onChange={(e) => setForm(p => ({ ...p, halfDayMinimumMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Grace Period (mins)</label>
                    <input
                      type="number"
                      value={form.gracePeriodMinutes}
                      onChange={(e) => setForm(p => ({ ...p, gracePeriodMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Max Break (mins)</label>
                    <input
                      type="number"
                      value={form.maxBreakMinutes}
                      onChange={(e) => setForm(p => ({ ...p, maxBreakMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Overtime After (mins)</label>
                    <input
                      type="number"
                      value={form.overtimeAfterMinutes}
                      onChange={(e) => setForm(p => ({ ...p, overtimeAfterMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Permission (Hrs/Mo)</label>
                    <input
                      type="number"
                      value={form.permissionHoursPerMonth}
                      onChange={(e) => setForm(p => ({ ...p, permissionHoursPerMonth: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded text-xs font-mono font-bold text-gray-800 dark:text-white focus:bg-white dark:focus:bg-[#191919] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Rules & Permissions */}
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:!border-transparent">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">Rules & Permissions</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowWorkFromHome}
                      onChange={(e) => setForm(p => ({ ...p, allowWorkFromHome: e.target.checked }))}
                      className="rounded text-cyan-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-800 dark:text-white">Allow WFH</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowRegularization}
                      onChange={(e) => setForm(p => ({ ...p, allowRegularization: e.target.checked }))}
                      className="rounded text-cyan-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-800 dark:text-white">Allow Regularization</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowOnDuty}
                      onChange={(e) => setForm(p => ({ ...p, allowOnDuty: e.target.checked }))}
                      className="rounded text-cyan-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-800 dark:text-white">Allow On Duty</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:!border-transparent flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:!border-transparent rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                >
                  {isSubmitting ? "Saving..." : "Save Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW POLICY DETAILS MODAL ────────────────────────────────────── */}
      {viewingPolicy && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:!border-transparent">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase">{viewingPolicy.policyName}</h3>
                  <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">ID: #{viewingPolicy.id || 1}</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewingPolicy(null)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-[#222222] p-3 rounded-lg border border-gray-200/70 dark:!border-transparent font-mono">
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block text-[10px]">FULL DAY MIN</span>
                  <span className="font-bold text-gray-900 dark:text-white">{viewingPolicy.fullDayMinimumMinutes / 60}h ({viewingPolicy.fullDayMinimumMinutes}m)</span>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block text-[10px]">HALF DAY MIN</span>
                  <span className="font-bold text-gray-900 dark:text-white">{viewingPolicy.halfDayMinimumMinutes / 60}h ({viewingPolicy.halfDayMinimumMinutes}m)</span>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block text-[10px]">GRACE PERIOD</span>
                  <span className="font-bold text-gray-900 dark:text-white">{viewingPolicy.gracePeriodMinutes} mins</span>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block text-[10px]">MAX BREAK</span>
                  <span className="font-bold text-gray-900 dark:text-white">{viewingPolicy.maxBreakMinutes} mins</span>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-[#222222] p-3 rounded-lg border border-gray-200/70 dark:!border-transparent space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">PERMISSIONS & ALLOWANCES</span>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Work From Home (WFH)</span>
                  <span className={`font-bold ${viewingPolicy.allowWorkFromHome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {viewingPolicy.allowWorkFromHome ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Attendance Regularization</span>
                  <span className={`font-bold ${viewingPolicy.allowRegularization ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {viewingPolicy.allowRegularization ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700 dark:text-gray-300">On Duty (OD) Request</span>
                  <span className={`font-bold ${viewingPolicy.allowOnDuty ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {viewingPolicy.allowOnDuty ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 dark:!border-transparent flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingPolicy(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-[#222222] dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:!border-transparent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM DELETE ASSIGNMENT CONFIRMATION MODAL ────────────────── */}
      {deletingAssignmentId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#191919] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 dark:!border-transparent space-y-4 text-center text-slate-900 dark:text-white">
            <div className="mx-auto w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center border border-rose-100 dark:!border-transparent shadow-2xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Remove Policy Assignment?</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Are you sure you want to remove policy assignment <span className="font-mono font-bold text-slate-800 dark:text-white">#{deletingAssignmentId}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2 border-t border-gray-100 dark:!border-transparent">
              <button
                type="button"
                onClick={() => setDeletingAssignmentId(null)}
                className="px-4 py-2 border border-gray-200 dark:!border-transparent rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAssignment}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AttendancePolicyPage;
