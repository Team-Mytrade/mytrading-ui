import axios from 'axios';

// SUBMITTED / UNDER_REVIEW await HR; APPROVED / NOTICE_PERIOD run to the last working day; the rest are closed
export type ExitStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'NOTICE_PERIOD' | 'REJECTED' | 'REVERTED' | 'COMPLETED' | 'CANCELLED';

export interface ExitRequest {
    id?: number;
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
}

const EXIT_API_URL = "/v1/api/payroll/exit";

const withReason = (reason?: string) => (reason ? { params: { reason } } : undefined);

export const ExitManagementService = {
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
