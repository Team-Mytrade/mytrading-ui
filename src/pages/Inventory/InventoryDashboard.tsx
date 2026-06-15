import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  MapPin,
  Layers,
  Factory,
  History,
  TrendingUp,
  AlertTriangle,
  Edit,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

// Mock Data
const stockTrendData = [
  { month: "Jan", stock: 3000, value: 45000 },
  { month: "Feb", stock: 3500, value: 52000 },
  { month: "Mar", stock: 4000, value: 60000 },
  { month: "Apr", stock: 3800, value: 57000 },
  { month: "May", stock: 4500, value: 68000 },
  { month: "Jun", stock: 4800, value: 72000 },
];

const batchPerformanceData = [
  { name: "Batch A", qty: 120, value: 18000, color: "#06b6d4" },
  { name: "Batch B", qty: 80, value: 12000, color: "#10b981" },
  { name: "Batch C", qty: 60, value: 9000, color: "#f59e0b" },
  { name: "Batch D", qty: 40, value: 6000, color: "#8b5cf6" },
];

const topWarehouses = [
  { id: 1, name: "Main Warehouse", stock: 3200, value: "$480,000", utilization: "85%", trend: "+5%" },
  { id: 2, name: "Secondary Warehouse", stock: 1800, value: "$270,000", utilization: "72%", trend: "+3%" },
  { id: 3, name: "Regional Warehouse", stock: 900, value: "$135,000", utilization: "60%", trend: "-2%" },
  { id: 4, name: "Distribution Center", stock: 2100, value: "$315,000", utilization: "78%", trend: "+8%" },
];

const lowStockItems = [
  { id: 1, name: "Product A", sku: "SKU-001", stock: 5, reorderLevel: 20, status: "Critical" },
  { id: 2, name: "Product B", sku: "SKU-002", stock: 12, reorderLevel: 25, status: "Low" },
  { id: 3, name: "Product C", sku: "SKU-003", stock: 8, reorderLevel: 15, status: "Critical" },
];

// Navigation Modules
const inventoryModules = [
  { name: "Products / SKU", count: 320, icon: Package, route: "/products", color: "blue" },
  { name: "Warehouses", count: 8, icon: MapPin, route: "/warehouses", color: "emerald" },
  { name: "Stock Levels", count: 540, icon: Layers, route: "/stock-levels", color: "orange" },
  { name: "Batch/Serial", count: 120, icon: Factory, route: "/batch-serial", color: "purple" },
  { name: "Quality Records", count: 60, icon: History, route: "/quality-inspection", color: "indigo" },
  { name: "Stock Movements", count: 210, icon: TrendingUp, route: "/stock-movement", color: "pink" },
  { name: "Reorder Levels", count: 45, icon: AlertTriangle, route: "/reorder-levels", color: "red" },
  { name: "Stock Adjustments", count: 28, icon: Edit, route: "/stock-adjustment", color: "teal" },
];

const kpiItems = [
  { label: "Total Products", value: "320", change: "+12", trend: "up" as const, icon: Package, color: "blue" },
  { label: "Stock Value", value: "$720K", change: "+8.5%", trend: "up" as const, icon: TrendingUp, color: "emerald" },
  { label: "Low Stock", value: "45", change: "-5", trend: "down" as const, icon: AlertTriangle, color: "orange" },
  { label: "Pending Inspection", value: "12", change: "-3", trend: "down" as const, icon: History, color: "purple" },
];

const stockPipelineColumns = [
  { name: "Incoming", tasks: ["Purchase Orders", "Transfer In", "Receiving"], color: "blue", count: 8 },
  { name: "Quality Check", tasks: ["Inspection Pending", "QC in Progress", "Approved"], color: "yellow", count: 6 },
  { name: "Outgoing", tasks: ["Shipment Pending", "Packing", "Delivery"], color: "green", count: 12 },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "indigo" | "pink" | "red" | "teal" | "yellow" | "green";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  red: "bg-red-50 text-red-600 group-hover:bg-red-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
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
  red: "bg-red-100 text-red-600",
  teal: "bg-teal-100 text-teal-600",
  yellow: "bg-yellow-100 text-yellow-600",
  green: "bg-green-100 text-green-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Inventory Dashboard" description="Inventory management overview" />
      <PageBreadcrumb pageTitle="Inventory Dashboard" />

      <div className="max-w-7xl mx-auto p-6">

        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {inventoryModules.map((module) => {
            const Icon = module.icon;
            const colorClass = colorClasses[module.color as ColorKey];
            return (
              <button
                key={module.name}
                onClick={() => navigate(module.route)}
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
          {/* Stock Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Stock Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly inventory levels</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={stockTrendData}>
                <defs>
                  <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
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
                  dataKey="stock" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#stockGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Batch Performance Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Batch Performance</h3>
                <p className="text-xs text-gray-500 mt-0.5">Inventory by batch</p>
              </div>
              <Package className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={batchPerformanceData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={60} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {batchPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Warehouses & Low Stock Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Warehouses Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Top Warehouses</h3>
              <p className="text-xs text-gray-500 mt-0.5">Warehouse stock summary</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Qty</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock Value</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topWarehouses.map((wh) => (
                    <tr key={wh.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{wh.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{wh.stock.toLocaleString()}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{wh.value}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{wh.utilization}</span>
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-cyan-500 h-1.5 rounded-full" 
                              style={{ width: wh.utilization }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${wh.trend.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                          {wh.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Low Stock Items */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Low Stock Alert</h3>
              <p className="text-xs text-gray-500 mt-0.5">Items below reorder level</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reorder Level</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lowStockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-500">{item.sku}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-red-600">{item.stock}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{item.reorderLevel}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === "Critical" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Stock Movement Pipeline */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Stock Movement Pipeline</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current stock movement stages</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockPipelineColumns.map((column) => (
                <div key={column.name} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`text-sm font-semibold text-${column.color}-600`}>{column.name}</h4>
                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">
                      {column.count}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {column.tasks.map((task, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-2.5 text-xs text-gray-700 shadow-sm border border-gray-100">
                        {task}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InventoryDashboard;