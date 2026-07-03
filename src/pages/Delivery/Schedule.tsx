import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  TruckIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeObject {
  hour: number;
  minute: number;
  second: number;
  nano: number;
}

// What the API actually returns for a schedule record
interface ScheduleApi {
  id: number;
  routeId: number;
  vehicleId: number;
  scheduledDate: string;
  startTime: TimeObject;
  endTime: TimeObject;
}

// UI-friendly form shape — times as "HH:mm" strings, ids as strings for <select>/FloatingSelect
interface ScheduleForm {
  id?: number;
  routeId: string;
  vehicleId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
}

interface RouteOption { id: number; name: string; }
interface VehicleOption { id: number; licensePlate: string; }

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL       = "/v1/api/delivery/schedules";
const ROUTES_URL    = "/v1/api/delivery/routes";
const VEHICLES_URL  = "/v1/api/dispatch/vehicles";

const emptyForm: ScheduleForm = {
  routeId:       "",
  vehicleId:     "",
  scheduledDate: "",
  startTime:     "",
  endTime:       "",
};

const toTimeObject = (t: string): TimeObject => {
  const [hour, minute] = t.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0, second: 0, nano: 0 };
};

const toTimeString = (t?: TimeObject): string => {
  if (!t) return "";
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
};

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

const SchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleApi[]>([]);
  const [routeOptions, setRouteOptions]     = useState<RouteOption[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);

  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<ScheduleForm>(emptyForm);
  const [saving, setSaving]     = useState(false);

  const [search, setSearch]           = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | TODAY | UPCOMING | PAST
  const [showFilters, setShowFilters] = useState(false);

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingItem, setDeletingItem]       = useState<ScheduleApi | null>(null);

  const token = localStorage.getItem("accessToken");
  const tenantId = getTenantId();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    loadSchedules();
    loadRoutes();
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await axios.get<ScheduleApi[]>(API_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setSchedules(res.data);
    } catch (err) {
      console.error("Failed to load schedules:", err);
      ToasterService.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async () => {
    try {
      const res = await axios.get<RouteOption[]>(ROUTES_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setRouteOptions(res.data);
    } catch (err) {
      console.error("Failed to load routes:", err);
    }
  };

  const loadVehicles = async () => {
    try {
      const res = await axios.get<VehicleOption[]>(VEHICLES_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setVehicleOptions(res.data);
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    }
  };

  // ── Lookups for table rendering ─────────────────────────────────────────────

  const routeName    = (id: number) => routeOptions.find(r => r.id === id)?.name ?? `#${id}`;
  const vehiclePlate = (id: number) => vehicleOptions.find(v => v.id === id)?.licensePlate ?? `#${id}`;

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const handleChange = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const handleAddNew = () => { setForm(emptyForm); setShowForm(true); };

  const handleEdit = (s: ScheduleApi) => {
    setForm({
      id:            s.id,
      routeId:       String(s.routeId),
      vehicleId:     String(s.vehicleId),
      scheduledDate: s.scheduledDate,
      startTime:     toTimeString(s.startTime),
      endTime:       toTimeString(s.endTime),
    });
    setShowForm(true);
  };

  // ── Submit / Delete ─────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.routeId || !form.vehicleId || !form.scheduledDate || !form.startTime || !form.endTime) {
      ToasterService.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    const payload = {
      routeId:       Number(form.routeId),
      vehicleId:     Number(form.vehicleId),
      scheduledDate: form.scheduledDate,
      startTime:     toTimeObject(form.startTime),
      endTime:       toTimeObject(form.endTime),
    };

    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload, { headers: authHeaders });
        ToasterService.success("Schedule updated successfully!");
      } else {
        await axios.post(API_URL, payload, { headers: authHeaders });
        ToasterService.success("Schedule added successfully!");
      }
      await loadSchedules();
      resetForm();
    } catch (err) {
      console.error("Error saving schedule:", err);
      ToasterService.error("Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (s: ScheduleApi) => {
    setDeletingItem(s);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await axios.delete(`${API_URL}/${deletingItem.id}`, { headers: authHeaders });
      ToasterService.success("Schedule deleted successfully!");
      setSchedules(prev => prev.filter(s => s.id !== deletingItem.id));
    } catch (err) {
      console.error("Error deleting schedule:", err);
      ToasterService.error("Failed to delete schedule");
    } finally {
      setShowDeletePopup(false);
      setDeletingItem(null);
    }
  };

  // ── Derived data: filter + search ───────────────────────────────────────────

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const term = search.toLowerCase();
      const matchesSearch =
        routeName(s.routeId).toLowerCase().includes(term) ||
        vehiclePlate(s.vehicleId).toLowerCase().includes(term) ||
        s.scheduledDate.includes(term);

      let matchesFilter = true;
      if (activeFilter === "TODAY") matchesFilter = s.scheduledDate === todayStr;
      else if (activeFilter === "UPCOMING") matchesFilter = s.scheduledDate > todayStr;
      else if (activeFilter === "PAST") matchesFilter = s.scheduledDate < todayStr;

      return matchesSearch && matchesFilter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, search, activeFilter, routeOptions, vehicleOptions]);

  const stats = useMemo(() => ({
    total:    schedules.length,
    today:    schedules.filter(s => s.scheduledDate === todayStr).length,
    upcoming: schedules.filter(s => s.scheduledDate > todayStr).length,
    past:     schedules.filter(s => s.scheduledDate < todayStr).length,
  }), [schedules, todayStr]);

  // ── Columns ─────────────────────────────────────────────────────────────────

  const columns: ColumnDef<ScheduleApi>[] = [
    {
      key: "scheduledDate",
      label: "Date",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CalendarDaysIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <span className="text-sm font-semibold text-slate-900">{s.scheduledDate}</span>
        </div>
      ),
    },
    {
      key: "routeId",
      label: "Route",
      sortable: true,
      sortValueGetter: (s) => routeName(s.routeId),
      headerClassName: "w-[24%] text-left",
      className: "w-[24%]",
      render: (s) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPinIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium text-slate-600">{routeName(s.routeId)}</span>
        </div>
      ),
    },
    {
      key: "vehicleId",
      label: "Vehicle",
      sortable: true,
      sortValueGetter: (s) => vehiclePlate(s.vehicleId),
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (s) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <TruckIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="truncate font-medium text-slate-600">{vehiclePlate(s.vehicleId)}</span>
        </div>
      ),
    },
    {
      key: "startTime",
      label: "Time",
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (s) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <ClockIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {toTimeString(s.startTime)} – {toTimeString(s.endTime)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[20%] text-right pr-4",
      className: "w-[20%] text-right",
      render: (s) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleEdit(s)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Schedule"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => promptDelete(s)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Schedule"
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
      <PageMeta title="Schedule Management" description="Manage delivery schedules" />
      <PageBreadcrumb pageTitle="Schedules" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={handleAddNew} label="Add Schedule" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Schedules"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Today"
            value={stats.today}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Upcoming"
            value={stats.upcoming}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Past"
            value={stats.past}
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
                placeholder="Search by route, vehicle, or date..."
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
                  label="Filter by Date"
                  name="filter"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  includeEmptyOption={false}
                  className="!mb-0"
                  options={[
                    { id: "ALL", name: "All Schedules" },
                    { id: "TODAY", name: "Today" },
                    { id: "UPCOMING", name: "Upcoming" },
                    { id: "PAST", name: "Past" },
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
        <ReusableTable<ScheduleApi>
          data={filteredSchedules}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="scheduledDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CalendarDaysIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No schedules found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first schedule
                </button>
              )}
            </div>
          }
        />

        {/* Add / Edit Modal — portal, matches CRM segment modal style */}
        {showForm &&
          createPortal(
            <div
              key="schedule-modal"
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {form.id ? "Edit Schedule" : "Create New Schedule"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.id ? "Update this schedule's details" : "Assign a route and vehicle to a time slot"}
                    </p>
                  </div>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-4 pt-2">
                    <FloatingSelect
                      label="Route"
                      name="routeId"
                      value={form.routeId}
                      onChange={(e) => handleChange("routeId", e.target.value)}
                      includeEmptyOption
                      required
                      options={routeOptions.map(r => ({ id: String(r.id), name: r.name }))}
                    />

                    <FloatingSelect
                      label="Vehicle"
                      name="vehicleId"
                      value={form.vehicleId}
                      onChange={(e) => handleChange("vehicleId", e.target.value)}
                      includeEmptyOption
                      required
                      options={vehicleOptions.map(v => ({ id: String(v.id), name: v.licensePlate }))}
                    />

                    <FloatingInput
                      label="Scheduled Date"
                      name="scheduledDate"
                      type="date"
                      value={form.scheduledDate}
                      onChange={(e) => handleChange("scheduledDate", e.target.value)}
                      required
                    />

                    <div className="grid grid-cols-2 gap-4">
  <div className="flex flex-col">
    <label className="mb-1 text-xs font-medium text-gray-600">Start Time</label>
    <input
      type="time"
      name="startTime"
      value={form.startTime}
      onChange={(e) => handleChange("startTime", e.target.value)}
      required
      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none"
    />
  </div>
  <div className="flex flex-col">
    <label className="mb-1 text-xs font-medium text-gray-600">End Time</label>
    <input
      type="time"
      name="endTime"
      value={form.endTime}
      onChange={(e) => handleChange("endTime", e.target.value)}
      required
      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none"
    />
  </div>
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
                      {saving ? "Saving..." : form.id ? "Update Schedule" : "Create Schedule"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>

      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Schedule"
        subText={
          deletingItem
            ? `Are you sure you want to delete the schedule on ${deletingItem.scheduledDate}? This action cannot be undone.`
            : "Are you sure you want to delete this schedule?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingItem(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
};

export default SchedulePage;
