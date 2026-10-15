import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/solid";
import {
  FunnelIcon,
  ClipboardListIcon,
  CalendarIcon,
  UserIcon,
  RefreshCwIcon,
  EyeIcon,
  ArrowRightLeftIcon,
  TruckIcon,
  MapPinIcon,
} from "lucide-react";
import {
  DELIVERY_API,
  DELIVERY_STATUSES,
  FAILURE_STATUSES,
  DeliveryOrder,
  DeliveryStatus,
  StatusBadge,
  apiError,
  formatDate,
  formatDateTime,
  nextStatuses,
  statusConfig,
  useDeliveryLookups,
} from "./deliveryShared";

// Tracking board: every update is recorded on the order (who, when, remarks) and moves it to that status.

const API = {
  orders: `${DELIVERY_API}/delivery-orders`,
  updateStatus: `${DELIVERY_API}/delivery-status`,
};

const PAGE_SIZE = 10;

const DeliveryStatusPage: React.FC = () => {
  const lookups = useDeliveryLookups(["customers"]);

  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL" | "ACTIVE">("ACTIVE");
  const [dateFilter, setDateFilter] = useState("");

  const [selected, setSelected] = useState<DeliveryOrder | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<DeliveryStatus | "">("");
  const [remarks, setRemarks] = useState("");
  const [failureReason, setFailureReason] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<DeliveryOrder[]>(API.orders);
      setOrders(data);
    } catch (err) {
      toast.error(apiError(err, "Failed to load deliveries"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // "Active" = still on its way: not delivered, returned or cancelled
  const isActive = (o: DeliveryOrder) => !["DELIVERED", "RETURNED", "CANCELLED"].includes(o.status);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        !term ||
        [o.deliveryOrderNumber, lookups.customerName(o.customerId, o.customerName), o.vehiclePlate, o.transporterName, o.tracking?.remarks]
          .some((value) => (value ?? "").toLowerCase().includes(term));
      const matchesStatus =
        statusFilter === "ALL" || (statusFilter === "ACTIVE" ? isActive(o) : o.status === statusFilter);
      const matchesDate = !dateFilter || (o.deliveryDate ?? "").startsWith(dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, search, statusFilter, dateFilter, lookups.customers]);

  const stats = useMemo(() => {
    const count = (...statuses: DeliveryStatus[]) => orders.filter((o) => statuses.includes(o.status)).length;
    const today = new Date().toISOString().slice(0, 10);
    return {
      active: orders.filter(isActive).length,
      dueToday: orders.filter((o) => isActive(o) && (o.deliveryDate ?? "").startsWith(today)).length,
      inTransit: count("IN_TRANSIT", "PARTIAL"),
      delivered: count("DELIVERED"),
      returned: count("RETURNED"),
      cancelled: count("CANCELLED"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const openTracking = (order: DeliveryOrder) => {
    setSelected(order);
    setShowTrackingModal(true);
  };

  const openStatus = (order: DeliveryOrder) => {
    setSelected(order);
    setNewStatus(nextStatuses(order.status)[0] ?? "");
    setRemarks("");
    setFailureReason("");
    setShowStatusModal(true);
  };

  const needsReason = FAILURE_STATUSES.includes(newStatus as DeliveryStatus);

  const handleUpdateStatus = async () => {
    if (!selected || !newStatus) return;
    if (needsReason && !failureReason.trim()) {
      toast.warning("Please give the reason");
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(API.updateStatus, {
        deliveryOrderId: selected.id,
        currentStatus: newStatus,
        remarks: remarks.trim() || undefined,
        failureReason: needsReason ? failureReason.trim() : undefined,
      });
      toast.success(`${selected.deliveryOrderNumber} is now ${statusConfig(newStatus).label}`);
      setShowStatusModal(false);
      setShowTrackingModal(false);
      await fetchOrders();
    } catch (err) {
      toast.error(apiError(err, "Failed to update the status"));
    } finally {
      setSubmitting(false);
    }
  };

  const tableColumns: ColumnDef<DeliveryOrder>[] = [
    {
      key: "deliveryOrderNumber",
      label: "Delivery Order",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <ClipboardListIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{row.deliveryOrderNumber}</span>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      sortValueGetter: (row) => lookups.customerName(row.customerId, row.customerName),
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      render: (row) => (
        <div className="flex items-center gap-1.5 min-w-0">
          <UserIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-700 truncate">{lookups.customerName(row.customerId, row.customerName)}</span>
        </div>
      ),
    },
    {
      key: "deliveryDate",
      label: "Due",
      sortable: true,
      headerClassName: "w-[11%] text-left",
      className: "w-[11%]",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-600">{formatDate(row.deliveryDate)}</span>
        </div>
      ),
    },
    {
      key: "vehiclePlate",
      label: "Vehicle",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (row) => <span className="text-sm text-slate-600 truncate">{row.vehiclePlate ?? "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "tracking",
      label: "Last Update",
      sortable: true,
      sortValueGetter: (row) => row.tracking?.statusUpdatedAt ?? "",
      headerClassName: "w-[22%] text-left",
      className: "w-[22%]",
      render: (row) =>
        row.tracking ? (
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-slate-700 truncate">{row.tracking.remarks || statusConfig(row.tracking.currentStatus).label}</span>
            <span className="text-xs text-slate-400 truncate">
              {formatDateTime(row.tracking.statusUpdatedAt)}
              {row.tracking.updatedBy ? ` · ${row.tracking.updatedBy}` : ""}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">No updates yet</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openTracking(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600" title="Tracking details">
            <EyeIcon className="h-4 w-4" />
          </button>
          {nextStatuses(row.status).length > 0 && (
            <button type="button" onClick={() => openStatus(row)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-purple-50 hover:text-purple-600" title="Post an update">
              <ArrowRightLeftIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Delivery Status" description="Track deliveries and post status updates" />
      <PageBreadcrumb pageTitle="Delivery Status" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          <StatsCard label="Active" value={stats.active} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Due Today" value={stats.dueToday} gradient="from-yellow-50 to-amber-50" borderColor="border-yellow-100" labelColor="text-yellow-600" />
          <StatsCard label="In Transit" value={stats.inTransit} gradient="from-purple-50 to-violet-50" borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label="Delivered" value={stats.delivered} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Returned" value={stats.returned} gradient="from-orange-50 to-amber-50" borderColor="border-orange-100" labelColor="text-orange-600" />
          <StatsCard label="Cancelled" value={stats.cancelled} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                placeholder="Search by order no, customer, vehicle or remarks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchOrders} className="p-2 border rounded-lg hover:bg-gray-50" title="Refresh">
              <RefreshCwIcon className={`h-5 w-5 text-gray-600 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => setShowFilters(!showFilters)} className="p-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-600">Filters</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="p-4 border rounded bg-gray-50 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | "ALL" | "ACTIVE")}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="ACTIVE">Active (on its way)</option>
                <option value="ALL">All Statuses</option>
                {DELIVERY_STATUSES.map((status) => (
                  <option key={status} value={status}>{statusConfig(status).label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex items-end">
              {(statusFilter !== "ACTIVE" || dateFilter) && (
                <button
                  onClick={() => {
                    setStatusFilter("ACTIVE");
                    setDateFilter("");
                  }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  ✕ Reset Filters
                </button>
              )}
            </div>
          </div>
        )}

        {!showFilters && statusFilter === "ACTIVE" && (
          <p className="-mt-3 text-xs text-slate-500">
            Showing deliveries still on their way. Use Filters to see delivered, returned or cancelled ones.
          </p>
        )}

        <ReusableTable<DeliveryOrder>
          data={filteredOrders}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="deliveryDate"
          defaultSortOrder="asc"
          onRowClick={openTracking}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center -mt-10">
              <TruckIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-1">No deliveries to show</p>
              <p className="text-gray-400 text-xs">Delivery orders created on the Delivery Order page appear here.</p>
            </div>
          }
        />

        {/* ================= TRACKING MODAL ================= */}
        {showTrackingModal && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white p-6 rounded-xl w-full max-w-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardListIcon className="h-6 w-6 text-cyan-600" />
                    {selected.deliveryOrderNumber}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{lookups.customerName(selected.customerId, selected.customerName)}</p>
                </div>
                <button onClick={() => setShowTrackingModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={selected.status} /></div>
                <div className="flex justify-between"><span className="text-slate-500">Due</span><span className="text-slate-700">{formatDateTime(selected.deliveryDate)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-500">Vehicle</span><span className="text-slate-700 text-right">{selected.vehiclePlate ?? "Not assigned"}{selected.transporterName ? ` · ${selected.transporterName}` : ""}</span></div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 flex items-center gap-1"><MapPinIcon className="h-3.5 w-3.5" />Address</span>
                  <span className="text-slate-700 text-right">{selected.deliveryAddress ?? "Not set"}</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Latest update</p>
                {selected.tracking ? (
                  <>
                    <p className="text-slate-700">
                      {statusConfig(selected.tracking.currentStatus).label}
                      {selected.tracking.remarks ? ` — ${selected.tracking.remarks}` : ""}
                    </p>
                    {selected.tracking.failureReason && <p className="text-red-600 text-xs mt-1">Reason: {selected.tracking.failureReason}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDateTime(selected.tracking.statusUpdatedAt)}
                      {selected.tracking.updatedBy ? ` by ${selected.tracking.updatedBy}` : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-slate-500">No updates yet. The order is {statusConfig(selected.status).label.toLowerCase()}.</p>
                )}
              </div>

              {nextStatuses(selected.status).length > 0 && (
                <div className="mt-4 border-t pt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setShowTrackingModal(false);
                      openStatus(selected);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                  >
                    <ArrowRightLeftIcon className="h-4 w-4 inline mr-1" />
                    Post an Update
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STATUS UPDATE MODAL ================= */}
        {showStatusModal && selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl w-full max-w-md">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ArrowRightLeftIcon className="h-6 w-6 text-purple-600" />
                Post an Update
              </h2>
              <div className="mb-4 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{selected.deliveryOrderNumber}</span>
                <StatusBadge status={selected.status} />
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1">New Status *</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as DeliveryStatus)}
                className="w-full p-2 mb-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {nextStatuses(selected.status).map((status) => (
                  <option key={status} value={status}>{statusConfig(status).label}</option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="e.g. Left the warehouse at 9:40, signed by store manager"
                className="w-full p-2 mb-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />

              {needsReason && (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <input
                    value={failureReason}
                    onChange={(e) => setFailureReason(e.target.value)}
                    placeholder="e.g. Customer not available, damaged in transit"
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  />
                </>
              )}

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowStatusModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium" disabled={submitting}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  disabled={submitting || !newStatus}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Saving..." : "Save Update"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DeliveryStatusPage;
