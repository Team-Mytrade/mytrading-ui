import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ShoppingCart,
  Truck,
  Package,
  Receipt,
  CheckCircle,
  Calendar,
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
const purchaseTrendData = [
  { month: "Jan", orders: 12, value: 45000 },
  { month: "Feb", orders: 18, value: 68000 },
  { month: "Mar", orders: 15, value: 56000 },
  { month: "Apr", orders: 22, value: 82000 },
  { month: "May", orders: 28, value: 105000 },
  { month: "Jun", orders: 25, value: 95000 },
];

const supplierPerformanceData = [
  { name: "Supplier A", orders: 45, value: 125000, color: "#06b6d4" },
  { name: "Supplier B", orders: 32, value: 89000, color: "#10b981" },
  { name: "Supplier C", orders: 28, value: 76000, color: "#f59e0b" },
  { name: "Supplier D", orders: 20, value: 54000, color: "#8b5cf6" },
];

const topProducts = [
  { id: 1, name: "Product X", sku: "SKU-001", orders: 20, qty: 150, value: "$22,500" },
  { id: 2, name: "Product Y", sku: "SKU-002", orders: 15, qty: 100, value: "$15,000" },
  { id: 3, name: "Product Z", sku: "SKU-003", orders: 12, qty: 80, value: "$12,000" },
  { id: 4, name: "Product W", sku: "SKU-004", orders: 10, qty: 60, value: "$9,000" },
];

const pendingApprovals = [
  { id: 1, type: "Purchase Requisition", reference: "PR-001", requester: "John Doe", amount: "$5,200", date: "2026-05-23" },
  { id: 2, type: "Purchase Order", reference: "PO-045", requester: "Sarah Smith", amount: "$12,800", date: "2026-05-22" },
  { id: 3, type: "Goods Receipt", reference: "GRN-012", requester: "Mike Johnson", amount: "$8,500", date: "2026-05-21" },
];

// Navigation Modules
const procurementModules = [
  { name: "Purchase Requisitions", count: 45, icon: FileText, route: "/purchase-requisitions", color: "blue" },
  { name: "Purchase Orders", count: 32, icon: ShoppingCart, route: "/purchase-orders", color: "emerald" },
  { name: "Vendors", count: 12, icon: Truck, route: "/vendors", color: "orange" },
  { name: "Products", count: 320, icon: Package, route: "/purchase-products", color: "purple" },
  { name: "Goods Receipt Notes", count: 30, icon: Receipt, route: "/goods-receipt-notes", color: "pink" },
  { name: "Terms and Conditions", count: 18, icon: FileText, route: "/terms-and-conditions", color: "indigo" },
  { name: "Deliveries", count: 27, icon: Calendar, route: "/deliveries", color: "red" },
  { name: "Approval Status", count: 9, icon: CheckCircle, route: "/approval-status", color: "teal" },
];

const kpiItems = [
  { label: "Total PRs", value: "45", change: "+8", trend: "up" as const, icon: FileText, color: "blue" },
  { label: "Orders Pending", value: "12", change: "-3", trend: "down" as const, icon: ShoppingCart, color: "emerald" },
  { label: "Active Suppliers", value: "12", change: "+2", trend: "up" as const, icon: Truck, color: "orange" },
  { label: "GRN Pending", value: "8", change: "-2", trend: "down" as const, icon: Receipt, color: "purple" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "pink" | "indigo" | "red" | "teal" | "yellow" | "green";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
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
  pink: "bg-pink-100 text-pink-600",
  indigo: "bg-indigo-100 text-indigo-600",
  red: "bg-red-100 text-red-600",
  teal: "bg-teal-100 text-teal-600",
  yellow: "bg-yellow-100 text-yellow-600",
  green: "bg-green-100 text-green-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const ProcurementDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Procurement Dashboard" description="Procurement and purchasing overview" />
      <PageBreadcrumb pageTitle="Procurement Dashboard" />

      <div className="max-w-7xl mx-auto p-6">

        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {procurementModules.map((module) => {
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
          {/* Purchase Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Purchase Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly purchase orders</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={purchaseTrendData}>
                <defs>
                  <linearGradient id="purchaseGradient" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="orders" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#purchaseGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Supplier Performance Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Supplier Performance</h3>
                <p className="text-xs text-gray-500 mt-0.5">Orders by supplier</p>
              </div>
              <Truck className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={supplierPerformanceData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={80} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
                <Bar dataKey="orders" radius={[0, 4, 4, 0]}>
                  {supplierPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products & Pending Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Products Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Top Products Ordered</h3>
              <p className="text-xs text-gray-500 mt-0.5">Most frequently ordered items</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-5 py-3 text-sm font-mono text-gray-500">{product.sku}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{product.orders}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{product.qty}</td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{product.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Pending Approvals</h3>
              <p className="text-xs text-gray-500 mt-0.5">Awaiting your action</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requester</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingApprovals.map((approval) => (
                    <tr key={approval.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm text-gray-600">{approval.type}</td>
                      <td className="px-5 py-3 text-sm font-mono font-medium text-gray-900">{approval.reference}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{approval.requester}</td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{approval.amount}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{approval.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Procurement Pipeline Summary */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Procurement Pipeline</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current procurement stages</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-600 mb-2">Requisition</h4>
                <p className="text-2xl font-bold text-gray-900">45</p>
                <p className="text-xs text-gray-500 mt-1">Pending requisitions</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-emerald-600 mb-2">Purchase Order</h4>
                <p className="text-2xl font-bold text-gray-900">32</p>
                <p className="text-xs text-gray-500 mt-1">Open POs</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-600 mb-2">Goods Receipt</h4>
                <p className="text-2xl font-bold text-gray-900">30</p>
                <p className="text-xs text-gray-500 mt-1">Pending GRNs</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-600 mb-2">Approval</h4>
                <p className="text-2xl font-bold text-gray-900">9</p>
                <p className="text-xs text-gray-500 mt-1">Pending approvals</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProcurementDashboard;
