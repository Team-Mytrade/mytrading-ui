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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">

            {!resignation && !isResigning ? (
                <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm text-center">
                    <LogOut className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-900">Initiate Resignation</h2>
                    <p className="text-gray-500 mt-2 max-w-md mx-auto">
                        Submit a request to begin your offboarding process.
                    </p>
                    <button
                        onClick={() => setIsResigning(true)}
                        className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
                    >
                        Start Process
                    </button>
                </div>
            ) : isResigning ? (
                <div className="bg-white p-5 sm:p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3.5">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-none">Resignation Form</h3>
                            <p className="text-xs text-gray-500 mt-1">Initiate offboarding request and select separation details</p>
                        </div>
                    </div>

                    <form onSubmit={handleResignSubmit} className="space-y-3">
                        
                        {/* Row 1: Resignation Request Date & Notice Period */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Resignation Request Date <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    selected={formData.resignationDate}
                                    onChange={(date: Date | null) => setFormData({ ...formData, resignationDate: date || new Date() })}
                                    className="w-full border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    wrapperClassName="w-full"
                                    dateFormat="dd/MM/yyyy"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Notice Period (In Days) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    required
                                    value={formData.noticePeriod}
                                    onChange={e => setFormData({ ...formData, noticePeriod: Math.max(0, Number(e.target.value)) })}
                                    className="w-full border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                                    placeholder="90"
                                />
                            </div>
                        </div>

                        {/* Row 2: Compact Calculated Last Working Date (LWD) Banner */}
                        {calculatedLWD && (
                            <div className="py-2 px-3 bg-slate-50 border border-slate-200/80 rounded-md flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 text-[11px]">Last Working Date (LWD):</span>
                                    <span className="font-bold text-gray-900 font-mono text-xs">
                                        {calculatedLWD.toLocaleDateString('en-GB')}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-gray-500 text-[11px]">Calendar Day:</span>
                                    <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[10.5px]">
                                        {calculatedDayName}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Row 3: Reason & Proposed Last Working Day in 2 Columns */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.reason}
                                    onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white cursor-pointer"
                                >
                                    <option value="">Select a reason...</option>
                                    {EXIT_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1">
                                    Proposed Last Working Day (Proposed LWD) <span className="text-red-500">*</span>
                                </label>
                                <DatePicker
                                    selected={formData.proposedLWD || calculatedLWD}
                                    onChange={(date: Date | null) => setFormData({ ...formData, proposedLWD: date })}
                                    className="w-full border border-gray-300 rounded-md py-1.5 px-2.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    wrapperClassName="w-full"
                                    dateFormat="dd/MM/yyyy"
                                    placeholderText="Select a date"
                                    minDate={formData.resignationDate}
                                    required
                                />
                            </div>
                        </div>

                        {/* Row 4: Comment */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Comment <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                required
                                className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                rows={2}
                                placeholder="Enter detailed comments or handover details..."
                                value={formData.comment}
                                onChange={e => setFormData({ ...formData, comment: e.target.value })}
                            />
                        </div>

                        {/* Row 5: Attachment */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Attachment
                            </label>
                            <input
                                type="file"
                                onChange={e => setFormData({ ...formData, attachment: e.target.files?.[0] || null })}
                                className="w-full border border-gray-300 rounded-md py-1 px-2 text-xs text-gray-600 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                            />
                        </div>
                        
                        {/* Row 6: Action Buttons */}
                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => setIsResigning(false)}
                                className="px-4 py-1.5 border border-gray-300 rounded-md text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-5 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center min-w-[110px]"
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
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Status</h3>
                            <div className="flex items-center gap-3 mb-6">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                    resignation?.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                    resignation?.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {resignation?.status}
                                </span>
                            </div>
                            
                            <div className="space-y-4 text-sm text-gray-600">
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="font-medium text-gray-700">Applied On</span>
                                    <span>{(resignation as any)?.submissionDate || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="font-medium text-gray-700">Notice Period</span>
                                    <span>{(resignation as any)?.noticePeriod || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="font-medium text-gray-700">Last Working Day</span>
                                    <span>{resignation?.lastWorkingDay || '-'}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleWithdraw}
                                disabled={loading || (resignation as any)?.status === 'WITHDRAW_REQUESTED'}
                                className="w-full mt-6 px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {(resignation as any)?.status === 'WITHDRAW_REQUESTED' ? 'Pending Approval' : 'Withdraw Resignation'}
                            </button>
                        </div>
                    </div>

                    {/* Clearance Tasks */}
                    <div className="md:col-span-2">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">Clearance Tasks</h3>
                                <span className="text-sm font-medium text-gray-500">
                                    {tasks.filter(t => t.status === 'Completed').length} of {tasks.length} Completed
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {tasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className={`mt-0.5 ${task.status === 'Completed' ? 'text-green-500' : 'text-gray-300'}`}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className={`font-medium ${task.status === 'Completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                                    {task.title}
                                                </h4>
                                                <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                                    {task.category}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">{task.description}</p>
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
