import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  Clock,
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

// Mock Data
const salesTrendData = [
  { month: "Jan", sales: 12000 },
  { month: "Feb", sales: 15000 },
  { month: "Mar", sales: 18000 },
  { month: "Apr", sales: 20000 },
  { month: "May", sales: 22000 },
  { month: "Jun", sales: 25000 },
];

const inventoryStockData = [
  { product: "SKU A", stock: 120 },
  { product: "SKU B", stock: 80 },
  { product: "SKU C", stock: 150 },
  { product: "SKU D", stock: 60 },
  { product: "SKU E", stock: 200 },
];

const recentAccessLogs = [
  { id: 1, user: "admin", role: "System Admin", action: "Logged In", time: "08:15 AM", date: "2026-05-23" },
  { id: 2, user: "jdoe", role: "Manager", action: "Viewed Sales Report", time: "09:30 AM", date: "2026-05-23" },
  { id: 3, user: "asmith", role: "Finance", action: "Approved Purchase Order", time: "10:05 AM", date: "2026-05-23" },
  { id: 4, user: "bjohnson", role: "Inventory", action: "Updated Stock Levels", time: "11:20 AM", date: "2026-05-23" },
];

const dashboardModules = [
  { name: "KPI Metrics", icon: TrendingUp, color: "blue", description: "Monitor key performance indicators" },
  { name: "Sales Reports", icon: DollarSign, color: "emerald", description: "Track sales performance" },
  { name: "Inventory Reports", icon: Package, color: "orange", description: "Manage inventory levels" },
  { name: "Financial Statements", icon: TrendingUp, color: "purple", description: "View financial summaries" },
  { name: "Procurement Analytics", icon: ShoppingCart, color: "red", description: "Analyze procurement data" },
  { name: "Delivery Performance", icon: Package, color: "teal", description: "Track delivery metrics" },
  { name: "User Access Logs", icon: Clock, color: "indigo", description: "Monitor user activities" },
];

const colorClasses = {
  blue: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
  emerald: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
  orange: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
  purple: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
  red: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
  teal: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
  indigo: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 dark:bg-cyan-500/15 dark:text-cyan-300 dark:group-hover:bg-cyan-500/20",
};

const ProductReportDashboard: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;
  const totalPages = Math.ceil(dashboardModules.length / itemsPerPage);

  const nextPage = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const currentModules = dashboardModules.slice(
    currentPage * itemsPerPage,
    currentPage * itemsPerPage + itemsPerPage
  );

  return (
    <div className="w-full">
      {/* Dashboard Modules Grid with Pagination */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Analytics Dashboard</h3>
            <p className="text-xs text-gray-500 mt-0.5">Key metrics and reports at a glance</p>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={nextPage}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {currentModules.map((module, idx) => {
            const Icon = module.icon;
            return (
              <motion.button
                key={idx}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="group flex flex-col items-center p-4 rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all duration-200"
              >
                <div className={`p-2.5 rounded-lg ${colorClasses[module.color as keyof typeof colorClasses]} transition-colors duration-200`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-2 text-sm font-medium text-gray-900 group-hover:text-cyan-600 transition-colors">
                  {module.name}
                </h4>
                <p className="text-xs text-gray-500 text-center mt-0.5 hidden sm:block">
                  {module.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>


      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

        {/* Inventory Stock Chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Inventory Stock</h3>
              <p className="text-xs text-gray-500 mt-0.5">Current stock levels by SKU</p>
            </div>
            <Package className="h-5 w-5 text-orange-500" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={inventoryStockData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" fontSize={12} />
              <YAxis type="category" dataKey="product" stroke="#9ca3af" fontSize={12} width={60} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #e5e7eb", 
                  borderRadius: "8px",
                  fontSize: "12px"
                }} 
              />
              <Bar dataKey="stock" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Access Logs Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent User Access Logs</h3>
          <p className="text-xs text-gray-500 mt-0.5">Latest user activities and system access</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentAccessLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-sm font-medium text-gray-900">{log.user}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-600">{log.role}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-600">{log.action}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-500">{log.date}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-gray-500">{log.time}</span>
                  </td>
                </tr>

              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductReportDashboard;
