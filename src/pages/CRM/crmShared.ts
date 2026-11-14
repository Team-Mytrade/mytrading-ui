// Shared by the CRM pages. Values follow the CRM service enums; labels are what users see.

import { companyCurrency } from "../../company/format";

export const CRM_API = "/v1/api/crm";

/* ================= Form checks (the same rules the CRM service applies) ================= */

const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What is wrong with an email, or null. */
export const emailProblem = (value: string) =>
  value.trim() && !EMAIL_FORMAT.test(value.trim()) ? "Enter a valid email, like name@company.com" : null;

/** What is wrong with a phone number, or null: UAE numbers by their real lengths, others 7–15 digits. */
export { phoneProblem } from "../../utils/phone";

// A phone number in the company's country, as an example in empty phone boxes
const PHONE_EXAMPLES: Record<string, string> = {
  INR: "+91 98450 20001",
  AED: "+971 50 123 4567",
  SAR: "+966 50 123 4567",
  QAR: "+974 3312 3456",
  KWD: "+965 5012 3456",
  BHD: "+973 3612 3456",
  OMR: "+968 9123 4567",
};
export const phoneExample = () => PHONE_EXAMPLES[(companyCurrency() || "").toUpperCase()] ?? "+971 50 123 4567";

/* ================= Dates (unambiguous, in the viewer's time zone) ================= */

// "2026-11-03" (a date only) is read as that calendar day, not midnight UTC
const parseWhen = (text: string) => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  return dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text);
};

/** "03 Nov 2026": a month name, so 03/11 can't be read as 11 March. */
export const crmDate = (text?: string | null) => {
  if (!text) return "";
  const when = parseWhen(text);
  return Number.isNaN(when.getTime()) ? text : when.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

/** "03 Nov 2026, 10:30": the service sends the time with its offset; shown in the viewer's own time zone. */
export const crmDateTime = (text?: string | null) => {
  if (!text) return "";
  const when = parseWhen(text);
  return Number.isNaN(when.getTime())
    ? text
    : when.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** A pending task whose time has passed. */
export const isOverdue = (scheduled?: string | null, status?: string) =>
  !!scheduled && (status ?? "PENDING") === "PENDING" && parseWhen(scheduled).getTime() < Date.now();

/** A service error like "phone: Phone must be…" as { phone: "Phone must be…" }, for showing under the field. */
export const fieldErrorOf = (message: string): Record<string, string> => {
  const match = /^([a-zA-Z.]+):\s*(.+)$/.exec(message || "");
  return match ? { [match[1].split(".").pop() as string]: match[2] } : {};
};

export type Option = { id: string; name: string };

const optionsOf = (labels: Record<string, string>): Option[] =>
  Object.entries(labels).map(([id, name]) => ({ id, name }));

/* ================= Leads ================= */

// DISQUALIFIED is shown as "Lost"; CONVERTED is set by Convert / Link to customer only
export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DISQUALIFIED: "Lost",
  CONVERTED: "Converted",
};
export const LEAD_STATUS_OPTIONS = optionsOf(LEAD_STATUS_LABELS).filter((o) => o.id !== "CONVERTED");

/* ================= Deals ================= */

export const DEAL_STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecting",
  QUALIFIED: "Qualified",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};
export const DEAL_STAGE_OPTIONS = optionsOf(DEAL_STAGE_LABELS);

// Won / Lost follow the stage; while a deal is open it is either active or cancelled
export const DEAL_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
  WON: "Won",
  LOST: "Lost",
};
export const OPEN_DEAL_STATUS_OPTIONS: Option[] = [
  { id: "ACTIVE", name: "Active" },
  { id: "CANCELLED", name: "Cancelled" },
];
export const isClosedStage = (stage?: string) => stage === "WON" || stage === "LOST";

/* ================= Activities & communications ================= */

export const ACTIVITY_TYPE_OPTIONS = optionsOf({ CALL: "Call", MEETING: "Meeting", EMAIL: "Email", TASK: "Task" });
export const ACTIVITY_STATUS_OPTIONS = optionsOf({ PENDING: "Pending", COMPLETED: "Completed", CANCELLED: "Cancelled" });
export const PRIORITY_OPTIONS = optionsOf({ LOW: "Low", MEDIUM: "Medium", HIGH: "High" });
export const COMMUNICATION_TYPE_OPTIONS = optionsOf({
  EMAIL: "Email",
  CALL: "Call",
  MEETING: "Meeting",
  VIDEO_CALL: "Video call",
  CHAT: "Chat",
  SMS: "SMS",
  OTHER: "Other",
});

/* ================= Contacts & customers ================= */

export const CONTACT_ROLE_OPTIONS = optionsOf({
  DECISION_MAKER: "Decision maker",
  INFLUENCER: "Influencer",
  BUYER: "Buyer",
  USER: "User",
});

export const CUSTOMER_TYPE_OPTIONS = optionsOf({
  WHOLESALE: "Wholesale",
  RETAIL: "Retail",
  DISTRIBUTOR: "Distributor",
  CORPORATE: "Corporate",
  GOVERNMENT: "Government",
  NON_PROFIT: "Non-profit",
  OTHER: "Other",
});

export interface ContactSummary {
  id: number;
  fullName: string;
  customerId?: number | null;
  customerName?: string;
}

// The contacts nested in /customers carry no customer id, so take it from the parent
export const contactsOfCustomers = (
  customers: { id: number; customerName?: string; contacts?: { id: number; fullName: string }[] }[]
): ContactSummary[] =>
  customers.flatMap((customer) =>
    (customer.contacts ?? []).map((contact) => ({
      ...contact,
      customerId: customer.id,
      customerName: customer.customerName,
    }))
  );

/* ================= Dates ================= */

const pad = (n: number) => String(n).padStart(2, "0");

// The service stores local date-times (no zone), so send the user's wall-clock time, not UTC
export const toLocalDateTime = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

// Value for <input type="datetime-local"> from a service date-time
export const toDateTimeInput = (value?: string | null): string => (value ? value.slice(0, 16) : "");

// Value for <input type="date"> from a service date-time
export const toDateInput = (value?: string | null): string => (value ? value.slice(0, 10) : "");

/* ================= Errors ================= */

export { apiError } from "../../utils/apiError";
