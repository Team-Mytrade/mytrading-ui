import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  DollarSign,
  UserCheck,
  CreditCard,
  FileText,
  TrendingUp,
  Gift,
  FolderOpen,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

// Mock Data
const payrollTrendData = [
  { month: "Jan", amount: 1240000, employees: 135 },
  { month: "Feb", amount: 1280000, employees: 138 },
  { month: "Mar", amount: 1320000, employees: 140 },
  { month: "Apr", amount: 1380000, employees: 142 },
  { month: "May", amount: 1420000, employees: 142 },
  { month: "Jun", amount: 1450000, employees: 145 },
];

const departmentData = [
  { name: "Engineering", count: 45, payroll: 580000, color: "#06b6d4" },
  { name: "Sales", count: 28, payroll: 420000, color: "#10b981" },
  { name: "Marketing", count: 22, payroll: 310000, color: "#f59e0b" },
  { name: "Operations", count: 25, payroll: 350000, color: "#8b5cf6" },
  { name: "HR & Admin", count: 15, payroll: 190000, color: "#ec4899" },
];

const recentPayrollRuns = [
  { id: 1, month: "June 2026", processedDate: "2026-06-05", totalAmount: "₹14.5L", employees: 145, status: "Completed" },
  { id: 2, month: "May 2026", processedDate: "2026-05-05", totalAmount: "₹14.2L", employees: 142, status: "Completed" },
  { id: 3, month: "April 2026", processedDate: "2026-04-05", totalAmount: "₹13.8L", employees: 142, status: "Completed" },
];

const pendingActions = [
  { id: 1, title: "Salary Structure Review", count: 12, icon: FileText, color: "blue", route: "/salary-structure" },
  { id: 2, title: "Employee Verification", count: 8, icon: UserCheck, color: "orange", route: "/employee-records" },
  { id: 3, title: "Leave Encashment", count: 5, icon: Gift, color: "purple", route: "/benefits" },
  { id: 4, title: "Document Uploads", count: 23, icon: FolderOpen, color: "emerald", route: "/employee-documents" },
];

// Navigation Modules
const payrollModules = [
  { name: "Employee Records", icon: Users, route: "/employee-records", color: "blue", count: 145 },
  { name: "Employee Department", icon: Building2, route: "/employee-department", color: "emerald", count: 8 },
  { name: "Employee Compensation", icon: DollarSign, route: "/employee-compensation", color: "orange", count: 6 },
  { name: "Employee Salary", icon: CreditCard, route: "/employee-salary", color: "purple", count: 145 },
  { name: "Salary Structure", icon: FileText, route: "/salary-structure", color: "indigo", count: 12 },
  { name: "Payroll Runs", icon: Calendar, route: "/payroll-runs", color: "pink", count: 6 },
  { name: "Benefits & Allowances", icon: Gift, route: "/benefits", color: "teal", count: 8 },
  { name: "Employee Documents", icon: FolderOpen, route: "/employee-documents", color: "rose", count: 145 },
];

const kpiItems = [
  { label: "Total Employees", value: "145", change: "+5", trend: "up" as const, icon: Users, color: "blue" },
  { label: "Monthly Payroll", value: "₹14.5L", change: "+2.4%", trend: "up" as const, icon: TrendingUp, color: "emerald" },
  { label: "Avg Salary", value: "₹82,500", change: "+3.2%", trend: "up" as const, icon: DollarSign, color: "orange" },
  { label: "Departments", value: "8", change: "0", trend: "up" as const, icon: Building2, color: "purple" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "indigo" | "pink" | "teal" | "rose";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
  rose: "bg-rose-100 text-rose-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const PayrollHrmsDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Payroll & HRMS Dashboard" description="Manage employee payroll and HR operations" />
      <PageBreadcrumb pageTitle="Payroll & HRMS" />

      <div className="max-w-7xl mx-auto p-6">

        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {payrollModules.map((module) => {
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

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Payroll Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Payroll Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly payroll amount</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={payrollTrendData}>
                <defs>
                  <linearGradient id="payrollGradient" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="amount" 
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#payrollGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Department Distribution Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Department Distribution</h3>
                <p className="text-xs text-gray-500 mt-0.5">Employees by department</p>
              </div>
              <Building2 className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={departmentData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={90} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {departmentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Payroll Summary */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Department Payroll Summary</h3>
            <p className="text-xs text-gray-500 mt-0.5">Salary distribution by department</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Payroll</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {departmentData.map((dept) => (
                  <tr key={dept.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{dept.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{dept.count}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{(dept.payroll / 1000).toFixed(0)}K</td>
                    <td className="px-6 py-4 text-sm text-gray-600">₹{Math.round(dept.payroll / dept.count).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payroll Runs & Pending Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Payroll Runs */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Recent Payroll Runs</h3>
              <p className="text-xs text-gray-500 mt-0.5">Completed payroll cycles</p>
            </div>
            <div className="divide-y divide-gray-100">
              {recentPayrollRuns.map((run) => (
                <div key={run.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{run.month}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Processed: {run.processedDate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{run.totalAmount}</p>
                    <p className="text-xs text-gray-500">{run.employees} employees</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => navigate("/payroll-runs")}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
              >
                View all runs
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Pending Actions */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Pending Actions</h3>
              <p className="text-xs text-gray-500 mt-0.5">Items requiring attention</p>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingActions.map((action) => {
                const Icon = action.icon;
                const colorClasses = {
                  blue: "bg-blue-100 text-blue-600",
                  orange: "bg-orange-100 text-orange-600",
                  purple: "bg-purple-100 text-purple-600",
                  emerald: "bg-emerald-100 text-emerald-600",
                };
                return (
                  <div key={action.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClasses[action.color as keyof typeof colorClasses]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{action.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{action.count} pending items</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate(action.route)}
                      className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate("/employee-records")}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 text-left hover:shadow-md transition-all"
          >
            <Users className="h-5 w-5 text-blue-600 mb-2" />
            <h4 className="text-sm font-semibold text-gray-900">Employee Records</h4>
            <p className="text-xs text-gray-500 mt-1">View and manage employee information</p>
          </button>
          <button 
            onClick={() => navigate("/salary-structure")}
            className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 text-left hover:shadow-md transition-all"
          >
            <FileText className="h-5 w-5 text-emerald-600 mb-2" />
            <h4 className="text-sm font-semibold text-gray-900">Salary Structure</h4>
            <p className="text-xs text-gray-500 mt-1">Configure compensation plans</p>
          </button>
          <button 
            onClick={() => navigate("/payroll-runs")}
            className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 text-left hover:shadow-md transition-all"
          >
            <Calendar className="h-5 w-5 text-orange-600 mb-2" />
            <h4 className="text-sm font-semibold text-gray-900">Process Payroll</h4>
            <p className="text-xs text-gray-500 mt-1">Run monthly payroll cycle</p>
          </button>
          <button 
            onClick={() => navigate("/benefits")}
            className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 text-left hover:shadow-md transition-all"
          >
            <Gift className="h-5 w-5 text-purple-600 mb-2" />
            <h4 className="text-sm font-semibold text-gray-900">Benefits</h4>
            <p className="text-xs text-gray-500 mt-1">Manage employee benefits</p>
          </button>
        </div>
      </div>
    </>
  );
};

export default PayrollHrmsDashboard;