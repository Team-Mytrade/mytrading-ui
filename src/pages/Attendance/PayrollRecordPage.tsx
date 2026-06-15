import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  UserIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  BanknotesIcon,
  HashtagIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee { id: number; firstName: string; lastName: string; }

interface PayrollComponent {
  id?: number;
  name: string;
  amount: number;
  type: "EARNING" | "DEDUCTION";
}

interface PayrollRecord {
  id?: number;
  employee: Employee | null;
  payrollMonth: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  isFinalized: boolean;
  processedAt?: string;
  components: PayrollComponent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL      = "/v1/api/attendance/payroll-records";
const EMPLOYEE_URL = "/v1/api/attendance/employees";

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent";

const emptyForm: PayrollRecord = {
  employee: null, payrollMonth: "",
  baseSalary: 0, totalEarnings: 0, totalDeductions: 0, netPay: 0,
  isFinalized: false, components: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcTotals = (record: PayrollRecord): PayrollRecord => {
  const earnings   = record.components.filter(c => c.type === "EARNING").reduce((s, c) => s + Number(c.amount), 0);
  const deductions = record.components.filter(c => c.type === "DEDUCTION").reduce((s, c) => s + Number(c.amount), 0);
  return { ...record, totalEarnings: earnings, totalDeductions: deductions, netPay: record.baseSalary + earnings - deductions };
};

const fmt = (n: number) => `₹${n.toLocaleString()}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

const PayrollRecordPage: React.FC = () => {
  const [records, setRecords]     = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<PayrollRecord>({ ...emptyForm });

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<PayrollRecord | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadData = async () => {
    setLoading(true);
    try {
      const [recRes, empRes] = await Promise.all([
        axios.get<PayrollRecord[]>(API_URL),
        axios.get<Employee[]>(EMPLOYEE_URL),
      ]);
      setRecords(recRes.data);
      setEmployees(empRes.data);
    } catch (err) { console.error("Failed to load payroll data", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const resetForm = () => { setForm({ ...emptyForm }); setShowForm(false); };

  const editRecord = (r: PayrollRecord) => { setForm({ ...r }); setShowForm(true); };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee) return;
    const payload = calcTotals({ ...form });
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }
      loadData();
      resetForm();
    } catch (err) { console.error("Saving payroll record failed", err); }
  };

  // ── Component rows ───────────────────────────────────────────────────────────

  const updateComponent = (idx: number, key: keyof PayrollComponent, value: any) => {
    const updated = form.components.map((c, i) => i === idx ? { ...c, [key]: value } : c);
    setForm(calcTotals({ ...form, components: updated }));
  };

  const removeComponent = (idx: number) => {
    const updated = form.components.filter((_, i) => i !== idx);
    setForm(calcTotals({ ...form, components: updated }));
  };

  const addComponent = () =>
    setForm({ ...form, components: [...form.components, { name: "", amount: 0, type: "EARNING" }] });

  // ── Delete ──────────────────────────────────────────────────────────────────

  const promptDelete = (r: PayrollRecord) => { setDeletingItem(r); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`);
      loadData();
    } catch (err) { console.error("Failed to delete record", err); }
    setDeletingItem(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalNet    = records.reduce((s, r) => s + (r.netPay || 0), 0);
  const totalBase   = records.reduce((s, r) => s + (r.baseSalary || 0), 0);
  const finalized   = records.filter(r => r.isFinalized).length;
  const stats = {
    total: records.length, finalized,
    totalNet: Math.round(totalNet), totalBase: Math.round(totalBase),
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<PayrollRecord>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v ?? "—")}</span>
        </div>
      ),
    },
    {
      key: "employee", label: "Employee", sortable: false,
      render: (row) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">
            {[row.employee?.firstName, row.employee?.lastName].filter(Boolean).join(" ") || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "payrollMonth", label: "Month", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "baseSalary", label: "Base Salary", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <CurrencyRupeeIcon className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-sm text-gray-700">{Number(v).toLocaleString()}</span>
        </div>
      ),
    },
    {
      key: "totalEarnings", label: "Earnings", sortable: true,
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          <PlusCircleIcon className="h-3 w-3" />{Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "totalDeductions", label: "Deductions", sortable: true,
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          <MinusCircleIcon className="h-3 w-3" />{Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "netPay", label: "Net Pay", sortable: true,
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <CurrencyRupeeIcon className="h-3 w-3" />{Number(v).toLocaleString()}
        </span>
      ),
    },
    {
      key: "isFinalized", label: "Finalized", sortable: true,
      render: (_, v) => v
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Yes</span>
        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircleIcon className="h-3 w-3" />No</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => editRecord(row)} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(row)} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageMeta title="Payroll Records" description="Manage payroll processing" />
      <PageBreadcrumb pageTitle="Payroll Records" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll Records</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and process employee payroll records</p>
          </div>
          <AddButton label="Add Payroll Record" onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Records"  value={stats.total}     gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Finalized"      value={stats.finalized} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Total Net Pay"  value={stats.totalNet}  gradient="from-blue-50 to-indigo-50"   borderColor="border-blue-100"   labelColor="text-blue-600" />
          <StatsCard label="Total Base"     value={stats.totalBase} gradient="from-purple-50 to-pink-50"   borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit Payroll Record" : "Add Payroll Record"}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={submitForm}>
              {/* Basic fields */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Record Details</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee <span className="text-red-500">*</span>
                  </label>
                  <select value={form.employee?.id ?? ""} required
                    onChange={e => setForm({ ...form, employee: employees.find(emp => emp.id === Number(e.target.value)) || null })}
                    className={inputCls}>
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payroll Month <span className="text-red-500">*</span>
                  </label>
                  <input type="month" value={form.payrollMonth} required
                    onChange={e => setForm({ ...form, payrollMonth: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Base Salary (₹) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min={0} value={form.baseSalary} required
                    onChange={e => setForm(calcTotals({ ...form, baseSalary: Number(e.target.value) }))}
                    className={inputCls} />
                </div>
              </div>

              {/* Components */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Payroll Components</p>
              <div className="space-y-2 mb-4">
                {form.components.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-3 items-center">
                    <input type="text" value={c.name} placeholder="Component name"
                      onChange={e => updateComponent(idx, "name", e.target.value)} className={inputCls} />
                    <input type="number" value={c.amount} placeholder="Amount" min={0}
                      onChange={e => updateComponent(idx, "amount", Number(e.target.value))} className={inputCls} />
                    <div className="flex gap-2 items-center">
                      <select value={c.type}
                        onChange={e => updateComponent(idx, "type", e.target.value as "EARNING" | "DEDUCTION")}
                        className={inputCls + " flex-1"}>
                        <option value="EARNING">Earning</option>
                        <option value="DEDUCTION">Deduction</option>
                      </select>
                      <button type="button" onClick={() => removeComponent(idx)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addComponent}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-dashed border-cyan-400 text-cyan-600 rounded-lg hover:bg-cyan-50 transition-colors">
                  <PlusIcon className="h-4 w-4" /> Add Component
                </button>
              </div>

              {/* Live totals preview */}
              {(form.components.length > 0 || form.baseSalary > 0) && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-green-600 mb-0.5">Total Earnings</p>
                    <p className="text-sm font-semibold text-green-800">{fmt(form.totalEarnings)}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-600 mb-0.5">Total Deductions</p>
                    <p className="text-sm font-semibold text-red-700">{fmt(form.totalDeductions)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-600 mb-0.5">Net Pay</p>
                    <p className="text-sm font-semibold text-blue-800">{fmt(form.netPay)}</p>
                  </div>
                </div>
              )}

              {/* Finalized toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer w-fit">
                  <input type="checkbox" checked={!!form.isFinalized}
                    onChange={e => setForm({ ...form, isFinalized: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-sm font-medium text-gray-700">Mark as Finalized</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                  {form.id ? "Update Record" : "Create Record"}
                </button>
                <button type="button" onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <ReusableTable<PayrollRecord>
          data={records}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by employee or month..."
          searchFields={["payrollMonth"]}
          pageSize={5}
          defaultSortKey="payrollMonth"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BanknotesIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No payroll records found</p>
              <button onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first payroll record →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Payroll Record"
        subText="Are you sure you want to delete this payroll record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default PayrollRecordPage;