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

// Hover-state chip color, used on the module tiles
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

// Flat chip color, used on the stat card icons (no hover conflict)
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

// Top border accent for each stat card, ties the number to its icon color
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

const chartColors = ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#6366f1"];

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const SalesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

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
      .map(([month, sales]) => ({ month, sales, date: new Date(month) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ month, sales }) => ({ month, sales }));
  }, [report.monthlySales]);

  // Month-over-month delta for the sales trend card
  const salesDelta = useMemo(() => {
    if (monthlySales.length < 2) return null;
    const last = monthlySales[monthlySales.length - 1].sales;
    const prev = monthlySales[monthlySales.length - 2].sales;
    if (!prev) return null;
    return ((last - prev) / prev) * 100;
  }, [monthlySales]);

  const productData = useMemo(
    () => (report.topProducts || []).map((name, index) => ({
      name,
      rank: report.topProducts.length - index,
      color: chartColors[index % chartColors.length],
    })),
    [report.topProducts]
  );

  const cards = [
    { label: "Total Sales", value: money(report.totalSales), icon: DollarSign, color: "blue" as ColorKey },
    { label: "Total Orders", value: Number(report.totalOrders || 0).toLocaleString(), icon: ShoppingCart, color: "emerald" as ColorKey },
    { label: "Total Customers", value: Number(report.totalCustomers || 0).toLocaleString(), icon: Users, color: "purple" as ColorKey },
    { label: "Top Products", value: Number(report.topProducts?.length || 0).toLocaleString(), icon: Package, color: "orange" as ColorKey },
  ];

  const groups = [
    { title: "Sales", modules: salesModulesBase },
    { title: "Service", modules: serviceModulesBase },
  ];

  return (
    <>
      <PageMeta title="Sales Dashboard" description="Sales overview and analytics" />
      <PageBreadcrumb pageTitle="Sales Dashboard" />

      <div className="mx-auto max-w-7xl space-y-8 p-6">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {group.title}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {group.modules.map((module) => {
                const Icon = module.icon;
                const colorClass = colorClasses[module.color];
                return (
                  <button
                    key={module.name}
                    onClick={() => navigate(module.route)}
                    className="group flex flex-col items-center rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className={`rounded-lg p-2.5 ${colorClass} transition-colors duration-200`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-gray-900 transition-colors group-hover:text-cyan-600">
                      {module.name}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-500">{module.count}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const chipClass = solidColorClasses[card.color];
            const accentClass = accentBorderClasses[card.color];
            return (
              <div
                key={card.label}
                className={`flex h-full flex-col justify-between rounded-xl border border-t-4 border-gray-100 bg-white p-5 transition-all duration-200 hover:shadow-md ${accentClass}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className={`rounded-lg p-2.5 ${chipClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={
                      loading
                        ? "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                        : "rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600"
                    }
                  >
                    {loading ? "Loading" : "Live"}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="mt-1 text-sm text-gray-500">{card.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Monthly sales</h3>
                <p className="mt-0.5 text-xs text-gray-500">From sales report API</p>
              </div>
              {salesDelta !== null ? (
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                    salesDelta >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  }`}
                >
                  {salesDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(salesDelta).toFixed(1)}% vs last month
                </span>
              ) : (
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              )}
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlySales}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip formatter={(value: any) => money(Number(value) || 0)} />
                <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Top products</h3>
                <p className="mt-0.5 text-xs text-gray-500">Ranked by sales volume</p>
              </div>
              <Package className="h-5 w-5 text-orange-500" />
            </div>
            {productData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={productData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={110} />
                  <Tooltip formatter={(value: any) => [value, "Rank score"]} />
                  <Bar dataKey="rank" radius={[0, 4, 4, 0]} barSize={22}>
                    {productData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList dataKey="rank" position="right" style={{ fontSize: 12, fill: "#6b7280" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-gray-500">
                No top products found
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Monthly sales data</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <tbody className="divide-y divide-gray-100">
              {monthlySales.map((item) => (
                <tr key={item.month}>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{item.month}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{money(item.sales)}</td>
                </tr>
              ))}
              {monthlySales.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-gray-500">No monthly sales found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default SalesDashboard;
