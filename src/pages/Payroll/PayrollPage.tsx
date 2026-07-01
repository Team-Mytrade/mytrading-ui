import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import {
    EllipsisVerticalIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    BuildingOfficeIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    BanknotesIcon,
    CalendarIcon,
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
    PlayCircleIcon,
    ClockIcon,
    ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

const BASE_URL = "/v1/api/payroll";
const PAGE_SIZE = 10;

interface Employee {
    id: number;
    employeeCode: string;
    firstName: string;
    lastName: string;
    officialEmail?: string;
    phone?: string;
}

interface EmployeeSalary {
    id: number;
    month: string;
    grossSalary: number;
    netSalary: number;
    basic: number;
    hra: number;
    bonus: number;
    specialAllowance?: number;
    allowance?: number;
    currency: string;
    isProcessed: boolean;
    processedDate: string | null;
    totalEarnings: number;
    totalDeductions: number;
    tds?: number;
    professionalTax?: number;
    pfEmployee?: number;
    otherDeductions?: number;
    paymentMode?: string;
    employee: Employee | null;
    createdAt?: string;
    updatedAt?: string;
}

const PayrollPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
    const [search, setSearch] = useState(() => {
        const empCode = searchParams.get("employeeCode");
        const empName = searchParams.get("employeeName");
        return empCode || empName || "";
    });
    const [sortKey, setSortKey] = useState<keyof EmployeeSalary>("month");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [filterMonth, setFilterMonth] = useState("2026-06");
    const [processMonth, setProcessMonth] = useState("");
    const [viewItem, setViewItem] = useState<EmployeeSalary | null>(null);
    const [viewDetails, setViewDetails] = useState<any>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateMonth, setGenerateMonth] = useState("");
    const [isZipModalOpen, setIsZipModalOpen] = useState(false);
    const [zipEmployee, setZipEmployee] = useState<{ id: number, name: string } | null>(null);
    const [fromMonth, setFromMonth] = useState("");
    const [toMonth, setToMonth] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current!,
        documentTitle: "Salary Records",
    });

    useEffect(() => {
        fetchAll();
    }, [filterMonth]);

    const fetchAll = async () => {
        if (!filterMonth) return;
        setLoading(true);
        try {
            const [salariesRes, empRes] = await Promise.all([
                axios.get(`/v1/api/payroll/salary-summary?yearMonth=${filterMonth}`),
                axios.get(`/v1/api/payroll/employee/all`)
            ]);

            const salaryData = Array.isArray(salariesRes.data) ? salariesRes.data : (salariesRes.data?.data || []);
            const empData = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.data || []);

            const employeeMap = new Map();
            empData.forEach((emp: any) => {
                employeeMap.set(emp.id, emp);
            });

            const merged = salaryData.map((s: any, index: number) => ({
                id: s.employeeSalaryId || s.employeeId || index,
                month: s.month || filterMonth,
                grossSalary: s.grossSalary || 0,
                netSalary: s.netSalary || 0,
                basic: s.basic || 0,
                hra: s.hra || 0,
                bonus: s.bonus || 0,
                currency: s.currency || 'INR',
                isProcessed: !!s.processedDate,
                processedDate: s.processedDate || null,
                totalEarnings: s.totalEarnings || s.grossSalary || 0,
                totalDeductions: s.totalDeductions || 0,
                employee: employeeMap.get(s.employeeId) || null,
            }));

            setSalaries(merged);
        } catch (err) {
            console.error("Error loading salaries", err);
            ToasterService.error("Failed to load salary records");
            setSalaries([]);
        } finally {
            setLoading(false);
        }
    };

    const processAll = async () => {
        if (!processMonth) {
            ToasterService.warning("Please select a month to process");
            return;
        }

        const ok = await confirm({
            message: `Are you sure you want to process payroll for ${processMonth}? This action will mark all salaries for this month as processed.`,
            confirmLabel: "Process",
            variant: "info",
        });
        if (!ok) return;

        setLoading(true);
        try {
            await axios.post(`${BASE_URL}/process-all?month=${processMonth}`);
            ToasterService.success(`Payroll processed successfully for ${processMonth}`);
            await fetchAll();
            setIsProcessModalOpen(false);
            setProcessMonth("");
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Failed to process payroll");
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (salary: EmployeeSalary) => {
        setViewItem(salary);
        setDetailsLoading(true);
        setViewDetails(null);
        try {
            const res = await axios.get(`/v1/api/payroll/payslips/preview/${salary.employee?.id}?month=${salary.month}`);
            setViewDetails(res.data);
        } catch (err) {
            console.error("Failed to fetch salary details", err);
            ToasterService.error("Failed to fetch detailed salary breakdown.");
        } finally {
            setDetailsLoading(false);
        }
    };

    const generatePayslips = async () => {
        if (!generateMonth) {
            ToasterService.warning("Please select a month to generate payslips");
            return;
        }

        const ok = await confirm({
            message: `Are you sure you want to generate payslips for ${generateMonth}?`,
            confirmLabel: "Generate",
            variant: "info",
        });
        if (!ok) return;

        setLoading(true);
        try {
            const res = await axios.post(`/v1/api/payroll/payslips/generatePayslips`, { yearMonth: generateMonth });
            const message = typeof res.data === 'string' && res.data.trim() !== ''
                ? res.data
                : `Payslips generated successfully for ${generateMonth}`;
            ToasterService.success(message);
            await fetchAll();
            setIsGenerateModalOpen(false);
            setGenerateMonth("");
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Failed to generate payslips");
        } finally {
            setLoading(false);
        }
    };

    const downloadZipRange = async () => {
        if (!zipEmployee || !fromMonth || !toMonth) {
            ToasterService.warning("Please select both from and to months");
            return;
        }
        if (fromMonth > toMonth) {
            ToasterService.warning("From Month cannot be after To Month");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.get(`/v1/api/payroll/payslips/download-zip`, {
                params: {
                    employeeId: zipEmployee.id,
                    fromMonth,
                    toMonth
                },
                responseType: "blob"
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `payslips_${zipEmployee.name.replace(/\s+/g, '_')}_${fromMonth}_to_${toMonth}.zip`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            ToasterService.success(`ZIP downloaded successfully`);
            setIsZipModalOpen(false);
            setFromMonth("");
            setToMonth("");
        } catch (err) {
            ToasterService.error("Failed to download ZIP file");
        } finally {
            setLoading(false);
        }
    };

    const rollback = async (id: number, employeeName: string) => {
        const ok = await confirm({
            message: `Are you sure you want to rollback salary record for ${employeeName}? This action cannot be undone.`,
            confirmLabel: "Rollback",
            variant: "danger",
        });
        if (!ok) return;

        try {
            await axios.post(`${BASE_URL}/rollback/${id}`);
            ToasterService.success("Salary record rolled back successfully");
            await fetchAll();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Rollback failed");
        }
    };

    const downloadPayslip = async (employeeId: number, month: string, employeeName: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/payslips/download`, {
                params: {
                    employeeId,
                    month
                },
                responseType: "blob"
            });
            const url = window.URL.createObjectURL(response.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `payslip_${employeeName.replace(/\s/g, "_")}_${month}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
            ToasterService.success("Payslip downloaded successfully");
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Failed to download payslip");
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Payroll Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Records: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Employee", "Month", "Gross Salary", "Net Salary", "Status"]],
            body: filtered.map(s => [
                s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "N/A",
                s.month,
                `₹${s.grossSalary.toLocaleString()}`,
                `₹${s.netSalary.toLocaleString()}`,
                s.isProcessed ? "Processed" : "Draft"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Payroll_Report_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(s => ({
            'Employee Code': s.employee?.employeeCode || "N/A",
            'Employee Name': s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "N/A",
            'Month': s.month,
            'Basic': s.basic,
            'HRA': s.hra,
            'Bonus': s.bonus,
            'Special Allowance': s.specialAllowance || 0,
            'Gross Salary': s.grossSalary,
            'TDS': s.tds || 0,
            'Professional Tax': s.professionalTax || 0,
            'PF (Employee)': s.pfEmployee || 0,
            'Other Deductions': s.otherDeductions || 0,
            'Total Deductions': s.totalDeductions,
            'Net Salary': s.netSalary,
            'Status': s.isProcessed ? "Processed" : "Draft",
            'Processed Date': s.processedDate ? new Date(s.processedDate).toLocaleDateString() : "N/A",
            'Payment Mode': s.paymentMode || "N/A",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payroll Report");
        XLSX.writeFile(wb, `Payroll_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const handleExportDetailedReport = async () => {
        try {
            const response = await axios.get(`/v1/api/payroll/reports/getPayrollDetailReportByMonth`, {
                params: { payrollMonth: filterMonth }
            });

            const data = response.data;
            if (!data || !Array.isArray(data) || data.length === 0) {
                ToasterService.warning("No detailed report data found for this month");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Detailed Report");
            XLSX.writeFile(wb, `Payroll_Detailed_Report_${filterMonth}.xlsx`);

            ToasterService.success("Detailed report exported successfully");
        } catch (error) {
            console.error("Error exporting detailed report:", error);
            ToasterService.error("Failed to export detailed report");
        }
    };

    const filtered = salaries.filter((s) => {
        const term = search.toLowerCase();
        const name = `${s.employee?.firstName || ""} ${s.employee?.lastName || ""}`.toLowerCase();
        const matchSearch =
            s.month.toLowerCase().includes(term) ||
            s.employee?.employeeCode?.toLowerCase().includes(term) ||
            name.includes(term);
        const matchStatus = selectedStatus ? (selectedStatus === "processed" ? s.isProcessed : !s.isProcessed) : true;
        return matchSearch && matchStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === "employee") {
            valA = a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : "";
            valB = b.employee ? `${b.employee.firstName} ${b.employee.lastName}` : "";
        }

        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (typeof valA === "number" && typeof valB === "number") {
            return sortOrder === "asc" ? valA - valB : valB - valA;
        }

        if (typeof valA === "boolean" && typeof valB === "boolean") {
            return sortOrder === "asc" ? (valA === valB ? 0 : valA ? 1 : -1) : (valA === valB ? 0 : valA ? -1 : 1);
        }

        return 0;
    });

    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

    const handleSort = (field: keyof EmployeeSalary | "employee") => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field as keyof EmployeeSalary); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof EmployeeSalary | "employee" }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

    // Calculate stats from real data
    const totalProcessed = salaries.filter(s => s.isProcessed).length;
    const totalDraft = salaries.filter(s => !s.isProcessed).length;
    const totalDisbursement = salaries.reduce((sum, s) => sum + (s.isProcessed ? s.netSalary : 0), 0);
    const averageNet = salaries.length > 0 ? salaries.reduce((sum, s) => sum + s.netSalary, 0) / salaries.length : 0;

    return (
        <>
            <PageMeta title="Payroll Management" description="Process and monitor employee salaries" />
            <PageBreadcrumb pageTitle="Salary Records" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end gap-3">
                    <button
                        onClick={handleExportDetailedReport}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                    >
                        <DocumentArrowDownIcon className="h-5 w-5 text-white" />
                        <span className="text-white">Export Detailed Report</span>
                    </button>
                    <AddButton label="Generate Payslips" onClick={() => setIsGenerateModalOpen(true)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Records" value={salaries.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-6 w-6" />} />
                    <StatsCard label="Processed" value={totalProcessed} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-6 w-6" />} />
                    <StatsCard label="Draft" value={totalDraft} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-6 w-6" />} />
                    <StatsCard label="Total Disbursement" value={"Rs " + (totalDisbursement / 100000).toFixed(1) + "L"} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-6 w-6" />} />
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-2xl flex gap-3">
                        <div className="relative flex-1">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by employee name, code..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                        <div className="relative w-48">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="month"
                                value={filterMonth}
                                onChange={e => { setFilterMonth(e.target.value); setPage(1); }}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                disabled={salaries.length === 0}
                            >
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                    <button
                                        onClick={exportPDF}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                        Export PDF
                                    </button>
                                    <button
                                        onClick={exportExcel}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <TableCellsIcon className="h-4 w-4 text-green-600" />
                                        Export Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Print Button */}
                        <button
                            onClick={handlePrint}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            disabled={salaries.length === 0}
                        >
                            <PrinterIcon className="h-5 w-5 text-gray-600" />
                        </button>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={fetchAll}
                            className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors ${loading ? 'animate-spin' : ''}`}
                        >
                            <ArrowPathIcon className="h-5 w-5 text-gray-600" />
                        </button>

                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={selectedStatus}
                                    onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Status</option>
                                    <option value="processed">Processed</option>
                                    <option value="draft">Draft</option>
                                </select>
                            </div>
                            {selectedStatus && (
                                <button
                                    onClick={() => setSelectedStatus("")}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
                    <div className="overflow-x-auto overflow-y-visible" ref={printRef}>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        { key: "employee", label: "Employee" },
                                        { key: "month", label: "Month" },
                                        { key: "grossSalary", label: "Gross Salary" },
                                        { key: "netSalary", label: "Net Payable" },
                                        { key: "isProcessed", label: "Status" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof EmployeeSalary | "employee")}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof EmployeeSalary | "employee"} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                                <p className="text-gray-500 text-sm">Loading payroll records...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(salary => (
                                    <tr
                                        key={salary.id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                    <span className="text-xs font-medium text-cyan-700">
                                                        {salary.employee?.firstName?.charAt(0)}{salary.employee?.lastName?.charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {salary.employee?.firstName} {salary.employee?.lastName}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {salary.employee?.employeeCode}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                                                <span className="text-sm font-medium text-gray-900">{salary.month}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">₹{salary.grossSalary.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-cyan-600">₹{salary.netSalary.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {salary.isProcessed ? (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                                                    Processed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                                                    <ClockIcon className="h-3 w-3 mr-1" />
                                                    Draft
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewDetails(salary)}
                                                    title="View Details"
                                                    className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                                                >
                                                    <EyeIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => downloadPayslip(salary.employee.id, salary.month, `${salary.employee?.firstName} ${salary.employee?.lastName}`)}
                                                    title="Download Payslip"
                                                    className="p-1.5 rounded-md text-green-600 hover:bg-green-50 transition-colors"
                                                >
                                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setZipEmployee({ id: salary.employee.id, name: `${salary.employee.firstName} ${salary.employee.lastName}` });
                                                        setIsZipModalOpen(true);
                                                    }}
                                                    title="Download Range (ZIP)"
                                                    className="p-1.5 rounded-md text-purple-600 hover:bg-purple-50 transition-colors"
                                                >
                                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                                </button>
                                                {salary.isProcessed && (
                                                    <button
                                                        onClick={() => rollback(salary.id, `${salary.employee?.firstName} ${salary.employee?.lastName}`)}
                                                        title="Rollback"
                                                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <ArrowPathIcon className="h-5 w-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No payroll records found</p>
                                                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
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
                                            {Math.min(page * PAGE_SIZE, filtered.length)}
                                        </span>{' '}
                                        of <span className="font-medium">{filtered.length}</span> results
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

                {/* Process Payroll Modal */}
                {isProcessModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsProcessModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                Process Payroll
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Select Month
                                                    </label>
                                                    <input
                                                        type="month"
                                                        value={processMonth}
                                                        onChange={(e) => setProcessMonth(e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                                    <p className="text-sm text-yellow-800">
                                                        <strong>Warning:</strong> This action will mark all salary records for the selected month as processed.
                                                        This cannot be undone for individual records without a rollback operation.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={processAll}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Process Payroll
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsProcessModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Generate Payslips Modal */}
                {isGenerateModalOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsGenerateModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                Generate Payslips
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Select Month
                                                    </label>
                                                    <input
                                                        type="month"
                                                        value={generateMonth}
                                                        onChange={(e) => setGenerateMonth(e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                                    <p className="text-sm text-cyan-800">
                                                        <strong>Info:</strong> This action will generate payslips for all processed salary records in the selected month.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={generatePayslips}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Generate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsGenerateModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Download ZIP Modal */}
                {isZipModalOpen && zipEmployee && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsZipModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                Download Payslips (ZIP)
                                            </h3>
                                            <p className="text-sm text-gray-500 mb-4">
                                                Employee: <span className="font-semibold text-gray-900">{zipEmployee.name}</span>
                                            </p>
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            From Month
                                                        </label>
                                                        <input
                                                            type="month"
                                                            value={fromMonth}
                                                            onChange={(e) => setFromMonth(e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                                            To Month
                                                        </label>
                                                        <input
                                                            type="month"
                                                            value={toMonth}
                                                            onChange={(e) => setToMonth(e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                                    <p className="text-sm text-cyan-800">
                                                        <strong>Info:</strong> This will download a single ZIP file containing the payslips for the selected range.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={downloadZipRange}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Download ZIP
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsZipModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Details Modal */}
                {viewItem && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewItem(null)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Salary Details - {viewItem.month}
                                                </h3>
                                                <button
                                                    onClick={() => setViewItem(null)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">Employee Information</h4>
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <span className="text-gray-500">Name:</span>
                                                    <span className="font-medium">{viewItem.employee?.firstName} {viewItem.employee?.lastName}</span>
                                                    <span className="text-gray-500">Employee Code:</span>
                                                    <span className="font-medium">{viewItem.employee?.employeeCode}</span>
                                                    <span className="text-gray-500">Month:</span>
                                                    <span className="font-medium">{viewItem.month}</span>
                                                    <span className="text-gray-500">Status:</span>
                                                    <span className={`font-medium ${viewItem.isProcessed ? 'text-green-600' : 'text-yellow-600'}`}>
                                                        {viewItem.isProcessed ? 'Processed' : 'Draft'}
                                                    </span>
                                                </div>
                                            </div>

                                            {detailsLoading ? (
                                                <div className="flex justify-center p-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="mb-6">
                                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Earnings</h4>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-gray-500">Basic Salary:</span>
                                                                <span className="font-medium">₹{viewDetails?.basic?.toLocaleString() || 0}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-gray-500">HRA:</span>
                                                                <span className="font-medium">₹{viewDetails?.hra?.toLocaleString() || 0}</span>
                                                            </div>
                                                            {viewDetails?.earnings?.map((e: any, i: number) => (
                                                                <div key={i} className="flex justify-between text-sm">
                                                                    <span className="text-gray-500">{e.componentName || e.name || e.earningName}:</span>
                                                                    <span className="font-medium">₹{e.amount?.toLocaleString() || 0}</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                                                <span className="font-medium text-gray-700">Gross Salary:</span>
                                                                <span className="font-bold text-cyan-600">₹{viewDetails?.grossSalary?.toLocaleString() || viewItem.grossSalary?.toLocaleString() || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mb-6">
                                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Deductions</h4>
                                                        <div className="space-y-2">
                                                            {viewDetails?.deductions?.length > 0 ? viewDetails.deductions.map((d: any, i: number) => (
                                                                <div key={i} className="flex justify-between text-sm">
                                                                    <span className="text-gray-500">{d.componentName || d.name || d.deductionName}:</span>
                                                                    <span className="font-medium">₹{d.amount?.toLocaleString() || 0}</span>
                                                                </div>
                                                            )) : (
                                                                <div className="text-sm text-gray-500 italic">No deductions</div>
                                                            )}
                                                            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                                                <span className="font-medium text-gray-700">Total Deductions:</span>
                                                                <span className="font-bold text-red-600">₹{viewDetails?.totalDeductions?.toLocaleString() || 0}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            <div className="p-4 bg-cyan-50 rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-gray-700">Net Payable:</span>
                                                    <span className="text-2xl font-bold text-cyan-600">₹{viewItem.netSalary?.toLocaleString() || 0}</span>
                                                </div>
                                                <div className="mt-2 text-xs text-gray-500">
                                                    Payment Mode: {viewItem.paymentMode || "N/A"}
                                                    {viewItem.processedDate && ` • Processed: ${new Date(viewItem.processedDate).toLocaleDateString()}`}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() => downloadPayslip(viewItem.employee.id, viewItem.month, `${viewItem.employee?.firstName} ${viewItem.employee?.lastName}`)}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                                        Download Payslip
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewItem(null)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={confirmState.isOpen}
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmLabel={confirmState.confirmLabel}
                    cancelLabel={confirmState.cancelLabel}
                    variant={confirmState.variant}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            </div>
        </>
    );
};

export default PayrollPage;



