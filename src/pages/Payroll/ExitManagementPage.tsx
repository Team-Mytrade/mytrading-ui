import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ExitManagementService, ExitRequest } from '../../Services/ExitManagementService';
import { LogOut, CheckCircle2 } from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AuthContext } from '../../context/AuthContext';
import { Employee } from '../../shared/types/employee.types';
import { ToasterService } from '../../Services/ToasterService';

interface OffboardingTask {
    id: number;
    title: string;
    description: string;
    status: 'Pending' | 'Completed';
    category: 'IT' | 'Admin' | 'HR' | 'Finance';
}

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";

const EXIT_REASONS = [
    'Transfer/Inter Company Movement/India',
    'Involuntary/Disciplinary/Not Served Notice Period',
    'Contract/Contract Termination',
    'Contract/Internship Termination',
    'Involuntary/Deceased',
    'Voluntary/No projects',
    'Better Career Opportunity',
    'Personal / Family Reasons',
    'Higher Studies',
    'Relocation',
    'Health Issues',
    'Other'
];

const ExitManagementPage: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const [resignation, setResignation] = useState<ExitRequest | null>(null);
    const [tasks, setTasks] = useState<OffboardingTask[]>([
        { id: 1, title: 'Asset Return', description: 'Return laptop, charger, and access cards to IT.', status: 'Pending', category: 'IT' },
        { id: 2, title: 'Knowledge Transfer', description: 'Complete documentation for current projects.', status: 'Pending', category: 'HR' },
        { id: 3, title: 'Finance Clearance', description: 'Settle all pending reimbursements.', status: 'Pending', category: 'Finance' },
        { id: 4, title: 'ID Deactivation', description: 'Disable company email and app access.', status: 'Pending', category: 'IT' },
    ]);

    const [isResigning, setIsResigning] = useState(false);
    const [formData, setFormData] = useState<{
        resignationDate: Date;
        noticePeriod: number;
        reason: string;
        proposedLWD: Date | null;
        comment: string;
        attachment: File | null;
    }>({
        resignationDate: new Date(),
        noticePeriod: 90,
        reason: '',
        proposedLWD: null,
        comment: '',
        attachment: null,
    });

    const calculatedLWD = useMemo(() => {
        if (!formData.resignationDate) return null;
        const d = new Date(formData.resignationDate);
        d.setDate(d.getDate() + (Number(formData.noticePeriod) || 0));
        return d;
    }, [formData.resignationDate, formData.noticePeriod]);

    const calculatedDayName = useMemo(() => {
        if (!calculatedLWD) return '';
        return calculatedLWD.toLocaleDateString('en-US', { weekday: 'long' });
    }, [calculatedLWD]);

    useEffect(() => {
        if (user) resolveEmployee();
    }, [user]);

    const resolveEmployee = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
            const match = res.data.find((emp: any) =>
                emp.officialEmail?.toLowerCase() === user?.email?.toLowerCase() ||
                `${emp.firstName} ${emp.lastName}`.toLowerCase() === user?.fullName?.toLowerCase()
            );
            const empId = match?.id || null;
            setResolvedEmployeeId(empId);
            if (empId) {
                await fetchExitRequest(empId);
            }
        } catch (error) {
            console.error("Failed to resolve employee", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchExitRequest = async (empId: number) => {
        try {
            const data = await ExitManagementService.getExitRequestByEmployeeId(empId);
            if (data && data.length > 0) {
                // Find the active resignation (not REVERTED / rejected) or the most recent one
                const activeRes = data.find(r => r.status !== 'REJECTED' && (r.status as string) !== 'REVERTED' && r.status !== 'WITHDRAW_APPROVED') || data[data.length - 1];
                setResignation(activeRes);
            } else {
                setResignation(null);
            }
        } catch (error) {
            console.error("Failed to fetch exit request", error);
        }
    };

    const handleResignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.reason.trim()) {
            ToasterService.error("Please select a reason for leaving.");
            return;
        }

        const effectiveLWD = formData.proposedLWD || calculatedLWD;
        if (!effectiveLWD) {
            ToasterService.error("Please select your proposed last working day.");
            return;
        }

        if (!resolvedEmployeeId) {
            ToasterService.error("No employee record found for your account.", "You cannot submit a resignation.");
            return;
        }
        setLoading(true);
        
        try {
            const payload = {
                resignationDate: formData.resignationDate ? formData.resignationDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                lastWorkingDay: effectiveLWD.toISOString().split('T')[0],
                reason: formData.reason + (formData.comment.trim() ? ` - ${formData.comment.trim()}` : ''),
                noticePeriod: Number(formData.noticePeriod) || 90,
                status: 'SUBMITTED' as const,
                employeeId: resolvedEmployeeId,
            };
            const result = await ExitManagementService.submitExitRequest(payload);
            setResignation(result);
            setIsResigning(false);
            ToasterService.success("Resignation request submitted successfully");
        } catch (error) {
            console.error("Failed to submit exit request", error);
            ToasterService.error("Failed to submit resignation request", "Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!resolvedEmployeeId || !resignation) return;
        setLoading(true);
        
        try {
            const updated = await ExitManagementService.updateExitDetails({
                id: resignation.id,
                employeeId: resolvedEmployeeId,
                status: 'WITHDRAW_REQUESTED' as any,
                resignationDate: resignation.resignationDate,
                lastWorkingDay: resignation.lastWorkingDay,
                reason: resignation.reason
            });
            setResignation(updated);
            ToasterService.success("Resignation withdrawal requested successfully");
        } catch (error) {
            console.error("Failed to withdraw resignation", error);
            ToasterService.error("Failed to request resignation withdrawal", "Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const toggleTask = (id: number) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === 'Pending' ? 'Completed' : 'Pending' } : t));
    };

    return (
        <>
            <PageMeta title="Exit Management" description="Manage your resignation and offboarding" />
            <PageBreadcrumb pageTitle="Exit Management" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-4 space-y-3 sm:space-y-4">

            {!resignation && !isResigning ? (
                <div className="bg-white dark:bg-[#191919] p-6 sm:p-8 rounded-xl border border-gray-200 dark:border-transparent shadow-sm text-center max-w-lg mx-auto mt-4">
                    <LogOut className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Initiate Resignation</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Submit a request to begin your offboarding process.
                    </p>
                    <button
                        onClick={() => setIsResigning(true)}
                        className="mt-5 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                    >
                        Start Process
                    </button>
                </div>
            ) : isResigning ? (
                <div className="bg-white dark:bg-[#191919] p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-transparent shadow-sm max-w-3xl mx-auto max-h-[calc(100vh-140px)] overflow-y-auto">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2 mb-3">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Resignation Form</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Initiate offboarding request and select separation details</p>
                        </div>
                    </div>

                    <form onSubmit={handleResignSubmit} className="space-y-3">
                        {/* Row 1: Resignation Request Date, Notice Period, and Calculated LWD */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Resignation Request Date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    selected={formData.resignationDate}
                                    onChange={(date: Date | null) => setFormData({ ...formData, resignationDate: date || new Date() })}
                                    className="w-full border border-gray-300 dark:border-[#303030] bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    wrapperClassName="w-full"
                                    dateFormat="dd/MM/yyyy"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Notice Period (In Days) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    required
                                    value={formData.noticePeriod}
                                    onChange={e => setFormData({ ...formData, noticePeriod: Math.max(0, Number(e.target.value)) })}
                                    className="w-full border border-gray-300 dark:border-[#303030] bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none font-mono"
                                    placeholder="90"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Calculated LWD
                                </label>
                                <div className="flex items-center justify-between border border-gray-200 dark:border-transparent bg-gray-50/80 dark:bg-[#222222] rounded-md py-1.5 px-2.5 text-xs h-[33px]">
                                    <span className="font-semibold text-gray-900 dark:text-white font-mono text-xs">
                                        {calculatedLWD ? calculatedLWD.toLocaleDateString('en-GB') : '-'}
                                    </span>
                                    <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 px-1.5 py-0.5 rounded">
                                        {calculatedDayName}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Reason & Proposed Last Working Day in 2 Columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.reason}
                                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full border border-gray-300 dark:border-[#303030] rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none bg-white dark:bg-[#222222] text-gray-900 dark:text-white cursor-pointer"
                                >
                                    <option value="">Select a reason...</option>
                                    {EXIT_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Proposed Last Working Day (Proposed LWD) <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    selected={formData.proposedLWD || calculatedLWD}
                                    onChange={(date: Date | null) => setFormData({ ...formData, proposedLWD: date })}
                                    className="w-full border border-gray-300 dark:border-[#303030] bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                                    wrapperClassName="w-full"
                                    dateFormat="dd/MM/yyyy"
                                    placeholderText="Select a date"
                                    minDate={formData.resignationDate}
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 3: Comment & Attachment in 2 Columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Comment <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    className="w-full border border-gray-300 dark:border-[#303030] bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-md p-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none h-[62px]"
                                    placeholder="Enter detailed comments or handover details..."
                                    value={formData.comment}
                                    onChange={e => setFormData({ ...formData, comment: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                    Attachment <span className="text-gray-400 font-normal">(Optional)</span>
                                </label>
                                <div className="flex items-center justify-center border border-dashed border-gray-300 dark:border-[#303030] rounded-md px-3 h-[62px] hover:border-cyan-500 transition-colors bg-gray-50/40 dark:bg-[#222222] relative group">
                                    <input
                                        type="file"
                                        id="exit-attachment"
                                        onChange={e => setFormData({ ...formData, attachment: e.target.files?.[0] || null })}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                    <div className="text-center pointer-events-none">
                                        <div className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[260px]">
                                            {formData.attachment ? (
                                                <span className="font-semibold text-cyan-700 dark:text-cyan-300">{formData.attachment.name}</span>
                                            ) : (
                                                <span className="text-gray-500 dark:text-gray-400">
                                                    <span className="text-cyan-600 dark:text-cyan-400 font-semibold underline mr-1 group-hover:text-cyan-700">Upload file</span>
                                                    or drag & drop
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">PDF, DOC, DOCX, PNG (Max 5MB)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 4: Action Buttons */}
                        <div className="flex justify-end items-center gap-2.5 pt-2 border-t border-gray-100 dark:border-[#2a2a2a]">
                            <button
                                type="button"
                                onClick={() => setIsResigning(false)}
                                className="px-4 py-1.5 border border-gray-300 dark:border-transparent bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-bold hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 transition-colors flex items-center justify-center min-w-[120px] shadow-sm disabled:opacity-60"
                            >
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Status & Summary */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-[#191919] p-6 rounded-lg border border-gray-200 dark:border-transparent shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Request Status</h3>
                            <div className="flex items-center gap-3 mb-6">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                    resignation?.status === 'APPROVED' ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300' :
                                    resignation?.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300' :
                                    'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300'
                                }`}>
                                    {resignation?.status}
                                </span>
                            </div>
                            
                            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Applied On</span>
                                    <span>{(resignation as any)?.submissionDate || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Notice Period</span>
                                    <span>{(resignation as any)?.noticePeriod || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Last Working Day</span>
                                    <span>{resignation?.lastWorkingDay || '-'}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleWithdraw}
                                disabled={loading || (resignation as any)?.status === 'WITHDRAW_REQUESTED'}
                                className="w-full mt-6 px-4 py-2 border border-gray-300 dark:border-transparent bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {(resignation as any)?.status === 'WITHDRAW_REQUESTED' ? 'Pending Approval' : 'Withdraw Resignation'}
                            </button>
                        </div>
                    </div>

                    {/* Clearance Tasks */}
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-[#191919] p-6 rounded-lg border border-gray-200 dark:border-transparent shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clearance Tasks</h3>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    {tasks.filter(t => t.status === 'Completed').length} of {tasks.length} Completed
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {tasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        className="flex items-start gap-4 p-4 border border-gray-100 dark:border-[#2a2a2a] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors"
                                    >
                                        <div className={`mt-0.5 ${task.status === 'Completed' ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className={`font-medium ${task.status === 'Completed' ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                                    {task.title}
                                                </h4>
                                                <span className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-[#222222] text-gray-600 dark:text-gray-300 rounded">
                                                    {task.category}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{task.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </>
    );
};

export default ExitManagementPage;
