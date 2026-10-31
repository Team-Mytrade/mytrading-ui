// The platform's plan catalogue and companies' plans (user-service; Super Admin), and a company's own plan.
import axios from "axios";
import { formatMoney } from "../company/format";

export interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  modules: string[];
  /** Empty: no limit. */
  maxUsers: number | null;
  maxStorageMb: number | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string | null;
  active: boolean;
  sortOrder: number;
  /** Companies on the plan. */
  companies: number;
}

export type PlanForm = Omit<Plan, "id" | "companies">;

export interface CompanyPlan {
  tenantId: string;
  planId: number;
  planCode: string;
  planName: string;
  modules: string[];
  maxUsers: number | null;
  maxStorageMb: number | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  currency: string | null;
  /** Which values were agreed differently for the company. */
  overridden: string[];
  note: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  /** null: no subscription period (never expires). */
  subscription: Subscription | null;
}

/** Dates are yyyy-MM-dd (UTC days). */
export interface Subscription {
  billingCycle: "MONTHLY" | "YEARLY" | null;
  trial: boolean;
  periodStart: string;
  periodEnd: string;
  renewalDate: string;
  graceEndsOn: string;
  state: "TRIAL" | "ACTIVE" | "GRACE" | "EXPIRED";
}

export interface BillingEvent {
  id: string;
  type: string;
  tenantId: string | null;
  status: "PENDING" | "SENT" | "FAILED" | "NOT_SENT";
  attempts: number;
  lastError: string | null;
  /** UTC without an offset. */
  createdAt: string;
  sentAt: string | null;
  payload: string;
}

export interface AssignForm {
  planId: number;
  modules?: string[] | null;
  maxUsers: number | null;
  maxStorageMb: number | null;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  note: string | null;
}

/** A company's usage against its plan; limits are null without one. */
export interface Usage {
  planName: string | null;
  users: number;
  maxUsers: number | null;
  storageBytes: number;
  maxStorageBytes: number | null;
  sources: { source: string; bytes: number }[];
  /** "users" / "storage" from 80% of a limit. */
  warnings: string[];
}

const BASE = "/v1/api/user/platform";

export const plansApi = {
  list: () => axios.get<Plan[]>(`${BASE}/plans`).then((r) => r.data),
  create: (form: PlanForm) => axios.post<Plan>(`${BASE}/plans`, form).then((r) => r.data),
  update: (id: number, form: PlanForm) => axios.put<Plan>(`${BASE}/plans/${id}`, form).then((r) => r.data),
  remove: (id: number) => axios.delete(`${BASE}/plans/${id}`),
  companies: () => axios.get<CompanyPlan[]>(`${BASE}/tenant-plans`).then((r) => r.data),
  assign: (tenantId: string, form: AssignForm) =>
    axios.put<CompanyPlan>(`${BASE}/tenants/${encodeURIComponent(tenantId)}/plan`, form).then((r) => r.data),
  /** null when the company has no plan (no limits). */
  mine: () => axios.get<CompanyPlan | "">("/v1/api/user/company/plan").then((r) => (r.status === 204 || !r.data ? null : r.data)),
  usage: () => axios.get<Usage>("/v1/api/user/company/usage").then((r) => r.data),
  /** trialDays > 0: a trial; otherwise a period of the cycle; neither: no period. */
  setSubscription: (tenantId: string, body: { billingCycle: string | null; periodStart: string | null; trialDays: number | null }) =>
    axios.put<CompanyPlan>(`${BASE}/tenants/${encodeURIComponent(tenantId)}/subscription`, body).then((r) => r.data),
  renew: (tenantId: string, billingCycle?: string) =>
    axios.post<CompanyPlan>(`${BASE}/tenants/${encodeURIComponent(tenantId)}/subscription/renew`, { billingCycle }).then((r) => r.data),
  billingEvents: () => axios.get<BillingEvent[]>(`${BASE}/billing-events`).then((r) => r.data),
  resendEvent: (id: string) => axios.post(`${BASE}/billing-events/${encodeURIComponent(id)}/send`),
};

/** "Renews 1 Dec" style line for a subscription (date text from the caller's formatter). */
export const subscriptionText = (s: Subscription | null, date: (iso: string) => string) => {
  if (!s) return "";
  if (s.state === "TRIAL") return `Trial until ${date(s.periodEnd)}`;
  if (s.state === "ACTIVE") return `Renews ${date(s.renewalDate)}`;
  if (s.state === "GRACE") return `Ended ${date(s.periodEnd)}; suspended after ${date(s.graceEndsOn)}`;
  return `Expired ${date(s.periodEnd)}`;
};

export const SUBSCRIPTION_TONE: Record<Subscription["state"], string> = {
  TRIAL: "bg-sky-50 text-sky-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  GRACE: "bg-amber-50 text-amber-700",
  EXPIRED: "bg-red-50 text-red-700",
};

/** Bytes as KB / MB / GB. */
export const bytesText = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
    : `${Math.max(bytes > 0 ? 1 : 0, Math.round(bytes / 1024))} KB`;

/** Where the company's files are, in words. */
export const STORAGE_SOURCES: Record<string, string> = {
  "company-files": "Logo and pictures",
  "product-images": "Product images",
  "employee-documents": "Employee documents",
};

/** A plan price in its currency; "—" when not set. */
export const planPrice = (value: number | null, currency: string | null) =>
  value == null ? "—" : currency ? formatMoney(value, currency) : formatMoney(value);

/** "10 users" / "No limit". */
export const limitText = (value: number | null, unit: string) => (value == null ? "No limit" : `${value} ${unit}`);

/** Storage in MB shown as GB from 1024. */
export const storageText = (mb: number | null) =>
  mb == null ? "No limit" : mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
