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
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/accounts-payable";
const VENDORS_URL = "/v1/api/invoice/vendors";
const INVOICES_URL = "/v1/api/invoice/invoices";

interface Vendor {
    id: number;
    name: string;
}

interface Invoice {
    id: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    currency: string;
    vendor?: {
        id: number;
        name: string;
    };
    referenceNumber?: string;
    notes?: string;
}

interface AccountsPayableForm {
    invoiceId?: number | null;
    vendorId?: number | null;
    invoiceNumber?: string;
    invoiceDate?: string;
    dueDate: string;
    invoiceAmount: number;
    amountPaid: number;
    lastPaymentDate?: string;
    currency?: string;
    referenceNumber?: string;
    notes?: string;
    vendorDetails?: {
        name: string;
    };
}

const emptyForm: AccountsPayableForm = {
    invoiceId: null,
    vendorId: null,
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    invoiceAmount: 0,
    amountPaid: 0,
    lastPaymentDate: undefined,
    currency: "USD",
    referenceNumber: "",
    notes: "",
    vendorDetails: undefined,
};

const AccountsPayableForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<AccountsPayableForm>(emptyForm);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof AccountsPayableForm, string>>>({});

    useEffect(() => {
        const load = async () => {
            try {
                const [vendorRes, invoiceRes] = await Promise.all([
                    axios.get(VENDORS_URL),
                    axios.get(INVOICES_URL)
                ]);
                setVendors(Array.isArray(vendorRes.data) ? vendorRes.data : []);

                // Filter invoices to only show purchase invoices (you may need to adjust based on your data structure)
                const allInvoices = Array.isArray(invoiceRes.data) ? invoiceRes.data : [];
                setInvoices(allInvoices);

                if (isEdit) {
                    const res = await axios.get(`${BASE_URL}/${id}`);
                    const d = res.data;
                    setForm({
                        invoiceId: d.invoice?.id || null,
                        vendorId: d.vendor?.id || null,
                        invoiceNumber: d.invoiceNumber || "",
                        invoiceDate: d.invoiceDate?.split('T')[0] || "",
                        dueDate: d.dueDate?.split('T')[0] || "",
                        invoiceAmount: d.invoiceAmount || 0,
                        amountPaid: d.amountPaid || 0,
                        lastPaymentDate: d.lastPaymentDate?.split('T')[0] || undefined,
                        currency: d.currency || "USD",
                        referenceNumber: d.referenceNumber || "",
                        notes: d.notes || "",
                        vendorDetails: d.vendor ? {
                            name: d.vendor.name,
                        } : undefined,
                    });

                    // Find and set the selected invoice
                    if (d.invoice?.id) {
                        const invoice = allInvoices.find((inv: Invoice) => inv.id === d.invoice.id);
                        setSelectedInvoice(invoice || null);
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
            // Populate all fields from the selected invoice
            setForm(prev => ({
                ...prev,
                invoiceId: invoice.id,
                vendorId: invoice.vendor?.id || null,
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate?.split('T')[0] || "",
                dueDate: invoice.dueDate?.split('T')[0] || "",
                invoiceAmount: invoice.totalAmount || 0,
                currency: invoice.currency || "USD",
                referenceNumber: invoice.referenceNumber || "",
                notes: invoice.notes || "",
                vendorDetails: invoice.vendor ? {
                    name: invoice.vendor.name,
                } : undefined,
            }));

            // Clear any errors for populated fields
            setErrors(prev => ({
                ...prev,
                invoiceId: undefined,
                vendorId: undefined,
                invoiceNumber: undefined,
                invoiceDate: undefined,
                dueDate: undefined,
                invoiceAmount: undefined,
            }));
        }
    };

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof AccountsPayableForm, string>> = {};
        if (!form.invoiceId) newErrors.invoiceId = "Invoice is required";
        if (!form.vendorId) newErrors.vendorId = "Vendor is required";
        if (!form.invoiceNumber) newErrors.invoiceNumber = "Invoice number is required";
        if (!form.invoiceDate) newErrors.invoiceDate = "Invoice date is required";
        if (!form.dueDate) newErrors.dueDate = "Due date is required";
        if (form.invoiceAmount <= 0) newErrors.invoiceAmount = "Invoice amount must be greater than 0";
        if (form.amountPaid < 0) newErrors.amountPaid = "Amount paid cannot be negative";
        if (form.amountPaid > form.invoiceAmount) newErrors.amountPaid = "Amount paid cannot exceed invoice amount";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof AccountsPayableForm>(key: K, value: AccountsPayableForm[K]) => {
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

            const payload = {
                invoiceAmount: form.invoiceAmount,
                amountPaid: form.amountPaid,
                balance,
                accountsPayableStatus: status,
                lastPaymentDate: form.amountPaid > 0 ? (form.lastPaymentDate || new Date().toISOString().split('T')[0]) : undefined,
                dueDate: form.dueDate,
            };

            if (isEdit) {
                await axios.put(`${BASE_URL}/${id}`, payload);
                ToasterService.success("Payable updated successfully");
            } else {
                await axios.post(`${BASE_URL}/create`, payload);
                ToasterService.success("Payable created successfully");
            }
            navigate("/accounts-payable");
        } catch (err: any) {
            console.error("Error saving payable:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save payable");
        } finally {
            setSubmitting(false);
        }
    };

    const balance = form.invoiceAmount - form.amountPaid;
    const status = form.amountPaid === 0 ? "OPEN" :
        form.amountPaid < form.invoiceAmount ? "PARTIALLY_PAID" : "PAID";

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
                title={isEdit ? "Edit Payable" : "Add Payable"}
                description="Manage accounts payable"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Payable" : "Add Payable"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/accounts-payable")}
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
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <DocumentTextIcon className="h-5 w-5" />
                                Select Invoice
                            </h3>
                            <p className="text-cyan-100 text-sm mt-1">
                                Select an invoice to auto-populate vendor and amount details
                            </p>
                        </div>
                        <div className="p-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Invoice <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.invoiceId || ""}
                                    onChange={(e) => handleInvoiceChange(Number(e.target.value))}
                                    disabled={submitting}
                                    className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceId ? "border-red-300" : "border-gray-300"
                                        } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                >
                                    <option value="">Select Invoice</option>
                                    {invoices.map((inv) => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.invoiceNumber} - {inv.vendor?.name || 'N/A'} (${inv.totalAmount?.toFixed(2) || '0.00'})
                                        </option>
                                    ))}
                                </select>
                                {errors.invoiceId && (
                                    <p className="text-red-500 text-xs mt-1">{errors.invoiceId}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details Card - Shows when invoice is selected */}
                    {selectedInvoice && (
                        <div className="bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                            <div className="bg-blue-600 p-3 text-white">
                                <h3 className="text-sm font-semibold flex items-center gap-2 !text-white">
                                    <DocumentTextIcon className="h-4 w-4" />
                                    Selected Invoice Details
                                </h3>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Invoice Number</p>
                                        <p className="text-sm font-medium text-gray-900">{selectedInvoice.invoiceNumber}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Invoice Date</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Due Date</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Vendor Information Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <BuildingOfficeIcon className="h-5 w-5" />
                                Vendor Information
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Vendor <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={form.vendorId || ""}
                                        onChange={(e) => handleChange("vendorId", e.target.value ? Number(e.target.value) : null)}
                                        disabled={submitting || !!selectedInvoice}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.vendorId ? "border-red-300" : "border-gray-300"
                                            } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                    >
                                        <option value="">Select Vendor</option>
                                        {vendors.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.vendorId && (
                                        <p className="text-red-500 text-xs mt-1">{errors.vendorId}</p>
                                    )}
                                </div>

                                {/* Vendor Details Display */}
                                {form.vendorDetails && (
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-sm font-medium text-gray-700">
                                            {form.vendorDetails.name}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <DocumentTextIcon className="h-5 w-5" />
                                Invoice Details
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.invoiceNumber}
                                        onChange={(e) => handleChange("invoiceNumber", e.target.value)}
                                        disabled={submitting || !!selectedInvoice}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceNumber ? "border-red-300" : "border-gray-300"
                                            } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        placeholder="e.g. INV-2024-001"
                                    />
                                    {errors.invoiceNumber && (
                                        <p className="text-red-500 text-xs mt-1">{errors.invoiceNumber}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Currency
                                    </label>
                                    <select
                                        value={form.currency}
                                        onChange={(e) => handleChange("currency", e.target.value)}
                                        disabled={submitting || !!selectedInvoice}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Date <span className="text-red-500">*</span>
                                    </label>
                                    <DatePicker
                                        selected={form.invoiceDate ? new Date(form.invoiceDate) : null}
                                        onChange={(date) => handleChange("invoiceDate", date ? date.toISOString().split('T')[0] : "")}
                                        dateFormat="yyyy-MM-dd"
                                        disabled={submitting || !!selectedInvoice}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceDate ? "border-red-300" : "border-gray-300"
                                            } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        placeholderText="Select invoice date"
                                    />
                                    {errors.invoiceDate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.invoiceDate}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Due Date <span className="text-red-500">*</span>
                                    </label>
                                    <DatePicker
                                        selected={form.dueDate ? new Date(form.dueDate) : null}
                                        onChange={(date) => handleChange("dueDate", date ? date.toISOString().split('T')[0] : "")}
                                        dateFormat="yyyy-MM-dd"
                                        disabled={submitting || !!selectedInvoice}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.dueDate ? "border-red-300" : "border-gray-300"
                                            } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        placeholderText="Select due date"
                                    />
                                    {errors.dueDate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.dueDate}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financial Details Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <CurrencyDollarIcon className="h-5 w-5" />
                                Financial Details
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Invoice Amount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={form.invoiceAmount || ""}
                                        onChange={(e) => handleChange("invoiceAmount", Number(e.target.value))}
                                        disabled={submitting || !!selectedInvoice}
                                        min="0"
                                        step="0.01"
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.invoiceAmount ? "border-red-300" : "border-gray-300"
                                            } ${(submitting || !!selectedInvoice) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                    />
                                    {errors.invoiceAmount && (
                                        <p className="text-red-500 text-xs mt-1">{errors.invoiceAmount}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount Paid
                                    </label>
                                    <input
                                        type="number"
                                        value={form.amountPaid || ""}
                                        onChange={(e) => handleChange("amountPaid", Number(e.target.value))}
                                        disabled={submitting}
                                        min="0"
                                        step="0.01"
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.amountPaid ? "border-red-300" : "border-gray-300"
                                            } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                    />
                                    {errors.amountPaid && (
                                        <p className="text-red-500 text-xs mt-1">{errors.amountPaid}</p>
                                    )}
                                </div>
                            </div>

                            {/* Last Payment Date - Only shown when amount paid > 0 */}
                            {form.amountPaid > 0 && (
                                <div className="mt-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Payment Date
                                    </label>
                                    <DatePicker
                                        selected={form.lastPaymentDate ? new Date(form.lastPaymentDate) : null}
                                        onChange={(date) => handleChange("lastPaymentDate", date ? date.toISOString().split('T')[0] : undefined)}
                                        dateFormat="yyyy-MM-dd"
                                        disabled={submitting}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholderText="Select last payment date"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Defaults to today if not specified</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Additional Details Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <DocumentTextIcon className="h-5 w-5" />
                                Additional Details
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reference Number
                                    </label>
                                    <input
                                        type="text"
                                        value={form.referenceNumber}
                                        onChange={(e) => handleChange("referenceNumber", e.target.value)}
                                        disabled={submitting || !!selectedInvoice}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholder="e.g. PO-12345"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Notes
                                    </label>
                                    <input
                                        type="text"
                                        value={form.notes}
                                        onChange={(e) => handleChange("notes", e.target.value)}
                                        disabled={submitting || !!selectedInvoice}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholder="Additional notes"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg font-semibold flex items-center gap-2 !text-white">
                                <CheckCircleIcon className="h-5 w-5" />
                                Summary
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-1">Balance</p>
                                    <p className="text-xl font-bold text-cyan-600">${balance.toFixed(2)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-1">Status</p>
                                    <p className={`text-lg font-semibold ${status === "PAID" ? "text-green-600" :
                                        status === "PARTIALLY_PAID" ? "text-yellow-600" :
                                            "text-blue-600"
                                        }`}>
                                        {status.replace('_', ' ')}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                                    <p className="text-sm text-gray-700">
                                        {form.amountPaid === 0 ? "No payments made" :
                                            form.amountPaid < form.invoiceAmount ? "Partial payment" :
                                                "Fully paid"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/accounts-payable")}
                            disabled={submitting}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-cyan-600 !mb-0 !text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px] justify-center"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    {isEdit ? "Updating..." : "Saving..."}
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="h-5 w-5" />
                                    {isEdit ? "Update Payable" : "Create Payable"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AccountsPayableForm;