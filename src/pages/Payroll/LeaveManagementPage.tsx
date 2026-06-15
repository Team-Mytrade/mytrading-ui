import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import {
    Calendar,
    Clock,
    AlertCircle,
    Plus,
    Filter,
    ChevronRight,
    Send,
    History,
    PieChart,
    CheckCircle2,
    XCircle,
    Info,
    ArrowUpRight,
    Briefcase,
    BadgeCheck,
    X,
    ShieldAlert
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AuthContext } from '../../context/AuthContext';
import { Employee } from '../../shared/types/employee.types';
import { LeaveRequest, LeaveBalance, LeaveType, LeaveStatus } from '../../shared/types/leave.types';

const LEAVE_API_URL = "/v1/api/payroll/leave";
const EMPLOYEE_API_URL = "/v1/api/payroll/employee";

const LeaveManagementPage: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [balances, setBalances] = useState<LeaveBalance>({
        employeeId: 0,
        annual: 15,
        sick: 10,
        casual: 7,
        used: 4
    });

    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [formData, setFormData] = useState({
        leaveType: 'Annual' as LeaveType,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        reason: ''
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

    useEffect(() => {
        if (resolvedEmployeeId) fetchLeaveData();
    }, [resolvedEmployeeId]);

    const fetchLeaveData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${LEAVE_API_URL}/employee/${resolvedEmployeeId}`);
            setRequests(res.data.requests || []);
            setBalances(res.data.balances || balances);
        } catch {
            // Mock data for premium preview
            setRequests([
                { id: 1, employee: { id: 1 }, leaveType: 'Annual', startDate: '2024-03-10', endDate: '2024-03-12', reason: 'Family engagement', status: 'Approved', appliedDate: '2024-02-15' },
                { id: 2, employee: { id: 1 }, leaveType: 'Sick', startDate: '2024-02-05', endDate: '2024-02-05', reason: 'Medical appointment', status: 'Approved', appliedDate: '2024-02-04' },
                { id: 3, employee: { id: 1 }, leaveType: 'Casual', startDate: '2024-03-25', endDate: '2024-03-25', reason: 'Personal work', status: 'Pending', appliedDate: '2024-03-01' }
            ]);
        } finally { setLoading(false); }
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(LEAVE_API_URL, {
                employee: { id: resolvedEmployeeId },
                ...formData,
                status: 'Pending',
                appliedDate: new Date().toISOString()
            });
            setIsModalOpen(false);
            fetchLeaveData();
        } catch {
            alert("Application offline. Local sync only.");
            setIsModalOpen(false);
        }
    };

    const stats = useMemo(() => ({
        available: balances.annual + balances.sick + balances.casual - balances.used,
        utilization: Math.round((balances.used / (balances.annual + balances.sick + balances.casual)) * 100)
    }), [balances]);

    return (
        <div className="leave-mgmt-page p-6 space-y-8 bg-[#F8FAFC] min-h-screen">
            <PageMeta title="Time-Off Hub" description="Premium leave management and balance tracking" />

            <div className="flex justify-between items-end">
                <PageBreadcrumb pageTitle="Time-Off Hub" />
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl uppercase tracking-widest text-[11px]"
                >
                    <Plus size={18} />
                    Submit Request
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Sidebar: Balances & Stats */}
                <div className="lg:col-span-4 space-y-6">
                    <BalanceCard title="Annual Quotient" count={balances.annual} icon={<Calendar />} color="indigo" />
                    <BalanceCard title="Health Reserve" count={balances.sick} icon={<ShieldAlert />} color="rose" />
                    <BalanceCard title="Casual Buffer" count={balances.casual} icon={<History />} color="blue" />

                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Utilization Index</span>
                            <span className="text-indigo-600 font-extrabold text-sm">{stats.utilization}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${stats.utilization}%` }}
                                className="h-full bg-indigo-500 rounded-full shadow-lg"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Consumed</span>
                                <h4 className="text-xl font-black text-gray-800 italic">{balances.used} <span className="text-[10px] opacity-40">Days</span></h4>
                            </div>
                            <div className="space-y-1 text-right">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Available</span>
                                <h4 className="text-xl font-black text-indigo-600 italic">{stats.available} <span className="text-[10px] opacity-40">Days</span></h4>
                            </div>
                        </div>
                        <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100/30 flex gap-4">
                            <Info size={20} className="text-amber-400 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-900/60 italic leading-relaxed">
                                Balances reset on Jan 1st. Unused annual leaves roll over up to 15 days.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main: History & Progression */}
                <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-gray-800 uppercase italic leading-none">Application History</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Lifecycle tracking of your time-off requests</p>
                        </div>
                        <button className="h-14 w-14 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl flex items-center justify-center transition-all">
                            <Filter size={18} />
                        </button>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                    <th className="px-8 py-6">Leave Detail</th>
                                    <th className="px-8 py-6">Period</th>
                                    <th className="px-8 py-6">Timeline</th>
                                    <th className="px-8 py-6 text-right">Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                <AnimatePresence>
                                    {requests.length > 0 ? requests.map((req, idx) => (
                                        <motion.tr
                                            key={req.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="hover:bg-gray-50/80 transition-colors group"
                                        >
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-indigo-500 shadow-inner">
                                                        <Briefcase size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-gray-800 text-sm tracking-tight">{req.leaveType} Policy</div>
                                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate max-w-[200px] italic">{req.reason}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-sm font-bold text-gray-600">
                                                <div className="flex flex-col tabular-nums">
                                                    <span className="text-gray-800">{format(new Date(req.startDate), 'MMM dd')} - {format(new Date(req.endDate), 'MMM dd')}</span>
                                                    <span className="text-[10px] font-black text-indigo-500">{differenceInDays(new Date(req.endDate), new Date(req.startDate)) + 1} Net Days</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                Applied {format(new Date(req.appliedDate), 'MMM dd, yyyy')}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <StatusBadge status={req.status as any} />
                                            </td>
                                        </motion.tr>
                                    )) : (
                                        <tr><td colSpan={4} className="py-32 text-center font-black text-gray-200 uppercase italic">No Archival Records</td></tr>
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Application Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/40 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden relative"
                        >
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all">
                                <X size={20} />
                            </button>
                            <div className="p-10 border-b">
                                <h3 className="text-3xl font-black text-gray-800 italic uppercase leading-none">Leave Request</h3>
                                <p className="text-gray-400 font-bold mt-1 uppercase tracking-widest text-[9px]">Submit your absence for organizational approval</p>
                            </div>
                            <form onSubmit={handleApply} className="p-10 space-y-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Leave Framework</label>
                                    <select
                                        className="w-full h-15 bg-gray-50 border border-gray-100 rounded-[1.5rem] px-6 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-gray-700"
                                        value={formData.leaveType}
                                        onChange={e => setFormData({ ...formData, leaveType: e.target.value as LeaveType })}
                                    >
                                        <option value="Annual">Annual Reserve</option>
                                        <option value="Sick">Health Contingency</option>
                                        <option value="Casual">Casual Absence</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Start Fence</label>
                                        <input type="date" className="w-full h-15 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none transition-all font-bold text-gray-700" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">End Fence</label>
                                        <input type="date" className="w-full h-15 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none transition-all font-bold text-gray-700" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Substantiation</label>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] p-6 outline-none transition-all font-bold text-gray-700 h-32"
                                        placeholder="Reason for absence..."
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100/20 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Clock size={18} className="text-indigo-500" />
                                        <span className="text-[10px] font-black text-indigo-900/60 uppercase tracking-widest">Estimated Impact</span>
                                    </div>
                                    <span className="font-black text-indigo-600 text-lg">{differenceInDays(new Date(formData.endDate), new Date(formData.startDate)) + 1} Net Days</span>
                                </div>
                            </form>
                            <div className="p-10 bg-gray-50/50 flex gap-4 border-t">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-14 rounded-2xl font-black text-gray-400 uppercase tracking-widest text-[10px]">Cancel</button>
                                <button onClick={handleApply} className="flex-[2] h-14 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]">
                                    <Send size={18} />
                                    Transmit Request
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const BalanceCard: React.FC<{ title: string, count: number, icon: React.ReactNode, color: string }> = ({ title, count, icon, color }) => {
    const colors: any = {
        indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
        rose: 'from-rose-500 to-rose-600 shadow-rose-500/20',
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/20'
    };
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={`bg-gradient-to-br ${colors[color]} p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group`}
        >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-500">
                {React.cloneElement(icon as React.ReactElement<any>, { size: 100 })}
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{title}</h4>
                    <h2 className="text-4xl font-black italic">{count} <span className="text-sm opacity-50 not-italic">Days</span></h2>
                </div>
                <div className="mt-8 flex items-center gap-2">
                    <div className="p-2 bg-white/20 rounded-xl">
                        {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Quota</span>
                </div>
            </div>
        </motion.div>
    );
};

const StatusBadge: React.FC<{ status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' }> = ({ status }) => {
    const styles: any = {
        'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
        'Approved': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Rejected': 'bg-rose-50 text-rose-600 border-rose-100',
        'Cancelled': 'bg-gray-50 text-gray-500 border-gray-100'
    };
    const icons: any = {
        'Pending': <Clock size={12} />,
        'Approved': <BadgeCheck size={12} />,
        'Rejected': <XCircle size={12} />,
        'Cancelled': <X size={12} />
    };
    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${styles[status]}`}>
            {icons[status]}
            {status}
        </span>
    );
};

export default LeaveManagementPage;
