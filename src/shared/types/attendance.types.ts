import { Employee } from "../types/employee.types";

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'On Leave';

export interface AttendanceRecord {
    id: number;
    employee: Partial<Employee>;
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    totalHours?: string;
    status: AttendanceStatus;
    late: boolean;
    halfDay: boolean;
    absent: boolean;
    onLeave?: boolean;
    remarks?: string;
}

export interface AttendanceCreateInput {
    employee: {
        id: number;
    };
    date: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    remarks?: string;
    late: boolean;
    halfDay: boolean;
    absent: boolean;
}

export interface AttendanceUpdateInput extends AttendanceCreateInput {
    id: number;
}

export interface AttendanceStats {
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    totalHalfDay: number;
    avgWorkingHours: string;
    onTimePercentage: number;
}