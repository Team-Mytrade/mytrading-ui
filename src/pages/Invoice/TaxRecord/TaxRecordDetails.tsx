import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import {
    ArrowLeftIcon,
    PencilSquareIcon,
    PrinterIcon,
    CalendarDaysIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    ScaleIcon,
    BuildingOfficeIcon,
    CheckIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageLoader from "../../../components/common/PageLoader";
import { ToasterService } from "../../../Services/ToasterService";

const API_TAX_RECORDS = "/v1/api/invoice/tax-record";

interface TaxRecord {
    id: number;
    taxTypeId: number;
    taxType?: { id: number; taxName: string; taxRate: number; region: string };
    taxableAmount: number;
    taxAmount: number;
    transactionDate: string;
    referenceNumber: string;
    description: string;
    createdAt?: string;
}

const TaxRecordDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [record, setRecord] = useState<TaxRecord | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await axios.get(`${API_TAX_RECORDS}/${id}`);
                setRecord(res.data);
            } catch (err) {
                console.error("Error loading tax record details:", err);
                ToasterService.error("Failed to load details");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    if (loading) return <PageLoader message="Loading tax record..." />;
    if (!record) return <div className="p-6 text-center text-red-500 font-black">Record not found in system</div>;

    return (
        <>
            <PageMeta title={`Filing Details — ${record.referenceNumber}`} description="Audit view of official tax record submission" />
            <PageBreadcrumb pageTitle="Tax Filing Audit" />

            <div className="max-w-4xl mx-auto p-6">
                <div className="mb-8 flex justify-between items-center bg-gray-900 p-4 rounded-3xl shadow-xl">
                    <button
                        onClick={() => navigate("/taxRecords")}
                        className="flex items-center gap-2 px-6 py-2 text-cyan-400 hover:text-white transition-all font-black text-[10px] uppercase tracking-[0.2em] group"
                    >
                        <ArrowLeftIcon className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        Archive
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.print()}
                            className="p-3 bg-white/5 text-white hover:bg-white/10 rounded-2xl transition-all"
                            title="Print Document"
                        >
                            <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => navigate(`/taxRecords/edit/${record.id}`)}
                            className="flex items-center gap-3 px-8 py-2.5 bg-cyan-500 text-white rounded-2xl hover:bg-cyan-400 transition-all shadow-xl font-black text-[10px] uppercase tracking-[0.2em]"
                        >
                            <PencilSquareIcon className="h-4 w-4" />
                            Rectify Filing
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-[3.5rem] shadow-2xl border border-gray-100 overflow-hidden relative print:shadow-none">
                    {/* Header Strip */}
                    <div className="h-4 bg-gradient-to-r from-gray-900 via-cyan-900 to-gray-900" />

                    <div className="p-16">
                        {/* Summary Block */}
                        <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20 pb-16 border-b border-gray-50">
                            <div className="space-y-8">
                                <div>
                                    <p className="text-[10px] font-black text-cyan-600 uppercase tracking-[0.4em] mb-4">Official Submission ID</p>
                                    <h2 className="text-6xl font-black text-gray-900 tracking-tighter italic font-mono uppercase">#{record.referenceNumber || "PENDING"}</h2>
                                </div>
                                <div className="flex gap-4">
                                    <span className="flex items-center px-6 py-2.5 bg-gray-50 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-100 shadow-sm">
                                        <CalendarDaysIcon className="h-4 w-4 mr-2" />
                                        FILED: {new Date(record.transactionDate).toLocaleDateString(undefined, { dateStyle: 'full' })}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 min-w-[300px] text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Tax Classification</p>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-black text-gray-900 leading-none">{record.taxType?.taxName || "Manual Adjustment"}</span>
                                    <span className="text-[10px] font-black text-cyan-600 uppercase mt-2 bg-white px-4 py-1.5 rounded-full shadow-sm border border-cyan-100">
                                        {(record.taxType?.taxRate ? record.taxType.taxRate * 100 : 0).toFixed(1)}% Rate applied
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Financial Audit Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
                            <div className="p-12 bg-gray-50 rounded-[3rem] border border-gray-100 shadow-inner relative group overflow-hidden">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Taxable Volume</p>
                                <div className="flex items-baseline gap-2 pb-6 border-b border-gray-200/50">
                                    <span className="text-gray-300 text-xl font-bold italic tracking-tighter">USD</span>
                                    <h3 className="text-4xl font-black text-gray-900 tracking-tighter font-mono">{record.taxableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                                </div>
                                <div className="mt-6 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Verified by System</span>
                                    <ShieldCheckIcon className="h-5 w-5 text-green-500/30" />
                                </div>
                                <BuildingOfficeIcon className="absolute -right-10 -bottom-10 h-40 w-40 text-black/5 rotate-12" />
                            </div>

                            <div className="p-12 bg-gray-900 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                                <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4">Net Tax Liability</p>
                                <div className="flex items-baseline gap-2 relative z-10">
                                    <span className="text-cyan-600 text-3xl font-black italic tracking-tighter animate-pulse-slow">USD</span>
                                    <h3 className="text-6xl font-black tracking-tighter font-mono group-hover:text-cyan-400 transition-colors">{record.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                                </div>
                                <div className="mt-8 pt-8 border-t border-white/5 relative z-10 flex items-center gap-3">
                                    <CheckIcon className="h-5 w-5 text-green-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600">Locked for Audit</span>
                                </div>
                                <ScaleIcon className="absolute -right-8 -bottom-8 h-48 w-48 text-white/5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-1000" />
                            </div>
                        </div>

                        {/* Narrative */}
                        <div className="space-y-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] pl-2">Internal Submission Narrative</p>
                            <div className="p-12 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200 flex gap-8">
                                <div className="p-4 bg-white rounded-2xl shadow-sm self-start">
                                    <DocumentTextIcon className="h-7 w-7 text-cyan-600" />
                                </div>
                                <div className="text-lg font-bold text-gray-700 italic leading-[1.8] flex-1">
                                    {record.description || "No specific narrative or audit notes were recorded at the time of filing. This is a standard system-generated registration entry."}
                                </div>
                            </div>
                        </div>

                        {/* Audit Footer */}
                        <div className="mt-20 pt-12 border-t border-gray-100 flex flex-wrap justify-between items-center gap-8">
                            <div className="flex gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Digital Stamp Verified</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500/50" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Encryption: AES-256</span>
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                Filing Epoch: {record.createdAt ? new Date(record.createdAt).getTime() : 'SYSTEM_GEN'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TaxRecordDetails;
