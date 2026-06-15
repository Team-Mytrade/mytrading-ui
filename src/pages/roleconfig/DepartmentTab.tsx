import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PlusIcon,
  BuildingLibraryIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { Department, Domain } from "./RoleConfigTypes";
import { StatusBadge, Toggle } from "./RoleConfigShared";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/user/departments";
const DOMAIN_API_BASE = "/v1/api/user/domains";
const PAGE_SIZE = 10;

interface DepartmentTabProps {
  selectedDomainFilter?: number | null;
  onClearDomainFilter?: () => void;
  onViewRoles?: (departmentId: number) => void;
}

const DepartmentTab: React.FC<DepartmentTabProps> = ({ selectedDomainFilter, onClearDomainFilter, onViewRoles }) => {
  const { user } = useContext(AuthContext);

  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ departmentCode: "", name: "", description: "", domainId: 0, active: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
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
      const response = await fetch(API_BASE, {
        method: "GET",
        headers: getHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch departments");

      const data = await response.json();
      const departmentsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setDepartments(departmentsList);
    } catch (error) {
      console.error("Error fetching departments:", error);
      ToasterService.error("Failed to load departments");
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
  }, []);

  const validateForm = () => {
    if (!form.departmentCode?.trim()) {
      ToasterService.error("Department code is required");
      return false;
    }
    if (!form.name?.trim()) {
      ToasterService.error("Department name is required");
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
        departmentCode: form.departmentCode.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description?.trim() || "",
        domain: { id: Number(form.domainId) },
        tenantId: user?.tenantId,
        active: form.active ?? true,
      };

      let response;
      if (editingId) {
        response = await fetch(`${API_BASE}/${editingId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          if (errorData?.message?.includes("already exists") || errorData?.message?.includes("duplicate")) {
            ToasterService.error("Department code already exists. Please use a unique code.");
          } else {
            ToasterService.error(errorData?.message || "Failed to update department");
          }
          throw new Error(errorData?.message || "Update failed");
        }
        
        ToasterService.success("Department updated successfully!");
      } else {
        response = await fetch(API_BASE, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          if (errorData?.message?.includes("already exists") || errorData?.message?.includes("duplicate")) {
            ToasterService.error("Department code already exists. Please use a unique code.");
          } else {
            ToasterService.error(errorData?.message || "Failed to create department");
          }
          throw new Error(errorData?.message || "Creation failed");
        }
        
        ToasterService.success("Department created successfully!");
      }

      fetchData();
      setShowFormModal(false);
      setForm({ departmentCode: "", name: "", description: "", domainId: 0, active: true });
      setEditingId(null);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleEdit = (item: Department) => {
    setForm({
      departmentCode: item.departmentCode,
      name: item.name,
      description: item.description || "",
      domainId: item.domainId,
      active: item.active,
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

      ToasterService.success("Department deleted successfully!");
      fetchData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting department:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const getDomainName = (domainId: number) => {
    const domain = domains.find(d => d.id === domainId);
    return domain?.domainName || domain?.domainCode || `Domain #${domainId}`;
  };

  const filteredData = departments.filter((dept) => {
    const matchesSearch = Object.values(dept).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    );
    if (selectedDomainFilter) {
      return matchesSearch && dept.domainId === selectedDomainFilter;
    }
    return matchesSearch;
  });

  const columns: ColumnDef<Department>[] = [
    {
      key: "departmentCode",
      label: "Code",
      sortable: true,
      render: (row: Department) => (
        <span className="font-mono text-sm text-gray-900">{row.departmentCode}</span>
      ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row: Department) => (
        <span className="text-sm font-medium text-gray-900">{row.name}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (row: Department) => (
        <span className="text-sm text-gray-500">{row.description || "—"}</span>
      ),
    },
    {
      key: "domainId",
      label: "Domain",
      sortable: true,
      render: (row: Department) => (
        <span className="text-sm text-gray-600">{getDomainName(row.domainId)}</span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (row: Department) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: Department) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onViewRoles && onViewRoles(row.id)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="View Roles"
          >
            <ShieldCheckIcon className="h-4 w-4" />
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
      {/* Active Domain Filter Alert */}
      {selectedDomainFilter && (
        <div className="mb-4 flex items-center justify-between p-3.5 bg-cyan-50/80 border border-cyan-100 rounded-xl text-cyan-800 text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <BuildingLibraryIcon className="h-5 w-5 text-cyan-600" />
            <span>
              Showing departments for selected Domain:{" "}
              <span className="bg-cyan-100/60 px-2 py-0.5 rounded text-cyan-900 font-bold">
                {getDomainName(selectedDomainFilter)}
              </span>
            </span>
          </div>
          <button
            onClick={onClearDomainFilter}
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
            placeholder="Search departments..."
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
            setForm({ departmentCode: "", name: "", description: "", domainId: 0, active: true });
            setEditingId(null);
            setShowFormModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Department
        </button>
      </div>
      {/* Table */}
      <ReusableTable<Department>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={PAGE_SIZE}
        defaultSortKey="name"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No departments found</p>
            {!search && (
              <button
                onClick={() => {
                  setForm({ departmentCode: "", name: "", description: "", domainId: 0, active: true });
                  setEditingId(null);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first department →
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
                  {editingId ? "Edit Department" : "New Department"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingId ? "Update department details" : "Create a new department"}
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
                    Department Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.departmentCode}
                    onChange={(e) => setForm({ ...form, departmentCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                    placeholder="e.g., HR"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Unique identifier for the department (auto-uppercase)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder="e.g., Human Resources"
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder="Optional description"
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Department?</h3>
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

export default DepartmentTab;