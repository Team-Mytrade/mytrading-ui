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

const salesModules = [
  { name: "Sales Persons", count: "Open", icon: Users, route: "/sales-persons", color: "purple" },
  { name: "Sales Targets", count: "Open", icon: TrendingUp, route: "/sales-targets", color: "emerald" },
  { name: "Sales Channels", count: "Open", icon: Users2, route: "/sales-channels", color: "blue" },
  { name: "Credit Limit", count: "Open", icon: CreditCard, route: "/credit-limit", color: "teal" },
  { name: "Quotations", count: "Open", icon: FileText, route: "/quotations", color: "pink" },
  { name: "Sales Orders", count: "Open", icon: ShoppingCart, route: "/sales-orders", color: "orange" },
  { name: "Return Requests", count: "Open", icon: ArrowDownRight, route: "/return-requests", color: "yellow" },
  { name: "Refunds", count: "Open", icon: DollarSign, route: "/refunds", color: "indigo" },
  { name: "Service Schedules", count: "Open", icon: Calendar, route: "/service-schedules", color: "emerald" },
  { name: "Service Schedule Notify", count: "Open", icon: FileText, route: "/service-schedule-notify", color: "blue" },
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

  const monthlySales = useMemo(
    () => Object.entries(report.monthlySales || {}).map(([month, sales]) => ({ month, sales })),
    [report.monthlySales]
  );

  const productData = useMemo(
    () => (report.topProducts || []).map((name, index) => ({
      name,
      rank: report.topProducts.length - index,
      color: chartColors[index % chartColors.length],
    })),
    [report.topProducts]
  );

  const cards = [
    { label: "Total Sales", value: money(report.totalSales), icon: DollarSign, color: "blue" },
    { label: "Total Orders", value: Number(report.totalOrders || 0).toLocaleString(), icon: ShoppingCart, color: "emerald" },
    { label: "Total Customers", value: Number(report.totalCustomers || 0).toLocaleString(), icon: Users, color: "purple" },
    { label: "Top Products", value: Number(report.topProducts?.length || 0).toLocaleString(), icon: Package, color: "orange" },
  ];

  return (
    <>
      <PageMeta title="Sales Dashboard" description="Sales overview and analytics" />
      <PageBreadcrumb pageTitle="Sales Dashboard" />

      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {salesModules.map((module) => {
            const Icon = module.icon;
            const colorClass = colorClasses[module.color as ColorKey];
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const colorClass = colorClasses[card.color as ColorKey].replace("group-hover:bg-", "bg-");
            return (
              <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5 transition-all duration-200 hover:shadow-md">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`rounded-lg p-2.5 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                    {loading ? "Loading" : "Live"}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="mt-1 text-sm text-gray-500">{card.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Monthly Sales</h3>
                <p className="mt-0.5 text-xs text-gray-500">From sales report API</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
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
                <Tooltip />
                <Area type="monotone" dataKey="sales" stroke="#06b6d4" strokeWidth={2} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Top Products</h3>
                <p className="mt-0.5 text-xs text-gray-500">Products returned by report API</p>
              </div>
              <Package className="h-5 w-5 text-orange-500" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={productData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={90} />
                <Tooltip />
                <Bar dataKey="rank" radius={[0, 4, 4, 0]}>
                  {productData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Monthly Sales Data</h3>
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

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">Top Product List</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <tbody className="divide-y divide-gray-100">
                {(report.topProducts || []).map((product, index) => (
                  <tr key={`${product}-${index}`}>
                    <td className="px-5 py-3 text-sm text-gray-600">#{index + 1}</td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{product}</td>
                  </tr>
                ))}
                {(!report.topProducts || report.topProducts.length === 0) && (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-gray-500">No top products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesDashboard;
