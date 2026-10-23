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
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { PAGE_BODY, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, STATS_ROW } from "./hrmsUi";

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
  const { canCreate, canUpdate, canDelete } = usePermissions();
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
      ToasterService.error(apiError(err, "Failed to create department"));
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
      ToasterService.error(apiError(err, "Failed to update department"));
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
      ToasterService.error(apiError(err, "Failed to delete department"));
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canUpdate && (<button
            type="button"
            onClick={() => openEditModal(row._raw || { id: row.numericId, name: row.name })}
            className={ROW_ICON_BUTTON}
            title="Edit Department"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>)}
          {canDelete && (<button
            type="button"
            onClick={() => handleDelete(row.numericId, row.name)}
            className={ROW_ICON_BUTTON_DANGER}
            title="Delete Department"
          >
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      )
    }
  ];


  // Calculate stats
  const totalEmployees = departments.reduce((acc, curr) => acc + (curr.employees?.length || 0), 0);
  const avgEmployeesPerDept = departments.length > 0 ? Math.round(totalEmployees / departments.length) : 0;
  const largest = departments.reduce<Department | null>(
    (best, d) => (!best || (d.employees?.length || 0) > (best.employees?.length || 0) ? d : best), null);

  return (
    <>
      <PageMeta title="Departments" description="Manage employee departments" />
      <PageBreadcrumb pageTitle="Departments" showAddButton={true} addButtonLabel="Add Department" onAddClick={openCreateModal} />

      <div className={PAGE_BODY}>

        <div className={STATS_ROW}>
          <StatsCard label="Total Departments" value={departments.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<BuildingOfficeIcon className="h-5 w-5" />} />
          <StatsCard label="Total Employees" value={totalEmployees} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<UserGroupIcon className="h-5 w-5" />} />
          <StatsCard label="Average per Dept" value={avgEmployeesPerDept} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BriefcaseIcon className="h-5 w-5" />} />
          <StatsCard label="Largest" value={largest ? `${largest.name} (${largest.employees?.length || 0})` : "—"} gradient="from-emerald-50 to-green-50" borderColor="border-emerald-100" labelColor="text-emerald-600" icon={<CheckCircleIcon className="h-5 w-5" />} onRefresh={fetchDepartments} />
        </div>

        {/* Table */}
        <ReusableTable
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
              {canCreate && (<button
                onClick={openCreateModal}
                className="mt-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 text-xs font-medium cursor-pointer"
              >
                Create your first department
              </button>)}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showForm}
          title={editingDept ? "Edit Department" : "Create Department"}
          subtitle={editingDept ? "Update department information" : "Add a new department to the organization"}
          onClose={closeModal}
          onSubmit={(e) => {
            e.preventDefault();
            if (editingDept) handleUpdate();
            else handleCreate();
          }}
          submitLabel={editingDept ? "Update Department" : "Create Department"}
          maxWidthClassName="max-w-lg"
          tabs={[
            {
              label: "Department Details",
              fields: [
                <div key="name" className="md:col-span-2">
                  <FloatingInput
                    label="Department Name"
                    name="name"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>,
              ],
            },
          ]}
        />

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
