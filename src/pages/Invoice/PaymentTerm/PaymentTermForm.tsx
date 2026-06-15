import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    TagIcon,
    DocumentTextIcon,
    ClockIcon,
    PencilSquareIcon,
    PlusIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_PAYMENT_TERMS = "/v1/api/invoice/payment-terms";

interface PaymentTerm {
    id?: number;
    termCode: string;
    description: string;
    dueDays: number;
}

const emptyTerm: PaymentTerm = {
    termCode: "",
    description: "",
    dueDays: 0,
};

const PaymentTermForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<PaymentTerm>(emptyTerm);
    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof PaymentTerm, string>>>({});

    useEffect(() => {
        if (isEdit) {
            const fetch = async () => {
                try {
                    const res = await axios.get(`${API_PAYMENT_TERMS}/${id}`);
                    setForm(res.data);
                } catch (err) {
                    console.error("Error fetching term:", err);
                    ToasterService.error("Failed to load term details");
                } finally {
                    setLoading(false);
                }
            };
            fetch();
        }
    }, [id, isEdit]);

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof PaymentTerm, string>> = {};
        if (!form.termCode.trim()) newErrors.termCode = "Term code is required";
        if (!form.description.trim()) newErrors.description = "Description is required";
        if (form.dueDays <= 0) newErrors.dueDays = "Due days must be greater than 0";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (key: keyof PaymentTerm, value: any) => {
        if (submitting) return;
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            if (isEdit) {
                await axios.put(`${API_PAYMENT_TERMS}/${id}`, form);
                ToasterService.success("Payment term updated successfully");
            } else {
                await axios.post(API_PAYMENT_TERMS, form);
                ToasterService.success("Payment term created successfully");
            }
            navigate("/payment-terms");
        } catch (err: any) {
            console.error("Save error:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save payment term");
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
                title={isEdit ? "Edit Payment Term" : "Add Payment Term"}
                description="Manage payment terms"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Payment Term" : "Add Payment Term"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/payment-terms")}
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
                                    Edit Payment Term
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="h-6 w-6" />
                                    Add New Payment Term
                                </>
                            )}
                        </h3>
                        <p className="text-cyan-100 text-sm mt-1">
                            {isEdit ? "Update payment term details" : "Create a new payment term"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <TagIcon className="h-5 w-5 text-cyan-600" />
                                    Term Information
                                </h4>

                                {/* Term Code */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Term Code <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={form.termCode}
                                            onChange={e => handleChange("termCode", e.target.value.toUpperCase())}
                                            disabled={submitting}
                                            placeholder="e.g., NET30, NET15"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all ${errors.termCode ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <TagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.termCode && (
                                        <p className="text-red-500 text-xs mt-1">{errors.termCode}</p>
                                    )}
                                </div>

                                {/* Due Days */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Due Days <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="1"
                                            value={form.dueDays || ""}
                                            onChange={e => handleChange("dueDays", Number(e.target.value))}
                                            disabled={submitting}
                                            placeholder="30"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.dueDays ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <ClockIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.dueDays && (
                                        <p className="text-red-500 text-xs mt-1">{errors.dueDays}</p>
                                    )}
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                    Description
                                </h4>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={form.description}
                                            onChange={e => handleChange("description", e.target.value)}
                                            disabled={submitting}
                                            rows={6}
                                            placeholder="Enter payment term description..."
                                            className={`w-full p-3 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.description ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <DocumentTextIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.description && (
                                        <p className="text-red-500 text-xs mt-1">{errors.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Preview Card */}
                        {form.termCode && form.dueDays > 0 && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <TagIcon className="h-4 w-4 text-cyan-600" />
                                    Term Preview
                                </h4>
                                <div className="flex items-center gap-4">
                                    <div className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full text-xs font-medium">
                                        {form.termCode}
                                    </div>
                                    <div className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                                        {form.dueDays} days
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Form Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => navigate("/payment-terms")}
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
                                        {isEdit ? "Update Term" : "Create Term"}
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

export default PaymentTermForm;