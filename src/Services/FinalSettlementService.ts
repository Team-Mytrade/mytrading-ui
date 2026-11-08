import axios from 'axios';
import { ExitStatus } from './ExitManagementService';

export type NoticeSettlementAction = 'RECOVER' | 'PAY_IN_LIEU' | 'WAIVE';
export type SeveranceBasis = 'MONTHS_GROSS' | 'MONTHS_BASIC' | 'FIXED_AMOUNT';
export type SeverancePayout = 'LUMP_SUM' | 'MONTHLY';
export type LineType = 'EARNING' | 'DEDUCTION';
// DUE: can be paid now; NOT_DUE: the due date is later; BLOCKED: see blockers
export type CandidateState = 'DUE' | 'NOT_DUE' | 'BLOCKED';

export interface SettlementLine {
    name: string;
    type: LineType;
    amount: number;
    taxable?: boolean | null;
}

export interface CandidateLine {
    name: string;
    type: LineType;
    amount: number;
    taxable: boolean;
    note?: string | null;
}

/** A leaving employee (or a severance instalment) on the Full & Final page. */
export interface FinalSettlementCandidate {
    // Row key for the table: E<exit id> or I<instalment id>
    id?: string;
    kind: 'FINAL' | 'SEVERANCE_INSTALMENT';
    exitRequestId: number;
    instalmentId?: number | null;
    instalmentNo?: number | null;
    instalments?: number | null;
    employeeId: number;
    employeeCode?: string | null;
    employeeName?: string | null;
    designation?: string | null;
    department?: string | null;
    countryCode?: string | null;
    currency?: string | null;
    separationType?: 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_END' | 'DISMISSAL';
    exitStatus?: ExitStatus;
    resignationDate?: string | null;
    lastWorkingDay?: string | null;
    noticeLastWorkingDay?: string | null;
    noticePeriodDays?: number | null;
    noticeShortfallDays?: number | null;
    noticeAction?: NoticeSettlementAction | null;
    noticeSettlementDays?: number | null;
    clearanceCompleted: boolean;
    dueDate?: string | null;
    months: string[];
    lines: CandidateLine[];
    settlementEarnings: number;
    settlementDeductions: number;
    state: CandidateState;
    blockers: string[];
    notes: string[];
}

export interface FinalSettlementRunResult {
    batchReference: string;
    employeeCount: number;
    totalNetPay: number;
    months: string[];
    payslipsGenerated: number;
    payslipProblem?: string | null;
    // PENDING_APPROVAL when the company approves runs: the bank sheet and payslips follow the approval
    approvalState?: string | null;
}

export interface PaidSettlement {
    id: number;
    kind: 'FINAL' | 'SEVERANCE_INSTALMENT';
    instalmentNo?: number | null;
    exitRequestId: number;
    employeeId: number;
    employeeCode?: string | null;
    employeeName?: string | null;
    months?: string | null;
    dueDate?: string | null;
    processedOn?: string | null;
    processedBy?: string | null;
    batchReference?: string | null;
    totalEarnings?: number | null;
    totalDeductions?: number | null;
    netPay?: number | null;
    currency?: string | null;
}

const FNF_API_URL = '/v1/api/payroll/fnf';

export const FinalSettlementService = {
    getCandidates: async (): Promise<FinalSettlementCandidate[]> => {
        const response = await axios.get(`${FNF_API_URL}/candidates`);
        return response.data;
    },

    getPaid: async (): Promise<PaidSettlement[]> => {
        const response = await axios.get(`${FNF_API_URL}/paid`);
        return response.data;
    },

    // One batch (one bank sheet) for every settlement and instalment chosen
    run: async (exitRequestIds: number[], instalmentIds: number[]): Promise<FinalSettlementRunResult> => {
        const response = await axios.post(`${FNF_API_URL}/run`, { exitRequestIds, instalmentIds });
        return response.data;
    },

    // The run's bank transfer sheet (same file as a payroll run's)
    downloadBankSheet: async (batchReference: string): Promise<Blob> => {
        const response = await axios.get(`/v1/api/payroll/bank-transfer-export/${batchReference}`, { responseType: 'blob' });
        return response.data;
    },
};
