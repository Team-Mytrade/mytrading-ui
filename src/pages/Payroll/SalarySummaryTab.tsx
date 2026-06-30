import React, { useState, useEffect } from "react";
import axios from "axios";
import { ChartBarIcon, CalendarIcon } from "@heroicons/react/24/outline";

const SalarySummaryTab: React.FC = () => {
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
            // Using the new API endpoint
            const res = await axios.get(`/v1/api/payroll/reports/getPayrollSummary`, { 
                params: { payrollMonth: salaryMonth } 
            });
            
            // Handle if it's an array (e.g. [{ metric: ..., value: ... }] or [{ totalEarnings: ... }])
            let data = res.data;
            if (Array.isArray(data)) {
                if (data.length === 1 && typeof data[0] === 'object') {
                    data = data[0]; // If it's just a single object wrapped in an array
                } else {
                    // Flatten array of objects into a single object for display
                    data = data.reduce((acc, curr) => {
                        if (typeof curr === 'object' && curr !== null) {
                            return { ...acc, ...curr };
                        }
                        return acc;
                    }, {});
                }
            }
            setOverallSalarySummary(data);
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
                    <div className="text-sm text-gray-400 py-8">
                        No data available for {salaryMonth}.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalarySummaryTab;
