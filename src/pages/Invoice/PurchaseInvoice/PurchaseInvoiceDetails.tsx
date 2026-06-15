import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    DocumentTextIcon,
    CheckCircleIcon,
    ClockIcon,
    ArrowLeftIcon,
    PencilSquareIcon,
    BuildingOfficeIcon,
    CalendarIcon,
    ReceiptPercentIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import { ToasterService } from "../../../Services/ToasterService";

const BASE_URL = "/v1/api/invoice/purchase-invoices";

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID";

interface Vendor {
    id: number;
    name: string;
    email?: string;
    phone?: string;
}

interface PurchaseInvoice {
    id?: number;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    totalAmount: number;
    purchaseInvoiceStatus: Status;
    vendor: Vendor;
    currency: string;
    referenceNumber: string;
    notes: string;
}

const PurchaseInvoiceDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/${id}`);
                setInvoice(res.data);
            } catch (err) {
                console.error("Error loading purchase invoice:", err);
                ToasterService.error("Failed to load purchase invoice details");
            } finally {
                setLoading(false);
            }
        };
        fetchInvoice();
    }, [id]);

    const getStatusColor = (status: Status) => {
        switch (status) {
            case "PAID": return "bg-green-100 text-green-800";
            case "PARTIALLY_PAID": return "bg-yellow-100 text-yellow-800";
            case "OPEN": return "bg-blue-100 text-blue-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const getStatusIcon = (status: Status) => {
        switch (status) {
            case "PAID": return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
            case "PARTIALLY_PAID": return <ClockIcon className="h-4 w-4 text-yellow-600" />;
            case "OPEN": return <ReceiptPercentIcon className="h-4 w-4 text-blue-600" />;
            default: return <DocumentTextIcon className="h-4 w-4 text-gray-600" />;
        }
    };

    if (loading) return <div className="p-6 text-center">Loading...</div>;
    if (!invoice) return <div className="p-6 text-center text-red-500">Purchase Invoice not found</div>;

    return (
        <>
            <PageMeta title={`Purchase Invoice ${invoice.invoiceNumber}`} description="View purchase invoice details" />
            <PageBreadcrumb pageTitle="Purchase Invoice Details" />

            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-6 flex justify-between items-center">
                    <button
                        onClick={() => navigate("/payment-invoice")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to List
                    </button>
                    <button
                        onClick={() => navigate(`/payment-invoice/edit/${invoice.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
                    >
                        <PencilSquareIcon className="h-5 w-5" />
                        Edit Purchase Invoice
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-8 border-b border-gray-100 pb-8">
                            <div>
                                <h4 className="text-3xl font-black text-gray-900 mb-2">{invoice.invoiceNumber}</h4>
                                <div className="flex gap-4">
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <CalendarIcon className="h-4 w-4" />
                                        <span className="font-semibold">Issued:</span> {new Date(invoice.invoiceDate).toLocaleDateString()}
                                    </p>
                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                        <ClockIcon className="h-4 w-4" />
                                        <span className="font-semibold">Due:</span> {new Date(invoice.dueDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <span className={`inline-flex items-center px-4 py-2 text-sm font-bold rounded-full shadow-sm ${getStatusColor(invoice.purchaseInvoiceStatus)}`}>
                                {getStatusIcon(invoice.purchaseInvoiceStatus)}
                                <span className="ml-2 uppercase tracking-wider">{invoice.purchaseInvoiceStatus.replace('_', ' ')}</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <BuildingOfficeIcon className="h-4 w-4" /> Vendor
                                </p>
                                <p className="text-lg font-bold text-gray-900">{invoice.vendor?.name}</p>
                                {invoice.vendor?.email && <p className="text-sm text-gray-500">{invoice.vendor.email}</p>}
                                {invoice.vendor?.phone && <p className="text-sm text-gray-500">{invoice.vendor.phone}</p>}
                            </div>
                            <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    Reference Details
                                </p>
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-700"><span className="font-semibold">Reference:</span> {invoice.referenceNumber || "N/A"}</p>
                                    <p className="text-sm text-gray-700"><span className="font-semibold">Currency:</span> {invoice.currency}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-10 p-10 bg-gray-900 rounded-3xl text-white shadow-xl relative overflow-hidden text-center">
                            <div className="relative z-10">
                                <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.3em] mb-4">Total Amount Payable</p>
                                <div className="flex justify-center items-end gap-2">
                                    <span className="text-2xl font-bold text-gray-400 mb-2">{invoice.currency}</span>
                                    <span className="text-6xl font-black font-mono tracking-tighter italic">
                                        {invoice.totalAmount.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500 rounded-full blur-[80px] opacity-20 -mr-16 -mt-16"></div>
                        </div>

                        {invoice.notes && (
                            <div className="mt-8">
                                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <DocumentTextIcon className="h-4 w-4" /> Additional Notes
                                </h5>
                                <p className="text-sm text-gray-700 leading-relaxed p-4 bg-orange-50 border-l-4 border-orange-200 rounded-r-lg italic">
                                    "{invoice.notes}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default PurchaseInvoiceDetails;
