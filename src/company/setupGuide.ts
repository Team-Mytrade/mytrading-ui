import axios from "axios";
import { Building2, FileUp, Landmark, ListTree, UserPlus, type LucideIcon } from "lucide-react";
import { hasModule, hasPermission, type AccessInfo } from "../access/access";
import { getList } from "../pages/Dashboard/dashboardKit";
import type { CompanyProfile } from "./companyApi";

/**
 * The first-run guide (backlog 7.0.5): five steps a new company goes through before its first transaction.
 * Whether a step is done is read live from the services (company details saved, a bank account made, an import
 * run, a second user); user-service only keeps what can't be read: steps confirmed or skipped, and whether the
 * guide was put away.
 */
export type SetupStepKey = "COMPANY" | "ACCOUNTS" | "BANK" | "OPENING_DATA" | "USERS";
export type SetupState = "DONE" | "SKIPPED";

export interface SetupView {
  tenantId: string;
  steps: Partial<Record<SetupStepKey, SetupState>>;
  dismissed: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

const SETUP = "/v1/api/user/company/setup";
export const setupApi = {
  get: () => axios.get<SetupView>(SETUP).then((r) => r.data),
  setStep: (step: SetupStepKey, state: SetupState | null) => axios.put<SetupView>(`${SETUP}/steps/${step}`, { state }).then((r) => r.data),
  setDismissed: (dismissed: boolean) => axios.put<SetupView>(SETUP, { dismissed }).then((r) => r.data),
};

export interface StepDefinition {
  key: SetupStepKey;
  title: string;
  description: string;
  icon: LucideIcon;
  route: string;
  action: string;
  // Modules the step belongs to (any one enables it); none: always offered
  modules: string[];
  // Permissions needed to check and do it (any one)
  permissions: string[];
  // The administrator confirms it by hand (nothing to read)
  confirm?: string;
  // May be skipped, with what skipping means
  skip?: string;
}

export const SETUP_STEPS: StepDefinition[] = [
  { key: "COMPANY", title: "Company and region", icon: Building2, route: "/company-settings", action: "Open Company Settings", modules: [],
    permissions: ["USERS:ADMIN"],
    description: "Legal name, country, currency, financial year and tax registration. They print on every document and set the dates, numbers and tax rules." },
  { key: "ACCOUNTS", title: "Chart of accounts", icon: ListTree, route: "/postingAccounts", action: "Review the accounts", modules: ["INVOICE"],
    permissions: ["INVOICE:VIEW"], confirm: "The accounts look right",
    description: "The standard accounts sales, purchases, stock, payroll and tax post to are ready. Look them over and point any of them to your own accounts." },
  { key: "BANK", title: "Bank and cash accounts", icon: Landmark, route: "/bankAccounts", action: "Add a bank account", modules: ["INVOICE"],
    permissions: ["INVOICE:VIEW"], skip: "Not now",
    description: "The accounts your customers pay into and you pay from, with the IBAN for invoices. Each gets its own ledger account." },
  { key: "OPENING_DATA", title: "Opening data", icon: FileUp, route: "/data-import", action: "Open Data Import",
    modules: ["PRODUCT_CATALOGUE", "CRM", "INVENTORY", "INVOICE"],
    permissions: ["PRODUCT_CATALOGUE:CREATE", "CRM:CREATE", "INVENTORY:CREATE", "INVOICE:CREATE", "INVOICE:ADMIN"], skip: "We're starting fresh",
    description: "Bring customers, vendors and products from spreadsheets, then stock on hand, unpaid invoices and bills and ledger balances on the go-live date." },
  { key: "USERS", title: "First users", icon: UserPlus, route: "/role_config", action: "Invite users", modules: [],
    permissions: ["USERS:CREATE"], skip: "Just me for now",
    description: "Invite the people who will work in the system and give each a role. They set their own password from the email." },
];

export type StepStatus =
  // Done (read or confirmed), skipped, still to do, can't be told (the service didn't answer), or not offered
  | "done" | "skipped" | "todo" | "unknown" | "unavailable";

export interface StepResult {
  status: StepStatus;
  // A short line on what was found (e.g. "2 bank accounts"): text to translate and its values
  detail?: { text: string; values?: Record<string, number> };
}

/** The steps this administrator can see: the company's modules and their permissions. */
export const stepAvailable = (access: AccessInfo, step: StepDefinition) =>
  (step.modules.length === 0 || step.modules.some((m) => hasModule(access, m)))
  && step.permissions.some((p) => hasPermission(access, p));

const companyComplete = (c: CompanyProfile | null | undefined) => {
  if (!c || !c.updatedDate) return false;
  if (!c.companyName?.trim() || !c.country?.trim() || !c.currency?.trim()) return false;
  if (c.taxRegime === "VAT") return !!c.taxNumber?.trim();
  if (c.taxRegime === "GST") return !!c.gstin?.trim();
  return true;
};

const plural = (n: number, one: string, many: string) => ({ text: n === 1 ? one : many, values: { n } });

/** What each step finds now; a step the administrator skipped or confirmed counts as such. */
export const checkSteps = async (access: AccessInfo, setup: SetupView | null, company: CompanyProfile | null | undefined)
  : Promise<Record<SetupStepKey, StepResult>> => {
  const stored = setup?.steps ?? {};
  const checks: Record<SetupStepKey, () => Promise<StepResult>> = {
    COMPANY: async () => (companyComplete(company) ? { status: "done" } : { status: "todo",
      detail: { text: company?.updatedDate ? "Some details are missing" : "Not saved yet" } }),
    ACCOUNTS: async () => {
      // Opening the list makes the standard accounts the first time
      const rows = await getList<{ accountId?: number | null }>("/v1/api/invoice/accounting/posting-accounts");
      const ready = rows.filter((r) => r.accountId != null).length;
      return { status: "todo", detail: plural(ready, "{n} account ready", "{n} accounts ready") };
    },
    BANK: async () => {
      const rows = await getList<unknown>("/v1/api/invoice/bank-accounts");
      return rows.length ? { status: "done", detail: plural(rows.length, "{n} account", "{n} accounts") } : { status: "todo" };
    },
    OPENING_DATA: async () => {
      // Each service keeps its own imports; one that can't be asked doesn't count
      const sources = [
        ["PRODUCT_CATALOGUE", "/v1/api/common/import/history"], ["CRM", "/v1/api/common/import/history"],
        ["INVENTORY", "/v1/api/inventory/import/history"], ["INVOICE", "/v1/api/invoice/import/history"],
      ].filter(([m]) => hasModule(access, m)).map(([, url]) => url);
      const settled = await Promise.allSettled([...new Set(sources)].map((url) => getList<unknown>(url)));
      const runs = settled.reduce((n, r) => n + (r.status === "fulfilled" ? r.value.length : 0), 0);
      if (runs) return { status: "done", detail: plural(runs, "{n} import", "{n} imports") };
      if (settled.every((r) => r.status === "rejected")) throw new Error("no import history");
      return { status: "todo" };
    },
    USERS: async () => {
      const rows = await getList<{ active?: boolean }>("/v1/api/user/access/users");
      const others = rows.filter((r) => r.active !== false).length - 1;
      return others > 0 ? { status: "done", detail: plural(others, "{n} other user", "{n} other users") } : { status: "todo" };
    },
  };
  const entries = await Promise.all(SETUP_STEPS.map(async (step): Promise<[SetupStepKey, StepResult]> => {
    if (!stepAvailable(access, step)) return [step.key, { status: "unavailable" }];
    let found: StepResult;
    try {
      found = await checks[step.key]();
    } catch {
      found = { status: "unknown" };
    }
    if (found.status === "done") return [step.key, found];
    if (stored[step.key] === "DONE") return [step.key, { ...found, status: "done" }];
    if (stored[step.key] === "SKIPPED") return [step.key, { ...found, status: "skipped" }];
    return [step.key, found];
  }));
  return Object.fromEntries(entries) as Record<SetupStepKey, StepResult>;
};

/** Steps offered, and how many are settled (done or skipped). */
export const progressOf = (results: Record<SetupStepKey, StepResult> | null) => {
  const offered = results ? SETUP_STEPS.filter((s) => results[s.key].status !== "unavailable") : [];
  const settled = offered.filter((s) => ["done", "skipped"].includes(results![s.key].status)).length;
  return { offered: offered.length, settled, complete: offered.length > 0 && settled === offered.length };
};
