import React, { useState, useEffect } from "react";
import axios from "axios";
import {
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
import { todayIso } from "../../utils/localDate";

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
    status?: string;
    taxRegime?: string;
    otherAllowances?: number;
    taxAndDeductions?: number;
    [key: string]: any;
}

const EmployeeSalaryPage: React.FC = () => {
    const [salaries, setSalaries] = useState<SalaryDTO[]>([]);
    const [filteredSalaries, setFilteredSalaries] = useState<SalaryDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState<string>('');
    const [searchEmployee, setSearchEmployee] = useState<string>('');
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

                const isProc = Boolean(record.processed);
                const empName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : (record.employee ? `${record.employee.firstName || ''} ${record.employee.lastName || ''}`.trim() : `Employee #${empId || index}`);
                const empCode = emp?.employeeCode || record.employee?.employeeCode || `EMP-${String(empId || index).padStart(4, '0')}`;
                // The regime chosen on the employee's salary details
                const regime = record.regime || record.countrySpecificData?.taxRegime;
                const regimeStr = regime ? (String(regime).toUpperCase().includes('OLD') ? 'Old Regime (OLD)' : 'New Regime (NEW)') : 'New Regime (NEW)';

                // These are salary structures: yearly amounts (Add Employee / Salary Structure); a month pays one twelfth.
                // Enumerable properties visible in Table & drawer:
                // First 4 columns: employeeName, month, basic, grossSalary -> top 4 summary metric cards in drawer
                const rowItem: Record<string, any> = {
                    employeeName: empName,
                    month: record.month || todayIso().slice(0, 7),
                    basic: basic,
                    grossSalary: grossSalary,
                    monthlyGross: Math.round(grossSalary / 12 * 100) / 100,
                    employeeCode: empCode,
                    hra: hra,
                    taxRegime: regimeStr,
                };

                const otherAllowances = (record.specialAllowance || 0) + (record.allowance || 0) + bonus;
                if (otherAllowances > 0) {
                    rowItem.otherAllowances = otherAllowances;
                }

                const taxAndPf = (record.tds || 0) + (record.professionalTax || 0) + (record.pfEmployee || 0) + (record.otherDeductions || 0);
                if (taxAndPf > 0) {
                    rowItem.taxAndDeductions = taxAndPf;
                }

                // Non-enumerable properties: accessible by code, filters, and stats, but hidden from drawer Object.keys()
                Object.defineProperties(rowItem, {
                    id: { value: record.id || record.employeeSalaryId || empId || index, enumerable: false, writable: true },
                    employeeId: { value: empId || 0, enumerable: false, writable: true },
                    netSalary: { value: netSalary, enumerable: false, writable: true },
                    totalDeductions: { value: sumDeductions, enumerable: false, writable: true },
                    isProcessed: { value: isProc, enumerable: false, writable: true },
                    totalEarnings: { value: record.totalEarnings || grossSalary, enumerable: false, writable: true },
                    bonus: { value: bonus, enumerable: false, writable: true },
                    specialAllowance: { value: record.specialAllowance || 0, enumerable: false, writable: true },
                    allowance: { value: record.allowance || 0, enumerable: false, writable: true },
                    tds: { value: record.tds || 0, enumerable: false, writable: true },
                    professionalTax: { value: record.professionalTax || 0, enumerable: false, writable: true },
                    pfEmployee: { value: record.pfEmployee || 0, enumerable: false, writable: true },
                    otherDeductions: { value: record.otherDeductions || 0, enumerable: false, writable: true },
                    regime: { value: record.regime || 'NEW', enumerable: false, writable: true },
                });

                return rowItem as SalaryDTO;
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
    const yearlyPayroll = filteredSalaries.reduce((sum, s) => sum + (s?.grossSalary || 0), 0);
    const monthlyPayroll = yearlyPayroll / 12;
    const averageMonthly = filteredSalaries.length > 0 ? monthlyPayroll / filteredSalaries.length : 0;
    const lakhs = (value: number) => "Rs " + (value / 100000).toFixed(2) + "L";

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
                <div className="flex items-center justify-center mx-auto max-w-max">
                    <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-[#222222] flex items-center justify-center mr-3 shrink-0">
                        <span className="text-xs font-medium text-cyan-700 dark:text-gray-300">
                            {row.employeeName?.charAt(0) || row.employeeCode?.charAt(0) || 'E'}
                        </span>
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-medium text-gray-900 dark:text-white" title={row.employeeName}>
                            {(row.employeeName || '').trim().length > 15
                                ? `${(row.employeeName || '').trim().substring(0, 15)}...`
                                : row.employeeName}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400" title={row.employeeCode}>
                            {row.employeeCode}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: "month",
            label: "Effective From",
            sortable: true,
            render: (row) => (
                <div className="flex items-center justify-center mx-auto">
                    <CalendarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-300">{row.month}</span>
                </div>
            )
        },
        {
            key: "basic",
            label: "Basic (yearly)",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-900 dark:text-gray-300 font-mono whitespace-nowrap">₹{row.basic.toLocaleString("en-IN")}</span>
        },
        {
            key: "grossSalary",
            label: "Yearly Gross",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-900 dark:text-gray-300 font-mono whitespace-nowrap">₹{row.grossSalary.toLocaleString("en-IN")}</span>
        },
        {
            key: "monthlyGross",
            label: "Monthly Gross",
            sortable: true,
            render: (row) => <span className="text-xs font-bold text-cyan-600 dark:text-gray-200 font-mono whitespace-nowrap">₹{row.monthlyGross.toLocaleString("en-IN")}</span>
        }
    ];

    return (
        <>
            <PageMeta title="Employee Salaries" description="View employee salary records" />
            <PageBreadcrumb pageTitle="Employee Salaries" />

            <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
                <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                    <AddButton label="Refresh Salaries" permission={null} onClick={fetchAllSalaries} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 [&_.stats-card]:dark:!border-transparent [&_.stats-card]:dark:!bg-[#191919] [&_.stats-card__icon]:dark:!bg-[#222222] [&_.stats-card__icon]:dark:!text-gray-300 [&_.stats-card__value]:dark:!text-white [&_.stats-card__label]:dark:!text-gray-400">
                    <StatsCard label="Employees" value={totalRecords} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-6 w-6" />} />
                    <StatsCard label="Yearly Gross Payroll" value={lakhs(yearlyPayroll)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Monthly Gross Payroll" value={lakhs(monthlyPayroll)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<CurrencyDollarIcon className="h-6 w-6" />} />
                    <StatsCard label="Average Monthly Gross" value={"Rs " + Math.round(averageMonthly).toLocaleString("en-IN")} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-6 w-6" />} />
                </div>

                {/* Table */}
                <ReusableTable
                    className="[&_th]:!px-2 [&_td]:!px-2 dark:border-transparent [&_.common-data-table]:dark:!border-transparent"
                    data={filteredSalaries}
                    columns={columns}
                    loading={loading}
                    searchable={false}
                    align="center"
                    pageSize={PAGE_SIZE}
                    defaultSortKey="month"
                    defaultSortOrder="desc"
                    rowDetailsTitle={(row) => `${row.employeeName || 'Employee'} - ${row.month}`}
                    rowDetailsSubtitle="Salary structure in yearly amounts; each month pays one twelfth (see Payslips for what was paid)"
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



