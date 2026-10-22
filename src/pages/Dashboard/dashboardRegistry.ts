import { lazy, type ComponentType } from "react";
import { type AccessInfo, hasModule } from "../../access/access";
import {
  BarChart3,
  Box,
  Briefcase,
  Calendar,
  ClipboardCheck,
  FileText,
  Package,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type DashboardEntry = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  Component: ComponentType | null;
};

const CrmDashboard = lazy(() => import("../CRM/CrmDashboardPage"));
const SalesDashboard = lazy(() => import("../Sales/SalesDashboard"));
const ProcurementDashboard = lazy(() => import("../Purchase/ProcurementDashboard"));
const DeliveryDashboard = lazy(() => import("../Delivery/DeliveryDashboard"));
const PayrollDashboard = lazy(() => import("../Payroll/PayrollDashboard"));
const AttendanceDashboard = lazy(() => import("../Attendance/AttendanceDashboard"));

export const dashboardRegistry: DashboardEntry[] = [
  { key: "Reports", label: "Reports", description: "Sales, finance & inventory analytics", icon: BarChart3, tone: "blue", Component: null },
  { key: "CRM", label: "CRM", description: "Leads, deals, segments & contacts", icon: Users, tone: "violet", Component: CrmDashboard },
  { key: "Common", label: "Common", description: "Customers, vendors & products", icon: Package, tone: "teal", Component: null },
  { key: "Sales", label: "Sales", description: "Quotes, orders, targets & returns", icon: ShoppingCart, tone: "green", Component: SalesDashboard },
  { key: "Inventory", label: "Inventory", description: "Stock, batches & warehouses", icon: Box, tone: "amber", Component: null },
  { key: "Purchase", label: "Purchase", description: "Requisitions, orders & approvals", icon: ClipboardCheck, tone: "indigo", Component: ProcurementDashboard },
  { key: "Invoice", label: "Invoice", description: "Invoices, payments & ledgers", icon: FileText, tone: "rose", Component: null },
  { key: "Delivery", label: "Delivery", description: "Shipments, routes & dispatch", icon: Truck, tone: "cyan", Component: DeliveryDashboard },
  { key: "HRMS", label: "HRMS", description: "Payroll, employees & exit", icon: Briefcase, tone: "orange", Component: PayrollDashboard },
  { key: "Attendance", label: "Attendance", description: "Punch, leave, shifts & approvals", icon: Calendar, tone: "emerald", Component: AttendanceDashboard },
];

// Modules that unlock each dashboard tile (any one is enough)
const DASHBOARD_MODULES: Record<string, string[]> = {
  Reports: ["SALES", "INVENTORY", "PURCHASE", "INVOICE", "CRM"],
  CRM: ["CRM"],
  Common: ["CRM", "INVOICE"],
  Sales: ["SALES"],
  Inventory: ["INVENTORY"],
  Purchase: ["PURCHASE"],
  Invoice: ["INVOICE"],
  Delivery: ["DELIVERY"],
  HRMS: ["HRM"],
  Attendance: ["ATTENDANCE"],
};

export function getAccessibleDashboards(access: AccessInfo): DashboardEntry[] {
  return dashboardRegistry.filter((entry) =>
    (DASHBOARD_MODULES[entry.key] ?? []).some((module) => hasModule(access, module)),
  );
}
