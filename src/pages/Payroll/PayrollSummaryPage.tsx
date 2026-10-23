import React, { useState, useEffect } from "react";
import axios from "axios";
import { ChartBarIcon, DocumentArrowDownIcon, BanknotesIcon, UsersIcon, CurrencyRupeeIcon } from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ToasterService } from "../../Services/ToasterService";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { usePermissions } from "../../access/usePermissions";
import { CARD, CARD_TITLE, PAGE_BODY, STATS_ROW, TOOL_BUTTON, TOOL_INPUT } from "./hrmsUi";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const PayrollSummaryPage: React.FC = () => {
  const { canExport } = usePermissions();
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
            <PageBreadcrumb
                pageTitle="Payroll Summary"
                actions={
                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={salaryMonth}
                            onChange={(e) => setSalaryMonth(e.target.value)}
                            className={TOOL_INPUT}
                            aria-label="Payroll month"
                        />
                        {canExport && (
                            <button type="button" onClick={handleExportDetailedReport} className={TOOL_BUTTON}>
                                <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                                Export Excel
                            </button>
                        )}
                    </div>
                }
            />

            <div className={PAGE_BODY}>
                {loading ? (
                    <div className={`${CARD} py-12 text-center text-sm text-gray-500 dark:text-gray-400`}>Loading summary...</div>
                ) : error || !overallSalarySummary || Object.keys(overallSalarySummary).length === 0 ? (
                    <div className={`${CARD} flex flex-col items-center justify-center py-14 text-center`}>
                        <ChartBarIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                        <p className="text-sm text-gray-500 dark:text-slate-400">{error || `No summary data available for ${salaryMonth}.`}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className={STATS_ROW}>
                            <StatsCard label="Total Gross" value={formatCurrency(overallSalarySummary.totalGrossSalary)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<CurrencyRupeeIcon className="h-5 w-5" />} />
                            <StatsCard label="Total Net" value={formatCurrency(overallSalarySummary.totalNetSalary)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<BanknotesIcon className="h-5 w-5" />} />
                            <StatsCard label="Total Deductions" value={formatCurrency(overallSalarySummary.totalDeductions)} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" icon={<ChartBarIcon className="h-5 w-5" />} />
                            <StatsCard label="Employees" value={formatNumber(overallSalarySummary.totalEmployees)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<UsersIcon className="h-5 w-5" />} onRefresh={fetchSummary} />
                        </div>
                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Salary Overview Bar Chart */}
                            <div className={`${CARD} p-4`}>
                                <h3 className={`${CARD_TITLE} mb-4`}>Earnings vs Deductions</h3>
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
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-[#2a2a2a]" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(val) => `₹${val/1000}k`} />
                                            <Tooltip 
                                                formatter={(value: any) => formatCurrency(value)}
                                                contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#191919', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.2)' }}
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
                            <div className={`${CARD} p-4`}>
                                <h3 className={`${CARD_TITLE} mb-4`}>Deductions Breakdown</h3>
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
                                                nameKey="name"
                                            >
                                                <Cell fill={COLORS[0]} />
                                                <Cell fill={COLORS[1]} />
                                                <Cell fill={COLORS[2]} />
                                            </Pie>
                                            <Tooltip 
                                                formatter={(value: any) => formatCurrency(value)}
                                                contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#191919', color: '#fff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.2)' }}
                                            />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Secondary Metrics Grid */}
                        <div className={`${CARD} p-4`}>
                            <h3 className={`${CARD_TITLE} mb-4`}>Detailed Breakdown</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Earnings</div>
                                    <div className="text-xl font-medium text-gray-900 dark:text-white">{formatCurrency(overallSalarySummary.totalEarnings)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Deductions</div>
                                    <div className="text-xl font-medium text-gray-900 dark:text-white">{formatCurrency(overallSalarySummary.totalDeductions)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">PF (Employee)</div>
                                    <div className="text-xl font-medium text-gray-900 dark:text-white">{formatCurrency(overallSalarySummary.totalPfEmployee)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">PF (Employer)</div>
                                    <div className="text-xl font-medium text-gray-900 dark:text-white">{formatCurrency(overallSalarySummary.totalPfEmployer)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">TDS</div>
                                    <div className="text-xl font-medium text-gray-900 dark:text-white">{formatCurrency(overallSalarySummary.totalTds)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Professional Tax</div>
                                    <div className="text-xl font-medium text-gray-900 dark:text-white">{formatCurrency(overallSalarySummary.totalProfessionalTax)}</div>
                                </div>
                                
                                {overallSalarySummary.totalWorkingDays !== undefined && (
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Working Days</div>
                                        <div className="text-xl font-medium text-gray-900 dark:text-white">{formatNumber(overallSalarySummary.totalWorkingDays)}</div>
                                    </div>
                                )}
                                {overallSalarySummary.totalLossOfPayDays !== undefined && (
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Loss of Pay Days</div>
                                        <div className="text-xl font-medium text-gray-900 dark:text-white">{formatNumber(overallSalarySummary.totalLossOfPayDays)}</div>
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
