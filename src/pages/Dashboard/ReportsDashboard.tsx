import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ArrowRight, BarChart3, Boxes, ClipboardList, HandCoins, IndianRupee, Landmark, Percent, ShoppingBag, ShoppingCart,
  TrendingUp, Users, type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AuthContext } from "../../context/AuthContext";
import { hasModule } from "../../access/access";
import {
  CHART_TOOLTIP, EmptyState, KpiCard, toneCard, toneIcon, toneLink, type Tone, LoadNotice, Panel, formatMoney, formatNumber, getList, monthKeyOf, monthsBack,
  mostCommon, sourcesForModules, sum, useDashboardSources,
} from "./dashboardKit";

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

interface ReportCard { name: string; description: string; route: string; icon: LucideIcon; module: string; figure?: string; tone: Tone }

export default function ReportsDashboard() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const sources = useMemo(() => sourcesForModules(SOURCES, SOURCE_MODULES, (m) => hasModule(access, m)), [access]);
  const { loading, data, failed } = useDashboardSources(sources, LABELS);

  const sales = data.sales as SalesReport | undefined;
  const finance = data.finance as FinanceReport | undefined;
  const tax = data.tax as TaxReport | undefined;
  const orders = ((data.orders as PurchaseOrder[] | undefined) ?? []).filter((o) => o.status !== "CANCELLED");
  const stock = (data.stock as StockLevel[] | undefined) ?? [];
  const products = (data.products as Product[] | undefined) ?? [];
  const currency = mostCommon(orders.map((o) => o.currency), "INR");

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
  const cards: ReportCard[] = ([
    { name: "Sales Dashboard", description: "Orders, revenue and top products", route: "/sales-dashboard", icon: ShoppingCart, module: "SALES", tone: "emerald",
      figure: sales ? `${money(sales.totalSales)} · ${formatNumber(num(sales.totalOrders))} orders` : undefined },
    { name: "Purchase Reports", description: "Spend by month, vendor and turnaround", route: "/purchase-reports", icon: ClipboardList, module: "PURCHASE", tone: "indigo",
      figure: data.orders ? `${money(purchaseTotal)} · ${formatNumber(orders.length)} orders` : undefined },
    { name: "Inventory Report", description: "Stock, valuation, movements and expiry", route: "/inventory-report", icon: Boxes, module: "INVENTORY", tone: "amber",
      figure: data.stock ? `${money(stockValue)} · ${formatNumber(lowStock)} low` : undefined },
    { name: "Finance Report", description: "Billed, collected and overdue", route: "/financeReport", icon: Landmark, module: "INVOICE", tone: "cyan",
      figure: finance ? `${money(finance.outstandingAmount)} outstanding` : undefined },
    { name: "Tax Report", description: "GST charged on sales invoices by month", route: "/taxReport", icon: Percent, module: "INVOICE", tone: "teal",
      figure: tax ? `${money(tax.totalTaxAmount)} tax` : undefined },
    { name: "CRM Reports", description: "Leads, deals and activity", route: "/crm-reports", icon: Users, module: "CRM", tone: "purple" },
  ] as ReportCard[]).filter((c) => hasModule(access, c.module));

  return (
    <div className="mx-auto max-w-7xl px-1 pb-6 pt-1">
      <LoadNotice failed={failed} />

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          // Same card as the approval queues: tinted card, icon chip, headline figure, "Open report" link
          <button key={c.name} type="button" onClick={() => navigate(c.route)}
            className={`group flex flex-col justify-between space-y-2 p-3.5 text-left ${toneCard(c.tone)}`}>
            <span className="flex items-center gap-2">
              <span className={`rounded-lg p-1.5 ${toneIcon(c.tone)}`}><c.icon className="h-4 w-4" /></span>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{c.name}</span>
            </span>
            <span className="block text-[11px] text-gray-600 dark:text-gray-400">
              {c.description}
              {(loading || c.figure) && <span className="block truncate font-semibold text-gray-800 dark:text-gray-200">{loading ? "…" : c.figure}</span>}
            </span>
            <span className={`flex items-center gap-1 pt-1 text-xs font-bold transition-all group-hover:translate-x-0.5 ${toneLink(c.tone)}`}>
              Open report <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Sales" value={sales ? money(sales.totalSales) : "—"}
          hint={sales ? `${formatNumber(num(sales.totalOrders))} orders · ${formatNumber(num(sales.totalCustomers))} customers` : undefined} icon={ShoppingCart} tone="emerald" loading={loading} />
        <KpiCard label="Purchases" value={data.orders ? money(purchaseTotal) : "—"}
          hint={data.orders ? `${formatNumber(orders.length)} purchase orders` : undefined} icon={ShoppingBag} tone="indigo" loading={loading} />
        <KpiCard label="Stock Value" value={data.stock && data.products ? money(stockValue) : "—"}
          hint={data.stock ? `${formatNumber(lowStock)} record(s) at or below reorder level` : undefined} icon={IndianRupee} tone="amber" loading={loading} />
        <KpiCard label="Receivables" value={finance ? money(finance.outstandingAmount) : "—"}
          hint={finance ? `${formatNumber(finance.overdueInvoices?.length ?? 0)} overdue invoice(s)` : undefined} icon={HandCoins} tone="red" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Sales, Billing and Purchases" subtitle="Per month (last 6 months)" icon={TrendingUp} iconClass="text-emerald-500">
          {!hasTrend ? (
            <EmptyState loading={loading}>No sales, invoices or purchases in the last 6 months.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => formatMoney(Number(v), currency, true)} width={70} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => formatMoney(Number(value), currency)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {sales && <Bar dataKey="sales" name="Sales orders" fill="#10b981" radius={[4, 4, 0, 0]} />}
                {finance && <Bar dataKey="billed" name="Invoiced" fill="#06b6d4" radius={[4, 4, 0, 0]} />}
                {data.orders !== undefined && <Bar dataKey="purchases" name="Purchases" fill="#6366f1" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Tax Collected" subtitle="GST on sales invoices per month" icon={BarChart3} iconClass="text-teal-500">
          {!tax || taxTrend.every((t) => !t.tax) ? (
            <EmptyState loading={loading}>{tax ? "No tax charged in the last 6 months." : "Tax figures are not available."}</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={taxTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => formatMoney(Number(v), currency, true)} width={70} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [formatMoney(Number(value), currency), "Tax"]} />
                <Line type="monotone" dataKey="tax" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
}
