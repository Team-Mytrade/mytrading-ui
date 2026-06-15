import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    ReceiptPercentIcon,
    CurrencyDollarIcon,
    CalendarIcon,
    HashtagIcon,
    DocumentTextIcon,
    ScaleIcon,
    PencilSquareIcon,
    PlusIcon,
    ShoppingCartIcon,
    TruckIcon,
    DocumentDuplicateIcon,
    AdjustmentsHorizontalIcon,
    CreditCardIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_TAX_RECORDS = "/v1/api/invoice/tax-record/record";
const API_TAX_TYPES = "/v1/api/invoice/tax-types";

// Enums based on the provided payload structure
export enum TransactionType {
    SALE = "SALE",
    PURCHASE = "PURCHASE",
    OTHER = "OTHER"
}

export enum SourceModule {
    SALES_INVOICE = "SALES_INVOICE",
    PURCHASE_INVOICE = "PURCHASE_INVOICE",
    CREDIT_NOTE = "CREDIT_NOTE",
    DEBIT_NOTE = "DEBIT_NOTE",
    ADJUSTMENT_NOTE = "ADJUSTMENT_NOTE",
    OTHER = "OTHER"
}

interface TaxTypeShort {
    id: number;
    taxName: string;
    taxRate: number;
}

// Form state interface (for UI)
interface TaxRecordForm {
    sourceModule: SourceModule;
    transactionType: TransactionType;
    taxTypeId: number | null;
    taxableAmount: number;
    transactionDate: string;
    referenceNumber: string;
    description: string;
}

// Payload interface with correct structure matching the API requirements
interface TaxRecordPayload {
    sourceModule: SourceModule;
    transactionType: TransactionType;
    taxTypeId: number;
    taxableAmount: number;
    transactionDate?: string;
    referenceNumber?: string;
    description?: string;
}

const emptyForm: TaxRecordForm = {
    sourceModule: SourceModule.SALES_INVOICE,
    transactionType: TransactionType.SALE,
    taxTypeId: null,
    taxableAmount: 0,
    transactionDate: new Date().toISOString().split("T")[0],
    referenceNumber: "",
    description: "",
};

const TaxRecordFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<TaxRecordForm>(emptyForm);
    const [taxTypes, setTaxTypes] = useState<TaxTypeShort[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof TaxRecordForm, string>>>({});

    useEffect(() => {
        const load = async () => {
            try {
                const ttRes = await axios.get(API_TAX_TYPES);
                setTaxTypes(Array.isArray(ttRes.data) ? ttRes.data : []);

                if (isEdit) {
                    const res = await axios.get(`${API_TAX_RECORDS}/${id}`);
                    const d = res.data;
                    setForm({
                        sourceModule: d.sourceModule || SourceModule.SALES_INVOICE,
                        transactionType: d.transactionType || TransactionType.SALE,
                        taxTypeId: d.taxTypeId || d.taxType?.id || null,
                        taxableAmount: d.taxableAmount || 0,
                        transactionDate: d.transactionDate?.split("T")[0] || "",
                        referenceNumber: d.referenceNumber || "",
                        description: d.description || "",
                    });
                }
            } catch (err) {
                console.error("Error loading tax record form:", err);
                ToasterService.error("Failed to load filing data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isEdit]);

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof TaxRecordForm, string>> = {};
        if (!form.sourceModule) newErrors.sourceModule = "Source module is required";
        if (!form.transactionType) newErrors.transactionType = "Transaction type is required";
        if (!form.taxTypeId) newErrors.taxTypeId = "Tax type is required";
        if (form.taxableAmount <= 0) newErrors.taxableAmount = "Taxable amount must be greater than 0";
        if (!form.referenceNumber.trim()) newErrors.referenceNumber = "Reference number is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof TaxRecordForm>(key: K, value: TaxRecordForm[K]) => {
        if (submitting) return;
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            // Create payload with the correct structure matching API requirements
            const payload: TaxRecordPayload = {
                sourceModule: form.sourceModule,
                transactionType: form.transactionType,
                taxTypeId: form.taxTypeId!,
                taxableAmount: form.taxableAmount,
                transactionDate: form.transactionDate,
                referenceNumber: form.referenceNumber,
                description: form.description || undefined,
            };

            console.log("Submitting payload:", payload);

            if (isEdit) {
                await axios.put(`${API_TAX_RECORDS}/${id}`, payload);
                ToasterService.success("Tax record updated successfully");
            } else {
                await axios.post(API_TAX_RECORDS, payload);
                ToasterService.success("Tax record created successfully");
            }
            navigate("/taxRecords");
        } catch (err: any) {
            console.error("Save error:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save tax record");
        } finally {
            setSubmitting(false);
        }
    };

    // Helper function to get icon for source module
    const getSourceModuleIcon = (module: SourceModule) => {
        switch (module) {
            case SourceModule.SALES_INVOICE:
                return <DocumentDuplicateIcon className="h-5 w-5 text-blue-500" />;
            case SourceModule.PURCHASE_INVOICE:
                return <DocumentDuplicateIcon className="h-5 w-5 text-orange-500" />;
            case SourceModule.CREDIT_NOTE:
                return <CreditCardIcon className="h-5 w-5 text-green-500" />;
            case SourceModule.DEBIT_NOTE:
                return <CreditCardIcon className="h-5 w-5 text-red-500" />;
            case SourceModule.ADJUSTMENT_NOTE:
                return <AdjustmentsHorizontalIcon className="h-5 w-5 text-yellow-500" />;
            case SourceModule.OTHER:
                return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
            default:
                return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
        }
    };

    // Helper function to get icon for transaction type
    const getTransactionTypeIcon = (type: TransactionType) => {
        switch (type) {
            case TransactionType.SALE:
                return <ShoppingCartIcon className="h-5 w-5 text-green-500" />;
            case TransactionType.PURCHASE:
                return <TruckIcon className="h-5 w-5 text-blue-500" />;
            case TransactionType.OTHER:
                return <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />;
            default:
                return <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />;
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
                title={isEdit ? "Edit Tax Record" : "Add Tax Record"}
                description="Official financial tax registration form"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Tax Record" : "Add Tax Record"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/taxRecords")}
                        disabled={submitting}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-6 text-white">
                        <h3 className="text-xl !text-white font-semibold flex items-center gap-2">
                            {isEdit ? (
                                <>
                                    <PencilSquareIcon className="h-6 w-6" />
                                    Edit Tax Record
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="h-6 w-6" />
                                    Add New Tax Record
                                </>
                            )}
                        </h3>
                        <p className="text-cyan-100 text-sm mt-1">
                            {isEdit ? "Update tax filing details" : "Create a new tax filing record"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <DocumentDuplicateIcon className="h-5 w-5 text-cyan-600" />
                                    Source Information
                                </h4>

                                {/* Source Module */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Source Module <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.sourceModule}
                                            onChange={e => handleChange("sourceModule", e.target.value as SourceModule)}
                                            disabled={submitting}
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${errors.sourceModule ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        >
                                            {Object.values(SourceModule).map(module => (
                                                <option key={module} value={module}>
                                                    {module.replace('_', ' ')}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute left-3 top-2.5">
                                            {getSourceModuleIcon(form.sourceModule)}
                                        </div>
                                    </div>
                                    {errors.sourceModule && (
                                        <p className="text-red-500 text-xs mt-1">{errors.sourceModule}</p>
                                    )}
                                </div>

                                {/* Transaction Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Transaction Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.transactionType}
                                            onChange={e => handleChange("transactionType", e.target.value as TransactionType)}
                                            disabled={submitting}
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${errors.transactionType ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        >
                                            {Object.values(TransactionType).map(type => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute left-3 top-2.5">
                                            {getTransactionTypeIcon(form.transactionType)}
                                        </div>
                                    </div>
                                    {errors.transactionType && (
                                        <p className="text-red-500 text-xs mt-1">{errors.transactionType}</p>
                                    )}
                                </div>

                                {/* Tax Type Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tax Type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.taxTypeId ?? ""}
                                            onChange={e => handleChange("taxTypeId", Number(e.target.value))}
                                            disabled={submitting}
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${errors.taxTypeId ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        >
                                            <option value="">Select tax type...</option>
                                            {taxTypes.map(t => (
                                                <option key={t.id} value={t.id}>
                                                    {t.taxName} ({(t.taxRate * 100).toFixed(1)}%)
                                                </option>
                                            ))}
                                        </select>
                                        <ReceiptPercentIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.taxTypeId && (
                                        <p className="text-red-500 text-xs mt-1">{errors.taxTypeId}</p>
                                    )}
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <CurrencyDollarIcon className="h-5 w-5 text-cyan-600" />
                                    Financial Details
                                </h4>

                                {/* Taxable Amount */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Taxable Amount <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            value={form.taxableAmount || ""}
                                            onChange={e => handleChange("taxableAmount", Number(e.target.value))}
                                            disabled={submitting}
                                            placeholder="0.00"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono ${errors.taxableAmount ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <CurrencyDollarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.taxableAmount && (
                                        <p className="text-red-500 text-xs mt-1">{errors.taxableAmount}</p>
                                    )}
                                </div>

                                {/* Reference Number */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reference Number <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={form.referenceNumber}
                                            onChange={e => handleChange("referenceNumber", e.target.value)}
                                            disabled={submitting}
                                            placeholder="e.g., INV-2024-001"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.referenceNumber ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <HashtagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.referenceNumber && (
                                        <p className="text-red-500 text-xs mt-1">{errors.referenceNumber}</p>
                                    )}
                                </div>

                                {/* Tax Rate Display */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-500">Selected Tax Rate</span>
                                        <span className="text-sm font-semibold text-cyan-600">
                                            {form.taxTypeId ? (
                                                taxTypes.find(t => t.id === form.taxTypeId)?.taxRate
                                                    ? `${(taxTypes.find(t => t.id === form.taxTypeId)!.taxRate * 100).toFixed(2)}%`
                                                    : '—'
                                            ) : '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">Calculated Tax</span>
                                        <span className="text-sm font-semibold text-green-600">
                                            ${form.taxableAmount && form.taxTypeId
                                                ? (form.taxableAmount * (taxTypes.find(t => t.id === form.taxTypeId)?.taxRate || 0)).toFixed(2)
                                                : '0.00'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description - Full Width */}
                        <div className="border-t border-gray-200 pt-6">
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                Description
                            </h4>
                            <div className="relative">
                                <textarea
                                    value={form.description}
                                    onChange={e => handleChange("description", e.target.value)}
                                    disabled={submitting}
                                    rows={4}
                                    className={`w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                        }`}
                                    placeholder="Enter description or audit notes..."
                                />
                                <DocumentTextIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => navigate("/taxRecords")}
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
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        {isEdit ? "Updating..." : "Saving..."}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircleIcon className="h-5 w-5" />
                                        {isEdit ? "Update Record" : "Create Record"}
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

export default TaxRecordFormPage;