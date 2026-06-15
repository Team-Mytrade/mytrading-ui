import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    PrinterIcon,
    DocumentTextIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    BanknotesIcon,
    CreditCardIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/accounts-payable";
const VENDORS_URL = "/v1/api/invoice/vendors";

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

interface Vendor {
    id: number;
    name: string;
    email?: string;
    phone?: string;
}

interface AccountsPayable {
    id?: number;
    vendor?: Vendor;
    invoiceNumber?: string;
    invoiceDate?: string;
    invoiceAmount: number;
    amountPaid: number;
    balance: number;
    accountsPayableStatus: Status;
    lastPaymentDate?: string;
    dueDate: string;
    currency?: string;
    referenceNumber?: string;
    notes?: string;
    createdDate?: string;
    updatedDate?: string;
    createdBy?: string;
}

const AccountsPayableDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [record, setRecord] = useState<AccountsPayable | null>(null);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [recordRes, vendorRes] = await Promise.all([
                    axios.get(`${BASE_URL}/${id}`),
                    axios.get(VENDORS_URL)
                ]);
                setRecord(recordRes.data);
                setVendors(vendorRes.data);
            } catch (err) {
                console.error("Error loading payable details:", err);
                ToasterService.error("Failed to load payable details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleMakePayment = async () => {
        // This would open a payment modal or navigate to payment page
        navigate(`/accounts-payable/pay/${id}`);
    };

    const handlePrint = () => {
        if (!printRef.current || !record) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            ToasterService.error("Please allow pop-ups to print");
            return;
        }

        const printContent = printRef.current.innerHTML;

        const statusColor = record.accountsPayableStatus === "PAID" ? '#10b981' :
            record.accountsPayableStatus === "PARTIALLY_PAID" ? '#f59e0b' :
                record.accountsPayableStatus === "OVERDUE" ? '#ef4444' : '#3b82f6';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payable Details - ${record.invoiceNumber || 'N/A'}</title>
                <style>
                    body {
                        font-family: 'Nunito', sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 1000px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #0e7490;
                    }
                    .print-header h1 {
                        color: #0e7490;
                        margin: 0;
                        font-size: 24px;
                    }
                    .print-header p {
                        color: #666;
                        margin: 5px 0 0;
                        font-size: 14px;
                    }
                    .status-bar {
                        height: 4px;
                        background: ${statusColor};
                        margin-bottom: 20px;
                    }
                    .section {
                        margin-bottom: 30px;
                        padding: 20px;
                        background: #f9fafb;
                        border-radius: 8px;
                        border: 1px solid #e5e7eb;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #0e7490;
                        margin: 0 0 15px 0;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                        margin-bottom: 20px;
                    }
                    .info-item {
                        margin-bottom: 15px;
                    }
                    .info-label {
                        font-size: 12px;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 4px;
                    }
                    .info-value {
                        font-size: 16px;
                        font-weight: 500;
                        color: #111827;
                    }
                    .badge {
                        display: inline-flex;
                        align-items: center;
                        padding: 4px 12px;
                        border-radius: 9999px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .financial-summary {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 20px;
                        margin-top: 20px;
                    }
                    .financial-card {
                        padding: 20px;
                        border-radius: 8px;
                        text-align: center;
                    }
                    .financial-label {
                        font-size: 14px;
                        opacity: 0.8;
                        margin-bottom: 8px;
                    }
                    .financial-amount {
                        font-size: 24px;
                        font-weight: bold;
                    }
                    .print-footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        font-size: 12px;
                        color: #9ca3af;
                    }
                    @media print {
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Accounts Payable Details</h1>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="status-bar"></div>

                ${printContent}
                
                <div class="print-footer">
                    Confidential Financial Record — Payable Document<br>
                    Printed on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    };

    const getStatusColor = (status: Status) => {
        switch (status) {
            case "PAID": return "bg-green-100 text-green-800";
            case "PARTIALLY_PAID": return "bg-yellow-100 text-yellow-800";
            case "OPEN": return "bg-blue-100 text-blue-800";
            case "OVERDUE": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getStatusIcon = (status: Status) => {
        switch (status) {
            case "PAID": return <CheckCircleIcon className="h-5 w-5" />;
            case "PARTIALLY_PAID": return <BanknotesIcon className="h-5 w-5" />;
            case "OPEN": return <ClockIcon className="h-5 w-5" />;
            case "OVERDUE": return <ExclamationTriangleIcon className="h-5 w-5" />;
            default: return <DocumentTextIcon className="h-5 w-5" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading details...</p>
                </div>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500 font-medium">Payable not found</p>
                </div>
            </div>
        );
    }

    const isOverdue = new Date(record.dueDate) < new Date() && record.balance > 0;

    return (
        <>
            <PageMeta title={`Payable - ${record.invoiceNumber || 'N/A'}`} description="View payable details" />
            <PageBreadcrumb pageTitle="Payable Details" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Header with Actions */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button
                        onClick={() => navigate("/accounts-payable")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <PrinterIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Print Details</span>
                        </button>
                        {record.balance > 0 && (
                            <button
                                onClick={handleMakePayment}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <CreditCardIcon className="h-5 w-5" />
                                <span className="hidden sm:inline">Make Payment</span>
                            </button>
                        )}
                        <button
                            onClick={() => navigate(`/accounts-payable/edit/${record.id}`)}
                            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Edit Payable</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Card */}
                <div ref={printRef}>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Status Bar */}
                        <div className={`h-2 ${record.accountsPayableStatus === "PAID" ? 'bg-green-500' :
                            record.accountsPayableStatus === "PARTIALLY_PAID" ? 'bg-yellow-500' :
                                record.accountsPayableStatus === "OVERDUE" ? 'bg-red-500' : 'bg-blue-500'
                            }`} />

                        <div className="p-8">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-8 border-b border-gray-200">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                                        <h2 className="text-3xl font-bold text-gray-900 font-mono">{record.invoiceNumber || 'N/A'}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(record.accountsPayableStatus)}`}>
                                            {getStatusIcon(record.accountsPayableStatus)}
                                            <span className="ml-2">{record.accountsPayableStatus.replace('_', ' ')}</span>
                                        </span>
                                        {isOverdue && record.accountsPayableStatus !== "PAID" && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                                                Overdue
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-left md:text-right">
                                    <p className="text-sm text-gray-500 mb-1">Due Date</p>
                                    <p className="text-sm text-gray-600 flex items-center md:justify-end gap-1.5">
                                        <CalendarIcon className="h-4 w-4" />
                                        {new Date(record.dueDate).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Vendor Information */}
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <BuildingOfficeIcon className="h-5 w-5 text-cyan-600" />
                                    Vendor Information
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <p className="text-lg font-medium text-gray-900">
                                        {record.vendor?.name || 'N/A'}
                                    </p>
                                    {record.vendor?.email && (
                                        <p className="text-sm text-gray-600 mt-2">{record.vendor.email}</p>
                                    )}
                                    {record.vendor?.phone && (
                                        <p className="text-sm text-gray-600">{record.vendor.phone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Invoice Details */}
                            {record.invoiceDate && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Invoice Details
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-6">
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Invoice Date:</span> {new Date(record.invoiceDate).toLocaleDateString()}
                                        </p>
                                        {record.referenceNumber && (
                                            <p className="text-sm text-gray-600 mt-2">
                                                <span className="font-medium">Reference:</span> {record.referenceNumber}
                                            </p>
                                        )}
                                        {record.currency && (
                                            <p className="text-sm text-gray-600 mt-2">
                                                <span className="font-medium">Currency:</span> {record.currency}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Financial Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <p className="text-xs text-gray-500 mb-1">Invoice Amount</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ${record.invoiceAmount.toFixed(2)}
                                    </p>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-6">
                                    <p className="text-xs text-gray-500 mb-1">Amount Paid</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        ${record.amountPaid.toFixed(2)}
                                    </p>
                                </div>

                                <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-6 text-white shadow-lg">
                                    <div className="relative">
                                        <p className="text-cyan-100 text-xs font-medium uppercase tracking-wider mb-2">Balance</p>
                                        <p className="text-3xl font-bold tracking-tight">
                                            ${record.balance.toFixed(2)}
                                        </p>
                                        <CurrencyDollarIcon className="absolute -right-4 -bottom-4 h-20 w-20 text-white/10" />
                                    </div>
                                </div>
                            </div>

                            {/* Last Payment Date */}
                            {record.lastPaymentDate && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <CalendarIcon className="h-5 w-5 text-cyan-600" />
                                        Last Payment
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-sm text-gray-600">
                                            {new Date(record.lastPaymentDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {record.notes && (
                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Notes
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-gray-700 whitespace-pre-wrap">{record.notes}</p>
                                    </div>
                                </div>
                            )}

                            {/* Payment Summary */}
                            <div className="border-t border-gray-200 pt-6 mt-6">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <BanknotesIcon className="h-5 w-5 text-cyan-600" />
                                    Payment Summary
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-2">Payment Progress</p>
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span>Payment Status:</span>
                                                    <span className="font-medium">
                                                        {record.amountPaid === 0 ? 'No payments made' :
                                                            record.amountPaid < record.invoiceAmount ? 'Partial payment' :
                                                                'Fully paid'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span>Due Status:</span>
                                                    <span className={`font-medium ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                                                        {isOverdue ? 'Overdue' : 'Current'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600 mb-2">Payment Ratio</p>
                                            <div className="relative pt-1">
                                                <div className="flex mb-2 items-center justify-between">
                                                    <div>
                                                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-cyan-600 bg-cyan-200">
                                                            Progress
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-semibold inline-block text-cyan-600">
                                                            {((record.amountPaid / record.invoiceAmount) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-cyan-200">
                                                    <div
                                                        style={{ width: `${(record.amountPaid / record.invoiceAmount) * 100}%` }}
                                                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-cyan-600"
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata Footer */}
                            {record.createdDate && (
                                <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                                    <div>Payable ID: {record.id}</div>
                                    <div>Created: {new Date(record.createdDate).toLocaleString()}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AccountsPayableDetails;