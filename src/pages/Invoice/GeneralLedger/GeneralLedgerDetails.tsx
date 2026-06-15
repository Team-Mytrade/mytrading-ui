import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    PrinterIcon,
    TagIcon,
    CurrencyDollarIcon,
    IdentificationIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
    CalendarIcon,
    CheckCircleIcon,
    XCircleIcon,
    BuildingOfficeIcon,
    HashtagIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/general-accounts";

interface GeneralAccount {
    id: number;
    accountCode: string;
    accountName: string;
    accountType: string;
    isActive: boolean;
    description?: string;
    currency?: string;
    openingBalance: number;
    parentAccount?: { id: number; accountName: string; accountCode: string } | null;
    childAccounts?: { id: number; accountName: string; accountCode: string }[];
    allowTransactions: boolean;
    tags?: string[];
    createdAt?: string;
    updatedAt?: string;
    ledgerEntries?: any[];
}

const GeneralLedgerDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [account, setAccount] = useState<GeneralAccount | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await axios.get(`${API_URL}/${id}`);
                setAccount(res.data);
            } catch (err) {
                console.error("Error loading account details:", err);
                ToasterService.error("Failed to load details");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case "ASSET": return "bg-blue-100 text-blue-800";
            case "LIABILITY": return "bg-yellow-100 text-yellow-800";
            case "EQUITY": return "bg-purple-100 text-purple-800";
            case "INCOME": return "bg-green-100 text-green-800";
            case "EXPENSE": return "bg-red-100 text-red-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "ASSET": return <CurrencyDollarIcon className="h-4 w-4 text-blue-500" />;
            case "LIABILITY": return <TagIcon className="h-4 w-4 text-yellow-500" />;
            case "EQUITY": return <BuildingOfficeIcon className="h-4 w-4 text-purple-500" />;
            case "INCOME": return <DocumentTextIcon className="h-4 w-4 text-green-500" />;
            case "EXPENSE": return <CurrencyDollarIcon className="h-4 w-4 text-red-500" />;
            default: return <TagIcon className="h-4 w-4 text-gray-500" />;
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

    if (!account) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500 font-medium">Account not found</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageMeta title={`Account Details — ${account.accountName}`} description="View general ledger account details" />
            <PageBreadcrumb pageTitle="Account Details" />

            {/* Print Version - Hidden on screen, visible when printing */}
            <div className="hidden print:block">
                <div className="max-w-4xl mx-auto p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold mb-2">General Ledger Account Details</h1>
                        <p className="text-gray-600">Financial Record Statement</p>
                    </div>

                    <div className="mb-6">
                        <h2 className="text-lg font-semibold border-b pb-2 mb-4">Account Information</h2>
                        <table className="w-full border-collapse">
                            <tbody>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold w-1/3">Account Code:</td>
                                    <td className="py-2">{account.accountCode}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold">Account Name:</td>
                                    <td className="py-2">{account.accountName}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold">Account Type:</td>
                                    <td className="py-2">{account.accountType}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold">Status:</td>
                                    <td className="py-2">{account.isActive ? "Active" : "Inactive"}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold">Currency:</td>
                                    <td className="py-2">{account.currency || "USD"}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold">Opening Balance:</td>
                                    <td className="py-2">{account.currency || "USD"} {account.openingBalance.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="py-2 font-semibold">Allow Transactions:</td>
                                    <td className="py-2">{account.allowTransactions ? "Yes" : "No"}</td>
                                </tr>
                                {account.parentAccount && (
                                    <tr className="border-b">
                                        <td className="py-2 font-semibold">Parent Account:</td>
                                        <td className="py-2">{account.parentAccount.accountCode} - {account.parentAccount.accountName}</td>
                                    </tr>
                                )}
                                {account.tags && account.tags.length > 0 && (
                                    <tr className="border-b">
                                        <td className="py-2 font-semibold">Tags:</td>
                                        <td className="py-2">{account.tags.join(", ")}</td>
                                    </tr>
                                )}
                                {account.description && (
                                    <tr className="border-b">
                                        <td className="py-2 font-semibold align-top">Description:</td>
                                        <td className="py-2">{account.description}</td>
                                    </tr>
                                )}
                                {account.createdAt && (
                                    <tr>
                                        <td className="py-2 font-semibold">Created Date:</td>
                                        <td className="py-2">{new Date(account.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {account.childAccounts && account.childAccounts.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Child Accounts</h2>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2">Account Code</th>
                                        <th className="text-left py-2">Account Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {account.childAccounts.map(child => (
                                        <tr key={child.id} className="border-b">
                                            <td className="py-2">{child.accountCode}</td>
                                            <td className="py-2">{child.accountName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                        <p>Confidential Financial Record — General Ledger Statement</p>
                        <p>Printed on {new Date().toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Screen Version - Visible on screen, hidden when printing */}
            <div className="print:hidden">
                <div className="max-w-7xl mx-auto p-6">
                    {/* Header with Actions */}
                    <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <button
                            onClick={() => navigate("/generalLedger")}
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
                                <span className="hidden sm:inline">Print Summary</span>
                            </button>
                            <button
                                onClick={() => navigate(`/generalLedger/edit/${account.id}`)}
                                className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                                <span className="hidden sm:inline">Edit Account</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Status Bar */}
                        <div className={`h-2 ${account.isActive ? 'bg-cyan-500' : 'bg-gray-400'}`} />

                        <div className="p-8">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-8 border-b border-gray-200">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Account Code</p>
                                        <h2 className="text-3xl font-bold text-gray-900 font-mono">{account.accountCode}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(account.accountType)}`}>
                                            {getTypeIcon(account.accountType)}
                                            <span className="ml-1">{account.accountType}</span>
                                        </span>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {account.isActive ? (
                                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                            ) : (
                                                <XCircleIcon className="h-3 w-3 mr-1" />
                                            )}
                                            {account.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-left md:text-right space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Account Name</p>
                                        <p className="text-2xl font-semibold text-gray-900">{account.accountName}</p>
                                    </div>
                                    {account.createdAt && (
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Created</p>
                                            <p className="text-sm text-gray-600 flex items-center md:justify-end gap-1.5">
                                                <CalendarIcon className="h-4 w-4" />
                                                {new Date(account.createdAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                {/* Left Column - Structure Info */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <ShieldCheckIcon className="h-5 w-5 text-cyan-600" />
                                        Structure Information
                                    </h3>

                                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                                        {/* Parent Account */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg">
                                                <BuildingOfficeIcon className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Parent Account</p>
                                                {account.parentAccount ? (
                                                    <>
                                                        <p className="text-sm font-medium text-gray-900">{account.parentAccount.accountName}</p>
                                                        <p className="text-xs text-gray-500">Code: {account.parentAccount.accountCode}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm font-medium text-cyan-600">Root Level (Main Account)</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Child Accounts */}
                                        {account.childAccounts && account.childAccounts.length > 0 && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-white rounded-lg">
                                                    <HashtagIcon className="h-5 w-5 text-gray-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Child Accounts</p>
                                                    <div className="mt-1 space-y-1">
                                                        {account.childAccounts.map(child => (
                                                            <div key={child.id} className="text-sm">
                                                                <span className="font-mono text-gray-600">{child.accountCode}</span>
                                                                <span className="mx-2 text-gray-400">—</span>
                                                                <span className="text-gray-700">{child.accountName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Transaction Capability */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg">
                                                <IdentificationIcon className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Transaction Capability</p>
                                                <p className={`text-sm font-medium ${account.allowTransactions ? 'text-green-600' : 'text-orange-600'}`}>
                                                    {account.allowTransactions ? "ALLOWED" : "RESTRICTED"}
                                                </p>
                                                {!account.allowTransactions && (
                                                    <p className="text-xs text-gray-500">This account cannot be used in transactions</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Currency */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg">
                                                <CurrencyDollarIcon className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Currency</p>
                                                <p className="text-sm font-medium text-gray-900">{account.currency || 'USD'}</p>
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        {account.tags && account.tags.length > 0 && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-white rounded-lg">
                                                    <TagIcon className="h-5 w-5 text-gray-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tags</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {account.tags.map((tag, index) => (
                                                            <span
                                                                key={index}
                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 rounded-md text-xs"
                                                            >
                                                                <TagIcon className="h-3 w-3" />
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column - Financial Overview */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <CurrencyDollarIcon className="h-5 w-5 text-cyan-600" />
                                        Financial Overview
                                    </h3>

                                    <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-8 text-white shadow-lg">
                                        <div className="relative">
                                            <p className="text-cyan-100 text-xs font-medium uppercase tracking-wider mb-2">Opening Balance</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-light text-cyan-100">{account.currency || "USD"}</span>
                                                <span className="text-4xl font-bold tracking-tight">
                                                    {account.openingBalance.toFixed(2)}
                                                </span>
                                            </div>
                                            <CurrencyDollarIcon className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10" />
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 mb-1">Account Type</p>
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(account.accountType)}`}>
                                                {getTypeIcon(account.accountType)}
                                                <span className="ml-1">{account.accountType}</span>
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 mb-1">Transactions</p>
                                            <p className={`text-lg font-semibold ${account.allowTransactions ? 'text-green-600' : 'text-orange-600'}`}>
                                                {account.allowTransactions ? 'Allowed' : 'Restricted'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Ledger Entries Count */}
                                    {account.ledgerEntries && (
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 mb-1">Ledger Entries</p>
                                            <p className="text-2xl font-semibold text-gray-900">{account.ledgerEntries.length}</p>
                                            <p className="text-xs text-gray-500 mt-1">Total transactions linked to this account</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description Section */}
                            {account.description && (
                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Description
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-4 flex gap-3">
                                        <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-gray-700 leading-relaxed">{account.description}</p>
                                    </div>
                                </div>
                            )}

                            {/* Metadata Footer */}
                            <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                                {account.updatedAt && (
                                    <span>Last updated: {new Date(account.updatedAt).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default GeneralLedgerDetails;