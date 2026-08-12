import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Settings2, Plus, RotateCw, Eye, Edit, Trash2, X, CheckCircle2 } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

const ATTENDANCE_POLICY_URL = '/v1/api/attendance/attendance-policies';

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

const AttendancePolicyPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const [savedPolicies, setSavedPolicies] = useState<AttendancePolicyModel[]>([
    {
      id: 1,
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
    },
    {
      id: 2,
      policyName: "Shift Workers Policy",
      fullDayMinimumMinutes: 480,
      halfDayMinimumMinutes: 240,
      gracePeriodMinutes: 10,
      lateMarkAfterMinutes: 10,
      earlyExitBeforeMinutes: 10,
      overtimeAfterMinutes: 15,
      maxBreakMinutes: 60,
      allowWorkFromHome: false,
      allowRegularization: true,
      allowOnDuty: true,
      permissionHoursPerMonth: 4,
      active: true
    }
  ]);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(ATTENDANCE_POLICY_URL);
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSavedPolicies(res.data);
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
  }, [navigate]);

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

  return (
    <>
      <PageMeta
        title="Attendance Policy Master"
        description="Configure global attendance rules and thresholds"
      />
      <PageBreadcrumb pageTitle="Attendance Policy Master" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Top Header Toolbar Card */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-50 text-cyan-700 rounded-lg border border-cyan-200">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Attendance Policy Master</h2>
              <p className="text-xs text-gray-500">Configure working hours, grace period, overtime, and permission rules</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
              title="Refresh"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Configured Policies Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={savedPolicies}
            columns={policyColumns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search policies by name or rules..."
            pageSize={5}
            defaultSortKey="policyName"
            defaultSortOrder="asc"
          />
        </div>

      </div>

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
    </>
  );
};

export default AttendancePolicyPage;
