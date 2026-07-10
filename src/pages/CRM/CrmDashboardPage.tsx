import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  TrendingUp,
  DollarSign,
  Mail,
  Clock,
  PieChart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

// Mock Data
const leadTrendData = [
  { month: "Jan", leads: 20 },
  { month: "Feb", leads: 35 },
  { month: "Mar", leads: 25 },
  { month: "Apr", leads: 40 },
  { month: "May", leads: 55 },
  { month: "Jun", leads: 45 },
];

const dealPerformanceData = [
  { name: "Deal A", value: 20, color: "#06b6d4" },
  { name: "Deal B", value: 35, color: "#10b981" },
  { name: "Deal C", value: 15, color: "#f59e0b" },
  { name: "Deal D", value: 25, color: "#8b5cf6" },
];

const topCustomers = [
  { id: 1, name: "ABC Corp", deals: 5, revenue: "$12,000", growth: "+15%" },
  { id: 2, name: "XYZ Ltd", deals: 3, revenue: "$8,500", growth: "+8%" },
  { id: 3, name: "LMN Inc", deals: 2, revenue: "$6,200", growth: "-3%" },
  { id: 4, name: "PQR Solutions", deals: 4, revenue: "$10,000", growth: "+12%" },
];

const recentActivities = [
  { id: 1, user: "John Doe", action: "Added new lead", time: "2 hours ago", avatar: "JD" },
  { id: 2, user: "Sarah Smith", action: "Updated deal status", time: "4 hours ago", avatar: "SS" },
  { id: 3, user: "Michael Chen", action: "Sent proposal", time: "6 hours ago", avatar: "MC" },
  { id: 4, user: "Emily Brown", action: "Scheduled meeting", time: "1 day ago", avatar: "EB" },
];

// Navigation Modules
const crmModules = [
  { name: "Customers", count: 120, icon: Users, route: "/customer-management", color: "blue" },
  { name: "Leads", count: 45, icon: UserPlus, route: "/leads", color: "emerald" },
  { name: "Opportunities", count: 32, icon: TrendingUp, route: "/opportunities", color: "orange" },
  { name: "Deals", count: 28, icon: DollarSign, route: "/deals", color: "purple" },
  { name: "Contacts", count: 75, icon: Mail, route: "/contactPerson", color: "pink" },
  { name: "Tasks", count: 28, icon: Calendar, route: "/task", color: "teal" },
  { name: "History", count: 210, icon: Clock, route: "/communication-history", color: "indigo" },
  { name: "Segments", count: 6, icon: PieChart, route: "/customer-segment", color: "rose" },
];

const kpiItems = [
  { label: "Total Customers", value: "120", change: "+12%", trend: "up" as const, icon: Users, color: "blue" },
  { label: "Open Leads", value: "45", change: "+8%", trend: "up" as const, icon: UserPlus, color: "emerald" },
  { label: "Deals Won", value: "28", change: "+5%", trend: "up" as const, icon: DollarSign, color: "orange" },
  { label: "Tasks Pending", value: "28", change: "-3%", trend: "down" as const, icon: Calendar, color: "purple" },
];

const crmPipelineColumns = [
  { name: "Lead", tasks: ["New Inquiry", "Contacted"], color: "blue" },
  { name: "Qualified", tasks: ["Demo Scheduled", "Proposal Sent"], color: "yellow" },
  { name: "Negotiation", tasks: ["Price Discussion", "Contract Review"], color: "orange" },
  { name: "Closed Won", tasks: ["Contract Signed", "Welcome Email"], color: "green" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "pink" | "teal" | "indigo" | "rose" | "green" | "yellow";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
  green: "bg-green-50 text-green-600 group-hover:bg-green-100",
  yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
  indigo: "bg-indigo-100 text-indigo-600",
  rose: "bg-rose-100 text-rose-600",
  green: "bg-green-100 text-green-600",
  yellow: "bg-yellow-100 text-yellow-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const CrmDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="CRM Dashboard" description="Customer Relationship Management Dashboard" />
      <PageBreadcrumb pageTitle="CRM Dashboard" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {crmModules.map((module) => {
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

      

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Lead Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Lead Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly lead generation</p>
              </div>
              <UserPlus className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={leadTrendData}>
                <defs>
                  <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="leads" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#leadGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Deal Performance Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Deal Performance</h3>
                <p className="text-xs text-gray-500 mt-0.5">Deal distribution by value</p>
              </div>
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dealPerformanceData} layout="vertical" margin={{ left: 40 }}>
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
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {dealPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers & Recent Activities */}
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
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deals</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{customer.deals}</td>
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

          {/* Recent Activities */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Recent Activities</h3>
              <p className="text-xs text-gray-500 mt-0.5">Latest user actions</p>
            </div>
            <div className="divide-y divide-gray-100">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-cyan-700">{activity.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CRM Pipeline */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">CRM Pipeline</h3>
            <p className="text-xs text-gray-500 mt-0.5">Sales pipeline stages</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {crmPipelineColumns.map((column) => (
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

export default CrmDashboardPage;
