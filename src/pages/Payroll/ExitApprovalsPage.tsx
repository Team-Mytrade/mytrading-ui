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
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">LWD: {showDate(row.lastWorkingDay)}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        Resigned: {showDate(row.resignationDate)}{row.noticeDays != null ? ` • ${row.noticeDays} days` : ''}
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
                            Withdrawal req.
                        </span>
                    )}
                    {ACCEPTED.includes(row.status) && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            Clearance {row.clearanceCompleted ? '✓' : '—'} • Settlement {row.finalSettlementProcessed ? '✓' : '—'}
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
                        {UNDECIDED.includes(row.status) && (rejectingId === id ? (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="text"
                                    placeholder="Reason..."
                                    className="text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded px-2 py-1 outline-none focus:border-red-400 w-32 h-7"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <button onClick={() => handleReject(row)} disabled={busy}
                                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors" title="Confirm Reject">
                                    <Check size={14} />
                                </button>
                                <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                    className="p-1 bg-gray-200 dark:bg-[#222222] text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-[#2a2a2a] transition-colors" title="Cancel">
                                    <X size={14} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button disabled={busy} onClick={() => act(row, () => ExitManagementService.approveExitRequest(id), "Resignation approved")}
                                    className={`${actionButton} border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-transparent dark:text-emerald-400 dark:hover:bg-[#222222]`}>
                                    Approve
                                </button>
                                <button disabled={busy} onClick={() => setRejectingId(id)}
                                    className={`${actionButton} border-red-200 text-red-600 hover:bg-red-50 dark:border-transparent dark:text-rose-400 dark:hover:bg-[#222222]`}>
                                    Reject
                                </button>
                            </>
                        ))}

                        {row.withdrawalRequested && (
                            <>
                                <button disabled={busy} title={row.revertReason || undefined}
                                    onClick={() => act(row, () => ExitManagementService.revertResignation(row.employeeId, row.revertReason || "Withdrawal accepted"), "Resignation withdrawn")}
                                    className={`${actionButton} border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-transparent dark:text-blue-400 dark:hover:bg-[#222222]`}>
                                    Accept withdrawal
                                </button>
                                <button disabled={busy}
                                    onClick={() => act(row, () => ExitManagementService.declineWithdrawal(id), "Withdrawal declined")}
                                    className={`${actionButton} border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    Decline
                                </button>
                            </>
                        )}

                        {row.status === 'APPROVED' && !row.withdrawalRequested && (
                            <button disabled={busy} onClick={() => act(row, () => ExitManagementService.startNoticePeriod(id), "Notice period started")}
                                className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                Start notice
                            </button>
                        )}

                        {ACCEPTED.includes(row.status) && !row.withdrawalRequested && (
                            <>
                                <button disabled={busy}
                                    onClick={() => act(row, () => ExitManagementService.updateClearance(id, !row.clearanceCompleted),
                                        row.clearanceCompleted ? "Clearance reopened" : "Clearance recorded")}
                                    className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    {row.clearanceCompleted ? 'Undo clearance' : 'Clearance done'}
                                </button>
                                <button disabled={busy}
                                    title="The settlement is the last month's pay: run that month's payroll first"
                                    onClick={() => act(row, () => ExitManagementService.updateSettlement(id, !row.finalSettlementProcessed),
                                        row.finalSettlementProcessed ? "Settlement reopened" : "Settlement recorded")}
                                    className={`${actionButton} border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-transparent dark:text-gray-300 dark:hover:bg-[#222222]`}>
                                    {row.finalSettlementProcessed ? 'Undo settlement' : 'Settlement done'}
                                </button>
                                <button
                                    disabled={busy || !row.clearanceCompleted || !row.finalSettlementProcessed || !lastDayReached}
                                    title={!lastDayReached ? `Can be completed from ${showDate(row.lastWorkingDay)}` : "Relieve the employee and switch their login off"}
                                    onClick={() => act(row, () => ExitManagementService.completeExit(id), "Exit completed")}
                                    className={`${actionButton} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}>
                                    Complete exit
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
            <PageMeta title="Exit Approvals" description="Admin dashboard to manage exit requests" />
            <PageBreadcrumb pageTitle="Exit Approvals" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">
                <div className="bg-white dark:bg-[#191919] rounded-xl border border-gray-200 dark:!border-transparent shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Exit Requests</h2>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Approve resignations, record clearance and the final settlement, then complete the exit
                            </p>
                        </div>
                        <div className="text-xs font-semibold text-indigo-600 dark:text-gray-300 bg-indigo-50 dark:bg-transparent border border-indigo-100 dark:border-transparent px-3 py-1.5 rounded-lg">
                            Total Requests: {requests.length}
                        </div>
                    </div>

                    <ReusableTable
                        data={requests}
                        columns={columns}
                        loading={loading}
                        searchable={true}
                        searchPlaceholder="Search exit requests by employee or reason..."
                        searchFields={["employeeName", "employeeCode", "reason", "status"]}
                        pageSize={10}
                        defaultSortKey="lastWorkingDay"
                        defaultSortOrder="desc"
                        emptyState={
                            <div className="text-center p-12 bg-gray-50 dark:bg-[#161616] rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">No exit requests found</p>
                            </div>
                        }
                    />
                </div>
            </div>
        </>
    );
};

export default ExitApprovalsPage;
