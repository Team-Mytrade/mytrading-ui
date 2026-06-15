import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck,
  Car,
  MapPin,
  Package,
  CheckCircle,
  Receipt,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

// Mock Data
const deliveryTrendData = [
  { week: "Week 1", deliveries: 10, onTime: 8 },
  { week: "Week 2", deliveries: 12, onTime: 10 },
  { week: "Week 3", deliveries: 8, onTime: 7 },
  { week: "Week 4", deliveries: 15, onTime: 13 },
  { week: "Week 5", deliveries: 18, onTime: 16 },
];

const vehicleUtilizationData = [
  { name: "Truck A", trips: 12, utilization: 85, color: "#06b6d4" },
  { name: "Truck B", trips: 8, utilization: 65, color: "#10b981" },
  { name: "Van 1", trips: 5, utilization: 45, color: "#f59e0b" },
  { name: "Van 2", trips: 10, utilization: 75, color: "#8b5cf6" },
];

const topRoutes = [
  { id: 1, route: "Route A", deliveries: 10, pending: 2, onTime: 8, distance: "45 km" },
  { id: 2, route: "Route B", deliveries: 8, pending: 1, onTime: 7, distance: "32 km" },
  { id: 3, route: "Route C", deliveries: 5, pending: 3, onTime: 2, distance: "28 km" },
  { id: 4, route: "Route D", deliveries: 12, pending: 0, onTime: 12, distance: "56 km" },
];

const recentDeliveries = [
  { id: 1, orderNo: "DO-001", customer: "ABC Corp", status: "Delivered", driver: "John Doe", time: "2 hours ago" },
  { id: 2, orderNo: "DO-002", customer: "XYZ Ltd", status: "In Transit", driver: "Mike Smith", time: "3 hours ago" },
  { id: 3, orderNo: "DO-003", customer: "LMN Inc", status: "Pending", driver: "Sarah Lee", time: "5 hours ago" },
  { id: 4, orderNo: "DO-004", customer: "PQR Solutions", status: "Delivered", driver: "Tom Brown", time: "1 day ago" },
];

// Navigation Modules
const deliveryModules = [
  { name: "Delivery Order", count: 38, icon: Truck, route: "/delivery-order", color: "blue" },
  { name: "Transporter", count: 12, icon: Car, route: "/transporter", color: "emerald" },
  { name: "Vehicle", count: 20, icon: Car, route: "/vechile", color: "orange" },
  { name: "Route", count: 15, icon: MapPin, route: "/route", color: "purple" },
  { name: "Products", count: 320, icon: Package, route: "/productDelivery", color: "indigo" },
  { name: "Customer Address", count: 150, icon: MapPin, route: "/deliveryAddress", color: "pink" },
  { name: "Delivery Status", count: 28, icon: CheckCircle, route: "/deliveryStatus", color: "teal" },
  { name: "Receipt / POD", count: 30, icon: Receipt, route: "", color: "red" },
];

const kpiItems = [
  { label: "Total Deliveries", value: "38", change: "+8", trend: "up" as const, icon: Truck, color: "blue" },
  { label: "Vehicles Active", value: "20", change: "+2", trend: "up" as const, icon: Car, color: "emerald" },
  { label: "Active Routes", value: "15", change: "+3", trend: "up" as const, icon: MapPin, color: "orange" },
  { label: "Pending Deliveries", value: "8", change: "-2", trend: "down" as const, icon: CheckCircle, color: "purple" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "indigo" | "pink" | "teal" | "red" | "yellow" | "green";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  red: "bg-red-50 text-red-600 group-hover:bg-red-100",
  yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100",
  green: "bg-green-50 text-green-600 group-hover:bg-green-100",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
  red: "bg-red-100 text-red-600",
  yellow: "bg-yellow-100 text-yellow-600",
  green: "bg-green-100 text-green-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const DeliveryDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Delivery Dashboard" description="Delivery and distribution overview" />
      <PageBreadcrumb pageTitle="Delivery Dashboard" />

      <div className="max-w-7xl mx-auto p-6">

        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {deliveryModules.map((module) => {
            const Icon = module.icon;
            const colorClass = colorClasses[module.color as ColorKey];
            return (
              <button
                key={module.name}
                onClick={() => module.route && navigate(module.route)}
                className="group flex flex-col items-center p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className={`p-2.5 rounded-lg ${colorClass} transition-colors duration-200`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-2 text-xs font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors text-center">
                  {module.name}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">{module.count}</p>
              </button>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {kpiItems.map((kpi, idx) => {
            const Icon = kpi.icon;
            const TrendIcon = kpi.trend === "up" ? ArrowUpRight : ArrowDownRight;
            const kpiColorClass = kpiColorClasses[kpi.color as ColorKey];
            const trendColor = trendColors[kpi.trend];
            return (
              <div
                key={idx}
                className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${kpiColorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" />
                    {kpi.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Delivery Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Delivery Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Weekly delivery performance</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={deliveryTrendData}>
                <defs>
                  <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="deliveries" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#deliveryGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Vehicle Utilization Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Vehicle Utilization</h3>
                <p className="text-xs text-gray-500 mt-0.5">Trips per vehicle</p>
              </div>
              <Car className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vehicleUtilizationData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={70} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
                <Bar dataKey="trips" radius={[0, 4, 4, 0]}>
                  {vehicleUtilizationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Routes & Recent Deliveries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Routes Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Top Routes</h3>
              <p className="text-xs text-gray-500 mt-0.5">Route performance metrics</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deliveries</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">On Time</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{route.route}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{route.distance}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{route.deliveries}</td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-emerald-600 font-medium">{route.onTime}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-sm font-medium ${route.pending > 0 ? "text-red-600" : "text-gray-600"}`}>
                          {route.pending}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Deliveries */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Recent Deliveries</h3>
              <p className="text-xs text-gray-500 mt-0.5">Latest shipment status</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order No</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentDeliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-mono font-medium text-gray-900">{delivery.orderNo}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{delivery.customer}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{delivery.driver}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          delivery.status === "Delivered" ? "bg-green-100 text-green-700" :
                          delivery.status === "In Transit" ? "bg-blue-100 text-blue-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {delivery.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">{delivery.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Delivery Pipeline Summary */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Delivery Pipeline</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current delivery stages</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-600 mb-2">Pending</h4>
                <p className="text-2xl font-bold text-gray-900">8</p>
                <p className="text-xs text-gray-500 mt-1">Awaiting dispatch</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-emerald-600 mb-2">In Transit</h4>
                <p className="text-2xl font-bold text-gray-900">12</p>
                <p className="text-xs text-gray-500 mt-1">On the way</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-600 mb-2">Delivered</h4>
                <p className="text-2xl font-bold text-gray-900">18</p>
                <p className="text-xs text-gray-500 mt-1">Completed today</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-600 mb-2">Delayed</h4>
                <p className="text-2xl font-bold text-gray-900">3</p>
                <p className="text-xs text-gray-500 mt-1">Past due date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeliveryDashboard;