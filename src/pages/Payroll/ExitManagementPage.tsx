import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ExitManagementService, ExitRequest, ExitStatus } from '../../Services/ExitManagementService';
import { LogOut, CheckCircle2, Circle } from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { ToasterService } from '../../Services/ToasterService';
import { toLocalIsoDate } from "../../utils/localDate";
import { apiError } from "../../utils/apiError";

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

// Still open: the employee may withdraw (before approval at once, afterwards HR decides)
const OPEN: ExitStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NOTICE_PERIOD'];

const STATUS_LABEL: Record<ExitStatus, string> = {
    SUBMITTED: 'Awaiting HR',
    UNDER_REVIEW: 'Under review',
    APPROVED: 'Approved',
    NOTICE_PERIOD: 'Notice period',
    REJECTED: 'Rejected',
    REVERTED: 'Withdrawn',
    COMPLETED: 'Exit completed',
    CANCELLED: 'Cancelled',
};

const statusStyle = (status?: ExitStatus) =>
    status === 'APPROVED' || status === 'NOTICE_PERIOD' || status === 'COMPLETED'
        ? 'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-300'
        : status === 'REJECTED' ? 'bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300'
            : status === 'REVERTED' || status === 'CANCELLED' ? 'bg-gray-100 dark:bg-[#222222] text-gray-600 dark:text-gray-300'
                : 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300';

// Dates come as yyyy-MM-dd; shown as dd/MM/yyyy without shifting the day
const showDate = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '-');

const ExitManagementPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [notLinked, setNotLinked] = useState<string | null>(null);
    const [requests, setRequests] = useState<ExitRequest[]>([]);
    const [isResigning, setIsResigning] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [formData, setFormData] = useState<{
        resignationDate: Date;
        noticePeriod: number;
        reason: string;
        proposedLWD: Date | null;
        comment: string;
    }>({
        resignationDate: new Date(),
        noticePeriod: 90,
        reason: '',
        proposedLWD: null,
        comment: '',
    });

    // The open resignation if there is one, else the latest (closed) one
    const resignation = useMemo(
        () => requests.find(r => r.active && OPEN.includes(r.status)) || requests[0] || null,
        [requests]
    );
    const isOpen = !!resignation && !!resignation.active && OPEN.includes(resignation.status);

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
        fetchMyRequests();
    }, []);

    const fetchMyRequests = async () => {
        setLoading(true);
        try {
            setRequests(await ExitManagementService.getMyExitRequests());
            setNotLinked(null);
        } catch (error) {
            // An account without an employee record can't resign here
            if (axios.isAxiosError(error) && error.response?.status === 403) setNotLinked(apiError(error, "No employee record is linked to your account."));
            else ToasterService.error(apiError(error, "Could not load your resignation"));
        } finally {
            setLoading(false);
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
        setLoading(true);

        try {
            await ExitManagementService.submitExitRequest({
                resignationDate: toLocalIsoDate(formData.resignationDate || new Date()),
                lastWorkingDay: toLocalIsoDate(effectiveLWD),
                reason: formData.reason + (formData.comment.trim() ? ` - ${formData.comment.trim()}` : ''),
            });
            setIsResigning(false);
            ToasterService.success("Resignation submitted", "HR will review it.");
            await fetchMyRequests();
        } catch (error) {
            ToasterService.error(apiError(error, "Failed to submit the resignation"));
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!resignation) return;
        setLoading(true);
        try {
            const updated = await ExitManagementService.withdrawMyResignation(withdrawReason.trim() || undefined);
            ToasterService.success(updated.status === 'REVERTED' ? "Resignation withdrawn" : "Withdrawal requested",
                updated.status === 'REVERTED' ? undefined : "HR will decide on it.");
            setWithdrawing(false);
            setWithdrawReason('');
            await fetchMyRequests();
        } catch (error) {
            ToasterService.error(apiError(error, "Failed to withdraw the resignation"));
        } finally {
            setLoading(false);
        }
    };

    // What happens between the resignation and the exit, as HR records it
    const steps = resignation ? [
        { title: 'HR approval', description: 'HR accepts the resignation and the last working day.', done: ['APPROVED', 'NOTICE_PERIOD', 'COMPLETED'].includes(resignation.status) },
        { title: 'Notice period', description: `Work until your last working day (${showDate(resignation.lastWorkingDay)}).`, done: ['NOTICE_PERIOD', 'COMPLETED'].includes(resignation.status) },
        { title: 'Clearance', description: 'Assets returned, knowledge handed over, dues cleared.', done: !!resignation.clearanceCompleted },
        { title: 'Final settlement', description: 'Your last month is paid through payroll.', done: !!resignation.finalSettlementProcessed },
        { title: 'Relieved', description: 'The exit is complete and your login is switched off.', done: resignation.status === 'COMPLETED' },
    ] : [];

    if (notLinked) {
        return (
            <>
                <PageMeta title="Exit Management" description="Manage your resignation and offboarding" />
                <PageBreadcrumb pageTitle="Exit Management" />
                <div className="bg-white dark:bg-[#191919] p-6 sm:p-8 rounded-xl border border-gray-200 dark:border-transparent shadow-sm text-center max-w-lg mx-auto mt-4">
                    <LogOut className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-300">{notLinked}</p>
                </div>
            </>
        );
    }

    return (
        <>
            <PageMeta title="Exit Management" description="Manage your resignation and offboarding" />
            <PageBreadcrumb pageTitle="Exit Management" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-4 space-y-3 sm:space-y-4">

            {!isOpen && !isResigning ? (
                <div className="bg-white dark:bg-[#191919] p-6 sm:p-8 rounded-xl border border-gray-200 dark:border-transparent shadow-sm text-center max-w-lg mx-auto mt-4">
                    <LogOut className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Initiate Resignation</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                        Submit a request to begin your offboarding process.
                    </p>
                    {resignation && (
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                            Your last resignation ({showDate(resignation.resignationDate)}) was{' '}
                            <span className="font-semibold">{STATUS_LABEL[resignation.status]?.toLowerCase() || resignation.status}</span>
                            {resignation.status === 'REJECTED' && resignation.rejectedReason ? `: ${resignation.rejectedReason}` : '.'}
                        </p>
                    )}
                    <button
                        onClick={() => setIsResigning(true)}
                        disabled={loading || resignation?.status === 'COMPLETED'}
                        className="mt-5 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
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
                                    onChange={e => setFormData({ ...formData, noticePeriod: Math.max(0, Number(e.target.value)), proposedLWD: null })}
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

                        {/* Row 3: Comment */}
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
            ) : resignation && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Status & Summary */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-[#191919] p-6 rounded-lg border border-gray-200 dark:border-transparent shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Request Status</h3>
                            <div className="flex flex-wrap items-center gap-2 mb-6">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${statusStyle(resignation.status)}`}>
                                    {STATUS_LABEL[resignation.status] || resignation.status}
                                </span>
                                {resignation.withdrawalRequested && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
                                        Withdrawal requested
                                    </span>
                                )}
                            </div>

                            <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Applied On</span>
                                    <span>{showDate(resignation.resignationDate)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Notice Period</span>
                                    <span>{resignation.noticeDays != null ? `${resignation.noticeDays} days` : '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Last Working Day</span>
                                    <span>{showDate(resignation.lastWorkingDay)}</span>
                                </div>
                                {resignation.approvedDate && (
                                    <div className="flex justify-between border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Approved On</span>
                                        <span>{showDate(resignation.approvedDate)}</span>
                                    </div>
                                )}
                                {resignation.rejectedReason && (
                                    <div className="border-b border-gray-100 dark:border-[#2a2a2a] pb-2">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">HR's note</span>
                                        <p className="mt-1">{resignation.rejectedReason}</p>
                                    </div>
                                )}
                            </div>

                            {withdrawing ? (
                                <div className="mt-6 space-y-2">
                                    <textarea
                                        className="w-full border border-gray-300 dark:border-[#303030] bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-md p-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500 resize-none h-[62px]"
                                        placeholder="Why are you withdrawing? (optional)"
                                        value={withdrawReason}
                                        onChange={e => setWithdrawReason(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setWithdrawing(false); setWithdrawReason(''); }}
                                            className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-transparent bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-300 rounded-md text-xs font-semibold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleWithdraw}
                                            disabled={loading}
                                            className="flex-1 px-3 py-1.5 bg-cyan-600 text-white rounded-md text-xs font-bold hover:bg-cyan-700 disabled:opacity-60"
                                        >
                                            Confirm
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setWithdrawing(true)}
                                    disabled={loading || resignation.withdrawalRequested}
                                    className="w-full mt-6 px-4 py-2 border border-gray-300 dark:border-transparent bg-white dark:bg-[#222222] text-gray-700 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {resignation.withdrawalRequested ? 'Withdrawal awaiting HR' : 'Withdraw Resignation'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Exit steps, as HR records them */}
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-[#191919] p-6 rounded-lg border border-gray-200 dark:border-transparent shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exit Steps</h3>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    {steps.filter(s => s.done).length} of {steps.length} done
                                </span>
                            </div>

                            <div className="space-y-3">
                                {steps.map(step => (
                                    <div
                                        key={step.title}
                                        className="flex items-start gap-4 p-4 border border-gray-100 dark:border-[#2a2a2a] rounded-lg"
                                    >
                                        <div className={`mt-0.5 ${step.done ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                            {step.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className={`font-medium mb-1 ${step.done ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                                {step.title}
                                            </h4>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{step.description}</p>
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
