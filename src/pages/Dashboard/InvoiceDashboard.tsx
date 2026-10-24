import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle, Banknote, BarChart3, FileText, HandCoins, Percent, Receipt, ReceiptText, TrendingUp, Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_COLORS, CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  countOf, formatDate, formatMoney, formatNumber, getList, monthsBack, mostCommon, parseDate, sum, titleCase,
  useDashboardSources,
} from "./dashboardKit";

// Live billing, collections and payables from the invoice service.

interface FinanceReport {
  totalInvoiced?: number;
  totalPaid?: number;
  outstandingAmount?: number;
  invoiceStatusSummary?: Record<string, number>;
  monthlyTotals?: Record<string, number>;
  overdueInvoices?: { invoiceNumber?: string; customerName?: string; dueDate?: string; totalAmount?: number; balanceAmount?: number }[];
}
interface Invoice { id: number; status?: string; currencyCode?: string; invoiceDate?: string }
interface Aging { totalOutstanding?: number; buckets?: { bucket: string; invoiceCount: number; outstandingAmount: number }[] }
interface Payable {
  id: number;
  purchaseInvoice?: { invoiceNumber?: string } | null;
  vendor?: { name?: string } | null;
  balance?: number;
  dueDate?: string;
  accountsPayableStatus?: string;
}
interface Receipt { id: number; paymentDate?: string; totalAmountReceived?: number; status?: string }

const INVOICE = "/v1/api/invoice";
const SOURCES = {
  finance: () => axios.get<FinanceReport>(`${INVOICE}/reports/finance`).then((r) => r.data ?? {}),
  invoices: () => getList<Invoice>(`${INVOICE}/invoices`),
  aging: () => axios.get<Aging>(`${INVOICE}/accounts-receivable/aging`).then((r) => r.data ?? {}),
  payables: () => getList<Payable>(`${INVOICE}/accounts-payable`),
  receipts: () => getList<Receipt>(`${INVOICE}/receipts`),
  purchaseInvoices: () => countOf(`${INVOICE}/purchase-invoices`),
  vendorPayments: () => countOf(`${INVOICE}/vendor-payments`),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  finance: "finance report", invoices: "invoices", aging: "receivables aging", payables: "accounts payable",
  receipts: "payment receipts", purchaseInvoices: "purchase invoices", vendorPayments: "vendor payments",
};

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8", ISSUED: "#06b6d4", PARTIALLY_PAID: "#f59e0b", PAID: "#10b981", OVERDUE: "#ef4444", CANCELLED: "#cbd5e1", VOID: "#cbd5e1",
};

export default function InvoiceDashboard() {
  const navigate = useNavigate();
  const { loading, data, failed } = useDashboardSources(SOURCES, LABELS);

  const finance = data.finance as FinanceReport | undefined;
  const invoices = (data.invoices as Invoice[] | undefined) ?? [];
  const aging = data.aging as Aging | undefined;
  const payables = (data.payables as Payable[] | undefined) ?? [];
  const receipts = (data.receipts as Receipt[] | undefined) ?? [];
  const currency = mostCommon(invoices.map((i) => i.currencyCode), "INR");

  const openPayables = payables.filter((p) => num(p.balance) > 0);
  const payableTotal = sum(openPayables, (p) => p.balance);
  const today = new Date();
  const overduePayables = openPayables.filter((p) => { const d = parseDate(p.dueDate); return d && d < today; });

  const billing = useMemo(() => monthsBack(6).map(({ key, label }) => ({
    month: label,
    billed: num(finance?.monthlyTotals?.[key]),
    collected: sum(receipts.filter((r) => r.status !== "REVERSED" && (r.paymentDate ?? "").startsWith(key)), (r) => r.totalAmountReceived),
  })), [finance, receipts]);

  const statusMix = useMemo(() => Object.entries(finance?.invoiceStatusSummary ?? {})
    .filter(([, count]) => num(count) > 0)
    .map(([status, count]) => ({ status: titleCase(status), code: status, count: num(count) })), [finance]);

  // Buckets come as CURRENT, 1-30, 31-60, 61-90, 90+
  const agingRows = (aging?.buckets ?? []).map((b) => ({ ...b, label: b.bucket === "CURRENT" ? "Not due" : `${b.bucket} days` }));

  const overdue = [...(finance?.overdueInvoices ?? [])]
    .sort((a, b) => num(b.balanceAmount) - num(a.balanceAmount)).slice(0, 6);
  const payablesDue = [...openPayables]
    .sort((a, b) => String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999"))).slice(0, 6);

  const countOrNull = (key: "purchaseInvoices" | "vendorPayments") => (typeof data[key] === "number" ? (data[key] as number) : null);
  const tiles = [
    { name: "Invoices", count: data.invoices ? invoices.length : null, icon: Receipt, route: "/invoices", tone: "cyan" as const },
    { name: "Payment Receipts", count: data.receipts ? receipts.length : null, icon: ReceiptText, route: "/paymentReceipts", tone: "emerald" as const },
    { name: "Accounts Receivable", count: finance ? (finance.overdueInvoices?.length ?? 0) : null, icon: HandCoins, route: "/accountsReceivable", tone: "red" as const },
    { name: "Purchase Invoices", count: countOrNull("purchaseInvoices"), icon: FileText, route: "/purchaseInvoices", tone: "blue" as const },
    { name: "Vendor Payments", count: countOrNull("vendorPayments"), icon: Banknote, route: "/vendorPayments", tone: "orange" as const },
    { name: "Accounts Payable", count: data.payables ? openPayables.length : null, icon: Wallet, route: "/accountsPayable", tone: "purple" as const },
    { name: "Finance Report", icon: BarChart3, route: "/financeReport", tone: "indigo" as const },
    { name: "Tax Report", icon: Percent, route: "/taxReport", tone: "teal" as const },
  ];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <LoadNotice failed={failed} />
      <ModuleTiles tiles={tiles} loading={loading} />

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Billed" value={finance ? formatMoney(num(finance.totalInvoiced), currency, true) : "—"}
          hint={data.invoices ? `${formatNumber(invoices.length)} invoices` : undefined} icon={Receipt} tone="cyan" loading={loading} />
        <KpiCard label="Collected" value={finance ? formatMoney(num(finance.totalPaid), currency, true) : "—"}
          hint={finance && num(finance.totalInvoiced) > 0 ? `${Math.round((num(finance.totalPaid) / num(finance.totalInvoiced)) * 100)}% of billing` : undefined}
          icon={HandCoins} tone="emerald" loading={loading} />
        <KpiCard label="Receivable Outstanding" value={finance ? formatMoney(num(finance.outstandingAmount), currency, true) : "—"}
          hint={finance ? `${formatNumber(finance.overdueInvoices?.length ?? 0)} invoice(s) overdue` : undefined} icon={AlertTriangle} tone="red" loading={loading} />
        <KpiCard label="Payable Outstanding" value={data.payables ? formatMoney(payableTotal, currency, true) : "—"}
          hint={data.payables ? `${formatNumber(overduePayables.length)} past due date` : undefined} icon={Wallet} tone="purple" loading={loading} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Billed vs Collected" subtitle="Per month (last 6 months)" icon={TrendingUp} iconClass="text-cyan-500">
          {!finance && !data.receipts ? (
            <EmptyState loading={loading}>Billing figures are not available.</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={billing}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => formatMoney(Number(v), currency, true)} width={70} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value, name) => [formatMoney(Number(value), currency), name === "billed" ? "Billed" : "Collected"]} />
                <Bar dataKey="billed" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Receivables Aging" subtitle="Outstanding by days past due" icon={HandCoins} iconClass="text-red-500">
          {agingRows.every((b) => !b.outstandingAmount) ? (
            <EmptyState loading={loading}>{statusMix.length ? "Nothing is outstanding." : "No invoices yet."}</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agingRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" stroke="#9ca3af" fontSize={10} interval={0} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => formatMoney(Number(v), currency, true)} width={70} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value, _n, item) => [`${formatMoney(Number(value), currency)} (${item?.payload?.invoiceCount ?? 0} invoices)`, "Outstanding"]} />
                <Bar dataKey="outstandingAmount" radius={[4, 4, 0, 0]}>
                  {agingRows.map((b, i) => <Cell key={b.bucket} fill={i === 0 ? "#10b981" : CHART_COLORS[(i + 1) % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {statusMix.length > 0 && (
        <div className="mb-8">
          <Panel title="Invoices by Status" subtitle="Count of sales invoices in each state">
            <div className="flex flex-wrap gap-3">
              {statusMix.map((s) => (
                <button key={s.code} type="button" onClick={() => navigate("/invoices")}
                  className="flex min-w-[8rem] flex-1 items-center gap-3 rounded-lg bg-gray-50 p-3 text-left transition hover:bg-gray-100 dark:bg-gray-800/60 dark:hover:bg-gray-800">
                  <span className="h-8 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.code] ?? "#94a3b8" }} />
                  <span>
                    <span className="block text-lg font-bold text-gray-900 dark:text-white">{formatNumber(s.count)}</span>
                    <span className="text-xs text-gray-500">{s.status}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Overdue Invoices" subtitle="Largest balances first" bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>Invoice</th>
                <th className={TABLE_HEAD}>Customer</th>
                <th className={TABLE_HEAD}>Due</th>
                <th className={TABLE_HEAD}>Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {overdue.length === 0 && (
                <tr><td colSpan={4} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : "No overdue invoices."}</td></tr>
              )}
              {overdue.map((o, i) => (
                <tr key={`${o.invoiceNumber}-${i}`} onClick={() => navigate("/accountsReceivable")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className={`${TABLE_CELL} font-mono font-medium text-gray-900 dark:text-white`}>{o.invoiceNumber || "—"}</td>
                  <td className={TABLE_CELL}>{o.customerName || "—"}</td>
                  <td className={`${TABLE_CELL} text-red-600`}>{formatDate(o.dueDate)}</td>
                  <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{formatMoney(num(o.balanceAmount), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Payables Due" subtitle="Unpaid vendor bills, earliest due first" bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>Bill</th>
                <th className={TABLE_HEAD}>Vendor</th>
                <th className={TABLE_HEAD}>Due</th>
                <th className={TABLE_HEAD}>Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payablesDue.length === 0 && (
                <tr><td colSpan={4} className={`${TABLE_CELL} text-center`}>{loading ? "Loading…" : "No unpaid vendor bills."}</td></tr>
              )}
              {payablesDue.map((p) => {
                const late = (parseDate(p.dueDate) ?? today) < today;
                return (
                  <tr key={p.id} onClick={() => navigate("/accountsPayable")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-mono font-medium text-gray-900 dark:text-white`}>{p.purchaseInvoice?.invoiceNumber || `AP #${p.id}`}</td>
                    <td className={TABLE_CELL}>{p.vendor?.name || "—"}</td>
                    <td className={`${TABLE_CELL} ${late ? "text-red-600" : ""}`}>{formatDate(p.dueDate)}</td>
                    <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{formatMoney(num(p.balance), currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
