import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ExitManagementService, ExitRequest, ExitStatus } from '../../Services/ExitManagementService';
import { LogOut, CheckCircle2, Circle } from 'lucide-react';
import {
    ArrowUturnLeftIcon,
    CalendarDaysIcon,
    ClockIcon,
    FlagIcon,
} from '@heroicons/react/24/outline';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AddButton } from '../../components/common/AddButton';
import StatsCard from '../../components/common/Statscard';
import PaginatedPopup from '../../components/common/unpopup';
import { FloatingInput, FloatingSelect1 as FloatingSelect, FloatingTextarea } from '../../components/inputfeild/FloatingInput';
import { ToasterService } from '../../Services/ToasterService';
import { toLocalIsoDate, todayIso } from "../../utils/localDate";
import { apiError } from "../../utils/apiError";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON, STATS_ROW, TOOL_BUTTON } from './hrmsUi';

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

// Dates come as yyyy-MM-dd; shown as dd/MM/yyyy without shifting the day
const showDate = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '-');

const addDays = (isoDate: string, days: number) => {
    const [y, m, d] = isoDate.split('-').map(Number);
    return toLocalIsoDate(new Date(y, m - 1, d + days));
};

const emptyForm = () => ({ resignationDate: todayIso(), noticePeriod: 90, lastWorkingDay: '', reason: '', comment: '' });

const ExitManagementPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [notLinked, setNotLinked] = useState<string | null>(null);
    const [requests, setRequests] = useState<ExitRequest[]>([]);
    const [isResigning, setIsResigning] = useState(false);
    const [withdrawing, setWithdrawing] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [formData, setFormData] = useState(emptyForm);

    // The open resignation if there is one, else the latest (closed) one
    const resignation = useMemo(
        () => requests.find(r => r.active && OPEN.includes(r.status)) || requests[0] || null,
        [requests]
    );
    const isOpen = !!resignation && !!resignation.active && OPEN.includes(resignation.status);

    // The last working day follows the notice period until it is picked
    const calculatedLWD = useMemo(
        () => (formData.resignationDate ? addDays(formData.resignationDate, Number(formData.noticePeriod) || 0) : ''),
        [formData.resignationDate, formData.noticePeriod]
    );
    const effectiveLWD = formData.lastWorkingDay || calculatedLWD;

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'noticePeriod' ? Math.max(0, Number(value) || 0) : value,
            // A new notice period recalculates the last working day
            ...(name === 'noticePeriod' || name === 'resignationDate' ? { lastWorkingDay: '' } : {}),
        }));
    };

    const handleResignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.reason.trim()) {
            ToasterService.error("Please select a reason for leaving.");
            return;
        }
        if (!formData.comment.trim()) {
            ToasterService.error("Please add a comment or handover details.");
            return;
        }
        if (!effectiveLWD) {
            ToasterService.error("Please select your proposed last working day.");
            return;
        }
        setLoading(true);

        try {
            await ExitManagementService.submitExitRequest({
                resignationDate: formData.resignationDate || todayIso(),
                lastWorkingDay: effectiveLWD,
                reason: formData.reason + (formData.comment.trim() ? ` - ${formData.comment.trim()}` : ''),
            });
            setIsResigning(false);
            setFormData(emptyForm());
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

    const canStart = !notLinked && !isOpen && resignation?.status !== 'COMPLETED';

    return (
        <>
            <PageMeta title="Exit Management" description="Manage your resignation and offboarding" />
            <PageBreadcrumb
                pageTitle="Exit Management"
                actions={
                    canStart ? (
                        <AddButton label="Start Resignation" permission={null} disabled={loading} onClick={() => setIsResigning(true)} />
                    ) : isOpen && !resignation?.withdrawalRequested ? (
                        <button type="button" className={TOOL_BUTTON} disabled={loading} onClick={() => setWithdrawing(true)}>
                            <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                            Withdraw Resignation
                        </button>
                    ) : undefined
                }
            />

            <div className={PAGE_BODY}>
                {notLinked || !isOpen ? (
                    // Nothing open: the standard empty state, with the last resignation's outcome
                    <div className={`${CARD} flex flex-col items-center justify-center px-6 py-14 text-center`}>
                        <LogOut className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                        {notLinked ? (
                            <p className="text-sm text-gray-500 dark:text-slate-400">{notLinked}</p>
                        ) : (
                            <>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">No open resignation</p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                                    {resignation
                                        ? <>Your last resignation ({showDate(resignation.resignationDate)}) was{' '}
                                            <span className="font-semibold">{STATUS_LABEL[resignation.status]?.toLowerCase() || resignation.status}</span>
                                            {resignation.status === 'REJECTED' && resignation.rejectedReason ? `: ${resignation.rejectedReason}` : '.'}</>
                                        : 'Start a resignation to begin your offboarding.'}
                                </p>
                                {canStart && (
                                    <button type="button" onClick={() => setIsResigning(true)} className="mt-3 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">
                                        Start resignation
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ) : resignation && (
                    <>
                        <div className={STATS_ROW}>
                            <StatsCard
                                label="Status"
                                value={resignation.withdrawalRequested ? 'Withdrawal requested' : (STATUS_LABEL[resignation.status] || resignation.status)}
                                gradient={resignation.status === 'APPROVED' || resignation.status === 'NOTICE_PERIOD' ? "from-green-50 to-emerald-50" : "from-amber-50 to-yellow-50"}
                                borderColor={resignation.status === 'APPROVED' || resignation.status === 'NOTICE_PERIOD' ? "border-green-100" : "border-amber-100"}
                                labelColor={resignation.status === 'APPROVED' || resignation.status === 'NOTICE_PERIOD' ? "text-green-600" : "text-amber-600"}
                                icon={<FlagIcon className="h-5 w-5" />}
                            />
                            <StatsCard label="Applied On" value={showDate(resignation.resignationDate)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<CalendarDaysIcon className="h-5 w-5" />} />
                            <StatsCard label="Notice Period" value={resignation.noticeDays != null ? `${resignation.noticeDays} days` : '-'} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<ClockIcon className="h-5 w-5" />} />
                            <StatsCard label="Last Working Day" value={showDate(resignation.lastWorkingDay)} gradient="from-blue-50 to-cyan-50" borderColor="border-blue-100" labelColor="text-blue-600" icon={<CalendarDaysIcon className="h-5 w-5" />} onRefresh={fetchMyRequests} />
                        </div>

                        {withdrawing && (
                            <div className={`${CARD} mb-4 p-4`}>
                                <h3 className={CARD_TITLE}>Withdraw your resignation</h3>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">
                                    {resignation.status === 'SUBMITTED' || resignation.status === 'UNDER_REVIEW'
                                        ? 'HR hasn\'t decided yet, so it is withdrawn at once.'
                                        : 'It is already approved, so HR decides on the withdrawal.'}
                                </p>
                                <div className="mt-3">
                                    <FloatingTextarea
                                        label="Why are you withdrawing? (optional)"
                                        rows={2}
                                        value={withdrawReason}
                                        onChange={e => setWithdrawReason(e.target.value)}
                                    />
                                </div>
                                <div className="mt-3 flex justify-end gap-2">
                                    <button type="button" className={SECONDARY_BUTTON} onClick={() => { setWithdrawing(false); setWithdrawReason(''); }}>
                                        Cancel
                                    </button>
                                    <button type="button" className={PRIMARY_BUTTON} disabled={loading} onClick={handleWithdraw}>
                                        Confirm Withdrawal
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            {/* Exit steps, as HR records them */}
                            <div className={`${CARD} p-4 lg:col-span-2`}>
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className={CARD_TITLE}>Exit Steps</h3>
                                    <span className="text-xs font-medium text-slate-500 dark:text-gray-400">
                                        {steps.filter(s => s.done).length} of {steps.length} done
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-[#2a2a2a]">
                                    {steps.map(step => (
                                        <div key={step.title} className="flex items-start gap-3 py-3">
                                            <div className={`mt-0.5 ${step.done ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                                {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${step.done ? 'text-slate-500 dark:text-gray-400' : 'text-slate-900 dark:text-white'}`}>{step.title}</p>
                                                <p className="text-xs text-slate-500 dark:text-gray-400">{step.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* The request itself */}
                            <div className={`${CARD} p-4`}>
                                <h3 className={`${CARD_TITLE} mb-3`}>Your Request</h3>
                                <dl className="space-y-3 text-sm">
                                    <div>
                                        <dt className="text-xs text-slate-500 dark:text-gray-400">Reason</dt>
                                        <dd className="text-slate-900 dark:text-white">{resignation.reason || '-'}</dd>
                                    </div>
                                    {resignation.approvedDate && (
                                        <div>
                                            <dt className="text-xs text-slate-500 dark:text-gray-400">Approved On</dt>
                                            <dd className="text-slate-900 dark:text-white">{showDate(resignation.approvedDate)}</dd>
                                        </div>
                                    )}
                                    {resignation.withdrawalRequested && (
                                        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-transparent dark:bg-blue-950/40 dark:text-blue-300">
                                            Your withdrawal is waiting for HR.
                                        </p>
                                    )}
                                    {resignation.rejectedReason && (
                                        <div>
                                            <dt className="text-xs text-slate-500 dark:text-gray-400">HR's note</dt>
                                            <dd className="text-slate-900 dark:text-white">{resignation.rejectedReason}</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <PaginatedPopup
                isOpen={isResigning}
                title="Resignation"
                subtitle="Your request goes to HR for approval"
                onClose={() => setIsResigning(false)}
                onSubmit={handleResignSubmit}
                submitting={loading}
                submitLabel="Submit Resignation"
                maxWidthClassName="max-w-2xl"
                tabs={[
                    {
                        label: "Details",
                        fields: [
                            <FloatingInput key="resignationDate" label="Resignation Date" name="resignationDate" type="date" value={formData.resignationDate} onChange={handleChange} required />,
                            <FloatingInput key="noticePeriod" label="Notice Period (days)" name="noticePeriod" type="number" min={0} value={formData.noticePeriod} onChange={handleChange} required />,
                            <FloatingInput key="lastWorkingDay" label="Last Working Day" name="lastWorkingDay" type="date" min={formData.resignationDate} value={effectiveLWD} onChange={handleChange} required />,
                            <FloatingSelect key="reason" label="Reason" name="reason" value={formData.reason} onChange={handleChange} options={EXIT_REASONS.map(r => ({ id: r, name: r }))} required />,
                            <div key="comment" className="md:col-span-2">
                                <FloatingTextarea label="Comment / handover details" name="comment" rows={3} value={formData.comment} onChange={handleChange} required />
                            </div>,
                        ],
                    },
                ]}
            />
        </>
    );
};

export default ExitManagementPage;
