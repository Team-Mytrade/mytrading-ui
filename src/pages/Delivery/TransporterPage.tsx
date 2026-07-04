import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TruckIcon,
  PhoneIcon,
  UserIcon,
  EnvelopeIcon,
  MapPinIcon,
  IdentificationIcon,
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
import { FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transporter {
  id?: number;
  name: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  address: string;
  gstNumber: string;
  status: "Active" | "Inactive";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = "/v1/api/delivery/transporters";

const STATUS_OPTIONS: Transporter["status"][] = ["Active", "Inactive"];

const STATUS_STYLES: Record<Transporter["status"], string> = {
  Active:   "bg-green-100 text-green-800 border-green-200/60",
  Inactive: "bg-gray-100  text-gray-500 border-gray-200/60",
};

const emptyForm: Transporter = {
  name:          "",
  contactPerson: "",
  contactNumber: "",
  email:         "",
  address:       "",
  gstNumber:     "",
  status:        "Active",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TransporterPage: React.FC = () => {
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [loading, setLoading]           = useState(false);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState<Transporter>(emptyForm);
  const [saving, setSaving]             = useState(false);

  const [search, setSearch]             = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | Active | Inactive
  const [showFilters, setShowFilters]   = useState(false);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<Transporter | null>(null);

  useEffect(() => { loadData(); }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Transporter[]>(API_URL);
      setTransporters(res.data);
    } catch (err) {
      console.error("Failed to load transporters:", err);
      ToasterService.error("Failed to load transporters");
    } finally {
      setLoading(false);
    }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleChange = (key: keyof Transporter, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleAddNew = () => { setForm(emptyForm); setShowForm(true); };

  const handleEdit = (transporter: Transporter) => {
    setForm({ ...transporter });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.contactPerson.trim() || !form.contactNumber.trim() || !form.email.trim()) {
      ToasterService.error("Please fill in all required fields");
      return;
    }

    setSaving(true);

    const payload = {
      name:          form.name,
      contactPerson: form.contactPerson,
      contactNumber: form.contactNumber,
      email:         form.email,
      address:       form.address,
      gstNumber:     form.gstNumber,
      status:        form.status,
    };

    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload);
        ToasterService.success("Transporter updated successfully!");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Transporter added successfully!");
      }
      await loadData();
      resetForm();
    } catch (err) {
      console.error("Error saving transporter:", err);
      ToasterService.error("Failed to save transporter");
    } finally {
      setSaving(false);
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
      ToasterService.success("Transporter deleted successfully!");
      setTransporters(prev => prev.filter(t => t.id !== deletingItem.id));
    } catch (err) {
      console.error("Error deleting transporter:", err);
      ToasterService.error("Failed to delete transporter");
    } finally {
      setShowDeletePopup(false);
      setDeletingItem(null);
    }
  };

  // ── Derived: search + filter ────────────────────────────────────────────────

  const filteredTransporters = useMemo(() => {
    return transporters.filter(t => {
      const term = search.toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(term) ||
        t.contactPerson.toLowerCase().includes(term) ||
        t.contactNumber.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        t.gstNumber.toLowerCase().includes(term);

      const matchesFilter = activeFilter === "ALL" || t.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
  }, [transporters, search, activeFilter]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:    transporters.length,
    active:   transporters.filter(t => t.status === "Active").length,
    inactive: transporters.filter(t => t.status === "Inactive").length,
  }), [transporters]);

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<Transporter>[] = [
    {
      key: "name",
      label: "Transporter Name",
      sortable: true,
      headerClassName: "w-[22%] text-left",
      className: "w-[22%]",
      render: (_, v) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <TruckIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "contactPerson",
      label: "Contact Person",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <UserIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "contactNumber",
      label: "Contact Number",
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <PhoneIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <EnvelopeIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "address",
      label: "Address",
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-500" title={String(v)}>
          <MapPinIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "gstNumber",
      label: "GST Number",
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (_, v) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <IdentificationIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[8%] text-left",
      className: "w-[8%]",
      render: (_, v) => {
        const s = v as Transporter["status"];
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[s]}`}>
            {s}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Action",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
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
      <PageMeta
        title="Transporter / Carrier Management"
        description="Manage transporters and carriers"
      />
      <PageBreadcrumb pageTitle="Transporter / Carrier Management" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton label="Add Transporter" onClick={handleAddNew} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, contact, email, or GST..."
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
                    { id: "ALL", name: "All Transporters" },
                    { id: "Active", name: "Active" },
                    { id: "Inactive", name: "Inactive" },
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
        <ReusableTable<Transporter>
          data={filteredTransporters}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="name"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <TruckIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No transporters found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  onClick={handleAddNew}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Add your first transporter →
                </button>
              )}
            </div>
          }
        />

        {/* Add / Edit Modal — portal, matches CRM segment modal style */}
        {showForm &&
          createPortal(
            <div
              key="transporter-modal"
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {form.id ? "Edit Transporter" : "Create New Transporter"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.id ? "Update this transporter's details" : "Add a new transporter or carrier"}
                    </p>
                  </div>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingInput
                      label="Transporter Name"
                      name="name"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                    />

                    <FloatingInput
                      label="Contact Person"
                      name="contactPerson"
                      value={form.contactPerson}
                      onChange={(e) => handleChange("contactPerson", e.target.value)}
                      required
                    />

                    <FloatingInput
                      label="Contact Number"
                      name="contactNumber"
                      type="tel"
                      value={form.contactNumber}
                      onChange={(e) => handleChange("contactNumber", e.target.value)}
                      required
                    />

                    <FloatingInput
                      label="Email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      required
                    />

                    <FloatingInput
                      label="GST Number"
                      name="gstNumber"
                      value={form.gstNumber}
                      onChange={(e) => handleChange("gstNumber", e.target.value)}
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

                    <div className="md:col-span-2">
                      <FloatingTextarea
                        label="Address"
                        name="address"
                        value={form.address}
                        onChange={(e) => handleChange("address", e.target.value)}
                        rows={3}
                        required
                      />
                    </div>
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
                      {saving ? "Saving..." : form.id ? "Update Transporter" : "Create Transporter"}
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
        innerText="Delete Transporter"
        subText={
          deletingItem
            ? `Are you sure you want to delete "${deletingItem.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this transporter?"
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

export default TransporterPage;
