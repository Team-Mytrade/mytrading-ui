import React, { useEffect, useState, FormEvent, useContext } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  Cog6ToothIcon,
  PlusIcon,
  GlobeAltIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { Domain } from "./RoleConfigTypes";
import { StatusBadge, Toggle } from "./RoleConfigShared";
import { AuthContext } from "../../context/AuthContext";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

const API_BASE = "/v1/api/user/domains";
const PAGE_SIZE = 10;

interface DomainTabProps {
  selectedTenantFilter?: string | null;
  onClearTenantFilter?: () => void;
  onViewDepartments?: (domainId: number) => void;
}

const DomainTab: React.FC<DomainTabProps> = ({ selectedTenantFilter, onClearTenantFilter, onViewDepartments }) => {
  const { user } = useContext(AuthContext);
  const tenantId = user?.tenantId;

  const [search, setSearch] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ domainName: "", description: "", active: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
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

      if (!response.ok) throw new Error("Failed to fetch domains");

      const data = await response.json();
      const domainsList = Array.isArray(data) ? data : data?.data || data?.content || [];
      setDomains(domainsList);
    } catch (error) {
      console.error("Error fetching domains:", error);
      ToasterService.error("Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!form.domainName?.trim()) {
      ToasterService.error("Domain name is required");
      return;
    }

    try {
      const payload = {
        domainName: form.domainName.trim(),
        description: form.description?.trim() || "",
        active: form.active ?? true,
        tenantId: tenantId,
      };

      let response;
      if (editingId) {
        response = await fetch(`${API_BASE}/${editingId}`, {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (response.ok) ToasterService.success("Domain updated successfully!");
      } else {
        response = await fetch(API_BASE, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });
        if (response.ok) ToasterService.success("Domain created successfully!");
      }

      if (!response.ok) throw new Error("Operation failed");

      fetchData();
      setShowFormModal(false);
      setForm({ domainName: "", description: "", active: true });
      setEditingId(null);
    } catch (error) {
      console.error("Error:", error);
      ToasterService.error("Operation failed");
    }
  };

  const handleEdit = (item: Domain) => {
    setForm({
      domainName: item.domainName,
      description: item.description || "",
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

      if (!response.ok) throw new Error("Delete failed");

      ToasterService.success("Domain deleted successfully!");
      fetchData();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting domain:", error);
      ToasterService.error("Failed to delete");
    }
  };

  const filteredData = domains.filter((domain) => {
    const matchesSearch = Object.values(domain).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    );
    if (selectedTenantFilter) {
      return matchesSearch && domain.tenantId === selectedTenantFilter;
    }
    return matchesSearch;
  });

  const columns: ColumnDef<Domain>[] = [
    {
      key: "domainCode",
      label: "Code",
      sortable: true,
      render: (row: Domain) => (
        <span className="font-mono text-sm text-gray-900">{row.domainCode}</span>
      ),
    },
    {
      key: "domainName",
      label: "Name",
      sortable: true,
      render: (row: Domain) => (
        <span className="text-sm font-medium text-gray-900">{row.domainName}</span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (row: Domain) => (
        <span className="text-sm text-gray-500">{row.description || "—"}</span>
      ),
    },
    {
      key: "tenantId",
      label: "Tenant ID",
      sortable: true,
      render: (row: Domain) => (
        <span className="font-mono text-xs text-gray-500">{row.tenantId}</span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (row: Domain) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      label: "",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row: Domain) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onViewDepartments && onViewDepartments(row.id)}
            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="View Departments"
          >
            <BuildingLibraryIcon className="h-4 w-4" />
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
      {/* Active Tenant Filter Alert */}
      {selectedTenantFilter && (
        <div className="mb-4 flex items-center justify-between p-3.5 bg-cyan-50/80 border border-cyan-100 rounded-xl text-cyan-800 text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <GlobeAltIcon className="h-5 w-5 text-cyan-600" />
            <span>
              Showing domains for selected Tenant ID:{" "}
              <span className="font-mono bg-cyan-100/60 px-2 py-0.5 rounded text-cyan-900 font-bold">
                {selectedTenantFilter}
              </span>
            </span>
          </div>
          <button
            onClick={onClearTenantFilter}
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
            placeholder="Search domains..."
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
            setForm({ domainName: "", description: "", active: true });
            setEditingId(null);
            setShowFormModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Domain
        </button>
      </div>

  
      {/* Table */}
      <ReusableTable<Domain>
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={false}
        pageSize={PAGE_SIZE}
        defaultSortKey="domainName"
        defaultSortOrder="asc"
        emptyState={
          <div className="flex flex-col items-center py-12">
            <Cog6ToothIcon className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No domains found</p>
            {!search && (
              <button
                onClick={() => {
                  setForm({ domainName: "", description: "", active: true });
                  setEditingId(null);
                  setShowFormModal(true);
                }}
                className="mt-3 text-sm text-cyan-600 hover:text-cyan-700"
              >
                Add your first domain →
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
                  {editingId ? "Edit Domain" : "New Domain"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {editingId ? "Update domain details" : "Create a new domain"}
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
                    Domain Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.domainName}
                    onChange={(e) => setForm({ ...form, domainName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    placeholder="e.g., Trading Operations"
                    autoFocus
                  />
                  <p className="text-xs text-gray-400 mt-1">Domain code will be auto-generated</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Domain?</h3>
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

export default DomainTab;