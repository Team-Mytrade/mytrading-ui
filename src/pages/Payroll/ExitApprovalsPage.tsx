import { t } from "../../i18n/i18n";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ExitManagementService, ExitRequest, ExitStatus } from '../../Services/ExitManagementService';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { Check, X, AlertCircle } from 'lucide-react';
import { usePermissions } from '../../access/usePermissions';
import ExitManagementPage from './ExitManagementPage';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { ToasterService } from '../../Services/ToasterService';
import { apiError } from '../../utils/apiError';
import { todayIso } from '../../utils/localDate';
import StatsCard from '../../components/common/Statscard';
import { ArrowUturnLeftIcon, CheckCircleIcon, ClockIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { PAGE_BODY, STATS_ROW } from './hrmsUi';
import { isGcc } from './gulfPayroll';
import { SEPARATION_LABELS, SeparationType } from './settlementStatement';
import SettlementStatementDialog from './SettlementStatementDialog';
import { Link } from 'react-router-dom';
import type { LineType, NoticeSettlementAction, SeveranceBasis, SeverancePayout } from '../../Services/FinalSettlementService';

const NOTICE_ACTIONS: Record<NoticeSettlementAction, string> = {
    RECOVER: 'Recover from the employee',
    PAY_IN_LIEU: 'Pay in lieu to the employee',
    WAIVE: 'Waive (neither)',
};

const SEVERANCE_BASES: Record<SeveranceBasis, string> = {
    MONTHS_GROSS: 'Months of gross pay',
    MONTHS_BASIC: 'Months of basic pay',
    FIXED_AMOUNT: 'Fixed amount',
};

type TermsLine = { name: string; type: LineType; amount: string; taxable: boolean };

// The full and final terms being edited (text fields as typed)
type TermsForm = {
    noticeAction: NoticeSettlementAction | '';
    noticeSettlementDays: string;
    noticeRemark: string;
    severanceBasis: SeveranceBasis | '';
    severanceMonths: string;
    severanceAmount: string;
    severancePayout: SeverancePayout;
    severanceInstalments: string;
    lines: TermsLine[];
};

const termsFrom = (row: ExitRequest): TermsForm => ({
    noticeAction: row.noticeAction || '',
    noticeSettlementDays: row.noticeSettlementDays != null ? String(row.noticeSettlementDays) : '',
    noticeRemark: row.noticeRemark || '',
    severanceBasis: row.severanceBasis || '',
    severanceMonths: row.severanceMonths != null ? String(row.severanceMonths) : '',
    severanceAmount: row.severanceAmount != null ? String(row.severanceAmount) : '',
    severancePayout: row.severancePayout || 'LUMP_SUM',
    severanceInstalments: row.severanceInstalments != null ? String(row.severanceInstalments) : '2',
    lines: (row.settlementLines || []).map((l) => ({ name: l.name, type: l.type, amount: String(l.amount), taxable: l.taxable !== false })),
});

const inputClass = "h-8 w-full rounded-lg border border-gray-300 px-2.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";

const STATUS_LABEL: Record<ExitStatus, string> = {
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under review',
    APPROVED: 'Approved',
    NOTICE_PERIOD: 'Notice period',
    REJECTED: 'Rejected',
    REVERTED: 'Withdrawn',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
};

const UNDECIDED: ExitStatus[] = ['SUBMITTED', 'UNDER_REVIEW'];
const ACCEPTED: ExitStatus[] = ['APPROVED', 'NOTICE_PERIOD'];

const showDate = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '-');

const actionButton = "px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const ExitApprovalsPage: React.FC = () => {
    // Deciding exit requests needs HRM:APPROVE; anyone else sees their own exit request instead
    const { canApprove } = usePermissions();

    const [requests, setRequests] = useState<ExitRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    // The request open in the details popup; while it is still open HR can change its dates and notes
    const [viewing, setViewing] = useState<ExitRequest | null>(null);
    const [edit, setEdit] = useState({ lastWorkingDay: '', reason: '', exitInterviewFeedback: '', separationType: 'RESIGNATION' as SeparationType,
        unusedLeaveDays: '' });
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    // A Gulf employee's final settlement (gratuity + final pay) open in its dialog
    const [settlementId, setSettlementId] = useState<number | null>(null);
    // The full and final terms HR/admin decide: notice recovery / pay in lieu / waiver, severance, own lines
    const [terms, setTerms] = useState<TermsForm | null>(null);
    const [savingTerms, setSavingTerms] = useState(false);

    const openDetails = (row: ExitRequest) => {
        setViewing(row);
        setTerms(termsFrom(row));
        setEdit({ lastWorkingDay: row.lastWorkingDay || '', reason: row.reason || '', exitInterviewFeedback: row.exitInterviewFeedback || '',
            separationType: row.separationType || 'RESIGNATION', unusedLeaveDays: row.unusedLeaveDays != null ? String(row.unusedLeaveDays) : '' });
    };

    // The annual leave still available in Attendance (whole or half days), as the unused leave to pay
    const fillFromAttendance = async () => {
        if (!viewing) return;
        setLoadingBalance(true);
        try {
            const { data } = await axios.get<Array<{ leaveType: string; availableLeaves?: number; financialYear?: number; active?: boolean }>>(
                `/v1/api/attendance/employee-leave-balances/${viewing.employeeId}`);
            const annual = (data || []).filter((b) => b.leaveType === 'EARNED' && b.active !== false)
                .sort((a, b) => (b.financialYear ?? 0) - (a.financialYear ?? 0))[0];
            if (!annual) return ToasterService.warning("No annual leave balance in Attendance for this employee");
            setEdit((p) => ({ ...p, unusedLeaveDays: String(Math.max(0, Math.floor((annual.availableLeaves ?? 0) * 2) / 2)) }));
        } catch (error) {
            ToasterService.error(apiError(error, "The leave balance could not be loaded"));
        } finally {
            setLoadingBalance(false);
        }
    };
    const editable = (row: ExitRequest | null) => !!row && !!row.active && (UNDECIDED.includes(row.status) || ACCEPTED.includes(row.status));

    const saveDetails = async () => {
        if (!viewing?.id) return;
        if (!edit.lastWorkingDay) return ToasterService.warning("Pick the last working day");
        if (edit.lastWorkingDay < viewing.resignationDate) return ToasterService.warning("The last working day can't be before the resignation date");
        const leaveText = edit.unusedLeaveDays.trim();
        if (leaveText && !(Number(leaveText) >= 0 && Number(leaveText) * 2 === Math.round(Number(leaveText) * 2))) {
            return ToasterService.warning("Enter the unused leave in whole or half days");
        }
        // Blank keeps "none recorded"; clearing a recorded value sets it to 0
        const unusedLeaveDays = leaveText ? Number(leaveText) : viewing.unusedLeaveDays != null ? 0 : undefined;
        setSavingEdit(true);
        try {
            const saved = await ExitManagementService.updateExitDetails({
                id: viewing.id,
                lastWorkingDay: edit.lastWorkingDay,
                reason: edit.reason.trim() || undefined,
                exitInterviewFeedback: edit.exitInterviewFeedback.trim() || undefined,
                separationType: edit.separationType,
                unusedLeaveDays,
            });
            ToasterService.success("Exit details saved");
            setViewing(saved);
            setTerms(termsFrom(saved));
            await fetchRequests();
        } catch (error) {
            ToasterService.error(apiError(error, "The exit details were not saved"));
        } finally {
            setSavingEdit(false);
        }
    };

    const termsEditable = (row: ExitRequest | null) => !!row && !!row.active && !row.finalSettlementBatch;

    const saveTerms = async () => {
        if (!viewing?.id || !terms) return;
        const shortfall = viewing.noticeRecoveryDays ?? 0;
        const days = terms.noticeSettlementDays.trim();
        if (terms.noticeAction && terms.noticeAction !== 'WAIVE' && days && !(Number(days) >= 0 && Number(days) <= shortfall && Number.isInteger(Number(days)))) {
            return ToasterService.warning(`Enter 0 to ${shortfall} notice days`);
        }
        if (terms.severanceBasis === 'FIXED_AMOUNT' && !(Number(terms.severanceAmount) > 0)) return ToasterService.warning("Enter the severance amount");
        if (terms.severanceBasis && terms.severanceBasis !== 'FIXED_AMOUNT' && !(Number(terms.severanceMonths) > 0)) {
            return ToasterService.warning("Enter the months of pay for the severance");
        }
        const lines = terms.lines.filter((l) => l.name.trim() || l.amount.trim());
        if (lines.some((l) => !l.name.trim() || !(Number(l.amount) > 0))) return ToasterService.warning("Give every line a name and an amount above 0");
        setSavingTerms(true);
        try {
            const saved = await ExitManagementService.updateSettlementTerms(viewing.id, {
                noticeAction: terms.noticeAction || null,
                noticeSettlementDays: terms.noticeAction && terms.noticeAction !== 'WAIVE' && days ? Number(days) : null,
                noticeRemark: terms.noticeRemark.trim() || null,
                severanceBasis: terms.severanceBasis || null,
                severanceMonths: terms.severanceBasis && terms.severanceBasis !== 'FIXED_AMOUNT' ? Number(terms.severanceMonths) : null,
                severanceAmount: terms.severanceBasis === 'FIXED_AMOUNT' ? Number(terms.severanceAmount) : null,
                severancePayout: terms.severanceBasis ? terms.severancePayout : null,
                severanceInstalments: terms.severanceBasis && terms.severancePayout === 'MONTHLY' ? Number(terms.severanceInstalments) || 1 : null,
                settlementLines: lines.map((l) => ({ name: l.name.trim(), type: l.type, amount: Number(l.amount), taxable: l.type === 'EARNING' ? l.taxable : false })),
            });
            ToasterService.success("Full and final terms saved");
            setViewing(saved);
            setTerms(termsFrom(saved));
            await fetchRequests();
        } catch (error) {
            ToasterService.error(apiError(error, "The full and final terms were not saved"));
        } finally {
            setSavingTerms(false);
        }
    };

    const updateLine = (index: number, change: Partial<TermsLine>) =>
        setTerms((p) => (p ? { ...p, lines: p.lines.map((l, i) => (i === index ? { ...l, ...change } : l)) } : p));

    useEffect(() => {
        if (canApprove) fetchRequests();
    }, [canApprove]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await ExitManagementService.getAllExitRequests();
            setRequests(data || []);
        } catch (error) {
            ToasterService.error(apiError(error, "Failed to load exit requests"));
        } finally {
            setLoading(false);
        }
    };

    // Runs one decision, shows the server's message on failure, then reloads
    const act = async (row: ExitRequest, work: () => Promise<unknown>, done: string) => {
        setBusyId(row.id ?? null);
        try {
            await work();
            ToasterService.success(done);
            await fetchRequests();
        } catch (error) {
            ToasterService.error(apiError(error, "The change was not saved"));
        } finally {
            setBusyId(null);
        }
    };

    const handleReject = async (row: ExitRequest) => {
        if (!rejectReason.trim()) {
            ToasterService.warning("Give the employee a reason");
            return;
        }
        await act(row, () => ExitManagementService.rejectResignation(row.employeeId, rejectReason.trim()), "Resignation rejected");
        setRejectingId(null);
        setRejectReason("");
    };

    if (!canApprove) {
        return <ExitManagementPage />;
    }

    const columns: ColumnDef<ExitRequest>[] = [
        {
            key: "employeeName",
            label: "Employee",
            sortable: true,
            sortValueGetter: (row) => row.employeeName || `EMP-${row.employeeId}`,
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white">{row.employeeName || `EMP-${row.employeeId}`}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{row.employeeCode || '—'} • {row.designation || '—'}</span>
                    {row.approval?.onBehalf && (
                        <span className="text-[10px] font-medium text-amber-700 dark:text-amber-300">{t("Raised by")} {row.approval.submittedByName || 'HR'}</span>
                    )}
                </div>
            )
        },
        {
            key: "lastWorkingDay",
            label: "Dates",
            sortable: true,
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("LWD:")} {showDate(row.lastWorkingDay)}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {t("Resigned:")} {showDate(row.resignationDate)}{row.noticeDays != null ? ` • ${row.noticeDays} days` : ''}
                    </span>
                </div>
            )
        },
        {
            key: "reason",
            label: "Reason",
            render: (row) => (
                <p className="text-xs text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={row.reason}>
                    {row.reason}
                </p>
            )
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            render: (row) => (
                <div className="flex flex-col items-start gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide inline-block ${
                        UNDECIDED.includes(row.status) ? 'bg-amber-50 text-amber-500 border border-amber-100 dark:bg-transparent dark:text-gray-300 dark:border-transparent' :
                        ACCEPTED.includes(row.status) || row.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100 dark:bg-transparent dark:text-gray-300 dark:border-transparent' :
                        row.status === 'REJECTED' ? 'bg-red-50 text-red-500 border border-red-100 dark:bg-transparent dark:text-gray-400 dark:border-transparent' :
                        'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent line-through'
                    }`}>
                        {STATUS_LABEL[row.status] || row.status}
                    </span>
                    {row.withdrawalRequested && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-500 border border-blue-100 dark:bg-transparent dark:text-gray-300 dark:border-transparent">
                            {t("Withdrawal req.")}
                        </span>
                    )}
                    {ACCEPTED.includes(row.status) && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            {t("Clearance")} {row.clearanceCompleted ? '✓' : '—'} • Settlement {row.finalSettlementProcessed ? '✓' : '—'}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-80",
            className: "text-right w-80",
            render: (row) => {
                const busy = busyId === row.id;
                const id = row.id!;
                const lastDayReached = !!row.lastWorkingDay && row.lastWorkingDay <= todayIso();
                return (
                    <div className="flex flex-wrap justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button disabled={busy} onClick={() => openDetails(row)}
                            title={t(editable(row) ? "See the request and change the last working day before deciding" : "See the request")}
                            className={`${actionButton} border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-transparent dark:text-cyan-300 dark:hover:bg-[#222222]`}>
                            {t(editable(row) ? 'Details / Edit' : 'Details')}
                        </button>
                        {UNDECIDED.includes(row.status) && (rejectingId === id ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    placeholder={t("Reason...")}
                                    className="text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded px-2 py-1 outline-none focus:border-red-400 w-32 h-7"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <button onClick={() => handleReject(row)} disabled={busy}
                                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors" title={t("Confirm Reject")}>
                                    <Check size={14} />
                                </button>
                                <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                    className="p-1 bg-gray-200 dark:bg-[#222222] text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-[#2a2a2a] transition-colors" title={t("Cancel")}>
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button disabled={busy} onClick={() => act(row, () => ExitManagementService.approveExitRequest(id), "Resignation approved")}
                                    className={`${actionButton} border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-transparent dark:text-emerald-400 dark:hover:bg-[#222222]`}>
                                    {t("Approve")}
                                </button>
                                <button disabled={busy} onClick={() => setRejectingId(id)}
                                    className={`${actionButton} border-red-200 text-red-600 hover:bg-red-50 dark:border-transparent dark:text-rose-400 dark:hover:bg-[#222222]`}>
                                    {t("Reject")}
                                </button>
                            </>
                        ))}

                        {row.withdrawalRequested && (
                            <>
                                <button disabled={busy} title={row.revertReason || undefined}
                                    onClick={() => act(row, () => ExitManagementService.revertResignation(row.employeeId, row.revertReason || "Withdrawal accepted"), "Resignation withdrawn")}
                                    className={`${actionButton} border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-transparent dark:text-blue-400 dark:hover:bg-[#222222]`}>
                                    {t("Accept withdrawal")}
                                </button>
                                <button disabled={busy}
                                    onClick={() => act(row, () => ExitManagementService.declineWithdrawal(id), "Withdrawal declined")}
                                    className={`${actionButton} border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    {t("Decline")}
                                </button>
                            </>
                        )}

                        {row.status === 'APPROVED' && !row.withdrawalRequested && (
                            <button disabled={busy} onClick={() => act(row, () => ExitManagementService.startNoticePeriod(id), "Notice period started")}
                                className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                {t("Start notice")}
                            </button>
                        )}

                        {isGcc(row.countryCode) && (ACCEPTED.includes(row.status) || row.status === 'COMPLETED') && (
                            <button disabled={busy} onClick={() => setSettlementId(id)}
                                title={t("Final settlement statement: end-of-service gratuity and the final pay")}
                                className={`${actionButton} border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-transparent dark:text-cyan-300 dark:hover:bg-[#222222]`}>
                                {t("Statement")}
                            </button>
                        )}

                        {ACCEPTED.includes(row.status) && !row.withdrawalRequested && (
                            <>
                                <button disabled={busy}
                                    onClick={() => act(row, () => ExitManagementService.updateClearance(id, !row.clearanceCompleted),
                                        row.clearanceCompleted ? "Clearance reopened" : "Clearance recorded")}
                                    className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    {t(row.clearanceCompleted ? 'Undo clearance' : 'Clearance done')}
                                </button>
                                <button disabled={busy}
                                    title={t("Paid from the Full & Final page (it records this for you); or record it here once the last month's pay is processed")}
                                    onClick={() => act(row, () => ExitManagementService.updateSettlement(id, !row.finalSettlementProcessed),
                                        row.finalSettlementProcessed ? "Settlement reopened" : "Settlement recorded")}
                                    className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    {t(row.finalSettlementProcessed ? 'Undo settlement' : 'Settlement done')}
                                </button>
                                <button
                                    disabled={busy || !row.clearanceCompleted || !row.finalSettlementProcessed || !lastDayReached}
                                    title={!lastDayReached ? `Can be completed from ${showDate(row.lastWorkingDay)}` : t("Relieve the employee and switch their login off")}
                                    onClick={() => act(row, () => ExitManagementService.completeExit(id), "Exit completed")}
                                    className={`${actionButton} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}>
                                    {t("Complete exit")}
                                </button>
                            </>
                        )}
                    </div>
                );
            }
        }
    ];

    return (
        <>
            <PageMeta title={t("Exit Approvals")} description="Approve resignations, record clearance and the final settlement, then complete the exit" />
            <PageBreadcrumb pageTitle="Exit Approvals" />

            <div className={PAGE_BODY}>
                <div className={STATS_ROW}>
                    <StatsCard label={t("Exit Requests")} value={requests.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<UserMinusIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Awaiting Decision")} value={requests.filter(r => r.active && UNDECIDED.includes(r.status)).length} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ClockIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Serving Notice")} value={requests.filter(r => r.active && ACCEPTED.includes(r.status)).length} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-5 w-5" />} />
                    <StatsCard label={t("Withdrawal Requests")} value={requests.filter(r => r.withdrawalRequested).length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<ArrowUturnLeftIcon className="h-5 w-5" />} onRefresh={fetchRequests} />
                </div>

                <ReusableTable
                    data={requests}
                    columns={columns}
                    loading={loading}
                    pageSize={10}
                    defaultSortKey="lastWorkingDay"
                    defaultSortOrder="desc"
                    emptyState={
                        <div className="flex flex-col items-center justify-center py-12">
                            <AlertCircle className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                            <p className="text-sm text-gray-500 dark:text-slate-400">{t("No exit requests found")}</p>
                        </div>
                    }
                />
            </div>

            {viewing && (
                <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
                    <div data-overlay-panel className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#191919]" onClick={(e) => e.stopPropagation()}>
                        <div data-overlay-header className="flex items-start justify-between border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{viewing.employeeName || `EMP-${viewing.employeeId}`}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {viewing.employeeCode || '—'} · {viewing.designation || '—'} · {STATUS_LABEL[viewing.status] || viewing.status}
                                </p>
                            </div>
                            <button type="button" onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}><X size={18} /></button>
                        </div>

                        <div className="space-y-4 overflow-y-auto px-5 py-4 text-xs">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3 dark:border-[#2a2a2a] dark:bg-[#222222]">
                                {([
                                    ['Resigned on', showDate(viewing.resignationDate)],
                                    ['Notice', viewing.noticeDays != null ? `${viewing.noticeDays} days` : '—'],
                                    ['Notice period ends', viewing.noticeLastWorkingDay ? `${showDate(viewing.noticeLastWorkingDay)}${viewing.noticePeriodDays != null ? ` (${viewing.noticePeriodDays} days)` : ''}` : '—'],
                                    ['Proposed LWD', viewing.proposedLastWorkingDay ? showDate(viewing.proposedLastWorkingDay) : '—'],
                                    ['Notice recovery days', viewing.noticeRecoveryDays != null ? `${viewing.noticeRecoveryDays} days` : '—'],
                                    ['Location', viewing.location || '—'],
                                    ['Phone', viewing.employeePhone || '—'],
                                    ['Approved on', showDate(viewing.approvedDate)],
                                    ['Notice started', showDate(viewing.noticePeriodStartDate)],
                                    ['Clearance', viewing.clearanceCompleted ? 'Done' : 'Pending'],
                                    ['Final settlement', viewing.finalSettlementProcessed ? 'Done' : 'Pending'],
                                    ['F&F due on', showDate(viewing.finalSettlementDueDate)],
                                    ['Relieved on', showDate(viewing.relievedDate)],
                                ] as const).map(([k, v]) => (
                                    <div key={k}>
                                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">{k}</span>
                                        <span className="font-semibold text-gray-800 dark:text-gray-100">{v}</span>
                                    </div>
                                ))}
                            </div>

                            {(viewing.rejectedReason || viewing.revertReason) && (
                                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                                    {viewing.rejectedReason ? `Rejected: ${viewing.rejectedReason}` : `Withdrawal: ${viewing.revertReason}`}
                                </p>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Last working day *")}</label>
                                    <input type="date" value={edit.lastWorkingDay} min={viewing.resignationDate} disabled={!editable(viewing)}
                                        onChange={(e) => setEdit((p) => ({ ...p, lastWorkingDay: e.target.value }))}
                                        className="h-8 w-full rounded-lg border border-gray-300 px-2.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white" />
                                </div>
                                <div>
                                    <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Reason")}</label>
                                    <input type="text" value={edit.reason} maxLength={255} disabled={!editable(viewing)}
                                        onChange={(e) => setEdit((p) => ({ ...p, reason: e.target.value }))}
                                        className="h-8 w-full rounded-lg border border-gray-300 px-2.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white" />
                                </div>
                                {(
                                    <div className="sm:col-span-2">
                                        <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("How the employment ended")}</label>
                                        <select value={edit.separationType} disabled={!editable(viewing)}
                                            onChange={(e) => setEdit((p) => ({ ...p, separationType: e.target.value as SeparationType }))}
                                            className="h-8 w-full rounded-lg border border-gray-300 px-2.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white">
                                            {(Object.keys(SEPARATION_LABELS) as SeparationType[]).map((type) => (
                                                <option key={type} value={type}>{t(SEPARATION_LABELS[type])}</option>
                                            ))}
                                        </select>
                                        <p className="mt-0.5 text-[10px] text-gray-500">
                                            {isGcc(viewing.countryCode)
                                                ? t("Decides the Saudi end-of-service award (a resignation earns part of it); the UAE gratuity is the same either way.")
                                                : t("Decides what is suggested for unserved notice (resignation: recover; ended by the employer: pay in lieu) and when the full and final settlement falls due.")}
                                        </p>
                                    </div>
                                )}
                                {(
                                    <div className="sm:col-span-2">
                                        <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Unused annual leave (days)")}</label>
                                        <div className="flex gap-2">
                                            <input type="number" min={0} step={0.5} value={edit.unusedLeaveDays} disabled={!editable(viewing)}
                                                onChange={(e) => setEdit((p) => ({ ...p, unusedLeaveDays: e.target.value }))}
                                                className="h-8 w-32 rounded-lg border border-gray-300 px-2.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white" />
                                            {editable(viewing) && (
                                                <button type="button" onClick={fillFromAttendance} disabled={loadingBalance}
                                                    className={`${actionButton} border-cyan-200 text-cyan-700 hover:bg-cyan-50 dark:border-transparent dark:text-cyan-300 dark:hover:bg-[#222222]`}>
                                                    {t(loadingBalance ? 'Loading...' : 'Use the Attendance balance')}
                                                </button>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-[10px] text-gray-500">
                                            {isGcc(viewing.countryCode)
                                                ? t("Paid with the final pay: UAE on basic pay, Saudi Arabia on the actual wage, a day being the monthly wage / 30.")
                                                : t("Encashed with the full and final settlement (leave-encashment-basis in the payroll settings, a day being the monthly pay / 30).")}
                                        </p>
                                    </div>
                                )}
                                <div className="sm:col-span-2">
                                    <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Exit interview notes")}</label>
                                    <textarea rows={3} value={edit.exitInterviewFeedback} maxLength={2000} disabled={!editable(viewing)}
                                        onChange={(e) => setEdit((p) => ({ ...p, exitInterviewFeedback: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white" />
                                </div>
                            </div>

                            {terms && (ACCEPTED.includes(viewing.status) || UNDECIDED.includes(viewing.status) || !!viewing.finalSettlementBatch) && (
                                <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-3 dark:border-[#2a2a2a] dark:bg-[#1f1f1f]">
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{t("Full & final settlement")}</h4>
                                        {viewing.finalSettlementBatch
                                            ? <span className="text-[11px] font-semibold text-emerald-700">{t("Paid in")} {viewing.finalSettlementBatch}</span>
                                            : <Link to="/fullAndFinal" className="text-[11px] font-semibold text-cyan-700 hover:underline">{t("Open Full & Final")} →</Link>}
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        <div className="sm:col-span-3 text-[11px] text-gray-600 dark:text-gray-300">
                                            {(viewing.noticeRecoveryDays ?? 0) > 0
                                                ? <>{viewing.noticeRecoveryDays} {t("notice days are not served (notice ends")} {showDate(viewing.noticeLastWorkingDay)}). {t("Suggested:")} <b>{t(NOTICE_ACTIONS[viewing.suggestedNoticeAction || 'RECOVER'])}</b>.</>
                                                : t("The notice period is served in full.")}
                                            {viewing.noticeDecidedBy && <> {t("Decided by")} {viewing.noticeDecidedBy} {t("on")} {showDate(viewing.noticeDecidedOn)}.</>}
                                        </div>
                                        <div>
                                            <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Unserved notice")}</label>
                                            <select value={terms.noticeAction} disabled={!termsEditable(viewing)} className={inputClass}
                                                onChange={(e) => setTerms((p) => (p ? { ...p, noticeAction: e.target.value as NoticeSettlementAction | '' } : p))}>
                                                <option value="">{t("Not decided")}</option>
                                                {(Object.keys(NOTICE_ACTIONS) as NoticeSettlementAction[]).map((a) => <option key={a} value={a}>{t(NOTICE_ACTIONS[a])}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Days")}</label>
                                            <input type="number" min={0} max={viewing.noticeRecoveryDays ?? 0} placeholder={String(viewing.noticeRecoveryDays ?? 0)}
                                                value={terms.noticeAction === 'WAIVE' ? '0' : terms.noticeSettlementDays}
                                                disabled={!termsEditable(viewing) || !terms.noticeAction || terms.noticeAction === 'WAIVE'} className={inputClass}
                                                onChange={(e) => setTerms((p) => (p ? { ...p, noticeSettlementDays: e.target.value } : p))} />
                                        </div>
                                        <div>
                                            <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Remark")}</label>
                                            <input type="text" maxLength={500} value={terms.noticeRemark} disabled={!termsEditable(viewing)} className={inputClass}
                                                placeholder={t("e.g. manager agreed to early release")}
                                                onChange={(e) => setTerms((p) => (p ? { ...p, noticeRemark: e.target.value } : p))} />
                                        </div>

                                        <div>
                                            <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Severance")}</label>
                                            <select value={terms.severanceBasis} disabled={!termsEditable(viewing)} className={inputClass}
                                                onChange={(e) => setTerms((p) => (p ? { ...p, severanceBasis: e.target.value as SeveranceBasis | '' } : p))}>
                                                <option value="">{t("None")}</option>
                                                {(Object.keys(SEVERANCE_BASES) as SeveranceBasis[]).map((b) => <option key={b} value={b}>{t(SEVERANCE_BASES[b])}</option>)}
                                            </select>
                                        </div>
                                        {terms.severanceBasis && (
                                            <>
                                                <div>
                                                    <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                        {t(terms.severanceBasis === 'FIXED_AMOUNT' ? 'Amount' : 'Months')}
                                                    </label>
                                                    <input type="number" min={0} step={terms.severanceBasis === 'FIXED_AMOUNT' ? 0.01 : 0.5} disabled={!termsEditable(viewing)} className={inputClass}
                                                        value={terms.severanceBasis === 'FIXED_AMOUNT' ? terms.severanceAmount : terms.severanceMonths}
                                                        onChange={(e) => setTerms((p) => (p ? (p.severanceBasis === 'FIXED_AMOUNT'
                                                            ? { ...p, severanceAmount: e.target.value } : { ...p, severanceMonths: e.target.value }) : p))} />
                                                </div>
                                                <div>
                                                    <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Paid")}</label>
                                                    <div className="flex gap-2">
                                                        <select value={terms.severancePayout} disabled={!termsEditable(viewing)} className={inputClass}
                                                            onChange={(e) => setTerms((p) => (p ? { ...p, severancePayout: e.target.value as SeverancePayout } : p))}>
                                                            <option value="LUMP_SUM">{t("With the F&F")}</option>
                                                            <option value="MONTHLY">{t("Monthly after exit")}</option>
                                                        </select>
                                                        {terms.severancePayout === 'MONTHLY' && (
                                                            <input type="number" min={1} max={24} title={t("Instalments")} disabled={!termsEditable(viewing)}
                                                                className="h-8 w-16 rounded-lg border border-gray-300 px-2 text-xs dark:border-gray-700 dark:bg-[#222222] dark:text-white"
                                                                value={terms.severanceInstalments}
                                                                onChange={(e) => setTerms((p) => (p ? { ...p, severanceInstalments: e.target.value } : p))} />
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <div className="sm:col-span-3">
                                            <div className="mb-1 flex items-center justify-between">
                                                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Other earnings / deductions")}</label>
                                                {termsEditable(viewing) && (
                                                    <button type="button" className={`${actionButton} border-cyan-200 text-cyan-700 hover:bg-cyan-50`}
                                                        onClick={() => setTerms((p) => (p ? { ...p, lines: [...p.lines, { name: '', type: 'DEDUCTION', amount: '', taxable: true }] } : p))}>
                                                        + {t("Add line")}
                                                    </button>
                                                )}
                                            </div>
                                            {terms.lines.length === 0 && <p className="text-[10px] text-gray-500">{t("e.g. pending bonus, asset not returned, loan recovery")}</p>}
                                            {terms.lines.map((line, i) => (
                                                <div key={i} className="mb-1.5 grid grid-cols-12 items-center gap-2">
                                                    <input type="text" maxLength={100} placeholder={t("Name")} value={line.name} disabled={!termsEditable(viewing)}
                                                        className={`${inputClass} col-span-5`} onChange={(e) => updateLine(i, { name: e.target.value })} />
                                                    <select value={line.type} disabled={!termsEditable(viewing)} className={`${inputClass} col-span-2`}
                                                        onChange={(e) => updateLine(i, { type: e.target.value as LineType })}>
                                                        <option value="EARNING">{t("Earning")}</option>
                                                        <option value="DEDUCTION">{t("Deduction")}</option>
                                                    </select>
                                                    <input type="number" min={0} step={0.01} placeholder={t("Amount")} value={line.amount} disabled={!termsEditable(viewing)}
                                                        className={`${inputClass} col-span-2`} onChange={(e) => updateLine(i, { amount: e.target.value })} />
                                                    <label className="col-span-2 flex items-center gap-1 text-[10px] text-gray-600">
                                                        <input type="checkbox" checked={line.type === 'EARNING' && line.taxable} disabled={!termsEditable(viewing) || line.type !== 'EARNING'}
                                                            onChange={(e) => updateLine(i, { taxable: e.target.checked })} />
                                                        {t("Taxable")}
                                                    </label>
                                                    {termsEditable(viewing) && (
                                                        <button type="button" aria-label={t("Remove")} className="col-span-1 text-gray-400 hover:text-red-500"
                                                            onClick={() => setTerms((p) => (p ? { ...p, lines: p.lines.filter((_, j) => j !== i) } : p))}>
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {termsEditable(viewing) && (
                                        <div className="mt-2 flex justify-end">
                                            <button type="button" onClick={saveTerms} disabled={savingTerms}
                                                className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                                                {t(savingTerms ? 'Saving...' : 'Save settlement terms')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
                            <button type="button" onClick={() => setViewing(null)}
                                className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                                {t(editable(viewing) ? 'Cancel' : 'Close')}
                            </button>
                            {editable(viewing) && (
                                <button type="button" onClick={saveDetails} disabled={savingEdit}
                                    className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                                    {t(savingEdit ? 'Saving...' : 'Save changes')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {settlementId != null && <SettlementStatementDialog exitRequestId={settlementId} onClose={() => setSettlementId(null)} />}
        </>
    );
};

export default ExitApprovalsPage;
