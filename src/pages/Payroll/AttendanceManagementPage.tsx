import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Plus,
    Upload,
    Calendar as CalendarIcon,
    List,
    BarChart3,
    X,
    Edit3,
    Trash2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Search,
    Target,
    Check
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AttendanceRecord, AttendanceStatus, AttendanceCreateInput } from '../../shared/types/attendance.types';
import { Employee, Department } from '../../shared/types/employee.types';

const ATTENDANCE_API_URL = "/v1/api/payroll/attendance";
const EMPLOYEE_API_URL = "/v1/api/payroll/employee";
const DEPARTMENT_API_URL = "/v1/api/payroll/department";

const AttendanceManagementPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'insights'>('list');
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [formData, setFormData] = useState<AttendanceCreateInput>({
        employee: { id: 0 },
        date: format(new Date(), 'yyyy-MM-dd'),
        checkInTime: '09:00',
        checkOutTime: '18:00',
        remarks: '',
        late: false,
        halfDay: false,
        absent: false
    });

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setLoading(true);
        try {
            const [empRes, deptRes, attRes] = await Promise.all([
                axios.get(`${EMPLOYEE_API_URL}/all`),
                axios.get(`${DEPARTMENT_API_URL}/listAll`),
                axios.get(`${ATTENDANCE_API_URL}/all`)
            ]);
            setEmployees(empRes.data);
            setDepartments(deptRes.data);
            setRecords(attRes.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        try {
            if (editingRecord) {
                await axios.put(`${ATTENDANCE_API_URL}/${editingRecord.id}`, formData);
            } else {
                await axios.post(ATTENDANCE_API_URL, formData);
            }
            init();
            setShowModal(false);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Strike this attendance record?")) return;
        try {
            await axios.delete(`${ATTENDANCE_API_URL}/${id}`);
            init();
        } catch (error) { console.error(error); }
    };

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const name = `${r.employee?.firstName} ${r.employee?.lastName}`.toLowerCase();
            return name.includes(search.toLowerCase()) || (r.employee?.employeeCode?.toLowerCase() ?? '').includes(search.toLowerCase());
        });
    }, [records, search]);

    const stats = useMemo(() => {
        const total = filteredRecords.length || 1;
        return {
            present: filteredRecords.filter(r => r.status === 'Present').length,
            absent: filteredRecords.filter(r => r.status === 'Absent' || r.absent).length,
            late: filteredRecords.filter(r => r.late).length,
            halfDay: filteredRecords.filter(r => r.halfDay).length,
            onTimeRate: Math.round((filteredRecords.filter(r => r.status === 'Present' && !r.late).length / total) * 100)
        };
    }, [filteredRecords]);

    return (
        <div className="attendance-mgmt-page p-6 space-y-8 bg-[#F8FAFC] min-h-screen font-sans">
            <PageMeta title="Attendance Control" description="Operational attendance and presence management" />

            <div className="flex justify-between items-end">
                <PageBreadcrumb pageTitle="Attendance Control" />
                <div className="flex gap-3">
                    <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-sm text-sm transition-all">
                        <Upload size={16} />
                        Sync Logs
                    </button>
                    <button
                        onClick={() => { setEditingRecord(null); setFormData({ ...formData, employee: { id: 0 } }); setShowModal(true); }}
                        className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm"
                    >
                        <Plus size={16} />
                        Manual Log
                    </button>
                </div>
            </div>

            {/* View Selector & Search */}
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                <div className="flex p-1 bg-gray-100/80 rounded-xl w-fit">
                    {[
                        { id: 'list', icon: <List size={14} />, label: 'List' },
                        { id: 'calendar', icon: <CalendarIcon size={14} />, label: 'Calendar' },
                        { id: 'insights', icon: <BarChart3 size={14} />, label: 'Analytics' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-6 py-2 rounded-lg font-medium text-xs transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full lg:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search records..."
                        className="w-full h-10 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl pl-10 pr-4 outline-none transition-all text-sm font-medium text-gray-700 placeholder:text-gray-400"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <InsightCard label="Present" value={stats.present.toString()} icon={<CheckCircle2 size={18} />} color="emerald" />
                <InsightCard label="Absent" value={stats.absent.toString()} icon={<XCircle size={18} />} color="rose" />
                <InsightCard label="Late" value={stats.late.toString()} icon={<Clock size={18} />} color="amber" />
                <InsightCard label="Half Day" value={stats.halfDay.toString()} icon={<AlertCircle size={18} />} color="indigo" />
                <InsightCard label="On-Time" value={`${stats.onTimeRate}%`} icon={<Target size={18} />} color="blue" />
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                <AnimatePresence mode="wait">
                    {activeTab === 'list' && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="overflow-x-auto"
                        >
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        <th className="px-6 py-4">Timeline</th>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Time Log</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {paginated(filteredRecords).length > 0 ? paginated(filteredRecords).map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-8 bg-indigo-500 rounded-full"></div>
                                                    <div>
                                                        <div className="font-medium text-gray-900 text-sm">{format(new Date(record.date), 'MMM dd, yyyy')}</div>
                                                        <div className="text-xs text-gray-400">{format(new Date(record.date), 'EEEE')}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold">
                                                        {record.employee?.firstName?.[0]}{record.employee?.lastName?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900 text-sm">{record.employee?.firstName} {record.employee?.lastName}</div>
                                                        <div className="text-xs text-indigo-500 font-medium">{record.employee?.employeeCode}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {record.checkInTime}
                                                    <span className="text-gray-300">→</span>
                                                    {record.checkOutTime || '--:--'}
                                                    <span className="ml-2 text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">{record.totalHours}h</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <PresencePill status={record.status} late={record.late} half={record.halfDay} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => { setEditingRecord(record); setShowModal(true); setFormData({ employee: { id: record.employee.id }, date: record.date, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, remarks: record.remarks || '', late: record.late, halfDay: record.halfDay, absent: record.absent }); }} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(record.id)} className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="py-20 text-center text-gray-400 text-sm italic">No records found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </motion.div>
                    )}

                    {activeTab === 'calendar' && (
                        <motion.div
                            key="calendar"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-6"
                        >
                            <div className="minimal-calendar-wrapper">
                                <FullCalendar
                                    plugins={[dayGridPlugin, interactionPlugin]}
                                    initialView="dayGridMonth"
                                    height="auto"
                                    events={records.map(r => ({
                                        title: `${r.employee?.firstName}: ${r.status}`,
                                        date: r.date,
                                        classNames: [`event-${r.status.replace(/\s+/g, '-').toLowerCase()}`]
                                    }))}
                                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'insights' && (
                        <motion.div
                            key="insights"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 space-y-8"
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <InsightChart title="Volume Frequency" subtitle="Daily presence traffic volume">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData(records)}>
                                            <defs>
                                                <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }} />
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                            <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorVis)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </InsightChart>

                                <InsightChart title="Impact Distribution" subtitle="Status share categorization">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: 'Present', val: stats.present, color: '#10b981' },
                                            { name: 'Absent', val: stats.absent, color: '#f43f5e' },
                                            { name: 'Late', val: stats.late, color: '#f59e0b' },
                                            { name: 'Half Day', val: stats.halfDay, color: '#6366f1' },
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }} />
                                            <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                            <Bar dataKey="val" radius={[4, 4, 0, 0]} barSize={40}>
                                                {[0, 1, 2, 3].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={['#10b981', '#f43f5e', '#f59e0b', '#6366f1'][index]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </InsightChart>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Manual Correction Modal */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden relative"
                        >
                            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                <X size={18} />
                            </button>
                            <div className="p-8 border-b border-gray-100">
                                <h3 className="text-xl font-bold text-gray-900">Manual Adjustment</h3>
                                <p className="text-sm text-gray-500 mt-1">Override or add attendance logs manually.</p>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee</label>
                                    <select
                                        className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-4 outline-none focus:border-indigo-500 transition-colors text-sm font-medium text-gray-700"
                                        value={formData.employee.id}
                                        onChange={(e) => setFormData({ ...formData, employee: { id: +e.target.value } })}
                                    >
                                        <option value={0}>Select Employee...</option>
                                        {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({e.employeeCode})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
                                    <input type="date" className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-4 outline-none focus:border-indigo-500 transition-colors text-sm font-medium text-gray-700" value={formData.date ?? ''} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Punch In</label>
                                        <input type="time" className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-4 outline-none focus:border-indigo-500 transition-colors text-sm font-medium text-gray-700" value={formData.checkInTime ?? ''} onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Punch Out</label>
                                        <input type="time" className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-4 outline-none focus:border-indigo-500 transition-colors text-sm font-medium text-gray-700" value={formData.checkOutTime ?? ''} onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <FlagToggle label="Late" active={formData.late} onToggle={(v) => setFormData({ ...formData, late: v })} color="amber" />
                                    <FlagToggle label="Half Day" active={formData.halfDay} onToggle={(v) => setFormData({ ...formData, halfDay: v })} color="indigo" />
                                    <FlagToggle label="Absent" active={formData.absent} onToggle={(v) => setFormData({ ...formData, absent: v })} color="rose" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Adjustment Remarks</label>
                                    <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 outline-none focus:border-indigo-500 transition-colors text-sm font-medium text-gray-700 h-24 resize-none" placeholder="Reason for change..." value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}></textarea>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 flex gap-4 border-t border-gray-100">
                                <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-semibold text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
                                <button onClick={handleAction} className="flex-[2] py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold transition-all shadow-md flex items-center justify-center gap-2 text-sm">
                                    <Check size={16} />
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .minimal-calendar-wrapper .fc { font-family: inherit; border: none; }
                .minimal-calendar-wrapper .fc-toolbar-title { font-weight: 700; font-size: 1.25rem; color: #1e293b; }
                .minimal-calendar-wrapper .fc-button { background: white; border: 1px solid #e2e8f0; color: #475569; font-weight: 500; font-size: 0.875rem; padding: 6px 12px; border-radius: 8px; text-transform: capitalize; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
                .minimal-calendar-wrapper .fc-button:hover { background: #f8fafc; color: #1e293b; }
                .minimal-calendar-wrapper .fc-button-active { background: #1e293b !important; color: white !important; border-color: #1e293b !important; }
                .minimal-calendar-wrapper .fc-daygrid-day { border: 1px solid #f1f5f9; }
                .minimal-calendar-wrapper .fc-col-header-cell { padding: 8px 0; background: #f8fafc; border-color: #f1f5f9; }
                .minimal-calendar-wrapper .fc-day-today { background: #eff6ff !important; }
                .minimal-calendar-wrapper .fc-event { border: none; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px; margin-top: 2px; }
                .event-present { background: #ecfdf5; color: #059669; }
                .event-absent { background: #fff1f2; color: #e11d48; }
                .event-late { background: #fffbeb; color: #d97706; }
                .event-half-day { background: #eef2ff; color: #4f46e5; }
            `}</style>
        </div>
    );
};

const InsightCard: React.FC<{ label: string, value: string, icon: React.ReactNode, color: string }> = ({ label, value, icon, color }) => {
    const colors: any = {
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600',
        amber: 'bg-amber-50 text-amber-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        blue: 'bg-blue-50 text-blue-600'
    };
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
            <div className={`p-3 rounded-xl ${colors[color]}`}>
                {icon}
            </div>
            <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                <h3 className="text-xl font-bold text-gray-900 leading-tight">{value}</h3>
            </div>
        </div>
    );
};

const PresencePill: React.FC<{ status: AttendanceStatus, late: boolean, half: boolean }> = ({ status, late, half }) => {
    if (status === 'Absent') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-100">Absent</span>;
    return (
        <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">Present</span>
            {late && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">Late</span>}
            {half && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">Half</span>}
        </div>
    );
};

const FlagToggle: React.FC<{ label: string, active: boolean, onToggle: (v: boolean) => void, color: string }> = ({ label, active, onToggle, color }) => {
    const colors: any = {
        amber: 'bg-amber-500 text-white shadow-amber-200',
        indigo: 'bg-indigo-600 text-white shadow-indigo-200',
        rose: 'bg-rose-500 text-white shadow-rose-200'
    };
    return (
        <button
            type="button"
            onClick={() => onToggle(!active)}
            className={`flex-1 h-10 rounded-lg border transition-all flex items-center justify-center gap-2 font-semibold text-xs transition-all ${active ? `${colors[color]} border-transparent shadow-md` : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
        >
            {active && <Check size={14} />}
            {label}
        </button>
    );
};

const InsightChart: React.FC<{ title: string, subtitle: string, children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="space-y-4">
        <div>
            <h4 className="text-lg font-bold text-gray-900">{title}</h4>
            <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
        </div>
        <div className="h-72 bg-gray-50/50 rounded-2xl border border-gray-100 p-6">
            {children}
        </div>
    </div>
);

const paginated = (list: any[]) => list.slice(0, 10);
const chartData = (recs: AttendanceRecord[]) => recs.slice(-7).map(r => ({ date: format(new Date(r.date), 'MM/dd'), present: r.status === 'Present' ? 1 : 0 }));

export default AttendanceManagementPage;
