import { useContext, useMemo } from "react";
import axios from "axios";
import {
  BarChart3, Boxes, Briefcase, ClipboardList, HandCoins, IndianRupee, Landmark, Percent, ShoppingBag, ShoppingCart,
  TrendingUp, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuthContext } from "../../context/AuthContext";
import { canAccessPath, hasModule } from "../../access/access";
import { pageForPlace, useCompanyPlace } from "../../company/payrollRegion";
import {
  CHART_GRID, CHART_AXIS, CHART_LEGEND, CHART_HOVER, ChartBox, DashboardLayout, EmptyState, KpiCard, ModuleTiles, type DashboardTile, Panel, formatMoney, formatNumber, getList, monthKeyOf, monthsBack,
  mostCommon, sourcesForModules, sum, useDashboardSources,
} from "./dashboardKit";
import { companyCurrency } from "../../company/format";

import { t } from "../../i18n/i18n";
// One page across the modules: headline figures and a way into every detailed report.

interface SalesReport { totalSales?: number; totalOrders?: number; totalCustomers?: number; monthlySales?: Record<string, number> }
interface FinanceReport { totalInvoiced?: number; totalPaid?: number; outstandingAmount?: number; monthlyTotals?: Record<string, number>; overdueInvoices?: unknown[] }
interface TaxReport { totalTaxAmount?: number; taxCollectedByMonth?: Record<string, number> }
interface PurchaseOrder { id: number; orderDate?: string; status?: string; totalAmount?: number; currency?: string }
interface StockLevel { productId: number; quantity?: number; reserved?: number; available?: number; reorderLevel?: number | null }
interface Product { id: number; standardCost?: number | null }

const SOURCES = {
  sales: () => axios.get<SalesReport>("/v1/api/sales/reports").then((r) => r.data ?? {}),
  finance: () => axios.get<FinanceReport>("/v1/api/invoice/reports/finance").then((r) => r.data ?? {}),
  tax: () => axios.get<TaxReport>("/v1/api/invoice/reports/tax").then((r) => r.data ?? {}),
  orders: () => getList<PurchaseOrder>("/v1/api/purchase/purchase-orders"),
  stock: () => getList<StockLevel>("/v1/api/inventory/stock-levels"),
  products: () => getList<Product>("/v1/api/common/products"),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  sales: "sales report", finance: "finance report", tax: "tax report", orders: "purchase orders",
  stock: "stock levels", products: "products",
};

const SOURCE_MODULES: Record<keyof typeof SOURCES, string> = {
  sales: "SALES", finance: "INVOICE", tax: "INVOICE", orders: "PURCHASE", stock: "INVENTORY", products: "PRODUCT_CATALOGUE",
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Re-keys a month map ("2026-9", "2026-09", "Sep 2026"…) to "2026-09". */
const byMonthKey = (values?: Record<string, number>) => {
  const out = new Map<string, number>();
  Object.entries(values ?? {}).forEach(([raw, value]) => {
    const m = /^(\d{4})-(\d{1,2})/.exec(raw);
    const d = m ? null : new Date(raw);
    const key = m ? `${m[1]}-${m[2].padStart(2, "0")}` : d && !Number.isNaN(d.getTime()) ? monthKeyOf(d.toISOString()) : "";
    if (key) out.set(key, (out.get(key) ?? 0) + num(value));
  });
  return out;
};

export default function ReportsDashboard() {
  const { access } = useContext(AuthContext);
  const place = useCompanyPlace();
  const sources = useMemo(() => sourcesForModules(SOURCES, SOURCE_MODULES, (m) => hasModule(access, m)), [access]);
  const { loading, data, failed } = useDashboardSources(sources, LABELS);

  const sales = data.sales as SalesReport | undefined;
  const finance = data.finance as FinanceReport | undefined;
  const tax = data.tax as TaxReport | undefined;
  const orders = ((data.orders as PurchaseOrder[] | undefined) ?? []).filter((o) => o.status !== "CANCELLED");
  const stock = (data.stock as StockLevel[] | undefined) ?? [];
  const products = (data.products as Product[] | undefined) ?? [];
  const currency = mostCommon(orders.map((o) => o.currency), companyCurrency());

  const stockValue = useMemo(() => {
    const cost = new Map(products.map((p) => [p.id, p.standardCost]));
    return stock.reduce((t, s) => t + num(s.quantity) * num(cost.get(s.productId)), 0);
  }, [stock, products]);
  const lowStock = stock.filter((s) => s.reorderLevel != null && num(s.available ?? num(s.quantity) - num(s.reserved)) <= num(s.reorderLevel)).length;
  const purchaseTotal = sum(orders, (o) => o.totalAmount);

  const trend = useMemo(() => {
    const salesByMonth = byMonthKey(sales?.monthlySales);
    const billedByMonth = byMonthKey(finance?.monthlyTotals);
    return monthsBack(6).map(({ key, label }) => ({
      month: label,
      sales: salesByMonth.get(key) ?? 0,
      billed: billedByMonth.get(key) ?? 0,
      purchases: sum(orders.filter((o) => monthKeyOf(o.orderDate) === key), (o) => o.totalAmount),
    }));
  }, [sales, finance, orders]);
  const hasTrend = trend.some((t) => t.sales || t.billed || t.purchases);

  const taxTrend = useMemo(() => {
    const byMonth = byMonthKey(tax?.taxCollectedByMonth);
    return monthsBack(6).map(({ key, label }) => ({ month: label, tax: byMonth.get(key) ?? 0 }));
  }, [tax]);

  const money = (v?: number) => formatMoney(num(v), currency, true);
  // The way into every report: the Reports menu's module pages, the VAT return and the CRM reports
  const links: DashboardTile[] = ([
    { name: "Sales Reports", route: "/reports/sales", icon: ShoppingCart, tone: "emerald" },
    { name: "Purchase Reports", route: "/reports/purchase", icon: ClipboardList, tone: "indigo" },
    { name: "Inventory Reports", route: "/reports/inventory", icon: Boxes, tone: "amber" },
    { name: "Finance Reports", route: "/reports/finance", icon: Landmark, tone: "cyan" },
    { name: "HR & Payroll Reports", route: "/reports/hr", icon: Briefcase, tone: "orange" },
    { name: "VAT Return", route: "/vatReturn", icon: Percent, tone: "teal" },
    { name: "CRM Reports", route: "/crm-reports", icon: Users, tone: "purple" },
  ] as DashboardTile[]).filter((c) => canAccessPath(access, c.route) && pageForPlace(c.route, place));

  return (
    <DashboardLayout
      failed={failed}
      links={links.length > 0 ? <ModuleTiles tiles={links} loading={loading} /> : undefined}
      kpis={
        <>
          <KpiCard label={t("Sales")} value={sales ? money(sales.totalSales) : "—"}
            hint={sales ? t("{orders} orders · {customers} customers", { orders: formatNumber(num(sales.totalOrders)), customers: formatNumber(num(sales.totalCustomers)) }) : undefined} icon={ShoppingCart} tone="emerald" loading={loading} />
          <KpiCard label={t("Purchases")} value={data.orders ? money(purchaseTotal) : "—"}
            hint={data.orders ? t("{count} purchase orders", { count: formatNumber(orders.length) }) : undefined} icon={ShoppingBag} tone="indigo" loading={loading} />
          <KpiCard label={t("Stock Value")} value={data.stock && data.products ? money(stockValue) : "—"}
            hint={data.stock ? t("{count} record(s) at or below reorder level", { count: formatNumber(lowStock) }) : undefined} icon={IndianRupee} tone="amber" loading={loading} />
          <KpiCard label={t("Receivables")} value={finance ? money(finance.outstandingAmount) : "—"}
            hint={finance ? t("{count} overdue invoice(s)", { count: formatNumber(finance.overdueInvoices?.length ?? 0) }) : undefined} icon={HandCoins} tone="red" loading={loading} />
        </>
      }
    >
        <Panel title={t("Sales, Billing and Purchases")} subtitle={t("Per month (last 6 months)")} icon={TrendingUp} iconClass="text-emerald-500">
          {!hasTrend ? (
            <EmptyState loading={loading}>{t("No sales, invoices or purchases in the last 6 months.")}</EmptyState>
          ) : (
            <ChartBox><ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="month" {...CHART_AXIS} />
                <YAxis {...CHART_AXIS} tickFormatter={(v) => formatMoney(Number(v), currency, true)} width={70} />
                <Tooltip {...CHART_HOVER} formatter={(value) => formatMoney(Number(value), currency)} />
                <Legend {...CHART_LEGEND} />
                {sales && <Bar dataKey="sales" name="Sales orders" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />}
                {finance && <Bar dataKey="billed" name="Invoiced" fill="#06b6d4" radius={[6, 6, 0, 0]} maxBarSize={36} />}
                {data.orders !== undefined && <Bar dataKey="purchases" name="Purchases" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={36} />}
              </BarChart>
            </ResponsiveContainer></ChartBox>
          )}
        </Panel>

        <Panel title={t("Tax Collected")} subtitle={t("Tax on sales invoices per month")} icon={BarChart3} iconClass="text-teal-500">
          {!tax || taxTrend.every((t) => !t.tax) ? (
            <EmptyState loading={loading}>{t(tax ? "No tax charged in the last 6 months." : "Tax figures are not available.")}</EmptyState>
          ) : (
            <ChartBox><ResponsiveContainer width="100%" height="100%">
              <LineChart data={taxTrend}>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="month" {...CHART_AXIS} />
                <YAxis {...CHART_AXIS} tickFormatter={(v) => formatMoney(Number(v), currency, true)} width={70} />
                <Tooltip {...CHART_HOVER} formatter={(value) => [formatMoney(Number(value), currency), "Tax"]} />
                <Line type="monotone" dataKey="tax" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer></ChartBox>
          )}
        </Panel>
    </DashboardLayout>
  );
}
