import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
    CloudArrowDownIcon,
    ArrowPathIcon,
    CogIcon,
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

export interface UploadedFile {
    fileName: string;
    type: string;
    totalAmount: number;
}

const PayrollProcessingEnginePage: React.FC = () => {
    const [workflowStep, setWorkflowStep] = useState(1);
    const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
    const [batchInfo, setBatchInfo] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

    // Step 2 State
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [summaryData, setSummaryData] = useState({ totalDeductions: 0, totalEarnings: 0 });
    const [salaryMonth, setSalaryMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (workflowStep === 2) {
            fetchFiles();
        }
    }, [workflowStep]);

    const toggleBatchExpansion = (batchRef: string) => {
        setExpandedBatch(prev => prev === batchRef ? null : batchRef);
    };

    const handleDownloadTemplate = async () => {
        try {
            const response = await axios.get(`/v1/api/payroll/employee/export`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            const now = new Date();
            const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
            link.setAttribute('download', `employees_${timestamp}.xlsx`);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            ToasterService.success("Template downloaded successfully");
            setWorkflowStep(2);
        } catch (error) {
            console.error("Error downloading template:", error);
            ToasterService.error("Failed to download template");
        }
    };

    const fetchFiles = async () => {
        setIsFetching(true);
        setFetchError(null);
        try {
            const response = await axios.get(`/v1/api/payroll/excel/amount-summary`, {
                params: { payrollMonth: salaryMonth }
            });
            if (response.data && response.data.responseList) {
                setUploadedFiles(response.data.responseList);
                calculateSummary(response.data.responseList);
            } else if (response.data && response.data.error) {
                setFetchError(response.data.error);
                setUploadedFiles([]);
                setSummaryData({ totalDeductions: 0, totalEarnings: 0 });
            }
        } catch (error: any) {
            console.error("Error fetching files:", error);
            const errorMsg = error.response?.data?.error || "Failed to fetch file summary from server.";
            setFetchError(errorMsg);
            setUploadedFiles([]);
            setSummaryData({ totalDeductions: 0, totalEarnings: 0 });
        } finally {
            setIsFetching(false);
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile) {
            ToasterService.warning("Please select a file to upload");
            return;
        }

        const lowerName = selectedFile.name.toLowerCase();
        if (!lowerName.startsWith("deductions_") && !lowerName.startsWith("earnings_")) {
            ToasterService.error("File name must start with 'deductions_' or 'earnings_'");
            return;
        }

        setIsUploading(true);

        try {
            // Validate "Amount" column locally
            const fileData = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(fileData, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

            if (jsonData.length === 0) {
                throw new Error("The uploaded Excel file is empty.");
            }

            const headers = jsonData[0]?.map(h => String(h).trim().toLowerCase()) || [];
            if (!headers.includes("amount")) {
                throw new Error("The file must contain an 'Amount' column.");
            }

            const formData = new FormData();
            formData.append("file", selectedFile);

            await axios.post(`/v1/api/payroll/upload?payrollMonth=${salaryMonth}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            ToasterService.success("File uploaded successfully");
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            fetchFiles(); // refresh the files after upload
        } catch (error: any) {
            console.error("Error uploading file:", error);
            ToasterService.error(error.message || error.response?.data?.message || "Failed to upload file");
        } finally {
            setIsUploading(false);
        }
    };

    const calculateSummary = (files: UploadedFile[]) => {
        let ded = 0;
        let earn = 0;
        files.forEach(f => {
            const amount = f.totalAmount || 0;
            if (f.type?.toLowerCase() === 'deductions') ded += amount;
            if (f.type?.toLowerCase() === 'earnings') earn += amount;
        });
        setSummaryData({ totalDeductions: ded, totalEarnings: earn });
    };

    const handleProcessAll = async () => {
        if (!salaryMonth) {
            ToasterService.error("Please enter the salary month (e.g., 2026-06)");
            return;
        }

        const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        if (salaryMonth > currentMonth) {
            ToasterService.error("Future date payroll run is not allowed");
            return;
        }
        setIsProcessing(true);
        try {
            await axios.post(`/v1/api/payroll/process-all`, {
                month: salaryMonth,
                yearMonth: salaryMonth,
                salaryMonth: salaryMonth
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            ToasterService.success("Payroll process triggered successfully");
            setWorkflowStep(1);
            setActiveTab('history');
            fetchBatchInfo();
        } catch (error) {
            console.error("Error triggering payroll:", error);
            ToasterService.error("Failed to trigger payroll process");
        } finally {
            setIsProcessing(false);
        }
    };

    const fetchBatchInfo = async () => {
        try {
            const response = await axios.get(`/v1/api/payroll/getPayrollBatchInfo`);
            setBatchInfo(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Error fetching batch info:", error);
            ToasterService.error("Failed to fetch batch info");
        }
    };

    const handleDownloadReport = async (batchReference: string, salaryMonth: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/bank-transfer-export/${batchReference}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Bank_Report_${batchReference}.xlsx`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            ToasterService.success("Bank report downloaded successfully");
        } catch (error) {
            console.error("Error downloading report:", error);
            ToasterService.error("Failed to download bank report");
        }
    };

    const handleDownloadPayslip = async (employeeId: number, month: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/payslips/download`, {
                params: { employeeId, month },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Payslip_${employeeId}_${month}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            ToasterService.success("Payslip downloaded successfully");
        } catch (error) {
            console.error("Error downloading payslip:", error);
            ToasterService.error("Failed to download payslip");
        }
    };

    return (
        <>
            <PageMeta title="Payroll Processing Engine" description="Run the end-to-end payroll processing workflow" />
            <PageBreadcrumb pageTitle="Payroll Engine" />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-0 -mt-2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
                        <CogIcon className="h-6 w-6 text-cyan-600" />
                        <h3 className="text-xl leading-6 font-bold text-gray-900">
                            Payroll Processing Engine
                        </h3>
                    </div>

                    <div className="p-4 sm:p-6">
                        {/* Tabs */}
                        <div className="border-b border-gray-200 mb-4">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button
                                    onClick={() => setActiveTab('process')}
                                    className={`${activeTab === 'process' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
                                >
                                    Process Payroll
                                </button>
                                <button
                                    onClick={() => { setActiveTab('history'); fetchBatchInfo(); }}
                                    className={`${activeTab === 'history' ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors`}
                                >
                                    Batch History
                                </button>
                            </nav>
                        </div>

                        {activeTab === 'process' && (
                            <>
                                {/* Stepper */}
                                <div className="mb-6 relative max-w-3xl mx-auto">
                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                        <div className="w-full border-t-2 border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-between">
                                        {[1, 2, 3, 4].map((step) => (
                                            <div key={step} className="bg-white px-4">
                                                <span className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-white font-semibold text-lg ${workflowStep >= step ? 'bg-cyan-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                                                    {step}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Step 1 */}
                                {workflowStep === 1 && (
                                    <div className="text-center py-4">
                                        <CloudArrowDownIcon className="mx-auto h-12 w-12 text-cyan-500 mb-3" />
                                        <h4 className="text-2xl font-semibold text-gray-900 mb-2">Download Employee Template</h4>
                                        <p className="text-base text-gray-600 mb-4 max-w-xl mx-auto">
                                            First, download the Excel sheet containing basic info of all employees. After downloading, you can add different deductions/earnings for each employee.
                                        </p>

                                        <button
                                            onClick={handleDownloadTemplate}
                                            className="inline-flex items-center px-6 py-3 border border-transparent shadow-md text-base font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-all hover:scale-105"
                                        >
                                            <CloudArrowDownIcon className="-ml-1 mr-2 h-6 w-6" />
                                            Download Template
                                        </button>

                                        <div className="mt-4 flex justify-center">
                                            <button onClick={() => setWorkflowStep(2)} className="text-gray-500 hover:text-cyan-600 text-sm font-medium flex items-center">
                                                Skip to Upload Step <ArrowRightIcon className="ml-1 w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 2: Upload Files */}
                                {workflowStep === 2 && (
                                    <div className="py-4">
                                        <div className="text-center mb-8">
                                            <DocumentTextIcon className="mx-auto h-16 w-16 text-cyan-500 mb-4" />
                                            <h4 className="text-2xl font-semibold text-gray-900 mb-2">Upload and Review Processed Templates</h4>
                                            <p className="text-gray-600 max-w-xl mx-auto text-sm">
                                                Upload the updated Excel sheet containing deductions/earnings, and ensure all files are validated successfully without missing columns.
                                            </p>

                                            <div className="mt-6 mb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                                                <div className="w-full sm:w-auto">
                                                    <input
                                                        type="month"
                                                        value={salaryMonth}
                                                        onChange={(e) => setSalaryMonth(e.target.value)}
                                                        className="block w-full text-sm text-gray-700 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="max-w-md w-full">
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        accept=".xls,.xlsx"
                                                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                                                        className="block w-full text-sm text-gray-500
                                                    file:mr-4 file:py-2 file:px-4
                                                    file:rounded-md file:border-0
                                                    file:text-sm file:font-semibold
                                                    file:bg-cyan-50 file:text-cyan-700
                                                    hover:file:bg-cyan-100 border border-gray-300 rounded-md shadow-sm"
                                                    />
                                                </div>
                                                <button
                                                    onClick={handleFileUpload}
                                                    disabled={isUploading || !selectedFile}
                                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                                                >
                                                    {isUploading ? <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" /> : <DocumentPlusIcon className="-ml-1 mr-2 h-5 w-5" />}
                                                    Upload File
                                                </button>
                                            </div>

                                            <button
                                                onClick={fetchFiles}
                                                disabled={isFetching}
                                                className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                <ArrowPathIcon className={`-ml-1 mr-2 h-5 w-5 text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
                                                Refresh Server Files
                                            </button>
                                        </div>

                                        {fetchError && (
                                            <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                                                <div className="flex">
                                                    <div className="flex-shrink-0">
                                                        <XCircleIcon className="h-5 w-5 text-red-500" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <h3 className="text-sm font-medium text-red-800">Validation Error</h3>
                                                        <div className="mt-2 text-sm text-red-700">
                                                            <p>{fetchError}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Uploaded Files List */}
                                        {!fetchError && uploadedFiles.length > 0 && (
                                            <div className="mb-8">
                                                <ReusableTable
                                                    data={uploadedFiles.map((f, i) => ({ ...f, id: i }))}
                                                    columns={[
                                                        {
                                                            key: "fileName",
                                                            label: "File Name",
                                                            render: (row) => (
                                                                <div className="flex items-center gap-3">
                                                                    <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                                                                    <span className="text-sm font-medium text-gray-900">{row.fileName}</span>
                                                                </div>
                                                            )
                                                        },
                                                        {
                                                            key: "type",
                                                            label: "Type",
                                                            render: (row) => (
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.type?.toLowerCase() === 'earnings' ? 'bg-green-100 text-green-800' : row.type?.toLowerCase() === 'deductions' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                    {row.type}
                                                                </span>
                                                            )
                                                        },
                                                        {
                                                            key: "status",
                                                            label: "Status",
                                                            className: "text-center",
                                                            headerClassName: "text-center",
                                                            render: () => (
                                                                <div className="flex flex-col items-center">
                                                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                                                    <span className="text-xs text-green-600 mt-1">Valid</span>
                                                                </div>
                                                            )
                                                        },
                                                        {
                                                            key: "totalAmount",
                                                            label: "Total Amount",
                                                            className: "text-right font-medium text-gray-900",
                                                            headerClassName: "text-right",
                                                            render: (row) => `₹${row.totalAmount?.toLocaleString()}`
                                                        }
                                                    ]}
                                                    searchable={false}
                                                    pageSize={10}
                                                />
                                            </div>
                                        )}

                                        {!fetchError && uploadedFiles.length === 0 && !isFetching && (
                                            <div className="text-center py-12 text-gray-500">
                                                No files found in the server folder. Please upload templates to the server and click Refresh.
                                            </div>
                                        )}

                                        <div className="flex justify-center gap-4 mt-8">
                                            <button
                                                onClick={() => setWorkflowStep(1)}
                                                className="inline-flex items-center px-6 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setWorkflowStep(3)}
                                                disabled={uploadedFiles.length === 0 || fetchError !== null}
                                                className="inline-flex items-center px-6 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Review Summary
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Step 3: Summary Review & Trigger */}
                                {workflowStep === 3 && (
                                    <div className="py-6">
                                        <div className="text-center mb-8">
                                            <h4 className="text-2xl font-semibold text-gray-900 mb-2">Review Summary</h4>
                                            <p className="text-gray-600 text-sm">Please verify the total calculated amounts from your validated files before triggering the payroll engine.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-10">
                                            <div className="bg-red-50 rounded-xl p-6 border border-red-100 text-center shadow-sm">
                                                <h5 className="text-sm font-semibold text-red-800 uppercase tracking-wide mb-2">Total Deductions</h5>
                                                <span className="text-3xl font-bold text-red-600">₹{summaryData.totalDeductions.toLocaleString()}</span>
                                            </div>
                                            <div className="bg-green-50 rounded-xl p-6 border border-green-100 text-center shadow-sm">
                                                <h5 className="text-sm font-semibold text-green-800 uppercase tracking-wide mb-2">Total Earnings</h5>
                                                <span className="text-3xl font-bold text-green-600">₹{summaryData.totalEarnings.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <div className="text-center">
                                            <div className="max-w-xs mx-auto mb-6 text-left">
                                                <label htmlFor="salaryMonth" className="block text-sm font-medium text-gray-700 mb-1">
                                                    Salary Month <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="month"
                                                    id="salaryMonth"
                                                    className="shadow-sm focus:ring-cyan-500 focus:border-cyan-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border bg-white"
                                                    value={salaryMonth}
                                                    onChange={(e) => setSalaryMonth(e.target.value)}
                                                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                                                />
                                            </div>
                                            <button
                                                onClick={handleProcessAll}
                                                disabled={isProcessing}
                                                className="inline-flex items-center px-8 py-3.5 border border-transparent shadow-lg text-base font-medium rounded-xl text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 transition-all hover:scale-105"
                                            >
                                                {isProcessing ? (
                                                    <><ArrowPathIcon className="animate-spin -ml-1 mr-3 h-5 w-5" /> Processing Engine...</>
                                                ) : "Run Payroll Engine"}
                                            </button>
                                        </div>

                                        <div className="flex justify-center mt-12">
                                            <button onClick={() => setWorkflowStep(2)} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                                                ← Back to File Upload
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
                                    <h4 className="text-xl font-semibold text-gray-900">Batch Processing Status</h4>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={fetchBatchInfo}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                        >
                                            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" />
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
                                            className: "text-center font-semibold",
                                            headerClassName: "text-center",
                                            render: (row: any) => `₹${row.totalSalaryAmount?.toLocaleString() || 0}`
                                        },
                                        { 
                                            key: "status", 
                                            label: "Status", 
                                            sortable: true,
                                            render: (row: any) => (
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${row.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
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
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadReport(row.batchReference, row.salaryMonth); }}
                                                    className="text-cyan-600 hover:text-cyan-900 bg-cyan-50 p-2.5 rounded-full transition-colors inline-block"
                                                    title="Download Bank Report"
                                                >
                                                    <DocumentArrowDownIcon className="h-5 w-5" />
                                                </button>
                                            )
                                        }
                                    ]}
                                    searchable={false}
                                    pageSize={10}
                                    emptyState={
                                        <div className="flex flex-col items-center py-12 text-gray-500">
                                            <ArrowPathIcon className="h-8 w-8 text-gray-400 mb-3 animate-spin" />
                                            <p className="text-sm">Waiting for batch information to appear...</p>
                                        </div>
                                    }
                                />

                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PayrollProcessingEnginePage;
