import { t } from "../../i18n/i18n";
import React, { useState, useEffect } from 'react';
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
    const [edit, setEdit] = useState({ lastWorkingDay: '', reason: '', exitInterviewFeedback: '' });
    const [savingEdit, setSavingEdit] = useState(false);

    const openDetails = (row: ExitRequest) => {
        setViewing(row);
        setEdit({ lastWorkingDay: row.lastWorkingDay || '', reason: row.reason || '', exitInterviewFeedback: row.exitInterviewFeedback || '' });
    };
    const editable = (row: ExitRequest | null) => !!row && !!row.active && (UNDECIDED.includes(row.status) || ACCEPTED.includes(row.status));

    const saveDetails = async () => {
        if (!viewing?.id) return;
        if (!edit.lastWorkingDay) return ToasterService.warning("Pick the last working day");
        if (edit.lastWorkingDay < viewing.resignationDate) return ToasterService.warning("The last working day can't be before the resignation date");
        setSavingEdit(true);
        try {
            const saved = await ExitManagementService.updateExitDetails({
                id: viewing.id,
                lastWorkingDay: edit.lastWorkingDay,
                reason: edit.reason.trim() || undefined,
                exitInterviewFeedback: edit.exitInterviewFeedback.trim() || undefined,
            });
            ToasterService.success("Exit details saved");
            setViewing(saved);
            await fetchRequests();
        } catch (error) {
            ToasterService.error(apiError(error, "The exit details were not saved"));
        } finally {
            setSavingEdit(false);
        }
    };

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

                        {ACCEPTED.includes(row.status) && !row.withdrawalRequested && (
                            <>
                                <button disabled={busy}
                                    onClick={() => act(row, () => ExitManagementService.updateClearance(id, !row.clearanceCompleted),
                                        row.clearanceCompleted ? "Clearance reopened" : "Clearance recorded")}
                                    className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    {t(row.clearanceCompleted ? 'Undo clearance' : 'Clearance done')}
                                </button>
                                <button disabled={busy}
                                    title={t("The settlement is the last month's pay: run that month's payroll first")}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
                    <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl dark:bg-[#191919]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-3 dark:border-[#2a2a2a]">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{viewing.employeeName || `EMP-${viewing.employeeId}`}</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {viewing.employeeCode || '—'} · {viewing.designation || '—'} · {STATUS_LABEL[viewing.status] || viewing.status}
                                </p>
                            </div>
                            <button type="button" onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600" aria-label={t("Close")}><X size={18} /></button>
                        </div>

                        <div className="space-y-4 px-5 py-4 text-xs">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-3 dark:border-[#2a2a2a] dark:bg-[#222222]">
                                {([
                                    ['Resigned on', showDate(viewing.resignationDate)],
                                    ['Notice', viewing.noticeDays != null ? `${viewing.noticeDays} days` : '—'],
                                    ['Location', viewing.location || '—'],
                                    ['Phone', viewing.employeePhone || '—'],
                                    ['Approved on', showDate(viewing.approvedDate)],
                                    ['Notice started', showDate(viewing.noticePeriodStartDate)],
                                    ['Clearance', viewing.clearanceCompleted ? 'Done' : 'Pending'],
                                    ['Final settlement', viewing.finalSettlementProcessed ? 'Done' : 'Pending'],
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
                                <div className="sm:col-span-2">
                                    <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">{t("Exit interview notes")}</label>
                                    <textarea rows={3} value={edit.exitInterviewFeedback} maxLength={2000} disabled={!editable(viewing)}
                                        onChange={(e) => setEdit((p) => ({ ...p, exitInterviewFeedback: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs disabled:bg-gray-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white" />
                                </div>
                            </div>
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
        </>
    );
};

export default ExitApprovalsPage;
