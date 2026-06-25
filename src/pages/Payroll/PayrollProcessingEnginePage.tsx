import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
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

export interface UploadedFile {
    fileName: string;
    type: string;
    totalAmount: number;
}

const PayrollProcessingEnginePage: React.FC = () => {
    const [workflowStep, setWorkflowStep] = useState(1);
    const [batchInfo, setBatchInfo] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

    // Step 2 State
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [summaryData, setSummaryData] = useState({ totalDeductions: 0, totalEarnings: 0 });
    const [salaryMonth, setSalaryMonth] = useState("");

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
            link.setAttribute('download', `employee_basic_info.xlsx`);
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
            const response = await axios.get(`/v1/api/payroll/excel/amount-summary`);
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
        setIsProcessing(true);
        try {
            await axios.post(`/v1/api/payroll/payroll/process-all`, {
                month: salaryMonth,
                yearMonth: salaryMonth,
                salaryMonth: salaryMonth
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            ToasterService.success("Payroll process triggered successfully");
            setWorkflowStep(4);
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
            const response = await axios.get(`/v1/api/payroll/payroll/getPayrollBatchInfo`);
            setBatchInfo(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error("Error fetching batch info:", error);
            ToasterService.error("Failed to fetch batch info");
        }
    };

    const handleDownloadReport = async (batchReference: string, salaryMonth: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/report/download`, {
                params: { batchReference, salaryMonth },
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

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
                        <CogIcon className="h-6 w-6 text-purple-600" />
                        <h3 className="text-xl leading-6 font-bold text-gray-900">
                            Payroll Processing Engine
                        </h3>
                    </div>

                    <div className="p-6 sm:p-10">
                        {/* Stepper */}
                        <div className="mb-12 relative max-w-3xl mx-auto">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t-2 border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-between">
                                {[1, 2, 3, 4].map((step) => (
                                    <div key={step} className="bg-white px-4">
                                        <span className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-white font-semibold text-lg ${workflowStep >= step ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                                            {step}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Step 1 */}
                        {workflowStep === 1 && (
                            <div className="text-center py-8">
                                <CloudArrowDownIcon className="mx-auto h-20 w-20 text-cyan-500 mb-6" />
                                <h4 className="text-2xl font-semibold text-gray-900 mb-4">Download Employee Template</h4>
                                <p className="text-base text-gray-600 mb-6 max-w-xl mx-auto">
                                    First, download the Excel sheet containing basic info of all employees. After downloading, you can add different deductions/earnings for each employee.
                                </p>

                                <button
                                    onClick={handleDownloadTemplate}
                                    className="inline-flex items-center px-6 py-3 border border-transparent shadow-md text-base font-medium rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-all hover:scale-105"
                                >
                                    <CloudArrowDownIcon className="-ml-1 mr-2 h-6 w-6" />
                                    Download Template
                                </button>

                                <div className="mt-8 flex justify-center">
                                    <button onClick={() => setWorkflowStep(2)} className="text-gray-500 hover:text-purple-600 text-sm font-medium flex items-center">
                                        Skip to Upload Step <ArrowRightIcon className="ml-1 w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Upload Files */}
                        {workflowStep === 2 && (
                            <div className="py-4">
                                <div className="text-center mb-8">
                                    <DocumentTextIcon className="mx-auto h-16 w-16 text-purple-500 mb-4" />
                                    <h4 className="text-2xl font-semibold text-gray-900 mb-2">Review Processed Templates</h4>
                                    <p className="text-gray-600 max-w-xl mx-auto text-sm">
                                        Ensure all files placed in the server's salary folder have been validated successfully without missing columns.
                                    </p>
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
                                        <h5 className="text-lg font-semibold text-gray-800 mb-4">Files Validated Successfully</h5>
                                        <div className="bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">File Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {uploadedFiles.map((file, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 flex items-center gap-3">
                                                                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                                                                <span className="text-sm font-medium text-gray-900">{file.fileName}</span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${file.type?.toLowerCase() === 'earnings' ? 'bg-green-100 text-green-800' : file.type?.toLowerCase() === 'deductions' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                                    {file.type}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                                <div className="flex flex-col items-center">
                                                                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                                                    <span className="text-xs text-green-600 mt-1">Valid</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                                                ₹{file.totalAmount?.toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
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
                                        className="inline-flex items-center px-6 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                            className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border bg-white"
                                            value={salaryMonth}
                                            onChange={(e) => setSalaryMonth(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={handleProcessAll}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-8 py-3.5 border border-transparent shadow-lg text-base font-medium rounded-xl text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-all hover:scale-105"
                                    >
                                        {isProcessing ? (
                                            <><ArrowPathIcon className="animate-spin -ml-1 mr-3 h-5 w-5" /> Processing Engine...</>
                                        ) : "Run Payroll Engine"}
                                    </button>
                                    <p className="mt-4 text-xs text-gray-500">This action will process all files currently in the salary folder.</p>
                                </div>

                                <div className="flex justify-center mt-12">
                                    <button onClick={() => setWorkflowStep(2)} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                                        ← Back to File Upload
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Batch Processing Status */}
                        {workflowStep === 4 && (
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xl font-semibold text-gray-900">Batch Processing Status</h4>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setWorkflowStep(3)}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={fetchBatchInfo}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                                        >
                                            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" />
                                            Refresh
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-xl border border-gray-200">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-4 w-10"></th>
                                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch Reference</th>
                                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Salary Month</th>
                                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Employees</th>
                                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {batchInfo.length > 0 ? batchInfo.map((batch, idx) => (
                                                <React.Fragment key={idx}>
                                                    <tr className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap w-10">
                                                            <button onClick={() => toggleBatchExpansion(batch.batchReference)} className="text-gray-500 hover:text-gray-700">
                                                                {expandedBatch === batch.batchReference ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{batch.batchReference}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{batch.salaryMonth}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{batch.employeeCount}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">₹{batch.totalSalaryAmount?.toLocaleString()}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${batch.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                                {batch.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => handleDownloadReport(batch.batchReference, batch.salaryMonth)}
                                                                className="text-cyan-600 hover:text-cyan-900 bg-cyan-50 p-2.5 rounded-full transition-colors inline-block"
                                                                title="Download Bank Report"
                                                            >
                                                                <DocumentArrowDownIcon className="h-5 w-5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {expandedBatch === batch.batchReference && (
                                                        <tr className="bg-gray-50 border-b border-gray-200">
                                                            <td colSpan={7} className="px-10 py-6">
                                                                <h5 className="text-sm font-semibold text-gray-900 mb-3">Employees Processed in this Batch</h5>
                                                                {batch.employees && batch.employees.length > 0 ? (
                                                                    <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                                                                        <table className="min-w-full divide-y divide-gray-200">
                                                                            <thead className="bg-gray-100">
                                                                                <tr>
                                                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Employee ID</th>
                                                                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Employee Name</th>
                                                                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-200">
                                                                                {batch.employees.map((emp: any, eIdx: number) => (
                                                                                    <tr key={eIdx}>
                                                                                        <td className="px-4 py-2 text-sm text-gray-900">{emp.employeeId}</td>
                                                                                        <td className="px-4 py-2 text-sm text-gray-900">{emp.employeeName}</td>
                                                                                        <td className="px-4 py-2 text-right text-sm">
                                                                                            <button
                                                                                                onClick={() => handleDownloadPayslip(emp.employeeId, batch.salaryMonth)}
                                                                                                className="text-purple-600 hover:text-purple-900 text-xs font-medium border border-purple-200 rounded px-2 py-1 hover:bg-purple-50 transition-colors"
                                                                                            >
                                                                                                Download Payslip
                                                                                            </button>
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-gray-500 italic">No employee details available for this batch.</p>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )) : (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center">
                                                        <ArrowPathIcon className="mx-auto h-8 w-8 text-gray-400 mb-3 animate-spin" />
                                                        <p className="text-gray-500 text-sm">Waiting for batch information to appear...</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PayrollProcessingEnginePage;
