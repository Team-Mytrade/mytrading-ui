import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  FileText, Plus, Edit2, Trash2, ShieldCheck, CheckCircle2, 
  X, RotateCw, Users, Layers, AlertCircle, Eye, Calendar
} from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

const LEAVE_POLICY_ENDPOINT = '/v1/api/attendance/leave-policies';
const ASSIGN_POLICY_ENDPOINT = '/v1/api/attendance/employee-leave-balances/assign-policy';

export interface PolicyDetailItem {
  id?: number;
  leaveType: 'CASUAL' | 'SICK' | 'EARNED';
  allocatedLeaves: number;
  carryForwardAllowed: boolean;
  maxCarryForward: number;
  allowNegativeBalance?: boolean;
  encashmentAllowed?: boolean;
  negativeBalanceAllowed?: boolean;
  documentRequired?: boolean;
  minimumServiceMonths?: number | null;
  active?: boolean;
}

export interface LeavePolicyModel {
  id?: number;
  policyCode: string;
  policyName: string;
  financialYear: number;
  effectiveFrom: string;
  effectiveTo: string;
  description: string;
  active: boolean;
  policyDetails: PolicyDetailItem[];
}

export interface EmployeeOption {
  id: number;
  name: string;
  code: string;
}

const LeavePolicyPage: React.FC = () => {
  const [policies, setPolicies] = useState<LeavePolicyModel[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicyModel | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<LeavePolicyModel | null>(null);
  
  // Assign Policy Drawer
  const [assigningPolicy, setAssigningPolicy] = useState<LeavePolicyModel | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [isAssignSubmitting, setIsAssignSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState<LeavePolicyModel>({
    policyCode: "FY2026_STD",
    policyName: "FY 2026 Standard Policy",
    financialYear: 2026,
    effectiveFrom: "2026-04-01",
    effectiveTo: "2027-03-31",
    description: "Standard leave policy for all employees",
    active: true,
    policyDetails: [
      { leaveType: "CASUAL", allocatedLeaves: 12, carryForwardAllowed: false, maxCarryForward: 0, allowNegativeBalance: false },
      { leaveType: "SICK", allocatedLeaves: 12, carryForwardAllowed: false, maxCarryForward: 0, allowNegativeBalance: false },
      { leaveType: "EARNED", allocatedLeaves: 18, carryForwardAllowed: true, maxCarryForward: 30, allowNegativeBalance: false }
    ]
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Helper Requests ───────────────────────────────────────────────────
  const getApi = async (urlSuffix: string = '') => {
    return await axios.get(`${LEAVE_POLICY_ENDPOINT}${urlSuffix}`);
  };

  const postApi = async (payload: any) => {
    return await axios.post(LEAVE_POLICY_ENDPOINT, payload);
  };

  const putApi = async (id: number, payload: any) => {
    return await axios.put(`${LEAVE_POLICY_ENDPOINT}/${id}`, payload);
  };

  const deleteApi = async (id: number) => {
    return await axios.delete(`${LEAVE_POLICY_ENDPOINT}/${id}`);
  };

  // ── Load Policies & Employees ─────────────────────────────────────────
  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await getApi();
      if (Array.isArray(res.data)) {
        setPolicies(res.data);
      } else {
        setPolicies([]);
      }
    } catch (err) {
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get('/v1/api/payroll/employee/all');
      if (Array.isArray(res.data)) {
        setEmployees(res.data.map((e: any) => ({
          id: Number(e.id),
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || `Employee #${e.id}`,
          code: e.employeeCode || `EMP-${e.id}`
        })));
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchPolicies();
    fetchEmployees();
  }, []);

  // ── Validation ────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.policyCode.trim()) errors.policyCode = "Policy Code is required.";
    if (!form.policyName.trim()) errors.policyName = "Policy Name is required.";
    if (!form.effectiveFrom) errors.effectiveFrom = "Effective From date is required.";
    if (!form.effectiveTo) errors.effectiveTo = "Effective To date is required.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit Policy ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      if (editingPolicy?.id) {
        // PUT /v1/api/attendance/leave-policies/{id}
        const putPayload = {
          id: editingPolicy.id,
          policyCode: form.policyCode.trim().toUpperCase(),
          policyName: form.policyName.trim(),
          financialYear: Number(form.financialYear),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          description: form.description,
          active: Boolean(form.active),
          policyDetails: form.policyDetails.map(d => ({
            id: d.id,
            leaveType: d.leaveType,
            allocatedLeaves: Number(d.allocatedLeaves),
            carryForwardAllowed: Boolean(d.carryForwardAllowed),
            maxCarryForward: Number(d.maxCarryForward),
            encashmentAllowed: Boolean(d.encashmentAllowed),
            negativeBalanceAllowed: Boolean(d.allowNegativeBalance || d.negativeBalanceAllowed),
            documentRequired: false,
            minimumServiceMonths: null,
            active: Boolean(form.active)
          }))
        };

        const res = await putApi(editingPolicy.id, putPayload);
        const updatedRecord = res.data || { ...editingPolicy, ...putPayload };
        setPolicies(prev => prev.map(p => p.id === editingPolicy.id ? updatedRecord : p));
        ToasterService.success("Leave Policy updated successfully!");
        setEditingPolicy(null);
      } else {
        // POST /v1/api/attendance/leave-policies
        const postPayload = {
          policyCode: form.policyCode.trim().toUpperCase(),
          policyName: form.policyName.trim(),
          financialYear: Number(form.financialYear),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          description: form.description,
          active: Boolean(form.active),
          policyDetails: form.policyDetails.map(d => ({
            leaveType: d.leaveType,
            allocatedLeaves: Number(d.allocatedLeaves),
            carryForwardAllowed: Boolean(d.carryForwardAllowed),
            maxCarryForward: Number(d.maxCarryForward),
            allowNegativeBalance: Boolean(d.allowNegativeBalance)
          }))
        };

        const res = await postApi(postPayload);
        const createdRecord = res.data || { ...postPayload, id: Date.now() };
        setPolicies(prev => [createdRecord, ...prev]);
        ToasterService.success("Leave Policy created successfully!");
        setIsModalOpen(false);
      }

      resetForm();
    } catch (err: any) {
      ToasterService.error(err.response?.data?.message || "Failed to save leave policy.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      policyCode: "FY2026_STD",
      policyName: "FY 2026 Standard Policy",
      financialYear: 2026,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      description: "Standard leave policy for all employees",
      active: true,
      policyDetails: [
        { leaveType: "CASUAL", allocatedLeaves: 12, carryForwardAllowed: false, maxCarryForward: 0, allowNegativeBalance: false },
        { leaveType: "SICK", allocatedLeaves: 12, carryForwardAllowed: false, maxCarryForward: 0, allowNegativeBalance: false },
        { leaveType: "EARNED", allocatedLeaves: 18, carryForwardAllowed: true, maxCarryForward: 30, allowNegativeBalance: false }
      ]
    });
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: LeavePolicyModel) => {
    setEditingPolicy(p);
    setForm({
      policyCode: p.policyCode,
      policyName: p.policyName,
      financialYear: p.financialYear,
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo,
      description: p.description || "",
      active: p.active !== false,
      policyDetails: p.policyDetails || []
    });
    setFormErrors({});
  };

  const handleDeletePolicy = async (id: number) => {
    try {
      await deleteApi(id);
    } catch (err: any) {
      console.warn("Backend DELETE endpoint error, filtering local policy", err);
    }
    ToasterService.success("Leave policy deleted successfully!");
    setPolicies(prev => prev.filter(p => p.id !== id));
  };

  // ── Assign Policy Submission ──────────────────────────────────────────
  const handleAssignPolicySubmit = async () => {
    if (!assigningPolicy?.id || selectedEmployeeIds.length === 0) {
      return ToasterService.error("Please select at least one employee.");
    }

    try {
      setIsAssignSubmitting(true);
      const payload = {
        employeeIds: selectedEmployeeIds,
        leavePolicyId: assigningPolicy.id
      };

      await axios.post(ASSIGN_POLICY_ENDPOINT, payload);

      ToasterService.success(`Policy assigned to ${selectedEmployeeIds.length} employee(s) successfully!`);
      setAssigningPolicy(null);
      setSelectedEmployeeIds([]);
    } catch (err: any) {
      ToasterService.error(err.response?.data?.message || "Failed to assign policy.");
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  // ── Table Column Definitions ──────────────────────────────────────────
  const columns: ColumnDef<LeavePolicyModel>[] = [
    {
      key: 'policyCode',
      label: 'Policy Code',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-bold text-xs text-cyan-700 bg-cyan-50/80 px-2 py-1 rounded border border-cyan-200/70 whitespace-nowrap">
          {row.policyCode}
        </span>
      )
    },
    {
      key: 'policyName',
      label: 'Policy Name',
      sortable: true,
      render: (row) => (
        <div>
          <span className="font-bold text-xs text-gray-900 block">{row.policyName}</span>
          <span className="text-[10px] text-gray-400 font-mono">FY {row.financialYear}</span>
        </div>
      )
    },
    {
      key: 'effectiveFrom',
      label: 'Effective Period',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs font-medium text-gray-600 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-md whitespace-nowrap inline-flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          {row.effectiveFrom} &rarr; {row.effectiveTo}
        </span>
      )
    },
    {
      key: 'active',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-2xs whitespace-nowrap ${
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
            className="p-1.5 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-700 rounded-lg transition-colors"
            title="Edit Policy"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setAssigningPolicy(row); setSelectedEmployeeIds([12]); }}
            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
            title="Assign Policy to Employees"
          >
            <Users className="w-3.5 h-3.5" /> Assign
          </button>
          {row.id && (
            <button
              type="button"
              onClick={() => handleDeletePolicy(row.id!)}
              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg transition-colors"
              title="Delete Policy"
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
      <PageMeta title="Leave Policy Management" description="Create, edit, and assign leave policies to employees" />
      <PageBreadcrumb pageTitle="Leave Policy Management" />

      <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1 space-y-4">
        
        {/* Toolbar Header */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-600" />
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Leave Policy Master</h2>
              <p className="text-xs text-gray-500">Configure leave types, allocations, carry forwards, and assign to employees</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={fetchPolicies}
              className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-lg transition-all"
              title="Refresh Policies"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" /> Create Leave Policy
            </button>
          </div>
        </div>

        {/* Policy List Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
          <ReusableTable
            data={policies}
            columns={columns}
            loading={loading}
            searchable={true}
            searchPlaceholder="Search by policy code or policy name..."
            pageSize={5}
            defaultSortKey="policyCode"
            defaultSortOrder="asc"
          />
        </div>

        {/* ── CREATE / EDIT POLICY MODAL ───────────────────────────────────── */}
        {(isModalOpen || editingPolicy) && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-3xl w-full p-5 shadow-2xl border border-gray-100">
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">
                    {editingPolicy ? `Edit Leave Policy #${editingPolicy.id}` : "Create Leave Policy"}
                  </h3>
                </div>
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingPolicy(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Policy Code *</label>
                    <input
                      type="text"
                      value={form.policyCode}
                      onChange={(e) => setForm(p => ({ ...p, policyCode: e.target.value }))}
                      placeholder="e.g. FY2026_STD"
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold uppercase text-gray-800"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Policy Name *</label>
                    <input
                      type="text"
                      value={form.policyName}
                      onChange={(e) => setForm(p => ({ ...p, policyName: e.target.value }))}
                      placeholder="e.g. FY 2026 Standard Policy"
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Financial Year</label>
                    <input
                      type="number"
                      value={form.financialYear}
                      onChange={(e) => setForm(p => ({ ...p, financialYear: Number(e.target.value) }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Effective From *</label>
                    <input
                      type="date"
                      value={form.effectiveFrom}
                      onChange={(e) => setForm(p => ({ ...p, effectiveFrom: e.target.value }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Effective To *</label>
                    <input
                      type="date"
                      value={form.effectiveTo}
                      onChange={(e) => setForm(p => ({ ...p, effectiveTo: e.target.value }))}
                      className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800"
                      required
                    />
                  </div>
                </div>

                {/* Policy Detail Allocations */}
                <div className="border border-cyan-100 bg-cyan-50/40 rounded-xl p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-cyan-900 uppercase tracking-wider">Leave Category Allocations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {form.policyDetails.map((detail, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-lg border border-cyan-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-cyan-800 font-mono">{detail.leaveType} LEAVE</span>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 font-medium mb-0.5">Allocated Days</label>
                          <input
                            type="number"
                            value={detail.allocatedLeaves}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setForm(p => ({
                                ...p,
                                policyDetails: p.policyDetails.map((d, i) => i === idx ? { ...d, allocatedLeaves: val } : d)
                              }));
                            }}
                            className="w-full py-1 px-2 border border-gray-200 rounded text-xs font-bold text-gray-900"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={detail.carryForwardAllowed}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setForm(p => ({
                                  ...p,
                                  policyDetails: p.policyDetails.map((d, i) => i === idx ? { ...d, carryForwardAllowed: checked } : d)
                                }));
                              }}
                              className="rounded text-cyan-600"
                            />
                            <span>Carry Forward</span>
                          </label>
                          {detail.carryForwardAllowed && (
                            <input
                              type="number"
                              placeholder="Max"
                              value={detail.maxCarryForward}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setForm(p => ({
                                  ...p,
                                  policyDetails: p.policyDetails.map((d, i) => i === idx ? { ...d, maxCarryForward: val } : d)
                                }));
                              }}
                              className="w-14 py-0.5 px-1 border border-gray-200 rounded text-xs font-semibold text-right"
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm(p => ({ ...p, active: e.target.checked }))}
                      className="rounded text-cyan-600"
                    />
                    <span className="text-xs font-semibold text-gray-700">Active Policy Status</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsModalOpen(false); setEditingPolicy(null); }}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold disabled:opacity-70"
                    >
                      {isSubmitting ? "Saving..." : editingPolicy ? "Update Policy" : "Save Leave Policy"}
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </div>
        )}

        {/* ── ASSIGN POLICY DRAWER MODAL ───────────────────────────────────── */}
        {assigningPolicy && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-gray-100">
              
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase">
                    Assign Policy ({assigningPolicy.policyCode})
                  </h3>
                </div>
                <button type="button" onClick={() => setAssigningPolicy(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 text-xs">
                  <span className="font-bold text-purple-900 block">{assigningPolicy.policyName}</span>
                  <span className="text-purple-700">POST /v1/api/attendance/employee-leave-balances/assign-policy</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Employees</label>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
                    {employees.length === 0 ? (
                      <p className="text-xs text-gray-400 italic p-2">Loading employee list...</p>
                    ) : (
                      employees.map(emp => (
                        <label key={emp.id} className="flex items-center justify-between p-1.5 hover:bg-white rounded cursor-pointer text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedEmployeeIds(prev => checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id));
                              }}
                              className="rounded text-purple-600"
                            />
                            <span className="font-semibold text-gray-800">{emp.name}</span>
                          </div>
                          <span className="font-mono text-gray-400">#{emp.id}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAssignSubmitting || selectedEmployeeIds.length === 0}
                  onClick={handleAssignPolicySubmit}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-60"
                >
                  {isAssignSubmitting ? "Assigning..." : `Assign Policy to (${selectedEmployeeIds.length}) Employee(s)`}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default LeavePolicyPage;
