import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { CalendarIcon, BuildingOfficeIcon, UserGroupIcon, CurrencyRupeeIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Table, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";

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

    return (
        <>
            <PageMeta title="Department Summary" description="Overview of department-wise payroll metrics" />
            <PageBreadcrumb pageTitle="Department Summary" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">
                
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Department Summary</h2>
                        <p className="text-sm text-gray-500 mt-1">Detailed view of payroll metrics broken down by department.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg shadow-sm">
                            <CalendarIcon className="h-5 w-5 text-gray-400" />
                            <input
                                type="month"
                                value={salaryMonth}
                                onChange={(e) => setSalaryMonth(e.target.value)}
                                className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-sm text-gray-500 py-12 text-center">Loading department summary...</div>
                ) : error ? (
                    <div className="text-sm text-red-500 py-12 text-center bg-red-50 rounded-xl">{error}</div>
                ) : departmentSummary.length === 0 ? (
                    <div className="text-sm text-gray-400 py-16 text-center bg-gray-50 rounded-3xl border border-gray-200 shadow-inner">
                        No department summary data available for {salaryMonth}.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatsCard
                                label="Total Departments"
                                value={departmentSummary.length}
                                gradient="from-cyan-50 to-blue-50"
                                borderColor="border-cyan-100"
                                labelColor="text-cyan-600"
                                icon={<BuildingOfficeIcon className="h-6 w-6" />}
                            />
                            <StatsCard
                                label="Total Employees"
                                value={formatNumber(departmentSummary.reduce((sum, d) => sum + (d.employeeCount || d.totalEmployees || 0), 0))}
                                gradient="from-green-50 to-emerald-50"
                                borderColor="border-green-100"
                                labelColor="text-green-600"
                                icon={<UserGroupIcon className="h-6 w-6" />}
                            />
                            <StatsCard
                                label="Total Payroll Cost (Gross)"
                                value={formatCurrency(departmentSummary.reduce((sum, d) => sum + (d.totalGrossSalary || d.grossSalary || 0), 0))}
                                gradient="from-purple-50 to-pink-50"
                                borderColor="border-purple-100"
                                labelColor="text-purple-600"
                                icon={<CurrencyRupeeIcon className="h-6 w-6" />}
                            />
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Bar Chart */}
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-6">Salary Breakdown by Department</h3>
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
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `₹${val/1000}k`} />
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
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-6">Employee Distribution</h3>
                                <div className="h-96 w-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={departmentSummary.map(d => ({
                                                    name: d.departmentName || d.department || 'Unknown',
                                                    value: d.employeeCount || d.totalEmployees || 0
                                                })).filter(d => d.value > 0)}
                                                cx="50%"
                                                cy="45%"
                                                innerRadius={70}
                                                outerRadius={110}
                                                paddingAngle={5}
                                                dataKey="value"
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
                                                        <ul className="max-h-24 overflow-y-auto custom-scrollbar flex flex-wrap gap-2 justify-center p-2 mt-4 text-xs text-gray-600">
                                                            {payload.map((entry: any, index: number) => (
                                                                <li key={`item-${index}`} className="flex items-center whitespace-nowrap">
                                                                    <span className="w-3 h-3 rounded-full mr-1.5" style={{ backgroundColor: entry.color }}></span>
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
                        <div className="mt-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">Department Breakdown</h3>
                                    <p className="text-sm text-gray-500 mt-1">Detailed list of all departments and their payroll metrics.</p>
                                </div>
                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 text-sm font-medium">
                                    {departmentSummary.length} Departments
                                </span>
                            </div>
                            <Table 
                                data={departmentSummary.map((d, i) => ({ ...d, id: d.id || i }))}
                                columns={[
                                    { key: "departmentName", label: "Department", render: (row: any) => <span className="font-medium text-gray-900">{row.departmentName || row.department || 'Unknown'}</span> },
                                    { key: "employeeCount", label: "Employees", render: (row: any) => formatNumber(row.employeeCount || row.totalEmployees), className: "text-right text-gray-600", headerClassName: "text-right" },
                                    { key: "totalGrossSalary", label: "Total Gross", render: (row: any) => formatCurrency(row.totalGrossSalary || row.grossSalary), className: "text-right text-gray-900", headerClassName: "text-right" },
                                    { key: "totalDeductions", label: "Total Deductions", render: (row: any) => formatCurrency(row.totalDeductions || row.deductions), className: "text-right text-gray-900", headerClassName: "text-right" },
                                    { key: "totalNetSalary", label: "Net Salary", render: (row: any) => formatCurrency(row.totalNetSalary || row.netSalary), className: "text-right font-bold text-gray-900", headerClassName: "text-right" },
                                ]}
                                searchable={true}
                                searchPlaceholder="Search departments..."
                                searchFields={["departmentName", "department"]}
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default DepartmentSummaryPage;
