import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  ArrowUpRight,
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
import PageMeta from "../../components/common/PageMeta";
import { ToasterService } from "../../Services/ToasterService";

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
  { name: "Service Schedule Notify", count: "Open", icon: FileText, route: "/service-schedule-notify", color: "blue" as ColorKey },
];

const colorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
  orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
  purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
  yellow: "bg-yellow-50 text-yellow-600 group-hover:bg-yellow-100",
  indigo: "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100",
  pink: "bg-pink-50 text-pink-600 group-hover:bg-pink-100",
  teal: "bg-teal-50 text-teal-600 group-hover:bg-teal-100",
};

const solidColorClasses: Record<ColorKey, string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-orange-600",
  purple: "bg-purple-50 text-purple-600",
  yellow: "bg-yellow-50 text-yellow-600",
  indigo: "bg-indigo-50 text-indigo-600",
  pink: "bg-pink-50 text-pink-600",
  teal: "bg-teal-50 text-teal-600",
};

const accentBorderClasses: Record<ColorKey, string> = {
  blue: "border-t-blue-400",
  emerald: "border-t-emerald-400",
  orange: "border-t-orange-400",
  purple: "border-t-purple-400",
  yellow: "border-t-yellow-400",
  indigo: "border-t-indigo-400",
  pink: "border-t-pink-400",
  teal: "border-t-teal-400",
};

const moduleGridClasses: Record<string, string> = {
  Sales: "grid-cols-2 sm:grid-cols-3 md:grid-cols-6",
  Service: "grid-cols-2 sm:grid-cols-2 md:grid-cols-4",
};

const chartColors = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1"];

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
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
      return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    }
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  return raw;
}

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();
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

  const cards: {
    label: string;
    value: string;
    icon: typeof DollarSign;
    color: ColorKey;
    sub?: string;
    subTone?: "positive" | "negative" | "neutral";
  }[] = [
    {
      label: "Total Sales",
      value: money(report.totalSales),
      icon: DollarSign,
      color: "blue",
      sub:
        salesDelta !== null
          ? `${salesDelta >= 0 ? "↑" : "↓"} ${Math.abs(salesDelta).toFixed(1)}% vs last month`
          : undefined,
      subTone: salesDelta !== null ? (salesDelta >= 0 ? "positive" : "negative") : "neutral",
    },
    {
      label: "Total Orders",
      value: Number(report.totalOrders || 0).toLocaleString(),
      icon: ShoppingCart,
      color: "emerald",
      sub: avgOrderValue !== null ? `Avg ${money(avgOrderValue)} / order` : undefined,
      subTone: "neutral",
    },
    {
      label: "Total Customers",
      value: Number(report.totalCustomers || 0).toLocaleString(),
      icon: Users,
      color: "purple",
      sub: avgOrdersPerCustomer !== null ? `${avgOrdersPerCustomer.toFixed(1)} orders / customer` : undefined,
      subTone: "neutral",
    },
    {
      label: "Top Products",
      value: Number(report.topProducts?.length || 0).toLocaleString(),
      icon: Package,
      color: "orange",
      sub: topProductName ? `#1: ${topProductName}` : undefined,
      subTone: "neutral",
    },
  ];

  const groups = [
    { title: "Sales", modules: salesModulesBase },
    { title: "Service", modules: serviceModulesBase },
  ];

  return (
    <>
      <PageMeta title="Sales Dashboard" description="Sales overview and analytics" />

      {/* Fixed-height flex column: breadcrumb stays put at the top,
          only the content area below it scrolls. `min-h-0` on the
          scroll child is required for flex-1 overflow to work. */}
      <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
        <div className="shrink-0">
          <PageBreadcrumb pageTitle="Sales Dashboard" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-16 sm:p-6 sm:pb-20">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {group.title}
                </h3>
                <div
                  className={`grid gap-2.5 ${
                    moduleGridClasses[group.title] || "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                  }`}
                >
                  {group.modules.map((module) => {
                    const Icon = module.icon;
                    const colorClass = colorClasses[module.color];
                    return (
                      <button
                        key={module.name}
                        onClick={() => navigate(module.route)}
                        className="group flex flex-col items-center rounded-lg border border-gray-100 bg-white px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className={`rounded-md p-1.5 ${colorClass} transition-colors duration-200`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <h4 className="mt-1.5 text-xs font-semibold text-gray-900 transition-colors group-hover:text-cyan-600">
                          {module.name}
                        </h4>
                        <p className="mt-0.5 text-[10px] text-gray-500">{module.count}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {cards.map((card) => {
                const Icon = card.icon;
                const chipClass = solidColorClasses[card.color];
                const accentClass = accentBorderClasses[card.color];
                const subColorClass =
                  card.subTone === "positive"
                    ? "text-emerald-600"
                    : card.subTone === "negative"
                    ? "text-red-600"
                    : "text-gray-500";
                return (
                  <div
                    key={card.label}
                    className={`flex h-full flex-col justify-between rounded-xl border border-t-[3px] border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${accentClass}`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className={`rounded-lg p-2 ${chipClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={
                          loading
                            ? "rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                            : "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600"
                        }
                      >
                        {loading ? "Loading" : "Live"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{card.label}</p>
                      <p className="mt-0.5 text-2xl font-bold text-gray-900 sm:text-3xl">{card.value}</p>
                      <p className={`mt-1.5 truncate text-xs font-medium ${subColorClass}`}>
                        {card.sub || "\u00A0"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-100 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Monthly sales</h3>
                    <p className="mt-0.5 text-xs text-gray-500">From sales report API</p>
                  </div>
                  {salesDelta !== null ? (
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        salesDelta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {salesDelta >= 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(salesDelta).toFixed(1)}%
                    </span>
                  ) : (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={monthlySales.map((m) => ({ month: m.label, sales: m.sales }))}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip formatter={(value: any) => money(Number(value) || 0)} />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#salesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border border-gray-100 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Top products</h3>
                    <p className="mt-0.5 text-xs text-gray-500">Ranked by sales volume</p>
                  </div>
                  <Package className="h-4 w-4 text-orange-500" />
                </div>
                {productData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={productData} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={110} />
                      <Tooltip formatter={(value: any) => [value, "Rank score"]} />
                      <Bar dataKey="rank" radius={[0, 4, 4, 0]} barSize={20}>
                        {productData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList
                          dataKey="rank"
                          position="right"
                          style={{ fontSize: 11, fill: "#6b7280" }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
                    No top products found
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Monthly sales data</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {monthlySales.length} month{monthlySales.length === 1 ? "" : "s"} · Total{" "}
                    {money(monthlyTotal)}
                  </p>
                </div>
                <Calendar className="h-4 w-4 text-cyan-500" />
              </div>

              {monthlySales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-sm text-gray-500">
                  <Package className="mb-2 h-8 w-8 text-gray-300" />
                  No monthly sales found
                </div>
              ) : (
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Month
                        </th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Sales
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlySales.map((item) => (
                        <tr key={item.raw} className="transition hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {item.label}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-700">
                            {money(item.sales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-gray-50">
                      <tr>
                        <td className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Total
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                          {money(monthlyTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesDashboard;