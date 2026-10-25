import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ShoppingCart,
  Truck,
  Package,
  Receipt,
  Calendar,
  TrendingUp,
  BarChart3,
  ScrollText,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  CHART_COLORS, CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  countOf, formatDate, formatMoney, formatNumber, getList, monthKeyOf, monthsBack, mostCommon, sum,
  useDashboardSources,
} from "../Dashboard/dashboardKit";

// Live procurement overview built from the purchase and common services.

interface Requisition {
  id: number;
  requisitionNumber?: string;
  status?: string;
  requiredByDate?: string;
  items?: { quantity?: number; estimatedUnitCost?: number }[];
}

interface PurchaseOrder {
  id: number;
  poNumber?: string;
  orderDate?: string;
  status?: string;
  approvalStatus?: string;
  totalAmount?: number;
  currency?: string;
  vendor?: { name?: string; vendorCode?: string } | null;
  items?: { productId?: number; productCode?: string; productName?: string; quantity?: number; totalPrice?: number }[];
}

interface GoodsReceipt {
  id: number;
  receiptNumber?: string;
  poNumber?: string;
  receiptDate?: string;
  status?: string;
}

interface Vendor {
  id: number;
  active?: boolean | null;
}

const PURCHASE = "/v1/api/purchase";
const SOURCES = {
  requisitions: () => getList<Requisition>(`${PURCHASE}/purchase-requisitions`),
  orders: () => getList<PurchaseOrder>(`${PURCHASE}/purchase-orders`),
  receipts: () => getList<GoodsReceipt>(`${PURCHASE}/grns`),
  vendors: () => getList<Vendor>("/v1/api/common/vendors"),
  products: () => countOf("/v1/api/common/products"),
  terms: () => countOf(`${PURCHASE}/terms`),
  deliveries: () => countOf(`${PURCHASE}/deliveries`),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  requisitions: "requisitions",
  orders: "purchase orders",
  receipts: "goods receipts",
  vendors: "vendors",
  products: "products",
  terms: "terms and conditions",
  deliveries: "deliveries",
};

const OPEN_REQUISITION = ["DRAFT", "SUBMITTED", "IN_REVIEW"];
const AWAITING_APPROVAL = ["SUBMITTED", "IN_REVIEW"];
const CLOSED_ORDER = ["RECEIVED", "CANCELLED"];

const ProcurementDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { loading, data, failed } = useDashboardSources(SOURCES, LABELS);

  const requisitions = (data.requisitions as Requisition[] | undefined) ?? [];
  const orders = (data.orders as PurchaseOrder[] | undefined) ?? [];
  const receipts = (data.receipts as GoodsReceipt[] | undefined) ?? [];
  const vendors = data.vendors as Vendor[] | undefined;
  const liveOrders = orders.filter((o) => o.status !== "CANCELLED");
  const currency = mostCommon(orders.map((o) => o.currency), "INR");

  const openRequisitions = requisitions.filter((r) => OPEN_REQUISITION.includes(r.status ?? ""));
  const awaitingRequisitions = requisitions.filter((r) => AWAITING_APPROVAL.includes(r.status ?? ""));
  const openOrders = orders.filter((o) => !CLOSED_ORDER.includes(o.status ?? ""));
  const ordersAwaitingApproval = liveOrders.filter((o) => o.approvalStatus === "PENDING" || o.approvalStatus === "IN_REVIEW");
  const draftReceipts = receipts.filter((g) => g.status === "DRAFT");

  const trend = useMemo(() => monthsBack(6).map(({ key, label }) => {
    const inMonth = liveOrders.filter((o) => monthKeyOf(o.orderDate) === key);
    return { month: label, orders: inMonth.length, value: sum(inMonth, (o) => o.totalAmount) };
  }), [liveOrders]);

  const suppliers = useMemo(() => {
    const byVendor = new Map<string, { name: string; orders: number; value: number }>();
    liveOrders.forEach((o) => {
      const name = o.vendor?.name || o.vendor?.vendorCode || "Unknown vendor";
      const entry = byVendor.get(name) ?? { name, orders: 0, value: 0 };
      entry.orders += 1;
      entry.value += Number(o.totalAmount) || 0;
      byVendor.set(name, entry);
    });
    return [...byVendor.values()].sort((a, b) => b.orders - a.orders || b.value - a.value).slice(0, 5);
  }, [liveOrders]);

  const topProducts = useMemo(() => {
    const byProduct = new Map<string, { name: string; sku: string; orders: Set<number>; qty: number; value: number }>();
    liveOrders.forEach((o) => (o.items ?? []).forEach((item) => {
      const key = String(item.productId ?? item.productCode ?? item.productName ?? "");
      if (!key) return;
      const entry = byProduct.get(key) ?? { name: item.productName || item.productCode || `Product #${key}`, sku: item.productCode || "—", orders: new Set<number>(), qty: 0, value: 0 };
      entry.orders.add(o.id);
      entry.qty += Number(item.quantity) || 0;
      entry.value += Number(item.totalPrice) || 0;
      byProduct.set(key, entry);
    }));
    return [...byProduct.values()].sort((a, b) => b.value - a.value || b.qty - a.qty).slice(0, 5);
  }, [liveOrders]);

  const approvals = useMemo(() => [
    ...awaitingRequisitions.map((r) => ({
      key: `pr-${r.id}`, type: "Purchase requisition", reference: r.requisitionNumber || `PR #${r.id}`,
      details: `${r.items?.length ?? 0} item(s)`, amount: sum(r.items ?? [], (i) => (Number(i.quantity) || 0) * (Number(i.estimatedUnitCost) || 0)),
      date: r.requiredByDate, route: "/purchase-service/requisitions",
    })),
    ...ordersAwaitingApproval.map((o) => ({
      key: `po-${o.id}`, type: "Purchase order", reference: o.poNumber || `PO #${o.id}`,
      details: o.vendor?.name || "—", amount: Number(o.totalAmount) || 0,
      date: o.orderDate, route: "/purchase-service/orders",
    })),
    ...draftReceipts.map((g) => ({
      key: `grn-${g.id}`, type: "Goods receipt", reference: g.receiptNumber || `GRN #${g.id}`,
      details: g.poNumber ? `PO ${g.poNumber}` : "—", amount: null as number | null,
      date: g.receiptDate, route: "/purchase-service/goods-receipt-notes",
    })),
  ].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""))).slice(0, 6),
  [awaitingRequisitions, ordersAwaitingApproval, draftReceipts]);

  const countOrNull = (key: "products" | "terms" | "deliveries") => (typeof data[key] === "number" ? (data[key] as number) : null);
  const tiles = [
    { name: "Purchase Requisitions", count: data.requisitions ? requisitions.length : null, icon: FileText, route: "/purchase-service/requisitions", tone: "blue" as const },
    { name: "Purchase Orders", count: data.orders ? orders.length : null, icon: ShoppingCart, route: "/purchase-service/orders", tone: "emerald" as const },
    { name: "Goods Receipt Notes", count: data.receipts ? receipts.length : null, icon: Receipt, route: "/purchase-service/goods-receipt-notes", tone: "pink" as const },
    { name: "Vendors", count: vendors ? vendors.length : null, icon: Truck, route: "/common/vendors", tone: "orange" as const },
    { name: "Products", count: countOrNull("products"), icon: Package, route: "/common/products", tone: "purple" as const },
    { name: "Terms and Conditions", count: countOrNull("terms"), icon: ScrollText, route: "/terms-and-conditions", tone: "indigo" as const },
    { name: "Deliveries", count: countOrNull("deliveries"), icon: Calendar, route: "/deliveries", tone: "red" as const },
    { name: "Purchase Reports", icon: BarChart3, route: "/purchase-reports", tone: "teal" as const },
  ];

  const pipeline = [
    { title: "Requisition", tone: "text-blue-600", value: openRequisitions.length, note: "Open requisitions", route: "/purchase-service/requisitions" },
    { title: "Purchase Order", tone: "text-emerald-600", value: openOrders.length, note: "Open purchase orders", route: "/purchase-service/orders" },
    { title: "Goods Receipt", tone: "text-orange-600", value: draftReceipts.length, note: "Receipts in draft", route: "/purchase-service/goods-receipt-notes" },
    { title: "Approval", tone: "text-purple-600", value: awaitingRequisitions.length + ordersAwaitingApproval.length, note: "Awaiting approval", route: "/purchase-service/requisitions" },
  ];

  return (
    <>
      <PageMeta title="Procurement Dashboard" description="Procurement and purchasing overview" />
      <PageBreadcrumb pageTitle="Procurement Dashboard" />

      <div className="mx-auto max-w-7xl px-1 pb-6 pt-1">
        <LoadNotice failed={failed} />
        <ModuleTiles tiles={tiles} loading={loading} />

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Open Requisitions" value={formatNumber(openRequisitions.length)} hint={`${formatNumber(requisitions.length)} in total`} icon={FileText} tone="blue" loading={loading} />
          <KpiCard label="Open Purchase Orders" value={formatNumber(openOrders.length)} hint={`${formatNumber(orders.length)} in total`} icon={ShoppingCart} tone="emerald" loading={loading} />
          <KpiCard label="Active Suppliers" value={vendors ? formatNumber(vendors.filter((v) => v.active !== false).length) : "—"} hint={vendors ? `${formatNumber(vendors.length)} vendors` : undefined} icon={Truck} tone="orange" loading={loading} />
          <KpiCard label="Receipts in Draft" value={formatNumber(draftReceipts.length)} hint={`${formatNumber(receipts.length)} receipts`} icon={Receipt} tone="purple" loading={loading} />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Purchase Trend" subtitle="Purchase orders per month (last 6 months)" icon={TrendingUp} iconClass="text-emerald-500">
            {liveOrders.length === 0 ? (
              <EmptyState loading={loading}>No purchase orders yet.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="purchaseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value) => [value, "Orders"]} />
                  <Area type="monotone" dataKey="orders" stroke="#06b6d4" strokeWidth={2} fill="url(#purchaseGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Supplier Performance" subtitle="Purchase orders by supplier (top 5)" icon={Truck} iconClass="text-orange-500">
            {suppliers.length === 0 ? (
              <EmptyState loading={loading}>No purchase orders yet.</EmptyState>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={suppliers} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={100} />
                  <Tooltip contentStyle={CHART_TOOLTIP}
                    formatter={(value, _name, item) => [`${value} order(s), ${formatMoney(Number(item?.payload?.value) || 0, currency)}`, "Orders"]} />
                  <Bar dataKey="orders" radius={[0, 4, 4, 0]}>
                    {suppliers.map((s, index) => <Cell key={s.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel title="Top Products Ordered" subtitle="By order value" bodyClass="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className={TABLE_HEAD}>Product</th>
                  <th className={TABLE_HEAD}>SKU</th>
                  <th className={TABLE_HEAD}>Orders</th>
                  <th className={TABLE_HEAD}>Quantity</th>
                  <th className={TABLE_HEAD}>Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {topProducts.length === 0 && (
                  <tr><td colSpan={5} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : "No order lines yet."}</td></tr>
                )}
                {topProducts.map((p) => (
                  <tr key={p.name + p.sku} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{p.name}</td>
                    <td className={`${TABLE_CELL} font-mono`}>{p.sku}</td>
                    <td className={TABLE_CELL}>{p.orders.size}</td>
                    <td className={TABLE_CELL}>{formatNumber(p.qty)}</td>
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{formatMoney(p.value, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel title="Pending Approvals" subtitle="Requisitions and orders awaiting approval, receipts in draft" bodyClass="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className={TABLE_HEAD}>Type</th>
                  <th className={TABLE_HEAD}>Reference</th>
                  <th className={TABLE_HEAD}>Details</th>
                  <th className={TABLE_HEAD}>Amount</th>
                  <th className={TABLE_HEAD}>Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {approvals.length === 0 && (
                  <tr><td colSpan={5} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : "Nothing is waiting for approval."}</td></tr>
                )}
                {approvals.map((a) => (
                  <tr key={a.key} onClick={() => navigate(a.route)} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={TABLE_CELL}>{a.type}</td>
                    <td className={`${TABLE_CELL} font-mono font-medium text-gray-900 dark:text-white`}>{a.reference}</td>
                    <td className={TABLE_CELL}>{a.details}</td>
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{a.amount === null ? "—" : formatMoney(a.amount, currency)}</td>
                    <td className={TABLE_CELL}>{formatDate(a.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>

        <Panel title="Procurement Pipeline" subtitle="Where open work currently sits">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pipeline.map((stage) => (
              <button key={stage.title} type="button" onClick={() => navigate(stage.route)}
                className="rounded-lg bg-gray-50 p-4 text-left transition hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800">
                <h4 className={`mb-2 text-sm font-semibold ${stage.tone}`}>{stage.title}</h4>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "…" : formatNumber(stage.value)}</p>
                <p className="mt-1 text-xs text-gray-500">{stage.note}</p>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
};

export default ProcurementDashboard;
