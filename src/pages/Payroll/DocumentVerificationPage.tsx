import React, { useState } from "react";
import {
    FileCheck,
    Search,
    CheckCircle2,
    Clock,
    User,
    ChevronRight,
    FileText,
    Eye,
    ShieldCheck,
    XCircle,
    Info,
    ArrowUpRight,
    TrendingUp,
    Filter,
    Download,
    Check,
    X,
    Maximize2,
    Briefcase,
    Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

interface EmpDocument {
    id: number;
    employeeName: string;
    employeeCode: string;
    docType: string;
    docName: string;
    submittedDate: string;
    status: 'Pending' | 'Verified' | 'Rejected';
    previewUrl: string;
    fileSize: string;
}

const DocumentVerificationPage: React.FC = () => {
    const [docs, setDocs] = useState<EmpDocument[]>([
        { id: 1, employeeName: 'John Doe', employeeCode: 'EMP-001', docType: 'PAN Card', docName: 'pan_card_john.pdf', submittedDate: '2024-06-20', status: 'Pending', previewUrl: '#', fileSize: '1.4 MB' },
        { id: 2, employeeName: 'Sarah Smith', employeeCode: 'EMP-004', docType: 'Aadhaar Card', docName: 'aadhaar_sarah.jpg', submittedDate: '2024-06-21', status: 'Pending', previewUrl: '#', fileSize: '0.9 MB' },
        { id: 3, employeeName: 'Mike Johnson', employeeCode: 'EMP-007', docType: 'Degree Certificate', docName: 'mba_mike.pdf', submittedDate: '2024-06-18', status: 'Verified', previewUrl: '#', fileSize: '2.8 MB' },
        { id: 4, employeeName: 'Emily Davis', employeeCode: 'EMP-012', docType: 'Address Proof', docName: 'rent_agreement.pdf', submittedDate: '2024-06-22', status: 'Pending', previewUrl: '#', fileSize: '4.1 MB' },
    ]);

    const [search, setSearch] = useState("");
    const [selectedDoc, setSelectedDoc] = useState<EmpDocument | null>(null);
    const [actionType, setActionType] = useState<'VERIFY' | 'REJECT' | null>(null);
    const [remarks, setRemarks] = useState("");

    const filteredDocs = docs.filter(doc =>
        doc.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        doc.docType.toLowerCase().includes(search.toLowerCase())
    );

    const handleAction = () => {
        if (!selectedDoc || !actionType) return;
        const newStatus = actionType === 'VERIFY' ? 'Verified' : 'Rejected';
        setDocs(docs.map(d => d.id === selectedDoc.id ? { ...d, status: newStatus } : d));
        setSelectedDoc(null);
        setActionType(null);
        setRemarks("");
    };

    return (
        <div className="doc-verification-page p-6 space-y-8 bg-[#F8FAFC] min-h-screen">
            <PageMeta title="Approval Command" description="Enterprise document verification and audit control" />

            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-4">
                    <PageBreadcrumb pageTitle="Approval Command" />
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">Compliance Audit Mode</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">TAT Goal: &lt; 24h</span>
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Verification Control</h1>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="bg-white border border-gray-100 text-gray-700 px-6 py-4 rounded-2xl font-black transition-all hover:bg-gray-50 flex items-center gap-2 shadow-sm uppercase tracking-widest text-[10px]">
                        <TrendingUp size={18} className="text-indigo-500" />
                        Audit Telemetry
                    </button>
                    <button className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl uppercase tracking-widest text-[11px]">
                        <Download size={18} />
                        Export Log
                    </button>
                </div>
            </header>

            {/* Verification Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <AuditStat label="Verification Queue" value={docs.filter(d => d.status === 'Pending').length.toString()} icon={<Zap />} color="amber" hint="Action required" />
                <AuditStat label="Succesful Audits" value="482" icon={<ShieldCheck />} color="emerald" hint="Last 30 days" />
                <AuditStat label="Rejection Rate" value="4.2%" icon={<XCircle />} color="rose" hint="Compliance filter" />
                <AuditStat label="Avg. Response" value="6.4h" icon={<Clock />} color="indigo" hint="Within SLA" />
            </div>

            <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col min-h-[650px]">
                <div className="p-10 border-b border-gray-50 flex flex-col md:flex-row gap-6 items-center justify-between">
                    <div className="relative w-full md:w-[450px]">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Find employee, ID, or asset classification..."
                            className="w-full h-15 bg-gray-50 border border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl pl-14 pr-6 outline-none transition-all font-bold text-gray-700"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-3">
                        <button className="h-15 w-15 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl flex items-center justify-center transition-all">
                            <Filter size={20} />
                        </button>
                        <button className="h-15 px-8 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl flex items-center justify-center transition-all font-black uppercase tracking-widest text-[10px]">
                            Advanced Filter
                        </button>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-8">
                    <AnimatePresence>
                        {filteredDocs.length > 0 ? filteredDocs.map((doc, idx) => (
                            <motion.div
                                key={doc.id}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white border border-gray-100 rounded-[3rem] p-10 hover:shadow-2xl hover:border-indigo-100 transition-all group flex flex-col gap-8"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-5">
                                        <div className="w-16 h-16 bg-gray-100 rounded-[1.5rem] flex items-center justify-center font-black text-gray-400 shadow-inner group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            <Briefcase size={28} />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-black text-gray-800 tracking-tight uppercase italic leading-none">{doc.docType}</h4>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-lg">ID: {doc.employeeCode}</span>
                                                <span className="text-[11px] font-bold text-gray-500">{doc.employeeName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <StatusPill status={doc.status} />
                                </div>

                                <div className="bg-gray-50/50 rounded-[2.5rem] p-6 border border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-xl shadow-sm">
                                            <FileText size={20} className="text-rose-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-gray-700 truncate max-w-[200px]">{doc.docName}</p>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{doc.fileSize} • Submitted {doc.submittedDate}</p>
                                        </div>
                                    </div>
                                    <button className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors border border-gray-100 shadow-sm">
                                        <Maximize2 size={18} />
                                    </button>
                                </div>

                                <div className="flex gap-4">
                                    {doc.status === 'Pending' ? (
                                        <>
                                            <button
                                                onClick={() => { setSelectedDoc(doc); setActionType('VERIFY'); }}
                                                className="flex-1 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2"
                                            >
                                                <Check size={18} />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => { setSelectedDoc(doc); setActionType('REJECT'); }}
                                                className="flex-1 h-14 bg-white border border-gray-100 text-gray-400 hover:text-rose-500 hover:border-rose-200 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                            >
                                                <X size={18} />
                                                Reject
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-full h-14 bg-gray-50 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 cursor-default border border-transparent">
                                            <BadgeCheck size={16} />
                                            Lifecycle Finalized
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )) : (
                            <div className="col-span-full py-48 text-center">
                                <p className="font-black text-gray-200 uppercase italic text-2xl tracking-widest">No matching assets in queue</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Action Dialog */}
            <AnimatePresence>
                {selectedDoc && actionType && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-[4rem] w-full max-w-xl shadow-2xl overflow-hidden relative"
                        >
                            <button onClick={() => setSelectedDoc(null)} className="absolute top-10 right-10 p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all border border-gray-100">
                                <X size={20} />
                            </button>
                            <div className="p-12 border-b">
                                <h3 className="text-3xl font-black text-gray-800 italic uppercase leading-none">Audit Verdict</h3>
                                <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-[9px]">Decision for {selectedDoc.docType} • {selectedDoc.employeeName}</p>
                            </div>
                            <div className="p-12 space-y-10">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Verification Substantiation</label>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-100 rounded-[2.5rem] p-8 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-gray-700 min-h-[180px]"
                                        placeholder="Add professional audit remarks or reason for rejection..."
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                    ></textarea>
                                </div>
                                <div className="p-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100/20 flex gap-5">
                                    <Info size={24} className="text-indigo-400 shrink-0" />
                                    <p className="text-[10px] font-bold text-indigo-900/60 leading-relaxed italic">
                                        Verdict will be permanently archived in the employee's compliance history. System notification will be dispatched immediately.
                                    </p>
                                </div>
                            </div>
                            <div className="p-12 bg-gray-50 flex gap-4 border-t">
                                <button onClick={() => setSelectedDoc(null)} className="flex-1 h-16 rounded-[1.5rem] font-black text-gray-400 hover:bg-white transition-all uppercase tracking-widest text-[10px]">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAction}
                                    className={`flex-[2] h-16 ${actionType === 'VERIFY' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'} text-white rounded-[1.5rem] font-black transition-all shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]`}
                                >
                                    {actionType === 'VERIFY' ? <Check size={18} /> : <X size={18} />}
                                    {actionType === 'VERIFY' ? 'Finalize Approval' : 'Submit Rejection'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const AuditStat: React.FC<{ label: string, value: string, icon: React.ReactNode, color: string, hint: string }> = ({ label, value, icon, color, hint }) => {
    const colors: any = {
        amber: 'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        rose: 'bg-rose-50 text-rose-600'
    };
    return (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col gap-6 group hover:shadow-lg transition-all relative overflow-hidden">
            <div className="flex justify-between items-start">
                <div className={`p-4 rounded-2xl ${colors[color]} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                <ArrowUpRight size={18} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
            </div>
            <div>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-0.5">{label}</span>
                <h3 className="text-3xl font-black text-gray-900 leading-none">{value}</h3>
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-2">{hint}</p>
            </div>
        </div>
    );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
    const styles: any = {
        'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
        'Verified': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Rejected': 'bg-rose-50 text-rose-600 border-rose-100'
    };
    return (
        <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${styles[status]}`}>
            {status}
        </span>
    );
};

const BadgeCheck: React.FC<{ size: number, className?: string }> = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m9 11 3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
);

export default DocumentVerificationPage;
