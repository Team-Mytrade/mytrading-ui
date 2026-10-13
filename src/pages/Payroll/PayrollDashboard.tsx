import React, { useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Building2,
  DollarSign,
  UserCheck,
  CreditCard,
  FileText,
  TrendingUp,
  FolderOpen,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  UserPlus,
  UserMinus,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  CHART_COLORS, CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  countOf, formatDate, formatMoney, formatNumber, getList, isoDate, listOf, parseDate, titleCase, useDashboardSources,
} from "../Dashboard/dashboardKit";

// Live HRMS and payroll overview built from the payroll service.

interface Employee {
  id: number;
  department?: { id?: number; name?: string } | null;
  joiningDate?: string;
  exitDate?: string;
  active?: boolean;
  isActive?: boolean;
  salary?: unknown;
}

interface PayrollBatch {
  batchReference?: string;
  salaryMonth?: string | [number, number];
  employeeCount?: number;
  totalSalaryAmount?: number;
  status?: string;
  startDate?: string;
  completedDate?: string;
}

interface DepartmentSummary {
  departmentName?: string;
  totalEmployees?: number;
  totalNetSalary?: number;
}

const PAYROLL = "/v1/api/payroll";

/** salaryMonth arrives as "2026-06" (or [2026, 6] if dates are written as arrays). */
const monthOf = (batch: PayrollBatch) => {
  const m = batch.salaryMonth;
  if (Array.isArray(m)) return `${m[0]}-${String(m[1]).padStart(2, "0")}`;
  return String(m ?? "").slice(0, 7);
};
const monthLabel = (key: string, withYear = false) => {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key || "—";
  return new Date(y, m - 1, 1).toLocaleString(undefined, withYear ? { month: "long", year: "numeric" } : { month: "short" });
};

const SOURCES = {
  employees: () => getList<Employee>(`${PAYROLL}/employee/all`),
  departments: () => countOf(`${PAYROLL}/department/listAll`),
  // Payroll runs, plus the department split of the latest completed run
  payroll: async () => {
    const batches = await getList<PayrollBatch>(`${PAYROLL}/getPayrollBatchInfo`);
    const latest = [...batches].filter((b) => b.status === "COMPLETED").sort((a, b) => monthOf(b).localeCompare(monthOf(a)))[0];
    let byDepartment: DepartmentSummary[] = [];
    if (latest) {
      try {
        const { data } = await axios.get(`${PAYROLL}/reports/department-summary`, { params: { payrollMonth: monthOf(latest) } });
        byDepartment = listOf<DepartmentSummary>(data);
      } catch {
        byDepartment = []; // the chart falls back to headcount by department
      }
    }
    return { batches, latest, byDepartment };
  },
  structures: () => countOf(`${PAYROLL}/salary-structures`),
  documents: () => countOf(`${PAYROLL}/empdocuments/getAllEmployeeDocs`),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  employees: "employees",
  departments: "departments",
  payroll: "payroll runs",
  structures: "salary structures",
  documents: "employee documents",
};

const isActive = (e: Employee) => (e.active ?? e.isActive) !== false;

const PayrollHrmsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { loading, data, failed } = useDashboardSources(SOURCES, LABELS);

  const employees = (data.employees as Employee[] | undefined) ?? [];
  const payroll = data.payroll as { batches: PayrollBatch[]; latest?: PayrollBatch; byDepartment: DepartmentSummary[] } | undefined;
  const batches = payroll?.batches ?? [];
  const latest = payroll?.latest;
  const departments = typeof data.departments === "number" ? data.departments : null;
  const active = employees.filter(isActive);

  const today = new Date();
  const monthKey = isoDate(today).slice(0, 7);
  const in30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);

  const trend = useMemo(() => {
    const byMonth = new Map<string, PayrollBatch>();
    batches.filter((b) => b.status === "COMPLETED").forEach((b) => byMonth.set(monthOf(b), b));
    return [...byMonth.keys()].sort().slice(-6).map((key) => ({
      month: monthLabel(key),
      amount: Number(byMonth.get(key)?.totalSalaryAmount) || 0,
      employees: Number(byMonth.get(key)?.employeeCount) || 0,
    }));
  }, [batches]);

  // Net payroll per department for the latest run; headcount per department when there is no run yet
  const departmentChart = useMemo(() => {
    if (payroll?.byDepartment?.length) {
      return payroll.byDepartment
        .map((d) => ({ name: d.departmentName || "Unassigned", value: Number(d.totalNetSalary) || 0, count: Number(d.totalEmployees) || 0 }))
        .sort((a, b) => b.value - a.value).slice(0, 6);
    }
    const byDept = new Map<string, number>();
    active.forEach((e) => {
      const name = e.department?.name || "Unassigned";
      byDept.set(name, (byDept.get(name) ?? 0) + 1);
    });
    return [...byDept.entries()].map(([name, count]) => ({ name, value: count, count })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [payroll, active]);
  const departmentChartIsMoney = Boolean(payroll?.byDepartment?.length);

  const recentRuns = [...batches].sort((a, b) => monthOf(b).localeCompare(monthOf(a)) || String(b.startDate ?? "").localeCompare(String(a.startDate ?? ""))).slice(0, 4);

  const attention = [
    { title: "Salary not set", count: active.filter((e) => !e.salary).length, icon: CreditCard, tone: "text-blue-600 bg-blue-50", route: "/employeeSalary" },
    { title: "No department", count: active.filter((e) => !e.department).length, icon: Building2, tone: "text-orange-600 bg-orange-50", route: "/employeeRecords" },
    { title: "Joined this month", count: employees.filter((e) => String(e.joiningDate ?? "").slice(0, 7) === monthKey).length, icon: UserPlus, tone: "text-emerald-600 bg-emerald-50", route: "/employeeRecords" },
    {
      title: "Leaving in 30 days",
      count: employees.filter((e) => {
        const exit = parseDate(e.exitDate);
        return exit !== null && exit >= new Date(today.getFullYear(), today.getMonth(), today.getDate()) && exit <= in30Days;
      }).length,
      icon: UserMinus, tone: "text-purple-600 bg-purple-50", route: "/exit-management",
    },
  ];

  const count = (key: "structures" | "documents") => (typeof data[key] === "number" ? (data[key] as number) : null);
  const tiles = [
    { name: "Employee Records", count: data.employees ? employees.length : null, icon: Users, route: "/employeeRecords", tone: "blue" as const },
    { name: "Departments", count: departments, icon: Building2, route: "/employeeDepartments", tone: "emerald" as const },
    { name: "Compensation", icon: DollarSign, route: "/employeeCompensation", tone: "orange" as const },
    { name: "Employee Salary", count: data.employees ? active.filter((e) => e.salary).length : null, icon: CreditCard, route: "/employeeSalary", tone: "purple" as const },
    { name: "Salary Structure", count: count("structures"), icon: FileText, route: "/salaryStructure", tone: "indigo" as const },
    { name: "Payslips", icon: Calendar, route: "/employeePayslips", tone: "pink" as const },
    { name: "Payroll Summary", icon: BarChart3, route: "/payrollSummary", tone: "teal" as const },
    { name: "Documents", count: count("documents"), icon: FolderOpen, route: "/employeeDocuments", tone: "red" as const },
  ];

  const latestMonth = latest ? monthOf(latest) : "";
  const latestTotal = Number(latest?.totalSalaryAmount) || 0;
  const latestCount = Number(latest?.employeeCount) || 0;

  return (
    <>
      <PageMeta title="HRMS Dashboard" description="Payroll and employee overview" />
      <PageBreadcrumb pageTitle="HRMS Dashboard" />

      <div className="mx-auto max-w-7xl p-6">
        <LoadNotice failed={failed} />
        <ModuleTiles tiles={tiles} loading={loading} />

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Active Employees" value={data.employees ? formatNumber(active.length) : "—"} hint={data.employees ? `${formatNumber(employees.length)} on record` : undefined} icon={Users} tone="blue" loading={loading} />
          <KpiCard label="Monthly Payroll" value={latest ? formatMoney(latestTotal, "INR", true) : "—"} hint={latest ? `Last run: ${monthLabel(latestMonth, true)}` : "No completed payroll run yet"} icon={TrendingUp} tone="emerald" loading={loading} />
          <KpiCard label="Avg Salary" value={latest && latestCount ? formatMoney(latestTotal / latestCount) : "—"} hint={latest ? `${formatNumber(latestCount)} employees paid` : undefined} icon={DollarSign} tone="orange" loading={loading} />
          <KpiCard label="Departments" value={departments === null ? "—" : formatNumber(departments)} icon={Building2} tone="purple" loading={loading} />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Payroll Trend" subtitle="Completed payroll runs (last 6)" icon={TrendingUp} iconClass="text-emerald-500">
            {trend.length === 0 ? (
              <EmptyState loading={loading}>No completed payroll runs yet.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="payrollGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => formatMoney(Number(v), "INR", true)} width={70} />
                  <Tooltip contentStyle={CHART_TOOLTIP}
                    formatter={(value, _name, item) => [`${formatMoney(Number(value))} · ${item?.payload?.employees ?? 0} employees`, "Payroll"]} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#payrollGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="By Department" subtitle={departmentChartIsMoney ? `Net payroll, ${monthLabel(latestMonth, true)}` : "Active employees per department"} icon={Building2} iconClass="text-cyan-500">
            {departmentChart.length === 0 ? (
              <EmptyState loading={loading}>No employees yet.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={departmentChart} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false}
                    tickFormatter={(v) => (departmentChartIsMoney ? formatMoney(Number(v), "INR", true) : String(v))} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={100} />
                  <Tooltip contentStyle={CHART_TOOLTIP}
                    formatter={(value, _name, item) => departmentChartIsMoney
                      ? [`${formatMoney(Number(value))} · ${item?.payload?.count ?? 0} employees`, "Net payroll"]
                      : [value, "Employees"]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {departmentChart.map((d, index) => <Cell key={d.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Recent Payroll Runs" subtitle="Latest batches from the payroll engine" bodyClass="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className={TABLE_HEAD}>Month</th>
                  <th className={TABLE_HEAD}>Processed</th>
                  <th className={TABLE_HEAD}>Total</th>
                  <th className={TABLE_HEAD}>Employees</th>
                  <th className={TABLE_HEAD}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentRuns.length === 0 && (
                  <tr><td colSpan={5} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : "No payroll runs yet."}</td></tr>
                )}
                {recentRuns.map((run) => (
                  <tr key={run.batchReference ?? monthOf(run)} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{monthLabel(monthOf(run), true)}</td>
                    <td className={TABLE_CELL}>{formatDate(run.completedDate || run.startDate)}</td>
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>
                      {run.status !== "COMPLETED" && !Number(run.totalSalaryAmount) ? "—" : formatMoney(Number(run.totalSalaryAmount) || 0, "INR", true)}
                    </td>
                    <td className={TABLE_CELL}>{formatNumber(Number(run.employeeCount) || 0)}</td>
                    <td className={TABLE_CELL}>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${run.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {run.status === "COMPLETED" ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {titleCase(run.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Needs Attention" subtitle="From the employee records" icon={AlertCircle} iconClass="text-amber-500">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attention.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.title} type="button" onClick={() => navigate(item.route)}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 text-left transition hover:shadow-sm dark:border-gray-800">
                    <div className={`rounded-lg p-2 ${item.tone}`}><Icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{loading ? "…" : data.employees ? formatNumber(item.count) : "—"}</p>
                      <p className="text-xs text-gray-500">{item.title}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1 text-xs text-gray-400">
              <UserCheck className="h-3.5 w-3.5" /> Salary and department counts cover active employees only.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
};

export default PayrollHrmsDashboard;
