import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  MapPinIcon,
  TruckIcon,
  CalendarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface RouteSchedule {
  id: number; routeCode: string; routeName: string; startPoint: string;
  endPoint: string; scheduledDate: string; vehicleNumber: string; status: string;
}

const API_URL = "http://localhost:5000/routes";

// ── Status config — OUTSIDE component ─────────────────────────────────────────
const getStatusStyle = (status: string) => {
  switch (status) {
    case "Completed":  return { cls: "bg-green-100 text-green-800",  Icon: CheckCircleIcon };
    case "Cancelled":  return { cls: "bg-red-100 text-red-800",    Icon: XCircleIcon };
    default:           return { cls: "bg-blue-100 text-blue-800",   Icon: ClockIcon };
  }
};

// ─────────────────────────────────────────────────────────────────────────────

const RouteSchedulePage: React.FC = () => {
  const [routes, setRoutes]     = useState<RouteSchedule[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form fields
  const [routeCode, setRouteCode]       = useState("");
  const [routeName, setRouteName]       = useState("");
  const [startPoint, setStartPoint]     = useState("");
  const [endPoint, setEndPoint]         = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [status, setStatus]             = useState("Scheduled");

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingRoute, setDeletingRoute]     = useState<RouteSchedule | null>(null);

  useEffect(() => { fetchRoutes(); }, []);

  const fetchRoutes = async () => {
    setLoading(true);
    try { const res = await axios.get<RouteSchedule[]>(API_URL); setRoutes(res.data); }
    catch { console.error("Error loading routes."); }
    finally { setLoading(false); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const clearForm = () => { setRouteCode(""); setRouteName(""); setStartPoint(""); setEndPoint(""); setScheduledDate(""); setVehicleNumber(""); setStatus("Scheduled"); setEditingId(null); setShowForm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { routeCode, routeName, startPoint, endPoint, scheduledDate, vehicleNumber, status };
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, payload);
      else           await axios.post(API_URL, payload);
      fetchRoutes(); clearForm();
    } catch { console.error("Save failed"); }
  };

  const handleEdit = (r: RouteSchedule) => {
    setEditingId(r.id); setRouteCode(r.routeCode); setRouteName(r.routeName);
    setStartPoint(r.startPoint); setEndPoint(r.endPoint); setScheduledDate(r.scheduledDate);
    setVehicleNumber(r.vehicleNumber); setStatus(r.status); setShowForm(true);
  };

  const promptDelete = (r: RouteSchedule) => { setDeletingRoute(r); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingRoute) return;
    try { await axios.delete(`${API_URL}/${deletingRoute.id}`); fetchRoutes(); }
    catch { console.error("Delete failed"); }
    setDeletingRoute(null);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:     routes.length,
    scheduled: routes.filter(r => r.status === "Scheduled").length,
    completed: routes.filter(r => r.status === "Completed").length,
    cancelled: routes.filter(r => r.status === "Cancelled").length,
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<RouteSchedule>[] = [
    {
      key: "routeName", label: "Route Name", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "routeCode", label: "Code", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v)}</span>,
    },
    {
      key: "startPoint", label: "Start", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v)}</span>,
    },
    {
      key: "endPoint", label: "End", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v)}</span>,
    },
    {
      key: "scheduledDate", label: "Date", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "vehicleNumber", label: "Vehicle", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <TruckIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (_, v) => {
        const { cls, Icon } = getStatusStyle(String(v));
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            <Icon className="h-3 w-3 mr-1" />{String(v)}
          </span>
        );
      },
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleEdit(row)} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(row)} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Route / Schedule Management" description="Manage routes and schedules" />
      <PageBreadcrumb pageTitle="Route / Schedule Management" />

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Route / Schedule Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage delivery routes and schedules</p>
          </div> */}
          <AddButton label="Add Route" onClick={() => { clearForm(); setShowForm(true); }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Routes" value={stats.total}     gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Scheduled"    value={stats.scheduled} gradient="from-blue-50 to-indigo-50"   borderColor="border-blue-100"   labelColor="text-blue-600" />
          <StatsCard label="Completed"    value={stats.completed} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Cancelled"    value={stats.cancelled} gradient="from-red-50 to-pink-50"      borderColor="border-red-100"    labelColor="text-red-600" />
        </div>

        {/* Inline form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? "Edit Route" : "Add New Route"}
              </h3>
              <button onClick={clearForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {[
                  { label: "Route Code",    val: routeCode,      set: setRouteCode,      ph: "e.g. RT001",       req: false },
                  { label: "Route Name",    val: routeName,      set: setRouteName,      ph: "Enter route name", req: true },
                  { label: "Start Point",   val: startPoint,     set: setStartPoint,     ph: "Origin",           req: true },
                  { label: "End Point",     val: endPoint,       set: setEndPoint,       ph: "Destination",      req: true },
                  { label: "Vehicle No.",   val: vehicleNumber,  set: setVehicleNumber,  ph: "e.g. MH-01-AB-1234", req: true },
                ].map(f => (
                  <div key={f.label}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} {f.req && <span className="text-red-500">*</span>}</label>
                    <input type="text" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required={f.req}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                  </div>
                ))}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date <span className="text-red-500">*</span></label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent">
                    <option>Scheduled</option>
                    <option>Completed</option>
                    <option>Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button type="submit"
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                  {editingId ? "Update Route" : "Add Route"}
                </button>
                <button type="button" onClick={clearForm}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        <ReusableTable<RouteSchedule>
          data={routes}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by route name or destination..."
          searchFields={["routeName", "endPoint", "startPoint", "routeCode", "vehicleNumber"]}
          pageSize={5}
          defaultSortKey="routeName"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <MapPinIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No routes found</p>
              <button onClick={() => { clearForm(); setShowForm(true); }} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first route →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Route"
        subText={`Are you sure you want to delete "${deletingRoute?.routeName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default RouteSchedulePage;
