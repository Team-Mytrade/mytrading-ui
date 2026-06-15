export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export type LeaveType = 'Annual' | 'Sick' | 'Casual' | 'Maternity' | 'Paternity' | 'Unpaid' | 'Other';

export interface LeaveRequest {
    id: number;
    employee: {
        id: number;
        firstName?: string;
        lastName?: string;
        employeeCode?: string;
    };
    leaveType: LeaveType;
    startDate: string; // ISO date
    endDate: string; // ISO date
    reason: string;
    status: LeaveStatus;
    appliedDate: string; // ISO date
    approvedBy?: string;
    remarks?: string;
}

export interface LeaveBalance {
    employeeId: number;
    annual: number;
    sick: number;
    casual: number;
    used: number;
}

export interface LeaveCreateInput {
    employee: { id: number };
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
}