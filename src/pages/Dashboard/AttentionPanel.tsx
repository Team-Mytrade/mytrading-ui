import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle, BellRing, CalendarCheck, CalendarClock, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardPen, FilePen,
  FileText, HandCoins, LogOut, Mail, PackageCheck, PackageX, RefreshCw, Truck, UserX, Wallet, type LucideIcon,
} from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { getSelectedTenant, hasModule, hasPermission, type AccessInfo } from "../../access/access";
import { DASH_CARD, formatMoney, getList, parseDate } from "./dashboardKit";

/**
 * "Needs your attention": one strip across the modules with the work waiting for the signed-in user.
 * Only queues the user can act on are checked (module enabled + permission); a queue that fails to
 * load is left out quietly, and empty queues are hidden.
 */

interface Item {
  key: string;
  label: string;
  icon: LucideIcon;
  tone: "red" | "amber" | "cyan" | "violet" | "emerald";
  route: string;
  module: string;
  permission: string;
  // Count (and an optional money hint) of what is waiting
  load: () => Promise<{ count: number; amount?: number }>;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const count = async <T,>(url: string, keep: (row: T) => boolean = () => true) => ({ count: (await getList<T>(url)).filter(keep).length });
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const withinDays = (value: string | undefined, days: number) => {
  const d = parseDate(value);
  if (!d) return false;
  const limit = today();
  limit.setDate(limit.getDate() + days);
  return d <= limit;
};

type Row = Record<string, unknown>;
const ITEMS: Item[] = [
  { key: "leave", label: "Leave requests to approve", icon: CalendarCheck, tone: "violet", route: "/att_leaveManagerDashboard",
    module: "ATTENDANCE", permission: "ATTENDANCE:APPROVE", load: () => count("/v1/api/attendance/leave-approvals/pending") },
  { key: "regularization", label: "Attendance corrections to approve", icon: ClipboardPen, tone: "violet", route: "/att_leaveManagerDashboard",
    module: "ATTENDANCE", permission: "ATTENDANCE:APPROVE", load: () => count("/v1/api/attendance/regularization/pending") },
  { key: "attendance", label: "On-duty / WFH requests to approve", icon: CalendarClock, tone: "violet", route: "/att_leaveManagerDashboard",
    module: "ATTENDANCE", permission: "ATTENDANCE:APPROVE", load: () => count("/v1/api/attendance/attendance-approvals/pending") },
  { key: "exits", label: "Resignations to decide", icon: LogOut, tone: "amber", route: "/exitApprovals",
    module: "HRM", permission: "HRM:APPROVE",
    load: () => count<Row>("/v1/api/payroll/exit/getAllExitRequests", (r) => ["SUBMITTED", "UNDER_REVIEW"].includes(String(r.status))) },
  { key: "requisitions", label: "Requisitions to approve", icon: ClipboardCheck, tone: "cyan", route: "/purchase-service/requisitions",
    module: "PURCHASE", permission: "PURCHASE:APPROVE",
    load: () => count<Row>("/v1/api/purchase/purchase-requisitions", (r) => ["SUBMITTED", "IN_REVIEW"].includes(String(r.status))) },
  { key: "pos", label: "Purchase orders to approve", icon: FileText, tone: "cyan", route: "/purchase-service/orders",
    module: "PURCHASE", permission: "PURCHASE:APPROVE",
    load: () => count<Row>("/v1/api/purchase/purchase-orders",
      (r) => r.status !== "CANCELLED" && ["PENDING", "IN_REVIEW"].includes(String(r.approvalStatus))) },
  { key: "grns", label: "Goods receipts in draft", icon: PackageCheck, tone: "cyan", route: "/purchase-service/goods-receipt-notes",
    module: "PURCHASE", permission: "PURCHASE:UPDATE", load: () => count<Row>("/v1/api/purchase/grns", (r) => r.status === "DRAFT") },
  { key: "orders", label: "Sales orders to confirm", icon: FilePen, tone: "emerald", route: "/sales-orders",
    module: "SALES", permission: "SALES:UPDATE", load: () => count<Row>("/v1/api/sales/sales-orders", (r) => r.status === "DRAFT") },
  { key: "dispatches", label: "Dispatches to confirm", icon: Truck, tone: "emerald", route: "/sales-orders",
    module: "SALES", permission: "SALES:UPDATE", load: () => count("/v1/api/sales/dispatch/dispatches?status=DRAFT") },
  { key: "toInvoice", label: "Dispatches to invoice", icon: FileText, tone: "cyan", route: "/invoices",
    module: "INVOICE", permission: "INVOICE:CREATE", load: () => count("/v1/api/invoice/invoices/pending-dispatches") },
  { key: "draftInvoices", label: "Draft invoices to issue", icon: FilePen, tone: "cyan", route: "/invoices",
    module: "INVOICE", permission: "INVOICE:UPDATE", load: () => count<Row>("/v1/api/invoice/invoices", (r) => r.status === "DRAFT") },
  { key: "overdue", label: "Overdue customer invoices", icon: HandCoins, tone: "red", route: "/accountsReceivable",
    module: "INVOICE", permission: "INVOICE:VIEW",
    load: async () => {
      const report = (await axios.get<{ overdueInvoices?: { balanceAmount?: number }[] }>("/v1/api/invoice/reports/finance")).data ?? {};
      const rows = report.overdueInvoices ?? [];
      return { count: rows.length, amount: rows.reduce((t, r) => t + num(r.balanceAmount), 0) };
    } },
  { key: "bills", label: "Vendor bills overdue or due this week", icon: Wallet, tone: "amber", route: "/accountsPayable",
    module: "INVOICE", permission: "INVOICE:VIEW",
    load: async () => {
      const rows = (await getList<Row>("/v1/api/invoice/accounts-payable")).filter((r) => num(r.balance) > 0 && withinDays(r.dueDate as string, 7));
      return { count: rows.length, amount: rows.reduce((t, r) => t + num(r.balance), 0) };
    } },
  { key: "stock", label: "Products to reorder", icon: PackageX, tone: "red", route: "/stock-level",
    module: "INVENTORY", permission: "INVENTORY:VIEW",
    load: () => count<Row>("/v1/api/inventory/stock-levels", (r) => {
      const available = num(r.available ?? num(r.quantity) - num(r.reserved));
      return available <= 0 || (r.reorderLevel != null && available <= num(r.reorderLevel));
    }) },
  { key: "batches", label: "Batches expiring within 30 days", icon: AlertTriangle, tone: "amber", route: "/batch",
    module: "INVENTORY", permission: "INVENTORY:VIEW", load: () => count<Row>("/v1/api/inventory/batches", (r) => withinDays(r.expiryDate as string, 30)) },
  { key: "creditHold", label: "Customers on credit hold", icon: UserX, tone: "amber", route: "/customer-management",
    module: "CRM", permission: "CRM:VIEW", load: () => count<Row>("/v1/api/common/customers", (r) => r.status === "CREDIT_HOLD") },
  { key: "invites", label: "Users who haven't set a password", icon: Mail, tone: "violet", route: "/role_config",
    module: "USERS", permission: "USERS:UPDATE",
    load: () => count<Row>("/v1/api/user/access/users", (r) => r.active === true && r.invitePending === true) },
];

const TONES: Record<Item["tone"], string> = {
  red: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
  cyan: "bg-[#e0f7fa] text-[#006f7a] dark:bg-cyan-950/40 dark:text-cyan-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const COLLAPSED_KEY = "cc-attention-collapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; } };

/** Queues this user can act on: module enabled and the permission held. */
export const attentionItemsFor = (access: AccessInfo) =>
  ITEMS.filter((item) => hasModule(access, item.module) && hasPermission(access, item.permission));

export default function AttentionPanel() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  // A Super Admin working across all tenants has no company queues
  const items = useMemo(() => (access.superAdmin && !getSelectedTenant() ? [] : attentionItemsFor(access)), [access]);
  const [results, setResults] = useState<Record<string, { count: number; amount?: number }>>({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const load = useCallback(async () => {
    setLoading(true);
    const settled = await Promise.allSettled(items.map((item) => item.load()));
    const next: Record<string, { count: number; amount?: number }> = {};
    settled.forEach((r, i) => { if (r.status === "fulfilled") next[items[i].key] = r.value; });
    setResults(next);
    setLoading(false);
  }, [items]);

  useEffect(() => {
    if (items.length) load();
  }, [items, load]);

  if (items.length === 0) return null;

  const waiting = items.filter((item) => (results[item.key]?.count ?? 0) > 0);
  const total = waiting.reduce((t, item) => t + results[item.key].count, 0);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1"); } catch { /* per-viewer convenience only */ }
      return !c;
    });
  };

  return (
    <section className={`mb-3 flex-none px-4 py-3 ${DASH_CARD}`} aria-label="Needs your attention">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={toggle} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={!collapsed}>
          <span className={`grid h-7 w-7 flex-none place-items-center rounded-lg ${waiting.length ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>
            {waiting.length ? <BellRing size={15} /> : <CheckCircle2 size={15} />}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Needs your attention</span>
          <span className="truncate text-xs text-gray-500">
            {loading ? "Checking…" : waiting.length ? `${total} item${total === 1 ? "" : "s"} in ${waiting.length} queue${waiting.length === 1 ? "" : "s"}` : "All clear"}
          </span>
          <ChevronDown size={15} className={`flex-none text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
        <button type="button" onClick={load} disabled={loading} title="Check again"
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-cyan-600 disabled:opacity-50 dark:hover:bg-gray-800">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {!collapsed && !loading && waiting.length > 0 && (
        <div className="mt-3 flex max-h-[7.5rem] flex-wrap gap-2 overflow-y-auto">
          {waiting.map((item) => {
            const r = results[item.key];
            return (
              <button key={item.key} type="button" onClick={() => navigate(item.route)}
                className="group flex items-center gap-2 rounded-lg border border-[#d9eef2] bg-white px-2.5 py-1.5 text-left transition hover:border-[#4dd0e1] hover:shadow-[0_4px_10px_rgba(0,151,167,0.10)] dark:border-gray-800 dark:bg-gray-900">
                <span className={`grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-xs font-bold ${TONES[item.tone]}`}>{r.count}</span>
                <item.icon size={14} className="flex-none text-slate-400 group-hover:text-[#0097a7]" />
                <span className="text-xs font-medium text-slate-700 group-hover:text-[#006f7a] dark:text-gray-200">{item.label}</span>
                {r.amount ? <span className="text-[11px] text-gray-400">{formatMoney(r.amount, "INR", true)}</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
