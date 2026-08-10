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
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { AddButton } from "../../components/common/AddButton";
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
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [form, setForm] = useState<LeaveBalance>({ ...emptyForm });
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
    }
  }, [selectedEmployeeId]);

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

  const filteredBalances = useMemo(() => {
    let list = [...balances];
    if (selectedLeaveTypeFilter) {
      list = list.filter(b => b.leaveTypeId.toString() === selectedLeaveTypeFilter);
    }
    return list;
  }, [balances, selectedLeaveTypeFilter]);

  const totalAllocated = filteredBalances.reduce((s, b) => s + (b.totalAllocated || 0), 0);
  const totalUsed = filteredBalances.reduce((s, b) => s + (b.used || 0), 0);
  const totalRemaining = filteredBalances.reduce((s, b) => s + (b.remaining || 0), 0);

  const uniqueLeaveTypes = [...new Map(balances.map(b => [b.leaveTypeId, { id: b.leaveTypeId, name: b.leaveTypeName }])).values()];

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.firstName} ${employee.lastName}` : `Employee ID: ${employeeId}`;
  };

  const columns: ColumnDef<LeaveBalance>[] = [
    {
      key: "leaveTypeName",
      label: "Leave Type",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{row.leaveTypeName}</span>
        </div>
      ),
    },
    {
      key: "totalAllocated",
      label: "Allocated",
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
          <PlusCircleIcon className="h-3 w-3" />
          {row.totalAllocated}
        </span>
      ),
    },
    {
      key: "used",
      label: "Used",
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
          <MinusCircleIcon className="h-3 w-3" />
          {row.used}
        </span>
      ),
    },
    {
      key: "remaining",
      label: "Remaining",
      sortable: true,
      render: (row) => {
        const remainingPercentage = (row.remaining / row.totalAllocated) * 100;
        const remainingColor = row.remaining === 0
          ? "bg-red-100 text-red-700"
          : remainingPercentage <= 20
            ? "bg-yellow-100 text-yellow-700"
            : "bg-green-100 text-green-800";

        return (
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${remainingColor}`}>
              <CheckCircleIcon className="h-3 w-3" />
              {row.remaining}
            </span>
            <div className="w-16 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${row.remaining === 0 ? 'bg-red-500' : remainingPercentage <= 20 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${remainingPercentage}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEditForm(row)}
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all duration-200"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id!)}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

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
                  <AddButton label="Add Leave Balance" onClick={openCreateForm} />
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
                  <StatsCard
                    label="Total Allocated"
                    value={totalAllocated}
                    gradient="from-blue-50 to-indigo-50"
                    borderColor="border-blue-100"
                    labelColor="text-blue-600"
                    icon={<PlusCircleIcon className="h-6 w-6" />}
                  />
                  <StatsCard
                    label="Total Used"
                    value={totalUsed}
                    gradient="from-amber-50 to-yellow-50"
                    borderColor="border-amber-100"
                    labelColor="text-yellow-600"
                    icon={<MinusCircleIcon className="h-6 w-6" />}
                  />
                  <StatsCard
                    label="Total Remaining"
                    value={totalRemaining}
                    gradient="from-green-50 to-emerald-50"
                    borderColor="border-green-100"
                    labelColor="text-green-600"
                    icon={<CheckCircleIcon className="h-6 w-6" />}
                  />
                </div>

                <ReusableTable
                  data={filteredBalances}
                  columns={columns}
                  loading={loading}
                  searchable={true}
                  searchPlaceholder="Search by leave type..."
                  searchFields={["leaveTypeName"]}
                  pageSize={10}
                  toolbar={
                    <FilterPopover
                      title="Filter Leave Balances"
                      buttonLabel="Filter"
                      onReset={() => setSelectedLeaveTypeFilter("")}
                      showFooter={true}
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Leave Type</label>
                          <select
                            value={selectedLeaveTypeFilter}
                            onChange={e => setSelectedLeaveTypeFilter(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                          >
                            <option value="">All Leave Types</option>
                            {uniqueLeaveTypes.map(lt => (
                              <option key={lt.id} value={lt.id.toString()}>
                                {lt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </FilterPopover>
                  }
                />
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