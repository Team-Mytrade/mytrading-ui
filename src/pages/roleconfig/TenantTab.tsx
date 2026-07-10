import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PlusIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { Tenant } from "./RoleConfigTypes";
import { StatusBadge, Toggle } from "./RoleConfigShared";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/user/tenants";
const PAGE_SIZE = 10;

interface TenantTabProps {
  onViewDomains?: (tenantId: string) => void;
}

const TenantTab: React.FC<TenantTabProps> = ({ onViewDomains }) => {
  const { user } = useContext(AuthContext);
  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({ tenantId: "", tenantName: "", active: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
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
      const response = await fetch(API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch tenants");

      const data = await response.json();
      const tenantsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setTenants(tenantsList);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      ToasterService.error("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.tenantName?.trim()) {
      ToasterService.error("Tenant name is required");
      return;
    }

    try {
      const payload = {
        tenantId: editingTenantId || form.tenantId,
        tenantName: form.tenantName.trim(),
        active: form.active ?? true,
      };

      let response;
      if (editingTenantId) {
        response = await fetch(`${API_BASE}/${editingTenantId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (response.ok) ToasterService.success("Tenant updated successfully!");
      } else {
        response = await fetch(API_BASE, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (response.ok) ToasterService.success("Tenant created successfully!");
      }

      if (!response.ok) throw new Error("Operation failed");

      fetchData();
      setShowFormModal(false);
      setForm({ tenantId: "", tenantName: "", active: true });
      setEditingTenantId(null);
    } catch (error) {
      console.error("Error:", error);
      ToasterService.error("Operation failed");
    }
  };

  const handleEdit = (item: Tenant) => {
    setForm({ tenantId: item.tenantId, tenantName: item.tenantName, active: item.active });
    setEditingTenantId(item.tenantId);
    setShowFormModal(true);
  };

  const handleDelete = async (tenantId: string) => {
    try {
      const response = await fetch(`${API_BASE}/${tenantId}`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Delete failed");

      ToasterService.success("Tenant deleted successfully!");
      fetchData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting tenant:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const filteredData = tenants.filter((tenant) =>
    Object.values(tenant).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    )
  );

  const columns: ColumnDef<Tenant>[] = [
    {
      key: "tenantId",
      label: "Tenant ID",
      sortable: true,
      render: (row: Tenant) => (
        <span className="font-mono text-sm text-gray-600">{row.tenantId}</span>
      ),
    },
    {
      key: "tenantName",
      label: "Tenant Name",
      sortable: true,
      render: (row: Tenant) => (
        <span className="text-sm font-medium text-gray-900">{row.tenantName}</span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (row: Tenant) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: Tenant) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onViewDomains && onViewDomains(row.tenantId)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="View Domains"
          >
            <GlobeAltIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleEdit(row)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(row.tenantId)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.active).length,
    inactive: tenants.filter((t) => !t.active).length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
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
            setForm({ tenantId: "", tenantName: "", active: true });
            setEditingTenantId(null);
            setShowFormModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Tenant
        </button>
      </div>

    

      {/* Table */}
      <ReusableTable<Tenant>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={PAGE_SIZE}
        defaultSortKey="tenantName"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No tenants found</p>
            {!search && (
              <button
                onClick={() => {
                  setForm({ tenantId: "", tenantName: "", active: true });
                  setEditingTenantId(null);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first tenant →
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
                  {editingTenantId ? "Edit Tenant" : "New Tenant"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingTenantId ? "Update tenant details" : "Create a new tenant"}
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
                    Tenant Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.tenantName}
                    onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder="Enter tenant name"
                    autoFocus
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
                  {editingTenantId ? "Update" : "Create"}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Tenant?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This action cannot be undone. All associated data will be lost.
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

export default TenantTab;
