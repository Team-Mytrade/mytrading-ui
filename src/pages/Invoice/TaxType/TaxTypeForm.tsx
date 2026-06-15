import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    ReceiptPercentIcon,
    GlobeAltIcon,
    DocumentTextIcon,
    HashtagIcon,
    CheckCircleIcon,
    PencilSquareIcon,
    PlusIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/tax-types";

export type Region = "INDIA" | "EU" | "USA" | "QATAR" | "UAE" | "CANADA" | "AUSTRALIA" | "UK" | "OTHER";

interface TaxTypeForm {
    taxName: string;
    taxRate: number;
    region: Region;
    isActive: boolean;
    description: string;
}

const emptyForm: TaxTypeForm = {
    taxName: "",
    taxRate: 0,
    region: "INDIA",
    isActive: true,
    description: "",
};

const TaxTypeFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<TaxTypeForm>(emptyForm);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof TaxTypeForm, string>>>({});

    useEffect(() => {
        const load = async () => {
            try {
                if (isEdit) {
                    const res = await axios.get(`${API_URL}/${id}`);
                    const d = res.data;
                    setForm({
                        taxName: d.taxName || "",
                        taxRate: d.taxRate || 0,
                        region: d.region || "INDIA",
                        isActive: d.isActive !== undefined ? d.isActive : true,
                        description: d.description || "",
                    });
                }
            } catch (err) {
                console.error("Error loading tax type form data:", err);
                ToasterService.error("Failed to load tax type");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isEdit]);

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof TaxTypeForm, string>> = {};
        if (!form.taxName.trim()) newErrors.taxName = "Tax name is required";
        if (form.taxRate === undefined || form.taxRate < 0) newErrors.taxRate = "Tax rate cannot be negative";
        if (!form.region) newErrors.region = "Region is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof TaxTypeForm>(key: K, value: TaxTypeForm[K]) => {
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
                await axios.put(`${API_URL}/${id}`, form);
                ToasterService.success("Tax type updated successfully");
            } else {
                await axios.post(`${API_URL}/create`, form);
                ToasterService.success("Tax type created successfully");
            }
            navigate("/taxTypes");
        } catch (err: any) {
            console.error("Save error:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save tax type");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading && isEdit) {
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
                title={isEdit ? "Edit Tax Type" : "Add Tax Type"}
                description="Configure tax rates and regional compliance"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Tax Type" : "Add Tax Type"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/taxTypes")}
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
                                    Edit Tax Type
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="h-6 w-6" />
                                    Add New Tax Type
                                </>
                            )}
                        </h3>
                        <p className="text-cyan-100 text-sm mt-1">
                            {isEdit ? "Update tax rate and compliance settings" : "Create a new tax definition"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <ReceiptPercentIcon className="h-5 w-5 text-cyan-600" />
                                    Tax Information
                                </h4>

                                {/* Tax Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tax Name <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={form.taxName}
                                            onChange={e => handleChange("taxName", e.target.value)}
                                            disabled={submitting}
                                            placeholder="e.g., VAT 18%, GST, Sales Tax"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all ${errors.taxName ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <HashtagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.taxName && (
                                        <p className="text-red-500 text-xs mt-1">{errors.taxName}</p>
                                    )}
                                </div>

                                {/* Region */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Region <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.region}
                                            onChange={e => handleChange("region", e.target.value as Region)}
                                            disabled={submitting}
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${errors.region ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        >
                                            {["INDIA", "USA", "UAE", "QATAR", "EU", "UK", "CANADA", "AUSTRALIA", "OTHER"].map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                        <GlobeAltIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    {errors.region && (
                                        <p className="text-red-500 text-xs mt-1">{errors.region}</p>
                                    )}
                                </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                    Rate & Status
                                </h4>

                                {/* Tax Rate */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tax Rate (%) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={form.taxRate * 100}
                                            onChange={e => handleChange("taxRate", Number(e.target.value) / 100)}
                                            disabled={submitting}
                                            placeholder="0.00"
                                            className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono ${errors.taxRate ? "border-red-300" : "border-gray-300"
                                                } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                        />
                                        <span className="absolute left-3 top-2.5 text-gray-400 font-medium">%</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Stored as decimal: {form.taxRate.toFixed(4)}
                                    </p>
                                    {errors.taxRate && (
                                        <p className="text-red-500 text-xs mt-1">{errors.taxRate}</p>
                                    )}
                                </div>

                                {/* Status Toggle */}
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">Active Status</p>
                                            <p className="text-xs text-gray-500">
                                                If inactive, this tax type cannot be applied to records
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => !submitting && handleChange("isActive", !form.isActive)}
                                            disabled={submitting}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${form.isActive ? "bg-green-600" : "bg-gray-300"
                                                } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? "translate-x-6" : "translate-x-1"
                                                    }`}
                                            />
                                        </button>
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
                                    placeholder="Enter tax law references or internal usage notes..."
                                />
                                <DocumentTextIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => navigate("/taxTypes")}
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
                                        {isEdit ? "Update Tax Type" : "Create Tax Type"}
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

export default TaxTypeFormPage;