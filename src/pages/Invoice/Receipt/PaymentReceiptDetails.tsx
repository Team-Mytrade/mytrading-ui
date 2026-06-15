import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    PrinterIcon,
    ReceiptPercentIcon,
    BuildingOfficeIcon,
    CreditCardIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    CalendarIcon,
    ClipboardDocumentIcon,
    CheckCircleIcon,
    XCircleIcon,
    BanknotesIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_RECEIPTS = "/v1/api/invoice/receipts";
const API_CUSTOMERS = "/v1/api/invoice/customers";
const API_INVOICES = "/v1/api/invoice/invoices";

interface Customer {
    id: number;
    name: string;
}

interface Invoice {
    id: number;
    invoiceNumber: string;
}

interface Allocation {
    id?: number;
    invoice: { id: number } | null;
    allocatedAmount: number;
}

interface PaymentReceipt {
    id?: number;
    receiptNumber: string;
    paymentDate: string;
    customer: { id: number } | null;
    totalAmountReceived: number;
    paymentMethod: string;
    referenceNumber: string;
    receivedBy: string;
    notes: string;
    allocations: Allocation[];
    invoice: { id: number } | null;
    createdDate?: string;
    createdBy?: string;
}

const PaymentReceiptDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [receiptRes, custRes, invRes] = await Promise.all([
                    axios.get(`${API_RECEIPTS}/${id}`),
                    axios.get(API_CUSTOMERS),
                    axios.get(API_INVOICES),
                ]);
                setReceipt(receiptRes.data);
                setCustomers(custRes.data);
                setInvoices(invRes.data);
            } catch (err) {
                console.error("Error loading receipt details:", err);
                ToasterService.error("Failed to load receipt details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handlePrint = () => {
        if (!printRef.current || !receipt) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            ToasterService.error("Please allow pop-ups to print");
            return;
        }

        const printContent = printRef.current.innerHTML;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt ${receipt.receiptNumber}</title>
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
                        background: #0e7490;
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
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 15px 0;
                    }
                    th {
                        background: #f3f4f6;
                        padding: 10px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        color: #4b5563;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 14px;
                    }
                    .text-right {
                        text-align: right;
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
                    <h1>Payment Receipt</h1>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="status-bar"></div>

                ${printContent}
                
                <div class="print-footer">
                    Confidential Financial Record — Receipt Document<br>
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

    const getPaymentMethodIcon = (method: string) => {
        switch (method?.toLowerCase()) {
            case "cash": return <BanknotesIcon className="h-5 w-5 text-green-600" />;
            case "card": return <CreditCardIcon className="h-5 w-5 text-blue-600" />;
            case "bank transfer": return <DocumentTextIcon className="h-5 w-5 text-purple-600" />;
            default: return <CurrencyDollarIcon className="h-5 w-5 text-gray-600" />;
        }
    };

    const getPaymentMethodColor = (method: string) => {
        switch (method?.toLowerCase()) {
            case "cash": return "bg-green-100 text-green-800";
            case "card": return "bg-blue-100 text-blue-800";
            case "bank transfer": return "bg-purple-100 text-purple-800";
            default: return "bg-gray-100 text-gray-800";
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

    if (!receipt) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500 font-medium">Receipt not found</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageMeta title={`Receipt ${receipt.receiptNumber}`} description="View receipt details" />
            <PageBreadcrumb pageTitle="Receipt Details" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Header with Actions */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button
                        onClick={() => navigate("/payment-receipts")}
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
                            <span className="hidden sm:inline">Print Receipt</span>
                        </button>
                        <button
                            onClick={() => navigate(`/payment-receipts/edit/${receipt.id}`)}
                            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Edit Receipt</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Card */}
                <div ref={printRef}>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Status Bar */}
                        <div className="h-2 bg-cyan-500" />

                        <div className="p-8">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-8 border-b border-gray-200">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Receipt Number</p>
                                        <h2 className="text-3xl font-bold text-gray-900 font-mono">{receipt.receiptNumber}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getPaymentMethodColor(receipt.paymentMethod)}`}>
                                            {getPaymentMethodIcon(receipt.paymentMethod)}
                                            <span className="ml-1">{receipt.paymentMethod || 'N/A'}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="text-left md:text-right">
                                    <p className="text-sm text-gray-500 mb-1">Payment Date</p>
                                    <p className="text-sm text-gray-600 flex items-center md:justify-end gap-1.5">
                                        <CalendarIcon className="h-4 w-4" />
                                        {new Date(receipt.paymentDate).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Customer Information */}
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <BuildingOfficeIcon className="h-5 w-5 text-cyan-600" />
                                    Customer Information
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <p className="text-lg font-medium text-gray-900">
                                        {customers.find(c => c.id === receipt.customer?.id)?.name || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {/* Payment Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                                        <CreditCardIcon className="h-5 w-5 text-cyan-600" />
                                        Payment Details
                                    </h4>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Method</p>
                                            <p className="text-sm font-medium text-gray-900">{receipt.paymentMethod || 'N/A'}</p>
                                        </div>
                                        {receipt.referenceNumber && (
                                            <div>
                                                <p className="text-xs text-gray-500">Reference</p>
                                                <p className="text-sm font-medium text-gray-900">{receipt.referenceNumber}</p>
                                            </div>
                                        )}
                                        {receipt.receivedBy && (
                                            <div>
                                                <p className="text-xs text-gray-500">Received By</p>
                                                <p className="text-sm font-medium text-gray-900">{receipt.receivedBy}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-6 text-white shadow-lg">
                                    <div className="relative">
                                        <p className="text-cyan-100 text-xs font-medium uppercase tracking-wider mb-2">Total Amount</p>
                                        <p className="text-4xl font-bold tracking-tight">
                                            ${receipt.totalAmountReceived.toFixed(2)}
                                        </p>
                                        <CurrencyDollarIcon className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10" />
                                    </div>
                                </div>
                            </div>

                            {/* Main Invoice */}
                            {receipt.invoice && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Main Invoice
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-6">
                                        <p className="text-lg font-medium text-gray-900">
                                            {invoices.find(i => i.id === receipt.invoice?.id)?.invoiceNumber || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Allocations */}
                            {receipt.allocations.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Invoice Allocations
                                    </h3>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Allocated Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {receipt.allocations.map((alloc, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 text-sm text-gray-900">
                                                            {invoices.find(i => i.id === alloc.invoice?.id)?.invoiceNumber || 'N/A'}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                                                            ${alloc.allocatedAmount.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot className="bg-gray-50">
                                                <tr>
                                                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">Total</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-cyan-600 text-right">
                                                        ${receipt.allocations.reduce((sum, a) => sum + a.allocatedAmount, 0).toFixed(2)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {receipt.notes && (
                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <ClipboardDocumentIcon className="h-5 w-5 text-cyan-600" />
                                        Notes
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-gray-700 whitespace-pre-wrap">{receipt.notes}</p>
                                    </div>
                                </div>
                            )}

                            {/* Metadata Footer */}
                            <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                                <div>Receipt ID: {receipt.id}</div>
                                {receipt.createdBy && <div>Created by: {receipt.createdBy}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PaymentReceiptDetails;