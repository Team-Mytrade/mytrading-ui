import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { Department, Role } from "./RoleConfigTypes";
import { StatusBadge } from "./RoleConfigShared";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/user/roles";
const DEPARTMENT_API_BASE = "/v1/api/user/departments";
const PAGE_SIZE = 10;

interface RoleTabProps {
  selectedDepartmentFilter?: number | null;
  onClearDepartmentFilter?: () => void;
}

const RoleTab: React.FC<RoleTabProps> = ({ selectedDepartmentFilter, onClearDepartmentFilter }) => {
  const { user } = useContext(AuthContext);
  const tenantId = user?.tenantId;

  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ roleCode: "", roleName: "", departmentId: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem("accessToken");

  const getHeaders = () => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/getAll`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch roles");

      const data = await response.json();
      const rolesList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setRoles(rolesList);
    } catch (error) {
      console.error("Error fetching roles:", error);
      ToasterService.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(DEPARTMENT_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch departments");

      const data = await response.json();
      const departmentsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setDepartments(departmentsList);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDepartments();
  }, [tenantId]);

  const validateForm = () => {
    if (!form.roleCode?.trim()) {
      ToasterService.error("Role code is required");
      return false;
    }
    if (!form.roleName?.trim()) {
      ToasterService.error("Role name is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const payload = {
        roleCode: form.roleCode.trim().toUpperCase(),
        roleName: form.roleName.trim(),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        tenantId: tenantId,
      };

      let response;
      if (editingId) {
        response = await fetch(`${API_BASE}/update/${editingId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ ...payload, id: editingId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData?.message?.includes("already exists") || errorData?.message?.includes("duplicate")) {
            ToasterService.error("Role code already exists. Please use a unique code.");
          } else {
            ToasterService.error(errorData?.message || "Failed to update role");
          }
          throw new Error(errorData?.message || "Update failed");
        }

        ToasterService.success("Role updated successfully!");
      } else {
        response = await fetch(`${API_BASE}/create`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData?.message?.includes("already exists") || errorData?.message?.includes("duplicate")) {
            ToasterService.error("Role code already exists. Please use a unique code.");
          } else {
            ToasterService.error(errorData?.message || "Failed to create role");
          }
          throw new Error(errorData?.message || "Creation failed");
        }

        ToasterService.success("Role created successfully!");
      }

      fetchData();
      setShowFormModal(false);
      setForm({ roleCode: "", roleName: "", departmentId: 0 });
      setEditingId(null);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEdit = (item: Role) => {
    setForm({
      roleCode: item.roleCode,
      roleName: item.roleName,
      departmentId: item.departmentId || 0,
    });
    setEditingId(item.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/delete?id=${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        ToasterService.error(errorData?.message || "Failed to delete");
        return;
      }

      ToasterService.success("Role deleted successfully!");
      fetchData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting role:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const getDepartmentName = (departmentId: number | null) => {
    if (!departmentId) return "—";
    const department = departments.find(d => d.id === departmentId);
    return department?.name || department?.departmentCode || `Dept #${departmentId}`;
  };

  const filteredData = roles.filter((role) => {
    const matchesSearch = Object.values(role).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    );
    if (selectedDepartmentFilter) {
      return matchesSearch && role.departmentId === selectedDepartmentFilter;
    }
    return matchesSearch;
  });

  const columns: ColumnDef<Role>[] = [
    {
      key: "roleCode",
      label: "Role Code",
      sortable: true,
      render: (row: Role) => (
        <span className="font-mono text-sm text-gray-900">{row.roleCode}</span>
      ),
    },
    {
      key: "roleName",
      label: "Role Name",
      sortable: true,
      render: (row: Role) => (
        <span className="text-sm font-medium text-gray-900">{row.roleName}</span>
      ),
    },
    {
      key: "departmentId",
      label: "Department",
      sortable: true,
      render: (row: Role) => (
        <span className="text-sm text-gray-600">{getDepartmentName(row.departmentId)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: Role) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(row.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];



  return (
    <div>
      {/* Active Department Filter Alert */}
      {selectedDepartmentFilter && (
        <div className="mb-4 flex items-center justify-between p-3.5 bg-cyan-50/80 border border-cyan-100 rounded-xl text-cyan-800 text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-cyan-600" />
            <span>
              Showing roles for selected Department:{" "}
              <span className="bg-cyan-100/60 px-2 py-0.5 rounded text-cyan-900 font-bold">
                {getDepartmentName(selectedDepartmentFilter)}
              </span>
            </span>
          </div>
          <button
            onClick={onClearDepartmentFilter}
            className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 bg-white hover:bg-cyan-100/20 px-3 py-1.5 rounded-lg border border-cyan-200 transition-colors shadow-sm"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setForm({ roleCode: "", roleName: "", departmentId: 0 });
            setEditingId(null);
            setShowFormModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Role
        </button>
      </div>



      {/* Table */}
      <ReusableTable<Role>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={PAGE_SIZE}
        defaultSortKey="roleName"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No roles found</p>
            {!search && (
              <button
                onClick={() => {
                  setForm({ roleCode: "", roleName: "", departmentId: 0 });
                  setEditingId(null);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first role →
              </button>
            )}
          </div>
        }
      />

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? "Edit Role" : "New Role"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingId ? "Update role details" : "Create a new role"}
                </p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.roleCode}
                    onChange={(e) => setForm({ ...form, roleCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    placeholder="e.g., ADMIN"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Unique identifier for the role (auto-uppercase)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.roleName}
                    onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder="e.g., Administrator"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={form.departmentId || ""}
                    onChange={(e) => setForm({ ...form, departmentId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                  >
                    <option value="0">None</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name || dept.departmentCode}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Optional: Assign role to a department</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <TrashIcon className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Role?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. Users with this role may be affected.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleTab;