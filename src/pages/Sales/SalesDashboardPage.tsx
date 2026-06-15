import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ShoppingCart,
  Tag,
  Users,
  Package,
  Users2,
  CreditCard,
  Calendar,
  DollarSign,
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
const salesTrendData = [
  { month: "Jan", sales: 30000 },
  { month: "Feb", sales: 35000 },
  { month: "Mar", sales: 42000 },
  { month: "Apr", sales: 38000 },
  { month: "May", sales: 48000 },
  { month: "Jun", sales: 52000 },
];

const productPerformanceData = [
  { name: "Product A", qty: 540, revenue: 12500, color: "#06b6d4" },
  { name: "Product B", qty: 320, revenue: 8500, color: "#10b981" },
  { name: "Product C", qty: 280, revenue: 7200, color: "#f59e0b" },
  { name: "Product D", qty: 200, revenue: 5400, color: "#8b5cf6" },
];

const topCustomers = [
  { id: 1, name: "John Traders", orders: 12, revenue: "$12,400", growth: "+15%" },
  { id: 2, name: "Next Corp", orders: 8, revenue: "$8,100", growth: "+8%" },
  { id: 3, name: "Apex Stores", orders: 6, revenue: "$5,700", growth: "+12%" },
  { id: 4, name: "Global Retail", orders: 5, revenue: "$4,200", growth: "-2%" },
];

const recentOrders = [
  { id: 1, orderNo: "SO-001", customer: "John Traders", amount: "$1,200", status: "Completed", date: "2026-05-23" },
  { id: 2, orderNo: "SO-002", customer: "Next Corp", amount: "$850", status: "Processing", date: "2026-05-22" },
  { id: 3, orderNo: "SO-003", customer: "Apex Stores", amount: "$2,300", status: "Shipped", date: "2026-05-21" },
  { id: 4, orderNo: "SO-004", customer: "Global Retail", amount: "$950", status: "Pending", date: "2026-05-20" },
];

// Navigation Modules
const salesModules = [
  { name: "Quotations", count: 4, icon: FileText, route: "/quotationsPage", color: "blue" },
  { name: "Sales Orders", count: 12, icon: ShoppingCart, route: "/ordersPage", color: "emerald" },
  { name: "Price List", count: 7, icon: Tag, route: "/priceListe", color: "orange" },
  { name: "Customers", count: 120, icon: Users, route: "/sales-customer", color: "purple" },
  { name: "Products", count: 320, icon: Package, route: "/products", color: "yellow" },
  { name: "Sales Team", count: 22, icon: Users2, route: "/sales-person", color: "indigo" },
  { name: "Payment Terms", count: 6, icon: CreditCard, route: "/payment-term", color: "pink" },
  { name: "Delivery Schedule", count: 9, icon: Calendar, route: "/delivery-schedule", color: "teal" },
];

const kpiItems = [
  { label: "Total Revenue", value: "$52.4k", change: "+12.5%", trend: "up" as const, icon: DollarSign, color: "blue" },
  { label: "Total Orders", value: "1,240", change: "+8.3%", trend: "up" as const, icon: ShoppingCart, color: "emerald" },
  { label: "Active Customers", value: "540", change: "+5.2%", trend: "up" as const, icon: Users, color: "purple" },
  { label: "Growth Rate", value: "+18%", change: "+3%", trend: "up" as const, icon: TrendingUp, color: "orange" },
];

const pipelineColumns = [
  { name: "Lead", tasks: ["Quote Pending", "New Inquiry", "Follow-up"], color: "blue" },
  { name: "Negotiation", tasks: ["Offer Sent", "Price Discussion", "Discount Approval"], color: "yellow" },
  { name: "Closed Won", tasks: ["Confirmed", "Payment Received", "Order Processed"], color: "green" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "yellow" | "indigo" | "pink" | "teal" | "green";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  green: "bg-green-50 text-green-600 group-hover:bg-green-100",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  yellow: "bg-yellow-100 text-yellow-600",
  indigo: "bg-indigo-100 text-indigo-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
  green: "bg-green-100 text-green-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const SalesDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Sales Dashboard" description="Sales overview and analytics" />
      <PageBreadcrumb pageTitle="Sales Dashboard" />

      <div className="max-w-7xl mx-auto p-6">

        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {salesModules.map((module) => {
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
                <h4 className="mt-2 text-sm font-semibold text-gray-900 group-hover:text-cyan-600 transition-colors">
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
          {/* Sales Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Sales Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly sales performance</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesTrendData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="sales" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#salesGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Product Performance Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Product Performance</h3>
                <p className="text-xs text-gray-500 mt-0.5">Top selling products</p>
              </div>
              <Package className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productPerformanceData} layout="vertical" margin={{ left: 60 }}>
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
                <Bar dataKey="qty" radius={[0, 4, 4, 0]}>
                  {productPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Customers Table */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Top Customers</h3>
              <p className="text-xs text-gray-500 mt-0.5">Highest value customers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{customer.orders}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{customer.revenue}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${customer.growth.startsWith("+") ? "text-emerald-600" : "text-red-600"}`}>
                          {customer.growth}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
              <p className="text-xs text-gray-500 mt-0.5">Latest customer orders</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order No</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{order.orderNo}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{order.customer}</td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{order.amount}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === "Completed" ? "bg-green-100 text-green-700" :
                          order.status === "Processing" ? "bg-blue-100 text-blue-700" :
                          order.status === "Shipped" ? "bg-purple-100 text-purple-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">{order.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sales Pipeline */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Sales Pipeline</h3>
            <p className="text-xs text-gray-500 mt-0.5">Current pipeline stages</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pipelineColumns.map((column) => (
                <div key={column.name} className="bg-gray-50 rounded-lg p-4">
                  <h4 className={`text-sm font-semibold mb-3 text-${column.color}-600`}>{column.name}</h4>
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

export default SalesDashboardPage;