import React, { useEffect, useState } from "react";
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
      setDepartments(res.data);
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

  const columns: ColumnDef<Department>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      render: (row) => <span className="pl-2 text-xs font-mono font-medium text-gray-900">{row.id}</span>
    },
    {
      key: "name",
      label: "Department Name",
      sortable: true,
      render: (row) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 shrink-0">
            <span className="text-xs font-medium text-cyan-700">
              {row.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-900">
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
      sortValueGetter: (row) => row.employees?.length || 0,
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700 border border-cyan-100">
          <UserGroupIcon className="h-3 w-3 mr-1 shrink-0" />
          {row.employees?.length || 0} employees
        </span>
      )
    },
    {
      key: "createdDate",
      label: "Created Date",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-gray-500">
          {row.createdDate ? new Date(row.createdDate).toLocaleDateString() : "-"}
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
            onClick={() => openEditModal(row)}
            className="text-cyan-600 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 p-1.5 rounded-md transition-colors"
            title="Edit Department"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(row.id, row.name)}
            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors"
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
      <PageBreadcrumb pageTitle="Departments" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard label="Total Departments" value={departments.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
          <StatsCard label="Total Employees" value={totalEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<UserGroupIcon className="h-6 w-6" />} />
          <StatsCard label="Average per Dept" value={avgEmployeesPerDept} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BriefcaseIcon className="h-6 w-6" />} />
          <StatsCard label="Active Status" value="Active" gradient="from-emerald-50 to-green-50" borderColor="border-emerald-100" labelColor="text-emerald-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
        </div>

        {/* Table */}
        <ReusableTable
          data={departments}
          columns={columns}
          loading={loading}
          searchable={true}
          searchPlaceholder="Search departments by name..."
          searchFields={["name"]}
          emptyState={
            <div className="flex flex-col items-center">
              <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No departments found</p>
              <button
                onClick={openCreateModal}
                className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
              >
                Create your first department
              </button>
            </div>
          }
        />

        {/* Modal Form */}
        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-xl shadow-xl w-full max-w-md mx-auto"
              >
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingDept ? "Edit Department" : "Create New Department"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {editingDept
                        ? "Update department information"
                        : "Add a new department to the organization"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingDept(null);
                      setDeptName("");
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Departments help organize your team structure
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingDept(null);
                        setDeptName("");
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={editingDept ? handleUpdate : handleCreate}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm flex items-center gap-2"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                      {editingDept ? "Update Department" : "Create Department"}
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
