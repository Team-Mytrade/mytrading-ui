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
    FolderArrowDownIcon,
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
import { Menu, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import PayslipPreviewModal from "../../components/Payroll/PayslipPreviewModal";

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

    // Calculate stats from real data
    const totalProcessed = salaries.filter(s => s.isProcessed).length;
    const totalDraft = salaries.filter(s => !s.isProcessed).length;
    const totalDisbursement = salaries.reduce((sum, s) => sum + (s.isProcessed ? s.netSalary : 0), 0);
    const averageNet = salaries.length > 0 ? salaries.reduce((sum, s) => sum + s.netSalary, 0) / salaries.length : 0;

    const columns: ColumnDef<EmployeeSalary>[] = [
        {
            key: "employee",
            label: "Employee",
            sortable: true,
            sortValueGetter: (row) => row.employee ? `${row.employee.firstName} ${row.employee.lastName}`.trim() : "",
            render: (row) => {
                const fullName = row.employee ? `${row.employee.firstName} ${row.employee.lastName}`.trim() : "—";
                const initials = row.employee ? `${row.employee.firstName?.charAt(0) || ''}${row.employee?.lastName?.charAt(0) || ''}`.toUpperCase() : 'E';
                return (
                    <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3 shrink-0">
                            <span className="text-xs font-medium text-cyan-700">
                                {initials}
                            </span>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-900">
                                {fullName}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                                {row.employee?.employeeCode || "—"}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            key: "month",
            label: "Month",
            sortable: true,
            render: (row) => (
                <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 text-gray-400 mr-2 shrink-0" />
                    <span className="text-xs font-medium text-gray-900">{row.month}</span>
                </div>
            )
        },
        {
            key: "grossSalary",
            label: "Gross Salary",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-900">₹{row.grossSalary.toLocaleString()}</span>
        },
        {
            key: "netSalary",
            label: "Net Payable",
            sortable: true,
            render: (row) => <span className="text-xs font-bold text-cyan-600">₹{row.netSalary.toLocaleString()}</span>
        },
        {
            key: "isProcessed",
            label: "Status",
            sortable: true,
            render: (row) => row.isProcessed ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" />
                    Processed
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                    <ClockIcon className="h-3 w-3 mr-1 shrink-0" />
                    Draft
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-44",
            className: "text-right w-44",
            render: (row) => (
                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => handleViewDetails(row)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 p-1 rounded-md transition-colors"
                        title="View Details"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => downloadPayslip(row.employee?.id as number, row.month, `${row.employee?.firstName} ${row.employee?.lastName}`)}
                        className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 p-1 rounded-md transition-colors"
                        title="Download Payslip"
                    >
                        <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => {
                            setZipEmployee({ id: row.employee?.id as number, name: `${row.employee?.firstName} ${row.employee?.lastName}` });
                            setIsZipModalOpen(true);
                        }}
                        className="text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 p-1 rounded-md transition-colors"
                        title="Download Range (ZIP)"
                    >
                        <FolderArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                    {row.isProcessed && (
                        <button
                            onClick={() => rollback(row.id, `${row.employee?.firstName} ${row.employee?.lastName}`)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 p-1 rounded-md transition-colors"
                            title="Rollback"
                        >
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    return (
        <>
            <PageMeta title="Payroll Management" description="Process and monitor employee salaries" />
            <PageBreadcrumb pageTitle="Salary Records" />

            <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
                <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                    <AddButton label="Run Payroll" onClick={() => setIsProcessModalOpen(true)} />
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
                                onChange={e => { setSearch(e.target.value); }}
                                className="h-10 pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                        <div className="relative w-48">
                            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="month"
                                value={filterMonth}
                                onChange={e => { setFilterMonth(e.target.value); }}
                                className="h-10 pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <AddButton label="Generate Payslips" className="h-10 !my-0" onClick={() => setIsGenerateModalOpen(true)} />

                        {/* Export Menu */}
                        <div className="relative flex h-10 items-center">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="h-10 w-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
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
                            className="h-10 w-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors !my-0"
                            disabled={salaries.length === 0}
                        >
                            <PrinterIcon className="h-5 w-5 text-gray-600" />
                        </button>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`h-10 w-10 flex items-center justify-center border rounded-lg transition-colors !my-0 ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <FunnelIcon className="h-5 w-5 text-gray-600" />
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={fetchAll}
                            className={`h-10 w-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors !my-0 ${loading ? 'animate-spin' : ''}`}
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
                                    onChange={e => { setSelectedStatus(e.target.value); }}
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
                <div ref={printRef}>
                    <ReusableTable
                        className="[&_th]:!px-2 [&_td]:!px-2"
                        data={filtered}
                        columns={columns}
                        loading={loading}
                        searchable={false}
                        pageSize={PAGE_SIZE}
                        defaultSortKey="month"
                        defaultSortOrder="desc"
                        emptyState={
                            <div className="flex flex-col items-center">
                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                <p className="text-gray-500 text-sm mb-2">No payroll records found</p>
                            </div>
                        }
                    />
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
                <PayslipPreviewModal
                    isOpen={!!viewItem}
                    onClose={() => setViewItem(null)}
                    payslipData={viewDetails}
                    month={viewItem?.month || ""}
                    loading={detailsLoading}
                    onDownload={() => {
                        if (viewItem?.employee?.id && viewItem?.month) {
                            downloadPayslip(
                                viewItem.employee.id, 
                                viewItem.month, 
                                `${viewItem.employee.firstName} ${viewItem.employee.lastName}`
                            );
                        }
                    }}
                />

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



