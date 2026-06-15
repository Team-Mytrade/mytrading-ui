export type AttendanceNotificationType =
  | "ATTENDANCE"
  | "LEAVE"
  | "OVERTIME"
  | "PAYROLL"
  | "SYSTEM"
  | "VIOLATION";

export type AttendanceNotificationChannel =
  | "IN_APP"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "PUSH";

export type AttendanceNotificationPriority = "LOW" | "MEDIUM" | "HIGH";

export interface AttendanceNotificationRecord {
  id?: number;
  employeeId: number;
  employeeName: string;
  title: string;
  message: string;
  type: AttendanceNotificationType;
  channel: AttendanceNotificationChannel;
  isRead: boolean;
  createdAt: string;
  priority: AttendanceNotificationPriority;
  referenceId: number | null;
  referenceType: string | null;
}

const STORAGE_KEY = "attendance-topbar-notifications";
export const ATTENDANCE_NOTIFICATIONS_UPDATED = "attendance-notifications-updated";

const isBrowser = typeof window !== "undefined";

export const getStoredAttendanceNotifications = (): AttendanceNotificationRecord[] => {
  if (!isBrowser) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveAttendanceNotifications = (
  notifications: AttendanceNotificationRecord[]
) => {
  if (!isBrowser) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  window.dispatchEvent(new CustomEvent(ATTENDANCE_NOTIFICATIONS_UPDATED));
};

export const updateAttendanceNotifications = (
  updater: (notifications: AttendanceNotificationRecord[]) => AttendanceNotificationRecord[]
) => {
  const next = updater(getStoredAttendanceNotifications());
  saveAttendanceNotifications(next);
  return next;
};

export const getAttendanceNotificationById = (id: number) =>
  getStoredAttendanceNotifications().find((notification) => notification.id === id) ?? null;

export const markAttendanceNotificationAsRead = (id: number) =>
  updateAttendanceNotifications((notifications) =>
    notifications.map((notification) =>
      notification.id === id ? { ...notification, isRead: true } : notification
    )
  );

export const formatNotificationTime = (createdAt: string) => {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return "Just now";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return new Date(createdAt).toLocaleDateString();
};
