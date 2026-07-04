import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TruckIcon,
  IdentificationIcon,
  ScaleIcon,
  UserIcon,
  WrenchScrewdriverIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

// ─── Types ────────────────────────────────────────────────────────────────────

// Matches the confirmed API schema exactly:
// GET returns id + all fields below including active (read-only, backend-managed)
// POST/PUT accept only licensePlate, model, type, capacityKg, owner, status
interface Vehicle {
  id?: number;
  licensePlate: string;
  model: string;
  type: string;
  capacityKg: number;
  owner: string;
  status: string;
  active?: boolean; // returned by GET, never sent on POST/PUT
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/delivery/vehicles";

const TYPE_OPTIONS: string[]   = ["Truck", "Van", "Container", "Tempo"]; // TODO: confirm against backend enum
const STATUS_OPTIONS: string[] = ["Active", "Inactive", "Maintenance"];  // TODO: confirm against backend enum

const STATUS_STYLES: Record<string, string> = {
  Active:      "bg-green-100  text-green-800 border-green-200/60",
  Inactive:    "bg-gray-100   text-gray-500 border-gray-200/60",
  Maintenance: "bg-amber-100  text-amber-800 border-amber-200/60",
};

const TYPE_STYLES: Record<string, string> = {
  Truck:     "bg-blue-100   text-blue-800",
  Van:       "bg-purple-100 text-purple-800",
  Container: "bg-orange-100 text-orange-800",
  Tempo:     "bg-cyan-100   text-cyan-800",
};

const emptyForm: Vehicle = {
  licensePlate: "",
  model:        "",
  type:         "Truck",
  capacityKg:   0,
  owner:        "",
  status:       "Active",
};

// ─── Auth helpers (same pattern as CRM segments page) ──────────────────────────

const getTenantIdFromToken = (token: string) => {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded?.tenantId || null;
  } catch {
    return null;
  }
};

const getTenantId = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user?.tenantId) return user.tenantId;
    }
    const token = localStorage.getItem("accessToken");
    if (token) return getTenantIdFromToken(token);
    return null;
  } catch {
    return null;
  }
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const VehiclePage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Vehicle>(emptyForm);
  const [saving, setSaving]     = useState(false);

  const [search, setSearch]             = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | Active | Inactive | Maintenance
  const [showFilters, setShowFilters]   = useState(false);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<Vehicle | null>(null);

  const token = localStorage.getItem("accessToken");
  const tenantId = getTenantId();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => { loadData(); }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Vehicle[]>(API_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setVehicles(res.data);
    } catch (err) {
      console.error("Failed to load vehicles:", err);
      ToasterService.error("Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Vehicle, value: string | number | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleAddNew = () => { setForm(emptyForm); setShowForm(true); };

  const handleEdit = (vehicle: Vehicle) => {
    setForm({ ...vehicle });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.licensePlate.trim() || !form.model.trim() || !form.owner.trim()) {
      ToasterService.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    // Body shape matches the confirmed API schema exactly — active is never sent.
    const payload = {
      licensePlate: form.licensePlate,
      model:        form.model,
      type:         form.type,
      capacityKg:   Number(form.capacityKg) || 0,
      owner:        form.owner,
      status:       form.status,
    };

    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload, { headers: authHeaders });
        ToasterService.success("Vehicle updated successfully!");
      } else {
        await axios.post(API_URL, payload, { headers: authHeaders });
        ToasterService.success("Vehicle added successfully!");
      }
      await loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving vehicle:", err);
      ToasterService.error("Failed to save vehicle");
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (vehicle: Vehicle) => {
    setDeletingItem(vehicle);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`, { headers: authHeaders });
      ToasterService.success("Vehicle deleted successfully!");
      setVehicles(prev => prev.filter(v => v.id !== deletingItem.id));
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      ToasterService.error("Failed to delete vehicle");
    } finally {
      setShowDeletePopup(false);
      setDeletingItem(null);
    }
  };

  // ── Derived: search + filter ────────────────────────────────────────────────

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const term = search.toLowerCase();
      const matchesSearch =
        v.licensePlate.toLowerCase().includes(term) ||
        v.model.toLowerCase().includes(term) ||
        v.type.toLowerCase().includes(term) ||
        v.owner.toLowerCase().includes(term);

      const matchesFilter = activeFilter === "ALL" || v.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [vehicles, search, activeFilter]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:       vehicles.length,
    active:      vehicles.filter(v => v.status === "Active").length,
    inactive:    vehicles.filter(v => v.status === "Inactive").length,
    maintenance: vehicles.filter(v => v.status === "Maintenance").length,
  }), [vehicles]);

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Vehicle>[] = [
    {
      key: "licensePlate",
      label: "License Plate",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (_, v) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <IdentificationIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "model",
      label: "Model",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (_, v) => (
        <span className="text-sm text-slate-600 truncate">{String(v) || "—"}</span>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (_, v) => {
        const t = String(v);
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[t] ?? "bg-gray-100 text-gray-700"}`}>
            <TruckIcon className="h-3 w-3" />
            {t}
          </span>
        );
      },
    },
    {
      key: "capacityKg",
      label: "Capacity",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <ScaleIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span>{v ? `${v} kg` : "—"}</span>
        </div>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <UserIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (_, v) => {
        const s = String(v);
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[s] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
            {s}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      headerClassName: "w-[8%] text-right pr-4",
      className: "w-[8%] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleEdit(row)}
            title="Edit"
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => promptDelete(row)}
            title="Delete"
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <PageMeta title="Vehicle Management" description="Manage fleet vehicles" />
      <PageBreadcrumb pageTitle="Vehicle Management" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton label="Add Vehicle" onClick={handleAddNew} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Vehicles"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Inactive"
            value={stats.inactive}
            gradient="from-gray-50 to-slate-50"
            borderColor="border-gray-200"
            labelColor="text-gray-500"
          />
          <StatsCard
            label="Maintenance"
            value={stats.maintenance}
            gradient="from-amber-50 to-orange-50"
            borderColor="border-amber-100"
            labelColor="text-amber-600"
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by license plate, model, type, or owner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg border p-2 flex items-center justify-center transition-colors h-[40px] w-[40px] ${
                showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-slide-down">
            <div className="flex flex-wrap gap-4">
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
                <FloatingSelect
                  label="Filter by Status"
                  name="filter"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  includeEmptyOption={false}
                  className="!mb-0"
                  options={[
                    { id: "ALL", name: "All Vehicles" },
                    ...STATUS_OPTIONS.map(s => ({ id: s, name: s })),
                  ]}
                />
              </div>
              {activeFilter !== "ALL" && (
                <button
                  onClick={() => setActiveFilter("ALL")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Vehicle>
          data={filteredVehicles}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="licensePlate"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <WrenchScrewdriverIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No vehicles found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  onClick={handleAddNew}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first vehicle →
                </button>
              )}
            </div>
          }
        />

        {/* Add / Edit Modal — portal, matches CRM segment modal style */}
        {showForm &&
          createPortal(
            <div
              key="vehicle-modal"
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {form.id ? "Edit Vehicle" : "Create New Vehicle"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.id ? "Update this vehicle's details" : "Add a new vehicle to your fleet"}
                    </p>
                  </div>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingInput
                      label="License Plate"
                      name="licensePlate"
                      value={form.licensePlate}
                      onChange={(e) => handleChange("licensePlate", e.target.value)}
                      required
                    />

                    <FloatingInput
                      label="Model"
                      name="model"
                      value={form.model}
                      onChange={(e) => handleChange("model", e.target.value)}
                      required
                    />

                    <FloatingSelect
                      label="Vehicle Type"
                      name="type"
                      value={form.type}
                      onChange={(e) => handleChange("type", e.target.value)}
                      includeEmptyOption={false}
                      required
                      options={TYPE_OPTIONS.map(t => ({ id: t, name: t }))}
                    />

                    <div className="relative">
                      <FloatingInput
                        label="Capacity (Kg)"
                        name="capacityKg"
                        type="number"
                        value={form.capacityKg}
                        onChange={(e) => handleChange("capacityKg", Number(e.target.value))}
                        required
                      />
                      <span className="absolute right-3 top-3.5 text-xs text-gray-400 pointer-events-none">kg</span>
                    </div>

                    <FloatingInput
                      label="Owner"
                      name="owner"
                      value={form.owner}
                      onChange={(e) => handleChange("owner", e.target.value)}
                      required
                    />

                    <FloatingSelect
                      label="Status"
                      name="status"
                      value={form.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                      includeEmptyOption={false}
                      required
                      options={STATUS_OPTIONS.map(s => ({ id: s, name: s }))}
                    />
                  </div>

                  <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 !mb-0 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm disabled:opacity-60"
                    >
                      {saving ? "Saving..." : form.id ? "Update Vehicle" : "Create Vehicle"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Vehicle"
        subText={
          deletingItem
            ? `Are you sure you want to delete "${deletingItem.licensePlate}"? This action cannot be undone.`
            : "Are you sure you want to delete this vehicle?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default VehiclePage;
