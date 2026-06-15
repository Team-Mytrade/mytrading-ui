import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import {
    Target,
    TrendingUp,
    Award,
    Star,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    Download,
    Clock,
    ArrowRight,
    Filter,
    ShieldCheck
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AuthContext } from '../../context/AuthContext';
import { Employee } from '../../shared/types/employee.types';
import { format } from 'date-fns';

interface KPI {
    id: number;
    title: string;
    progress: number;
    target: string;
    category: string;
}

interface Appraisal {
    id: number;
    period: string;
    date: string;
    rating: number;
    manager: string;
    feedback: string;
    status: 'Completed' | 'Pending';
}

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";

const PerformanceManagementPage: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Mock Data for Premium UI
    const kpis: KPI[] = [
        { id: 1, title: 'Project Velocity', progress: 92, target: '95%', category: 'Efficiency' },
        { id: 2, title: 'Code Reliability', progress: 85, target: '90%', category: 'Quality' },
        { id: 3, title: 'Stakeholder Satisfaction', progress: 78, target: '80%', category: 'Productivity' }
    ];

    const appraisals: Appraisal[] = [
        { id: 1, period: 'Annual Review 2023', date: '2023-12-15', rating: 4.8, manager: 'Sarah Johnson', feedback: 'Outstanding contribution to the core trading engine refactor. Excellent leadership during the Q4 crunch.', status: 'Completed' },
        { id: 2, period: 'Mid-Year Review 2023', date: '2023-06-20', rating: 4.5, manager: 'Sarah Johnson', feedback: 'Solid performance. Suggest focusing on unit test coverage for new modules.', status: 'Completed' }
    ];

    const trendData = [
        { name: 'Jan', rating: 4.2 }, { name: 'Mar', rating: 4.3 }, { name: 'May', rating: 4.5 },
        { name: 'Jul', rating: 4.4 }, { name: 'Sep', rating: 4.6 }, { name: 'Nov', rating: 4.8 },
    ];

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

    return (
        <div className="performance-mgmt-page p-6 space-y-8 bg-[#F8FAFC] min-h-screen font-sans">
            <PageMeta title="Performance Hub" description="Track goals, KPIs and professional appraisals" />

            <div className="flex justify-between items-end">
                <PageBreadcrumb pageTitle="Performance Hub" />
                <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm text-sm">
                    <Download size={16} />
                    Export Report
                </button>
            </div>

            {/* Rating & Velocity Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <InsightCard label="Aggregate Rating" value="4.8" icon={<Star size={20} />} color="amber" trend="up" />
                <InsightCard label="Goals Reached" value="12/15" icon={<Target size={20} />} color="indigo" trend="up" />
                <InsightCard label="Active Sprint" value="PROD-04" icon={<Zap size={20} />} color="emerald" trend="stable" />
                <InsightCard label="Skill Quotient" value="94%" icon={<Award size={20} />} color="rose" trend="up" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main: KPI Trackers & Trends */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Goal Navigator */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Goal Navigator</h3>
                                <p className="text-sm text-gray-500 mt-1">Real-time tracking of individual key performance indicators</p>
                            </div>
                            <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
                                <Filter size={18} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            {kpis.map((kpi, idx) => (
                                <KPITracker key={kpi.id} kpi={kpi} idx={idx} />
                            ))}
                        </div>
                    </div>

                    {/* Performance Trend */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Growth Trajectory</h3>
                            <button className="text-gray-400 hover:text-indigo-600 transition-colors">
                                <TrendingUp size={18} />
                            </button>
                        </div>
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <YAxis hide domain={[0, 6]} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                                        itemStyle={{ color: '#1E293B', fontWeight: 600 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="rating"
                                        stroke="#6366f1"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRating)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Sidebar: Appraisals & Rewards */}
                <div className="lg:col-span-4 space-y-8">
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-lg font-bold text-gray-900">Appraisal Log</h3>
                            <Clock size={18} className="text-gray-400" />
                        </div>

                        <div className="space-y-8 flex-1">
                            {appraisals.map((app) => (
                                <motion.div
                                    key={app.id}
                                    whileHover={{ x: 4 }}
                                    className="relative pl-6 border-l-2 border-gray-100 space-y-2 group"
                                >
                                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-500 group-hover:scale-110 transition-all"></div>
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{format(new Date(app.date), 'MMM yyyy')}</span>
                                        <span className="bg-gray-50 text-gray-700 px-2.5 py-0.5 rounded-md text-xs font-semibold border border-gray-100">{app.rating}/5</span>
                                    </div>
                                    <h4 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{app.period}</h4>
                                    <p className="text-sm text-gray-500 leading-relaxed">"{app.feedback}"</p>
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400 mt-2">
                                        <ShieldCheck size={12} /> Verified by {app.manager}
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-50">
                            <div className="p-6 bg-slate-900 rounded-2xl text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Award size={64} />
                                </div>
                                <h4 className="text-lg font-semibold">Senior Path 80%</h4>
                                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">Next Milestone: Q4 Review</p>
                                <button className="mt-6 w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2">
                                    View Roadmap <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InsightCard: React.FC<{ label: string, value: string, icon: React.ReactNode, color: string, trend: 'up' | 'down' | 'stable' }> = ({ label, value, icon, color, trend }) => {
    const colors: any = {
        amber: 'bg-amber-50 text-amber-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600'
    };
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className={`p-3 rounded-xl ${colors[color]}`}>
                {icon}
            </div>
            <div className="flex-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{label}</span>
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900 leading-none">{value}</h3>
                    {trend !== 'stable' && (
                        <span className={`flex items-center text-[10px] font-bold ${trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'} px-1.5 py-0.5 rounded`}>
                            {trend === 'up' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {trend === 'up' ? '+2.4%' : '-1.2%'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const KPITracker: React.FC<{ kpi: KPI, idx: number }> = ({ kpi, idx }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.1 }}
        className="space-y-3"
    >
        <div className="flex justify-between items-end">
            <div>
                <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wide block mb-1">{kpi.category}</span>
                <h4 className="text-sm font-bold text-gray-700 leading-none">{kpi.title}</h4>
            </div>
            <div className="text-right">
                <span className="text-lg font-bold text-gray-900 leading-none tabular-nums">{kpi.progress}%</span>
                <span className="text-xs font-medium text-gray-400 block mt-0.5">Target {kpi.target}</span>
            </div>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${kpi.progress}%` }}
                className={`h-full ${kpi.progress > 85 ? 'bg-emerald-500' : 'bg-indigo-500'} rounded-full transition-all duration-1000 ease-out`}
            />
        </div>
    </motion.div>
);



export default PerformanceManagementPage;
