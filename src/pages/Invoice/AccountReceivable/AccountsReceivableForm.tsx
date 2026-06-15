import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    ArrowLeftIcon,
    DocumentTextIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    CurrencyDollarIcon,
    CheckCircleIcon,
    PencilSquareIcon,
    PlusIcon,
    UserIcon,
    EnvelopeIcon,
    PhoneIcon,
    ReceiptPercentIcon,
    BanknotesIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/accounts-receivable";
const CUSTOMERS_URL = "/v1/api/invoice/customers";
const INVOICES_URL = "/v1/api/invoice/invoices";

interface Invoice {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    currency: string;
    customer: {
        id: number;
        name: string | null;
        email: string;
        phone: string;
    };
    grandTotal: number;
    amountPaid: number;
    balance: number;
    status: string;
}

interface Customer {
    id: number;
    name: string;
    email?: string;
    phone?: string;
}

interface AccountsReceivableForm {
    invoiceId: number | null;
    customerId: number | null;
    invoiceDate: string;
    dueDate: string;
    invoiceAmount: number;
    amountPaid: number;
    lastPaymentDate: string | null;
}

interface AccountsReceivablePayload {
    invoice: { id: number };
    customer: { id: number };
    invoiceAmount: number;
    amountPaid: number;
    balance: number;
    accountsReceivableStatus: string;
    invoiceDate: string;
    dueDate: string;
    lastPaymentDate: string | null;
}

const emptyForm: AccountsReceivableForm = {
    invoiceId: null,
    customerId: null,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    invoiceAmount: 0,
    amountPaid: 0,
    lastPaymentDate: null,
};

const formatDateForInput = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
};

const formatDisplayDate = (value?: string | null) => {
    if (!value) return "--";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "--" : date.toLocaleDateString();
};

const formatCurrency = (value?: number | null) => {
    const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
    return amount.toFixed(2);
};

const AccountsReceivableForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<AccountsReceivableForm>(emptyForm);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof AccountsReceivableForm, string>>>({});

    useEffect(() => {
        const load = async () => {
            try {
                const [custRes, invRes] = await Promise.all([
                    axios.get(CUSTOMERS_URL),
                    axios.get(INVOICES_URL)
                ]);
                setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
                setInvoices(Array.isArray(invRes.data) ? invRes.data : []);

                if (isEdit) {
                    const res = await axios.get(`${BASE_URL}/${id}`);
                    const d = res.data;
                    setForm({
                        invoiceId: d.invoice?.id || null,
                        customerId: d.customer?.id || null,
                        invoiceDate: formatDateForInput(d.invoiceDate),
                        dueDate: formatDateForInput(d.dueDate),
                        invoiceAmount: d.invoiceAmount || 0,
                        amountPaid: d.amountPaid || 0,
                        lastPaymentDate: formatDateForInput(d.lastPaymentDate) || null,
                    });

                    // Find and set the selected invoice
                    if (d.invoice?.id) {
                        const invoice = invRes.data.find((inv: Invoice) => inv.id === d.invoice.id);
                        setSelectedInvoice(invoice || null);
                    }

                    // Find and set the selected customer
                    if (d.customer?.id) {
                        const customer = custRes.data.find((c: Customer) => c.id === d.customer.id);
                        setSelectedCustomer(customer || null);
                    }
                }
            } catch (err) {
                console.error("Error loading form data:", err);
                ToasterService.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isEdit]);

    const handleInvoiceChange = (invoiceId: number) => {
        const invoice = invoices.find(inv => inv.id === invoiceId);
        setSelectedInvoice(invoice || null);

        if (invoice) {
            const invoiceCustomerId = invoice.customer?.id ?? null;
            // Populate all fields from the selected invoice
            setForm(prev => ({
                ...prev,
                invoiceId: invoice.id,
                customerId: invoiceCustomerId,
                invoiceDate: formatDateForInput(invoice.invoiceDate),
                dueDate: formatDateForInput(invoice.dueDate),
                invoiceAmount: invoice.grandTotal || 0,
                amountPaid: invoice.amountPaid || 0,
                // Keep existing lastPaymentDate if any, otherwise null
                lastPaymentDate: prev.lastPaymentDate || null,
            }));

            // Set selected customer from invoice
            const customer = customers.find(c => c.id === invoiceCustomerId);
            setSelectedCustomer(customer || null);

            // Clear any errors for populated fields
            setErrors(prev => ({
                ...prev,
                invoiceId: undefined,
                customerId: undefined,
                invoiceDate: undefined,
                dueDate: undefined,
                invoiceAmount: undefined,
            }));
        } else {
            setSelectedCustomer(null);
        }
    };

    const handleCustomerChange = (customerId: number) => {
        const customer = customers.find(c => c.id === customerId);
        setSelectedCustomer(customer || null);
        
        setForm(prev => ({
            ...prev,
            customerId: customerId,
        }));
        
        if (errors.customerId) {
            setErrors(prev => ({ ...prev, customerId: undefined }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof AccountsReceivableForm, string>> = {};
        
        if (!form.invoiceId) newErrors.invoiceId = "Invoice is required";
        if (!form.customerId) newErrors.customerId = "Customer is required";
        if (!form.invoiceDate) newErrors.invoiceDate = "Invoice date is required";
        if (!form.dueDate) newErrors.dueDate = "Due date is required";
        if (form.invoiceAmount <= 0) newErrors.invoiceAmount = "Invoice amount must be greater than 0";
        if (form.amountPaid < 0) newErrors.amountPaid = "Amount paid cannot be negative";
        if (form.amountPaid > form.invoiceAmount) newErrors.amountPaid = "Amount paid cannot exceed invoice amount";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof AccountsReceivableForm>(key: K, value: AccountsReceivableForm[K]) => {
        if (submitting) return;
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            const balance = form.invoiceAmount - form.amountPaid;
            const status = form.amountPaid === 0 ? "OPEN" :
                form.amountPaid < form.invoiceAmount ? "PARTIALLY_PAID" : "PAID";

            // Create payload matching the sample structure
            const payload: AccountsReceivablePayload = {
                invoice: { id: form.invoiceId! },
                customer: { id: form.customerId! },
                invoiceAmount: form.invoiceAmount,
                amountPaid: form.amountPaid,
                balance: balance,
                accountsReceivableStatus: status,
                invoiceDate: form.invoiceDate,
                dueDate: form.dueDate,
                lastPaymentDate: form.amountPaid > 0 ? (form.lastPaymentDate || new Date().toISOString().split('T')[0]) : null,
            };

            console.log("Submitting payload:", payload);

            if (isEdit) {
                await axios.put(`${BASE_URL}/${id}`, payload);
                ToasterService.success("Receivable updated successfully");
            } else {
                await axios.post(BASE_URL, payload);
                ToasterService.success("Receivable created successfully");
            }
            navigate("/account-receivable");
        } catch (err: any) {
            console.error("Error saving receivable:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save receivable");
        } finally {
            setSubmitting(false);
        }
    };

    const balance = form.invoiceAmount - form.amountPaid;
    const status = form.amountPaid === 0 ? "OPEN" :
        form.amountPaid < form.invoiceAmount ? "PARTIALLY_PAID" : "PAID";
    const paymentProgress = form.invoiceAmount > 0
        ? Math.min((form.amountPaid / form.invoiceAmount) * 100, 100)
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading form...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageMeta
                title={isEdit ? "Edit Receivable" : "Add Receivable"}
                description="Manage accounts receivable"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Receivable" : "Add Receivable"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/account-receivable")}
                        disabled={submitting}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                </div>

                {/* Loading Overlay */}
                {submitting && (
                    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-4">
                            <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-gray-700 font-medium">
                                {isEdit ? "Updating..." : "Creating..."}
                            </p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Invoice Selection Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                        <DocumentTextIcon className="h-5 w-5" />
                                        Select Invoice
                                    </h3>
                                    <p className="text-cyan-100 text-sm mt-1">
                                        Select an invoice to auto-populate customer and amount details
                                    </p>
                                </div>
                                {selectedInvoice && (
                                    <div className="bg-white/20 rounded-lg px-3 py-1">
                                        <span className="text-white text-xs font-medium">
                                            {selectedInvoice.invoiceNumber}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Invoice <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.invoiceId || ""}
                                    onChange={(e) => handleInvoiceChange(Number(e.target.value))}
                                    disabled={submitting || isEdit}
                                    className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceId ? "border-red-300" : "border-gray-300"
                                        } ${(submitting || isEdit) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                >
                                    <option value="">Select Invoice</option>
                                    {invoices.map((i) => (
                                        <option key={i.id} value={i.id}>
                                            {i.invoiceNumber || `Invoice #${i.id}`} - {(i.customer?.name || i.customer?.email || "Unknown customer")} ({i.currency || "USD"} {formatCurrency(i.grandTotal)})
                                        </option>
                                    ))}
                                </select>
                                {errors.invoiceId && (
                                    <p className="text-red-500 text-xs mt-1">{errors.invoiceId}</p>
                                )}
                                {isEdit && selectedInvoice && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Invoice cannot be changed after creation
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details Card - Shows when invoice is selected */}
                    {selectedInvoice && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 overflow-hidden">
                            <div className="bg-blue-600 p-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2 !text-white">
                                    <ReceiptPercentIcon className="h-4 w-4" />
                                    Selected Invoice Details
                                </h3>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Invoice Number</p>
                                        <p className="text-sm font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Invoice Date</p>
                                        <p className="text-sm text-gray-700">
                                            {formatDisplayDate(selectedInvoice.invoiceDate)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Due Date</p>
                                        <p className="text-sm text-gray-700">
                                            {formatDisplayDate(selectedInvoice.dueDate)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Status</p>
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${selectedInvoice.status === "PAID" ? "bg-green-100 text-green-800" :
                                            selectedInvoice.status === "PARTIALLY_PAID" ? "bg-yellow-100 text-yellow-800" :
                                                "bg-blue-100 text-blue-800"
                                            }`}>
                                            {selectedInvoice.status || "OPEN"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Customer Information Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <BuildingOfficeIcon className="h-5 w-5" />
                                Customer Information
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Customer <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={form.customerId || ""}
                                        onChange={(e) => handleCustomerChange(Number(e.target.value))}
                                        disabled={submitting || !!selectedInvoice}
                                        className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.customerId ? "border-red-300" : "border-gray-300"
                                            } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                    >
                                        <option value="">Select Customer</option>
                                        {customers.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name || c.email}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.customerId && (
                                        <p className="text-red-500 text-xs mt-1">{errors.customerId}</p>
                                    )}
                                    {selectedInvoice && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Customer is auto-populated from selected invoice
                                        </p>
                                    )}
                                </div>

                                {/* Customer Details Display */}
                                {selectedCustomer && (
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserIcon className="h-4 w-4 text-cyan-600" />
                                            <span className="text-sm font-semibold text-gray-900">
                                                {selectedCustomer.name || 'No name provided'}
                                            </span>
                                        </div>
                                        {selectedCustomer.email && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                                                <EnvelopeIcon className="h-4 w-4 text-gray-400" />
                                                {selectedCustomer.email}
                                            </div>
                                        )}
                                        {selectedCustomer.phone && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                <PhoneIcon className="h-4 w-4 text-gray-400" />
                                                {selectedCustomer.phone}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Financial Details Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <CurrencyDollarIcon className="h-5 w-5" />
                                Financial Details
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={form.invoiceDate ? new Date(form.invoiceDate) : null}
                                            onChange={(date) => handleChange("invoiceDate", date ? date.toISOString().split('T')[0] : "")}
                                            dateFormat="yyyy-MM-dd"
                                            disabled={submitting || !!selectedInvoice}
                                            className={`w-full p-2.5 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceDate ? "border-red-300" : "border-gray-300"
                                                } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                            placeholderText="Select invoice date"
                                        />
                                        <CalendarIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.invoiceDate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.invoiceDate}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Due Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={form.dueDate ? new Date(form.dueDate) : null}
                                            onChange={(date) => handleChange("dueDate", date ? date.toISOString().split('T')[0] : "")}
                                            dateFormat="yyyy-MM-dd"
                                            disabled={submitting}
                                            className={`w-full p-2.5 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.dueDate ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                            placeholderText="Select due date"
                                        />
                                        <CalendarIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.dueDate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Amount <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                        <input
                                            type="number"
                                            value={form.invoiceAmount || ""}
                                            onChange={(e) => handleChange("invoiceAmount", Number(e.target.value))}
                                            disabled={submitting || !!selectedInvoice}
                                            min="0"
                                            step="0.01"
                                            className={`w-full pl-8 pr-3 p-2.5 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceAmount ? "border-red-300" : "border-gray-300"
                                                } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                    </div>
                                    {errors.invoiceAmount && (
                                        <p className="text-red-500 text-xs mt-1">{errors.invoiceAmount}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount Paid
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                        <input
                                            type="number"
                                            value={form.amountPaid || ""}
                                            onChange={(e) => handleChange("amountPaid", Number(e.target.value))}
                                            disabled={submitting}
                                            min="0"
                                            step="0.01"
                                            className={`w-full pl-8 pr-3 p-2.5 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.amountPaid ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                    </div>
                                    {errors.amountPaid && (
                                        <p className="text-red-500 text-xs mt-1">{errors.amountPaid}</p>
                                    )}
                                </div>
                            </div>

                            {/* Last Payment Date - Only shown when amount paid > 0 */}
                            {form.amountPaid > 0 && (
                                <div className="mt-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Payment Date
                                    </label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={form.lastPaymentDate ? new Date(form.lastPaymentDate) : new Date()}
                                            onChange={(date) => handleChange("lastPaymentDate", date ? date.toISOString().split('T')[0] : null)}
                                            dateFormat="yyyy-MM-dd"
                                            disabled={submitting}
                                            className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                            placeholderText="Select last payment date"
                                        />
                                        <CalendarIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Defaults to today if not specified</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <BanknotesIcon className="h-5 w-5" />
                                Summary
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-1">Balance Due</p>
                                    <p className="text-2xl font-bold text-cyan-600">${balance.toFixed(2)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-1">Status</p>
                                    <p className={`text-lg font-semibold ${status === "PAID" ? "text-green-600" :
                                        status === "PARTIALLY_PAID" ? "text-yellow-600" :
                                            "text-blue-600"
                                        }`}>
                                        {status.replace('_', ' ')}
                                    </p>
                                </div>
                                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
                                        <p className="text-xs text-gray-500 mb-1">Payment Progress</p>
                                        <div className="mt-1">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Paid</span>
                                                <span>{paymentProgress.toFixed(0)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full transition-all duration-300 ${status === "PAID" ? "bg-green-600" :
                                                    status === "PARTIALLY_PAID" ? "bg-yellow-600" :
                                                        "bg-blue-600"
                                                    }`}
                                                style={{ width: `${paymentProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {form.amountPaid === 0 ? "No payments received" :
                                                form.amountPaid < form.invoiceAmount ? "Partial payment" :
                                                    "Fully paid"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/accounts-receivable")}
                            disabled={submitting}
                            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[160px] justify-center font-medium shadow-sm"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    {isEdit ? "Updating..." : "Saving..."}
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="h-5 w-5" />
                                    {isEdit ? "Update Receivable" : "Create Receivable"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AccountsReceivableForm;
