import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  UserIcon,
  TagIcon,
  PlusCircleIcon,
  MinusCircleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  BuildingOfficeIcon,
  EyeIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  employeeCode?: string;
}

interface LeaveType {
  id: number;
  code: string;
  name: string;
}

interface LeaveBalance {
  id?: number;
  employeeId: number;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  totalAllocated: number;
  used: number;
  remaining: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BALANCE = "/v1/api/attendance/leave-balances";
const API_EMPLOYEE = "/v1/api/payroll/employee";
const API_LEAVETYPES = "/v1/api/attendance/leave-types";

const PAGE_SIZE = 10;

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200";
const cardCls = "bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300";

const emptyForm: LeaveBalance = {
  employeeId: 0,
  employeeName: "",
  leaveTypeId: 0,
  leaveTypeName: "",
  totalAllocated: 0,
  used: 0,
  remaining: 0,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const LeaveBalancePage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [filteredBalances, setFilteredBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [form, setForm] = useState<LeaveBalance>({ ...emptyForm });
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<keyof LeaveBalance>("leaveTypeName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLeaveTypeFilter, setSelectedLeaveTypeFilter] = useState<string>("");
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadEmployees = async () => {
    try {
      const res = await axios.get<Employee[]>(`${API_EMPLOYEE}/all`);
      setEmployees(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load employees");
    }
  };

  const loadLeaveTypes = async () => {
    try {
      const res = await axios.get<LeaveType[]>(API_LEAVETYPES);
      setLeaveTypes(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load leave types");
    }
  };

  const loadBalances = async (empId: number) => {
    setLoading(true);
    try {
      const res = await axios.get<LeaveBalance[]>(`${API_BALANCE}/employee/${empId}`);
      setBalances(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load leave balances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadLeaveTypes();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadBalances(selectedEmployeeId);
      setShowForm(false);
      setEditingBalance(null);
    } else {
      setBalances([]);
      setFilteredBalances([]);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    applyFilters();
  }, [balances, search, selectedLeaveTypeFilter, sortKey, sortOrder]);

  const applyFilters = () => {
    let filtered = [...balances];

    if (search) {
      const searchTerm = search.toLowerCase();
      filtered = filtered.filter(b =>
        b.leaveTypeName?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedLeaveTypeFilter) {
      filtered = filtered.filter(b => b.leaveTypeId.toString() === selectedLeaveTypeFilter);
    }

    const sorted = [...filtered].sort((a, b) => {
      let valA = a[sortKey as keyof LeaveBalance];
      let valB = b[sortKey as keyof LeaveBalance];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      return 0;
    });

    setFilteredBalances(sorted);
    setPage(1);
  };

  // ── Form ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof LeaveBalance, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));

    if (key === "totalAllocated" || key === "used") {
      const newForm = { ...form, [key]: value };
      const remaining = newForm.totalAllocated - newForm.used;
      setForm(prev => ({ ...prev, [key]: value, remaining: remaining >= 0 ? remaining : 0 }));
    }
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingBalance(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    const employee = employees.find(e => e.id === selectedEmployeeId);
    setForm({
      ...emptyForm,
      employeeId: selectedEmployeeId!,
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : ""
    });
    setEditingBalance(null);
    setShowForm(true);
  };

  const openEditForm = (balance: LeaveBalance) => {
    setForm({ ...balance });
    setEditingBalance(balance);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId) {
      ToasterService.error("Please select an employee");
      return;
    }
    if (!form.leaveTypeId) {
      ToasterService.error("Please select a leave type");
      return;
    }
    if (form.totalAllocated < 0) {
      ToasterService.error("Total allocated cannot be negative");
      return;
    }
    if (form.used < 0) {
      ToasterService.error("Used days cannot be negative");
      return;
    }
    if (form.used > form.totalAllocated) {
      ToasterService.error("Used days cannot exceed allocated days");
      return;
    }

    const payload = {
      employeeId: form.employeeId,
      employeeName: form.employeeName,
      leaveTypeId: form.leaveTypeId,
      leaveTypeName: form.leaveTypeName,
      totalAllocated: form.totalAllocated,
      used: form.used,
      remaining: form.totalAllocated - form.used,
    };

    try {
      if (editingBalance?.id) {
        await axios.put(`${API_BALANCE}/${editingBalance.id}`, payload);
        ToasterService.success("Leave balance updated successfully");
      } else {
        await axios.post(API_BALANCE, payload);
        ToasterService.success("Leave balance created successfully");
      }
      resetForm();
      if (selectedEmployeeId) loadBalances(selectedEmployeeId);
    } catch (err: any) {
      console.error("Save failed", err);
      ToasterService.error(err.response?.data?.message || "Save failed");
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this leave balance record? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_BALANCE}/${id}`);
      ToasterService.success("Leave balance deleted successfully");
      if (selectedEmployeeId) loadBalances(selectedEmployeeId);
    } catch (err: any) {
      console.error("Delete failed", err);
      ToasterService.error(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const totalAllocated = filteredBalances.reduce((s, b) => s + (b.totalAllocated || 0), 0);
  const totalUsed = filteredBalances.reduce((s, b) => s + (b.used || 0), 0);
  const totalRemaining = filteredBalances.reduce((s, b) => s + (b.remaining || 0), 0);

  const uniqueLeaveTypes = [...new Map(balances.map(b => [b.leaveTypeId, { id: b.leaveTypeId, name: b.leaveTypeName }])).values()];

  const paginated = filteredBalances.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredBalances.length / PAGE_SIZE);

  const handleSort = (field: keyof LeaveBalance) => {
    if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortKey(field); setSortOrder("asc"); }
  };

  const SortIcon = ({ col }: { col: keyof LeaveBalance }) =>
    sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ID: ${employeeId}`;
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <>
      <PageMeta title="Leave Balances" description="Manage employee leave balances" />
      <PageBreadcrumb pageTitle="Leave Balances" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Employee Selection Card */}
        <div className={`${cardCls} mb-6`}>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <UserIcon className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Select Employee</h2>
                  <p className="text-sm text-gray-500">Choose an employee to view or manage leave balances</p>
                </div>
              </div>
              <div className="flex-1 max-w-md">
                <select
                  value={selectedEmployeeId || ""}
                  onChange={e => setSelectedEmployeeId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">— Choose an employee —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.employeeCode || `ID: ${emp.id}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {!selectedEmployeeId ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <UserIcon className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Employee Selected</h3>
              <p className="text-sm text-gray-500">Please select an employee to view their leave balances</p>
            </div>
          </div>
        ) : (
          <>
            {/* Employee Info Banner */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-100 p-4 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-cyan-200 flex items-center justify-center">
                    <span className="text-lg font-bold text-cyan-700">
                      {selectedEmployee?.firstName?.charAt(0)}{selectedEmployee?.lastName?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedEmployee?.firstName} {selectedEmployee?.lastName}</h3>
                    <p className="text-sm text-gray-500">{selectedEmployee?.employeeCode}</p>
                  </div>
                </div>
                {!showForm && (
                  <button
                    onClick={openCreateForm}
                    className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Add Leave Balance</span>
                  </button>
                )}
              </div>
            </div>

            {/* Conditional Rendering: Form OR Table */}
            {showForm ? (
              // Form View
              <div className={`${cardCls} mb-6`}>
                <div className="border-b border-gray-200 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        {editingBalance ? (
                          <PencilSquareIcon className="h-5 w-5 text-cyan-600" />
                        ) : (
                          <PlusIcon className="h-5 w-5 text-cyan-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {editingBalance ? "Edit Leave Balance" : "Add Leave Balance"}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {editingBalance ? "Update leave balance details" : "Assign leave balance to employee"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={resetForm}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Back to table"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <form onSubmit={submitForm} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Leave Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.leaveTypeId || ""}
                        required
                        onChange={e => {
                          const leaveTypeId = Number(e.target.value);
                          const leaveType = leaveTypes.find(lt => lt.id === leaveTypeId);
                          handleChange("leaveTypeId", leaveTypeId);
                          handleChange("leaveTypeName", leaveType?.name || "");
                        }}
                        className={inputCls}
                      >
                        <option value="">Select Leave Type</option>
                        {leaveTypes.map(lt => (
                          <option key={lt.id} value={lt.id}>{lt.name} ({lt.code})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Allocated <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.totalAllocated}
                        required
                        onChange={e => handleChange("totalAllocated", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Used <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={form.used}
                        required
                        onChange={e => handleChange("used", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* Remaining Balance Preview */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded-full">
                          <CheckCircleIcon className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Remaining Balance:</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-bold ${form.totalAllocated - form.used < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {Math.max(0, form.totalAllocated - form.used)}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">days</span>
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${form.totalAllocated > 0 && (form.totalAllocated - form.used) / form.totalAllocated < 0.2 ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${form.totalAllocated > 0 ? ((form.totalAllocated - form.used) / form.totalAllocated) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 mt-2 border-t border-gray-200">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 !text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      {editingBalance ? (
                        <>
                          <PencilSquareIcon className="h-4 w-4" />
                          Update Balance
                        </>
                      ) : (
                        <>
                          <PlusIcon className="h-4 w-4" />
                          Create Balance
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      Back to List
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // Table View
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Allocated</p>
                        <p className="text-2xl font-bold text-blue-600">{totalAllocated}</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-full">
                        <PlusCircleIcon className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Used</p>
                        <p className="text-2xl font-bold text-orange-600">{totalUsed}</p>
                      </div>
                      <div className="p-3 bg-orange-100 rounded-full">
                        <MinusCircleIcon className="h-6 w-6 text-orange-600" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">Total Remaining</p>
                        <p className="text-2xl font-bold text-green-600">{totalRemaining}</p>
                      </div>
                      <div className="p-3 bg-green-100 rounded-full">
                        <CheckCircleIcon className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by leave type..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`px-4 py-2 rounded-lg border transition-all duration-200 flex items-center gap-2 ${showFilters
                        ? 'bg-cyan-50 border-cyan-300 text-cyan-600'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      <FunnelIcon className="h-4 w-4" />
                      <span>Filter</span>
                    </button>
                  </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-fadeIn">
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                        <select
                          value={selectedLeaveTypeFilter}
                          onChange={e => setSelectedLeaveTypeFilter(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="">All Leave Types</option>
                          {uniqueLeaveTypes.map(lt => (
                            <option key={lt.id} value={lt.id}>{lt.name}</option>
                          ))}
                        </select>
                      </div>
                      {selectedLeaveTypeFilter && (
                        <button
                          onClick={() => setSelectedLeaveTypeFilter("")}
                          className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Table */}
                <div className={`${cardCls}`}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort("leaveTypeName")}>
                            <span className="flex items-center">Leave Type <SortIcon col="leaveTypeName" /></span>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort("totalAllocated")}>
                            <span className="flex items-center">Allocated <SortIcon col="totalAllocated" /></span>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort("used")}>
                            <span className="flex items-center">Used <SortIcon col="used" /></span>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort("remaining")}>
                            <span className="flex items-center">Remaining <SortIcon col="remaining" /></span>
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                <p className="text-gray-500 text-sm">Loading leave balances...</p>
                              </div>
                            </td>
                          </tr>
                        ) : paginated.length > 0 ? paginated.map(balance => {
                          const remainingPercentage = (balance.remaining / balance.totalAllocated) * 100;
                          const remainingColor = balance.remaining === 0
                            ? "bg-red-100 text-red-700"
                            : remainingPercentage <= 20
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-800";

                          return (
                            <tr key={balance.id} className="hover:bg-gray-50 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <TagIcon className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-900">{balance.leaveTypeName}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                  <PlusCircleIcon className="h-3 w-3" />
                                  {balance.totalAllocated}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                                  <MinusCircleIcon className="h-3 w-3" />
                                  {balance.used}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${remainingColor}`}>
                                    <CheckCircleIcon className="h-3 w-3" />
                                    {balance.remaining}
                                  </span>
                                  <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-300 ${balance.remaining === 0 ? 'bg-red-500' : remainingPercentage <= 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                      style={{ width: `${remainingPercentage}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openEditForm(balance)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all duration-200"
                                    title="Edit"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(balance.id!)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                                    title="Delete"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                <p className="text-gray-500 text-sm mb-2">No leave balances found</p>
                                <button
                                  onClick={openCreateForm}
                                  className="text-cyan-600 hover:text-cyan-700 text-sm font-medium flex items-center gap-1"
                                >
                                  <PlusIcon className="h-4 w-4" />
                                  Add a leave balance
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 0 && (
                    <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                            <span className="font-medium">
                              {Math.min(page * PAGE_SIZE, filteredBalances.length)}
                            </span>{' '}
                            of <span className="font-medium">{filteredBalances.length}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                              onClick={() => setPage(1)}
                              disabled={page === 1}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              First
                            </button>
                            <button
                              onClick={() => setPage(Math.max(1, page - 1))}
                              disabled={page === 1}
                              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum: number;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (page <= 3) {
                                pageNum = i + 1;
                              } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = page - 2 + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  onClick={() => setPage(pageNum)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${page === pageNum
                                    ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                    }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}
                            <button
                              onClick={() => setPage(Math.min(totalPages, page + 1))}
                              disabled={page === totalPages}
                              className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                            <button
                              onClick={() => setPage(totalPages)}
                              disabled={page === totalPages}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Last
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      </div>
    </>
  );
};

export default LeaveBalancePage;