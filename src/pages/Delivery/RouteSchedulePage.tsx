import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  MapPinIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteSchedule {
  id?: number;
  name: string;
  startLocation: string;
  endLocation: string;
  distanceKm: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/delivery/routes";

const emptyForm: RouteSchedule = {
  name:          "",
  startLocation: "",
  endLocation:   "",
  distanceKm:    0,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const RouteSchedulePage: React.FC = () => {
  const [routes, setRoutes]     = useState<RouteSchedule[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<RouteSchedule>(emptyForm);
  const [saving, setSaving]     = useState(false);

  const [search, setSearch] = useState("");

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingRoute, setDeletingRoute]     = useState<RouteSchedule | null>(null);

  useEffect(() => { fetchRoutes(); }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await axios.get<RouteSchedule[]>(API_URL);
      setRoutes(res.data);
    } catch {
      console.error("Error loading routes.");
      ToasterService.error("Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof RouteSchedule, value: string | number) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleAddNew = () => { setForm(emptyForm); setShowForm(true); };

  const handleEdit = (r: RouteSchedule) => {
    setForm({ ...r });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.startLocation.trim() || !form.endLocation.trim()) {
      ToasterService.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    const payload = {
      name:          form.name,
      startLocation: form.startLocation,
      endLocation:   form.endLocation,
      distanceKm:    Number(form.distanceKm) || 0,
    };

    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
        ToasterService.success("Route updated successfully!");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Route added successfully!");
      }
      await fetchRoutes();
      resetForm();
    } catch {
      console.error("Save failed");
      ToasterService.error("Failed to save route");
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (r: RouteSchedule) => {
    setDeletingRoute(r);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingRoute?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingRoute.id}`);
      ToasterService.success("Route deleted successfully!");
      setRoutes(prev => prev.filter(r => r.id !== deletingRoute.id));
    } catch {
      console.error("Delete failed");
      ToasterService.error("Failed to delete route");
    } finally {
      setShowDeletePopup(false);
      setDeletingRoute(null);
    }
  };

  // ── Derived: search + stats ─────────────────────────────────────────────────

  const filteredRoutes = useMemo(() => {
    const term = search.toLowerCase();
    return routes.filter(r =>
      r.name.toLowerCase().includes(term) ||
      r.startLocation.toLowerCase().includes(term) ||
      r.endLocation.toLowerCase().includes(term)
    );
  }, [routes, search]);

  const stats = useMemo(() => {
    const totalDistance = routes.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
    const avgDistance = routes.length ? Math.round(totalDistance / routes.length) : 0;
    const longest = routes.reduce((max, r) => Math.max(max, r.distanceKm || 0), 0);
    return {
      total: routes.length,
      totalDistance,
      avgDistance,
      longest,
    };
  }, [routes]);

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<RouteSchedule>[] = [
    {
      key: "name",
      label: "Route Name",
      sortable: true,
      headerClassName: "w-[28%] text-left",
      className: "w-[28%]",
      render: (_, v) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {String(v).charAt(0).toUpperCase() || "R"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "startLocation",
      label: "Route",
      headerClassName: "w-[34%] text-left",
      className: "w-[34%]",
      render: (row) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPinIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium">{row.startLocation}</span>
          <ArrowsRightLeftIcon className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
          <span className="truncate font-medium">{row.endLocation}</span>
        </div>
      ),
    },
    {
      key: "distanceKm",
      label: "Distance",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (_, v) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          {String(v)} km
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "w-[20%] text-right pr-4",
      className: "w-[20%] text-right",
      render: (row) => (
        <div
          className="flex items-center justify-end gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
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
      <PageMeta title="Route Management" description="Manage delivery routes" />
      <PageBreadcrumb pageTitle="Route Management" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton label="Add Route" onClick={handleAddNew} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Routes"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Total Distance"
            value={`${stats.totalDistance} km`}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Average Distance"
            value={`${stats.avgDistance} km`}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Longest Route"
            value={`${stats.longest} km`}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by route name or location..."
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
        </div>

        {/* Table */}
        <ReusableTable<RouteSchedule>
          data={filteredRoutes}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="name"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <MapPinIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No routes found</p>
              {search ? (
                <p className="text-gray-400 text-xs">Try adjusting your search</p>
              ) : (
                <button
                  onClick={handleAddNew}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first route →
                </button>
              )}
            </div>
          }
        />

        {/* Add / Edit Modal — portal, matches CRM segment modal style */}
        {showForm &&
          createPortal(
            <div
              key="route-modal"
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">

                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {form.id ? "Edit Route" : "Create New Route"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.id ? "Update this route's details" : "Add a new delivery route"}
                    </p>
                  </div>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-4 pt-2">
                    <FloatingInput
                      label="Route Name"
                      name="name"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        label="Start Location"
                        name="startLocation"
                        value={form.startLocation}
                        onChange={(e) => handleChange("startLocation", e.target.value)}
                        required
                      />
                      <FloatingInput
                        label="End Location"
                        name="endLocation"
                        value={form.endLocation}
                        onChange={(e) => handleChange("endLocation", e.target.value)}
                        required
                      />
                    </div>

                    <FloatingInput
                      label="Distance (Km)"
                      name="distanceKm"
                      type="number"
                      value={form.distanceKm}
                      onChange={(e) => handleChange("distanceKm", Number(e.target.value))}
                      required
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
                      {saving ? "Saving..." : form.id ? "Update Route" : "Create Route"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Route"
        subText={`Are you sure you want to delete "${deletingRoute?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRoute(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default RouteSchedulePage;
