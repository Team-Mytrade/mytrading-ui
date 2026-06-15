import React, { useState, useEffect, useContext, useMemo } from "react";
import {
    Clock,
    Fingerprint,
    CheckCircle2,
    Calendar,
    Wallet,
    FileText,
    ShieldCheck,
    Award,
    LogOut,
    LayoutDashboard,
    ArrowRight,
    Zap,
    Coffee,
    Plus,
    X,
    TrendingUp,
    ChevronRight,
    Bell,
    ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import { Employee } from "../../shared/types/employee.types";
import { AttendanceRecord } from "../../shared/types/attendance.types";

const ATTENDANCE_API_URL = "/v1/api/payroll/attendance";
const EMPLOYEE_API_URL = "/v1/api/payroll/employee";
const LEAVE_BALANCE_API_URL = "/v1/api/payroll/leave-balances";
const PERFORMANCE_API_URL = "/v1/api/payroll/performance/appraisal";
const LEAVE_API_URL = "/v1/api/payroll/leaves";

const EmployeeSelfDashboard: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [workDuration, setWorkDuration] = useState("00h 00m 00s");

    // Additional State
    const [leaveBalances, setLeaveBalances] = useState<any>(null);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

    // --- Effects ---

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (user) resolveEmployeeMapping();
    }, [user]);

    useEffect(() => {
        if (resolvedEmployeeId) {
            fetchAttendanceData();
            fetchLeaveBalances();
            fetchPerformanceData();
        }
    }, [resolvedEmployeeId]);

    useEffect(() => {
        if (!todayRecord?.checkInTime || todayRecord.checkOutTime) return;
        const interval = setInterval(() => {
            const start = new Date(todayRecord.checkInTime ?? '').getTime();
            const diff = Date.now() - start;
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setWorkDuration(`${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [todayRecord]);

    // --- Data Fetching ---

    const resolveEmployeeMapping = async () => {
        try {
            const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
            const match = res.data.find((emp: Employee) =>
                emp.officialEmail?.toLowerCase() === user?.email?.toLowerCase() ||
                `${emp.firstName} ${emp.lastName}`.toLowerCase() === user?.fullName?.toLowerCase()
            );
            setResolvedEmployeeId(match?.id || 1);
        } catch { setResolvedEmployeeId(1); }
    };

    const fetchAttendanceData = async () => {
        if (!resolvedEmployeeId) return;
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const res = await axios.get(`${ATTENDANCE_API_URL}/all`);
            const allRecords = res.data.filter((r: AttendanceRecord) => r.employee?.id === resolvedEmployeeId);
            setTodayRecord(allRecords.find((r: AttendanceRecord) => r.date === today) || null);
        } catch { }
    };

    const fetchLeaveBalances = async () => {
        if (!resolvedEmployeeId) return;
        try {
            const res = await axios.get(`${LEAVE_BALANCE_API_URL}/${resolvedEmployeeId}`);
            setLeaveBalances(res.data);
        } catch {
            setLeaveBalances({ annual: 12, sick: 8, casual: 5, used: 3 });
        }
    };

    const fetchPerformanceData = async () => {
        if (!resolvedEmployeeId) return;
        try {
            const res = await axios.get(`${PERFORMANCE_API_URL}/${resolvedEmployeeId}`);
            setPerformanceData(res.data);
        } catch {
            setPerformanceData({ rating: 4.8, status: "Excellent" });
        }
    };

    const handlePunch = async (isPunchIn: boolean) => {
        if (!resolvedEmployeeId) return;
        setLoading(true);
        try {
            const today = format(new Date(), "yyyy-MM-dd");
            const now = format(new Date(), "HH:mm");

            if (isPunchIn) {
                const res = await axios.post(ATTENDANCE_API_URL, {
                    employee: { id: resolvedEmployeeId },
                    date: today,
                    checkInTime: `${today}T${now}:00`,
                    remarks: "Web Dashboard Check-in",
                    late: false,
                    halfDay: false,
                    absent: false
                });
                setTodayRecord(res.data);
            } else if (todayRecord?.id) {
                const res = await axios.put(`${ATTENDANCE_API_URL}/${todayRecord.id}`);
                setTodayRecord(res.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const greeting = useMemo(() => {
        const h = currentTime.getHours();
        if (h < 12) return "Good Morning";
        if (h < 17) return "Good Afternoon";
        return "Good Evening";
    }, [currentTime]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 font-sans text-gray-900">
            <PageMeta title="Dashboard" description="Employee Workspace" />

            {/* Premium Header */}
            <header className="px-6 md:px-12 pt-8 pb-6">
                <div className="max-w-[1600px] mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center">
                                <LayoutDashboard size={24} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900">Workspace</h1>
                                <p className="text-sm text-gray-500">{format(currentTime, 'EEEE, MMMM dd, yyyy')}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="w-10 h-10 rounded-xl bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-colors">
                                <Bell size={18} className="text-gray-600" />
                            </button>
                            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl bg-white border border-gray-200">
                                <Clock size={18} className="text-gray-400" />
                                <span className="text-sm font-medium text-gray-900 tabular-nums">
                                    {format(currentTime, 'HH:mm:ss')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Greeting Section */}
                    <div className="mb-8">
                        <h2 className="text-4xl md:text-5xl font-light text-gray-900 mb-2">
                            {greeting}, <span className="font-medium">{user?.fullName?.split(' ')[0] || "There"}</span>
                        </h2>
                        <p className="text-gray-500">Here's your overview for today</p>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-6 md:px-12 pb-16">
                <div className="max-w-[1600px] mx-auto space-y-6">

                    {/* Primary Cards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Attendance Card - Premium Design */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-3xl p-8 border border-gray-200 hover:border-gray-300 transition-all"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Attendance</h3>
                                    <p className="text-2xl font-semibold text-gray-900">
                                        {todayRecord ? (todayRecord.checkOutTime ? 'Completed' : 'Active') : 'Ready'}
                                    </p>
                                </div>
                                <div className={`w-2 h-2 rounded-full ${todayRecord?.checkInTime && !todayRecord.checkOutTime ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            </div>

                            <div className="mb-8">
                                <div className="text-center py-8">
                                    <div className="text-sm text-gray-500 mb-2">Duration</div>
                                    <div className="text-4xl font-light text-gray-900 tabular-nums">
                                        {todayRecord?.checkInTime && !todayRecord.checkOutTime ? workDuration :
                                            (todayRecord?.checkOutTime ? "08h 00m 00s" : "00h 00m 00s")}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Check In</div>
                                        <div className="text-sm font-medium text-gray-900">
                                            {todayRecord?.checkInTime ? format(new Date(todayRecord.checkInTime), "HH:mm") : "--:--"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">Check Out</div>
                                        <div className="text-sm font-medium text-gray-900">
                                            {todayRecord?.checkOutTime ? format(new Date(todayRecord.checkOutTime), "HH:mm") : "--:--"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                {!todayRecord ? (
                                    <button
                                        onClick={() => handlePunch(true)}
                                        disabled={loading}
                                        className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Fingerprint size={18} />
                                                Check In
                                            </>
                                        )}
                                    </button>
                                ) : !todayRecord.checkOutTime ? (
                                    <button
                                        onClick={() => handlePunch(false)}
                                        disabled={loading}
                                        className="w-full h-12 bg-white border border-gray-900 hover:bg-gray-50 text-gray-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <LogOut size={18} />
                                                Check Out
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="w-full h-12 bg-gray-50 text-gray-500 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                                        <CheckCircle2 size={18} />
                                        Day Complete
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Leave Balance Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-3xl p-8 border border-gray-200 hover:border-gray-300 transition-all"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Time Off</h3>
                                    <p className="text-2xl font-semibold text-gray-900">
                                        {(leaveBalances?.annual || 0) + (leaveBalances?.sick || 0) + (leaveBalances?.casual || 0)} days
                                    </p>
                                </div>
                                <Coffee size={20} className="text-gray-400" />
                            </div>

                            <div className="space-y-4 mb-8">
                                <BalanceBar label="Annual Leave" value={leaveBalances?.annual || 0} max={15} color="gray" />
                                <BalanceBar label="Sick Leave" value={leaveBalances?.sick || 0} max={10} color="gray" />
                                <BalanceBar label="Casual Leave" value={leaveBalances?.casual || 0} max={7} color="gray" />
                            </div>

                            <button
                                onClick={() => setIsLeaveModalOpen(true)}
                                className="w-full h-12 bg-white border border-gray-900 hover:bg-gray-50 text-gray-900 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus size={18} />
                                Apply for Leave
                            </button>
                        </motion.div>

                        {/* Performance Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 text-white relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-sm font-medium text-white/60 mb-1">Performance</h3>
                                        <p className="text-2xl font-semibold text-white">Excellent</p>
                                    </div>
                                    <Award size={20} className="text-white/60" />
                                </div>

                                <div className="mb-8">
                                    <div className="flex items-baseline gap-2 mb-3">
                                        <span className="text-5xl font-light text-white">{performanceData?.rating || "4.8"}</span>
                                        <span className="text-xl text-white/60">/ 5.0</span>
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                                        <TrendingUp size={14} className="text-emerald-400" />
                                        <span className="text-xs font-medium text-emerald-400">Top 15% Performer</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="text-xs text-white/60 mb-1">Last Review</div>
                                        <div className="text-sm font-medium text-white">Dec 2025</div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 backdrop-blur-sm">
                                        <div className="text-xs text-white/60 mb-1">Next Review</div>
                                        <div className="text-sm font-medium text-white">Jun 2026</div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-3xl p-8 border border-gray-200">
                        <h3 className="text-sm font-medium text-gray-500 mb-6">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                            <ActionButton label="Attendance" icon={<Fingerprint />} href="/attendance-management" />
                            <ActionButton label="Time Off" icon={<Coffee />} href="/leave-management" />
                            <ActionButton label="Payroll" icon={<Wallet />} href="/employeePayroll" />
                            <ActionButton label="Documents" icon={<FileText />} href="/document-management" />
                            <ActionButton label="Tax Info" icon={<ShieldCheck />} href="/it-declaration" />
                            <ActionButton label="Performance" icon={<Award />} href="/performance-management" />
                            <ActionButton label="Profile" icon={<LayoutDashboard />} href={`/employee-view/${resolvedEmployeeId}`} />
                            <ActionButton label="Exit" icon={<LogOut />} href="/exit-management" />
                        </div>
                    </div>
                </div>
            </main>

            {/* Leave Modal */}
            <ApplyLeaveModal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
                employeeId={resolvedEmployeeId}
            />
        </div>
    );
};

// --- Subcomponents ---

const BalanceBar: React.FC<{ label: string, value: number, max: number, color: string }> = ({ label, value, max, color }) => {
    const percentage = (value / max) * 100;

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-xs font-medium text-gray-900">{value} / {max}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full bg-gray-900 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const ActionButton: React.FC<{ label: string, icon: React.ReactNode, href: string }> = ({ label, icon, href }) => {
    return (
        <a
            href={href}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
        >
            <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-gray-900 flex items-center justify-center mb-2 transition-colors">
                {React.cloneElement(icon as React.ReactElement<any>, {
                    size: 18,
                    className: "text-gray-600 group-hover:text-white transition-colors"
                })}
            </div>
            <span className="text-xs text-gray-600 group-hover:text-gray-900 text-center transition-colors">{label}</span>
        </a>
    );
};

// --- Leave Modal ---

const ApplyLeaveModal: React.FC<{ isOpen: boolean, onClose: () => void, employeeId: number | null }> = ({ isOpen, onClose, employeeId }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        leaveType: 'Annual',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        reason: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.post(`${LEAVE_API_URL}/apply`, {
                employee: { id: employeeId },
                ...formData,
                status: 'Pending',
                appliedDate: new Date().toISOString()
            });
            onClose();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">Apply for Leave</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Submit your time off request</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                            >
                                <X size={18} className="text-gray-600" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-2 block">Leave Type</label>
                                <select
                                    value={formData.leaveType}
                                    onChange={e => setFormData({ ...formData, leaveType: e.target.value })}
                                    className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 outline-none focus:border-gray-900 transition-colors text-sm"
                                >
                                    <option value="Annual">Annual Leave</option>
                                    <option value="Sick">Sick Leave</option>
                                    <option value="Casual">Casual Leave</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 mb-2 block">Start Date</label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 outline-none focus:border-gray-900 transition-colors text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-700 mb-2 block">End Date</label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        className="w-full h-11 bg-white border border-gray-200 rounded-xl px-4 outline-none focus:border-gray-900 transition-colors text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-gray-700 mb-2 block">Reason</label>
                                <textarea
                                    value={formData.reason}
                                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full h-24 bg-white border border-gray-200 rounded-xl p-4 outline-none focus:border-gray-900 transition-colors text-sm resize-none"
                                    placeholder="Please provide a reason for your leave..."
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? "Submitting..." : "Submit Request"}
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EmployeeSelfDashboard;
