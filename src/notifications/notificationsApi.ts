// The notification service (/v1/api/eventnotify): the signed-in user's bell, and the company's notification
// settings and email templates (changing those needs USERS:ADMIN).
import axios, { AxiosRequestConfig } from "axios";

const BASE = "/v1/api/eventnotify";
// Marking items read is bookkeeping: no "Saved" toast (see AuthContext)
const QUIET = { quiet: true } as AxiosRequestConfig;

export type NotificationCategory = "APPROVAL" | "STOCK" | "INVOICE" | "PAYMENT" | "SYSTEM" | "REMINDER" | "DELIVERY";

// ── Alert channels (Notification Settings → Channels; Tenant Administrators only) ──

export interface ChannelField {
  key: string;
  label: string;
  // text, number, select, url, email
  kind: string;
  required: boolean;
  // Stored encrypted; never sent back (only whether it is set)
  secret: boolean;
  hint: string;
  options: string[];
}

export interface ChannelProvider {
  code: string;
  name: string;
  hint: string;
  fields: ChannelField[];
}

export interface ChannelDefinition {
  code: string;
  name: string;
  description: string;
  // Sent to each person the alert is for (email, SMS, WhatsApp, bell); otherwise once to a shared place
  perPerson: boolean;
  providers: ChannelProvider[];
}

export interface ChannelState {
  channel: string;
  enabled: boolean;
  provider: string;
  settings: Record<string, string>;
  // Names of the secrets already stored
  secretsSet: string[];
  categories: string[];
  minPriority: "LOW" | "MEDIUM" | "HIGH";
  lastTestAt?: string | null;
  lastTestResult?: string | null;
  // False: still the default, never saved
  saved: boolean;
}

export interface ChannelOverview {
  catalog: { channels: ChannelDefinition[]; categories: string[]; priorities: string[]; secretsConfigured: boolean };
  channels: ChannelState[];
}

export interface ChannelSave {
  enabled: boolean;
  provider: string;
  settings: Record<string, string>;
  // New values only; empty keeps the stored one
  secrets: Record<string, string>;
  categories: string[];
  minPriority: string;
}

export interface ChannelDelivery {
  at: string;
  channel: string;
  recipient: string;
  status: "SENT" | "FAILED";
  detail?: string | null;
}

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
  channels: () => axios.get<ChannelOverview>(`${BASE}/channels`).then((r) => r.data),
  saveChannel: (code: string, body: ChannelSave) => axios.put<ChannelState>(`${BASE}/channels/${code}`, body).then((r) => r.data),
  // The page shows the outcome itself
  testChannel: (code: string) =>
    axios.post<{ sent: boolean; detail?: string | null }>(`${BASE}/channels/${code}/test`, null, QUIET).then((r) => r.data),
  deliveries: () => axios.get<ChannelDelivery[]>(`${BASE}/channels/deliveries`).then((r) => (Array.isArray(r.data) ? r.data : [])),
};
