import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    CheckIcon,
    BuildingOfficeIcon,
    CurrencyDollarIcon,
    TagIcon,
    DocumentTextIcon,
    IdentificationIcon,
    PencilSquareIcon,
    PlusIcon,
    XMarkIcon,
    InformationCircleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/general-accounts";

export enum AccountType {
    ASSET = "ASSET",
    LIABILITY = "LIABILITY",
    EQUITY = "EQUITY",
    INCOME = "INCOME",
    EXPENSE = "EXPENSE",
}

export enum Currency {
    USD = "USD",
    EUR = "EUR",
    GBP = "GBP",
    JPY = "JPY",
    AUD = "AUD",
    CAD = "CAD",
    CHF = "CHF",
    CNY = "CNY",
    SEK = "SEK",
    NZD = "NZD",
    INR = "INR",
    BRL = "BRL",
    ZAR = "ZAR",
    MXN = "MXN",
    RUB = "RUB",
    KRW = "KRW",
    SGD = "SGD",
    NOK = "NOK",
    TRY = "TRY",
    DKK = "DKK",
    PLN = "PLN"
}

interface GeneralAccount {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    isActive: boolean;
    description?: string;
    currency?: Currency;
    openingBalance: number;
    allowTransactions: boolean;
    tags?: string[];
}

interface GeneralAccountForm {
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    isActive: boolean;
    description: string;
    currency: Currency;
    openingBalance: number;
    allowTransactions: boolean;
    tags: string[];
}

// Payload interface with correct structure
interface GeneralAccountPayload {
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    isActive: boolean;
    description?: string;
    currency?: Currency;
    openingBalance: number;
    allowTransactions: boolean;
    tags?: string[];
}

const emptyForm: GeneralAccountForm = {
    accountCode: "",
    accountName: "",
    accountType: AccountType.ASSET,
    isActive: true,
    description: "",
    currency: Currency.USD,
    openingBalance: 0,
    allowTransactions: true,
    tags: [],
};

// Helper function to get numbering pattern based on account type (for display only)
const getNumberingPattern = (accountType: AccountType): { min: number; max: number; description: string } => {
    switch (accountType) {
        case AccountType.ASSET:
            return { min: 1000, max: 1999, description: "Assets (1000-1999)" };
        case AccountType.LIABILITY:
            return { min: 2000, max: 2999, description: "Liabilities (2000-2999)" };
        case AccountType.EQUITY:
            return { min: 3000, max: 3999, description: "Equity (3000-3999)" };
        case AccountType.INCOME:
            return { min: 4000, max: 4999, description: "Income/Revenue (4000-4999)" };
        case AccountType.EXPENSE:
            return { min: 5000, max: 5999, description: "Expenses (5000-5999)" };
        default:
            return { min: 0, max: 9999, description: "Custom range" };
    }
};

// Function to fetch accounts by type and generate next account code (max account code + 1)
const fetchAndGenerateNextAccountCode = async (accountType: AccountType): Promise<string> => {
    try {
        const response = await axios.get(`${API_URL}/accoutType/${accountType}`);
        const accounts = response.data;

        console.log(`Fetched accounts for ${accountType}:`, accounts); // Debug log

        if (!accounts || accounts.length === 0) {
            // If no accounts exist for this type, return the minimum code for that type
            const pattern = getNumberingPattern(accountType);
            console.log(`No existing accounts, using minimum code: ${pattern.min}`); // Debug log
            return pattern.min.toString();
        }

        // Extract all account codes, convert to numbers
        const accountCodes = accounts
            .map((acc: any) => {
                const code = parseInt(acc.accountCode, 10);
                return isNaN(code) ? null : code;
            })
            .filter((code: number | null) => code !== null);

        console.log(`Account codes found:`, accountCodes); // Debug log

        if (accountCodes.length === 0) {
            const pattern = getNumberingPattern(accountType);
            console.log(`No valid numeric codes, using minimum code: ${pattern.min}`); // Debug log
            return pattern.min.toString();
        }

        // Find the maximum code
        const maxCode = Math.max(...accountCodes);
        console.log(`Maximum code found: ${maxCode}`); // Debug log

        // Add +1 to get the next code
        const nextCode = maxCode + 1;
        console.log(`Next code (max + 1): ${nextCode}`); // Debug log

        // Validate that the next code is within the allowed range for the account type
        const pattern = getNumberingPattern(accountType);
        if (nextCode > pattern.max) {
            throw new Error(`Maximum account code limit (${pattern.max}) reached for ${accountType} accounts`);
        }

        return nextCode.toString();
    } catch (error) {
        console.error("Error fetching accounts by type:", error);
        throw error;
    }
};

const GeneralLedgerForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isEdit = !!id;

    const [form, setForm] = useState<GeneralAccountForm>(emptyForm);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof GeneralAccountForm, string>>>({});
    const [tagInput, setTagInput] = useState("");
    const [generatingCode, setGeneratingCode] = useState(false);
    const [generatedCodes, setGeneratedCodes] = useState<Map<string, string>>(new Map()); // Cache generated codes per account type

    useEffect(() => {
        const load = async () => {
            try {
                if (isEdit) {
                    const res = await axios.get(`${API_URL}/id/${id}`);
                    const d = res.data;
                    setForm({
                        accountCode: d.accountCode || "",
                        accountName: d.accountName || "",
                        accountType: d.accountType || AccountType.ASSET,
                        isActive: d.isActive !== undefined ? d.isActive : true,
                        description: d.description || "",
                        currency: d.currency || Currency.USD,
                        openingBalance: d.openingBalance || 0,
                        allowTransactions: d.allowTransactions !== undefined ? d.allowTransactions : true,
                        tags: d.tags || [],
                    });
                }
            } catch (err) {
                console.error("Error loading ledger form data:", err);
                ToasterService.error("Failed to load data");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isEdit]);

    // Auto-generate account code when account type changes (only for new accounts)
    useEffect(() => {
        if (!isEdit && form.accountType) {
            const generateCode = async () => {
                // Check if we already generated a code for this account type
                if (generatedCodes.has(form.accountType)) {
                    const cachedCode = generatedCodes.get(form.accountType);
                    console.log(`Using cached code for ${form.accountType}: ${cachedCode}`);
                    setForm(prev => ({ ...prev, accountCode: cachedCode || "" }));
                    return;
                }

                setGeneratingCode(true);
                try {
                    const nextCode = await fetchAndGenerateNextAccountCode(form.accountType);
                    console.log(`Generated code for ${form.accountType}: ${nextCode}`);

                    // Cache the generated code for this account type
                    setGeneratedCodes(prev => new Map(prev).set(form.accountType, nextCode));
                    setForm(prev => ({ ...prev, accountCode: nextCode }));

                    // Clear any account code errors
                    if (errors.accountCode) {
                        setErrors(prev => ({ ...prev, accountCode: undefined }));
                    }
                } catch (error: any) {
                    console.error("Failed to generate account code:", error);
                    ToasterService.error(error.message || "Failed to generate account code");
                } finally {
                    setGeneratingCode(false);
                }
            };

            generateCode();
        }
    }, [form.accountType, isEdit, generatedCodes]);

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof GeneralAccountForm, string>> = {};

        if (!form.accountCode.trim()) {
            newErrors.accountCode = "Account code is required";
        } else if (!/^\d+$/.test(form.accountCode)) {
            newErrors.accountCode = "Account code must contain only numbers";
        }

        if (!form.accountName.trim()) newErrors.accountName = "Account name is required";
        if (!form.accountType) newErrors.accountType = "Account type is required";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = <K extends keyof GeneralAccountForm>(key: K, value: GeneralAccountForm[K]) => {
        if (submitting) return;
        setForm(prev => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    const addTag = () => {
        if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
            handleChange("tags", [...form.tags, tagInput.trim()]);
            setTagInput("");
        }
    };

    const removeTag = (tagToRemove: string) => {
        handleChange("tags", form.tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            const payload: GeneralAccountPayload = {
                accountCode: form.accountCode,
                accountName: form.accountName,
                accountType: form.accountType,
                isActive: form.isActive,
                description: form.description || undefined,
                currency: form.currency,
                openingBalance: form.openingBalance,
                allowTransactions: form.allowTransactions,
                tags: form.tags.length > 0 ? form.tags : undefined,
            };

            console.log("Submitting payload:", payload); // Debug log

            if (isEdit) {
                await axios.put(`${API_URL}/${id}`, payload);
                ToasterService.success("Account updated successfully");
            } else {
                await axios.post(API_URL, payload);
                ToasterService.success("Account created successfully");

                // Clear the cache for this account type after successful creation
                // so that next time we generate a new code
                setGeneratedCodes(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(form.accountType);
                    return newMap;
                });

                // Reset form to allow creating another account
                // But keep the account type to generate next code
                setForm({
                    ...emptyForm,
                    accountType: form.accountType, // Keep the same account type to generate next code
                });

                // The useEffect will trigger to generate the next code
            }
            navigate("/generalLedger");
        } catch (err: any) {
            console.error("Save error:", err);
            ToasterService.error(err.response?.data?.message || "Failed to save account");
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

    const currentPattern = getNumberingPattern(form.accountType);

    return (
        <>
            <PageMeta
                title={isEdit ? "Edit Account" : "Add Account"}
                description="Manage general ledger account details"
            />
            <PageBreadcrumb pageTitle={isEdit ? "Edit Account" : "Add Account"} />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/generalLedger")}
                        disabled={submitting}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 p-6">
                        <h3 className="text-xl font-semibold flex items-center gap-2 !text-white">
                            {isEdit ? (
                                <>
                                    <PencilSquareIcon className="h-6 w-6" />
                                    Edit Account
                                </>
                            ) : (
                                <>
                                    <PlusIcon className="h-6 w-6" />
                                    Add New Account
                                </>
                            )}
                        </h3>
                        <p className="text-cyan-100 text-sm mt-1">
                            {isEdit ? "Update account configuration" : "Create a new ledger account"}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Account Identity */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <IdentificationIcon className="h-5 w-5 text-cyan-600" />
                                    Account Identity
                                </h4>

                                <div className="space-y-4">
                                    {/* Account Code - Read-only display for new accounts */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Account Code <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            {!isEdit && generatingCode ? (
                                                <div className="w-full p-2 pl-10 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
                                                    <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                                    <span className="text-gray-500">Generating code...</span>
                                                </div>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={form.accountCode}
                                                    onChange={e => handleChange("accountCode", e.target.value)}
                                                    disabled={submitting || (!isEdit)}
                                                    className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all 
                                                        ${errors.accountCode ? "border-red-300" : "border-gray-300"}
                                                        ${(submitting || (!isEdit)) ? "bg-gray-100 cursor-not-allowed" : ""}
                                                        ${!isEdit ? "bg-gray-50" : ""}`}
                                                    placeholder={!isEdit ? "Auto-generated based on account type" : "Account code"}
                                                    readOnly={!isEdit}
                                                />
                                            )}
                                            <IdentificationIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        </div>
                                        {errors.accountCode && (
                                            <p className="text-red-500 text-xs mt-1">{errors.accountCode}</p>
                                        )}
                                        {!isEdit && (
                                            <div className="mt-1 flex items-start gap-1">
                                                <InformationCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-gray-600">
                                                    Account code is automatically generated as (max existing code + 1) for the selected account type.
                                                    {form.accountType && ` ${form.accountType} accounts are typically numbered between ${currentPattern.min}-${currentPattern.max}.`}
                                                    {form.accountCode && ` Current code: ${form.accountCode} (max existing + 1)`}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Account Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Account Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={form.accountName}
                                                onChange={e => handleChange("accountName", e.target.value)}
                                                disabled={submitting}
                                                className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.accountName ? "border-red-300" : "border-gray-300"
                                                    } ${submitting ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                                placeholder={`e.g., ${form.accountType === AccountType.ASSET ? "Cash, Accounts Receivable" :
                                                    form.accountType === AccountType.LIABILITY ? "Accounts Payable, Loans Payable" :
                                                        form.accountType === AccountType.EQUITY ? "Common Stock, Retained Earnings" :
                                                            form.accountType === AccountType.INCOME ? "Sales Revenue, Service Revenue" :
                                                                "Office Supplies, Utilities Expense"}`}
                                            />
                                            <BuildingOfficeIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        </div>
                                        {errors.accountName && (
                                            <p className="text-red-500 text-xs mt-1">{errors.accountName}</p>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={form.description}
                                                onChange={e => handleChange("description", e.target.value)}
                                                disabled={submitting}
                                                rows={3}
                                                className={`w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                                    }`}
                                                placeholder={`Enter description for this ${form.accountType.toLowerCase()} account...`}
                                            />
                                            <DocumentTextIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Classification */}
                            <div className="space-y-6">
                                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 border-b pb-2">
                                    <TagIcon className="h-5 w-5 text-cyan-600" />
                                    Classification
                                </h4>

                                <div className="space-y-4">
                                    {/* Account Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Account Type <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={form.accountType}
                                                onChange={e => handleChange("accountType", e.target.value as AccountType)}
                                                disabled={submitting || isEdit}
                                                className={`w-full p-2 pl-10 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none 
                                                    ${errors.accountType ? "border-red-300" : "border-gray-300"}
                                                    ${(submitting || isEdit) ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                            >
                                                {Object.values(AccountType).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <TagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        </div>
                                        {errors.accountType && (
                                            <p className="text-red-500 text-xs mt-1">{errors.accountType}</p>
                                        )}
                                        {isEdit && (
                                            <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                                                <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                                Account type cannot be changed after creation
                                            </p>
                                        )}
                                        <div className="mt-1 flex items-start gap-1">
                                            <InformationCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-gray-600">
                                                {form.accountType === AccountType.ASSET && "Assets are resources owned by the company (Cash, Inventory, Equipment)"}
                                                {form.accountType === AccountType.LIABILITY && "Liabilities are obligations owed to others (Loans, Accounts Payable)"}
                                                {form.accountType === AccountType.EQUITY && "Equity represents owner's interest in the company (Stock, Retained Earnings)"}
                                                {form.accountType === AccountType.INCOME && "Income accounts track revenue generated from business operations"}
                                                {form.accountType === AccountType.EXPENSE && "Expense accounts track costs incurred in generating revenue"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Currency */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Currency
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={form.currency}
                                                onChange={e => handleChange("currency", e.target.value as Currency)}
                                                disabled={submitting}
                                                className={`w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                                    }`}
                                            >
                                                {Object.values(Currency).map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            <CurrencyDollarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Tags
                                        </label>
                                        <div className="relative">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={tagInput}
                                                    onChange={e => setTagInput(e.target.value)}
                                                    onKeyPress={handleKeyPress}
                                                    disabled={submitting}
                                                    className="flex-1 p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                                    placeholder="Add tags (press Enter)"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addTag}
                                                    disabled={submitting || !tagInput.trim()}
                                                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                            <TagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        </div>

                                        {/* Tags Display */}
                                        {form.tags.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {form.tags.map((tag, index) => (
                                                    <span
                                                        key={index}
                                                        className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 rounded-md text-sm"
                                                    >
                                                        <TagIcon className="h-3 w-3" />
                                                        {tag}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeTag(tag)}
                                                            disabled={submitting}
                                                            className="hover:text-cyan-900 focus:outline-none"
                                                        >
                                                            <XMarkIcon className="h-3 w-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500 mt-1">
                                            Add tags to categorize and filter accounts (e.g., "current", "non-current", "operating")
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                <CurrencyDollarIcon className="h-5 w-5 text-cyan-600" />
                                Financial Settings
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Opening Balance */}
                                <div className="bg-gray-50 rounded-lg p-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Opening Balance
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.openingBalance}
                                            onChange={e => handleChange("openingBalance", Number(e.target.value))}
                                            disabled={submitting}
                                            className={`w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono ${submitting ? "bg-gray-100 cursor-not-allowed" : ""
                                                }`}
                                        />
                                        <CurrencyDollarIcon className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Initial balance for this account
                                    </p>
                                </div>

                                {/* Status Toggles */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">Account Status</p>
                                            <p className="text-xs text-gray-500">Active or inactive</p>
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

                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="font-medium text-gray-900">Allow Transactions</p>
                                            <p className="text-xs text-gray-500">Enable/disable transactions</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => !submitting && handleChange("allowTransactions", !form.allowTransactions)}
                                            disabled={submitting}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${form.allowTransactions ? "bg-cyan-600" : "bg-gray-300"
                                                } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.allowTransactions ? "translate-x-6" : "translate-x-1"
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => navigate("/generalLedger")}
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
                                        <CheckIcon className="h-5 w-5" />
                                        {isEdit ? "Update Account" : "Create Account"}
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

export default GeneralLedgerForm;