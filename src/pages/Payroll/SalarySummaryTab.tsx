import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
    ChartBarIcon, 
    CalendarIcon, 
    BanknotesIcon, 
    UserGroupIcon, 
    CurrencyRupeeIcon, 
    ArrowTrendingUpIcon, 
    ArrowTrendingDownIcon,
    BriefcaseIcon,
    DocumentArrowDownIcon
} from "@heroicons/react/24/outline";
import * as XLSX from "xlsx";
import { ToasterService } from "../../Services/ToasterService";

const SalarySummaryTab: React.FC = () => {
    const [salaryMonth, setSalaryMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [overallSalarySummary, setOverallSalarySummary] = useState<any>(null);
    const [departmentSummary, setDepartmentSummary] = useState<any[]>([]);
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
            // Fetch both overall and department summaries
            const [summaryRes, deptRes] = await Promise.allSettled([
                axios.get(`/v1/api/payroll/reports/getPayrollSummary`, { params: { payrollMonth: salaryMonth } }),
                axios.get(`/v1/api/payroll/reports/department-summary`, { params: { payrollMonth: salaryMonth } })
            ]);
            
            if (summaryRes.status === 'fulfilled') {
                let data = summaryRes.value.data;
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

            if (deptRes.status === 'fulfilled') {
                const data = deptRes.value.data;
                setDepartmentSummary(Array.isArray(data) ? data : []);
            } else {
                setDepartmentSummary([]);
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

    // Helper function to safely parse and format numbers
    const formatCurrency = (val: any) => {
        if (val === null || val === undefined || isNaN(val)) return '₹0';
        return `₹${Number(val).toLocaleString('en-IN')}`;
    };

    const formatNumber = (val: any) => {
        if (val === null || val === undefined || isNaN(val)) return '0';
        return Number(val).toLocaleString('en-IN');
    };

    return (
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Payroll Overview</h2>
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
            ) : overallSalarySummary && Object.keys(overallSalarySummary).length > 0 ? (
                <>
                    {/* Top 3 Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Gross</div>
                            <div className="text-3xl font-semibold text-gray-900">{formatCurrency(overallSalarySummary.totalGrossSalary)}</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Net</div>
                            <div className="text-3xl font-semibold text-gray-900">{formatCurrency(overallSalarySummary.totalNetSalary)}</div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-6">
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Employees</div>
                            <div className="text-3xl font-semibold text-gray-900">{formatNumber(overallSalarySummary.totalEmployees)}</div>
                        </div>
                    </div>

                    {/* Secondary Metrics Grid */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
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
                </>
            ) : (
                <div className="text-sm text-gray-400 py-16 text-center bg-gray-50 rounded-3xl border border-gray-200 shadow-inner flex flex-col items-center justify-center">
                    <ChartBarIcon className="h-16 w-16 text-gray-300 mb-6" />
                    <span className="font-medium text-lg text-gray-500">No summary data available for {salaryMonth}.</span>
                </div>
            )}

            {/* Department Summary Table */}
            {!loading && departmentSummary.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-8">
                    <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-base font-medium text-gray-900">Department Summary</h3>
                        <span className="text-sm text-gray-500">
                            {departmentSummary.length} Departments
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white text-gray-500 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 font-normal text-gray-500">Department</th>
                                    <th className="px-6 py-4 font-normal text-gray-500 text-right">Employees</th>
                                    <th className="px-6 py-4 font-normal text-gray-500 text-right">Total Gross</th>
                                    <th className="px-6 py-4 font-normal text-gray-500 text-right">Total Deductions</th>
                                    <th className="px-6 py-4 font-normal text-gray-500 text-right">Net Salary</th>
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
            )}
        </div>
    );
};

export default SalarySummaryTab;
