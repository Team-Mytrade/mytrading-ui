import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Download, PlayCircle, RefreshCw } from 'lucide-react';
import { CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import StatsCard from '../../components/common/Statscard';
import ReusableTable, { ColumnDef } from '../../components/common/Table';
import { usePermissions } from '../../access/usePermissions';
import { ToasterService } from '../../Services/ToasterService';
import { apiError } from '../../utils/apiError';
import { t } from '../../i18n/i18n';
import {
    FinalSettlementCandidate, FinalSettlementRunResult, FinalSettlementService, PaidSettlement,
} from '../../Services/FinalSettlementService';
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, STATS_ROW, TOOL_BUTTON } from './hrmsUi';
import { SEPARATION_LABELS } from './settlementStatement';

const showDate = (iso?: string | null) => (iso ? iso.split('-').reverse().join('/') : '-');
const money = (n?: number | null) => (n == null ? '-' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const keyOf = (c: FinalSettlementCandidate) => (c.kind === 'FINAL' ? `E${c.exitRequestId}` : `I${c.instalmentId}`);

const NOTICE_LABEL: Record<string, string> = { RECOVER: 'Recover', PAY_IN_LIEU: 'Pay in lieu', WAIVE: 'Waived' };

const STATE_BADGE: Record<string, { label: string; className: string }> = {
    DUE: { label: 'Due', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    NOT_DUE: { label: 'Not due yet', className: 'bg-slate-100 text-slate-600 border-slate-200' },
    BLOCKED: { label: 'Action needed', className: 'bg-amber-50 text-amber-700 border-amber-100' },
};

const saveBlob = (data: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

/**
 * Full & Final: employees serving notice are held out of the regular payroll; here HR/managers see who is due a
 * settlement, pay the chosen ones as one run (with its own bank sheet), and download what was paid.
 */
const FinalSettlementPage: React.FC = () => {
    const { canApprove, canExport } = usePermissions('HRM');
    const [candidates, setCandidates] = useState<FinalSettlementCandidate[]>([]);
    const [paid, setPaid] = useState<PaidSettlement[]>([]);
    const [loading, setLoading] = useState(false);
    const [running, setRunning] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [lastRun, setLastRun] = useState<FinalSettlementRunResult | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [c, p] = await Promise.all([FinalSettlementService.getCandidates(), FinalSettlementService.getPaid()]);
            setCandidates((c || []).map((x) => ({ ...x, id: keyOf(x) })));
            setPaid(p || []);
            // Keep only selections that can still be paid
            setSelected((prev) => new Set([...prev].filter((k) => (c || []).some((x) => keyOf(x) === k && x.state === 'DUE'))));
        } catch (error) {
            ToasterService.error(apiError(error, 'The full and final settlements could not be loaded'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (canApprove) load();
    }, [canApprove]);

    const due = useMemo(() => candidates.filter((c) => c.state === 'DUE'), [candidates]);
    const allDueSelected = due.length > 0 && due.every((c) => selected.has(keyOf(c)));

    const toggle = (c: FinalSettlementCandidate) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(keyOf(c))) next.delete(keyOf(c));
            else next.add(keyOf(c));
            return next;
        });
    };

    const toggleAll = () => setSelected(allDueSelected ? new Set() : new Set(due.map(keyOf)));

    const runSelected = async () => {
        const chosen = candidates.filter((c) => selected.has(keyOf(c)));
        if (chosen.length === 0) return ToasterService.warning('Choose the employees to settle');
        const exitIds = chosen.filter((c) => c.kind === 'FINAL').map((c) => c.exitRequestId);
        const instalmentIds = chosen.filter((c) => c.kind === 'SEVERANCE_INSTALMENT').map((c) => c.instalmentId!);
        if (!window.confirm(`Pay the full and final settlement of ${chosen.length} item(s)? This creates a payroll batch and its bank sheet.`)) return;
        setRunning(true);
        try {
            const result = await FinalSettlementService.run(exitIds, instalmentIds);
            setLastRun(result);
            setSelected(new Set());
            ToasterService.success(`Full and final run ${result.batchReference} processed`,
                result.approvalState === 'PENDING_APPROVAL'
                    ? 'Waiting for approval on Payroll Engine: the bank sheet and payslips follow it'
                    : `${result.employeeCount} employee(s), net ${money(result.totalNetPay)}`);
            if (result.payslipProblem) ToasterService.warning(result.payslipProblem);
            await load();
        } catch (error) {
            ToasterService.error(apiError(error, 'The full and final run failed'));
        } finally {
            setRunning(false);
        }
    };

    const downloadSheet = async (batchReference?: string | null) => {
        if (!batchReference) return;
        try {
            saveBlob(await FinalSettlementService.downloadBankSheet(batchReference), `Bank_Transfer_${batchReference}.xlsx`);
            ToasterService.success('Bank transfer sheet downloaded');
        } catch (error) {
            const data = (error as { response?: { data?: unknown } })?.response?.data;
            const text = data instanceof Blob ? await data.text() : '';
            let message = '';
            try { message = JSON.parse(text).message; } catch { message = ''; }
            ToasterService.error(message || apiError(error, 'The bank sheet could not be downloaded'));
        }
    };

    if (!canApprove) {
        return (
            <div className={PAGE_BODY}>
                <p className="text-sm text-slate-500">{t('You need HRM approve permission to see full and final settlements.')}</p>
            </div>
        );
    }

    const columns: ColumnDef<FinalSettlementCandidate>[] = [
        {
            key: 'select',
            label: '',
            headerClassName: 'w-8',
            className: 'w-8',
            excludeFromDetails: true,
            render: (c) => (
                <input type="checkbox" aria-label={t('Select')} disabled={c.state !== 'DUE'} checked={selected.has(keyOf(c))}
                    onClick={(e) => e.stopPropagation()} onChange={() => toggle(c)}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 disabled:opacity-30" />
            ),
        },
        {
            key: 'employeeName',
            label: 'Employee',
            sortable: true,
            render: (c) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white">{c.employeeName || `EMP-${c.employeeId}`}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.employeeCode || '—'} • {c.department || c.designation || '—'}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {c.kind === 'FINAL'
                            ? t(SEPARATION_LABELS[c.separationType || 'RESIGNATION'] || 'Resignation')
                            : `${t('Severance instalment')} ${c.instalmentNo} / ${c.instalments ?? '?'}`}
                    </span>
                </div>
            ),
        },
        {
            key: 'lastWorkingDay',
            label: 'LWD / Due',
            sortable: true,
            render: (c) => (
                <div className="flex flex-col text-xs">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('LWD:')} {showDate(c.lastWorkingDay)}</span>
                    <span className="text-[10px] text-gray-500">{t('Due:')} {showDate(c.dueDate)}</span>
                </div>
            ),
        },
        {
            key: 'months',
            label: 'Salary months',
            render: (c) => <span className="text-xs text-gray-700 dark:text-gray-300">{c.months.length ? c.months.join(', ') : '—'}</span>,
        },
        {
            key: 'notice',
            label: 'Notice',
            render: (c) => (c.kind !== 'FINAL' ? <span className="text-xs text-gray-400">—</span> : (
                <div className="flex flex-col text-xs">
                    <span className="text-gray-700 dark:text-gray-300">
                        {c.noticeShortfallDays ? `${c.noticeShortfallDays} ${t('days not served')}` : t('Served in full')}
                    </span>
                    {!!c.noticeShortfallDays && (
                        <span className={`text-[10px] ${c.noticeAction ? 'text-gray-500' : 'font-semibold text-amber-600'}`}>
                            {c.noticeAction ? `${t(NOTICE_LABEL[c.noticeAction])}${c.noticeAction !== 'WAIVE' ? ` ${c.noticeSettlementDays ?? c.noticeShortfallDays} ${t('days')}` : ''}` : t('Not decided')}
                        </span>
                    )}
                </div>
            )),
        },
        {
            key: 'lines',
            label: 'Settlement lines',
            render: (c) => (
                <div className="flex max-w-[280px] flex-col gap-0.5 text-[11px]">
                    {c.lines.length === 0 && <span className="text-gray-400">{t('Salary only')}</span>}
                    {c.lines.map((l, i) => (
                        <span key={i} title={l.note || undefined} className={l.type === 'DEDUCTION' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}>
                            {l.type === 'DEDUCTION' ? '−' : '+'} {l.name}: {money(l.amount)}{l.type === 'EARNING' && !l.taxable ? ` (${t('tax-free')})` : ''}
                        </span>
                    ))}
                </div>
            ),
        },
        {
            key: 'state',
            label: 'Status',
            sortable: true,
            render: (c) => (
                <div className="flex max-w-[260px] flex-col items-start gap-1">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATE_BADGE[c.state]?.className}`}>
                        {t(STATE_BADGE[c.state]?.label || c.state)}
                    </span>
                    {c.blockers.map((b, i) => <span key={i} className="text-[10px] text-amber-700 dark:text-amber-300">• {b}</span>)}
                    {c.notes.map((n, i) => <span key={`n${i}`} className="text-[10px] text-gray-500">• {n}</span>)}
                </div>
            ),
        },
    ];

    const paidColumns: ColumnDef<PaidSettlement>[] = [
        {
            key: 'employeeName',
            label: 'Employee',
            sortable: true,
            render: (p) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white">{p.employeeName || `EMP-${p.employeeId}`}</span>
                    <span className="text-[10px] text-gray-500">{p.employeeCode || '—'} • {p.kind === 'FINAL' ? t('Full & final') : `${t('Severance instalment')} ${p.instalmentNo}`}</span>
                </div>
            ),
        },
        { key: 'months', label: 'Salary months', render: (p) => <span className="text-xs">{(p.months || '').split(',').join(', ') || '—'}</span> },
        { key: 'processedOn', label: 'Paid on', sortable: true, render: (p) => <span className="text-xs">{showDate(p.processedOn)}{p.processedBy ? ` · ${p.processedBy}` : ''}</span> },
        { key: 'netPay', label: 'Net pay', sortable: true, render: (p) => <span className="text-xs font-semibold">{money(p.netPay)} {p.currency || ''}</span> },
        {
            key: 'batchReference',
            label: 'Batch',
            render: (p) => (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="font-mono text-[11px]">{p.batchReference}</span>
                    {canExport && (
                        <button type="button" className={TOOL_BUTTON} onClick={() => downloadSheet(p.batchReference)} title={t('Download the bank sheet')}>
                            <Download className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title={t('Full & Final')} description="Pay the full and final settlement of leaving employees and download its bank sheet" />
            <PageBreadcrumb
                pageTitle="Full & Final"
                actions={
                    <button type="button" className={TOOL_BUTTON} onClick={load} disabled={loading}>
                        <RefreshCw className="h-3.5 w-3.5" /> {t('Refresh')}
                    </button>
                }
            />
            <div className={PAGE_BODY}>
                <p className="mb-3 rounded-lg border border-[rgb(var(--brand-100,178_235_242))] bg-[rgb(var(--brand-50,224_247_250))] px-3 py-2 text-xs text-slate-700">
                    {t('Employees serving notice are held out of the regular payroll from the month before their last working day. Their held months and settlement lines are paid here once due. Decide notice recovery, severance and other lines on')}{' '}
                    <Link to="/exitApprovals" className="font-semibold text-[rgb(var(--brand-700,0_111_122))] hover:underline">{t('Exit Approvals')}</Link>.
                </p>

                <div className={STATS_ROW}>
                    <StatsCard label={t('Due now')} value={due.length} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" icon={<CheckCircleIcon className="h-5 w-5" />} />
                    <StatsCard label={t('Not due yet')} value={candidates.filter((c) => c.state === 'NOT_DUE').length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" icon={<ClockIcon className="h-5 w-5" />} />
                    <StatsCard label={t('Action needed')} value={candidates.filter((c) => c.state === 'BLOCKED').length} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" icon={<ExclamationTriangleIcon className="h-5 w-5" />} />
                    <StatsCard label={t('Paid')} value={paid.length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" icon={<BanknotesIcon className="h-5 w-5" />} onRefresh={load} />
                </div>

                {lastRun && (
                    <div className={`${CARD} mb-4 flex flex-wrap items-center justify-between gap-3 p-4`}>
                        <div>
                            <h3 className={CARD_TITLE}>{t('Run')} {lastRun.batchReference} {t('processed')}</h3>
                            <p className="text-xs text-slate-500">
                                {lastRun.employeeCount} {t('employee(s)')} · {t('net')} {money(lastRun.totalNetPay)} · {t('months')} {lastRun.months.join(', ')} · {lastRun.payslipsGenerated} {t('payslip(s)')}
                            </p>
                        </div>
                        {lastRun.approvalState === 'PENDING_APPROVAL' && (
                            <p className="text-xs font-semibold text-amber-700">{t('Waiting for approval on Payroll Engine; the bank sheet is released once approved.')}</p>
                        )}
                        {canExport && lastRun.approvalState !== 'PENDING_APPROVAL' && (
                            <button type="button" className={PRIMARY_BUTTON} onClick={() => downloadSheet(lastRun.batchReference)}>
                                <Download className="h-4 w-4" /> {t('Download bank sheet')}
                            </button>
                        )}
                    </div>
                )}

                <div className={`${CARD} p-4`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className={CARD_TITLE}>{t('Leaving employees')} ({candidates.length})</h3>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-gray-300">
                                <input type="checkbox" checked={allDueSelected} disabled={due.length === 0} onChange={toggleAll}
                                    className="h-4 w-4 rounded border-gray-300 text-cyan-600" />
                                {t('Select all due')}
                            </label>
                            <button type="button" className={PRIMARY_BUTTON} disabled={running || selected.size === 0} onClick={runSelected}>
                                <PlayCircle className="h-4 w-4" /> {running ? t('Processing...') : `${t('Run F&F')} (${selected.size})`}
                            </button>
                        </div>
                    </div>
                    <ReusableTable
                        data={candidates}
                        columns={columns}
                        loading={loading}
                        pageSize={10}
                        defaultSortKey="lastWorkingDay"
                        defaultSortOrder="asc"
                        rowDetailsTitle={(c) => `${c.employeeName || c.employeeId} · ${c.kind === 'FINAL' ? 'Full & final' : 'Severance instalment'}`}
                        emptyState={
                            <div className="flex flex-col items-center justify-center py-12">
                                <AlertCircle className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                                <p className="text-sm text-gray-500 dark:text-slate-400">{t('No one is serving notice')}</p>
                            </div>
                        }
                    />
                </div>

                <div className={`${CARD} mt-4 p-4`}>
                    <h3 className={`${CARD_TITLE} mb-3`}>{t('Paid settlements')} ({paid.length})</h3>
                    <ReusableTable
                        data={paid}
                        columns={paidColumns}
                        loading={loading}
                        pageSize={10}
                        defaultSortKey="processedOn"
                        defaultSortOrder="desc"
                        rowDetailsTitle={(p) => `${p.employeeName || p.employeeId} · ${p.batchReference}`}
                    />
                </div>
            </div>
        </>
    );
};

export default FinalSettlementPage;
