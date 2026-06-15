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
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const API_URL = "/v1/api/payroll/department";
const PAGE_SIZE = 10;

interface Department {
  id: number;
  name: string;
  employees?: any[];
  createdDate?: string;
  updatedDate?: string;
}

const EmployeeDepartmentsPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Department>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  // Fetch departments
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/listAll`);
      setDepartments(res.data);
      setFilteredDepartments(res.data);
      ToasterService.success("Departments loaded successfully");
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

  // Filter and sort effect
  useEffect(() => {
    const term = search.toLowerCase();
    let result = departments.filter((dept) =>
      dept.name.toLowerCase().includes(term)
    );

    result = [...result].sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (sortKey === "employees") {
        const countA = a.employees?.length || 0;
        const countB = b.employees?.length || 0;
        return sortOrder === "asc" ? countA - countB : countB - countA;
      }

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return 0;
    });

    setFilteredDepartments(result);
    setPage(1);
  }, [search, departments, sortKey, sortOrder]);

  const handleSort = (key: keyof Department) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ col }: { col: keyof Department }) =>
    sortKey !== col ? null : sortOrder === "asc" ? (
      <ChevronUpIcon className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDownIcon className="h-3 w-3 inline ml-1" />
    );

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


  const paginatedDepartments = filteredDepartments.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const totalPages = Math.ceil(filteredDepartments.length / PAGE_SIZE);

  // Calculate stats
  const totalEmployees = departments.reduce((acc, curr) => acc + (curr.employees?.length || 0), 0);
  const avgEmployeesPerDept = departments.length > 0 ? Math.round(totalEmployees / departments.length) : 0;

  return (
    <>
      <PageMeta title="Departments" description="Manage employee departments" />
      <PageBreadcrumb pageTitle="Departments" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="mb-8 -mt-[125px] flex justify-end">
          <AddButton onClick={openCreateModal} label="Add Department" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard label="Total Departments" value={departments.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<BuildingOfficeIcon className="h-6 w-6" />} />
          <StatsCard label="Total Employees" value={totalEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<UserGroupIcon className="h-6 w-6" />} />
          <StatsCard label="Average per Dept" value={avgEmployeesPerDept} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BriefcaseIcon className="h-6 w-6" />} />
          <StatsCard label="Active Status" value="Active" gradient="from-emerald-50 to-green-50" borderColor="border-emerald-100" labelColor="text-emerald-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search departments by name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3" />
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort("id")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <span className="flex items-center">
                      ID
                      <SortIcon col="id" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("name")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <span className="flex items-center">
                      Department Name
                      <SortIcon col="name" />
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("employees")}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <span className="flex items-center">
                      Employees
                      <SortIcon col="employees" />
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                        <p className="text-gray-500 text-sm">Loading departments...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedDepartments.length > 0 ? (
                  paginatedDepartments.map((department) => (
                    <tr key={department.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">#{department.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mr-3">
                            <span className="text-sm font-medium text-white">
                              {department.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {department.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                          <UserGroupIcon className="h-3 w-3 mr-1" />
                          {department.employees?.length || 0} employees
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {department.createdDate ? new Date(department.createdDate).toLocaleDateString() : "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(department)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 transition-all duration-200"
                            data-tooltip-id="tooltip"
                            data-tooltip-content="Edit Department"
                          >
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(department.id, department.name)}
                            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                            data-tooltip-id="tooltip"
                            data-tooltip-content="Delete Department"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No departments found</p>
                        {search ? (
                          <p className="text-gray-400 text-xs">Try adjusting your search</p>
                        ) : (
                          <button
                            onClick={openCreateModal}
                            className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                          >
                            Create your first department
                          </button>
                        )}
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
                    Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{" "}
                    <span className="font-medium">
                      {Math.min(page * PAGE_SIZE, filteredDepartments.length)}
                    </span>{" "}
                    of <span className="font-medium">{filteredDepartments.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      First
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(1, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 1) {
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
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
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
                      className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Last
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

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
