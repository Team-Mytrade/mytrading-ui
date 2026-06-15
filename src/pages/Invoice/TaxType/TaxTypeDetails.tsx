import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    PrinterIcon,
    GlobeAltIcon,
    ReceiptPercentIcon,
    DocumentTextIcon,
    CalendarIcon,
    CheckCircleIcon,
    XCircleIcon,
    TagIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const API_URL = "/v1/api/invoice/tax-types";

interface TaxType {
    id: number;
    taxName: string;
    taxRate: number;
    region: string;
    isActive: boolean;
    description?: string;
}

const getRegionColor = (region: string) => {
    switch (region) {
        case "INDIA": return "bg-orange-100 text-orange-800";
        case "USA": return "bg-blue-100 text-blue-800";
        case "UAE": return "bg-green-100 text-green-800";
        case "QATAR": return "bg-purple-100 text-purple-800";
        case "EU": return "bg-yellow-100 text-yellow-800";
        case "UK": return "bg-red-100 text-red-800";
        case "CANADA": return "bg-indigo-100 text-indigo-800";
        case "AUSTRALIA": return "bg-pink-100 text-pink-800";
        default: return "bg-gray-100 text-gray-800";
    }
};

const getRegionIcon = (region: string) => {
    return <GlobeAltIcon className="h-4 w-4" />;
};

const TaxTypeDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tax, setTax] = useState<TaxType | null>(null);
    const [loading, setLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await axios.get(`${API_URL}/${id}`);
                setTax(res.data);
            } catch (err) {
                console.error("Error loading tax details:", err);
                ToasterService.error("Failed to load details");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    const handlePrint = () => {
        if (!printRef.current || !tax) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            ToasterService.error("Please allow pop-ups to print");
            return;
        }

        const printContent = printRef.current.innerHTML;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Tax Type Details - ${tax.taxName}</title>
                <style>
                    body {
                        font-family: 'Nunito', sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 1000px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .print-header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #0e7490;
                    }
                    .print-header h1 {
                        color: #0e7490;
                        margin: 0;
                        font-size: 24px;
                    }
                    .print-header p {
                        color: #666;
                        margin: 5px 0 0;
                        font-size: 14px;
                    }
                    .status-bar {
                        height: 4px;
                        background: ${tax.isActive ? '#10b981' : '#9ca3af'};
                        margin-bottom: 20px;
                    }
                    .section {
                        margin-bottom: 30px;
                        padding: 20px;
                        background: #f9fafb;
                        border-radius: 8px;
                        border: 1px solid #e5e7eb;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #0e7490;
                        margin: 0 0 15px 0;
                        padding-bottom: 10px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                    }
                    .info-item {
                        margin-bottom: 15px;
                    }
                    .info-label {
                        font-size: 12px;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 4px;
                    }
                    .info-value {
                        font-size: 16px;
                        font-weight: 500;
                        color: #111827;
                    }
                    .badge {
                        display: inline-flex;
                        align-items: center;
                        padding: 4px 12px;
                        border-radius: 9999px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .badge-active {
                        background: #d1fae5;
                        color: #065f46;
                    }
                    .badge-inactive {
                        background: #f3f4f6;
                        color: #4b5563;
                    }
                    .rate-card {
                        background: linear-gradient(135deg, #0e7490 0%, #0c4a6e 100%);
                        color: white;
                        padding: 24px;
                        border-radius: 12px;
                        text-align: center;
                    }
                    .rate-label {
                        font-size: 14px;
                        opacity: 0.8;
                        margin-bottom: 8px;
                    }
                    .rate-value {
                        font-size: 48px;
                        font-weight: bold;
                        line-height: 1;
                    }
                    .rate-percent {
                        font-size: 24px;
                        opacity: 0.8;
                        margin-left: 4px;
                    }
                    .print-footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        text-align: center;
                        font-size: 12px;
                        color: #9ca3af;
                    }
                    @media print {
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>Tax Type Details</h1>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="status-bar"></div>

                ${printContent}
                
                <div class="print-footer">
                    Confidential Tax Record — Compliance Document<br>
                    Printed on ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
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

    if (!tax) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500 font-medium">Tax type not found</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <PageMeta title={`Tax Type — ${tax.taxName}`} description="View tax type details" />
            <PageBreadcrumb pageTitle="Tax Type Details" />

            <div className="max-w-7xl mx-auto p-6">
                {/* Header with Actions */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button
                        onClick={() => navigate("/taxTypes")}
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
                            <span className="hidden sm:inline">Print Details</span>
                        </button>
                        <button
                            onClick={() => navigate(`/taxTypes/edit/${tax.id}`)}
                            className="px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                            <span className="hidden sm:inline">Edit Tax Type</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Card - This is what will be printed */}
                <div ref={printRef}>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Status Bar */}
                        <div className={`h-2 ${tax.isActive ? 'bg-cyan-500' : 'bg-gray-400'}`} />

                        <div className="p-8">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8 pb-8 border-b border-gray-200">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Tax Name</p>
                                        <h2 className="text-3xl font-bold text-gray-900">{tax.taxName}</h2>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRegionColor(tax.region)}`}>
                                            {getRegionIcon(tax.region)}
                                            <span className="ml-1">{tax.region}</span>
                                        </span>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${tax.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {tax.isActive ? (
                                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                            ) : (
                                                <XCircleIcon className="h-3 w-3 mr-1" />
                                            )}
                                            {tax.isActive ? "Active" : "Inactive"}
                                        </span>
                                    </div>
                                </div>


                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                                {/* Left Column - Tax Information */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <TagIcon className="h-5 w-5 text-cyan-600" />
                                        Tax Information
                                    </h3>

                                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                                        {/* Tax Rate */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg">
                                                <ReceiptPercentIcon className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tax Rate</p>
                                                <p className="text-2xl font-bold text-cyan-600">
                                                    {(tax.taxRate * 100).toFixed(2)}%
                                                </p>
                                            </div>
                                        </div>

                                        {/* Region */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg">
                                                <GlobeAltIcon className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Region</p>
                                                <p className="text-sm font-medium text-gray-900">{tax.region}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column - Additional Info */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Additional Information
                                    </h3>

                                    <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-6 text-white shadow-lg">
                                        <div className="relative">
                                            <p className="text-cyan-100 text-xs font-medium uppercase tracking-wider mb-2">Tax Rate</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-5xl font-bold tracking-tight">
                                                    {(tax.taxRate * 100).toFixed(2)}
                                                </span>
                                                <span className="text-2xl font-light text-cyan-100">%</span>
                                            </div>
                                            <ReceiptPercentIcon className="absolute -right-4 -bottom-4 h-24 w-24 text-white/10" />
                                        </div>
                                    </div>

                                    {/* Quick Stats */}
                                    <div>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 mb-1">Status</p>
                                            <p className={`text-lg font-semibold ${tax.isActive ? 'text-green-600' : 'text-gray-600'}`}>
                                                {tax.isActive ? 'Active' : 'Inactive'}
                                            </p>
                                        </div>

                                    </div>
                                </div>
                            </div>

                            {/* Description Section */}
                            {tax.description && (
                                <div className="border-t border-gray-200 pt-6">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                                        <DocumentTextIcon className="h-5 w-5 text-cyan-600" />
                                        Description
                                    </h3>
                                    <div className="bg-gray-50 rounded-lg p-4 flex gap-3">
                                        <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-gray-700 leading-relaxed">{tax.description}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TaxTypeDetails;