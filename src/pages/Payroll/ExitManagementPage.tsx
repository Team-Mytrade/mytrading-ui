import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import {
    LogOut,
    ClipboardCheck,
    Calendar,
    FileText,
    MessageSquare,
    CheckCircle2,
    Clock,
    AlertCircle,
    Send,
    ArrowRight,
    UserX,
    Laptop,
    Key,
    ShieldCheck,
    ChevronRight,
    Search,
    Download,
    X,
    Briefcase,
    Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AuthContext } from '../../context/AuthContext';
import { Employee } from '../../shared/types/employee.types';

interface OffboardingTask {
    id: number;
    title: string;
    description: string;
    status: 'Pending' | 'Completed';
    category: 'IT' | 'Admin' | 'HR' | 'Finance';
}

interface Resignation {
    id: number;
    submissionDate: string;
    lastWorkingDay: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
    noticePeriod: string;
}

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";

const ExitManagementPage: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const [resignation, setResignation] = useState<Resignation | null>(null);
    const [tasks, setTasks] = useState<OffboardingTask[]>([
        { id: 1, title: 'Asset Return', description: 'Return laptop, charger, and access cards to IT.', status: 'Pending', category: 'IT' },
        { id: 2, title: 'Knowledge Transfer', description: 'Complete documentation for current projects.', status: 'Pending', category: 'HR' },
        { id: 3, title: 'Finance Clearance', description: 'Settle all pending reimbursements.', status: 'Pending', category: 'Finance' },
        { id: 4, title: 'ID Deactivation', description: 'Disable company email and app access.', status: 'Pending', category: 'IT' },
    ]);

    const [isResigning, setIsResigning] = useState(false);
    const [formData, setFormData] = useState({
        reason: '',
        lastWorkingDay: '',
    });

    useEffect(() => {
        if (user) resolveEmployee();
    }, [user]);

    const resolveEmployee = async () => {
        try {
            const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
            const matched = res.data.find((emp: Employee) =>
                emp.officialEmail?.toLowerCase() === user?.email?.toLowerCase()
            );
            setResolvedEmployeeId(matched?.id || 1);
        } catch { setResolvedEmployeeId(1); }
    };

    const handleResignSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Mocking premium transition
        setTimeout(() => {
            setResignation({
                id: Date.now(),
                submissionDate: new Date().toISOString().split('T')[0],
                lastWorkingDay: formData.lastWorkingDay,
                reason: formData.reason,
                status: 'Pending',
                noticePeriod: '90 Days'
            });
            setIsResigning(false);
            setLoading(false);
        }, 1200);
    };

    const toggleTask = (id: number) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === 'Pending' ? 'Completed' : 'Pending' } : t));
    };

    return (
        <div className="exit-mgmt-page p-6 space-y-8 bg-[#F8FAFC] min-h-screen">
            <PageMeta title="Exit Journey" description="Professional offboarding and resignation management" />
            <PageBreadcrumb pageTitle="Exit Journey" />

            <AnimatePresence mode="wait">
                {!resignation && !isResigning ? (
                    <motion.div
                        key="entry"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white p-24 rounded-[4rem] border border-gray-100 shadow-xl shadow-indigo-500/5 text-center flex flex-col items-center"
                    >
                        <div className="w-32 h-32 bg-indigo-50 text-indigo-500 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-inner">
                            <LogOut size={56} strokeWidth={1.5} />
                        </div>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic leading-none">Service Tenure</h2>
                        <p className="text-sm font-bold text-gray-400 mt-4 max-w-md mx-auto leading-relaxed uppercase tracking-widest italic">
                            You're currently in active service. If you wish to initiate your professional transition journey, proceed below.
                        </p>
                        <button
                            onClick={() => setIsResigning(true)}
                            className="mt-12 bg-gray-900 hover:bg-gray-800 text-white px-12 py-6 rounded-[2rem] font-black transition-all flex items-center gap-4 uppercase tracking-[0.2em] text-xs shadow-2xl"
                        >
                            Initiate Transition
                            <ArrowRight size={18} />
                        </button>
                    </motion.div>
                ) : isResigning ? (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid grid-cols-1 lg:grid-cols-2 gap-10"
                    >
                        <div className="bg-white p-12 rounded-[4rem] border border-gray-100 shadow-sm space-y-10">
                            <div>
                                <h3 className="text-3xl font-black text-gray-800 uppercase italic leading-none">Transition Brief</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Personal statement of intent and timeline</p>
                            </div>
                            <form onSubmit={handleResignSubmit} className="space-y-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Substantiation</label>
                                    <textarea
                                        required
                                        className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] p-8 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-gray-700 min-h-[220px]"
                                        placeholder="Briefly state your reasons for this professional shift..."
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    ></textarea>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Proposed Terminal Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full h-18 bg-gray-50 border border-gray-100 rounded-2xl px-8 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-gray-700"
                                        value={formData.lastWorkingDay}
                                        onChange={e => setFormData({ ...formData, lastWorkingDay: e.target.value })}
                                    />
                                </div>
                                <div className="p-6 bg-amber-50/50 rounded-[2rem] border border-amber-100/30 flex gap-5">
                                    <AlertCircle className="text-amber-500 shrink-0 mt-1" size={24} />
                                    <p className="text-[10px] text-amber-900/60 font-black uppercase tracking-widest leading-relaxed italic">
                                        Policy Note: Standard notice cycle is 90 days. Professional relief requests are subject to managerial audit.
                                    </p>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsResigning(false)}
                                        className="flex-1 h-18 rounded-2xl font-black text-gray-400 hover:bg-gray-100 transition-all uppercase tracking-widest text-[10px]"
                                    >
                                        Abandon
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] h-18 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black transition-all shadow-2xl flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
                                    >
                                        {loading ? <div className="animate-spin h-5 w-5 border-4 border-white border-t-transparent rounded-full" /> : <Send size={18} />}
                                        Push Confirmation
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-16 rounded-[4rem] text-white relative overflow-hidden flex flex-col justify-center">
                            <div className="absolute -bottom-32 -right-32 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                                <UserX size={450} />
                            </div>
                            <div className="relative z-10 space-y-12">
                                <h4 className="text-4xl font-black uppercase italic leading-tight">Exit Protocol<br /><span className="text-indigo-200">Executive Summary</span></h4>
                                <div className="space-y-10">
                                    <PolicyItem icon={<Calendar />} title="Notice Period" desc="90 Calendar days required for smooth transition." />
                                    <PolicyItem icon={<Laptop />} title="Hardware Release" desc="All terminal equipment must be cleared on LWD." />
                                    <PolicyItem icon={<Briefcase />} title="Closure Portfolio" desc="Final settlement cycles within 45 days post-exit." />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="active"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-10"
                    >
                        {/* Live Status Tracker */}
                        <div className="bg-white p-12 rounded-[4.5rem] border border-gray-100 shadow-xl shadow-indigo-500/5 flex flex-col lg:flex-row items-center justify-between gap-12 relative overflow-hidden">
                            <div className="absolute top-0 left-0 h-3 w-full bg-indigo-500"></div>
                            <div className="shrink-0 text-center lg:text-left">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Engagement Lifecyle</span>
                                <div className="flex items-center gap-4 mt-2 justify-center lg:justify-start">
                                    <h2 className="text-4xl font-black text-gray-900 uppercase italic tracking-tighter">{resignation?.status}</h2>
                                    <div className="w-5 h-5 rounded-full bg-amber-500 animate-ping"></div>
                                </div>
                            </div>
                            <div className="flex-1 flex items-center gap-8 justify-center max-w-2xl">
                                <TimelineNode date={resignation?.submissionDate || ''} label="Initiated" completed />
                                <div className="h-0.5 flex-1 bg-gray-100 relative">
                                    <div className="absolute top-0 left-0 h-full w-1/2 bg-indigo-500"></div>
                                </div>
                                <TimelineNode date="TBD" label="Audit" active />
                                <div className="h-0.5 flex-1 bg-gray-100"></div>
                                <TimelineNode date={resignation?.lastWorkingDay || ''} label="Release" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                            {/* Clearance Board */}
                            <div className="lg:col-span-8 bg-white p-2 rounded-[4rem] border border-gray-100 shadow-sm">
                                <div className="p-10 border-b border-gray-50 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-800 uppercase italic">Clearance Navigator</h3>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mt-1">Multi-departmental asset and access recovery</p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-2xl">
                                            {tasks.filter(t => t.status === 'Completed').length} / {tasks.length} Resolved
                                        </span>
                                    </div>
                                </div>
                                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {tasks.map(task => (
                                        <div
                                            key={task.id}
                                            onClick={() => toggleTask(task.id)}
                                            className={`group p-8 rounded-[3rem] border transition-all cursor-pointer flex flex-col gap-6 ${task.status === 'Completed' ? 'bg-gray-50/50 border-transparent' : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className={`p-4 rounded-2xl transition-all ${task.status === 'Completed' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white'
                                                    }`}>
                                                    {task.status === 'Completed' ? <CheckCircle2 size={24} /> : <Zap size={24} />}
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${task.category === 'IT' ? 'bg-indigo-50 text-indigo-500' :
                                                        task.category === 'Finance' ? 'bg-emerald-50 text-emerald-500' :
                                                            'bg-amber-50 text-amber-500'
                                                    }`}>
                                                    {task.category}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <h4 className={`text-sm font-black uppercase tracking-widest transition-all ${task.status === 'Completed' ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
                                                    {task.title}
                                                </h4>
                                                <p className="text-[10px] text-gray-400 font-bold leading-relaxed">{task.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Release Portfolio Sidebar */}
                            <div className="lg:col-span-4 space-y-10">
                                <div className="bg-gray-900 text-white p-12 rounded-[4rem] shadow-2xl space-y-10">
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6">Archive Summary</h4>
                                        <div className="space-y-6">
                                            <ArchiveStat label="Terminal Entry" value={resignation?.submissionDate || ''} />
                                            <ArchiveStat label="Service Anchor" value={resignation?.noticePeriod || ''} />
                                            <ArchiveStat label="Final Horizon" value={resignation?.lastWorkingDay || ''} />
                                            <ArchiveStat label="Payout Cycle" value="TBD" />
                                        </div>
                                    </div>
                                    <div className="space-y-4 pt-10 border-t border-white/5">
                                        <button className="w-full h-16 bg-white text-gray-900 rounded-[1.5rem] font-black hover:bg-indigo-400 transition-all uppercase tracking-[0.2em] text-[10px] shadow-xl">
                                            Clearance Matrix
                                        </button>
                                        <button className="w-full h-16 bg-white/5 text-gray-500 rounded-[1.5rem] font-black hover:bg-white/10 transition-all uppercase tracking-[0.2em] text-[10px]">
                                            Withdraw Intent
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm space-y-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-4 bg-indigo-50 text-indigo-500 rounded-2xl">
                                            <MessageSquare size={24} />
                                        </div>
                                        <h4 className="text-xl font-black text-gray-800 uppercase italic leading-tight">Exit Survey</h4>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed uppercase tracking-widest italic">Your feedback anchors our structural growth. Please schedule your final review.</p>
                                    <button className="w-full py-5 border-2 border-dashed border-gray-100 text-gray-400 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-400 transition-all">
                                        Protocol Interview
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const PolicyItem: React.FC<{ icon: React.ReactNode, title: string, desc: string }> = ({ icon, title, desc }) => (
    <div className="flex gap-6 group cursor-pointer">
        <div className="p-4 bg-white/10 rounded-2xl group-hover:bg-white group-hover:text-indigo-600 transition-all shrink-0">
            {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
        </div>
        <div>
            <h5 className="font-black text-xl italic leading-none">{title}</h5>
            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-2 leading-relaxed italic">{desc}</p>
        </div>
    </div>
);

const TimelineNode: React.FC<{ date: string, label: string, active?: boolean, completed?: boolean }> = ({ date, label, active, completed }) => (
    <div className="flex flex-col items-center gap-3 relative shrink-0">
        <div className={`w-14 h-14 rounded-2xl transition-all flex items-center justify-center shadow-lg ${completed ? 'bg-emerald-500 text-white' :
                active ? 'bg-indigo-600 text-white shadow-indigo-500/40' :
                    'bg-gray-50 text-gray-300'
            }`}>
            {completed ? <CheckCircle2 size={28} /> : active ? <Zap size={28} /> : <Clock size={28} />}
        </div>
        <div className="text-center">
            <h5 className={`text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1 ${active ? 'text-gray-900' : 'text-gray-300'}`}>{label}</h5>
            <span className="text-[9px] font-bold text-gray-400 tabular-nums">{date}</span>
        </div>
    </div>
);

const ArchiveStat: React.FC<{ label: string, value: string }> = ({ label, value }) => (
    <div className="flex justify-between items-center group cursor-pointer py-2 border-b border-transparent hover:border-white/5 transition-all">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 group-hover:text-indigo-400 transition-colors">{label}</span>
        <span className="font-black text-white italic tracking-tight">{value}</span>
    </div>
);

export default ExitManagementPage;
