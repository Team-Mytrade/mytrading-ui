// The notification service (/v1/api/eventnotify): the signed-in user's bell, and the company's notification
// settings and email templates (changing those needs USERS:ADMIN).
import axios, { AxiosRequestConfig } from "axios";

const BASE = "/v1/api/eventnotify";
// Marking items read is bookkeeping: no "Saved" toast (see AuthContext)
const QUIET = { quiet: true } as AxiosRequestConfig;

export type NotificationCategory = "APPROVAL" | "STOCK" | "INVOICE" | "PAYMENT" | "SYSTEM";

export interface InboxItem {
  id: number;
  category: NotificationCategory;
  priority?: "LOW" | "MEDIUM" | "HIGH" | null;
  title: string;
  message?: string | null;
  // App page to open, e.g. /purchase-service/requisitions?requisitionId=12
  link?: string | null;
  // UTC instants
  raisedAt: string;
  readAt?: string | null;
  // No longer needs action (someone decided it, it was paid, stock is back)
  resolved: boolean;
}

export interface NotificationSettings {
  emailApprovals: boolean;
  emailLowStock: boolean;
  emailOverdueInvoices: boolean;
  dunningEnabled: boolean;
  dunningDaysBefore: number;
  dunningRepeatDays: number;
  dunningMaxReminders: number;
  replyTo?: string | null;
}

export interface EmailTemplate {
  code: string;
  name: string;
  subject: string;
  body: string;
  placeholders: string[];
  // The company changed it (else the built-in text)
  customised: boolean;
}

// Fired when items are read or dismissed, so the bell's count follows
export const NOTIFICATIONS_CHANGED = "app-notifications-changed";
const changed = <T,>(value: T): T => {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  return value;
};

export const notificationsApi = {
  inbox: (unreadOnly = false, limit = 30) =>
    axios.get<InboxItem[]>(`${BASE}/inbox`, { params: { unreadOnly, limit } }).then((r) => (Array.isArray(r.data) ? r.data : [])),
  unreadCount: () => axios.get<{ unread: number }>(`${BASE}/inbox/unread-count`).then((r) => Number(r.data?.unread) || 0),
  markRead: (id: number, read = true) =>
    axios.put<InboxItem>(`${BASE}/inbox/${id}/read`, null, { ...QUIET, params: { read } }).then((r) => changed(r.data)),
  markAllRead: () => axios.put(`${BASE}/inbox/read-all`, null, QUIET).then(changed),
  dismiss: (id: number) => axios.delete(`${BASE}/inbox/${id}`, QUIET).then(changed),
  settings: () => axios.get<NotificationSettings>(`${BASE}/settings`).then((r) => r.data),
  saveSettings: (settings: NotificationSettings) =>
    axios.put<NotificationSettings>(`${BASE}/settings`, settings).then((r) => r.data),
  templates: () => axios.get<EmailTemplate[]>(`${BASE}/templates`).then((r) => (Array.isArray(r.data) ? r.data : [])),
  saveTemplate: (code: string, subject: string, body: string) =>
    axios.put<EmailTemplate>(`${BASE}/templates/${code}`, { subject, body }).then((r) => r.data),
  resetTemplate: (code: string) => axios.delete<EmailTemplate>(`${BASE}/templates/${code}`).then((r) => r.data),
};
