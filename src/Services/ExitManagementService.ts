import axios from 'axios';
import type { NoticeSettlementAction, SeveranceBasis, SeverancePayout, SettlementLine } from './FinalSettlementService';

// SUBMITTED / UNDER_REVIEW await HR; APPROVED / NOTICE_PERIOD run to the last working day; the rest are closed
export type ExitStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'NOTICE_PERIOD' | 'REJECTED' | 'REVERTED' | 'COMPLETED' | 'CANCELLED';

export interface ExitRequest {
    id?: number;
    // Who raised it (HR may raise it for the employee) and the reporting manager who decides it
    approval?: { submittedByName?: string; onBehalf?: boolean; approverEmployeeId?: number | null } | null;
    resignationDate: string;
    lastWorkingDay: string;
    status: ExitStatus;
    reason: string;
    exitInterviewFeedback?: string;
    clearanceCompleted?: boolean;
    finalSettlementProcessed?: boolean;
    employeeId: number;
    employeeCode?: string;
    employeeName?: string;
    designation?: string;
    location?: string;
    employeePhone?: string;
    managerId?: string;
    revertReason?: string | null;
    revertedDate?: string | null;
    rejectedReason?: string | null;
    rejectedDate?: string | null;
    active?: boolean;
    approvedDate?: string | null;
    noticePeriodStartDate?: string | null;
    relievedDate?: string | null;
    // The employee asked to withdraw an approved resignation; HR decides
    withdrawalRequested?: boolean;
    // Days from the resignation to the last working day
    noticeDays?: number | null;
    // The day the employee asked to leave on (the last working day starts as this; HR may move it)
    proposedLastWorkingDay?: string | null;
    // The fixed notice period (days) and where it ends (resignation date + notice period)
    noticePeriodDays?: number | null;
    noticeLastWorkingDay?: string | null;
    // Notice days not served (last working day to the end of the notice period), recovered from the final pay
    noticeRecoveryDays?: number | null;
    // How the employment ended (decides the Saudi end-of-service award); HR sets it with the exit details
    separationType?: 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_END' | 'DISMISSAL';
    // The employee's payroll country (the Gulf ones have a gratuity and a settlement statement)
    countryCode?: string | null;
    // Annual leave not taken, paid with the final pay (Gulf) / encashed with the full and final settlement
    unusedLeaveDays?: number | null;
    // Full and final settlement terms, decided by HR/admin
    noticeAction?: NoticeSettlementAction | null;
    suggestedNoticeAction?: NoticeSettlementAction | null;
    noticeSettlementDays?: number | null;
    noticeDecidedBy?: string | null;
    noticeDecidedOn?: string | null;
    noticeRemark?: string | null;
    severanceBasis?: SeveranceBasis | null;
    severanceMonths?: number | null;
    severanceAmount?: number | null;
    severancePayout?: SeverancePayout | null;
    severanceInstalments?: number | null;
    settlementLines?: SettlementLine[];
    finalSettlementDueDate?: string | null;
    finalSettlementBatch?: string | null;
}

/** HR/admin's full and final terms (PUT /exit/{id}/settlement-terms). */
export interface SettlementTerms {
    noticeAction: NoticeSettlementAction | null;
    noticeSettlementDays?: number | null;
    noticeRemark?: string | null;
    severanceBasis: SeveranceBasis | null;
    severanceMonths?: number | null;
    severanceAmount?: number | null;
    severancePayout?: SeverancePayout | null;
    severanceInstalments?: number | null;
    settlementLines?: SettlementLine[];
    unusedLeaveDays?: number | null;
}

const EXIT_API_URL = "/v1/api/payroll/exit";

const withReason = (reason?: string) => (reason ? { params: { reason } } : undefined);

export const ExitManagementService = {
    // The fixed notice period (default-notice-period-days in the payroll config)
    getExitConfig: async (): Promise<{ defaultNoticePeriodDays: number }> => {
        const response = await axios.get(`${EXIT_API_URL}/config`);
        return response.data;
    },

    // The caller's own resignation unless HR passes an employee id
    submitExitRequest: async (data: Partial<ExitRequest>): Promise<ExitRequest> => {
        const response = await axios.post(`${EXIT_API_URL}/request/submitExitRequest`, data);
        return response.data;
    },

    // Last working day, reason and exit interview notes of an open resignation
    updateExitDetails: async (data: Partial<ExitRequest>): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/updateExitDetails`, data);
        return response.data;
    },

    // Notice recovery / pay in lieu / waiver, severance, HR's own lines and unused leave (HR/admin only)
    updateSettlementTerms: async (id: number, terms: SettlementTerms): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/${id}/settlement-terms`, terms);
        return response.data;
    },

    rejectResignation: async (employeeId: number, reason: string): Promise<string> => {
        const response = await axios.put(`${EXIT_API_URL}/reject-resignation/${employeeId}`, null, withReason(reason));
        return response.data;
    },

    // HR withdraws the resignation, or accepts the employee's request to withdraw it
    revertResignation: async (employeeId: number, reason: string): Promise<string> => {
        const response = await axios.put(`${EXIT_API_URL}/revert-resignation/${employeeId}`, null, withReason(reason));
        return response.data;
    },

    approveExitRequest: async (id: number): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/${id}/approve`);
        return response.data;
    },

    startNoticePeriod: async (id: number): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/${id}/start-notice-period`);
        return response.data;
    },

    // Needs clearance, the final settlement and the last working day; the employee's login is switched off
    completeExit: async (id: number): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/${id}/complete`);
        return response.data;
    },

    // HR keeps a resignation the employee asked to withdraw
    declineWithdrawal: async (id: number, reason?: string): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/${id}/decline-withdrawal`, null, withReason(reason));
        return response.data;
    },

    updateClearance: async (id: number, clearanceCompleted: boolean): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/clearance/${id}`, null, { params: { clearanceCompleted } });
        return response.data;
    },

    // The settlement is the last month's pay: that month's payroll must be processed first
    updateSettlement: async (id: number, settlementProcessed: boolean): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/settlement/${id}`, null, { params: { settlementProcessed } });
        return response.data;
    },

    getExitRequestByEmployeeId: async (employeeId: number): Promise<ExitRequest[]> => {
        const response = await axios.get(`${EXIT_API_URL}/getExitRequest/${employeeId}`);
        return response.data;
    },

    // The signed-in employee's own resignations, newest first
    getMyExitRequests: async (): Promise<ExitRequest[]> => {
        const response = await axios.get(`${EXIT_API_URL}/my`);
        return response.data;
    },

    // Withdraws at once before HR decides; after approval it asks HR
    withdrawMyResignation: async (reason?: string): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/my/withdraw`, null, withReason(reason));
        return response.data;
    },

    getAllExitRequests: async (): Promise<ExitRequest[]> => {
        const response = await axios.get(`${EXIT_API_URL}/getAllExitRequests`);
        return response.data;
    }
};
