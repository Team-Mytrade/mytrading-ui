
import { useContext } from "react";
import { 
  UsersIcon, 
  BuildingOfficeIcon, 
  CalendarIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import ProductMenuCard from "../../components/common/ProductMenuCard";


const recentActivities = [
  {
    id: 1,
    user: "John Doe",
    action: "marked attendance",
    time: "2 minutes ago",
    avatar: "JD",
  },
  {
    id: 2,
    user: "Sarah Smith",
    action: "submitted leave request",
    time: "15 minutes ago",
    avatar: "SS",
  },
  {
    id: 3,
    user: "Michael Chen",
    action: "approved overtime",
    time: "1 hour ago",
    avatar: "MC",
  },
  {
    id: 4,
    user: "Emily Brown",
    action: "updated profile",
    time: "3 hours ago",
    avatar: "EB",
  },
  {
    id: 5,
    user: "David Wilson",
    action: "completed training",
    time: "5 hours ago",
    avatar: "DW",
  },
];

const upcomingLeaves = [
  { id: 1, employee: "Alice Johnson", type: "Annual Leave", days: 3, startDate: "May 25" },
  { id: 2, employee: "Bob Williams", type: "Sick Leave", days: 2, startDate: "May 26" },
  { id: 3, employee: "Carol Davis", type: "Casual Leave", days: 1, startDate: "May 27" },
  { id: 4, employee: "David Miller", type: "Annual Leave", days: 5, startDate: "Jun 1" },
];

const pendingApprovals = [
  { id: 1, type: "Leave Request", employee: "Emma Watson", date: "May 23, 2026", status: "pending" },
  { id: 2, type: "Overtime", employee: "James Bond", date: "May 22, 2026", status: "pending" },
  { id: 3, type: "Attendance Correction", employee: "Lisa Ray", date: "May 21, 2026", status: "pending" },
];

const colorClasses = {
  cyan: "bg-cyan-100 text-cyan-600",
  purple: "bg-purple-100 text-purple-600",
  yellow: "bg-yellow-100 text-yellow-600",
  emerald: "bg-emerald-100 text-emerald-600",
};

const trendColors = {
  up: "text-emerald-600 bg-emerald-50",
  down: "text-red-600 bg-red-50",
};

export default function Home() {
  const { user } = useContext(AuthContext);

  return (
    <>
      <PageMeta
        title="Dashboard | HRMS"
        description="HRMS Dashboard - Manage employees, attendance, and payroll"
      />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.fullName || "Admin"}!</h1>
          <p className="text-sm text-gray-500 mt-1">Here's what's happening with your workforce today.</p>
        </div>

        {/* Product Menu Card */}
        <div className="mb-8">
          <ProductMenuCard />
        </div>

        {/* Charts Section - Placeholder for now */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Attendance Overview</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-gray-400 text-sm">Chart placeholder - Integration coming soon</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Leave Trends</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-gray-400 text-sm">Chart placeholder - Integration coming soon</p>
            </div>
          </div>
        </div>

        {/* Recent Activities & Approvals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Activities */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Recent Activities</h3>
              <p className="text-xs text-gray-500 mt-0.5">Latest actions from employees</p>
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

          {/* Pending Approvals */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Pending Approvals</h3>
              <p className="text-xs text-gray-500 mt-0.5">Requests waiting for your action</p>
            </div>
            <div className="divide-y divide-gray-100">
              {pendingApprovals.map((approval) => (
                <div key={approval.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{approval.type}</p>
                    <p className="text-xs text-gray-500">{approval.employee} • {approval.date}</p>
                  </div>
                  <button className="px-3 py-1.5 text-xs font-medium text-cyan-600 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors">
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Leaves */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Upcoming Leaves</h3>
            <p className="text-xs text-gray-500 mt-0.5">Scheduled leaves for the next 7 days</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {upcomingLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{leave.employee}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{leave.type}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{leave.days}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{leave.startDate}</td>
                    <td className="px-5 py-3 text-right">
                      <button className="text-xs text-cyan-600 hover:text-cyan-700 font-medium">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}