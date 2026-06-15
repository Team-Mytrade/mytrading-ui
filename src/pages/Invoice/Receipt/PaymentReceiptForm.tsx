import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    ArrowLeftIcon,
    ReceiptPercentIcon,
    CreditCardIcon,
    DocumentTextIcon,
    BuildingOfficeIcon,
    CurrencyDollarIcon,
    ClipboardDocumentIcon,
    PlusIcon,
    TrashIcon,
    CheckCircleIcon,
    PencilSquareIcon,
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
    balance: number;
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
}

// Payload interface with correct structure
interface PaymentReceiptPayload {
    receiptNumber: string;
    paymentDate: string;
    customer: { id: number } | null;
    totalAmountReceived: number;
    paymentMethod?: string;
    referenceNumber?: string;
    receivedBy?: string;
    notes?: string;
    allocations: {
        invoice: { id: number } | null;
        allocatedAmount: number;
    }[];
    invoice?: { id: number } | null;
}

const emptyReceipt: PaymentReceipt = {
    receiptNumber: "",
    paymentDate: new Date().toISOString().split('T')[0],
    customer: null,
    totalAmountReceived: 0,
    paymentMethod: "",
    referenceNumber: "",
    receivedBy: "",
    notes: "",
    allocations: [],
    invoice: null,
};

const PaymentReceiptForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<PaymentReceipt>(emptyReceipt);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof PaymentReceipt, string>>>({});

    useEffect(() => {
        const load = async () => {
            try {
                const [custRes, invRes] = await Promise.all([
                    axios.get(API_CUSTOMERS),
                    axios.get(API_INVOICES),
                ]);
                setCustomers(custRes.data);
                setInvoices(invRes.data);

                if (isEdit) {
                    const res = await axios.get(`${API_RECEIPTS}/${id}`);
                    const d = res.data;
                    setForm({
                        ...d,
                        paymentDate: d.paymentDate?.split('T')[0] || "",
                        customer: d.customer ? { id: d.customer.id } : null,
                        invoice: d.invoice ? { id: d.invoice.id } : null,
                        allocations: d.allocations || [],
                    });
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

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof PaymentReceipt, string>> = {};
        if (!form.receiptNumber.trim()) newErrors.receiptNumber = "Receipt number is required";
        if (!form.paymentDate) newErrors.paymentDate = "Payment date is required";
        if (!form.customer?.id) newErrors.customer = "Customer is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof PaymentReceipt>(key: K, value: PaymentReceipt[K]) => {
        if (submitting) return;
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const addAllocation = () => {
        if (submitting) return;
        setForm(prev => ({
            ...prev,
            allocations: [...prev.allocations, { invoice: null, allocatedAmount: 0 }]
        }));
    };

    const updateAllocation = (index: number, key: keyof Allocation, value: any) => {
        if (submitting) return;
        const updated = [...form.allocations];
        updated[index] = { ...updated[index], [key]: value };
        setForm(prev => ({ ...prev, allocations: updated }));

        // Recalculate total
        const total = updated.reduce((sum, a) => sum + (Number(a.allocatedAmount) || 0), 0);
        setForm(prev => ({ ...prev, totalAmountReceived: total }));
    };

    const removeAllocation = (index: number) => {
        if (submitting) return;
        const updated = form.allocations.filter((_, i) => i !== index);
        setForm(prev => ({ ...prev, allocations: updated }));

        // Recalculate total
        const total = updated.reduce((sum, a) => sum + (Number(a.allocatedAmount) || 0), 0);
        setForm(prev => ({ ...prev, totalAmountReceived: total }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            // Create payload with correct structure
            const payload: PaymentReceiptPayload = {
                receiptNumber: form.receiptNumber,
                paymentDate: form.paymentDate,
                customer: form.customer,
                totalAmountReceived: form.totalAmountReceived,
                paymentMethod: form.paymentMethod || undefined,
                referenceNumber: form.referenceNumber || undefined,
                receivedBy: form.receivedBy || undefined,
                notes: form.notes || undefined,
                allocations: form.allocations.map(a => ({
                    invoice: a.invoice,
                    allocatedAmount: a.allocatedAmount
                })),
                invoice: form.invoice,
            };

            if (isEdit) {
                await axios.put(`${API_RECEIPTS}/${id}`, payload);
                ToasterService.success("Receipt updated successfully");
            } else {
                await axios.post(API_RECEIPTS, payload);
                ToasterService.success("Receipt created successfully");
            }
            navigate("/payment-receipt");
        } catch (err: any) {
            console.error("Error saving receipt:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save receipt");
        } finally {
            setSubmitting(false);
        }
    };

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
                title={isEdit ? "Edit Receipt" : "Add Receipt"}
                description="Manage payment receipts"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Receipt" : "Add Receipt"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/payment-receipts")}
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
                    {/* Basic Information Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg !text-white font-semibold flex items-center gap-2">
                                <ReceiptPercentIcon className="h-5 w-5" />
                                Receipt Information
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Receipt Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.receiptNumber}
                                        onChange={(e) => handleChange("receiptNumber", e.target.value)}
                                        disabled={submitting}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.receiptNumber ? "border-red-300" : "border-gray-300"
                                            } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        placeholder="RCP-001"
                                    />
                                    {errors.receiptNumber && (
                                        <p className="text-red-500 text-xs mt-1">{errors.receiptNumber}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Payment Date <span className="text-red-500">*</span>
                                    </label>
                                    <DatePicker
                                        selected={form.paymentDate ? new Date(form.paymentDate) : null}
                                        onChange={(date) => handleChange("paymentDate", date ? date.toISOString().split('T')[0] : "")}
                                        dateFormat="yyyy-MM-dd"
                                        disabled={submitting}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.paymentDate ? "border-red-300" : "border-gray-300"
                                            } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        placeholderText="Select date"
                                    />
                                    {errors.paymentDate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.paymentDate}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Customer <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={form.customer?.id || ""}
                                        onChange={(e) => handleChange("customer", e.target.value ? { id: Number(e.target.value) } : null)}
                                        disabled={submitting}
                                        className={`w-full p-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.customer ? "border-red-300" : "border-gray-300"
                                            } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                    >
                                        <option value="">Select Customer</option>
                                        {customers.map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    {errors.customer && (
                                        <p className="text-red-500 text-xs mt-1">{errors.customer}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg !text-white font-semibold flex items-center gap-2">
                                <CreditCardIcon className="h-5 w-5" />
                                Payment Details
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        value={form.paymentMethod}
                                        onChange={(e) => handleChange("paymentMethod", e.target.value)}
                                        disabled={submitting}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                    >
                                        <option value="">Select Method</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Card">Card</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Check">Check</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reference Number
                                    </label>
                                    <input
                                        type="text"
                                        value={form.referenceNumber}
                                        onChange={(e) => handleChange("referenceNumber", e.target.value)}
                                        disabled={submitting}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholder="REF-001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Received By
                                    </label>
                                    <input
                                        type="text"
                                        value={form.receivedBy}
                                        onChange={(e) => handleChange("receivedBy", e.target.value)}
                                        disabled={submitting}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                        placeholder="John Doe"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Invoice Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg !text-white font-semibold flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5" />
                                Main Invoice (Optional)
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Main Invoice
                                    </label>
                                    <select
                                        value={form.invoice?.id || ""}
                                        onChange={(e) => handleChange("invoice", e.target.value ? { id: Number(e.target.value) } : null)}
                                        disabled={submitting}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                    >
                                        <option value="">Select Main Invoice</option>
                                        {invoices.map((inv) => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.invoiceNumber} (Balance: {inv.balance.toFixed(2)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Invoice Allocations Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white flex justify-between items-center">
                            <h3 className="text-lg !text-white font-semibold flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5" />
                                Invoice Allocations
                            </h3>
                            <button
                                type="button"
                                onClick={addAllocation}
                                disabled={submitting}
                                className="px-3 py-1 bg-white text-cyan-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center gap-1"
                            >
                                <PlusIcon className="h-4 w-4" />
                                Add Allocation
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {form.allocations.map((alloc, i) => (
                                    <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs text-gray-500 mb-1">Invoice</label>
                                                <select
                                                    value={alloc.invoice?.id || ""}
                                                    onChange={(e) => updateAllocation(i, "invoice", e.target.value ? { id: Number(e.target.value) } : null)}
                                                    disabled={submitting}
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm disabled:bg-gray-100"
                                                >
                                                    <option value="">Select Invoice</option>
                                                    {invoices.map((inv) => (
                                                        <option key={inv.id} value={inv.id}>
                                                            {inv.invoiceNumber} (Balance: {inv.balance.toFixed(2)})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Allocated Amount</label>
                                                <input
                                                    type="number"
                                                    value={alloc.allocatedAmount}
                                                    onChange={(e) => updateAllocation(i, "allocatedAmount", Number(e.target.value))}
                                                    disabled={submitting}
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm text-right disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div className="flex items-end justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => removeAllocation(i)}
                                                    disabled={submitting}
                                                    className="p-2 text-red-600 hover:text-red-800 disabled:opacity-50"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {form.allocations.length === 0 && (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <DocumentTextIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-500 text-sm">No allocations added yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notes Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg !text-white font-semibold flex items-center gap-2">
                                <ClipboardDocumentIcon className="h-5 w-5" />
                                Notes
                            </h3>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={form.notes}
                                onChange={(e) => handleChange("notes", e.target.value)}
                                disabled={submitting}
                                rows={3}
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100"
                                placeholder="Enter any additional notes..."
                            />
                        </div>
                    </div>

                    {/* Total Summary Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-4 text-white">
                            <h3 className="text-lg !text-white font-semibold flex items-center gap-2">
                                <CurrencyDollarIcon className="h-5 w-5" />
                                Total Summary
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-end">
                                <div className="text-right">
                                    <p className="text-sm text-gray-600 mb-1">Total Amount Received</p>
                                    <p className="text-3xl font-bold text-cyan-600">
                                        {form.totalAmountReceived.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/payment-receipts")}
                            disabled={submitting}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 !mb-0 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px] justify-center"
                        >
                            {submitting ? (
                                <>
                                    <div className="w-4 h-4 border-2  !text-white border-white border-t-transparent rounded-full animate-spin"></div>
                                    {isEdit ? "Updating..." : "Saving..."}
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon className="h-5 w-5" />
                                    {isEdit ? "Update Receipt" : "Create Receipt"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default PaymentReceiptForm;