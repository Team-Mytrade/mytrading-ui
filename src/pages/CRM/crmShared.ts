// Shared by the CRM pages. Values follow the CRM service enums; labels are what users see.

export const CRM_API = "/v1/api/crm";

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
