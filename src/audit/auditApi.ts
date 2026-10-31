// The company audit log kept by user-service (Settings → Audit Log; needs USERS:ADMIN).
import axios from "axios";

export interface AuditChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface AuditRow {
  id: number;
  /** UTC, without an offset (Java LocalDateTime). */
  occurredAt: string;
  userId: string | null;
  username: string | null;
  fullName: string | null;
  module: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  reference: string | null;
  summary: string | null;
  changes: AuditChange[];
  ipAddress: string | null;
  source: string | null;
}

export interface AuditPage {
  items: AuditRow[];
  total: number;
  page: number;
  size: number;
}

export interface AuditFilters {
  modules: string[];
  actions: string[];
  users: { userId: string; name: string }[];
}

export interface AuditQuery {
  from?: string;
  to?: string;
  module?: string;
  action?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  q?: string;
  page?: number;
  size?: number;
}

const BASE = "/v1/api/user/audit";

// Empty filters are left out of the query string
const params = (query: AuditQuery) =>
  Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const auditApi = {
  search: (query: AuditQuery) => axios.get<AuditPage>(BASE, { params: params(query) }).then((r) => r.data),
  filters: () => axios.get<AuditFilters>(`${BASE}/filters`).then((r) => r.data),
};

// Module codes the services send, in words
const MODULES: Record<string, string> = {
  SIGN_IN: "Sign-in",
  USERS: "Users & roles",
  SETTINGS: "Company settings",
  FINANCE: "Finance",
  SALES: "Sales",
  PURCHASE: "Purchase",
  INVENTORY: "Inventory",
  PAYROLL: "Payroll & HR",
  ATTENDANCE: "Attendance & leave",
  CATALOGUE: "Products, customers & vendors",
  CRM: "CRM",
  DELIVERY: "Delivery",
};

export const moduleLabel = (code: string): string => MODULES[code] ?? words(code);

/** "QUOTATION_SENT" → "Quotation sent". */
export const actionLabel = (code: string): string => words(code);

// Kept in capitals when they appear in an action code
const ACRONYMS = new Set(["sso", "mfa", "po", "grn", "zatca", "uae", "asp", "ip"]);

const words = (code: string): string => {
  const text = String(code ?? "").toLowerCase().replace(/_/g, " ").trim()
    .split(" ").map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w)).join(" ");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** "creditLimit" → "Credit limit". */
export const fieldLabel = (field: string): string => {
  const text = String(field ?? "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase().trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};
