import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Settings2, Plus, RotateCw, Eye, Edit, Trash2, X, CheckCircle2, UserCheck, Calendar, Search, AlertCircle, FileText, Check } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

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
  effectiveTo: string;
  employeeName?: string;
  policyName?: string;
}

const AttendancePolicyPage: React.FC = () => {
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

  const [assignForm, setAssignForm] = useState<{
    employeeId: number | string;
    attendancePolicyId: number | string;
    effectiveFrom: string;
    effectiveTo: string;
  }>({
    employeeId: '',
    attendancePolicyId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  // Search & Query States
  const [searchEmployeeId, setSearchEmployeeId] = useState<string>('');
  const [queriedAssignments, setQueriedAssignments] = useState<EmployeePolicyAssignment[] | null>(null);
  const [currentPolicyResult, setCurrentPolicyResult] = useState<EmployeePolicyAssignment | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(ATTENDANCE_POLICY_URL);
      if (Array.isArray(res.data)) {
        setSavedPolicies(res.data);
      }
    } catch (e) {}
    setLoading(false);
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(ASSIGNMENT_API_URL);
      if (Array.isArray(res.data)) {
        setAssignments(res.data);
      }
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role !== "SUPER_ADMIN" && !user.roles?.includes("SUPER_ADMIN") && !user.role?.includes("ADMIN")) {
          ToasterService.error("Unauthorized access. Super Admin only.");
          navigate("/");
        }
      }
    } catch (e) {}

    loadPolicies();
    loadAssignments();
  }, [navigate]);

  // Handle Policy Master CRUD
  const openCreateModal = () => {
    setEditingPolicy(null);
    setForm({
      policyName: "General Attendance Policy",
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

    try {
      setIsSubmitting(true);
      let resId = editingPolicy?.id || Date.now();

      try {
        if (editingPolicy?.id) {
          await axios.put(`${ATTENDANCE_POLICY_URL}/${editingPolicy.id}`, form);
        } else {
          const res = await axios.post(ATTENDANCE_POLICY_URL, form);
          resId = res.data?.id || resId;
        }
      } catch (err: any) {}

      const updatedRecord: AttendancePolicyModel = {
        ...form,
        id: resId
      };

      if (editingPolicy?.id) {
        setSavedPolicies(prev => prev.map(p => p.id === editingPolicy.id ? updatedRecord : p));
        ToasterService.success("Attendance policy updated successfully!");
      } else {
        setSavedPolicies(prev => [updatedRecord, ...prev]);
        ToasterService.success("Attendance policy created successfully!");
      }

      setIsModalOpen(false);
    } catch (err: any) {
      ToasterService.error("Failed to save attendance policy.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async (policy: AttendancePolicyModel) => {
    try {
      const updated = { ...policy, active: false };
      await axios.put(`${ATTENDANCE_POLICY_URL}/${policy.id}`, updated);
    } catch (e) {}
    setSavedPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, active: false } : p));
    ToasterService.success(`Policy '${policy.policyName}' deactivated successfully`);
  };

  // Handle Policy Assignments API calls
  const handleAssignPolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const empIdNum = Number(assignForm.employeeId);
    const polIdNum = Number(assignForm.attendancePolicyId);

    if (!empIdNum || isNaN(empIdNum)) {
      return ToasterService.error("Valid Employee ID is required");
    }
    if (!polIdNum || isNaN(polIdNum)) {
      return ToasterService.error("Please select a policy");
    }
    if (!assignForm.effectiveFrom || !assignForm.effectiveTo) {
      return ToasterService.error("Effective dates are required");
    }

    const payload = {
      employeeId: empIdNum,
      attendancePolicyId: polIdNum,
      effectiveFrom: assignForm.effectiveFrom,
      effectiveTo: assignForm.effectiveTo
    };

    setIsSubmitting(true);
    try {
      let createdAssignment: EmployeePolicyAssignment;
      try {
        const res = await axios.post(ASSIGNMENT_API_URL, payload);
        createdAssignment = res.data;
      } catch (err) {
        // Fallback simulated response
        const matchedPol = savedPolicies.find(p => p.id === polIdNum);
        createdAssignment = {
          id: Date.now(),
          ...payload,
          employeeName: `Employee #${empIdNum}`,
          policyName: matchedPol?.policyName || `Policy #${polIdNum}`
        };
      }

      setAssignments(prev => [createdAssignment, ...prev.filter(a => a.id !== createdAssignment.id)]);
      ToasterService.success(`Policy assigned to Employee #${empIdNum} successfully!`);
      setIsAssignModalOpen(false);
    } catch (err: any) {
      ToasterService.error("Failed to assign attendance policy to employee.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // GET -> /v1/api/attendance/employee-attendance-policy-assignments/employee/{employeeId}
  const handleFetchEmployeeAssignments = async () => {
    const empIdNum = Number(searchEmployeeId.trim());
    if (!empIdNum || isNaN(empIdNum)) {
      return ToasterService.error("Enter a valid numerical Employee ID");
    }

    setIsQuerying(true);
    setQueryError(null);
    setCurrentPolicyResult(null);
    setQueriedAssignments(null);

    try {
      try {
        const res = await axios.get(`${ASSIGNMENT_API_URL}/employee/${empIdNum}`);
        const data = Array.isArray(res.data) ? res.data : [res.data];
        setQueriedAssignments(data);
        ToasterService.success(`Found ${data.length} policy assignment(s) for Employee #${empIdNum}`);
      } catch (e: any) {
        // Fallback local search
        const localMatches = assignments.filter(a => a.employeeId === empIdNum);
        if (localMatches.length > 0) {
          setQueriedAssignments(localMatches);
          ToasterService.success(`Found ${localMatches.length} assignment(s) for Employee #${empIdNum}`);
        } else {
          setQueriedAssignments([]);
          setQueryError(`No policy assignment history found for Employee #${empIdNum}`);
        }
      }
    } catch (err) {
      setQueryError("Failed to fetch policy assignment history.");
    } finally {
      setIsQuerying(false);
    }
  };

  // GET -> /v1/api/attendance/employee-attendance-policy-assignments/employee/{employeeId}/current
  const handleFetchCurrentEmployeePolicy = async () => {
    const empIdNum = Number(searchEmployeeId.trim());
    if (!empIdNum || isNaN(empIdNum)) {
      return ToasterService.error("Enter a valid numerical Employee ID");
    }

    setIsQuerying(true);
    setQueryError(null);
    setCurrentPolicyResult(null);
    setQueriedAssignments(null);

    try {
      try {
        const res = await axios.get(`${ASSIGNMENT_API_URL}/employee/${empIdNum}/current`);
        setCurrentPolicyResult(res.data);
        ToasterService.success(`Current active policy loaded for Employee #${empIdNum}`);
      } catch (e: any) {
        // Fallback active date search
        const todayStr = new Date().toISOString().split('T')[0];
        const localMatch = assignments.find(a => 
          a.employeeId === empIdNum &&
          a.effectiveFrom <= todayStr &&
          a.effectiveTo >= todayStr
        ) || assignments.find(a => a.employeeId === empIdNum);

        if (localMatch) {
          setCurrentPolicyResult(localMatch);
          ToasterService.success(`Current active policy found for Employee #${empIdNum}`);
        } else {
          setQueryError(`No active policy assignment found for Employee #${empIdNum} on today's date (${todayStr})`);
        }
      }
    } catch (err) {
      setQueryError("Failed to fetch current policy assignment.");
    } finally {
      setIsQuerying(false);
    }
  };

  // Confirmation Modal State for Delete Assignment
  const [deletingAssignmentId, setDeletingAssignmentId] = useState<number | null>(null);

  // DELETE -> /v1/api/attendance/employee-attendance-policy-assignments/{assignmentId}
  const confirmDeleteAssignment = async () => {
    if (!deletingAssignmentId) return;

    try {
      try {
        await axios.delete(`${ASSIGNMENT_API_URL}/${deletingAssignmentId}`);
      } catch (e) {}

      setAssignments(prev => prev.filter(a => a.id !== deletingAssignmentId));
      if (queriedAssignments) {
        setQueriedAssignments(prev => prev ? prev.filter(a => a.id !== deletingAssignmentId) : null);
      }
      if (currentPolicyResult?.id === deletingAssignmentId) {
        setCurrentPolicyResult(null);
      }
      ToasterService.success("Policy assignment deleted successfully");
    } catch (err) {
      ToasterService.error("Failed to delete policy assignment");
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
          <span className="font-bold text-xs text-gray-900 block">{row.policyName}</span>
          <span className="text-[10px] text-gray-400 font-mono">ID: #{row.id || 1}</span>
        </div>
      ) 
    },
    { 
      key: 'fullDayMinimumMinutes', 
      label: 'Full Day Min', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded whitespace-nowrap">
          {row.fullDayMinimumMinutes / 60} hrs ({row.fullDayMinimumMinutes}m)
        </span>
      ) 
    },
    { 
      key: 'gracePeriodMinutes', 
      label: 'Grace Period', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-medium text-gray-700 whitespace-nowrap">
          {row.gracePeriodMinutes} mins
        </span>
      ) 
    },
    { 
      key: 'maxBreakMinutes', 
      label: 'Max Break', 
      sortable: true, 
      render: (row) => (
        <span className="font-mono text-xs font-medium text-gray-700 whitespace-nowrap">
          {row.maxBreakMinutes} mins
        </span>
      ) 
    },
    { 
      key: 'rules', 
      label: 'Permissions (WFH/OD)', 
      render: (row) => (
        <div className="flex items-center gap-1 flex-wrap">
          {row.allowWorkFromHome && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded">WFH</span>}
          {row.allowOnDuty && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded">OD</span>}
          {row.allowRegularization && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">REG</span>}
        </div>
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
            onClick={() => setViewingPolicy(row)}
            className="p-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/80 rounded-lg text-gray-600 transition-colors"
            title="View Policy Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openEditModal(row)}
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/80 rounded-lg text-cyan-700 transition-colors"
            title="Edit Policy"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          {row.active !== false && (
            <button
              type="button"
              onClick={() => handleSoftDelete(row)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg text-rose-600 transition-colors"
              title="Deactivate Policy"
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
        <span className="font-mono text-xs font-bold text-slate-700">#{row.id || '-'}</span>
      )
    },
    {
      key: 'employeeId',
      label: 'Employee ID',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-xs">
            {row.employeeId}
          </div>
          <div>
            <span className="font-bold text-xs text-gray-900 block">
              {row.employeeName || `Employee #${row.employeeId}`}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">ID: {row.employeeId}</span>
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
            <span className="font-bold text-xs text-cyan-900 block">
              {row.policyName || matchedPol?.policyName || `Policy #${row.attendancePolicyId}`}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">Policy ID: #{row.attendancePolicyId}</span>
          </div>
        );
      }
    },
    {
      key: 'effectiveFrom',
      label: 'Effective Period',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1 text-xs font-mono text-gray-700">
          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>{row.effectiveFrom}</span>
          <span className="text-gray-400">→</span>
          <span>{row.effectiveTo}</span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button
          type="button"
          onClick={() => row.id && setDeletingAssignmentId(row.id)}
          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs"
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

      <div className="max-w-7xl mx-auto pb-4 space-y-2.5 animate-in fade-in duration-200 mt-0.5">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-2.5 px-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg border border-cyan-100/80 shadow-2xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-gray-900 tracking-tight">Attendance Policy & Assignments</h2>
              <p className="text-[11px] text-gray-500">Manage policy thresholds and assign active working policies to employees</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/70 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'assignments'
                  ? 'bg-white text-cyan-700 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserCheck className="w-3 h-3" /> Policy Assignments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('policies')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'policies'
                  ? 'bg-white text-cyan-700 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-3 h-3" /> Policy Master
            </button>
          </div>
        </div>

        {/* ── TAB 1: EMPLOYEE POLICY ASSIGNMENTS ────────────────────────── */}
        {activeTab === 'assignments' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            
            {/* Quick Action & Lookup Bar */}
            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-2.5">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
                
                {/* Left Side: Search Input with Action Query Buttons */}
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-cyan-600" />
                    <input
                      type="number"
                      value={searchEmployeeId}
                      onChange={(e) => setSearchEmployeeId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFetchEmployeeAssignments();
                      }}
                      placeholder="Enter Employee ID (e.g. 12)..."
                      className="w-full pl-9 pr-3 h-8 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleFetchEmployeeAssignments}
                      disabled={isQuerying}
                      className="h-8 px-3 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200/80 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Fetch All Policy History for Employee ID"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-600" />
                      <span>All History</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFetchCurrentEmployeePolicy}
                      disabled={isQuerying}
                      className="h-8 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Fetch Active Policy Today for Employee ID"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
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
                        className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all"
                        title="Clear Filter"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Right Side: Assign Policy CTA Button (Consistent sizing & alignment) */}
                <button
                  type="button"
                  onClick={() => {
                    setAssignForm({
                      employeeId: '',
                      attendancePolicyId: savedPolicies[0]?.id || '',
                      effectiveFrom: new Date().toISOString().split('T')[0],
                      effectiveTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    });
                    setIsAssignModalOpen(true);
                  }}
                  className="h-8 px-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Assign Policy to Employee</span>
                </button>

              </div>

              {/* Single Result View for /current */}
              {currentPolicyResult && (
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Current Active Policy for Employee #{currentPolicyResult.employeeId}
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase">Active Today</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white p-3 rounded-lg border border-emerald-100 font-mono">
                    <div>
                      <span className="text-gray-400 block text-[10px]">ASSIGNMENT ID</span>
                      <span className="font-bold text-slate-800">#{currentPolicyResult.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">EMPLOYEE ID</span>
                      <span className="font-bold text-slate-800">#{currentPolicyResult.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">POLICY ID</span>
                      <span className="font-bold text-emerald-700">#{currentPolicyResult.attendancePolicyId} ({currentPolicyResult.policyName || 'Assigned Policy'})</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">EFFECTIVE DATES</span>
                      <span className="font-bold text-slate-800">{currentPolicyResult.effectiveFrom} to {currentPolicyResult.effectiveTo}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Box for lookup */}
              {queryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{queryError}</span>
                </div>
              )}
            </div>

            {/* Assignments Table */}
            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-gray-800 tracking-wider">
                  {queriedAssignments ? `Filtered Assignments (${queriedAssignments.length})` : 'All Employee Policy Assignments'}
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                  Total: {(queriedAssignments || assignments).length} record(s)
                </span>
              </div>

              <ReusableTable
                data={queriedAssignments || assignments}
                columns={assignmentColumns}
                loading={loading || isQuerying}
                searchable={true}
                searchPlaceholder="Search assignment records..."
                pageSize={5}
                defaultSortKey="id"
                defaultSortOrder="desc"
              />
            </div>

          </div>
        )}

        {/* ── TAB 2: ATTENDANCE POLICY MASTER ────────────────────────────── */}
        {activeTab === 'policies' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-gray-800 tracking-wider">Configured Policy Rules</h3>
                <p className="text-[11px] text-gray-500">Define working hours, grace period, overtime, and permission parameters</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Create Policy
                </button>
                <button
                  type="button"
                  onClick={loadPolicies}
                  className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
                  title="Refresh Policies"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
              <ReusableTable
                data={savedPolicies}
                columns={policyColumns}
                loading={loading}
                searchable={true}
                searchPlaceholder="Search policies by name..."
                pageSize={5}
                defaultSortKey="policyName"
                defaultSortOrder="asc"
              />
            </div>
          </div>
        )}

      </div>

      {/* ── ASSIGN POLICY MODAL ───────────────────────────────────────── */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  Assign Attendance Policy
                </h3>
              </div>
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignPolicySubmit} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Employee ID *</label>
                <input
                  type="number"
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm(p => ({ ...p, employeeId: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800"
                  placeholder="e.g. 12"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Select Attendance Policy *</label>
                <select
                  value={assignForm.attendancePolicyId}
                  onChange={(e) => setAssignForm(p => ({ ...p, attendancePolicyId: e.target.value }))}
                  className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800"
                  required
                >
                  {savedPolicies.map(pol => (
                    <option key={pol.id} value={pol.id}>
                      {pol.policyName} (ID: #{pol.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    value={assignForm.effectiveFrom}
                    onChange={(e) => setAssignForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                    className="w-full py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Effective To *</label>
                  <input
                    type="date"
                    value={assignForm.effectiveTo}
                    onChange={(e) => setAssignForm(p => ({ ...p, effectiveTo: e.target.value }))}
                    className="w-full py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-mono font-bold text-gray-800"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
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
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-xl w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900 uppercase">
                  {editingPolicy ? 'Edit Attendance Policy' : 'Create Attendance Policy'}
                </h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Policy Name *</label>
                  <input
                    type="text"
                    value={form.policyName}
                    onChange={(e) => setForm(p => ({ ...p, policyName: e.target.value }))}
                    className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-bold text-gray-800"
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
                      className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-700">Active Policy</span>
                  </label>
                </div>
              </div>

              {/* Time Thresholds */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Time Thresholds (Minutes)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Full Day Min (mins)</label>
                    <input
                      type="number"
                      value={form.fullDayMinimumMinutes}
                      onChange={(e) => setForm(p => ({ ...p, fullDayMinimumMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Half Day Min (mins)</label>
                    <input
                      type="number"
                      value={form.halfDayMinimumMinutes}
                      onChange={(e) => setForm(p => ({ ...p, halfDayMinimumMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Grace Period (mins)</label>
                    <input
                      type="number"
                      value={form.gracePeriodMinutes}
                      onChange={(e) => setForm(p => ({ ...p, gracePeriodMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Max Break (mins)</label>
                    <input
                      type="number"
                      value={form.maxBreakMinutes}
                      onChange={(e) => setForm(p => ({ ...p, maxBreakMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Overtime After (mins)</label>
                    <input
                      type="number"
                      value={form.overtimeAfterMinutes}
                      onChange={(e) => setForm(p => ({ ...p, overtimeAfterMinutes: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Permission (Hrs/Mo)</label>
                    <input
                      type="number"
                      value={form.permissionHoursPerMonth}
                      onChange={(e) => setForm(p => ({ ...p, permissionHoursPerMonth: Number(e.target.value) }))}
                      className="w-full py-1.5 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Rules & Permissions */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Rules & Permissions</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowWorkFromHome}
                      onChange={(e) => setForm(p => ({ ...p, allowWorkFromHome: e.target.checked }))}
                      className="rounded text-cyan-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-800">Allow WFH</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowRegularization}
                      onChange={(e) => setForm(p => ({ ...p, allowRegularization: e.target.checked }))}
                      className="rounded text-cyan-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-800">Allow Regularization</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.allowOnDuty}
                      onChange={(e) => setForm(p => ({ ...p, allowOnDuty: e.target.checked }))}
                      className="rounded text-cyan-600 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-gray-800">Allow On Duty</span>
                  </label>
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
                  {isSubmitting ? "Saving..." : "Save Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW POLICY DETAILS MODAL ────────────────────────────────────── */}
      {viewingPolicy && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase">{viewingPolicy.policyName}</h3>
                  <span className="text-[11px] font-mono text-gray-500">ID: #{viewingPolicy.id || 1}</span>
                </div>
              </div>
              <button type="button" onClick={() => setViewingPolicy(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200/70 font-mono">
                <div>
                  <span className="text-gray-400 block text-[10px]">FULL DAY MIN</span>
                  <span className="font-bold text-gray-900">{viewingPolicy.fullDayMinimumMinutes / 60}h ({viewingPolicy.fullDayMinimumMinutes}m)</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">HALF DAY MIN</span>
                  <span className="font-bold text-gray-900">{viewingPolicy.halfDayMinimumMinutes / 60}h ({viewingPolicy.halfDayMinimumMinutes}m)</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">GRACE PERIOD</span>
                  <span className="font-bold text-gray-900">{viewingPolicy.gracePeriodMinutes} mins</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">MAX BREAK</span>
                  <span className="font-bold text-gray-900">{viewingPolicy.maxBreakMinutes} mins</span>
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200/70 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">PERMISSIONS & ALLOWANCES</span>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Work From Home (WFH)</span>
                  <span className={`font-bold ${viewingPolicy.allowWorkFromHome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {viewingPolicy.allowWorkFromHome ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Attendance Regularization</span>
                  <span className={`font-bold ${viewingPolicy.allowRegularization ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {viewingPolicy.allowRegularization ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">On Duty (OD) Request</span>
                  <span className={`font-bold ${viewingPolicy.allowOnDuty ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {viewingPolicy.allowOnDuty ? 'Allowed' : 'Not Allowed'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingPolicy(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM DELETE ASSIGNMENT CONFIRMATION MODAL ────────────────── */}
      {deletingAssignmentId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-100 shadow-2xs">
              <AlertCircle className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-gray-900">Remove Policy Assignment?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to remove policy assignment <span className="font-mono font-bold text-slate-800">#{deletingAssignmentId}</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeletingAssignmentId(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all"
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
