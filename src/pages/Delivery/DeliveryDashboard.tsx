import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Car,
  MapPin,
  CheckCircle,
  Receipt,
  TrendingUp,
  CalendarClock,
  Users,
  PackageCheck,
  ClipboardList,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  CHART_COLORS, CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  countOf, formatDate, formatNumber, getList, isoDate, parseDate, titleCase, useDashboardSources, weekStart, weeksBack,
} from "../Dashboard/dashboardKit";

import { t } from "../../i18n/i18n";
// Live delivery overview built from the delivery service.

interface DeliveryOrder {
  id: number;
  deliveryOrderNumber?: string;
  deliveryDate?: string;
  customerName?: string;
  status?: string; // PENDING, CONFIRMED, IN_TRANSIT, PARTIAL, DELIVERED, RETURNED, CANCELLED
}

interface Vehicle {
  id: number;
  licensePlate?: string;
  active?: boolean;
}

interface DeliveryRoute {
  id: number;
  name?: string;
  distanceKm?: number;
  active?: boolean;
}

interface Schedule {
  id: number;
  routeName?: string;
  vehiclePlate?: string;
  scheduledDate?: string;
  status?: string;
}

const DELIVERY = "/v1/api/delivery";
const SOURCES = {
  orders: () => getList<DeliveryOrder>(`${DELIVERY}/delivery-orders`),
  vehicles: () => getList<Vehicle>(`${DELIVERY}/vehicles`),
  routes: () => getList<DeliveryRoute>(`${DELIVERY}/routes`),
  schedules: () => getList<Schedule>(`${DELIVERY}/schedules`),
  transporters: () => countOf(`${DELIVERY}/transporters`),
  addresses: () => countOf(`${DELIVERY}/customer-addresses`),
  notes: () => countOf(`${DELIVERY}/delivery-notes`),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  orders: "delivery orders",
  vehicles: "vehicles",
  routes: "routes",
  schedules: "schedules",
  transporters: "transporters",
  addresses: "customer addresses",
  notes: "delivery notes",
};

const CLOSED = ["DELIVERED", "RETURNED", "CANCELLED"];
const statusOf = (order: DeliveryOrder) => String(order.status || "PENDING").toUpperCase();

const STATUS_STYLE: Record<string, string> = {
  DELIVERED: "bg-green-100 text-green-700",
  IN_TRANSIT: "bg-purple-100 text-purple-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  RETURNED: "bg-orange-100 text-orange-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const DeliveryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { loading, data, failed } = useDashboardSources(SOURCES, LABELS);

  const orders = (data.orders as DeliveryOrder[] | undefined) ?? [];
  const vehicles = data.vehicles as Vehicle[] | undefined;
  const routes = data.routes as DeliveryRoute[] | undefined;
  const schedules = (data.schedules as Schedule[] | undefined) ?? [];
  const today = isoDate(new Date());

  const pending = orders.filter((o) => !CLOSED.includes(statusOf(o)));
  const thisMonth = orders.filter((o) => String(o.deliveryDate ?? "").slice(0, 7) === today.slice(0, 7));

  const trend = useMemo(() => weeksBack(8).map(({ key, label }) => {
    const inWeek = orders.filter((o) => {
      const d = parseDate(o.deliveryDate);
      return d ? isoDate(weekStart(d)) === key : false;
    });
    return { week: label, deliveries: inWeek.length, delivered: inWeek.filter((o) => statusOf(o) === "DELIVERED").length };
  }), [orders]);

  const vehicleTrips = useMemo(() => {
    const byVehicle = new Map<string, number>();
    schedules.forEach((s) => {
      if (s.vehiclePlate) byVehicle.set(s.vehiclePlate, (byVehicle.get(s.vehiclePlate) ?? 0) + 1);
    });
    return [...byVehicle.entries()].map(([name, trips]) => ({ name, trips })).sort((a, b) => b.trips - a.trips).slice(0, 6);
  }, [schedules]);

  const topRoutes = useMemo(() => {
    const byRoute = new Map<string, { route: string; trips: number; upcoming: number }>();
    schedules.forEach((s) => {
      if (!s.routeName) return;
      const entry = byRoute.get(s.routeName) ?? { route: s.routeName, trips: 0, upcoming: 0 };
      entry.trips += 1;
      if (String(s.scheduledDate ?? "") >= today) entry.upcoming += 1;
      byRoute.set(s.routeName, entry);
    });
    return [...byRoute.values()].sort((a, b) => b.trips - a.trips).slice(0, 5).map((r) => ({
      ...r,
      distance: routes?.find((x) => x.name === r.route)?.distanceKm,
    }));
  }, [schedules, routes, today]);

  const recent = [...orders]
    .sort((a, b) => String(b.deliveryDate ?? "").localeCompare(String(a.deliveryDate ?? "")))
    .slice(0, 5);

  const count = (key: "transporters" | "addresses" | "notes") => (typeof data[key] === "number" ? (data[key] as number) : null);
  const tiles = [
    { name: "Delivery Order", count: data.orders ? orders.length : null, icon: Truck, route: "/deliveryOrder", tone: "blue" as const },
    { name: "Delivery Status", count: data.orders ? pending.length : null, icon: CheckCircle, route: "/deliveryStatus", tone: "teal" as const },
    { name: "Transporter", count: count("transporters"), icon: Users, route: "/transporter", tone: "emerald" as const },
    { name: "Vehicle", count: vehicles ? vehicles.length : null, icon: Car, route: "/vehicle", tone: "orange" as const },
    { name: "Route", count: routes ? routes.length : null, icon: MapPin, route: "/route", tone: "purple" as const },
    { name: "Schedule", count: data.schedules ? schedules.length : null, icon: CalendarClock, route: "/schedule", tone: "indigo" as const },
    { name: "Customer Address", count: count("addresses"), icon: MapPin, route: "/customerAddress", tone: "pink" as const },
    { name: "Delivery Note", count: count("notes"), icon: Receipt, route: "/delivery-note", tone: "red" as const },
  ];

  return (
    <>
      <PageMeta title={t("Delivery Dashboard")} description="Delivery and distribution overview" />
      <PageBreadcrumb pageTitle="Delivery Dashboard" />

      <div className="mx-auto max-w-7xl px-1 pb-6 pt-1">
        <LoadNotice failed={failed} />
        <ModuleTiles tiles={tiles} loading={loading} />

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label={t("Total Deliveries")} value={formatNumber(orders.length)} hint={t("{count} this month", { count: formatNumber(thisMonth.length) })} icon={Truck} tone="blue" loading={loading} />
          <KpiCard label={t("Vehicles Active")} value={vehicles ? formatNumber(vehicles.filter((v) => v.active !== false).length) : "—"} hint={vehicles ? t("{count} vehicles", { count: formatNumber(vehicles.length) }) : undefined} icon={Car} tone="emerald" loading={loading} />
          <KpiCard label={t("Active Routes")} value={routes ? formatNumber(routes.filter((r) => r.active !== false).length) : "—"} hint={routes ? t("{count} routes", { count: formatNumber(routes.length) }) : undefined} icon={MapPin} tone="orange" loading={loading} />
          <KpiCard label={t("Pending Deliveries")} value={formatNumber(pending.length)} hint={t("Not yet delivered, cancelled or failed")} icon={ClipboardList} tone="purple" loading={loading} />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={t("Delivery Trend")} subtitle={t("Deliveries per week (last 8 weeks)")} icon={TrendingUp} iconClass="text-emerald-500">
            {orders.length === 0 ? (
              <EmptyState loading={loading}>{t("No delivery orders yet.")}</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="deliveries" name={t("Deliveries")} stroke="#06b6d4" strokeWidth={2} fill="url(#deliveryGradient)" />
                  <Area type="monotone" dataKey="delivered" name={t("Delivered")} stroke="#10b981" strokeWidth={2} fill="none" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title={t("Vehicle Utilization")} subtitle={t("Scheduled trips per vehicle (top 6)")} icon={Car} iconClass="text-orange-500">
            {vehicleTrips.length === 0 ? (
              <EmptyState loading={loading}>{t("No vehicle schedules yet.")}</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={vehicleTrips} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={90} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value, "Trips"]} />
                  <Bar dataKey="trips" radius={[0, 4, 4, 0]}>
                    {vehicleTrips.map((v, index) => <Cell key={v.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title={t("Top Routes")} subtitle={t("By scheduled trips")} bodyClass="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className={TABLE_HEAD}>{t("Route")}</th>
                  <th className={TABLE_HEAD}>{t("Trips")}</th>
                  <th className={TABLE_HEAD}>{t("Upcoming")}</th>
                  <th className={TABLE_HEAD}>{t("Distance")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {topRoutes.length === 0 && (
                  <tr><td colSpan={4} className={`${TABLE_CELL} text-center`}>{t(loading ? "Loading…" : "No route schedules yet.")}</td></tr>
                )}
                {topRoutes.map((r) => (
                  <tr key={r.route} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{r.route}</td>
                    <td className={TABLE_CELL}>{r.trips}</td>
                    <td className={TABLE_CELL}>{r.upcoming}</td>
                    <td className={TABLE_CELL}>{r.distance ? `${formatNumber(r.distance)} km` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title={t("Recent Deliveries")} subtitle={t("Latest delivery orders")} icon={PackageCheck} iconClass="text-cyan-500" bodyClass="divide-y divide-gray-100 dark:divide-gray-800">
            {recent.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-gray-500">{t(loading ? "Loading…" : "No delivery orders yet.")}</p>
            )}
            {recent.map((o) => {
              const status = statusOf(o);
              return (
                <button key={o.id} type="button" onClick={() => navigate("/deliveryOrder")}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {o.deliveryOrderNumber || `DO #${o.id}`} <span className="font-normal text-gray-500">· {o.customerName || "—"}</span>
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(o.deliveryDate)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700"}`}>
                    {titleCase(status)}
                  </span>
                </button>
              );
            })}
          </Panel>
        </div>
      </div>
    </>
  );
};

export default DeliveryDashboard;
