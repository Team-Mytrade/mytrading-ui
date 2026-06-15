import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    DocumentTextIcon,
    CheckCircleIcon,
    ClockIcon,
    ExclamationCircleIcon,
    TagIcon,
    ArrowLeftIcon,
    PencilSquareIcon,
    ReceiptPercentIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    PrinterIcon,
    MapPinIcon,
    EnvelopeIcon,
    PhoneIcon,
    GlobeAltIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_INVOICES = "/v1/api/invoice/invoices";

interface Product {
    id: number;
    name: string;
    sku: string;
    price: number;
    description: string | null;
    category: {
        id: number;
        name: string;
        categoryCode: string;
    };
}

interface LineItem {
    id: number;
    product: Product;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    productCode: string;
    description: string | null;
}

interface TaxDetail {
    id: number;
    taxRate: number;
    taxAmount: number;
    taxCode: string | null;
    taxDescription: string | null;
}

interface Customer {
    id: number;
    name: string | null;
    email: string;
    phone: string;
    website: string | null;
    industry: string | null;
    billingAddress: string | null;
    shippingAddress: string | null;
}

interface PaymentTerm {
    id: number;
    termCode: string;
    description: string;
    dueDays: number;
}

interface Invoice {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    customer: Customer;
    paymentTerm?: PaymentTerm;
    lineItems: LineItem[];
    taxDetails: TaxDetail[];
    subTotal: number;
    totalDiscount: number;
    totalTax: number;
    grandTotal: number;
    amountPaid: number;
    balance: number;
    billingAddress: string;
    shippingAddress: string;
    status: string;
    createdDate?: string;
    updatedDate?: string;
    createdBy?: string;
}

const InvoiceDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`${API_INVOICES}/${id}`);
                setInvoice(response.data);
            } catch (err) {
                console.error("Error loading invoice details:", err);
                ToasterService.error("Failed to load invoice details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handlePrint = () => {
        if (!printRef.current || !invoice) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            ToasterService.error("Please allow pop-ups to print");
            return;
        }

        // Generate line items HTML
        const lineItemsHtml = invoice.lineItems.map(item => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <div style="font-weight: 500; color: #111827;">${item.product.name}</div>
                    ${item.product.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${item.product.description}</div>` : ''}
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${item.product.sku}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${invoice.currency} ${item.unitPrice.toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ef4444;">-${invoice.currency} ${item.discount.toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500; color: #111827;">${invoice.currency} ${item.lineTotal.toFixed(2)}</td>
            </tr>
        `).join('');

        // Generate tax details HTML
        const taxDetailsHtml = invoice.taxDetails.length > 0 ? `
            <div style="margin-bottom: 40px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #0e7490; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">Tax Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Tax Code</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Description</th>
                            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Rate</th>
                            <th style="padding: 12px; text-align: right; font-size: 12px; font-weight: 600; color: #4b5563; text-transform: uppercase;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoice.taxDetails.map(tax => `
                            <tr>
                                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #111827;">${tax.taxCode || '—'}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${tax.taxDescription || '—'}</td>
                                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #6b7280;">${tax.taxRate}%</td>
                                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #10b981; font-weight: 500;">+${invoice.currency} ${tax.taxAmount.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : '';

        // Generate customer info HTML
        const customerInfoHtml = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px;">
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <h4 style="font-size: 14px; font-weight: 600; color: #0e7490; margin-bottom: 16px;">Customer Information</h4>
                    ${invoice.customer.name ? `<p style="margin-bottom: 8px;"><span style="font-weight: 500;">Name:</span> ${invoice.customer.name}</p>` : ''}
                    ${invoice.customer.email ? `<p style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><span>✉️</span> ${invoice.customer.email}</p>` : ''}
                    ${invoice.customer.phone ? `<p style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><span>📞</span> ${invoice.customer.phone}</p>` : ''}
                    ${invoice.customer.website ? `<p style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;"><span>🌐</span> ${invoice.customer.website}</p>` : ''}
                    ${invoice.customer.industry ? `<p style="margin-bottom: 8px;"><span style="font-weight: 500;">Industry:</span> ${invoice.customer.industry}</p>` : ''}
                </div>
                ${invoice.paymentTerm ? `
                    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                        <h4 style="font-size: 14px; font-weight: 600; color: #0e7490; margin-bottom: 16px;">Payment Terms</h4>
                        <p style="margin-bottom: 8px; font-weight: 500;">${invoice.paymentTerm.termCode}</p>
                        <p style="margin-bottom: 8px; color: #6b7280;">${invoice.paymentTerm.description}</p>
                        <p style="font-size: 12px; color: #9ca3af;">Due in ${invoice.paymentTerm.dueDays} days</p>
                    </div>
                ` : ''}
            </div>
        `;

        // Generate addresses HTML
        const addressesHtml = (invoice.billingAddress || invoice.shippingAddress) ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 40px;">
                ${invoice.billingAddress ? `
                    <div>
                        <h4 style="font-size: 14px; font-weight: 600; color: #0e7490; margin-bottom: 8px;">📍 Billing Address</h4>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <p style="white-space: pre-wrap;">${invoice.billingAddress}</p>
                        </div>
                    </div>
                ` : ''}
                ${invoice.shippingAddress ? `
                    <div>
                        <h4 style="font-size: 14px; font-weight: 600; color: #0e7490; margin-bottom: 8px;">📦 Shipping Address</h4>
                        <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
                            <p style="white-space: pre-wrap;">${invoice.shippingAddress}</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        ` : '';

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invoice ${invoice.invoiceNumber}</title>
                <style>
                    body {
                        font-family: 'Nunito', sans-serif;
                        line-height: 1.5;
                        color: #1f2937;
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 40px 20px;
                        background-color: #ffffff;
                    }
                    .invoice-container {
                        background-color: white;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 40px;
                        padding-bottom: 30px;
                        border-bottom: 2px solid #e5e7eb;
                    }
                    .invoice-title h1 {
                        font-size: 32px;
                        font-weight: 700;
                        color: #0e7490;
                        margin: 0 0 8px 0;
                        font-family: 'Nunito', sans-serif;
                    }
                    .invoice-title p {
                        margin: 4px 0;
                        color: #6b7280;
                        font-size: 14px;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 6px 16px;
                        border-radius: 9999px;
                        font-size: 12px;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        background-color: ${invoice.status === "PAID" ? '#d1fae5' :
                invoice.status === "PENDING" ? '#fef3c7' :
                    invoice.status === "OVERDUE" ? '#fee2e2' :
                        invoice.status === "DRAFT" ? '#f3f4f6' : '#dbeafe'};
                        color: ${invoice.status === "PAID" ? '#065f46' :
                invoice.status === "PENDING" ? '#92400e' :
                    invoice.status === "OVERDUE" ? '#991b1b' :
                        invoice.status === "DRAFT" ? '#1f2937' : '#1e40af'};
                    }
                    .dates {
                        text-align: right;
                    }
                    .dates p {
                        margin: 4px 0;
                        color: #6b7280;
                        font-size: 14px;
                    }
                    .dates strong {
                        color: #1f2937;
                        font-weight: 600;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #0e7490;
                        margin: 0 0 20px 0;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0 40px 0;
                    }
                    th {
                        background-color: #f3f4f6;
                        padding: 12px;
                        text-align: left;
                        font-size: 12px;
                        font-weight: 600;
                        color: #4b5563;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    td {
                        padding: 12px;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 14px;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .totals-section {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 2px solid #e5e7eb;
                        display: flex;
                        justify-content: flex-end;
                    }
                    .totals {
                        width: 400px;
                    }
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        font-size: 14px;
                    }
                    .total-row.border-top {
                        border-top: 1px solid #e5e7eb;
                        margin-top: 8px;
                        padding-top: 16px;
                    }
                    .total-row.grand-total {
                        font-size: 18px;
                        font-weight: 700;
                        color: #0e7490;
                    }
                    .balance-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 12px 0;
                        border-top: 1px solid #e5e7eb;
                        margin-top: 8px;
                        font-weight: 500;
                    }
                    .balance-positive {
                        color: #ef4444;
                        font-weight: 700;
                    }
                    .balance-negative {
                        color: #10b981;
                        font-weight: 700;
                    }
                    .footer {
                        margin-top: 60px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        font-size: 12px;
                        color: #9ca3af;
                    }
                    .info-card {
                        background-color: #f9fafb;
                        padding: 20px;
                        border-radius: 8px;
                        border: 1px solid #e5e7eb;
                    }
                    .info-card h4 {
                        font-size: 14px;
                        font-weight: 600;
                        color: #0e7490;
                        margin: 0 0 16px 0;
                    }
                    .info-card p {
                        margin: 8px 0;
                        color: #1f2937;
                    }
                    .grid-2 {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 24px;
                        margin-bottom: 40px;
                    }
                    @media print {
                        body { background-color: white; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="invoice-container">
                    <!-- Header -->
                    <div class="header">
                        <div class="invoice-title">
                            <h1>${invoice.invoiceNumber}</h1>
                            <p><span style="color: #6b7280;">Status:</span> <span class="status-badge">${invoice.status}</span></p>
                        </div>
                        <div class="dates">
                            <p><strong>Invoice Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                        </div>
                    </div>

                    <!-- Customer & Payment Info -->
                    ${customerInfoHtml}

                    <!-- Addresses -->
                    ${addressesHtml}

                    <!-- Line Items -->
                    <h3 class="section-title">Line Items</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th class="text-right">Qty</th>
                                <th class="text-right">Unit Price</th>
                                <th class="text-right">Discount</th>
                                <th class="text-right">Line Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lineItemsHtml}
                        </tbody>
                    </table>

                    <!-- Tax Details -->
                    ${taxDetailsHtml}

                    <!-- Totals -->
                    <div class="totals-section">
                        <div class="totals">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span>${invoice.currency} ${invoice.subTotal.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Total Discount:</span>
                                <span style="color: #ef4444;">-${invoice.currency} ${invoice.totalDiscount.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Total Tax:</span>
                                <span style="color: #10b981;">+${invoice.currency} ${invoice.totalTax.toFixed(2)}</span>
                            </div>
                            <div class="total-row border-top grand-total">
                                <span>Grand Total:</span>
                                <span>${invoice.currency} ${invoice.grandTotal.toFixed(2)}</span>
                            </div>
                            <div class="total-row">
                                <span>Amount Paid:</span>
                                <span>${invoice.currency} ${invoice.amountPaid.toFixed(2)}</span>
                            </div>
                            <div class="balance-row">
                                <span style="font-weight: 600;">Balance Due:</span>
                                <span class="${invoice.balance > 0 ? 'balance-positive' : 'balance-negative'}">
                                    ${invoice.currency} ${invoice.balance.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="footer">
                        <p>Invoice ID: ${invoice.id} • Currency: ${invoice.currency}</p>
                        ${invoice.createdBy ? `<p>Created by: ${invoice.createdBy}</p>` : ''}
                        <p>Generated on ${new Date().toLocaleString()}</p>
                    </div>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PAID": return "bg-green-100 text-green-800";
            case "PENDING": return "bg-yellow-100 text-yellow-800";
            case "OVERDUE": return "bg-red-100 text-red-800";
            case "DRAFT": return "bg-gray-100 text-gray-800";
            default: return "bg-blue-100 text-blue-800";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "PAID": return <CheckCircleIcon className="h-4 w-4" />;
            case "PENDING": return <ClockIcon className="h-4 w-4" />;
            case "OVERDUE": return <ExclamationCircleIcon className="h-4 w-4" />;
            case "DRAFT": return <DocumentTextIcon className="h-4 w-4" />;
            default: return <TagIcon className="h-4 w-4" />;
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

    if (!invoice) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <ExclamationCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500 font-medium">Invoice not found</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageMeta title={`Invoice ${invoice.invoiceNumber}`} description="View invoice details" />
            <PageBreadcrumb pageTitle="Invoice Details" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Header with Actions */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button
                        onClick={() => navigate("/invoice-billing")}
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
                            <span className="hidden sm:inline">Print Invoice</span>
                        </button>
                        <button
                            onClick={() => navigate(`/invoice-billing/edit/${invoice.id}`)}
                            className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Edit Invoice</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Card - This is what will be printed */}
                <div ref={printRef}>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Status Bar */}
                        <div className={`h-2 ${invoice.status === "PAID" ? 'bg-green-500' :
                            invoice.status === "PENDING" ? 'bg-yellow-500' :
                                invoice.status === "OVERDUE" ? 'bg-red-500' :
                                    invoice.status === "DRAFT" ? 'bg-gray-500' : 'bg-cyan-500'
                            }`} />

                        <div className="p-8">
                            {/* Invoice Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-8 border-b border-gray-200">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                                        <h2 className="text-3xl font-bold text-gray-900 font-mono">{invoice.invoiceNumber}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                            {getStatusIcon(invoice.status)}
                                            <span className="ml-1">{invoice.status}</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="text-left md:text-right space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Invoice Date</p>
                                        <p className="text-sm text-gray-600 flex items-center md:justify-end gap-1.5">
                                            <CalendarIcon className="h-4 w-4" />
                                            {new Date(invoice.invoiceDate).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                    {invoice.dueDate && (
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Due Date</p>
                                            <p className="text-sm text-gray-600 flex items-center md:justify-end gap-1.5">
                                                <CalendarIcon className="h-4 w-4" />
                                                {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Customer Information */}
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <BuildingOfficeIcon className="h-5 w-5 text-cyan-600" />
                                    Customer Information
                                </h3>
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            {invoice.customer.name && (
                                                <p className="text-sm text-gray-900">
                                                    <span className="font-medium">Name:</span> {invoice.customer.name}
                                                </p>
                                            )}
                                            {invoice.customer.email && (
                                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                                    <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                                    {invoice.customer.email}
                                                </p>
                                            )}
                                            {invoice.customer.phone && (
                                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                                    <PhoneIcon className="h-4 w-4 text-gray-400" />
                                                    {invoice.customer.phone}
                                                </p>
                                            )}
                                            {invoice.customer.website && (
                                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                                    <GlobeAltIcon className="h-4 w-4 text-gray-400" />
                                                    {invoice.customer.website}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            {invoice.customer.industry && (
                                                <p className="text-sm text-gray-600">
                                                    <span className="font-medium">Industry:</span> {invoice.customer.industry}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Terms */}
                            {invoice.paymentTerm && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <ClockIcon className="h-5 w-5 text-cyan-600" />
                                        Payment Terms
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-6">
                                        <p className="text-sm text-gray-900 mb-1">
                                            <span className="font-medium">{invoice.paymentTerm.termCode}</span>
                                        </p>
                                        <p className="text-sm text-gray-600">{invoice.paymentTerm.description}</p>
                                        <p className="text-xs text-gray-500 mt-2">Due in {invoice.paymentTerm.dueDays} days</p>
                                    </div>
                                </div>
                            )}

                            {/* Line Items */}
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                    <TagIcon className="h-5 w-5 text-cyan-600" />
                                    Line Items
                                </h3>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Line Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {invoice.lineItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 text-sm text-gray-900">
                                                        <div>
                                                            <p className="font-medium">{item.product.name}</p>
                                                            {item.product.description && (
                                                                <p className="text-xs text-gray-500">{item.product.description}</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">{item.product.sku}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">{item.quantity}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 text-right">${item.unitPrice.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-sm text-red-600 text-right">-${item.discount.toFixed(2)}</td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">${item.lineTotal.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Tax Details */}
                            {invoice.taxDetails.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <ReceiptPercentIcon className="h-5 w-5 text-cyan-600" />
                                        Tax Details
                                    </h3>
                                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Code</th>
                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {invoice.taxDetails.map((tax, idx) => (
                                                    <tr key={tax.id || idx} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 text-sm text-gray-900">{tax.taxCode || '—'}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{tax.taxDescription || '—'}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-600 text-right">{tax.taxRate}%</td>
                                                        <td className="px-6 py-4 text-sm text-green-600 text-right font-medium">+${tax.taxAmount.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Addresses */}
                            {(invoice.billingAddress || invoice.shippingAddress) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    {invoice.billingAddress && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <MapPinIcon className="h-4 w-4 text-cyan-600" />
                                                Billing Address
                                            </h4>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.billingAddress}</p>
                                            </div>
                                        </div>
                                    )}
                                    {invoice.shippingAddress && (
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <MapPinIcon className="h-4 w-4 text-cyan-600" />
                                                Shipping Address
                                            </h4>
                                            <div className="bg-gray-50 rounded-lg p-4">
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.shippingAddress}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Totals Summary */}
                            <div className="border-t border-gray-200 pt-6">
                                <div className="flex justify-end">
                                    <div className="w-full md:w-96 space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Subtotal:</span>
                                            <span className="font-medium text-gray-900">${invoice.subTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Discount:</span>
                                            <span className="font-medium text-red-600">-${invoice.totalDiscount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Total Tax:</span>
                                            <span className="font-medium text-green-600">+${invoice.totalTax.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-lg font-bold border-t pt-3">
                                            <span>Grand Total:</span>
                                            <span className="text-cyan-600">${invoice.grandTotal.toFixed(2)}</span>
                                        </div>
                                        <div className="pt-3 space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Amount Paid:</span>
                                                <span className="font-medium text-gray-900">${invoice.amountPaid.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm border-t pt-2">
                                                <span className="font-medium text-gray-700">Balance:</span>
                                                <span className={`font-bold ${invoice.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    ${invoice.balance.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default InvoiceDetails;