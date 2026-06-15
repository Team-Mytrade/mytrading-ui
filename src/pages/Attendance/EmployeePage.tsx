import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  UserGroupIcon,
  HashtagIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  BriefcaseIcon,
  MapPinIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyRupeeIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department { id: number; name: string; location: string; }
type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT";

interface Employee {
  id?: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  active: boolean;
  employmentType: EmploymentType;
  designation: string;
  location: string;
  managerId: string;
  joiningDate: string;
  department: Department | null;
  monthlySalary: number;
  hourlyRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMP_API  = "/v1/api/payroll/employee";
const DEPT_API = "/v1/api/payroll/department/listAll";

const inputCls =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent";

const EMP_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT:  "Contract",
};

const EMP_TYPE_STYLES: Record<EmploymentType, string> = {
  FULL_TIME: "bg-blue-100   text-blue-800",
  PART_TIME: "bg-purple-100 text-purple-800",
  CONTRACT:  "bg-orange-100 text-orange-700",
};

const emptyForm: Partial<Employee> = {
  employeeCode: "", firstName: "", lastName: "", email: "", phone: "",
  gender: "Male", employmentType: "FULL_TIME", designation: "", location: "",
  managerId: "", joiningDate: "", department: null, monthlySalary: 0,
  hourlyRate: 0, active: true,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const EmployeePage: React.FC = () => {
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState<Partial<Employee>>({ ...emptyForm });

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<Employee | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Employee[]>(EMP_API);
      setEmployees(res.data);
    } catch (err) { console.error("Failed to load employees", err); }
    finally { setLoading(false); }
  };

  const loadDepartments = async () => {
    try {
      const res = await axios.get<Department[]>(DEPT_API);
      setDepartments(res.data);
    } catch (err) { console.error("Failed to load departments", err); }
  };

  useEffect(() => { loadEmployees(); loadDepartments(); }, []);

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Employee, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm({ ...emptyForm }); setShowForm(false); };

  const handleEdit = (emp: Employee) => {
    setForm({ ...emp, joiningDate: emp.joiningDate?.slice(0, 10) ?? "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, departmentId: form.department?.id || null };
    try {
      if (form.id) {
        await axios.put(`${EMP_API}/${form.id}`, payload);
      } else {
        await axios.post(EMP_API, payload);
      }
      loadEmployees();
      resetForm();
    } catch (err) { console.error("Save failed", err); }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const promptDelete = (emp: Employee) => { setDeletingItem(emp); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${EMP_API}/${deletingItem.id}`);
      loadEmployees();
    } catch (err) { console.error("Delete failed", err); }
    setDeletingItem(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total:    employees.length,
    active:   employees.filter(e => e.active).length,
    inactive: employees.filter(e => !e.active).length,
    depts:    new Set(employees.map(e => e.department?.id).filter(Boolean)).size,
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Employee>[] = [
    {
      key: "employeeCode", label: "Code", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-mono font-semibold text-gray-900">{String(v ?? "—")}</span>
        </div>
      ),
    },
    {
      key: "firstName", label: "Name", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
            </p>
            <p className="text-xs text-gray-400">{row.designation || ""}</p>
          </div>
        </div>
      ),
    },
    {
      key: "email", label: "Email", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <EnvelopeIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{String(v ?? "—")}</span>
        </div>
      ),
    },
    {
      key: "phone", label: "Phone",
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <PhoneIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{String(v ?? "—")}</span>
        </div>
      ),
    },
    {
      key: "department", label: "Department", sortable: false,
      render: (row) => (
        <div className="flex items-center gap-2">
          <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{row.department?.name || "—"}</span>
        </div>
      ),
    },
    {
      key: "employmentType", label: "Type", sortable: true,
      render: (_, v) => {
        const t = v as EmploymentType;
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${EMP_TYPE_STYLES[t]}`}>
            {EMP_TYPE_LABELS[t]}
          </span>
        );
      },
    },
    {
      key: "active", label: "Status", sortable: true,
      render: (_, v) => v
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircleIcon className="h-3 w-3" />Active</span>
        : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircleIcon className="h-3 w-3" />Inactive</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleEdit(row)} title="Edit"
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
      <PageMeta title="Employee Management" description="Manage Employees" />
      <PageBreadcrumb pageTitle="Employee Management" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage employee records and assignments</p>
          </div>
          <AddButton label="Add Employee" onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Employees" value={stats.total}    gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Active"           value={stats.active}  gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Inactive"         value={stats.inactive} gradient="from-gray-50 to-slate-50"   borderColor="border-gray-200"   labelColor="text-gray-500" />
          <StatsCard label="Departments"      value={stats.depts}   gradient="from-purple-50 to-pink-50"   borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit Employee" : "Add New Employee"}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Basic Info */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Basic Information</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employee Code <span className="text-red-500">*</span></label>
                  <input type="text" value={form.employeeCode ?? ""} onChange={e => handleChange("employeeCode", e.target.value)} placeholder="e.g. EMP001" required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.firstName ?? ""} onChange={e => handleChange("firstName", e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.lastName ?? ""} onChange={e => handleChange("lastName", e.target.value)} required className={inputCls} />
                </div>
              </div>

              {/* Contact */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contact</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
                  <input type="email" value={form.email ?? ""} onChange={e => handleChange("email", e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input type="tel" value={form.phone ?? ""} onChange={e => handleChange("phone", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                  <select value={form.gender ?? "Male"} onChange={e => handleChange("gender", e.target.value)} className={inputCls}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              {/* Employment */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Employment</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Employment Type</label>
                  <select value={form.employmentType ?? "FULL_TIME"} onChange={e => handleChange("employmentType", e.target.value as EmploymentType)} className={inputCls}>
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Designation</label>
                  <input type="text" value={form.designation ?? ""} onChange={e => handleChange("designation", e.target.value)} placeholder="e.g. Software Engineer" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <input type="text" value={form.location ?? ""} onChange={e => handleChange("location", e.target.value)} placeholder="e.g. Chennai" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Department <span className="text-red-500">*</span></label>
                  <select value={form.department?.id ?? ""} onChange={e => handleChange("department", departments.find(d => d.id === Number(e.target.value)) || null)} required className={inputCls}>
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Joining Date</label>
                  <input type="date" value={form.joiningDate ?? ""} onChange={e => handleChange("joiningDate", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Manager ID</label>
                  <input type="text" value={form.managerId ?? ""} onChange={e => handleChange("managerId", e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Salary */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Compensation</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Salary (₹)</label>
                  <input type="number" min={0} value={form.monthlySalary ?? 0} onChange={e => handleChange("monthlySalary", Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate (₹)</label>
                  <input type="number" min={0} value={form.hourlyRate ?? 0} onChange={e => handleChange("hourlyRate", Number(e.target.value))} className={inputCls} />
                </div>
              </div>

              {/* Active */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer w-fit">
                  <input type="checkbox" checked={!!form.active} onChange={e => handleChange("active", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-sm font-medium text-gray-700">Active Employee</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                  {form.id ? "Update Employee" : "Add Employee"}
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
        <ReusableTable<Employee>
          data={employees}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by name, code, email, or designation..."
          searchFields={["employeeCode", "firstName", "lastName", "email", "phone", "designation"]}
          pageSize={5}
          defaultSortKey="firstName"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <UserGroupIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No employees found</p>
              <button onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first employee →
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
        innerText="Delete Employee"
        subText="Are you sure you want to delete this employee? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default EmployeePage;
