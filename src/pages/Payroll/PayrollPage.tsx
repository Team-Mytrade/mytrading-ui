import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import {
    EllipsisVerticalIcon,
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
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import PayslipPreviewModal from "../../components/Payroll/PayslipPreviewModal";
import { todayIso } from "../../utils/localDate";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";
import { PAGE_BODY, STATS_ROW, TOOL_BUTTON, TOOL_INPUT } from "./hrmsUi";
import { formatMoney, formatDate, companyCurrency } from "../../company/format";

const BASE_URL = "/v1/api/payroll";
const PAGE_SIZE = 10;

// File downloads ask for a blob, so an error's JSON body arrives as one too
const blobError = async (err: any, fallback: string) => {
    const data = err?.response?.data;
    if (data instanceof Blob) {
        try {
            const body = JSON.parse(await data.text());
            return body.message || body.error || fallback;
        } catch {
            return fallback;
        }
    }
    return apiError(err, fallback);
};

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
    status?: string;
    employeeName?: string;
    employeeCode?: string;
    otherAllowances?: number;
    [key: string]: any;
}

const PayrollPage: React.FC = () => {
  const { canCreate, canExport } = usePermissions();
    const [searchParams] = useSearchParams();
    const [salaries, setSalaries] = useState<EmployeeSalary[]>([]);
    const [search, setSearch] = useState(() => {
        const empCode = searchParams.get("employeeCode");
        const empName = searchParams.get("employeeName");
        return empCode || empName || "";
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [filterMonth, setFilterMonth] = useState(() => todayIso().slice(0, 7));
    const [viewItem, setViewItem] = useState<EmployeeSalary | null>(null);
    const [viewDetails, setViewDetails] = useState<any>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [generateMonth, setGenerateMonth] = useState("");
    const [isZipModalOpen, setIsZipModalOpen] = useState(false);
    const [zipEmployee, setZipEmployee] = useState<{ id: number, name: string } | null>(null);
    const [fromMonth, setFromMonth] = useState("");
    const [toMonth, setToMonth] = useState("");
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current!,
        documentTitle: "Salary Records",
    });

    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setShowExportMenu(false);
            }
        };
        if (showExportMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showExportMenu]);

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

            const merged = salaryData.map((s: any, index: number) => {
                const emp = employeeMap.get(s.employeeId) || s.employee || null;
                const empName = s.employeeName || (emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : `Employee #${s.employeeId || index}`);
                const empCode = s.employeeCode || emp?.employeeCode || '';
                const empLabel = `${empName}${empCode ? ` (${empCode})` : ''}`;

                const gross = s.grossSalary || 0;
                const net = s.netSalary || 0;
                const basic = s.basic || 0;
                const hra = s.hra || 0;
                const bonus = s.bonus || 0;
                const deductions = s.totalDeductions || 0;
                const isProc = !!s.processedDate || Boolean(s.isProcessed);
                const procDateStr = s.processedDate
                    ? formatDate(s.processedDate)
                    : "Pending Processing";

                // Enumerable properties visible in Table & drawer:
                // Columns order: employee, month, grossSalary, netSalary -> top 4 summary metric cards
                const rowItem: Record<string, any> = {
                    employee: empLabel,
                    month: s.month || filterMonth,
                    grossSalary: gross,
                    netSalary: net,
                    status: isProc ? "PROCESSED" : "DRAFT",
                    basic: basic,
                    hra: hra,
                    totalDeductions: deductions,
                    processedDate: procDateStr,
                };

                if (bonus > 0) {
                    rowItem.bonus = bonus;
                }

                const otherAllowances = (s.specialAllowance || 0) + (s.allowance || 0);
                if (otherAllowances > 0) {
                    rowItem.otherAllowances = otherAllowances;
                }

                // Non-enumerable properties: accessible by code, modals, actions, and downloads
                // id is the monthly salary record (what Rollback takes), never the employee id
                Object.defineProperties(rowItem, {
                    id: { value: s.employeeSalaryId ?? `row-${index}`, enumerable: false, writable: true },
                    payslipGenerated: { value: Boolean(s.payslipGenerated), enumerable: false, writable: true },
                    isProcessed: { value: isProc, enumerable: false, writable: true },
                    currency: { value: s.currency || companyCurrency(), enumerable: false, writable: true },
                    totalEarnings: { value: s.totalEarnings || gross, enumerable: false, writable: true },
                    employee: { value: emp, enumerable: false, writable: true },
                    rawEmployee: { value: emp, enumerable: false, writable: true },
                    employeeName: { value: empName, enumerable: false, writable: true },
                    employeeCode: { value: empCode, enumerable: false, writable: true },
                    tds: { value: s.tds || 0, enumerable: false, writable: true },
                    professionalTax: { value: s.professionalTax || 0, enumerable: false, writable: true },
                    pfEmployee: { value: s.pfEmployee || 0, enumerable: false, writable: true },
                    otherDeductions: { value: s.otherDeductions || 0, enumerable: false, writable: true },
                    paymentMode: { value: s.paymentMode || 'BANK_TRANSFER', enumerable: false, writable: true },
                    _raw: { value: s, enumerable: false, writable: true },
                });

                return rowItem as EmployeeSalary;
            });

            setSalaries(merged);
        } catch (err) {
            ToasterService.error(apiError(err, "Failed to load salary records"));
            setSalaries([]);
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
            ToasterService.error(apiError(err, "Failed to fetch detailed salary breakdown."));
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
            message: `Make the payslips of everyone paid for ${generateMonth} again? Existing payslips for the month are replaced.`,
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
            ToasterService.error(apiError(err, "Failed to generate payslips"));
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
            ToasterService.error(await blobError(err, "Failed to download ZIP file"));
        } finally {
            setLoading(false);
        }
    };

    const rollback = async (id: number, employeeName: string) => {
        const ok = await confirm({
            message: `Roll back ${employeeName}'s salary for ${filterMonth}? The payslip is removed and the run's bank transfer file no longer lists them.`,
            confirmLabel: "Rollback",
            variant: "danger",
        });
        if (!ok) return;

        try {
            await axios.post(`${BASE_URL}/rollback/${id}`);
            ToasterService.success("Salary rolled back", "Run payroll again to pay them for the month");
            await fetchAll();
        } catch (err: any) {
            ToasterService.error(apiError(err, "Rollback failed"));
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
            ToasterService.error(await blobError(err, "Failed to download payslip"));
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Payroll Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDate(new Date())}`, 14, 22);
        doc.text(`Total Records: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Employee", "Month", "Gross Salary", "Net Salary", "Status"]],
            body: filtered.map(s => [
                s.employee ? `${s.employee.firstName} ${s.employee.lastName}` : "N/A",
                s.month,
                formatMoney(s.grossSalary),
                formatMoney(s.netSalary),
                s.isProcessed ? "Processed" : "Draft"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Payroll_Report_${todayIso()}.pdf`);
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
            'Processed Date': s.processedDate ? formatDate(s.processedDate) : "N/A",
            'Payment Mode': s.paymentMode || "N/A",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payroll Report");
        XLSX.writeFile(wb, `Payroll_Report_${todayIso()}.xlsx`);
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
                        <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-[#222222] flex items-center justify-center mr-3 shrink-0">
                            <span className="text-xs font-medium text-cyan-700 dark:text-gray-300">
                                {initials}
                            </span>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-900 dark:text-white">
                                {fullName}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
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
                    <CalendarIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 shrink-0" />
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-300">{row.month}</span>
                </div>
            )
        },
        {
            key: "grossSalary",
            label: "Gross Salary",
            sortable: true,
            render: (row) => <span className="text-xs text-gray-900 dark:text-gray-300 font-mono">{formatMoney(row.grossSalary)}</span>
        },
        {
            key: "netSalary",
            label: "Net Payable",
            sortable: true,
            render: (row) => <span className="text-xs font-bold text-cyan-600 dark:text-gray-200 font-mono">{formatMoney(row.netSalary)}</span>
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            sortValueGetter: (row) => row.isProcessed ? 1 : 0,
            render: (row) => row.isProcessed ? (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-transparent dark:text-gray-300 dark:border dark:border-transparent">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                    Processed
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-transparent dark:text-gray-300 dark:border dark:border-transparent">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 shrink-0" />
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
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-gray-200 p-1.5 rounded-md transition-colors cursor-pointer"
                        title="View Details"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => downloadPayslip(row.employee?.id as number, row.month, `${row.employee?.firstName} ${row.employee?.lastName}`)}
                        disabled={!row.payslipGenerated}
                        className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-gray-200 p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={row.payslipGenerated ? "Download Payslip" : "Payslip not generated yet (Generate Payslips)"}
                    >
                        <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => {
                            setZipEmployee({ id: row.employee?.id as number, name: `${row.employee?.firstName} ${row.employee?.lastName}` });
                            setIsZipModalOpen(true);
                        }}
                        className="text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-gray-200 p-1.5 rounded-md transition-colors cursor-pointer"
                        title="Download Range (ZIP)"
                    >
                        <FolderArrowDownIcon className="h-3.5 w-3.5" />
                    </button>
                    {row.isProcessed && (
                        canCreate && <button
                            onClick={() => rollback(row.id, `${row.employee?.firstName} ${row.employee?.lastName}`)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 dark:bg-transparent dark:hover:bg-[#222222] dark:text-gray-400 dark:hover:text-rose-400 p-1.5 rounded-md transition-colors cursor-pointer"
                            title="Rollback"
                        >
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )
        }
    ];

    const location = useLocation();
    const isPayslipsView = location.pathname.includes("employeePayslips");

    const metaTitle = isPayslipsView ? "Employee Payslips" : "Payroll Management";
    const metaDescription = isPayslipsView ? "View, preview, and download employee payslips" : "Process and monitor employee salaries";
    const breadcrumbTitle = isPayslipsView ? "Payslips" : "Salary Records";
    const actionButtonLabel = isPayslipsView ? "Process Payroll" : "Process Payroll";

    return (
        <>
            <PageMeta title={metaTitle} description={metaDescription} />
            <PageBreadcrumb
                pageTitle={breadcrumbTitle}
                actions={
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={e => { setFilterMonth(e.target.value); }}
                            className={TOOL_INPUT}
                            aria-label="Payroll month"
                        />

                        {/* Export Menu */}
                        <div ref={exportMenuRef} className="relative">
                            {canExport && (<button
                                type="button"
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className={TOOL_BUTTON}
                                disabled={salaries.length === 0}
                                title="Export options"
                            >
                                <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                                Export
                            </button>)}

                            {showExportMenu && (
                                <div className="absolute right-0 top-9 w-48 bg-white dark:bg-[#191919] shadow-lg rounded-md border border-gray-200 dark:border-transparent z-50 py-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExportMenu(false);
                                            exportPDF();
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] cursor-pointer"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600 dark:text-gray-400" />
                                        Export PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExportMenu(false);
                                            exportExcel();
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] cursor-pointer"
                                    >
                                        <TableCellsIcon className="h-4 w-4 text-green-600 dark:text-gray-400" />
                                        Export Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        {canCreate && (
                            <button
                                type="button"
                                onClick={() => { setGenerateMonth(filterMonth); setIsGenerateModalOpen(true); }}
                                className={TOOL_BUTTON}
                                title="Make the month's payslips again"
                            >
                                <DocumentTextIcon className="h-3.5 w-3.5" />
                                Generate Payslips
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handlePrint}
                            className={TOOL_BUTTON}
                            disabled={salaries.length === 0}
                            title="Print"
                        >
                            <PrinterIcon className="h-3.5 w-3.5" />
                            Print
                        </button>

                        {/* Payroll is run (with its uploads and review) on the Payroll Engine page */}
                        <AddButton label={actionButtonLabel} permission="APPROVE" onClick={() => navigate("/payrollEngine")} />
                    </div>
                }
            />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label="Total Records" value={salaries.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<DocumentTextIcon className="h-5 w-5" />} />
                    <StatsCard label="Processed" value={totalProcessed} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-5 w-5" />} />
                    <StatsCard label="Draft" value={totalDraft} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-5 w-5" />} />
                    <StatsCard label="Total Disbursement" value={formatMoney(totalDisbursement, { compact: true })} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<BanknotesIcon className="h-5 w-5" />} onRefresh={fetchAll} />
                </div>

                {/* Table */}
                <div ref={printRef}>
                    <ReusableTable
                        data={filtered}
                        columns={columns}
                        loading={loading}
                        searchable={false}
                        pageSize={PAGE_SIZE}
                        defaultSortKey="month"
                        defaultSortOrder="desc"
                        rowDetailsTitle={(row) => `${row.employeeName || row.employee?.firstName || 'Employee'} - ${row.month} Payslip`}
                        rowDetailsSubtitle="Salary breakdown and net disbursement status"
                        emptyState={
                            <div className="flex flex-col items-center">
                                <BuildingOfficeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                <p className="text-gray-500 text-sm mb-2">No payroll records found</p>
                            </div>
                        }
                    />
                </div>

                {/* Generate Payslips Modal */}
                <PaginatedPopup
                    isOpen={isGenerateModalOpen}
                    title="Generate Payslips"
                    onClose={() => setIsGenerateModalOpen(false)}
                    onSubmit={(e) => {
                        e.preventDefault();
                        generatePayslips();
                    }}
                    submitLabel="Generate"
                    cancelLabel="Cancel"
                    maxWidthClassName="max-w-lg"
                    fields={[
                        <div key="select-month" className="col-span-2">
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
                        </div>,
                        <div key="info-box" className="col-span-2 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                            <p className="text-sm text-cyan-800">
                                <strong>Info:</strong> Payslips are made when payroll runs. This makes them again for everyone paid in the month (e.g. after a payslip went missing).
                            </p>
                        </div>
                    ]}
                />

                {/* Download ZIP Modal */}
                {zipEmployee && (
                    <PaginatedPopup
                        isOpen={isZipModalOpen}
                        title="Download Payslips (ZIP)"
                        subtitle={`Employee: ${zipEmployee.name}`}
                        onClose={() => setIsZipModalOpen(false)}
                        onSubmit={(e) => {
                            e.preventDefault();
                            downloadZipRange();
                        }}
                        submitLabel="Download ZIP"
                        cancelLabel="Cancel"
                        maxWidthClassName="max-w-lg"
                        fields={[
                            <div key="from-month">
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
                            </div>,
                            <div key="to-month">
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
                            </div>,
                            <div key="info-box-zip" className="col-span-2 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                <p className="text-sm text-cyan-800">
                                    <strong>Info:</strong> This will download a single ZIP file containing the payslips for the selected range.
                                </p>
                            </div>
                        ]}
                    />
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



