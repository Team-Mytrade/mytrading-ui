import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Users2,
} from "lucide-react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  CHART_GRID, CHART_GRID_V, CHART_AXIS, CHART_HOVER, ChartBox, DashboardLayout, EmptyState, KpiCard, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD, formatMoney,
  type DashboardTile, type Tone,
} from "../Dashboard/dashboardKit";
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";
import { formatAmount, formatNumber, dateLocale } from "../../company/format";

import { t } from "../../i18n/i18n";
type SalesReport = {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  topProducts: string[];
  monthlySales: Record<string, number>;
};

type ColorKey = "blue" | "emerald" | "orange" | "purple" | "yellow" | "indigo" | "pink" | "teal";

const emptyReport: SalesReport = {
  totalSales: 0,
  totalOrders: 0,
  totalCustomers: 0,
  topProducts: [],
  monthlySales: {},
};

const salesModulesBase = [
  { name: "Sales Persons", count: "Open", icon: Users, route: "/sales-persons", color: "purple" as ColorKey },
  { name: "Sales Targets", count: "Open", icon: TrendingUp, route: "/sales-targets", color: "emerald" as ColorKey },
  { name: "Sales Channels", count: "Open", icon: Users2, route: "/sales-channels", color: "blue" as ColorKey },
  { name: "Credit Limit", count: "Open", icon: CreditCard, route: "/credit-limit", color: "teal" as ColorKey },
  { name: "Quotations", count: "Open", icon: FileText, route: "/quotations", color: "pink" as ColorKey },
  { name: "Sales Orders", count: "Open", icon: ShoppingCart, route: "/sales-orders", color: "orange" as ColorKey },
];

const serviceModulesBase = [
  { name: "Return Requests", count: "Open", icon: ArrowDownRight, route: "/return-requests", color: "yellow" as ColorKey },
  { name: "Refunds", count: "Open", icon: DollarSign, route: "/refunds", color: "indigo" as ColorKey },
  { name: "Service Schedules", count: "Open", icon: Calendar, route: "/service-schedules", color: "emerald" as ColorKey },
  { name: "Service Reminders", count: "Open", icon: FileText, route: "/service-schedule-notify", color: "blue" as ColorKey },
];

// Tiles and summary cards use the shared tinted card (approval-queue look, see dashboardKit); each colour
// key maps onto one of its tones
const toneOf: Record<ColorKey, Tone> = {
  blue: "blue", emerald: "emerald", orange: "orange", purple: "purple", yellow: "amber", indigo: "indigo", pink: "pink", teal: "teal",
};

const chartColors = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1"];

function money(value: number | string | undefined) {
  return formatAmount(value);
}

function formatMonthLabel(raw: string): string {
  if (!raw) return "--";
  if (/^[A-Za-z]{3,}\s+\d{4}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (match) {
    const year = Number(match[1]);
    const monthIdx = Number(match[2]) - 1;
    const d = new Date(year, monthIdx, 1);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(dateLocale(), { month: "short", year: "numeric" });
    }
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(dateLocale(), { month: "short", year: "numeric" });
  }
  return raw;
}

const SalesDashboard: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token
    ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` }
    : undefined;

  const [report, setReport] = useState<SalesReport>(emptyReport);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SalesReport>("/v1/api/sales/reports", {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setReport({ ...emptyReport, ...res.data });
    } catch (error) {
      ToasterService.error("Failed to load sales dashboard");
      setReport(emptyReport);
    } finally {
      setLoading(false);
    }
  };

  const monthlySales = useMemo(() => {
    const entries = Object.entries(report.monthlySales || {});
    return entries
      .map(([rawMonth, sales]) => ({
        raw: rawMonth,
        label: formatMonthLabel(rawMonth),
        sales: Number(sales) || 0,
        sortKey: (() => {
          const m = rawMonth.match(/^(\d{4})-(\d{1,2})/);
          if (m) return Number(m[1]) * 100 + Number(m[2]);
          const d = new Date(rawMonth);
          return Number.isNaN(d.getTime()) ? 0 : d.getFullYear() * 100 + (d.getMonth() + 1);
        })(),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [report.monthlySales]);

  const salesDelta = useMemo(() => {
    if (monthlySales.length < 2) return null;
    const last = monthlySales[monthlySales.length - 1].sales;
    const prev = monthlySales[monthlySales.length - 2].sales;
    if (!prev) return null;
    return ((last - prev) / prev) * 100;
  }, [monthlySales]);

  const monthlyTotal = useMemo(
    () => monthlySales.reduce((sum, item) => sum + item.sales, 0),
    [monthlySales]
  );

  const productData = useMemo(
    () =>
      (report.topProducts || []).map((name, index) => ({
        name,
        rank: report.topProducts.length - index,
        color: chartColors[index % chartColors.length],
      })),
    [report.topProducts]
  );

  const avgOrderValue = report.totalOrders > 0 ? report.totalSales / report.totalOrders : null;
  const avgOrdersPerCustomer =
    report.totalCustomers > 0 ? report.totalOrders / report.totalCustomers : null;
  const topProductName = report.topProducts?.[0] || null;

  const tiles: DashboardTile[] = [...salesModulesBase, ...serviceModulesBase].map((m) => ({
    name: m.name, route: m.route, icon: m.icon, tone: toneOf[m.color],
  }));

  return (
    <>
      <PageMeta title={t("Sales Dashboard")} description="Sales overview and analytics" />
      <PageBreadcrumb pageTitle="Sales Dashboard" />

      <DashboardLayout
        links={<ModuleTiles tiles={tiles} loading={false} />}
        panelClass="lg:grid-cols-3"
        kpis={
          <>
            <KpiCard label={t("Total Sales")} value={money(report.totalSales)} icon={DollarSign} tone="blue" loading={loading}
              hint={salesDelta !== null ? (
                <span className={salesDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                  {`${salesDelta >= 0 ? "↑" : "↓"} ${Math.abs(salesDelta).toFixed(1)}% vs last month`}
                </span>
              ) : undefined} />
            <KpiCard label={t("Total Orders")} value={formatNumber(Number(report.totalOrders || 0))} icon={ShoppingCart} tone="emerald" loading={loading}
              hint={avgOrderValue !== null ? `Avg ${money(avgOrderValue)} / order` : undefined} />
            <KpiCard label={t("Total Customers")} value={formatNumber(Number(report.totalCustomers || 0))} icon={Users} tone="purple" loading={loading}
              hint={avgOrdersPerCustomer !== null ? `${avgOrdersPerCustomer.toFixed(1)} orders / customer` : undefined} />
            <KpiCard label={t("Top Products")} value={formatNumber(Number(report.topProducts?.length || 0))} icon={Package} tone="orange" loading={loading}
              hint={topProductName ? `#1: ${topProductName}` : undefined} />
          </>
        }
      >
        <Panel title={t("Monthly sales")} subtitle={t("From sales report API")} icon={TrendingUp} iconClass="text-emerald-500">
          {monthlySales.length === 0 ? (
            <EmptyState loading={loading}>{t("No monthly sales found")}</EmptyState>
          ) : (
            <ChartBox><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales.map((m) => ({ month: m.label, sales: m.sales }))}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis dataKey="month" {...CHART_AXIS} />
                <YAxis {...CHART_AXIS} tickFormatter={(v) => formatMoney(Number(v), null, true)} width={70} />
                <Tooltip {...CHART_HOVER} formatter={(value) => money(Number(value) || 0)} />
                <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer></ChartBox>
          )}
        </Panel>

        <Panel title={t("Top products")} subtitle={t("Ranked by sales volume")} icon={Package} iconClass="text-orange-500">
          {productData.length === 0 ? (
            <EmptyState loading={loading}>{t("No top products found")}</EmptyState>
          ) : (
            <ChartBox><ResponsiveContainer width="100%" height="100%">
              <BarChart data={productData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid {...CHART_GRID_V} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" {...CHART_AXIS} width={110} />
                <Tooltip {...CHART_HOVER} formatter={(value) => [value, "Rank score"]} />
                <Bar dataKey="rank" radius={[0, 6, 6, 0]} maxBarSize={28} barSize={20}>
                  {productData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  <LabelList dataKey="rank" position="right" style={{ fontSize: 11, fill: "#9ca3af" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer></ChartBox>
          )}
        </Panel>

        <Panel title={t("Monthly sales data")} icon={Calendar} iconClass="text-cyan-500" bodyClass="p-0"
          subtitle={`${monthlySales.length} month${monthlySales.length === 1 ? "" : "s"} · Total ${money(monthlyTotal)}`}>
          {monthlySales.length === 0 ? (
            <EmptyState loading={loading}>{t("No monthly sales found")}</EmptyState>
          ) : (
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead>
                <tr>
                  <th className={TABLE_HEAD}>{t("Month")}</th>
                  <th className={`${TABLE_HEAD} text-right`}>{t("Sales")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {monthlySales.map((item) => (
                  <tr key={item.raw} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-gray-100`}>{item.label}</td>
                    <td className={`${TABLE_CELL} text-right`}>{money(item.sales)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[#f4fcfd] dark:bg-gray-900">
                <tr>
                  <td className={`${TABLE_CELL} text-xs font-semibold uppercase tracking-wide`}>{t("Total")}</td>
                  <td className={`${TABLE_CELL} text-right font-semibold text-gray-900 dark:text-white`}>{money(monthlyTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Panel>
      </DashboardLayout>
    </>
  );
};

export default SalesDashboard;