import axios from "axios";

// Shared calls and labels for the attendance pages (attendance service under /v1/api/attendance).
export const ATTENDANCE_API = "/v1/api/attendance";

/** The server's error message, or the fallback. */
export const apiError = (err: any, fallback: string): string => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  return data?.message || data?.error || fallback;
};

export interface LeaveBalance {
  id: number;
  leaveType: string;
  leavePolicyName?: string;
  allocatedLeaves: number;
  usedLeaves: number;
  pendingApprovalLeaves: number;
  adjustedLeaves?: number;
  carryForwardLeaves?: number;
  availableLeaves: number;
  financialYear: number;
}

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
  MATERNITY: "Maternity",
  PATERNITY: "Paternity",
  BEREAVEMENT: "Bereavement",
  MARRIAGE: "Marriage",
  COMPENSATORY_OFF: "Comp off",
  LOSS_OF_PAY: "Loss of pay",
};

export const leaveTypeLabel = (type?: string | null) =>
  type ? LEAVE_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "";

/** Days still free to book: available minus what is waiting for approval. */
export const freeDays = (b: LeaveBalance) => Math.max(0, (b.availableLeaves ?? 0) - (b.pendingApprovalLeaves ?? 0));

/** 1, 1.5, 0.5 — no trailing zeros. */
export const formatDays = (n?: number | null) => (n == null ? "0" : String(Math.round(n * 10) / 10));

export const fetchLeaveBalances = async (employeeId: number): Promise<LeaveBalance[]> => {
  const res = await axios.get(`${ATTENDANCE_API}/employee-leave-balances/${employeeId}`);
  return Array.isArray(res.data) ? res.data : [];
};

/** One day of /records/my-calendar. The server already resolves holidays, weekly offs, approved leave and absence. */
export interface CalendarDay {
  date: string;
  status?: string | null;
  inTime?: string | null;
  outTime?: string | null;
  workedMinutes?: number | null;
  lateMinutes?: number | null;
  earlyExitMinutes?: number | null;
  overtimeMinutes?: number | null;
  leaveType?: string | null;
  holidayName?: string | null;
  weeklyOff?: boolean;
  halfDayLeave?: boolean;
  regularized?: boolean;
  attendanceMode?: string | null;
}

export const fetchMonth = async (year: number, month1: number, employeeId?: number): Promise<CalendarDay[]> => {
  const url = employeeId ? `${ATTENDANCE_API}/records/my-calendar/${employeeId}` : `${ATTENDANCE_API}/records/my-calendar`;
  const res = await axios.get(url, { params: { year, month: month1 } });
  return Array.isArray(res.data?.days) ? res.data.days : [];
};

/** Display bucket for a day: what the calendar colours and filters use. */
export type DayKind = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "LEAVE" | "HOLIDAY" | "WEEK_OFF" | "ON_DUTY" | "WFH" | "CHECKED_IN" | "NONE";

export const dayKind = (d?: CalendarDay | null): DayKind => {
  if (!d?.status) return "NONE";
  switch (d.status) {
    case "PRESENT":
    case "CHECKED_OUT":
      return d.lateMinutes && d.lateMinutes > 0 ? "LATE" : "PRESENT";
    case "LATE":
      return "LATE";
    case "HALF_DAY":
      return "HALF_DAY";
    case "ABSENT":
      return "ABSENT";
    case "ON_LEAVE":
      return "LEAVE";
    case "HOLIDAY":
      return "HOLIDAY";
    case "WEEK_OFF":
      return "WEEK_OFF";
    case "ON_DUTY":
      return "ON_DUTY";
    case "WFH":
      return "WFH";
    case "CHECKED_IN":
      return "CHECKED_IN";
    default:
      return "NONE";
  }
};

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  PRESENT: "Present",
  LATE: "Late",
  HALF_DAY: "Half day",
  ABSENT: "Absent",
  LEAVE: "Leave",
  HOLIDAY: "Holiday",
  WEEK_OFF: "Week off",
  ON_DUTY: "On duty",
  WFH: "Work from home",
  CHECKED_IN: "Checked in",
  NONE: "",
};

export const DAY_KIND_BADGE: Record<DayKind, string> = {
  PRESENT: "P",
  LATE: "LT",
  HALF_DAY: "HD",
  ABSENT: "A",
  LEAVE: "L",
  HOLIDAY: "H",
  WEEK_OFF: "WO",
  ON_DUTY: "OD",
  WFH: "WFH",
  CHECKED_IN: "IN",
  NONE: "",
};

/**
 * "09:35" in the browser's time zone. The attendance service sends date-times with the server's offset
 * ("2026-10-27T04:05:00Z"), so a server running in UTC no longer shows UTC times; a value without an offset
 * (or a bare "09:35") is shown as it is.
 */
export const timeOf = (iso?: string | null) => {
  if (!iso) return "";
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(iso)) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const t = iso.includes("T") ? iso.split("T")[1] : iso;
  return t.slice(0, 5);
};

/** Browser date in the browser's time zone ("2026-10-27") for a date-time from the server. */
export const dateOf = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (!/T.*(Z|[+-]\d{2}:?\d{2})$/.test(iso) || Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "2026-10-27T09:00:00" typed in this browser → "2026-10-27T09:00:00+05:30", so the server stores the right moment. */
export const withBrowserOffset = (localDateTime?: string | null) => {
  if (!localDateTime) return localDateTime ?? null;
  const d = new Date(localDateTime);
  if (Number.isNaN(d.getTime())) return localDateTime;
  const minutes = -d.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

export const hoursOf = (minutes?: number | null) => {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// Browser location for office geofencing; null when unavailable or refused (the server decides if it's needed)
const currentPosition = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });

export type AttendanceMode = "OFFICE" | "WORK_FROM_HOME";

/** Check in or out as the signed-in employee. The server takes the employee, IP and device from the request. */
export const punch = async (kind: "in" | "out", mode: AttendanceMode = "OFFICE", remarks?: string) => {
  const position = await currentPosition();
  const res = await axios.post(`${ATTENDANCE_API}/records/check-${kind}`, {
    attendanceSource: "WEB",
    attendanceMode: mode,
    ...(position ?? {}),
    ...(remarks ? { remarks } : {}),
  });
  return res.data;
};
