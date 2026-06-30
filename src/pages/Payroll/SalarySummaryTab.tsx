import React, { useState, useEffect } from "react";
import axios from "axios";
import { ChartBarIcon, CalendarIcon } from "@heroicons/react/24/outline";

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
        <div className="bg-white border border-gray-200 rounded-lg">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-medium text-gray-800">Salary Summary</h2>
                <div className="flex items-center gap-2">
                    <input
                        type="month"
                        value={salaryMonth}
                        onChange={(e) => setSalaryMonth(e.target.value)}
                        className="text-sm text-gray-600 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-gray-400"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {loading ? (
                    <div className="text-sm text-gray-500 py-8">Loading summary...</div>
                ) : error ? (
                    <div className="text-sm text-red-500 py-8">{error}</div>
                ) : overallSalarySummary && Object.keys(overallSalarySummary).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
                        
                        <div className="col-span-2 md:col-span-4 border-b border-gray-100 pb-4 mb-2 flex gap-12">
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Total Gross</div>
                                <div className="text-2xl font-semibold text-gray-800">{formatCurrency(overallSalarySummary.totalGrossSalary)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Total Net</div>
                                <div className="text-2xl font-semibold text-gray-800">{formatCurrency(overallSalarySummary.totalNetSalary)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Employees</div>
                                <div className="text-2xl font-semibold text-gray-800">{formatNumber(overallSalarySummary.totalEmployees)}</div>
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-gray-500 mb-1">Total Earnings</div>
                            <div className="text-sm font-medium text-gray-800">{formatCurrency(overallSalarySummary.totalEarnings)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Total Deductions</div>
                            <div className="text-sm font-medium text-gray-800">{formatCurrency(overallSalarySummary.totalDeductions)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">PF (Employee)</div>
                            <div className="text-sm font-medium text-gray-800">{formatCurrency(overallSalarySummary.totalPfEmployee)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">PF (Employer)</div>
                            <div className="text-sm font-medium text-gray-800">{formatCurrency(overallSalarySummary.totalPfEmployer)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">TDS</div>
                            <div className="text-sm font-medium text-gray-800">{formatCurrency(overallSalarySummary.totalTds)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 mb-1">Professional Tax</div>
                            <div className="text-sm font-medium text-gray-800">{formatCurrency(overallSalarySummary.totalProfessionalTax)}</div>
                        </div>
                        
                        {(overallSalarySummary.totalWorkingDays !== undefined || overallSalarySummary.totalLossOfPayDays !== undefined) && (
                            <>
                                {overallSalarySummary.totalWorkingDays !== undefined && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Working Days</div>
                                        <div className="text-sm font-medium text-gray-800">{formatNumber(overallSalarySummary.totalWorkingDays)}</div>
                                    </div>
                                )}
                                {overallSalarySummary.totalLossOfPayDays !== undefined && (
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Loss of Pay Days</div>
                                        <div className="text-sm font-medium text-gray-800">{formatNumber(overallSalarySummary.totalLossOfPayDays)}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-400 py-8 text-center bg-gray-50 rounded-lg">
                        No summary data available for {salaryMonth}.
                    </div>
                )}

                {/* Department Summary Table */}
                {!loading && departmentSummary.length > 0 && (
                    <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-800">Department Summary</h3>
                            <span className="text-xs text-gray-500">{departmentSummary.length} Departments</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-white text-gray-500 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Department</th>
                                        <th className="px-6 py-3 font-medium text-right">Employees</th>
                                        <th className="px-6 py-3 font-medium text-right">Total Gross</th>
                                        <th className="px-6 py-3 font-medium text-right">Total Deductions</th>
                                        <th className="px-6 py-3 font-medium text-right">Net Salary</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {departmentSummary.map((dept, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{dept.departmentName || dept.department || 'Unknown'}</td>
                                            <td className="px-6 py-4 text-right text-gray-600">{formatNumber(dept.employeeCount || dept.totalEmployees)}</td>
                                            <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(dept.totalGrossSalary || dept.grossSalary)}</td>
                                            <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(dept.totalDeductions || dept.deductions)}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-cyan-600">{formatCurrency(dept.totalNetSalary || dept.netSalary)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalarySummaryTab;
