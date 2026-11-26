// Pages that only show demo or placeholder content (no backend yet). Backlog OPS-6 / CRM X7 + N5 (8.4.1): customers
// never see them. Their components stay in the code to be finished later; while a path is listed here
//   - its route shows the "Coming soon" page (pages/ComingSoonPage.tsx), or goes to `redirect` when a real page
//     already does the same job,
//   - it is left out of the menu and the header search (filterNavItems in layout/AppSidebar.tsx),
//   - any help topic for it is left out of the Help Center, the F1 panel and help search (help/index.ts).
// To finish a page: build it on real data, then remove its entry here (and add it to the menu, access.ts and help).
// Kept free of imports: scripts/check-help-arabic.cjs loads help/index.ts, which reads this file.

export interface ComingSoonPage {
  path: string;
  /** Shown on the Coming soon page. */
  name: string;
  /** The backlog item that builds it (docs/CRM-GAP-ANALYSIS.md / docs/ERP-GAP-BACKLOG.md). */
  backlog: string;
  /** A real page that already does this job: the route goes there instead. */
  redirect?: string;
  /** Real pages to use meanwhile, offered on the Coming soon page. */
  seeInstead?: { path: string; label: string }[];
}

const CAMPAIGNS = "E1 / E2 Templates and bulk campaigns";
const TICKETS = "S1 Service tickets";
const WORKFLOW = "W1 / W2 Workflow rules";

export const COMING_SOON_PAGES: ComingSoonPage[] = [
  // CRM Marketing (pages/Marketing)
  { path: "/campaigns", name: "Campaigns", backlog: CAMPAIGNS },
  { path: "/emailMarketing", name: "Email marketing", backlog: CAMPAIGNS },
  { path: "/sms", name: "SMS campaigns", backlog: CAMPAIGNS, seeInstead: [{ path: "/notification-settings", label: "Notification Settings" }] },
  { path: "/templates", name: "Message templates", backlog: CAMPAIGNS },
  { path: "/segmentation", name: "Segmentation manager", backlog: "X1 Dynamic segments", seeInstead: [{ path: "/customer-segment", label: "Segments" }] },
  { path: "/campaignReports", name: "Campaign reports", backlog: CAMPAIGNS, seeInstead: [{ path: "/crm-reports", label: "CRM Reports" }] },

  // CRM Support (pages/Support)
  { path: "/tickets", name: "Support tickets", backlog: TICKETS, seeInstead: [{ path: "/service-schedules", label: "Service Schedules" }, { path: "/return-requests", label: "Return Requests" }] },
  { path: "/knowledgeBase", name: "Knowledge base", backlog: "S5 Knowledge base", seeInstead: [{ path: "/help", label: "Help Center" }] },
  { path: "/sLAManagement", name: "SLA management", backlog: TICKETS },
  { path: "/SupportReports", name: "Support reports", backlog: "R6 Ticket report" },

  // CRM Workflow (pages/Workflow)
  { path: "/workflowRules", name: "Workflow rules", backlog: WORKFLOW },
  { path: "/triggerSettings", name: "Trigger settings", backlog: WORKFLOW },
  { path: "/automationLogs", name: "Automation logs", backlog: WORKFLOW, seeInstead: [{ path: "/audit-log", label: "Audit Log" }] },
  { path: "/scheduledActions", name: "Scheduled actions", backlog: WORKFLOW },

  // Settings (pages/Settings)
  { path: "/customFields", name: "Custom fields", backlog: "X2 Custom fields" },
  { path: "/integrations", name: "Integrations", backlog: "N5 Integrations",
    seeInstead: [
      { path: "/sales-online-stores", label: "Online Stores" },
      { path: "/api-keys", label: "API keys" },
      { path: "/webhooks", label: "Webhooks" },
      { path: "/notification-settings", label: "Notification Settings" },
    ] },
  // Real pages already do these jobs: alert channels, Data Import, My preferences, the Command Center, Sales Dashboard
  { path: "/emailSMS", name: "Email / SMS settings", backlog: "N5", redirect: "/notification-settings" },
  { path: "/importExport", name: "Import / export", backlog: "OPS-6", redirect: "/data-import" },

  // Other placeholder pages found with them (no menu entry, mock data)
  { path: "/preference", name: "User preferences", backlog: "OPS-6", redirect: "/my-preferences" },
  { path: "/user_dashboard", name: "User dashboard", backlog: "OPS-6", redirect: "/" },
  { path: "/sales-summary", name: "Sales summary", backlog: "OPS-6", redirect: "/sales-dashboard" },
  { path: "/alert", name: "Alerts", backlog: "OPS-6", redirect: "/notifications" },
  { path: "/dashboard-overview", name: "CRM overview", backlog: "OPS-6", redirect: "/crm_dashboard" },
  { path: "/keyMetrics", name: "Key metrics", backlog: "OPS-6", redirect: "/crm_dashboard" },
  { path: "/recentInteractions", name: "Recent interactions", backlog: "OPS-6", redirect: "/communication-history" },
];

const normal = (pathname: string) => (pathname.replace(/\/+$/, "") || "/").toLowerCase();

/** The listed page at this path (or under it), or undefined. */
export const comingSoonPage = (pathname: string): ComingSoonPage | undefined => {
  const path = normal(pathname);
  return COMING_SOON_PAGES.find((p) => path === p.path.toLowerCase() || path.startsWith(`${p.path.toLowerCase()}/`));
};

export const isComingSoon = (pathname?: string): boolean => !!pathname && !!comingSoonPage(pathname);
