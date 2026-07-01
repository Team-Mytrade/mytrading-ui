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
    const [sortKey, setSortKey] = useState<keyof SalaryDTO>("month");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
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
    }, [salaries, search, searchEmployee, selectedRegime, selectedEmployeeFilter, sortKey, sortOrder]);

    const fetchAllSalaries = async () => {
        setLoading(true);
        try {
            const response = await axios.get(SALARY_API);
            const data = Array.isArray(response.data) ? response.data : [];

            // Transform the API response to match our DTO
            const transformedData: SalaryDTO[] = data.map((record: SalaryResponse) => ({
                id: record.id,
                employeeId: record.employee?.id || 0,
                employeeName: record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : '',
                employeeCode: record.employee?.employeeCode || '',
                month: record.month || new Date().toISOString().split('T')[0].slice(0, 7),
                basic: record.basic || 0,
                hra: record.hra || 0,
                bonus: record.bonus || 0,
                specialAllowance: record.specialAllowance || 0,
                allowance: record.allowance || 0,
                tds: record.tds || 0,
                professionalTax: record.professionalTax || 0,
                pfEmployee: record.pfEmployee || 0,
                otherDeductions: record.otherDeductions || 0,
                grossSalary: record.grossSalary || 0,
                totalEarnings: record.totalEarnings || 0,
                totalDeductions: record.totalDeductions || 0,
                netSalary: record.netSalary || 0,
                isProcessed: record.processed || false,
                regime: record.regime || 'NEW',
            }));

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

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let valA = a[sortKey as keyof SalaryDTO];
            let valB = b[sortKey as keyof SalaryDTO];

            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            if (typeof valA === "string" && typeof valB === "string") {
                return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }

            if (typeof valA === "number" && typeof valB === "number") {
                return sortOrder === "asc" ? valA - valB : valB - valA;
            }

            return 0;
        });

        setFilteredSalaries(sorted);
        setPage(1);
    };

    const paginated = filteredSalaries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.ceil(filteredSalaries.length / PAGE_SIZE);

    const handleSort = (field: keyof SalaryDTO) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof SalaryDTO }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    // Calculate stats from real data
    const totalRecords = filteredSalaries.length;
    const totalProcessed = filteredSalaries.filter(s => s?.isProcessed === true).length;
    const totalPaid = filteredSalaries.reduce((sum, s) => sum + (s?.isProcessed && s?.netSalary ? s.netSalary : 0), 0);
    const averageNet = filteredSalaries.length > 0 ? totalPaid / filteredSalaries.length : 0;

    // Get unique employees for filter
    const uniqueEmployees = [...new Map(salaries.map(s => [s.employeeId, { id: s.employeeId, name: s.employeeName, code: s.employeeCode }])).values()];

    // Get unique regimes for filter
    const uniqueRegimes = [...new Set(salaries.map(s => s?.regime).filter(Boolean))];

    return (
        <>
            <PageMeta title="Employee Salaries" description="View employee salary records" />
            <PageBreadcrumb pageTitle="Employee Salaries" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton label="Refresh Salaries" onClick={fetchAllSalaries} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Records" value={totalRecords} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-6 w-6" />} />
                    <StatsCard label="Processed Records" value={totalProcessed} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Total Paid" value={"Rs " + (totalPaid / 1000).toFixed(1) + "K"} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<CurrencyDollarIcon className="h-6 w-6" />} />
                    <StatsCard label="Average Net Salary" value={"Rs " + Math.round(averageNet).toLocaleString()} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-6 w-6" />} />
                </div>

                {/* Toolbar - All buttons in single line */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">


                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`px-4 py-2 rounded-lg border transition-colors flex items-center gap-2 shadow-sm ${showFilters
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
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("employeeName")}>
                                        <span className="flex items-center">Employee <SortIcon col="employeeName" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("month")}>
                                        <span className="flex items-center">Month <SortIcon col="month" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("basic")}>
                                        <span className="flex items-center">Basic <SortIcon col="basic" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("hra")}>
                                        <span className="flex items-center">HRA <SortIcon col="hra" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("bonus")}>
                                        <span className="flex items-center">Bonus <SortIcon col="bonus" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("grossSalary")}>
                                        <span className="flex items-center">Gross <SortIcon col="grossSalary" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("totalDeductions")}>
                                        <span className="flex items-center">Deductions <SortIcon col="totalDeductions" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("netSalary")}>
                                        <span className="flex items-center">Net Salary <SortIcon col="netSalary" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort("regime")}>
                                        <span className="flex items-center">Regime <SortIcon col="regime" /></span>
                                    </th>
                                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                                <p className="text-gray-500 text-sm">Loading salary records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(salary => (
                                    <tr key={salary.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-xs font-medium text-cyan-700">
                                                        {salary.employeeName?.charAt(0) || salary.employeeCode?.charAt(0) || 'E'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{salary.employeeName}</div>
                                                    <div className="text-xs text-gray-500">{salary.employeeCode}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{salary.month}</span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">₹{salary.basic.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">₹{salary.hra.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-green-600">₹{salary.bonus.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">₹{salary.grossSalary.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-red-600">₹{salary.totalDeductions.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-cyan-600">₹{salary.netSalary.toLocaleString()}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600">{salary.regime}</span>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap">
                                            {salary.isProcessed ? (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                                                    Processed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No salary records found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                                        <span className="font-medium">
                                            {Math.min(page * PAGE_SIZE, filteredSalaries.length)}
                                        </span>{' '}
                                        of <span className="font-medium">{filteredSalaries.length}</span> results
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum: number;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (page <= 3) {
                                                pageNum = i + 1;
                                            } else if (page >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = page - 2 + i;
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setPage(pageNum)}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                                                        ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                                                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Last
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default EmployeeSalaryPage;



