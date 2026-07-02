import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { CalendarIcon, BuildingOfficeIcon, UserGroupIcon, CurrencyRupeeIcon } from "@heroicons/react/24/outline";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

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
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-center">
                                <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
                                    <BuildingOfficeIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Total Departments</p>
                                    <p className="text-2xl font-bold text-gray-900">{departmentSummary.length}</p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-center">
                                <div className="p-3 rounded-full bg-emerald-50 text-emerald-600 mr-4">
                                    <UserGroupIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Total Employees</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {formatNumber(departmentSummary.reduce((sum, d) => sum + (d.employeeCount || d.totalEmployees || 0), 0))}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-center">
                                <div className="p-3 rounded-full bg-purple-50 text-purple-600 mr-4">
                                    <CurrencyRupeeIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Total Payroll Cost (Gross)</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {formatCurrency(departmentSummary.reduce((sum, d) => sum + (d.totalGrossSalary || d.grossSalary || 0), 0))}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Bar Chart */}
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-6">Salary Breakdown by Department</h3>
                                <div className="h-80 w-full">
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
                                                formatter={(value: number) => formatCurrency(value)}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="Gross" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                            <Bar dataKey="Net" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Pie Chart */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-6">Employee Distribution</h3>
                                <div className="h-80 w-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={departmentSummary.map(d => ({
                                                    name: d.departmentName || d.department || 'Unknown',
                                                    value: d.employeeCount || d.totalEmployees || 0
                                                })).filter(d => d.value > 0)}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {departmentSummary.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value: number) => [value, 'Employees']}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-base font-medium text-gray-900">Department Breakdown</h3>
                            <span className="text-sm text-gray-500">
                                {departmentSummary.length} Departments
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Department</th>
                                        <th className="px-6 py-4 font-semibold text-right">Employees</th>
                                        <th className="px-6 py-4 font-semibold text-right">Total Gross</th>
                                        <th className="px-6 py-4 font-semibold text-right">Total Deductions</th>
                                        <th className="px-6 py-4 font-semibold text-right">Net Salary</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {departmentSummary.map((dept, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-gray-900">
                                                {dept.departmentName || dept.department || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">{formatNumber(dept.employeeCount || dept.totalEmployees)}</td>
                                            <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(dept.totalGrossSalary || dept.grossSalary)}</td>
                                            <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(dept.totalDeductions || dept.deductions)}</td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(dept.totalNetSalary || dept.netSalary)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default DepartmentSummaryPage;
