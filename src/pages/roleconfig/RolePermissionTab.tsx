import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { Permission, RolePermission } from "./RoleConfigTypes";
import { StatusBadge, Toggle } from "./RoleConfigShared";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/user/role-permissions";
const PERMISSION_API_BASE = "/v1/api/user/permissions/all";
const ROLE_API_BASE = "/v1/api/user/roles/getAll";
const PAGE_SIZE = 10;

interface RolePermissionTabProps {
  selectedPermissionFilter?: number | null;
  onClearPermissionFilter?: () => void;
}

const RolePermissionTab: React.FC<RolePermissionTabProps> = ({ selectedPermissionFilter, onClearPermissionFilter }) => {
  const { user } = useContext(AuthContext);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ roleId: 0, permissionId: 0, validFrom: "", validTo: "", active: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<Permission[]>([]);
  const [roleOptions, setRoleOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem("accessToken");

  const getHeaders = () => {
    const token = getToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchRolePermissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/all`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch role permissions");

      const data = await response.json();
      const permissionsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setRolePermissions(permissionsList);
    } catch (error) {
      console.error("Error fetching role permissions:", error);
      ToasterService.error("Failed to load role permissions");
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch(PERMISSION_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch permissions");

      const data = await response.json();
      const permissionsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setPermissionOptions(permissionsList);
    } catch (error) {
      console.error("Error fetching permissions:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(ROLE_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch roles");

      const data = await response.json();
      const rolesList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setRoleOptions(rolesList);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  useEffect(() => {
    fetchRolePermissions();
    fetchPermissions();
    fetchRoles();
  }, []);

  const validateForm = () => {
    if (!form.roleId) {
      ToasterService.error("Please select a role");
      return false;
    }
    if (!form.permissionId) {
      ToasterService.error("Please select a permission");
      return false;
    }
    if (!form.validFrom) {
      ToasterService.error("Valid from date is required");
      return false;
    }
    if (!form.validTo) {
      ToasterService.error("Valid to date is required");
      return false;
    }
    if (new Date(form.validFrom) > new Date(form.validTo)) {
      ToasterService.error("Valid from date cannot be after valid to date");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const payload = {
        roleId: Number(form.roleId),
        permissionId: Number(form.permissionId),
        validFrom: form.validFrom,
        validTo: form.validTo,
        active: form.active,
      };

      let response;
      if (editingId) {
        response = await fetch(`${API_BASE}/${editingId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({ ...payload, id: editingId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          ToasterService.error(errorData?.message || "Failed to update role permission");
          throw new Error(errorData?.message || "Update failed");
        }

        ToasterService.success("Role permission updated successfully!");
      } else {
        response = await fetch(`${API_BASE}/create`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          ToasterService.error(errorData?.message || "Failed to create role permission");
          throw new Error(errorData?.message || "Creation failed");
        }

        ToasterService.success("Role permission created successfully!");
      }

      fetchRolePermissions();
      setShowFormModal(false);
      setForm({ roleId: 0, permissionId: 0, validFrom: "", validTo: "", active: true });
      setEditingId(null);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEdit = (item: RolePermission) => {
    setForm({
      roleId: item.roleId,
      permissionId: item.permissionId,
      validFrom: item.validFrom?.split('T')[0] || "",
      validTo: item.validTo?.split('T')[0] || "",
      active: item.active,
    });
    setEditingId(item.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
        headers: {
          ...getHeaders(),
          ...(user?.tenantId ? { "X-Tenant-ID": user.tenantId } : {}),
        },
      });

      if (!response.ok) {
        let message = "Failed to delete";
        try {
          const errorData = await response.json();
          message = errorData?.message || errorData?.error || message;
        } catch {
          message = (await response.text()) || message;
        }
        ToasterService.error(message);
        return;
      }

      ToasterService.success("Role permission deleted successfully!");
      fetchRolePermissions();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting role permission:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const getRoleName = (roleId: number) => {
    const role = roleOptions.find(r => r.id === roleId);
    return role?.roleName || role?.roleCode || `Role #${roleId}`;
  };

  const getPermissionName = (permissionId: number) => {
    const permission = permissionOptions.find(p => p.id === permissionId);
    return permission?.permissionName || permission?.permissionCode || `Permission #${permissionId}`;
  };

  // Filter data based on search and role filter
  const filteredData = rolePermissions.filter((item) => {
    const matchesSearch = search === "" ||
      getRoleName(item.roleId).toLowerCase().includes(search.toLowerCase()) ||
      getPermissionName(item.permissionId).toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === "" || item.roleId === Number(roleFilter);
    const matchesPermission = !selectedPermissionFilter || item.permissionId === selectedPermissionFilter;

    return matchesSearch && matchesRole && matchesPermission;
  });

  const columns: ColumnDef<RolePermission>[] = [
    {
      key: "roleId",
      label: "Role",
      sortable: true,
      render: (row: RolePermission) => (
        <span className="text-sm font-medium text-gray-900">{getRoleName(row.roleId)}</span>
      ),
    },
    {
      key: "permissionId",
      label: "Permission",
      sortable: true,
      render: (row: RolePermission) => (
        <span className="text-sm text-gray-700">{getPermissionName(row.permissionId)}</span>
      ),
    },
    {
      key: "validFrom",
      label: "Valid From",
      sortable: true,
      render: (row: RolePermission) => (
        <span className="text-sm font-mono text-gray-600">
          {row.validFrom ? new Date(row.validFrom).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "validTo",
      label: "Valid To",
      sortable: true,
      render: (row: RolePermission) => (
        <span className="text-sm font-mono text-gray-600">
          {row.validTo ? new Date(row.validTo).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (row: RolePermission) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: RolePermission) => (
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

  // Unique roles for filter dropdown
  const uniqueRoles = [...new Map(rolePermissions.map(r => [r.roleId, { id: r.roleId, name: getRoleName(r.roleId) }])).values()];

  return (
    <div>
      {/* Active Permission Filter Alert */}
      {selectedPermissionFilter && (
        <div className="mb-4 flex items-center justify-between p-3.5 bg-cyan-50/80 border border-cyan-100 rounded-xl text-cyan-800 text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5 text-cyan-600 animate-spin" style={{ animationDuration: "3s" }} />
            <span>
              Showing assignments for selected Permission:{" "}
              <span className="font-semibold bg-cyan-100/60 px-2 py-0.5 rounded text-cyan-900">
                {getPermissionName(selectedPermissionFilter)}
              </span>
            </span>
          </div>
          <button
            onClick={onClearPermissionFilter}
            className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 bg-white hover:bg-cyan-100/20 px-3 py-1.5 rounded-lg border border-cyan-200 transition-colors shadow-sm font-bold animate-pulse"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by role or permission..."
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

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>

          {(search || roleFilter) && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("");
              }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setForm({ roleId: 0, permissionId: 0, validFrom: "", validTo: "", active: true });
            setEditingId(null);
            setShowFormModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Assignment
        </button>
      </div>

      {/* Table */}
      <ReusableTable<RolePermission>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={PAGE_SIZE}
        defaultSortKey="roleId"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No role permissions found</p>
            {(search || roleFilter) ? (
              <p className="text-gray-400 text-xs mt-2">Try adjusting your search or filter</p>
            ) : (
              <button
                onClick={() => {
                  setForm({ roleId: 0, permissionId: 0, validFrom: "", validTo: "", active: true });
                  setEditingId(null);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first assignment →
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
                  {editingId ? "Edit Assignment" : "New Role Permission"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingId ? "Update assignment details" : "Assign a permission to a role"}
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
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.roleId || ""}
                    onChange={(e) => setForm({ ...form, roleId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  >
                    <option value="">Select Role</option>
                    {roleOptions.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.roleName || role.roleCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Permission <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.permissionId || ""}
                    onChange={(e) => setForm({ ...form, permissionId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  >
                    <option value="">Select Permission</option>
                    {permissionOptions.map((permission) => (
                      <option key={permission.id} value={permission.id}>
                        {permission.permissionName || permission.permissionCode}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid From <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valid To <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.validTo}
                    onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Active</label>
                  <Toggle
                    value={form.active}
                    onChange={(v) => setForm({ ...form, active: v })}
                  />
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Assignment?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. The role will lose this permission.
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

export default RolePermissionTab;
