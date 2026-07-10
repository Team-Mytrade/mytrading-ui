import axios from 'axios';

export interface ExitRequest {
    id?: number;
    resignationDate: string;
    lastWorkingDay: string;
    status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVERTED' | 'Pending' | 'Completed' | 'WITHDRAW_REQUESTED' | 'WITHDRAW_APPROVED';
    reason: string;
    exitInterviewFeedback?: string;
    clearanceCompleted?: boolean;
    finalSettlementProcessed?: boolean;
    employeeId: number;
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
}

const EXIT_API_URL = "/v1/api/payroll/exit";

export const ExitManagementService = {
    // 1) Create Exit request
    submitExitRequest: async (data: Partial<ExitRequest>): Promise<ExitRequest> => {
        const response = await axios.post(`${EXIT_API_URL}/request/submitExitRequest`, data);
        return response.data;
    },

    // 2) Update Exit request
    updateExitDetails: async (data: Partial<ExitRequest>): Promise<ExitRequest> => {
        const response = await axios.put(`${EXIT_API_URL}/updateExitDetails`, data);
        return response.data;
    },

    // 3) Reject Resignation by employee id
    rejectResignation: async (employeeId: number, reason: string): Promise<any> => {
        const response = await axios.put(`${EXIT_API_URL}/reject-resignation/${employeeId}?reason=${encodeURIComponent(reason)}`);
        return response.data;
    },

    // 4) Revert Resignation by employee id and reason
    revertResignation: async (employeeId: number, reason: string): Promise<any> => {
        const response = await axios.put(`${EXIT_API_URL}/revert-resignation/${employeeId}?reason=${encodeURIComponent(reason)}`);
        return response.data;
    },

    // 5) Approve Exit Request by Exit req ID
    approveExitRequest: async (id: number): Promise<any> => {
        const response = await axios.put(`${EXIT_API_URL}/${id}/approve`);
        return response.data;
    },

    // 6) Get exit request by employeeId
    getExitRequestByEmployeeId: async (employeeId: number): Promise<ExitRequest[]> => {
        const response = await axios.get(`${EXIT_API_URL}/getExitRequest/${employeeId}`);
        return response.data;
    },

    // 7) Get All exit Request
    getAllExitRequests: async (): Promise<ExitRequest[]> => {
        const response = await axios.get(`${EXIT_API_URL}/getAllExitRequests`);
        return response.data;
    }
};
