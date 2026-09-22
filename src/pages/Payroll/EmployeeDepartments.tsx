import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import {
  TrashIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  UserGroupIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";
import { motion, AnimatePresence } from "framer-motion";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const API_URL = "/v1/api/payroll/department";


interface Department {
  id: number;
  name: string;
  employees?: any[];
  createdDate?: string;
  updatedDate?: string;
  [key: string]: any;
}

const EmployeeDepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Fetch departments
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/listAll`);
      const data = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setDepartments(data);
    } catch (err) {
      console.error("Error loading departments:", err);
      ToasterService.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Search and sort logic is handled by ReusableTable

  const handleCreate = async () => {
    if (!deptName.trim()) {
      ToasterService.error("Department name is required");
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/create`, { name: deptName.trim() });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success("Department created successfully");
        setShowForm(false);
        setDeptName("");
        setEditingDept(null);
        fetchDepartments();
      }
    } catch (err: any) {
      console.error("Error creating department:", err);
      ToasterService.error(err.response?.data?.message || "Failed to create department");
    }
  };

  const handleUpdate = async () => {
    if (!deptName.trim()) {
      ToasterService.error("Department name is required");
      return;
    }

    if (!editingDept) return;

    try {
      const res = await axios.put(`${API_URL}/update`, {
        id: editingDept.id,
        name: deptName.trim()
      });
      if (res.status === 200) {
        ToasterService.success("Department updated successfully");
        setShowForm(false);
        setDeptName("");
        setEditingDept(null);
        fetchDepartments();
      }
    } catch (err: any) {
      console.error("Error updating department:", err);
      ToasterService.error(err.response?.data?.message || "Failed to update department");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    const ok = await confirm({
      message: `Are you sure you want to delete department "${name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    try {
      await axios.delete(`${API_URL}/delete/${id}`);
      ToasterService.success("Department deleted successfully");
      fetchDepartments();
    } catch (err: any) {
      console.error("Error deleting department:", err);
      ToasterService.error(err.response?.data?.message || "Failed to delete department");
    }
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingDept(null);
    setDeptName("");
  };

  const openCreateModal = () => {
    setEditingDept(null);
    setDeptName("");
    setShowForm(true);
  };

  const openEditModal = (department: Department) => {
    setEditingDept(department);
    setDeptName(department.name);
    setShowForm(true);
  };

  const normalizedDepartments = useMemo(() => {
    return departments.map((dept: any, index: number) => {
      const id = dept.id || index + 1;
      const name = dept.name || `Department #${id}`;
      const rawEmployees = Array.isArray(dept.employees) ? dept.employees : [];
      const empCount = rawEmployees.length;

      const formatDate = (dStr?: string) => {
        if (!dStr) return "-";
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? dStr : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      };

      const createdDateStr = formatDate(dept.createdDate);
      const updatedDateStr = dept.updatedDate ? formatDate(dept.updatedDate) : undefined;

      // Extract clean team member labels if employees exist
      const memberNames: string[] = rawEmployees
        .map((e: any) => {
          if (typeof e === 'string') return e;
          const n = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.name || e.username;
          const code = e.employeeCode || (e.id ? `ID: ${e.id}` : '');
          return n ? `${n}${code ? ` (${code})` : ''}` : null;
        })
        .filter(Boolean) as string[];

      // Enumerable properties visible in Table & drawer:
      // First 4 columns: id, name, employees, createdDate -> top 4 summary metric cards
      const rowItem: Record<string, any> = {
        id: `#${id}`,
        name: name,
        employees: `${empCount} ${empCount === 1 ? 'Member' : 'Members'}`,
        createdDate: createdDateStr,
        status: "Active",
      };

      if (updatedDateStr && updatedDateStr !== "-") {
        rowItem.lastUpdated = updatedDateStr;
      }

      if (memberNames.length > 0) {
        rowItem.teamMembers = memberNames.slice(0, 8);
        if (memberNames.length > 8) {
          rowItem.teamMembers.push(`+${memberNames.length - 8} more`);
        }
      }

      // Non-enumerable properties: accessible by code, modals, and actions, but hidden from drawer Object.keys()
      Object.defineProperties(rowItem, {
        _raw: { value: dept, enumerable: false, writable: true },
        numericId: { value: Number(id) || 1, enumerable: false, writable: true },
        rawEmployees: { value: rawEmployees, enumerable: false, writable: true },
      });

      return rowItem;
    });
  }, [departments]);

  const columns: ColumnDef<any>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      render: (row) => (
        <span className="pl-2 font-mono font-bold text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-transparent px-2 py-0.5 rounded border border-cyan-200 dark:border-transparent">
          {row.id}
        </span>
      )
    },
    {
      key: "name",
      label: "Department Name",
      sortable: true,
      render: (row) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-[#222222] flex items-center justify-center mr-3 shrink-0">
            <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">
              {String(row.name).charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {row.name}
            </div>
          </div>
        </div>
      )
    },
    {
      key: "employees",
      label: "Employees",
      sortable: true,
      sortValueGetter: (row) => parseInt(String(row.employees)) || 0,
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-50 dark:bg-transparent text-cyan-700 dark:text-gray-300 border border-cyan-100 dark:border-transparent">
          <UserGroupIcon className="h-3 w-3 mr-1 shrink-0 text-cyan-600 dark:text-gray-400" />
          {row.employees}
        </span>
      )
    },
    {
      key: "createdDate",
      label: "Created Date",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {row.createdDate}
        </span>
      )
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right w-32",
      className: "text-right w-32",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEditModal(row._raw || { id: row.numericId, name: row.name })}
            className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 bg-cyan-50 dark:bg-[#222222] hover:bg-cyan-100 dark:hover:bg-[#2a2a2a] p-1.5 rounded-md transition-colors cursor-pointer"
            title="Edit Department"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(row.numericId, row.name)}
            className="text-red-600 dark:text-rose-400 hover:text-red-900 dark:hover:text-rose-300 bg-red-50 dark:bg-[#222222] hover:bg-red-100 dark:hover:bg-[#2a2a2a] p-1.5 rounded-md transition-colors cursor-pointer"
            title="Delete Department"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];


  // Calculate stats
  const totalEmployees = departments.reduce((acc, curr) => acc + (curr.employees?.length || 0), 0);
  const avgEmployeesPerDept = departments.length > 0 ? Math.round(totalEmployees / departments.length) : 0;

  return (
    <>
      <PageMeta title="Departments" description="Manage employee departments" />
      <PageBreadcrumb pageTitle="Departments" showAddButton={true} addButtonLabel="Add Department" onAddClick={openCreateModal} />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 [&_.stats-card]:dark:!border-transparent [&_.stats-card]:dark:!bg-[#191919] [&_.stats-card__icon]:dark:!bg-[#222222] [&_.stats-card__icon]:dark:!text-gray-300 [&_.stats-card__value]:dark:!text-white [&_.stats-card__label]:dark:!text-gray-400 [&_.stats-card-actions__button]:dark:!text-gray-400 [&_.stats-card-actions__button]:dark:hover:!text-white [&_.stats-card-actions__button]:dark:hover:!bg-[#222222]">
          <StatsCard label="Total Departments" value={departments.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
          <StatsCard label="Total Employees" value={totalEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<UserGroupIcon className="h-6 w-6" />} />
          <StatsCard label="Average per Dept" value={avgEmployeesPerDept} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BriefcaseIcon className="h-6 w-6" />} />
          <StatsCard label="Active Status" value="Active" gradient="from-emerald-50 to-green-50" borderColor="border-emerald-100" labelColor="text-emerald-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
        </div>

        {/* Table */}
        <ReusableTable
          className="dark:border-transparent [&_.common-data-table]:dark:!border-transparent"
          data={normalizedDepartments}
          columns={columns}
          loading={loading}
          searchable={false}
          rowDetailsTitle={(row) => `${row.name} Department`}
          rowDetailsSubtitle="Department profile, headcount, and operational status"
          emptyState={
            <div className="flex flex-col items-center">
              <BuildingOfficeIcon className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">No departments found</p>
              <button
                onClick={openCreateModal}
                className="mt-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-xs font-medium cursor-pointer"
              >
                Create your first department
              </button>
            </div>
          }
        />

        {/* Modal Form */}
        <AnimatePresence>
          {showForm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs overflow-y-auto p-4 animate-in fade-in duration-150"
              onClick={closeModal}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-[#191919] text-gray-900 dark:text-white rounded-xl shadow-2xl border border-gray-200 dark:!border-transparent w-full max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:!border-transparent">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingDept ? "Edit Department" : "Create New Department"}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {editingDept
                        ? "Update department information"
                        : "Add a new department to the organization"}
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Department Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          editingDept ? handleUpdate() : handleCreate();
                        }
                      }}
                      placeholder="e.g., Engineering, Marketing, Sales"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      Departments help organize your team structure
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:!border-transparent">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#222222] rounded-lg hover:bg-gray-200 dark:hover:bg-[#2a2a2a] border border-transparent transition-all duration-200 focus:outline-none cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={editingDept ? handleUpdate : handleCreate}
                      className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium !text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-lg border border-transparent shadow-sm transition-all duration-200 focus:outline-none gap-2 cursor-pointer"
                    >
                      <CheckCircleIcon className="w-4 h-4 !text-white shrink-0" />
                      <span className="!text-white whitespace-nowrap">{editingDept ? "Update Department" : "Create Department"}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

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

export default EmployeeDepartmentsPage;
