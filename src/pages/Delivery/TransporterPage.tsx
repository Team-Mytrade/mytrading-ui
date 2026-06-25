import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TruckIcon,
  PhoneIcon,
  UserIcon,
  HashtagIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transporter {
  id?: number;
  name: string;
  vehicleNumber: string;
  contactPerson: string;
  phone: string;
  status: "Active" | "Inactive";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/dispatch/transporters";

const STATUS_OPTIONS: Transporter["status"][] = ["Active", "Inactive"];

const STATUS_STYLES: Record<Transporter["status"], string> = {
  Active:   "bg-green-100 text-green-800",
  Inactive: "bg-gray-100  text-gray-500",
};

const STATUS_ICONS: Record<Transporter["status"], React.ReactNode> = {
  Active:   <CheckCircleIcon className="h-3 w-3" />,
  Inactive: <XCircleIcon     className="h-3 w-3" />,
};

const emptyForm: Transporter = {
  name:          "",
  vehicleNumber: "",
  contactPerson: "",
  phone:         "",
  status:        "Active",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TransporterPage: React.FC = () => {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading]           = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<Transporter>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup]   = useState(false);
  const [deletingItem, setDeletingItem]         = useState<Transporter | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Transporter[]>(API_URL);
      setTransporters(res.data);
    } catch (err) {
      console.error("Failed to load transporters:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Transporter, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleEdit = (transporter: Transporter) => {
    setForm({ ...transporter });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, form);
      } else {
        await axios.post(API_URL, form);
      }
      loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving transporter:", err);
    }
  };

  const promptDelete = (transporter: Transporter) => {
    setDeletingItem(transporter);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem?.id) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`);
      loadData();
    } catch (err) {
      console.error("Error deleting transporter:", err);
    }
    setDeletingItem(null);
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = {
    total:    transporters.length,
    active:   transporters.filter(t => t.status === "Active").length,
    inactive: transporters.filter(t => t.status === "Inactive").length,
    vehicles: new Set(transporters.map(t => t.vehicleNumber).filter(Boolean)).size,
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Transporter>[] = [
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
      key: "name",
      label: "Transporter Name",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <TruckIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "vehicleNumber",
      label: "Vehicle Number",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <IdentificationIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "contactPerson",
      label: "Contact Person",
      sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <PhoneIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (_, v) => {
        const s = v as Transporter["status"];
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[s]}`}>
            {STATUS_ICONS[s]}
            {s}
          </span>
        );
      },
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
      <PageMeta
        title="Transporter / Carrier Management"
        description="Manage transporters and carriers"
      />
      <PageBreadcrumb pageTitle="Transporter / Carrier Management" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Transporters</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage transporter and carrier records
            </p>
          </div> */}
          <AddButton
            label="Add Transporter"
            onClick={() => { setForm(emptyForm); setShowForm(true); }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard
            label="Total Transporters"
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
            label="Unique Vehicles"
            value={stats.vehicles}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        {/* Inline Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {form.id ? "Edit Transporter" : "Add New Transporter"}
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
                    Transporter Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => handleChange("name", e.target.value)}
                    placeholder="e.g. Fast Carriers Ltd."
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.vehicleNumber}
                    onChange={e => handleChange("vehicleNumber", e.target.value)}
                    placeholder="e.g. TN 01 AB 1234"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={e => handleChange("contactPerson", e.target.value)}
                    placeholder="Contact name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => handleChange("phone", e.target.value)}
                    placeholder="e.g. +91 98765 43210"
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

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
                >
                  {form.id ? "Update Transporter" : "Add Transporter"}
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
        <ReusableTable<Transporter>
          data={transporters}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by name, vehicle, contact, or status..."
          searchFields={["name", "vehicleNumber", "contactPerson", "phone", "status"]}
          pageSize={5}
          defaultSortKey="name"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <TruckIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">
                No transporters found
              </p>
              <button
                onClick={() => { setForm(emptyForm); setShowForm(true); }}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Add your first transporter →
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
        innerText="Delete Transporter"
        subText="Are you sure you want to delete this transporter? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default TransporterPage;
