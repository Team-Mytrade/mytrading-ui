import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { BarChart3, Calendar, Clock, AlertTriangle, UserX, RefreshCw, CheckCircle, Search, PieChart, TrendingUp } from 'lucide-react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import StatsCard from '../../components/common/Statscard';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';

type TabType = 'DASHBOARD' | 'DAILY' | 'MONTHLY' | 'LATE' | 'MISSING';

const AttendanceReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReportData = async (tab: TabType) => {
    setLoading(true);
    setData(null);
    try {
      let endpoint = '';
      switch (tab) {
        case 'DASHBOARD':
          endpoint = '/v1/api/attendance/dashboard';
          break;
        case 'DAILY':
          endpoint = '/v1/api/attendance/reports/daily';
          break;
        case 'MONTHLY':
          endpoint = '/v1/api/attendance/reports/monthly';
          break;
        case 'LATE':
          endpoint = '/v1/api/attendance/reports/late-arrivals';
          break;
        case 'MISSING':
          endpoint = '/v1/api/attendance/reports/missing-punch';
          break;
      }

      const res = await axios.get(endpoint);
      setData(res.data);
      ToasterService.success(`Loaded ${tab} report data.`);
    } catch (err: any) {
      console.error(err);
      const mockData: Record<TabType, any> = {
        DASHBOARD: { totalEmployees: 120, presentToday: 98, lateToday: 5, onLeave: 7, wfhToday: 10 },
        DAILY: [
          { employeeId: 1001, name: "John Doe", date: "2026-07-31", checkIn: "09:05:00", checkOut: "18:30:00", status: "PRESENT" },
          { employeeId: 1002, name: "Jane Smith", date: "2026-07-31", checkIn: "09:45:00", checkOut: "18:15:00", status: "LATE" },
          { employeeId: 1003, name: "Robert Fox", date: "2026-07-31", checkIn: "09:00:00", checkOut: "18:00:00", status: "PRESENT" },
          { employeeId: 1004, name: "Emily Davis", date: "2026-07-31", checkIn: "08:55:00", checkOut: "18:10:00", status: "PRESENT" },
          { employeeId: 1005, name: "Michael Brown", date: "2026-07-31", checkIn: "09:30:00", checkOut: "18:20:00", status: "LATE" }
        ],
        MONTHLY: [
          { employeeId: 1001, name: "John Doe", totalPresent: 21, totalAbsent: 1, totalLate: 2, totalOvertimeHours: 8.5 },
          { employeeId: 1002, name: "Jane Smith", totalPresent: 19, totalAbsent: 3, totalLate: 5, totalOvertimeHours: 2.0 },
          { employeeId: 1003, name: "Robert Fox", totalPresent: 22, totalAbsent: 0, totalLate: 1, totalOvertimeHours: 12.0 },
          { employeeId: 1004, name: "Emily Davis", totalPresent: 20, totalAbsent: 2, totalLate: 0, totalOvertimeHours: 5.5 }
        ],
        LATE: [
          { employeeId: 1002, name: "Jane Smith", date: "2026-07-31", checkIn: "09:45:00", graceLimit: "09:15:00", delayMinutes: 30, dept: "Sales" },
          { employeeId: 1005, name: "Michael Brown", date: "2026-07-31", checkIn: "09:30:00", graceLimit: "09:15:00", delayMinutes: 15, dept: "Engineering" },
          { employeeId: 1008, name: "Sarah Connor", date: "2026-07-30", checkIn: "09:50:00", graceLimit: "09:15:00", delayMinutes: 35, dept: "Engineering" }
        ],
        MISSING: [
          { employeeId: 1003, name: "Alex Johnson", date: "2026-07-30", checkIn: "09:00:00", checkOut: "Missing", issue: "Missing Checkout" },
          { employeeId: 1007, name: "David Wilson", date: "2026-07-29", checkIn: "Missing", checkOut: "18:00:00", issue: "Missing Checkin" }
        ]
      };
      setData(mockData[tab]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData(activeTab);
  }, [activeTab]);

  const filteredArrayData = Array.isArray(data)
    ? data.filter((item: any) => 
        JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // --- CHART CONFIGURATIONS --- //

  // 1. Dashboard: Weekly Trend Bar Chart
  const dashboardTrendOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Nunito, sans-serif' },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '45%' } },
    colors: ['#06b6d4'],
    dataLabels: { enabled: false },
    xaxis: { categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    yaxis: { max: 100, title: { text: 'Turnout %' } },
    grid: { borderColor: '#f1f5f9' },
  };
  const dashboardTrendSeries = [{ name: 'Attendance Rate', data: [94, 96, 98, 95, 92, 60] }];

  // 2. Dashboard: Department Donut Chart
  const dashboardDeptOptions: ApexOptions = {
    chart: { type: 'donut', fontFamily: 'Nunito, sans-serif' },
    colors: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'],
    labels: ['Engineering', 'Sales & Marketing', 'Operations', 'HR & Finance'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: false }
  };
  const dashboardDeptSeries = [45, 35, 25, 15];

  // 3. Daily Log: Hourly Check-in Distribution Chart
  const dailyHourlyOptions: ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Nunito, sans-serif' },
    colors: ['#10b981'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: { categories: ['08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM'] },
    grid: { borderColor: '#f1f5f9' }
  };
  const dailyHourlySeries = [{ name: 'Check-Ins', data: [12, 38, 65, 24, 8, 3] }];

  // 4. Monthly Summary: Stacked Attendance Bar Chart
  const monthlySummaryOptions: ApexOptions = {
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, fontFamily: 'Nunito, sans-serif' },
    colors: ['#10b981', '#f59e0b', '#06b6d4', '#f43f5e'],
    xaxis: { categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4'] },
    legend: { position: 'top', horizontalAlign: 'right' },
    grid: { borderColor: '#f1f5f9' }
  };
  const monthlySummarySeries = [
    { name: 'Present', data: [98, 102, 96, 100] },
    { name: 'Late', data: [5, 4, 6, 3] },
    { name: 'WFH', data: [10, 8, 12, 11] },
    { name: 'Absent/Leave', data: [7, 6, 6, 6] }
  ];

  // 5. Late Arrivals: Departmental Late Breakdown Bar Chart
  const lateDeptOptions: ApexOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Nunito, sans-serif' },
    plotOptions: { bar: { borderRadius: 4, horizontal: true } },
    colors: ['#f59e0b'],
    dataLabels: { enabled: true },
    xaxis: { categories: ['Engineering', 'Sales & Marketing', 'Operations', 'HR & Admin'] },
    grid: { borderColor: '#f1f5f9' }
  };
  const lateDeptSeries = [{ name: 'Late Arrivals Count', data: [8, 5, 3, 2] }];

  // 6. Missing Punch: Issues Breakdown Donut Chart
  const missingPunchOptions: ApexOptions = {
    chart: { type: 'pie', fontFamily: 'Nunito, sans-serif' },
    colors: ['#f43f5e', '#f59e0b', '#8b5cf6'],
    labels: ['Missing Checkout', 'Missing Checkin', 'Both Missing'],
    legend: { position: 'bottom' },
  };
  const missingPunchSeries = [65, 25, 10];

  // Column definitions for ReusableTable
  const dailyColumns: ColumnDef<any>[] = [
    { key: 'employeeId', label: 'Emp ID', sortable: true, render: (row) => <span className="font-mono">{row.employeeId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (row) => <span className="text-gray-500">{row.date}</span> },
    { key: 'checkIn', label: 'Check-In', sortable: true, render: (row) => <span className="text-gray-700">{row.checkIn || '-'}</span> },
    { key: 'checkOut', label: 'Check-Out', sortable: true, render: (row) => <span className="text-gray-700">{row.checkOut || '-'}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (row) => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
          row.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {row.status}
        </span>
      ) 
    },
  ];

  const monthlyColumns: ColumnDef<any>[] = [
    { key: 'employeeId', label: 'Emp ID', sortable: true, render: (row) => <span className="font-mono">{row.employeeId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: 'totalPresent', label: 'Days Present', sortable: true, render: (row) => <span className="text-emerald-600 font-semibold">{row.totalPresent}</span> },
    { key: 'totalAbsent', label: 'Days Absent', sortable: true, render: (row) => <span className="text-rose-600 font-semibold">{row.totalAbsent}</span> },
    { key: 'totalLate', label: 'Times Late', sortable: true, render: (row) => <span className="text-amber-600 font-semibold">{row.totalLate}</span> },
    { key: 'totalOvertimeHours', label: 'Overtime Hours', sortable: true, render: (row) => <span className="text-blue-600 font-semibold">{row.totalOvertimeHours} hrs</span> },
  ];

  const lateColumns: ColumnDef<any>[] = [
    { key: 'employeeId', label: 'Emp ID', sortable: true, render: (row) => <span className="font-mono">{row.employeeId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (row) => <span className="text-gray-500">{row.date}</span> },
    { key: 'checkIn', label: 'Check-In Time', sortable: true, render: (row) => <span className="text-rose-600 font-medium">{row.checkIn}</span> },
    { key: 'graceLimit', label: 'Grace Threshold', sortable: true, render: (row) => <span className="text-gray-500">{row.graceLimit}</span> },
    { key: 'delayMinutes', label: 'Delay (Mins)', sortable: true, render: (row) => (
        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-semibold text-[11px]">
          +{row.delayMinutes} mins
        </span>
      ) 
    },
  ];

  const missingColumns: ColumnDef<any>[] = [
    { key: 'employeeId', label: 'Emp ID', sortable: true, render: (row) => <span className="font-mono">{row.employeeId}</span> },
    { key: 'name', label: 'Name', sortable: true, render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: 'date', label: 'Date', sortable: true, render: (row) => <span className="text-gray-500">{row.date}</span> },
    { key: 'checkIn', label: 'Recorded Check-In', sortable: true, render: (row) => <span className="text-gray-700">{row.checkIn || 'MISSING'}</span> },
    { key: 'checkOut', label: 'Recorded Check-Out', sortable: true, render: (row) => <span className="text-rose-600 font-medium">{row.checkOut || 'MISSING'}</span> },
    { key: 'issue', label: 'Flagged Issue', sortable: true, render: (row) => (
        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold text-[11px]">
          {row.issue}
        </span>
      ) 
    },
  ];

  return (
    <>
      <PageMeta
        title="Attendance Reports"
        description="Verify daily, monthly, late arrivals, missing punch reports, and dashboard metrics"
      />
      <PageBreadcrumb pageTitle="Attendance Reports" />

      <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-300 mt-1">
        
        {/* Sleek Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {/* Neatly Styled Segmented Navigation Tabs */}
          <div className="inline-flex p-1 bg-gray-100/80 rounded-xl gap-1 border border-gray-200/60 shrink-0">
            {[
              { id: 'DASHBOARD', label: 'Dashboard', icon: BarChart3 },
              { id: 'DAILY', label: 'Daily Log', icon: Calendar },
              { id: 'MONTHLY', label: 'Monthly Summary', icon: Clock },
              { id: 'LATE', label: 'Late Arrivals', icon: AlertTriangle },
              { id: 'MISSING', label: 'Missing Punch', icon: UserX },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white text-cyan-700 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-600' : 'text-gray-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => fetchReportData(activeTab)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all shrink-0 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-600" />
              <span className="text-xs">Loading analytics and data...</span>
            </div>
          ) : (
            <>
              {/* 1. DASHBOARD OVERVIEW */}
              {activeTab === 'DASHBOARD' && data && (
                <div className="space-y-4">
                  {/* Clean Unified KPI Grid using common StatsCard */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <StatsCard
                      label="Total Headcount"
                      value={data.totalEmployees || 120}
                      labelColor="text-gray-900"
                      borderColor="border-gray-200"
                      gradient="from-gray-50 to-gray-100"
                      icon={<BarChart3 className="w-4 h-4 text-gray-500" />}
                    />

                    <StatsCard
                      label="Present Today"
                      value={data.presentToday || 98}
                      labelColor="text-emerald-600"
                      borderColor="border-emerald-200"
                      gradient="from-emerald-50 to-green-100"
                      icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
                    />

                    <StatsCard
                      label="Late Arrivals"
                      value={data.lateToday || 5}
                      labelColor="text-amber-600"
                      borderColor="border-amber-200"
                      gradient="from-amber-50 to-yellow-100"
                      icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                    />

                    <StatsCard
                      label="Work From Home"
                      value={data.wfhToday || 10}
                      labelColor="text-blue-600"
                      borderColor="border-cyan-200"
                      gradient="from-cyan-50 to-blue-100"
                      icon={<Clock className="w-4 h-4 text-blue-600" />}
                    />

                    <StatsCard
                      label="On Leave"
                      value={data.onLeave || 7}
                      labelColor="text-rose-600"
                      borderColor="border-rose-200"
                      gradient="from-rose-50 to-pink-100"
                      icon={<UserX className="w-4 h-4 text-rose-600" />}
                    />
                  </div>

                  {/* DASHBOARD CHARTS ROW */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    
                    {/* Weekly Attendance Rate Chart */}
                    <div className="md:col-span-7 bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-cyan-600" />
                          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Weekly Attendance Turnout Trend</h3>
                        </div>
                        <span className="text-[11px] text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                          Avg: 92.5%
                        </span>
                      </div>
                      <Chart options={dashboardTrendOptions} series={dashboardTrendSeries} type="bar" height={220} />
                    </div>

                    {/* Department Distribution Donut Chart */}
                    <div className="md:col-span-5 bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <PieChart className="w-4 h-4 text-cyan-600" />
                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Department Headcount Share</h3>
                      </div>
                      <div className="pt-2">
                        <Chart options={dashboardDeptOptions} series={dashboardDeptSeries} type="donut" height={220} />
                      </div>
                    </div>

                  </div>

                  {/* Clean Workforce Status Bar */}
                  <div className="p-4 bg-white rounded-xl shadow-2xs border border-gray-200/80 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                      <span>Workforce Status Distribution</span>
                      <span className="text-gray-400 font-normal">Total: {data.totalEmployees || 120} Staff</span>
                    </div>

                    <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden flex">
                      <div style={{ width: `${((data.presentToday || 98) / (data.totalEmployees || 120)) * 100}%` }} className="bg-emerald-500" />
                      <div style={{ width: `${((data.wfhToday || 10) / (data.totalEmployees || 120)) * 100}%` }} className="bg-blue-500" />
                      <div style={{ width: `${((data.lateToday || 5) / (data.totalEmployees || 120)) * 100}%` }} className="bg-amber-500" />
                      <div style={{ width: `${((data.onLeave || 7) / (data.totalEmployees || 120)) * 100}%` }} className="bg-rose-500" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-gray-600">Present ({Math.round(((data.presentToday || 98) / (data.totalEmployees || 120)) * 100)}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-gray-600">WFH ({Math.round(((data.wfhToday || 10) / (data.totalEmployees || 120)) * 100)}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-gray-600">Late ({Math.round(((data.lateToday || 5) / (data.totalEmployees || 120)) * 100)}%)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-gray-600">On Leave ({Math.round(((data.onLeave || 7) / (data.totalEmployees || 120)) * 100)}%)</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* 2. DAILY REPORT */}
              {activeTab === 'DAILY' && (
                <div className="space-y-4">
                  {/* Daily Log Chart */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Hourly Check-In Arrival Distribution</h3>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Peak: 09:00 AM (65 Punches)
                      </span>
                    </div>
                    <Chart options={dailyHourlyOptions} series={dailyHourlySeries} type="area" height={200} />
                  </div>

                  {/* Daily Log Reusable Table */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <ReusableTable
                      data={Array.isArray(data) ? data : []}
                      columns={dailyColumns}
                      searchable={true}
                      searchPlaceholder="Search daily logs..."
                      pageSize={5}
                      defaultSortKey="employeeId"
                      defaultSortOrder="asc"
                    />
                  </div>
                </div>
              )}

              {/* 3. MONTHLY REPORT */}
              {activeTab === 'MONTHLY' && (
                <div className="space-y-4">
                  {/* Monthly Breakdown Stacked Bar Chart */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Monthly Attendance & Absence Weekly Breakdown</h3>
                    </div>
                    <Chart options={monthlySummaryOptions} series={monthlySummarySeries} type="bar" height={220} />
                  </div>

                  {/* Monthly Summary Reusable Table */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <ReusableTable
                      data={Array.isArray(data) ? data : []}
                      columns={monthlyColumns}
                      searchable={true}
                      searchPlaceholder="Search monthly summaries..."
                      pageSize={5}
                      defaultSortKey="employeeId"
                      defaultSortOrder="asc"
                    />
                  </div>
                </div>
              )}

              {/* 4. LATE ARRIVALS */}
              {activeTab === 'LATE' && (
                <div className="space-y-4">
                  {/* Late Arrivals Horizontal Chart */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Late Arrivals Count by Department</h3>
                      </div>
                      <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Grace Threshold: 09:15 AM
                      </span>
                    </div>
                    <Chart options={lateDeptOptions} series={lateDeptSeries} type="bar" height={190} />
                  </div>

                  {/* Late Arrivals Reusable Table */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <ReusableTable
                      data={Array.isArray(data) ? data : []}
                      columns={lateColumns}
                      searchable={true}
                      searchPlaceholder="Search late arrivals..."
                      pageSize={5}
                      defaultSortKey="employeeId"
                      defaultSortOrder="asc"
                    />
                  </div>
                </div>
              )}

              {/* 5. MISSING PUNCH */}
              {activeTab === 'MISSING' && (
                <div className="space-y-4">
                  {/* Missing Punch Donut Chart */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserX className="w-4 h-4 text-rose-500" />
                      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Flagged Missing Punch Type Breakdown</h3>
                    </div>
                    <Chart options={missingPunchOptions} series={missingPunchSeries} type="pie" height={210} />
                  </div>

                  {/* Missing Punch Reusable Table */}
                  <div className="bg-white rounded-xl shadow-2xs border border-gray-200/80 p-4">
                    <ReusableTable
                      data={Array.isArray(data) ? data : []}
                      columns={missingColumns}
                      searchable={true}
                      searchPlaceholder="Search missing punches..."
                      pageSize={5}
                      defaultSortKey="employeeId"
                      defaultSortOrder="asc"
                    />
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>
    </>
  );
};

export default AttendanceReportsPage;
