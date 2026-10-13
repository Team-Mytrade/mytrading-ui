// Client-side view of the RBAC model enforced by the backend (see my-trading/docs/RBAC.md).
// The server is the authority; this only decides what to show.

export const APP_MODULES = [
  "CRM",
  "PURCHASE",
  "SALES",
  "INVOICE",
  "INVENTORY",
  "HRM",
  "ATTENDANCE",
  "DELIVERY",
  "PRODUCT_CATALOGUE",
  "USERS",
] as const;

export type AppModule = (typeof APP_MODULES)[number];

export const MODULE_LABELS: Record<AppModule, string> = {
  CRM: "CRM",
  PURCHASE: "Purchase",
  SALES: "Sales",
  INVOICE: "Invoice",
  INVENTORY: "Inventory",
  HRM: "HRM",
  ATTENDANCE: "Attendance",
  DELIVERY: "Delivery",
  PRODUCT_CATALOGUE: "Product Catalogue",
  USERS: "Users",
};

export const PERMISSION_ACTIONS = ["VIEW", "CREATE", "UPDATE", "DELETE", "APPROVE", "EXPORT", "ADMIN"] as const;

export interface AccessInfo {
  superAdmin: boolean;
  tenantId: string | null;
  modules: string[];
  permissions: string[];
  // Modules enabled for the tenant (self-service availability)
  tenantModules: string[];
  // The user's own employee record; null when none is linked (no self-service)
  employeeId: number | null;
}

export const NO_ACCESS: AccessInfo = {
  superAdmin: false,
  tenantId: null,
  modules: [],
  permissions: [],
  tenantModules: [],
  employeeId: null,
};

/** Reads the access claims from the JWT issued by auth-service. */
export const decodeAccess = (token: string | null | undefined): AccessInfo => {
  if (!token) return NO_ACCESS;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return {
      superAdmin: claims.superAdmin === true,
      tenantId: claims.tenantId ?? null,
      modules: Array.isArray(claims.modules) ? claims.modules : [],
      permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
      tenantModules: Array.isArray(claims.tenantModules) ? claims.tenantModules : [],
      employeeId: typeof claims.employeeId === "number" ? claims.employeeId : null,
    };
  } catch {
    return NO_ACCESS;
  }
};

export const hasModule = (access: AccessInfo, module: AppModule | string): boolean =>
  access.superAdmin || module === "USERS" || access.modules.includes(module);

export const hasPermission = (access: AccessInfo, permission: string): boolean =>
  access.superAdmin || access.permissions.includes(permission);

/* ================= Super Admin tenant selection ================= */

const SELECTED_TENANT_KEY = "selectedTenantId";
export const TENANT_HEADER = "X-Tenant-Id";

/** Tenant a Super Admin chose to work in; null means platform-wide (all tenants). */
export const getSelectedTenant = (): string | null => {
  try {
    return localStorage.getItem(SELECTED_TENANT_KEY);
  } catch {
    return null;
  }
};

export const setSelectedTenant = (tenantId: string | null) => {
  try {
    if (tenantId) localStorage.setItem(SELECTED_TENANT_KEY, tenantId);
    else localStorage.removeItem(SELECTED_TENANT_KEY);
  } catch {
    // storage unavailable: selection lasts for this page only
  }
  window.dispatchEvent(new Event("app-tenant-changed"));
};

/* ================= Routes → modules ================= */

// "x*" matches any path starting with x; otherwise the path or its sub-paths.
// More specific entries must come first.
const ROUTE_MODULES: [string, AppModule | "PLATFORM"][] = [
  ["/platform", "PLATFORM"],
  ["/role_config", "USERS"],
  ["/rolesPermissions", "USERS"],

  ["/customerAddress", "DELIVERY"],
  ["/customer-management", "CRM"],
  ["/customers", "CRM"],
  ["/customer", "CRM"],
  ["/customer-segment", "CRM"],
  ["/contactPerson", "CRM"],
  ["/leads", "CRM"],
  ["/opportunities", "CRM"],
  ["/opportunities-deal", "CRM"],
  ["/communication-history", "CRM"],
  ["/activities", "CRM"],
  ["/task", "CRM"],
  ["/taskPage", "CRM"],
  ["/crm*", "CRM"],
  ["/contacts", "CRM"],
  ["/accounts", "CRM"],
  ["/salesPipeline", "CRM"],
  ["/stagesManagement", "CRM"],
  ["/forecastPage", "CRM"],
  ["/wonLostAnalysis", "CRM"],
  ["/meetingsPage", "CRM"],
  ["/callsPage", "CRM"],
  ["/remindersPage", "CRM"],
  ["/activityCalendar", "CRM"],
  ["/leadReports", "CRM"],
  ["/activityReports", "CRM"],
  ["/customerRetention", "CRM"],

  ["/product-catalogue", "PRODUCT_CATALOGUE"],

  ["/sales-*", "SALES"],
  ["/quotations", "SALES"],
  ["/quote-view", "SALES"],
  ["/credit-limit", "SALES"],
  ["/return-requests", "SALES"],
  ["/refunds", "SALES"],
  ["/service-schedule*", "SALES"],
  ["/salesReports", "SALES"],

  ["/warehouse", "INVENTORY"],
  ["/quality-inspection", "INVENTORY"],
  ["/batch", "INVENTORY"],
  ["/serial-number", "INVENTORY"],
  ["/inventory*", "INVENTORY"],
  ["/stock-*", "INVENTORY"],

  ["/purchase-service", "PURCHASE"],
  ["/requisition-line-items", "PURCHASE"],
  ["/purchase-reports", "PURCHASE"],
  ["/purchase_dashboard", "PURCHASE"],
  ["/purchase-inventory", "PURCHASE"],
  ["/terms-and-conditions", "PURCHASE"],
  ["/term-condition", "PURCHASE"],
  ["/deliveries", "PURCHASE"],
  ["/deliveryDate", "PURCHASE"],

  ["/invoiceVendors", "INVOICE"],
  ["/taxTypes", "INVOICE"],
  ["/taxDetails", "INVOICE"],
  ["/purchaseInvoices", "INVOICE"],
  ["/paymentTerms", "INVOICE"],
  ["/journalEntries", "INVOICE"],
  ["/invoices", "INVOICE"],
  ["/generalAccounts", "INVOICE"],
  ["/accountsPayable", "INVOICE"],
  ["/vendorPayments", "INVOICE"],
  ["/taxRecords", "INVOICE"],
  ["/paymentReceipts", "INVOICE"],
  ["/generalLedger", "INVOICE"],
  ["/expenseRevenue", "INVOICE"],
  ["/accountsReceivable", "INVOICE"],
  ["/taxReport", "INVOICE"],
  ["/financeReport", "INVOICE"],

  ["/deliveryOrder", "DELIVERY"],
  ["/transporter", "DELIVERY"],
  ["/vechile", "DELIVERY"],
  ["/vehicle", "DELIVERY"],
  ["/shipment", "DELIVERY"],
  ["/delivery-note", "DELIVERY"],
  ["/route", "DELIVERY"],
  ["/productDelivery", "DELIVERY"],
  ["/deliveryAddress", "DELIVERY"],
  ["/deliveryStatus", "DELIVERY"],
  ["/delivery_dashboard", "DELIVERY"],
  ["/schedule", "DELIVERY"],
  ["/goodsIssue", "DELIVERY"],

  ["/att_*", "ATTENDANCE"],
  ["/attendance_dashboard", "ATTENDANCE"],

  ["/employee*", "HRM"],
  ["/employees", "HRM"],
  ["/addEmployee", "HRM"],
  ["/salaryStructure", "HRM"],
  ["/it-declaration", "HRM"],
  ["/taxDeductions", "HRM"],
  ["/payroll*", "HRM"],
  ["/departmentSummary", "HRM"],
  ["/benefits", "HRM"],
  ["/document-management", "HRM"],
  ["/performance-management", "HRM"],
  ["/exit-management", "HRM"],
  ["/exitApprovals", "HRM"],
  ["/statutoryCompliances", "HRM"],
  ["/attendance-management", "HRM"],
  ["/attendanceLogs", "HRM"],
  ["/leave-management", "HRM"],
  ["/leaveRequests", "HRM"],
];

/** Module a route belongs to, "PLATFORM" for Super Admin pages, or null when open to everyone. */
export const moduleForPath = (pathname: string): AppModule | "PLATFORM" | null => {
  for (const [pattern, module] of ROUTE_MODULES) {
    if (pattern.endsWith("*")) {
      if (pathname.startsWith(pattern.slice(0, -1))) return module;
    } else if (pathname === pattern || pathname.startsWith(`${pattern}/`)) {
      return module;
    }
  }
  return null;
};

// Pages that act on the signed-in user's own employee record (punch, own leave, own requests).
// They need a linked employee and the module enabled for the tenant, not module permissions.
const SELF_SERVICE_ROUTES: [string, AppModule][] = [
  ["/att_selfService", "ATTENDANCE"],
  ["/att_punch", "ATTENDANCE"],
  ["/att_leaveRequest", "ATTENDANCE"],
  ["/att_leaveDashboard", "ATTENDANCE"],
  ["/att_timesheetManagement", "ATTENDANCE"],
  ["/att_requests", "ATTENDANCE"],
  ["/att_holidayCalendar", "ATTENDANCE"],
  ["/employee-self-dashboard", "HRM"],
];

export const isSelfServicePath = (pathname: string): AppModule | null =>
  SELF_SERVICE_ROUTES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? null;

export const canAccessPath = (access: AccessInfo, pathname: string): boolean => {
  const selfService = isSelfServicePath(pathname);
  if (selfService) {
    return (
      access.employeeId != null &&
      (hasModule(access, selfService) || access.tenantModules.includes(selfService))
    );
  }
  const module = moduleForPath(pathname);
  if (module === null) return true;
  if (module === "PLATFORM") return access.superAdmin;
  if (module === "USERS") return hasPermission(access, "USERS:VIEW");
  return hasModule(access, module);
};
