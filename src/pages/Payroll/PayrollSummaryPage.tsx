import React, { useState, useEffect } from "react";
import axios from "axios";
import { ChartBarIcon, CalendarIcon, DocumentArrowDownIcon, BanknotesIcon, UsersIcon, CurrencyRupeeIcon } from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ToasterService } from "../../Services/ToasterService";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const PayrollSummaryPage: React.FC = () => {
    const [salaryMonth, setSalaryMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    
    const [overallSalarySummary, setOverallSalarySummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (salaryMonth) {
            fetchSummary();
        }
    }, [salaryMonth]);

    const fetchSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const summaryRes = await axios.get(`/v1/api/payroll/reports/getPayrollSummary`, { 
                params: { payrollMonth: salaryMonth } 
            });
            
            if (summaryRes.status === 200 || summaryRes.status === 201) {
                let data = summaryRes.data;
                if (Array.isArray(data)) {
                    if (data.length === 1 && typeof data[0] === 'object') {
                        data = data[0]; 
                    } else {
                        data = data.reduce((acc, curr) => {
                            if (typeof curr === 'object' && curr !== null) {
                                return { ...acc, ...curr };
                            }
                            return acc;
                        }, {});
                    }
                }
                setOverallSalarySummary(data);
            } else {
                throw new Error("Failed to fetch salary summary.");
            }
        } catch (err: any) {
            console.error("Failed to fetch salary summary:", err);
            setError("Failed to fetch salary summary. It may not be generated yet.");
            setOverallSalarySummary(null);
        } finally {
            setLoading(false);
        }
    };

    const handleExportDetailedReport = async () => {
        try {
            const response = await axios.get(`/v1/api/payroll/reports/getPayrollDetailReportByMonth`, {
                params: { payrollMonth: salaryMonth }
            });
            
            const data = response.data;
            if (!data || !Array.isArray(data) || data.length === 0) {
                ToasterService.warning("No detailed report data found for this month");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Detailed Report");
            XLSX.writeFile(wb, `Payroll_Detailed_Report_${salaryMonth}.xlsx`);
            
            ToasterService.success("Detailed report exported successfully");
        } catch (error) {
            console.error("Error exporting detailed report:", error);
            ToasterService.error("Failed to export detailed report");
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
            <PageMeta title="Payroll Summary" description="Overview of company payroll metrics" />
            <PageBreadcrumb pageTitle="Payroll Summary" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">
                
                {/* Header Area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payroll Summary</h2>
                        <p className="text-sm text-gray-500 mt-1">Comprehensive view of your organization's payroll metrics.</p>
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
                        <button
                            onClick={handleExportDetailedReport}
                            className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <DocumentArrowDownIcon className="h-5 w-5 text-green-600" />
                            Export Excel
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-sm text-gray-500 py-12 text-center">Loading summary...</div>
                ) : error ? (
                    <div className="text-sm text-red-500 py-12 text-center bg-red-50 rounded-xl">{error}</div>
                ) : (!overallSalarySummary || Object.keys(overallSalarySummary).length === 0) ? (
                    <div className="text-sm text-gray-400 py-16 text-center bg-gray-50 rounded-3xl border border-gray-200 shadow-inner flex flex-col items-center justify-center">
                        <ChartBarIcon className="h-16 w-16 text-gray-300 mb-6" />
                        <span className="font-medium text-lg text-gray-500">No summary data available for {salaryMonth}.</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Top 3 Metric Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-center">
                                <div className="p-3 rounded-full bg-blue-50 text-blue-600 mr-4">
                                    <CurrencyRupeeIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Total Gross</p>
                                    <p className="text-3xl font-semibold text-gray-900">{formatCurrency(overallSalarySummary.totalGrossSalary)}</p>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-center">
                                <div className="p-3 rounded-full bg-emerald-50 text-emerald-600 mr-4">
                                    <BanknotesIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Total Net</p>
                                    <p className="text-3xl font-semibold text-gray-900">{formatCurrency(overallSalarySummary.totalNetSalary)}</p>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex items-center">
                                <div className="p-3 rounded-full bg-purple-50 text-purple-600 mr-4">
                                    <UsersIcon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Employees</p>
                                    <p className="text-3xl font-semibold text-gray-900">{formatNumber(overallSalarySummary.totalEmployees)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                            {/* Salary Overview Bar Chart */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-6">Earnings vs Deductions</h3>
                                <div className="h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={[
                                                { name: 'Total Gross', value: overallSalarySummary.totalGrossSalary || 0 },
                                                { name: 'Net Salary', value: overallSalarySummary.totalNetSalary || 0 },
                                                { name: 'Deductions', value: overallSalarySummary.totalDeductions || 0 }
                                            ]}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `₹${val/1000}k`} />
                                            <Tooltip 
                                                formatter={(value: number) => formatCurrency(value)}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                                                {
                                                    [0, 1, 2].map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#06b6d4' : index === 1 ? '#10b981' : '#f43f5e'} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Deductions Breakdown Pie Chart */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-medium text-gray-900 mb-6">Deductions Breakdown</h3>
                                <div className="h-80 w-full flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'PF (Employee)', value: overallSalarySummary.totalPfEmployee || 0 },
                                                    { name: 'TDS', value: overallSalarySummary.totalTds || 0 },
                                                    { name: 'Professional Tax', value: overallSalarySummary.totalProfessionalTax || 0 }
                                                ].filter(d => d.value > 0)}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={70}
                                                outerRadius={110}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill={COLORS[0]} />
                                                <Cell fill={COLORS[1]} />
                                                <Cell fill={COLORS[2]} />
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value: number) => formatCurrency(value)}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Secondary Metrics Grid */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6 shadow-sm">
                            <h3 className="text-base font-medium text-gray-900 mb-6">Detailed Breakdown</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Earnings</div>
                                    <div className="text-xl font-medium text-gray-900">{formatCurrency(overallSalarySummary.totalEarnings)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Deductions</div>
                                    <div className="text-xl font-medium text-gray-900">{formatCurrency(overallSalarySummary.totalDeductions)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">PF (Employee)</div>
                                    <div className="text-xl font-medium text-gray-900">{formatCurrency(overallSalarySummary.totalPfEmployee)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">PF (Employer)</div>
                                    <div className="text-xl font-medium text-gray-900">{formatCurrency(overallSalarySummary.totalPfEmployer)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">TDS</div>
                                    <div className="text-xl font-medium text-gray-900">{formatCurrency(overallSalarySummary.totalTds)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Professional Tax</div>
                                    <div className="text-xl font-medium text-gray-900">{formatCurrency(overallSalarySummary.totalProfessionalTax)}</div>
                                </div>
                                
                                {overallSalarySummary.totalWorkingDays !== undefined && (
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Working Days</div>
                                        <div className="text-xl font-medium text-gray-900">{formatNumber(overallSalarySummary.totalWorkingDays)}</div>
                                    </div>
                                )}
                                {overallSalarySummary.totalLossOfPayDays !== undefined && (
                                    <div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Loss of Pay Days</div>
                                        <div className="text-xl font-medium text-gray-900">{formatNumber(overallSalarySummary.totalLossOfPayDays)}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default PayrollSummaryPage;
