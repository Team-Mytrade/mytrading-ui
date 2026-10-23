import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
    CloudArrowDownIcon,
    ArrowPathIcon,
    DocumentArrowDownIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    DocumentPlusIcon,
    TrashIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentTextIcon,
    ArrowRightIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { ReusableTable, ColumnDef } from "../../components/common/Table";
import { usePermissions } from "../../access/usePermissions";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { apiError } from "../../utils/apiError";

export interface UploadedFile {
    fileName: string;
    type: string;
    totalAmount: number;
    employees?: number;
}

// What a run for the month would use (GET /excel/amount-summary)
interface MonthReview {
    month: string;
    responseList: UploadedFile[];
    attendanceUploaded: boolean;
    employeesToPay: number;
    alreadyPaid: number;
    employeesWithLossOfPay: number;
    totalEarnings: number;
    totalDeductions: number;
    problems: string[];
    warnings: string[];
}

type UploadKind = "earnings" | "deductions" | "attendance";

const localMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const rupees = (value: number | undefined) => `₹${(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Saves a downloaded file under the given name
const saveBlob = (data: BlobPart, fileName: string) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

const PayrollProcessingEnginePage: React.FC = () => {
  const { canApprove, canCreate, canDelete, canExport } = usePermissions();
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();
    const [workflowStep, setWorkflowStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
    const [batchInfo, setBatchInfo] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

    // Payroll can be run for this month or the previous one
    const currentMonth = localMonth(new Date());
    const previousMonth = localMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
    const [salaryMonth, setSalaryMonth] = useState(currentMonth);
    const [review, setReview] = useState<MonthReview | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [uploadKind, setUploadKind] = useState<UploadKind>("earnings");
    const [componentName, setComponentName] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [fullMonthConfirmed, setFullMonthConfirmed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFullMonthConfirmed(false);
        if (workflowStep >= 2) {
            fetchFiles();
        }
    }, [workflowStep, salaryMonth]);

    const toggleBatchExpansion = (batchRef: string) => {
        setExpandedBatch(prev => prev === batchRef ? null : batchRef);
    };

    // Lists the employees still to be paid that month, with an Amount column or attendance columns
    const handleDownloadTemplate = async (kind: "amounts" | "attendance") => {
        try {
            const response = await axios.get(`/v1/api/payroll/excel/template`, {
                params: { kind, payrollMonth: salaryMonth },
                responseType: 'blob',
            });
            saveBlob(response.data, kind === "attendance" ? `attendance_${salaryMonth}.xlsx` : `amounts_${salaryMonth}.xlsx`);
            ToasterService.success("Template downloaded");
        } catch (error) {
            ToasterService.error(apiError(error, "The template could not be downloaded"));
        }
    };

    const fetchFiles = async () => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const response = await axios.get(`/v1/api/payroll/excel/amount-summary`, {
                params: { payrollMonth: salaryMonth }
            });
            setReview(response.data);
        } catch (error: any) {
            // e.g. a file saved before uploads were checked can't be read
            setFetchError(apiError(error, "The month's files could not be read"));
            setReview(null);
        } finally {
            setIsFetching(false);
        }
    };

    // The server reads files by name: earnings_<Name>.xlsx, deductions_<Name>.xlsx, attendance_<YYYY-MM>.xlsx
    const uploadName = () => {
        if (uploadKind === "attendance") return `attendance_${salaryMonth}.xlsx`;
        const name = componentName.trim().replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "_");
        return name ? `${uploadKind}_${name}.xlsx` : "";
    };

    const handleFileUpload = async () => {
        if (!selectedFile) {
            ToasterService.warning("Choose the Excel file to upload");
            return;
        }
        const fileName = uploadName();
        if (!fileName) {
            ToasterService.warning(`Name the ${uploadKind === "earnings" ? "earning" : "deduction"} (e.g. Bonus); payslips show this name`);
            return;
        }

        setIsUploading(true);
        try {
            // Quick check of the columns before sending (the server checks every row)
            const workbook = XLSX.read(await selectedFile.arrayBuffer(), { type: 'array' });
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }) as any[][];
            const headers = (rows[0] || []).map(h => String(h).trim().toLowerCase());
            const needed = uploadKind === "attendance" ? ["working days", "lop days"] : ["amount"];
            const missing = needed.filter(h => !headers.includes(h));
            if (missing.length > 0) {
                ToasterService.error(`The file needs ${missing.map(h => `'${h}'`).join(" and ")} column${missing.length > 1 ? "s" : ""}`,
                    "Start from the downloaded template");
                return;
            }

            const formData = new FormData();
            formData.append("file", new File([selectedFile], fileName, { type: selectedFile.type }));
            await axios.post(`/v1/api/payroll/upload`, formData, {
                params: { payrollMonth: salaryMonth },
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            ToasterService.success(`${fileName} uploaded`);
            setSelectedFile(null);
            setComponentName("");
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            fetchFiles();
        } catch (error: any) {
            ToasterService.error(apiError(error, "The file could not be uploaded"));
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveFile = async (fileName: string) => {
        const ok = await confirm({
            message: `Remove ${fileName} from ${salaryMonth}? Its amounts will not be paid.`,
            confirmLabel: "Remove",
            variant: "danger",
        });
        if (!ok) return;
        try {
            await axios.delete(`/v1/api/payroll/upload`, { params: { payrollMonth: salaryMonth, fileName } });
            ToasterService.success(`${fileName} removed`);
            fetchFiles();
        } catch (error) {
            ToasterService.error(apiError(error, "The file could not be removed"));
        }
    };

    const handleProcessAll = async () => {
        if (!review) return;
        const ok = await confirm({
            message: `Pay ${review.employeesToPay} employee${review.employeesToPay === 1 ? "" : "s"} for ${salaryMonth}? `
                + "A bank transfer file and payslips are made for this run.",
            confirmLabel: "Run Payroll",
            variant: "info",
        });
        if (!ok) return;
        setIsProcessing(true);
        try {
            const { data } = await axios.post(`/v1/api/payroll/process-all`, {
                month: salaryMonth,
                withoutAttendance: !review.attendanceUploaded && fullMonthConfirmed,
            });
            ToasterService.success(`${data.batchReference}: ${data.employeeCount} employee${data.employeeCount === 1 ? "" : "s"} paid, ${rupees(data.totalNetSalary)} in total`,
                data.payslipProblem ? undefined : `${data.payslipsGenerated} payslip${data.payslipsGenerated === 1 ? "" : "s"} ready`);
            if (data.payslipProblem) {
                ToasterService.warning("Payslips were not made", data.payslipProblem, 8000);
            }
            setWorkflowStep(1);
            setActiveTab('history');
            fetchBatchInfo();
        } catch (error) {
            ToasterService.error(apiError(error, "Payroll could not be run"));
            fetchFiles();
        } finally {
            setIsProcessing(false);
        }
    };

    const fetchBatchInfo = async () => {
        try {
            const response = await axios.get(`/v1/api/payroll/getPayrollBatchInfo`);
            setBatchInfo(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            ToasterService.error(apiError(error, "Payroll runs could not be loaded"));
        }
    };

    const handleDownloadReport = async (batchReference: string, salaryMonth: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/bank-transfer-export/${batchReference}`, {
                responseType: 'blob',
            });
            saveBlob(response.data, `Bank_Transfer_${batchReference}.xlsx`);
            ToasterService.success("Bank transfer file downloaded");
        } catch (error: any) {
            // Error bodies come back as blobs here
            const text = error?.response?.data instanceof Blob ? await error.response.data.text() : "";
            let message = "";
            try { message = JSON.parse(text).message; } catch { message = ""; }
            ToasterService.error(message || apiError(error, `The bank file of ${salaryMonth} could not be downloaded`));
        }
    };

    const handleDownloadPayslip = async (employeeId: number, month: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/payslips/download`, {
                params: { employeeId, month },
                responseType: 'blob',
            });
            saveBlob(response.data, `Payslip_${employeeId}_${month}.pdf`);
            ToasterService.success("Payslip downloaded successfully");
        } catch (error) {
            ToasterService.error(apiError(error, "The payslip could not be downloaded"));
        }
    };

    const uploadedFiles = review?.responseList ?? [];
    const problems = review?.problems ?? [];
    const canRun = !!review && review.employeesToPay > 0 && problems.length === 0
        && (review.attendanceUploaded || fullMonthConfirmed);
    const stepLabels = ["Templates", "Upload", "Review & Run"];

    return (
        <>
            <PageMeta title="Payroll Processing Engine" description="Run the end-to-end payroll processing workflow" />
            <PageBreadcrumb pageTitle="Payroll Engine" />

            <div className="w-full max-w-none px-0 py-8">
                <div className="bg-white dark:bg-[#191919] rounded-xl shadow-sm border border-gray-200 dark:!border-transparent overflow-hidden">
                    <div className="p-4 sm:p-6">
                        {/* Tabs */}
                        <div className="border-b border-gray-200 dark:border-transparent mb-4">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button
                                    onClick={() => setActiveTab('process')}
                                    className={`${activeTab === 'process' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-transparent'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer`}
                                >
                                    Process Payroll
                                </button>
                                <button
                                    onClick={() => { setActiveTab('history'); fetchBatchInfo(); }}
                                    className={`${activeTab === 'history' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-transparent'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer`}
                                >
                                    Batch History
                                </button>
                            </nav>
                        </div>

                        {activeTab === 'process' && (
                            <>
                                {/* The month every step works on */}
                                <div className="mb-5 flex flex-col sm:flex-row sm:items-end gap-3">
                                    <div className="w-full sm:w-56">
                                        <label htmlFor="salaryMonth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Payroll Month <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="month"
                                            id="salaryMonth"
                                            value={salaryMonth}
                                            min={previousMonth}
                                            max={currentMonth}
                                            onChange={(e) => setSalaryMonth(e.target.value || currentMonth)}
                                            className="block w-full text-sm text-gray-900 dark:text-gray-200 px-3 py-2 border border-gray-300 dark:border-transparent rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500 bg-white dark:bg-[#222222] cursor-pointer [color-scheme:dark]"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 sm:pb-2">
                                        Payroll can be run for {previousMonth} or {currentMonth}. Each run pays everyone due who isn't paid for the month yet.
                                    </p>
                                </div>

                                {/* Stepper */}
                                <div className="mb-6 relative max-w-3xl mx-auto">
                                    <div className="absolute inset-x-0 top-5 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t-2 border-gray-200 dark:border-[#2a2a2a]"></div>
                                    </div>
                                    <div className="relative flex justify-between">
                                        {stepLabels.map((label, index) => {
                                            const step = index + 1;
                                            return (
                                                <button key={step} type="button" onClick={() => setWorkflowStep(step)}
                                                    className="bg-white dark:bg-[#191919] px-3 flex flex-col items-center gap-1 cursor-pointer">
                                                    <span className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-[#191919] font-semibold text-lg ${workflowStep >= step ? 'bg-cyan-600 text-white shadow-md' : 'bg-gray-100 dark:bg-[#222222] text-gray-500 dark:text-gray-400'}`}>
                                                        {step}
                                                    </span>
                                                    <span className={`text-xs ${workflowStep === step ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Step 1: templates */}
                                {workflowStep === 1 && (
                                    <div className="text-center py-4">
                                        <CloudArrowDownIcon className="mx-auto h-12 w-12 text-cyan-500 dark:text-gray-400 mb-3" />
                                        <h4 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">Download Templates</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5 max-w-xl mx-auto">
                                            Each template lists the employees still to be paid for {salaryMonth}. Fill in the Amount column for a
                                            one-off earning (e.g. Bonus) or deduction (e.g. Salary Advance), and the LOP days in the attendance template.
                                        </p>
                                        {canExport && (
                                            <div className="flex flex-col sm:flex-row justify-center gap-3">
                                                <button
                                                    onClick={() => handleDownloadTemplate("amounts")}
                                                    className="inline-flex items-center justify-center px-5 py-2.5 shadow-sm text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 cursor-pointer"
                                                >
                                                    <CloudArrowDownIcon className="-ml-1 mr-2 h-5 w-5" />
                                                    Earnings / Deductions Template
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadTemplate("attendance")}
                                                    className="inline-flex items-center justify-center px-5 py-2.5 shadow-sm text-sm font-medium rounded-lg text-cyan-700 dark:text-gray-200 bg-cyan-50 dark:bg-[#222222] hover:bg-cyan-100 dark:hover:bg-[#2a2a2a] cursor-pointer"
                                                >
                                                    <CloudArrowDownIcon className="-ml-1 mr-2 h-5 w-5" />
                                                    Attendance Template
                                                </button>
                                            </div>
                                        )}
                                        <div className="mt-5 flex justify-center">
                                            <button onClick={() => setWorkflowStep(2)} className="text-gray-500 hover:text-cyan-600 dark:text-gray-400 dark:hover:text-cyan-400 text-sm font-medium flex items-center cursor-pointer">
                                                Continue to Upload <ArrowRightIcon className="ml-1 w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: upload */}
                                {workflowStep === 2 && (
                                    <div className="py-2">
                                        {canCreate && (
                                            <div className="mb-6 rounded-xl border border-gray-200 dark:border-transparent bg-gray-50 dark:bg-[#222222] p-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                                    <div>
                                                        <label htmlFor="uploadKind" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</label>
                                                        <select
                                                            id="uploadKind"
                                                            value={uploadKind}
                                                            onChange={(e) => setUploadKind(e.target.value as UploadKind)}
                                                            className="block w-full text-sm px-3 py-2 border border-gray-300 dark:border-transparent rounded-md bg-white dark:bg-[#191919] text-gray-900 dark:text-gray-200"
                                                        >
                                                            <option value="earnings">One-off earning</option>
                                                            <option value="deductions">One-off deduction</option>
                                                            <option value="attendance">Attendance</option>
                                                        </select>
                                                    </div>
                                                    {uploadKind !== "attendance" ? (
                                                        <div>
                                                            <label htmlFor="componentName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                Name on payslips <span className="text-red-500">*</span>
                                                            </label>
                                                            <input
                                                                id="componentName"
                                                                type="text"
                                                                value={componentName}
                                                                maxLength={40}
                                                                onChange={(e) => setComponentName(e.target.value)}
                                                                placeholder={uploadKind === "earnings" ? "e.g. Bonus" : "e.g. Salary Advance"}
                                                                className="block w-full text-sm px-3 py-2 border border-gray-300 dark:border-transparent rounded-md bg-white dark:bg-[#191919] text-gray-900 dark:text-gray-200"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 md:pb-2">
                                                            One attendance file per month; uploading again replaces it.
                                                        </p>
                                                    )}
                                                    <div>
                                                        <label htmlFor="payrollFile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Excel file (.xlsx)</label>
                                                        <input
                                                            id="payrollFile"
                                                            type="file"
                                                            ref={fileInputRef}
                                                            accept=".xlsx"
                                                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                            className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 dark:file:bg-[#191919] file:text-cyan-700 dark:file:text-gray-200"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {uploadName() ? <>Saved as <span className="font-mono">{uploadName()}</span>; a file with the same name is replaced.</> : "Name the earning or deduction to upload it."}
                                                    </p>
                                                    <button
                                                        onClick={handleFileUpload}
                                                        disabled={isUploading || !selectedFile}
                                                        className="inline-flex items-center justify-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {isUploading ? <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" /> : <DocumentPlusIcon className="-ml-1 mr-2 h-5 w-5" />}
                                                        Upload
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-base font-semibold text-gray-900 dark:text-white">Files for {salaryMonth}</h4>
                                            <button
                                                onClick={fetchFiles}
                                                disabled={isFetching}
                                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-transparent text-sm rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-[#222222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer"
                                            >
                                                <ArrowPathIcon className={`-ml-0.5 mr-1.5 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                                                Refresh
                                            </button>
                                        </div>

                                        {fetchError && (
                                            <div className="mb-4 bg-red-50 dark:bg-[#222222] border-l-4 border-red-500 p-3 rounded-md text-sm text-red-700 dark:text-red-400">{fetchError}</div>
                                        )}

                                        {uploadedFiles.length > 0 ? (
                                            // A plain table: a month has a handful of files, all shown at once
                                            <div className="mb-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-transparent">
                                                <table className="min-w-full text-sm" data-testid="uploaded-files">
                                                    <thead className="bg-gray-50 dark:bg-[#222222] text-xs uppercase text-gray-500 dark:text-gray-400">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left font-medium">File</th>
                                                            <th className="px-4 py-2 text-left font-medium">Type</th>
                                                            <th className="px-4 py-2 text-center font-medium">Employees</th>
                                                            <th className="px-4 py-2 text-right font-medium">Total</th>
                                                            <th className="px-2 py-2"><span className="sr-only">Remove</span></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-[#2a2a2a]">
                                                        {uploadedFiles.map((file) => (
                                                            <tr key={file.fileName}>
                                                                <td className="px-4 py-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <DocumentTextIcon className="h-5 w-5 text-gray-400 shrink-0" />
                                                                        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[240px] block">{file.fileName}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium dark:bg-transparent ${file.type === 'earnings' ? 'bg-green-100 text-green-800 dark:text-gray-300' : file.type === 'deductions' ? 'bg-red-100 text-red-800 dark:text-gray-300' : 'bg-blue-100 text-blue-800 dark:text-gray-300'}`}>
                                                                        {file.type}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">{file.employees ?? "—"}</td>
                                                                <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                                                                    {file.type === 'attendance' ? `${file.totalAmount} LOP days` : rupees(file.totalAmount)}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">
                                                                    {canDelete && (
                                                                        <button
                                                                            onClick={() => handleRemoveFile(file.fileName)}
                                                                            className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-[#222222] cursor-pointer"
                                                                            title={`Remove ${file.fileName}`}
                                                                        >
                                                                            <TrashIcon className="h-4 w-4" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : !isFetching && !fetchError && (
                                            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                                                Nothing uploaded for {salaryMonth}. One-off amounts are optional; attendance sets loss of pay.
                                            </div>
                                        )}

                                        <div className="flex justify-center gap-4 mt-6">
                                            <button
                                                onClick={() => setWorkflowStep(1)}
                                                className="inline-flex items-center px-6 py-2.5 border border-gray-300 dark:border-transparent shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-[#222222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] cursor-pointer"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setWorkflowStep(3)}
                                                disabled={!!fetchError}
                                                className="inline-flex items-center px-6 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                Review
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: review and run */}
                                {workflowStep === 3 && (
                                    <div className="py-2">
                                        {isFetching && !review ? (
                                            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">Checking {salaryMonth}...</div>
                                        ) : review && (
                                            <>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5" data-testid="run-review">
                                                    {[
                                                        { label: "Employees to pay", value: String(review.employeesToPay) },
                                                        { label: "Already paid this month", value: String(review.alreadyPaid) },
                                                        { label: "One-off earnings", value: rupees(review.totalEarnings) },
                                                        { label: "One-off deductions", value: rupees(review.totalDeductions) },
                                                    ].map((card) => (
                                                        <div key={card.label} className="rounded-xl border border-gray-200 dark:border-transparent bg-gray-50 dark:bg-[#222222] p-3">
                                                            <div className="text-xs text-gray-500 dark:text-gray-400">{card.label}</div>
                                                            <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{card.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {problems.length > 0 && (
                                                    <div className="mb-4 rounded-md border-l-4 border-red-500 bg-red-50 dark:bg-[#222222] p-3">
                                                        <div className="flex items-center gap-2 text-sm font-semibold text-red-800 dark:text-red-400">
                                                            <XCircleIcon className="h-5 w-5" /> Fix before running payroll
                                                        </div>
                                                        <ul className="mt-2 list-disc pl-6 text-sm text-red-700 dark:text-gray-300 space-y-0.5">
                                                            {problems.map((p) => <li key={p}>{p}</li>)}
                                                        </ul>
                                                    </div>
                                                )}

                                                {review.warnings.length > 0 && (
                                                    <div className="mb-4 rounded-md border-l-4 border-amber-500 bg-amber-50 dark:bg-[#222222] p-3">
                                                        <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-gray-300 space-y-0.5">
                                                            {review.warnings.map((w) => <li key={w}>{w}</li>)}
                                                        </ul>
                                                    </div>
                                                )}

                                                {review.employeesToPay > 0 && (review.attendanceUploaded ? (
                                                    <div className="mb-5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-gray-400" />
                                                        Attendance uploaded: {review.employeesWithLossOfPay} employee{review.employeesWithLossOfPay === 1 ? "" : "s"} with loss of pay.
                                                    </div>
                                                ) : (
                                                    <label className="mb-5 flex items-start gap-3 rounded-md border border-amber-200 dark:border-transparent bg-amber-50 dark:bg-[#222222] p-3 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={fullMonthConfirmed}
                                                            onChange={(e) => setFullMonthConfirmed(e.target.checked)}
                                                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600"
                                                        />
                                                        <span className="text-sm text-amber-900 dark:text-gray-300">
                                                            No attendance is uploaded for {salaryMonth}. Pay everyone for the full month (no loss of pay).
                                                        </span>
                                                    </label>
                                                ))}

                                                <div className="text-center">
                                                    {canApprove && (<button
                                                        onClick={handleProcessAll}
                                                        disabled={isProcessing || !canRun}
                                                        className="inline-flex items-center px-8 py-3 border border-transparent shadow-lg text-base font-medium rounded-xl text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                    >
                                                        {isProcessing ? (
                                                            <><ArrowPathIcon className="animate-spin -ml-1 mr-3 h-5 w-5" /> Running payroll...</>
                                                        ) : `Run Payroll for ${salaryMonth}`}
                                                    </button>)}
                                                    {review.employeesToPay === 0 && (
                                                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                                            {review.alreadyPaid > 0 ? `Everyone due pay for ${salaryMonth} is already paid.` : `No employees are due pay for ${salaryMonth}.`}
                                                        </p>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                        {fetchError && (
                                            <div className="mb-4 bg-red-50 dark:bg-[#222222] border-l-4 border-red-500 p-3 rounded-md text-sm text-red-700 dark:text-red-400">{fetchError}</div>
                                        )}

                                        <div className="flex justify-center mt-8">
                                            <button onClick={() => setWorkflowStep(2)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium cursor-pointer">
                                                ← Back to Upload
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Batch Processing Status (History Tab) */}
                        {activeTab === 'history' && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xl font-semibold text-gray-900 dark:text-white">Batch Processing Status</h4>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={fetchBatchInfo}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-transparent shadow-sm text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-[#222222] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                                        >
                                            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
                                            Refresh
                                        </button>
                                    </div>
                                </div>

                                <ReusableTable
                                    data={batchInfo.map((b, i) => ({ ...b, id: b.batchReference || i }))}
                                    columns={[
                                        { key: "batchReference", label: "Batch Reference", sortable: true },
                                        { key: "salaryMonth", label: "Salary Month", sortable: true },
                                        {
                                            key: "employeeCount",
                                            label: "Employees",
                                            sortable: true,
                                            className: "text-center",
                                            headerClassName: "text-center"
                                        },
                                        {
                                            key: "totalSalaryAmount",
                                            label: "Total Amount",
                                            sortable: true,
                                            className: "text-center font-semibold text-gray-900 dark:text-white",
                                            headerClassName: "text-center",
                                            render: (row: any) => rupees(row.totalSalaryAmount)
                                        },
                                        {
                                            key: "status",
                                            label: "Status",
                                            sortable: true,
                                            render: (row: any) => (
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold dark:bg-transparent dark:border-transparent ${row.status === 'COMPLETED' ? 'bg-green-100 text-green-800 dark:text-gray-300' : 'bg-yellow-100 text-yellow-800 dark:text-gray-400'}`}>
                                                    {row.status}
                                                </span>
                                            )
                                        },
                                        {
                                            key: "action",
                                            label: "Action",
                                            className: "text-right",
                                            headerClassName: "text-right",
                                            render: (row: any) => (
                                                canExport && <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadReport(row.batchReference, row.salaryMonth); }}
                                                    className="text-cyan-600 hover:text-cyan-900 dark:text-gray-400 dark:hover:text-gray-200 bg-cyan-50 dark:bg-[#222222] p-2.5 rounded-full transition-colors inline-block cursor-pointer"
                                                    title="Download Bank Report"
                                                >
                                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                                </button>
                                            )
                                        }
                                    ]}
                                    searchable={false}
                                    pageSize={10}
                                    className="dark:border-transparent [&_.common-data-table]:dark:!border-transparent"
                                    emptyState={
                                        <div className="flex flex-col items-center py-12 text-gray-500 dark:text-gray-400">
                                            <DocumentTextIcon className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-3" />
                                            <p className="text-sm">No payroll runs yet. Each run, with its bank transfer file, appears here.</p>
                                        </div>
                                    }
                                />

                            </div>
                        )}
                    </div>
                </div>
            </div>
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
        </>
    );
};

export default PayrollProcessingEnginePage;
