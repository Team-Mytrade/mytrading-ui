import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TruckIcon,
  HashtagIcon,
  IdentificationIcon,
  ScaleIcon,
  SignalIcon,
  CheckCircleIcon,
  XCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id?: number;
  registrationNumber: string;
  type: "Truck" | "Van" | "Container" | "Tempo";
  capacity: string;
  status: "Active" | "Inactive";
  gpsTrackingUrl?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/dispatch/vehicles";

const TYPE_OPTIONS: Vehicle["type"][]     = ["Truck", "Van", "Container", "Tempo"];
const STATUS_OPTIONS: Vehicle["status"][] = ["Active", "Inactive"];

const STATUS_STYLES: Record<Vehicle["status"], string> = {
  Active:   "bg-green-100 text-green-800",
  Inactive: "bg-gray-100  text-gray-500",
};

const STATUS_ICONS: Record<Vehicle["status"], React.ReactNode> = {
  Active:   <CheckCircleIcon className="h-3 w-3" />,
  Inactive: <XCircleIcon     className="h-3 w-3" />,
};

const TYPE_STYLES: Record<Vehicle["type"], string> = {
  Truck:     "bg-blue-100   text-blue-800",
  Van:       "bg-purple-100 text-purple-800",
  Container: "bg-orange-100 text-orange-800",
  Tempo:     "bg-cyan-100   text-cyan-800",
};

const emptyForm: Vehicle = {
  registrationNumber: "",
  type:               "Truck",
  capacity:           "",
  status:             "Active",
  gpsTrackingUrl:     "",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const VehiclePage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<Vehicle>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<Vehicle | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Vehicle[]>(API_URL);
      setVehicles(res.data);
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Vehicle, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleEdit = (vehicle: Vehicle) => {
    setForm({ ...vehicle, gpsTrackingUrl: vehicle.gpsTrackingUrl ?? "" });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, gpsTrackingUrl: form.gpsTrackingUrl || undefined };
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }
      loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving vehicle:", err);
    }
  };

  const promptDelete = (vehicle: Vehicle) => {
    setDeletingItem(vehicle);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`);
      loadData();
    } catch (err) {
      console.error("Error deleting vehicle:", err);
    }
    setDeletingItem(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total:    vehicles.length,
    active:   vehicles.filter(v => v.status === "Active").length,
    inactive: vehicles.filter(v => v.status === "Inactive").length,
    gpsEnabled: vehicles.filter(v => !!v.gpsTrackingUrl).length,
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Vehicle>[] = [
    {
      key: "id",
      label: "ID",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "registrationNumber",
      label: "Reg. Number",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <IdentificationIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: true,
      render: (_, v) => {
        const t = v as Vehicle["type"];
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[t]}`}>
            <TruckIcon className="h-3 w-3" />
            {t}
          </span>
        );
      },
    },
    {
      key: "capacity",
      label: "Capacity",
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <ScaleIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (_, v) => {
        const s = v as Vehicle["status"];
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s]}`}>
            {STATUS_ICONS[s]}
            {s}
          </span>
        );
      },
    },
    {
      key: "gpsTrackingUrl",
      label: "GPS",
      render: (row) =>
        row.gpsTrackingUrl ? (
          <a
            href={row.gpsTrackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
          >
            <SignalIcon className="h-3 w-3" />
            Track
          </a>
        ) : (
          <span className="text-xs text-gray-400">N/A</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => handleEdit(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => promptDelete(row)}
            title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your fleet and track vehicle status
            </p>
          </div> */}
          <AddButton
            label="Add Vehicle"
            onClick={() => { setForm(emptyForm); setShowForm(true); }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            label="GPS Enabled"
            value={stats.gpsEnabled}
            gradient="from-indigo-50 to-purple-50"
            borderColor="border-indigo-100"
            labelColor="text-indigo-600"
          />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit Vehicle" : "Add New Vehicle"}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.registrationNumber}
                    onChange={e => handleChange("registrationNumber", e.target.value)}
                    placeholder="e.g. TN 01 AB 1234"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={e => handleChange("type", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    {TYPE_OPTIONS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.capacity}
                    onChange={e => handleChange("capacity", e.target.value)}
                    placeholder="e.g. 10 Tons"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.status}
                    onChange={e => handleChange("status", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  GPS Tracking URL <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={form.gpsTrackingUrl}
                  onChange={e => handleChange("gpsTrackingUrl", e.target.value)}
                  placeholder="https://gps.example.com/track/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
                >
                  {form.id ? "Update Vehicle" : "Add Vehicle"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Vehicle>
          data={vehicles}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by registration, type, capacity, or status..."
          searchFields={["registrationNumber", "type", "capacity", "status"]}
          pageSize={5}
          defaultSortKey="registrationNumber"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <WrenchScrewdriverIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">
                No vehicles found
              </p>
              <button
                onClick={() => { setForm(emptyForm); setShowForm(true); }}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Add your first vehicle →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete Popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Vehicle"
        subText="Are you sure you want to delete this vehicle? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default VehiclePage;