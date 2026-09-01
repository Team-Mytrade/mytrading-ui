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
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:group-hover:bg-blue-900/50",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:group-hover:bg-emerald-900/50",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:group-hover:bg-orange-900/50",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:group-hover:bg-purple-900/50",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100 dark:bg-pink-900/30 dark:text-pink-400 dark:group-hover:bg-pink-900/50",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:group-hover:bg-teal-900/50",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:group-hover:bg-indigo-900/50",
  rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:group-hover:bg-rose-900/50",
  green: "bg-green-50 text-green-600 group-hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:group-hover:bg-green-900/50",
  yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:group-hover:bg-yellow-900/50",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400",
  green: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400",
  yellow: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30",
  down: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30",
};

// Pipeline column heading colors — kept as a static lookup so Tailwind's
// JIT compiler can see the full class names at build time (dynamic
// `text-${color}-600` strings are invisible to the compiler and get purged).
const pipelineHeadingClasses: Record<string, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  orange: "text-orange-600 dark:text-orange-400",
  green: "text-green-600 dark:text-green-400",
};

const CrmDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="CRM Dashboard" description="Customer Relationship Management Dashboard" />
      <PageBreadcrumb pageTitle="CRM Dashboard" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8 min-w-0">
          {crmModules.map((module) => {
            const Icon = module.icon;
            const colorClass = colorClasses[module.color as ColorKey];
            return (
              <button
                key={module.name}
                onClick={() => navigate(module.route)}
                className="group flex flex-col items-center p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className={`p-2.5 rounded-lg ${colorClass} transition-colors duration-200`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                  {module.name}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{module.count}</p>
              </button>
            );
          })}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpiItems.map((kpi) => {
            const Icon = kpi.icon;
            const TrendIcon = kpi.trend === "up" ? ArrowUpRight : ArrowDownRight;
            return (
              <div
                key={kpi.label}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-lg ${kpiColorClasses[kpi.color as ColorKey]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium ${trendColors[kpi.trend]}`}>
                    <TrendIcon className="h-3 w-3" />
                    {kpi.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-3">{kpi.value}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 min-w-0">
          {/* Lead Trend Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lead Trend</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Monthly lead generation</p>
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
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Deal Performance</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Deal distribution by value</p>
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
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Customers</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Highest value customers</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Deals</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Revenue</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {topCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">{customer.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{customer.deals}</td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{customer.revenue}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${customer.growth.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
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
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activities</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Latest user actions</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">{activity.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CRM Pipeline */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">CRM Pipeline</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sales pipeline stages</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {crmPipelineColumns.map((column) => (
                <div key={column.name} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h4 className={`text-sm font-semibold mb-3 ${pipelineHeadingClasses[column.color]}`}>{column.name}</h4>
                  <div className="space-y-2">
                    {column.tasks.map((task, idx) => (
                      <div key={idx} className="bg-white dark:bg-gray-900 rounded-lg p-2.5 text-xs text-gray-700 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-800">
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