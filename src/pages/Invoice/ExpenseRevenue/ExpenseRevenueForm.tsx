import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    ArrowLeftIcon,
    CheckIcon,
    CurrencyDollarIcon,
    BuildingOfficeIcon,
    TagIcon,
    DocumentTextIcon,
    BanknotesIcon,
    HashtagIcon,
    CalendarIcon,
    PencilSquareIcon,
    PlusIcon,
    XMarkIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/expenses-revenue";
const ACCOUNT_API = "/v1/api/invoice/general-accounts";

export enum RevenueExpenseType {
    REVENUE = "REVENUE",
    EXPENSE = "EXPENSE",
}

export enum RevenueExpenseCategory {
    RENT = "RENT",
    FREIGHT = "FREIGHT",
    MISC = "MISC",
    SALARY = "SALARY",
    UTILITIES = "UTILITIES",
    OFFICE_SUPPLIES = "OFFICE_SUPPLIES",
    MAINTENANCE = "MAINTENANCE",
    TRAVEL = "TRAVEL",
    ENTERTAINMENT = "ENTERTAINMENT",
    ADVERTISING = "ADVERTISING",
    INSURANCE = "INSURANCE",
    TAXES = "TAXES",
    DEPRECIATION = "DEPRECIATION",
    INTEREST = "INTEREST",
    OTHER = "OTHER",
}

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "CREDIT_CARD", "CHEQUE", "UPI", "ONLINE"];

interface GeneralAccount {
    id: number;
    accountCode: string;
    accountName: string;
}

interface ExpenseRevenueForm {
    revenueExpenseType: RevenueExpenseType;
    revenueExpenseCategory: RevenueExpenseCategory;
    description: string;
    amount: number;
    transactionDate: string;
    generalAccountId: number | null;
    paymentMethod: string;
    referenceNumber: string;
}

// Payload interface with correct structure (generalAccount as object with id)
interface ExpenseRevenuePayload {
    revenueExpenseType: RevenueExpenseType;
    revenueExpenseCategory: RevenueExpenseCategory;
    description: string;
    amount: number;
    transactionDate: string;
    generalAccount?: { id: number } | null;  // Object with id, not direct ID
    paymentMethod?: string;
    referenceNumber?: string;
}

const emptyForm: ExpenseRevenueForm = {
    revenueExpenseType: RevenueExpenseType.EXPENSE,
    revenueExpenseCategory: RevenueExpenseCategory.OTHER,
    description: "",
    amount: 0,
    transactionDate: new Date().toISOString().split("T")[0],
    generalAccountId: null,
    paymentMethod: "",
    referenceNumber: "",
};

const ExpenseRevenueFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<ExpenseRevenueForm>(emptyForm);
    const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof ExpenseRevenueForm, string>>>({});

    useEffect(() => {
        const load = async () => {
            try {
                const [accRes] = await Promise.all([axios.get(ACCOUNT_API)]);
                setAccounts(Array.isArray(accRes.data) ? accRes.data : []);
                if (isEdit) {
                    const res = await axios.get(`${API_URL}/${id}`);
                    const d = res.data;
                    setForm({
                        revenueExpenseType: d.revenueExpenseType,
                        revenueExpenseCategory: d.revenueExpenseCategory,
                        description: d.description || "",
                        amount: d.amount || 0,
                        transactionDate: (d.transactionDate || "").split("T")[0],
                        generalAccountId: d.generalAccount?.id || null,  // Extract ID from the account object
                        paymentMethod: d.paymentMethod || "",
                        referenceNumber: d.referenceNumber || "",
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
        const newErrors: Partial<Record<keyof ExpenseRevenueForm, string>> = {};
        if (!form.description.trim()) newErrors.description = "Description is required";
        if (!form.amount || form.amount <= 0) newErrors.amount = "Amount must be greater than 0";
        if (!form.transactionDate) newErrors.transactionDate = "Transaction date is required";
        if (!form.revenueExpenseType) newErrors.revenueExpenseType = "Type is required";
        if (!form.revenueExpenseCategory) newErrors.revenueExpenseCategory = "Category is required";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof ExpenseRevenueForm>(key: K, value: ExpenseRevenueForm[K]) => {
        if (submitting) return;
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const handleDateChange = (date: Date | null) => {
        if (submitting) return;
        setForm(prev => ({
            ...prev,
            transactionDate: date ? date.toISOString().split('T')[0] : ""
        }));
        if (errors.transactionDate) {
            setErrors(prev => ({ ...prev, transactionDate: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            // Create payload with the correct structure - generalAccount as object with id
            const payload: ExpenseRevenuePayload = {
                revenueExpenseType: form.revenueExpenseType,
                revenueExpenseCategory: form.revenueExpenseCategory,
                description: form.description,
                amount: form.amount,
                transactionDate: form.transactionDate,
                generalAccount: form.generalAccountId ? { id: form.generalAccountId } : null,  // Convert ID to object
                paymentMethod: form.paymentMethod || undefined,
                referenceNumber: form.referenceNumber || undefined,
            };

            if (isEdit) {
                await axios.put(`${API_URL}/${id}`, payload);
                ToasterService.success("Transaction updated successfully");
            } else {
                await axios.post(API_URL, payload);
                ToasterService.success("Transaction created successfully");
            }
            navigate("/expense-revenue");
        } catch (err: any) {
            console.error("Save error:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save transaction");
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

    const isRevenue = form.revenueExpenseType === RevenueExpenseType.REVENUE;

    return (
        <>
            <PageMeta
                title={isEdit ? "Edit Transaction" : "Add Transaction"}
                description="Manage expense or revenue transaction"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Transaction" : "Add Transaction"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/expense-revenue")}
                        disabled={submitting}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className={`bg-gradient-to-r ${isRevenue ? 'from-green-600 to-green-700' : 'from-red-600 to-red-700'} p-6 text-white`}>
                        <h3 className="text-xl mb-0  !text-white !font-semibold flex items-center gap-2">
                            {isEdit ? (
                                <>
                                    <PencilSquareIcon className="h-6 w-6" />
                                    Edit Transaction
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="h-6 w-6" />
                                    {isRevenue ? "Add Revenue" : "Add Expense"}
                                </>
                            )}
                        </h3>
                        <p className="text-white/80 text-sm mt-1">
                            {isRevenue ? "Record incoming revenue" : "Record outgoing expense"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        {/* Transaction Type */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Transaction Type <span className="text-red-500">*</span>
                            </label>
                            <div className="flex gap-4">
                                {Object.values(RevenueExpenseType).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => !submitting && handleChange("revenueExpenseType", t)}
                                        disabled={submitting}
                                        className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all border-2 ${form.revenueExpenseType === t
                                            ? t === RevenueExpenseType.REVENUE
                                                ? "bg-green-600 !text-white border-green-600"
                                                : "bg-red-600 !text-white border-red-600"
                                            : "bg-white !text-gray-700 border-gray-300 hover:bg-gray-50"
                                            } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center justify-center">
                                            {t === RevenueExpenseType.REVENUE ? (
                                                <ArrowTrendingUpIcon className="h-5 w-5" />
                                            ) : (
                                                <ArrowTrendingDownIcon className="h-5 w-5" />
                                            )}
                                            {t}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {errors.revenueExpenseType && (
                                <p className="text-red-500 text-xs mt-1">{errors.revenueExpenseType}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                    Transaction Details
                                </h4>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={form.description}
                                            onChange={e => handleChange("description", e.target.value)}
                                            disabled={submitting}
                                            placeholder="Describe this transaction..."
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all ${errors.description ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <DocumentTextIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.description && (
                                        <p className="text-red-500 text-xs mt-1">{errors.description}</p>
                                    )}
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.revenueExpenseCategory}
                                            onChange={e => handleChange("revenueExpenseCategory", e.target.value as RevenueExpenseCategory)}
                                            disabled={submitting}
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${errors.revenueExpenseCategory ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        >
                                            {Object.values(RevenueExpenseCategory).map(c => (
                                                <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                                            ))}
                                        </select>
                                        <TagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.revenueExpenseCategory && (
                                        <p className="text-red-500 text-xs mt-1">{errors.revenueExpenseCategory}</p>
                                    )}
                                </div>

                                {/* General Account */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ledger Account
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.generalAccountId ?? ""}
                                            onChange={e => handleChange("generalAccountId", e.target.value ? Number(e.target.value) : null)}
                                            disabled={submitting}
                                            className={`w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                                }`}
                                        >
                                            <option value="">Select account...</option>
                                            {accounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.accountCode} — {a.accountName}</option>
                                            ))}
                                        </select>
                                        <BuildingOfficeIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <BanknotesIcon className="h-5 w-5 text-cyan-600" />
                                    Financial Details
                                </h4>

                                {/* Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={form.amount || ""}
                                            onChange={e => handleChange("amount", Number(e.target.value))}
                                            disabled={submitting}
                                            placeholder="0.00"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono ${errors.amount ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <CurrencyDollarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.amount && (
                                        <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
                                    )}
                                </div>

                                {/* Transaction Date with DatePicker */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Transaction Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <DatePicker
                                            selected={form.transactionDate ? new Date(form.transactionDate) : null}
                                            onChange={handleDateChange}
                                            dateFormat="yyyy-MM-dd"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.transactionDate ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                            placeholderText="Select date"
                                            disabled={submitting}
                                            required
                                        />
                                        <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                                    </div>
                                    {errors.transactionDate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.transactionDate}</p>
                                    )}
                                </div>

                                {/* Payment Method & Reference */}
                                <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-gray-700">Payment Information</h5>

                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Payment Method
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={form.paymentMethod}
                                                onChange={e => handleChange("paymentMethod", e.target.value)}
                                                disabled={submitting}
                                                className={`w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                                    }`}
                                            >
                                                <option value="">Select method...</option>
                                                {PAYMENT_METHODS.map(m => (
                                                    <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                                                ))}
                                            </select>
                                            <BanknotesIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Reference Number
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={form.referenceNumber}
                                                onChange={e => handleChange("referenceNumber", e.target.value)}
                                                disabled={submitting}
                                                placeholder="e.g. TXN-00001"
                                                className={`w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                                    }`}
                                            />
                                            <HashtagIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => navigate("/expense-revenue")}
                                disabled={submitting}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px] justify-center"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        {isEdit ? "Updating..." : "Saving..."}
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="h-5 w-5" />
                                        {isEdit ? "Update Transaction" : "Save Transaction"}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default ExpenseRevenueFormPage;