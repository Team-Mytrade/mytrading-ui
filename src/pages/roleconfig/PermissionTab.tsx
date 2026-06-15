import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PlusIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { Domain, Permission } from "./RoleConfigTypes";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/user/permissions";
const DOMAIN_API_BASE = "/v1/api/user/domains";
const PAGE_SIZE = 10;

interface PermissionTabProps {
  onViewRolePermissions?: (permissionId: number) => void;
}

const PermissionTab: React.FC<PermissionTabProps> = ({ onViewRolePermissions }) => {
  const { user } = useContext(AuthContext);
  const tenantId = user?.tenantId;

  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ permissionCode: "", permissionName: "", domainId: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
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
      const response = await fetch(`${API_BASE}/all`, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch permissions");

      const data = await response.json();
      const permissionsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setPermissions(permissionsList);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      ToasterService.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const response = await fetch(DOMAIN_API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch domains");

      const data = await response.json();
      const domainsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setDomains(domainsList);
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchDomains();
  }, [tenantId]);

  const validateForm = () => {
    if (!form.permissionCode?.trim()) {
      ToasterService.error("Permission code is required");
      return false;
    }
    if (!form.permissionName?.trim()) {
      ToasterService.error("Permission name is required");
      return false;
    }
    if (!form.domainId) {
      ToasterService.error("Please select a domain");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const payload = {
        permissionCode: form.permissionCode.trim().toUpperCase(),
        permissionName: form.permissionName.trim(),
        domain: { id: Number(form.domainId) },
        tenantId: tenantId,
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
          if (errorData?.message?.includes("already exists") || errorData?.message?.includes("duplicate")) {
            ToasterService.error("Permission code already exists. Please use a unique code.");
          } else {
            ToasterService.error(errorData?.message || "Failed to update permission");
          }
          throw new Error(errorData?.message || "Update failed");
        }

        ToasterService.success("Permission updated successfully!");
      } else {
        response = await fetch(API_BASE, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData?.message?.includes("already exists") || errorData?.message?.includes("duplicate")) {
            ToasterService.error("Permission code already exists. Please use a unique code.");
          } else {
            ToasterService.error(errorData?.message || "Failed to create permission");
          }
          throw new Error(errorData?.message || "Creation failed");
        }

        ToasterService.success("Permission created successfully!");
      }

      fetchData();
      setShowFormModal(false);
      setForm({ permissionCode: "", permissionName: "", domainId: 0 });
      setEditingId(null);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEdit = (item: Permission) => {
    setForm({
      permissionCode: item.permissionCode,
      permissionName: item.permissionName,
      domainId: item.domain?.id || 0,
    });
    setEditingId(item.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        ToasterService.error(errorData?.message || "Failed to delete");
        return;
      }

      ToasterService.success("Permission deleted successfully!");
      fetchData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting permission:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const getDomainName = (domain: any) => {
    if (!domain) return "—";
    return domain.domainName || domain.domainCode || `Domain #${domain.id}`;
  };

  const filteredData = permissions.filter((permission) =>
    Object.values(permission).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    ) ||
    permission.domain?.domainName?.toLowerCase().includes(search.toLowerCase())
  );

  const columns: ColumnDef<Permission>[] = [
    {
      key: "permissionCode",
      label: "Code",
      sortable: true,
      render: (row: Permission) => (
        <span className="font-mono text-sm text-gray-900">{row.permissionCode}</span>
      ),
    },
    {
      key: "permissionName",
      label: "Name",
      sortable: true,
      render: (row: Permission) => (
        <span className="text-sm font-medium text-gray-900">{row.permissionName}</span>
      ),
    },
    {
      key: "domain",
      label: "Domain",
      sortable: true,
      render: (row: Permission) => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-900">{getDomainName(row.domain)}</span>
          {row.domain?.domainCode && (
            <span className="text-xs text-gray-500 font-mono">{row.domain.domainCode}</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: Permission) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onViewRolePermissions && onViewRolePermissions(row.id)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="View Role Permissions"
          >
            <LinkIcon className="h-4 w-4" />
          </button>
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
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search permissions..."
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
            setForm({ permissionCode: "", permissionName: "", domainId: 0 });
            setEditingId(null);
            setShowFormModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Permission
        </button>
      </div>


      {/* Table */}
      <ReusableTable<Permission>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={PAGE_SIZE}
        defaultSortKey="permissionName"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No permissions found</p>
            {!search && (
              <button
                onClick={() => {
                  setForm({ permissionCode: "", permissionName: "", domainId: 0 });
                  setEditingId(null);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first permission →
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
                  {editingId ? "Edit Permission" : "New Permission"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingId ? "Update permission details" : "Create a new permission"}
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
                    Permission Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.permissionCode}
                    onChange={(e) => setForm({ ...form, permissionCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    placeholder="e.g., USER_READ"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Unique identifier for the permission (auto-uppercase)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Permission Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.permissionName}
                    onChange={(e) => setForm({ ...form, permissionName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder="e.g., Read User"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domain <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.domainId || ""}
                    onChange={(e) => setForm({ ...form, domainId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    required
                  >
                    <option value="">Select Domain</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.domainName || domain.domainCode}
                      </option>
                    ))}
                  </select>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Permission?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. Users with this permission may be affected.
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

export default PermissionTab;