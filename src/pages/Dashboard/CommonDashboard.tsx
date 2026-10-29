import { useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { hasModule } from "../../access/access";
import {
  AlertTriangle, ClipboardX, CreditCard, FileText, FolderTree, Package, Percent, Store, UserCheck, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import {
  CHART_COLORS, CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  countOf, formatMoney, formatNumber, getList, mostCommon, sourcesForModules, titleCase, useDashboardSources,
} from "./dashboardKit";
import { companyCurrency } from "../../company/format";

// Master data shared by the modules (the common service): customers, vendors, product categories and products, plus tax set-up.

interface Customer {
  id: number;
  customerName?: string;
  customerType?: string;
  status?: string;
  active?: boolean;
  email?: string;
  phone?: string;
  taxNumber?: string;
  creditLimit?: number | null;
  outstandingBalance?: number | null;
  currencyCode?: string;
  addresses?: unknown[];
}
interface Receivable { customerId?: number; balanceAmount?: number }

const SOURCES = {
  customers: () => getList<Customer>("/v1/api/common/customers"),
  // Customer balances: CRM's outstandingBalance isn't updated by invoicing, receivables are
  receivables: () => getList<Receivable>("/v1/api/invoice/accounts-receivable"),
  taxTypes: () => countOf("/v1/api/invoice/tax-types"),
  taxDetails: () => countOf("/v1/api/invoice/tax-details"),
  products: () => countOf("/v1/api/common/products"),
  productVendors: () => countOf("/v1/api/common/vendors"),
  categories: () => countOf("/v1/api/common/product-categories"),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  customers: "customers", receivables: "receivables", taxTypes: "tax types", taxDetails: "tax details",
  products: "products", productVendors: "vendors", categories: "categories",
};

const SOURCE_MODULES: Record<keyof typeof SOURCES, string> = {
  customers: "CRM", receivables: "INVOICE", taxTypes: "INVOICE", taxDetails: "INVOICE",
  products: "PRODUCT_CATALOGUE", productVendors: "PRODUCT_CATALOGUE", categories: "PRODUCT_CATALOGUE",
};

const NO_CUSTOMER_ACCESS = "Customer figures need access to CRM.";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** What a customer record is missing for invoicing and dispatch. */
const gapsOf = (c: Customer) => [
  !c.taxNumber && "GSTIN",
  !c.email && "email",
  !c.phone && "phone",
  !(c.addresses?.length) && "address",
].filter(Boolean) as string[];

export default function CommonDashboard() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const sources = useMemo(() => sourcesForModules(SOURCES, SOURCE_MODULES, (m) => hasModule(access, m)), [access]);
  const { loading, data, failed } = useDashboardSources(sources, LABELS);

  const customers = (data.customers as Customer[] | undefined) ?? [];
  const noCustomers = data.customers === undefined && !loading ? NO_CUSTOMER_ACCESS : "No customers yet.";
  const currency = mostCommon(customers.map((c) => c.currencyCode), companyCurrency());

  // Open invoice balances per customer; without Invoice access, CRM's own figure
  const receivableByCustomer = useMemo(() => {
    const rows = data.receivables as Receivable[] | undefined;
    if (!rows) return null;
    const map = new Map<number, number>();
    rows.forEach((r) => r.customerId != null && map.set(r.customerId, (map.get(r.customerId) ?? 0) + num(r.balanceAmount)));
    return map;
  }, [data.receivables]);
  const balanceOf = (c: Customer) => (receivableByCustomer ? receivableByCustomer.get(c.id) ?? 0 : num(c.outstandingBalance));

  const active = customers.filter((c) => c.active !== false && (c.status ?? "ACTIVE") === "ACTIVE");
  const onHold = customers.filter((c) => c.status === "CREDIT_HOLD" || c.status === "BLOCKED");
  // creditLimit null = no limit
  const overLimit = customers.filter((c) => c.creditLimit != null && balanceOf(c) > num(c.creditLimit));
  const incomplete = customers.map((c) => ({ ...c, gaps: gapsOf(c) })).filter((c) => c.gaps.length > 0);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((c) => map.set(c.status || "ACTIVE", (map.get(c.status || "ACTIVE") ?? 0) + 1));
    return [...map.entries()].map(([status, count]) => ({ name: titleCase(status), value: count }));
  }, [customers]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    customers.forEach((c) => map.set(c.customerType || "Unspecified", (map.get(c.customerType || "Unspecified") ?? 0) + 1));
    return [...map.entries()].map(([type, count]) => ({ type: titleCase(type), count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [customers]);

  const topBalances = [...customers].filter((c) => balanceOf(c) > 0)
    .sort((a, b) => balanceOf(b) - balanceOf(a)).slice(0, 6);

  const countOrNull = (key: "taxTypes" | "taxDetails" | "products" | "productVendors" | "categories") =>
    (typeof data[key] === "number" ? (data[key] as number) : null);
  const tiles = [
    { name: "Customers", count: data.customers ? customers.length : null, icon: Users, route: "/customer-management", tone: "blue" as const, module: "CRM" },
    { name: "Vendors", count: countOrNull("productVendors"), icon: Store, route: "/common/vendors", tone: "amber" as const, module: "PRODUCT_CATALOGUE" },
    { name: "Product Categories", count: countOrNull("categories"), icon: FolderTree, route: "/common/categories", tone: "pink" as const, module: "PRODUCT_CATALOGUE" },
    { name: "Products", count: countOrNull("products"), icon: Package, route: "/common/products", tone: "purple" as const, module: "PRODUCT_CATALOGUE" },
    { name: "Tax Types", count: countOrNull("taxTypes"), icon: Percent, route: "/taxTypes", tone: "teal" as const, module: "INVOICE" },
    { name: "Tax Details", count: countOrNull("taxDetails"), icon: FileText, route: "/taxDetails", tone: "indigo" as const, module: "INVOICE" },
    { name: "Segments", icon: UserCheck, route: "/customer-segment", tone: "emerald" as const, module: "CRM" },
  ].filter((tile) => hasModule(access, tile.module));

  return (
    <div className="mx-auto max-w-7xl px-1 pb-6 pt-1">
      <LoadNotice failed={failed} />
      <ModuleTiles tiles={tiles} loading={loading} />

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Customers" value={data.customers ? formatNumber(active.length) : "—"}
          hint={data.customers ? `${formatNumber(customers.length)} in total` : undefined} icon={UserCheck} tone="blue" loading={loading} />
        <KpiCard label="On Hold or Blocked" value={data.customers ? formatNumber(onHold.length) : "—"} hint="Can't take new orders" icon={AlertTriangle} tone="red" loading={loading} />
        <KpiCard label="Over Credit Limit" value={data.customers ? formatNumber(overLimit.length) : "—"}
          hint={data.customers ? `${formatMoney(customers.reduce((t, c) => t + balanceOf(c), 0), currency, true)} outstanding` : undefined}
          icon={CreditCard} tone="amber" loading={loading} />
        <KpiCard label="Incomplete Records" value={data.customers ? formatNumber(incomplete.length) : "—"} hint="Missing GSTIN, email, phone or address"
          icon={ClipboardX} tone="purple" loading={loading} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Customers by Status" subtitle="Where each customer stands" icon={Users} iconClass="text-blue-500">
          {byStatus.length === 0 ? (
            <EmptyState loading={loading}>{noCustomers}</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {byStatus.map((s, i) => <Cell key={s.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Customers by Type" subtitle="Top 6 customer types" icon={UserCheck} iconClass="text-emerald-500">
          {byType.length === 0 ? (
            <EmptyState loading={loading}>{noCustomers}</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="type" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value, "Customers"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byType.map((t, i) => <Cell key={t.type} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Highest Balances" subtitle="Customers with the most outstanding" bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>Customer</th>
                <th className={TABLE_HEAD}>Outstanding</th>
                <th className={TABLE_HEAD}>Credit limit</th>
                <th className={TABLE_HEAD}>Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {topBalances.length === 0 && (
                <tr><td colSpan={4} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : noCustomers === NO_CUSTOMER_ACCESS ? noCustomers : "No outstanding balances."}</td></tr>
              )}
              {topBalances.map((c) => {
                const limit = c.creditLimit == null ? null : num(c.creditLimit);
                const used = limit ? Math.round((balanceOf(c) / limit) * 100) : null;
                return (
                  <tr key={c.id} onClick={() => navigate("/customer-management")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{c.customerName || `Customer #${c.id}`}</td>
                    <td className={TABLE_CELL}>{formatMoney(balanceOf(c), c.currencyCode || currency)}</td>
                    <td className={TABLE_CELL}>{limit == null ? "No limit" : formatMoney(limit, c.currencyCode || currency)}</td>
                    <td className={`${TABLE_CELL} font-semibold ${used != null && used > 100 ? "text-red-600" : used != null && used >= 80 ? "text-amber-600" : ""}`}>
                      {used == null ? "—" : `${used}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="Records to Complete" subtitle="Customers missing details needed on invoices" bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>Customer</th>
                <th className={TABLE_HEAD}>Status</th>
                <th className={TABLE_HEAD}>Missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {incomplete.length === 0 && (
                <tr><td colSpan={3} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : noCustomers === NO_CUSTOMER_ACCESS ? noCustomers : "Every customer record is complete."}</td></tr>
              )}
              {incomplete.slice(0, 6).map((c) => (
                <tr key={c.id} onClick={() => navigate("/customer-management")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{c.customerName || `Customer #${c.id}`}</td>
                  <td className={TABLE_CELL}>{titleCase(c.status || "ACTIVE")}</td>
                  <td className={`${TABLE_CELL} text-amber-700`}>{c.gaps.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
