import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  CheckCircle,
  Calendar,
  AlertTriangle,
  Clock,
  FileText,
  Gift,
  Home,
  Bell,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

// Mock Data
const attendanceTrendData = [
  { day: "Mon", present: 110, absent: 10, late: 5 },
  { day: "Tue", present: 115, absent: 5, late: 3 },
  { day: "Wed", present: 112, absent: 8, late: 4 },
  { day: "Thu", present: 118, absent: 2, late: 2 },
  { day: "Fri", present: 120, absent: 0, late: 1 },
];

const leaveTypeDistribution = [
  { name: "Sick Leave", count: 15, color: "#06b6d4" },
  { name: "Casual Leave", count: 10, color: "#10b981" },
  { name: "Annual Leave", count: 20, color: "#f59e0b" },
  { name: "Emergency Leave", count: 5, color: "#8b5cf6" },
];

const recentLeaveRequests = [
  { id: 1, employee: "John Doe", type: "Sick Leave", days: 2, status: "Approved", date: "2026-05-20" },
  { id: 2, employee: "Jane Smith", type: "Casual Leave", days: 1, status: "Pending", date: "2026-05-21" },
  { id: 3, employee: "Robert Brown", type: "Annual Leave", days: 5, status: "Approved", date: "2026-05-19" },
  { id: 4, employee: "Emily Davis", type: "Emergency Leave", days: 1, status: "Pending", date: "2026-05-22" },
];

const pendingApprovals = [
  { id: 1, type: "Leave Request", count: 8, icon: Calendar, color: "blue" },
  { id: 2, type: "Overtime Request", count: 5, icon: Clock, color: "orange" },
  { id: 3, type: "WFH Request", count: 3, icon: Home, color: "purple" },
];

// Navigation Modules
const attendanceModules = [
  { name: "Department", icon: Building2, route: "/att_department", color: "blue" },
  { name: "Employee", icon: Users, route: "/att_employee", color: "emerald" },
  { name: "Attendance Approval", icon: CheckCircle, route: "/att_attendanceApproval", color: "orange" },
  { name: "Attendance Record", icon: Calendar, route: "/att_attendanceRecord", color: "purple" },
  { name: "Violation", icon: AlertTriangle, route: "/att_attendanceViolation", color: "red" },
  { name: "Shift Schedule", icon: Clock, route: "/att_shiftSchedule", color: "indigo" },
  { name: "Leave Balance", icon: FileText, route: "/att_leaveBalance", color: "teal" },
  { name: "Leave Request", icon: Calendar, route: "/att_leaveRequest", color: "pink" },
  { name: "Leave Type", icon: FileText, route: "/att_leaveType", color: "rose" },
  { name: "Overtime", icon: Clock, route: "/att_overtimeRule", color: "amber" },
  { name: "WFH Request", icon: Home, route: "/att_workFromHomeRequests", color: "cyan" },
  { name: "Attendance Reports", icon: FileText, route: "/att_reports", color: "blue" },
  { name: "Notifications", icon: Bell, route: "/att_notifications", color: "gray" },
];

const kpiItems = [
  { label: "Total Employees", value: "120", change: "+5", trend: "up" as const, icon: Users, color: "blue" },
  { label: "Present Today", value: "112", change: "+3%", trend: "up" as const, icon: CheckCircle, color: "emerald" },
  { label: "Absent Today", value: "8", change: "-2", trend: "down" as const, icon: AlertTriangle, color: "orange" },
  { label: "Leave Requests", value: "12", change: "+2", trend: "up" as const, icon: Calendar, color: "purple" },
];

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "red" | "indigo" | "teal" | "pink" | "rose" | "amber" | "cyan" | "gray";
type TrendKey = "up" | "down";

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  red: "bg-red-50 text-red-600 group-hover:bg-red-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  rose: "bg-rose-50 text-rose-600 group-hover:bg-rose-100",
  amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
  cyan: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100",
  gray: "bg-gray-50 text-gray-600 group-hover:bg-gray-100",
};

const kpiColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-100 text-blue-600",
  emerald: "bg-emerald-100 text-emerald-600",
  orange: "bg-orange-100 text-orange-600",
  purple: "bg-purple-100 text-purple-600",
  red: "bg-red-100 text-red-600",
  indigo: "bg-indigo-100 text-indigo-600",
  teal: "bg-teal-100 text-teal-600",
  pink: "bg-pink-100 text-pink-600",
  rose: "bg-rose-100 text-rose-600",
  amber: "bg-amber-100 text-amber-600",
  cyan: "bg-cyan-100 text-cyan-600",
  gray: "bg-gray-100 text-gray-600",
};

const trendColors: Record<TrendKey, string> = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

const getStatusColor = (status: string) => {
  return status === "Approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700";
};

const AttendanceDashboard: React.FC = () => {
  const navigate = useNavigate();

  const recentLeaveColumns: ColumnDef<any>[] = [
    {
      key: "employee",
      label: "Employee",
    },
    {
      key: "type",
      label: "Leave Type",
    },
    {
      key: "days",
      label: "Days",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(row.status)}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: "date",
      label: "Date",
    },
  ];

  return (
    <>
      <PageMeta title="Attendance Dashboard" description="Manage employee attendance and leave" />
      <PageBreadcrumb pageTitle="Attendance Dashboard" />

      <div className="max-w-7xl mx-auto p-6">

        {/* Navigation Modules Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {attendanceModules.map((module) => {
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
              </button>
            );
          })}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {kpiItems.map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <StatsCard
                key={idx}
                label={kpi.label}
                value={kpi.value}
                gradient={
                  kpi.color === "blue" ? "from-cyan-50 to-blue-50" :
                  kpi.color === "emerald" ? "from-green-50 to-emerald-50" :
                  kpi.color === "orange" ? "from-amber-50 to-yellow-50" :
                  "from-purple-50 to-pink-50"
                }
                borderColor={
                  kpi.color === "blue" ? "border-cyan-100" :
                  kpi.color === "emerald" ? "border-green-100" :
                  kpi.color === "orange" ? "border-amber-100" :
                  "border-purple-100"
                }
                labelColor={
                  kpi.color === "blue" ? "text-cyan-600" :
                  kpi.color === "emerald" ? "text-green-600" :
                  kpi.color === "orange" ? "text-amber-600" :
                  "text-purple-600"
                }
                icon={<Icon className="h-6 w-6" />}
              />
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Attendance Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Attendance Trend</h3>
                <p className="text-xs text-gray-500 mt-0.5">Weekly attendance overview</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={attendanceTrendData}>
                <defs>
                  <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="absentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
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
                  dataKey="present" 
                  stackId="1"
                  stroke="#06b6d4" 
                  strokeWidth={2}
                  fill="url(#presentGradient)" 
                  name="Present"
                />
                <Area 
                  type="monotone" 
                  dataKey="absent" 
                  stackId="1"
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fill="url(#absentGradient)" 
                  name="Absent"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-xs text-gray-600">Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs text-gray-600">Absent</span>
              </div>
            </div>
          </div>

          {/* Leave Type Distribution Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Leave Distribution</h3>
                <p className="text-xs text-gray-500 mt-0.5">Leave types breakdown</p>
              </div>
              <Calendar className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={leaveTypeDistribution} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={100} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "white", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "12px"
                  }} 
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {leaveTypeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Leave Requests & Pending Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Leave Requests Table */}
          <ReusableTable
            data={recentLeaveRequests}
            columns={recentLeaveColumns}
            searchable={false}
            pageSize={5}
            toolbar={
              <div className="px-4 py-3">
                <h3 className="text-base font-semibold text-gray-900">Recent Leave Requests</h3>
                <p className="text-xs text-gray-500 mt-0.5">Latest leave applications</p>
              </div>
            }
          />

          {/* Pending Approvals */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Pending Approvals</h3>
              <p className="text-xs text-gray-500 mt-0.5">Requests awaiting review</p>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingApprovals.map((item) => {
                const Icon = item.icon;
                const colorClassesMap: Record<string, string> = {
                  blue: "bg-blue-100 text-blue-600",
                  orange: "bg-orange-100 text-orange-600",
                  purple: "bg-purple-100 text-purple-600",
                };
                return (
                  <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClassesMap[item.color]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.type}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.count} pending requests</p>
                      </div>
                    </div>
                    <button className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">
                      Review
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">93.3%</p>
              </div>
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">On-Time Arrival</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">89.2%</p>
              </div>
              <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Leaves Taken</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">245</p>
              </div>
              <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Violations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
              </div>
              <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AttendanceDashboard;