import React, { useState, useEffect } from "react";
import axios from "axios";
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    CurrencyDollarIcon,
    BanknotesIcon,
    CalendarIcon,
    PrinterIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";

const SALARY_API = "/v1/api/payroll/employee-salaries";

const PAGE_SIZE = 10;

interface SalaryResponse {
    id: number;
    employee: {
        id: number;
        employeeCode: string;
        firstName: string;
        lastName: string;
        officialEmail: string;
        designation?: string;
    };
    month: string | null;
    basic: number | null;
    hra: number | null;
    bonus: number | null;
    grossSalary: number | null;
    currency: string;
    tds: number | null;
    professionalTax: number | null;
    otherDeductions: number | null;
    specialAllowance: number | null;
    allowance: number | null;
    pfEmployee: number | null;
    pfEmployer: number | null;
    netSalary: number | null;
    processedDate: string | null;
    totalEarnings: number | null;
    totalDeductions: number | null;
    country: string;
    regime: string | null;
    processed: boolean;
}

interface SalaryDTO {
    id: number;
    employeeId: number;
    employeeName: string;
    employeeCode: string;
    month: string;
    basic: number;
    hra: number;
    bonus: number;
    grossSalary: number;
    tds: number;
    professionalTax: number;
    otherDeductions: number;
    specialAllowance: number;
    allowance: number;
    pfEmployee: number;
    netSalary: number;
    isProcessed: boolean;
    totalEarnings: number;
    totalDeductions: number;
    regime: string;
}

const EmployeeSalaryPage: React.FC = () => {
    const [salaries, setSalaries] = useState<SalaryDTO[]>([]);
    const [filteredSalaries, setFilteredSalaries] = useState<SalaryDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState<string>('');
    const [searchEmployee, setSearchEmployee] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedRegime, setSelectedRegime] = useState<string>("");
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("");

    // Fetch all salary structures on component mount
    useEffect(() => {
        fetchAllSalaries();
    }, []);

    // Apply filters whenever dependencies change
    useEffect(() => {
        applyFilters();
    }, [salaries, search, searchEmployee, selectedRegime, selectedEmployeeFilter]);

    const fetchAllSalaries = async () => {
        setLoading(true);
        try {
            const [salariesRes, empRes] = await Promise.all([
                axios.get(SALARY_API),
                axios.get('/v1/api/payroll/employee/all')
            ]);
            
            const data = Array.isArray(salariesRes.data) ? salariesRes.data : [];
            const empData = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.data || []);

            const employeeMap = new Map();
            empData.forEach((emp: any) => {
                employeeMap.set(emp.id, emp);
            });

            // Transform the API response to match our DTO
            const transformedData: SalaryDTO[] = data.map((record: any, index: number) => {
                // Support both flat structure (record.employeeId) and nested structure (record.employee?.id)
                const empId = record.employeeId || record.employee?.id;
                const emp = employeeMap.get(empId);
                
                const basic = record.basic || 0;
                const hra = record.hra || 0;
                
                let sumEarnings = 0;
                let bonus = record.bonus || 0;
                if (record.earnings && typeof record.earnings === 'object') {
                    for (const [key, val] of Object.entries(record.earnings)) {
                        const numVal = Number(val) || 0;
                        sumEarnings += numVal;
                        if (key.toLowerCase().includes('bonus')) {
                            bonus += numVal;
                        }
                    }
                }

                let sumDeductions = record.totalDeductions || 0;
                if (!sumDeductions && record.deductions && typeof record.deductions === 'object') {
                    for (const val of Object.values(record.deductions)) {
                        sumDeductions += Number(val) || 0;
                    }
                }

                const grossSalary = record.grossSalary || (basic + hra + sumEarnings);
                const netSalary = record.netSalary || (grossSalary - sumDeductions);

                return {
                    id: record.id || record.employeeSalaryId || empId || index,
                    employeeId: empId || 0,
                    employeeName: emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : ''),
                    employeeCode: emp?.employeeCode || record.employee?.employeeCode || '',
                    month: record.month || new Date().toISOString().split('T')[0].slice(0, 7),
                    basic: basic,
                    hra: hra,
                    bonus: bonus,
                    specialAllowance: record.specialAllowance || 0,
                    allowance: record.allowance || 0,
                    tds: record.tds || 0,
                    professionalTax: record.professionalTax || 0,
                    pfEmployee: record.pfEmployee || 0,
                    otherDeductions: record.otherDeductions || 0,
                    grossSalary: grossSalary,
                    totalEarnings: record.totalEarnings || grossSalary,
                    totalDeductions: sumDeductions,
                    netSalary: netSalary,
                    isProcessed: record.processed || false,
                    regime: record.regime || 'NEW',
                };
            });

            setSalaries(transformedData);
        } catch (err) {
            console.error("Error loading salaries:", err);
            ToasterService.error("Failed to load salary records");
            setSalaries([]);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...salaries];

        // Filter by employee name/code
        if (searchEmployee) {
            const searchTerm = searchEmployee.toLowerCase();
            filtered = filtered.filter(s =>
                s.employeeName?.toLowerCase().includes(searchTerm) ||
                s.employeeCode?.toLowerCase().includes(searchTerm)
            );
        }

        // Filter by selected employee dropdown
        if (selectedEmployeeFilter) {
            filtered = filtered.filter(s => s.employeeId.toString() === selectedEmployeeFilter);
        }

        // Filter by month search
        if (search) {
            const searchTerm = search.toLowerCase();
            filtered = filtered.filter(s => s.month.toLowerCase().includes(searchTerm));
        }

        // Filter by regime
        if (selectedRegime) {
            filtered = filtered.filter(s => s.regime === selectedRegime);
        }

        setFilteredSalaries(filtered);
    };

    // Calculate stats from real data
    const totalRecords = filteredSalaries.length;
    const totalProcessed = filteredSalaries.filter(s => s?.isProcessed === true).length;
    const totalPaid = filteredSalaries.reduce((sum, s) => sum + (s?.isProcessed && s?.netSalary ? s.netSalary : 0), 0);
    const averageNet = filteredSalaries.length > 0 ? totalPaid / filteredSalaries.length : 0;

    // Get unique employees for filter
    const uniqueEmployees = [...new Map(salaries.map(s => [s.employeeId, { id: s.employeeId, name: s.employeeName, code: s.employeeCode }])).values()];

    // Get unique regimes for filter
    const uniqueRegimes = [...new Set(salaries.map(s => s?.regime).filter(Boolean))];

    const columns: ColumnDef<SalaryDTO>[] = [
        {
            key: "employeeName",
            label: "Employee",
            sortable: true,
            render: (row) => (
                <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-cyan-700">
                            {row.employeeName?.charAt(0) || row.employeeCode?.charAt(0) || 'E'}
                        </span>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-900" title={row.employeeName}>
                            {(row.employeeName || '').trim().length > 4
                                ? `${(row.employeeName || '').trim().substring(0, 4)}...`
                                : row.employeeName}
                        </div>
                        <div className="text-[10px] text-gray-500" title={row.employeeCode}>
                            {(row.employeeCode || '').trim().length > 4
                                ? `${(row.employeeCode || '').trim().substring(0, 4)}...`
                                : row.employeeCode}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: "month",
            label: "Month",
            sortable: true,
            render: (row) => (
                <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-xs font-medium text-gray-900">{row.month}</span>
                </div>
            )
        },
        {
            key: "basic",
            label: "Basic",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-900">₹{row.basic.toLocaleString()}</span>
        },
        {
            key: "hra",
            label: "HRA",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-900">₹{row.hra.toLocaleString()}</span>
        },
        {
            key: "bonus",
            label: "Bonus",
            sortable: true,
            render: (row) => <span className="text-xs text-green-600">₹{row.bonus.toLocaleString()}</span>
        },
        {
            key: "grossSalary",
            label: "Gross",
            sortable: true,
            render: (row) => <span className="text-xs font-medium text-gray-900">₹{row.grossSalary.toLocaleString()}</span>
        },
        {
            key: "totalDeductions",
            label: "Deductions",
            sortable: true,
            render: (row) => <span className="text-xs text-red-600">₹{row.totalDeductions.toLocaleString()}</span>
        },
        {
            key: "netSalary",
            label: "Net Salary",
            sortable: true,
            render: (row) => <span className="text-xs font-bold text-cyan-600">₹{row.netSalary.toLocaleString()}</span>
        },
        {
            key: "regime",
            label: "Regime",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-600">{row.regime}</span>
        },
        {
            key: "isProcessed",
            label: "Status",
            sortable: true,
            headerClassName: "w-full",
            className: "w-full",
            render: (row) => row.isProcessed ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                    Processed
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    Pending
                </span>
            )
        }
    ];

    return (
        <>
            <PageMeta title="Employee Salaries" description="View employee salary records" />
            <PageBreadcrumb pageTitle="Employee Salaries" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Records" value={totalRecords} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-6 w-6" />} />
                    <StatsCard label="Processed Records" value={totalProcessed} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Total Paid" value={"Rs " + (totalPaid / 1000).toFixed(1) + "K"} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<CurrencyDollarIcon className="h-6 w-6" />} />
                    <StatsCard label="Average Net Salary" value={"Rs " + Math.round(averageNet).toLocaleString()} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-6 w-6" />} />
                </div>

                {/* Toolbar - All buttons in single line */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by employee name or code..."
                                value={searchEmployee}
                                onChange={(e) => setSearchEmployee(e.target.value)}
                                className="h-10 pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <AddButton label="Refresh Salaries" className="h-10 !my-0" onClick={fetchAllSalaries} />
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`h-10 px-4 rounded-lg border transition-colors flex items-center gap-2 shadow-sm !my-0 ${showFilters
                                ? 'bg-cyan-50 border-cyan-300 text-cyan-600'
                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <FunnelIcon className="h-4 w-4" />
                            <span>Filter</span>
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                                <select
                                    value={selectedEmployeeFilter}
                                    onChange={e => setSelectedEmployeeFilter(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Employees</option>
                                    {uniqueEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} - {emp.code}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Regime</label>
                                <select
                                    value={selectedRegime}
                                    onChange={e => setSelectedRegime(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Regimes</option>
                                    {uniqueRegimes.map(regime => (
                                        <option key={regime} value={regime}>{regime} Regime</option>
                                    ))}
                                </select>
                            </div>
                            {(selectedEmployeeFilter || selectedRegime) && (
                                <button
                                    onClick={() => {
                                        setSelectedEmployeeFilter("");
                                        setSelectedRegime("");
                                    }}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Table */}
                <ReusableTable
                    className="[&_th]:!px-2 [&_td]:!px-2"
                    data={filteredSalaries}
                    columns={columns}
                    loading={loading}
                    searchable={false}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="month"
                    defaultSortOrder="desc"
                    emptyState={
                        <div className="flex flex-col items-center">
                            <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-gray-500 text-sm mb-2">No salary records found</p>
                        </div>
                    }
                />
            </div>
        </>
    );
};

export default EmployeeSalaryPage;



