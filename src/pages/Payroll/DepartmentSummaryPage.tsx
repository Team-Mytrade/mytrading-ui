import React, { useState, useEffect } from "react";
import axios from "axios";
import { BuildingOfficeIcon, ChartBarIcon, UserGroupIcon, CurrencyRupeeIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Table from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { CARD, CARD_TITLE, PAGE_BODY, STATS_ROW, TOOL_INPUT } from "./hrmsUi";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const DepartmentSummaryPage: React.FC = () => {
    const [salaryMonth, setSalaryMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [departmentSummary, setDepartmentSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (salaryMonth) {
            fetchDepartmentSummary();
        }
    }, [salaryMonth]);

    const fetchDepartmentSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const deptRes = await axios.get(`/v1/api/payroll/reports/department-summary`, {
                params: { payrollMonth: salaryMonth }
            });

            if (deptRes.status === 200 || deptRes.status === 201) {
                const data = deptRes.data;
                setDepartmentSummary(Array.isArray(data) ? data : []);
            } else {
                throw new Error("Failed to fetch department summary.");
            }
        } catch (err: any) {
            console.error("Failed to fetch department summary:", err);
            setError("Failed to fetch department summary.");
            setDepartmentSummary([]);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: any) => {
        if (val === null || val === undefined || isNaN(val)) return '₹0';
        return `₹${Number(val).toLocaleString('en-IN')}`;
    };

    const formatNumber = (val: any) => {
        if (val === null || val === undefined || isNaN(val)) return '0';
        return Number(val).toLocaleString('en-IN');
    };

    const totalEmployees = departmentSummary.reduce((sum, d) => sum + (d.employeeCount || d.totalEmployees || 0), 0);
    const totalGross = departmentSummary.reduce((sum, d) => sum + (d.totalGrossSalary || d.grossSalary || 0), 0);
    const totalNet = departmentSummary.reduce((sum, d) => sum + (d.totalNetSalary || d.netSalary || 0), 0);

    return (
        <>
            <PageMeta title="Department Summary" description="Overview of department-wise payroll metrics" />
            <PageBreadcrumb
                pageTitle="Department Summary"
                actions={
                    <input
                        type="month"
                        value={salaryMonth}
                        onChange={(e) => setSalaryMonth(e.target.value)}
                        className={TOOL_INPUT}
                        aria-label="Payroll month"
                    />
                }
            />

            <div className={PAGE_BODY}>
                {loading ? (
                    <div className={`${CARD} py-12 text-center text-sm text-gray-500 dark:text-gray-400`}>Loading department summary...</div>
                ) : error || departmentSummary.length === 0 ? (
                    <div className={`${CARD} flex flex-col items-center justify-center py-14 text-center`}>
                        <ChartBarIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                        <p className="text-sm text-gray-500 dark:text-slate-400">{error || `No department summary data available for ${salaryMonth}.`}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className={STATS_ROW}>
                            <StatsCard label="Departments" value={departmentSummary.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<BuildingOfficeIcon className="h-5 w-5" />} />
                            <StatsCard label="Employees" value={formatNumber(totalEmployees)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<UserGroupIcon className="h-5 w-5" />} />
                            <StatsCard label="Payroll Cost (Gross)" value={formatCurrency(totalGross)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<CurrencyRupeeIcon className="h-5 w-5" />} />
                            <StatsCard label="Net Paid" value={formatCurrency(totalNet)} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-5 w-5" />} onRefresh={fetchDepartmentSummary} />
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            {/* Bar Chart */}
                            <div className={`${CARD} p-4 lg:col-span-2`}>
                                <h3 className={`${CARD_TITLE} mb-4`}>Salary Breakdown by Department</h3>
                                <div className="h-80 w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
                                    <div style={{ minWidth: `${Math.max(100, departmentSummary.length * 15)}%`, height: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={departmentSummary.map(d => ({
                                                    name: d.departmentName || d.department || 'Unknown',
                                                    Gross: d.totalGrossSalary || d.grossSalary || 0,
                                                    Net: d.totalNetSalary || d.netSalary || 0
                                                }))}
                                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-[#2a2a2a]" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                                                <Tooltip
                                                    formatter={(value: any) => formatCurrency(value)}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                <Bar dataKey="Gross" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                                <Bar dataKey="Net" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Pie Chart */}
                            <div className={`${CARD} p-4`}>
                                <h3 className={`${CARD_TITLE} mb-4`}>Employee Distribution</h3>
                                <div className="flex h-80 w-full items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={departmentSummary.map(d => ({
                                                    name: d.departmentName || d.department || 'Unknown',
                                                    value: d.employeeCount || d.totalEmployees || 0
                                                })).filter(d => d.value > 0)}
                                                cx="50%"
                                                cy="45%"
                                                innerRadius={60}
                                                outerRadius={95}
                                                paddingAngle={5}
                                                dataKey="value"
                                                nameKey="name"
                                            >
                                                {departmentSummary.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(value: any) => [value, 'Employees']}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend
                                                content={(props: any) => {
                                                    const { payload } = props;
                                                    return (
                                                        <ul className="custom-scrollbar mt-4 flex max-h-24 flex-wrap justify-center gap-2 overflow-y-auto p-2 text-xs text-gray-600 dark:text-gray-400">
                                                            {payload.map((entry: any, index: number) => (
                                                                <li key={`item-${index}`} className="flex items-center whitespace-nowrap">
                                                                    <span className="mr-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                                                    {entry.value}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    );
                                                }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Data Table Section */}
                        <Table
                            data={departmentSummary.map((d, i) => ({ ...d, id: d.id || i }))}
                            columns={[
                                { key: "departmentName", label: "Department", render: (row: any) => <span className="text-sm font-semibold text-slate-900 dark:text-white">{row.departmentName || row.department || 'Unknown'}</span> },
                                { key: "employeeCount", label: "Employees", render: (row: any) => formatNumber(row.employeeCount || row.totalEmployees), className: "text-right text-slate-600 dark:text-slate-300", headerClassName: "text-right" },
                                { key: "totalGrossSalary", label: "Total Gross", render: (row: any) => formatCurrency(row.totalGrossSalary || row.grossSalary), className: "text-right text-slate-700 dark:text-slate-300", headerClassName: "text-right" },
                                { key: "totalDeductions", label: "Total Deductions", render: (row: any) => formatCurrency(row.totalDeductions || row.deductions), className: "text-right text-slate-700 dark:text-slate-300", headerClassName: "text-right" },
                                { key: "totalNetSalary", label: "Net Salary", render: (row: any) => formatCurrency(row.totalNetSalary || row.netSalary), className: "text-right font-semibold text-slate-900 dark:text-white", headerClassName: "text-right" },
                            ]}
                            searchable={false}
                        />
                    </div>
                )}
            </div>
        </>
    );
};

export default DepartmentSummaryPage;
