import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeftRight, BookmarkCheck, Boxes, Gauge, IndianRupee, Layers, PackageX, ShieldCheck,
  SlidersHorizontal, Warehouse,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_COLORS, CHART_TOOLTIP, EmptyState, KpiCard, LoadNotice, ModuleTiles, Panel, TABLE_CELL, TABLE_HEAD,
  countOf, formatDate, formatMoney, formatNumber, getList, monthKeyOf, monthsBack, parseDate, titleCase,
  useDashboardSources,
} from "./dashboardKit";

import { t } from "../../i18n/i18n";
// Live stock overview from the inventory and common services.

interface WarehouseRef { id: number; code?: string; name?: string; active?: boolean }
interface StockLevel { id: number; productId: number; quantity?: number; reserved?: number; available?: number; reorderLevel?: number | null; warehouse?: WarehouseRef | null }
interface Product { id: number; productName?: string; productCode?: string; standardCost?: number | null }
interface Movement { id: number; movementDate?: string; movementType?: string; quantity?: number; reference?: string; productId?: number; product?: { id?: number; productName?: string; productCode?: string } | null; warehouse?: WarehouseRef | string | null }
interface Batch { id: number; batchNumber?: string; expiryDate?: string; productId?: number }

const INVENTORY = "/v1/api/inventory";
const SOURCES = {
  stock: () => getList<StockLevel>(`${INVENTORY}/stock-levels`),
  products: () => getList<Product>("/v1/api/common/products"),
  warehouses: () => getList<WarehouseRef>(`${INVENTORY}/warehouses`),
  movements: () => getList<Movement>(`${INVENTORY}/stock-movements`),
  batches: () => getList<Batch>(`${INVENTORY}/batches`),
  adjustments: () => countOf(`${INVENTORY}/stock-adjustments`),
  reservations: () => countOf(`${INVENTORY}/inventory-reservations`),
  inspections: () => countOf(`${INVENTORY}/quality-inspections`),
};
const LABELS: Record<keyof typeof SOURCES, string> = {
  stock: "stock levels", products: "products", warehouses: "warehouses", movements: "stock movements",
  batches: "batches", adjustments: "stock adjustments", reservations: "reservations", inspections: "quality inspections",
};

// Same grouping as the Inventory Report
const IN_TYPES = ["GRN", "PURCHASE_RECEIPT", "RETURN", "CUSTOMER_RETURN"];
const OUT_TYPES = ["ISSUE", "SALES_ISSUE", "SUPPLIER_RETURN", "DAMAGE"];

const MOVEMENT_LABELS: Record<string, string> = { GRN: "Goods receipt (GRN)" };
const movementLabel = (type?: string) => (type && MOVEMENT_LABELS[type]) || titleCase(type);

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const availableOf = (s: StockLevel) => num(s.available ?? num(s.quantity) - num(s.reserved));
const warehouseName = (w?: WarehouseRef | string | null) => (typeof w === "string" ? w : w?.name || w?.code || "—");

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const { loading, data, failed } = useDashboardSources(SOURCES, LABELS);

  const stock = (data.stock as StockLevel[] | undefined) ?? [];
  const products = (data.products as Product[] | undefined) ?? [];
  const warehouses = data.warehouses as WarehouseRef[] | undefined;
  const movements = (data.movements as Movement[] | undefined) ?? [];
  const batches = (data.batches as Batch[] | undefined) ?? [];
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const productLabel = (id?: number) => {
    const p = id == null ? undefined : productById.get(id);
    return p?.productName || p?.productCode || (id == null ? "—" : `Product #${id}`);
  };

  const totals = useMemo(() => {
    let value = 0;
    let unpriced = 0;
    stock.forEach((s) => {
      const cost = productById.get(s.productId)?.standardCost;
      if (cost == null) { if (num(s.quantity) > 0) unpriced += 1; } else value += num(s.quantity) * num(cost);
    });
    return {
      value, unpriced,
      onHand: stock.reduce((t, s) => t + num(s.quantity), 0),
      reserved: stock.reduce((t, s) => t + num(s.reserved), 0),
      products: new Set(stock.filter((s) => num(s.quantity) > 0).map((s) => s.productId)).size,
    };
  }, [stock, productById]);

  const lowStock = useMemo(() => stock
    .filter((s) => s.reorderLevel != null && availableOf(s) > 0 && availableOf(s) <= num(s.reorderLevel))
    .map((s) => ({ ...s, availableQty: availableOf(s), shortfall: Math.max(0, num(s.reorderLevel) - availableOf(s)) }))
    .sort((a, b) => b.shortfall - a.shortfall), [stock]);
  const outOfStock = stock.filter((s) => availableOf(s) <= 0);

  const movementTrend = useMemo(() => monthsBack(6).map(({ key, label }) => {
    const inMonth = movements.filter((m) => monthKeyOf(m.movementDate) === key);
    return {
      month: label,
      in: inMonth.filter((m) => IN_TYPES.includes(m.movementType ?? "")).reduce((t, m) => t + Math.abs(num(m.quantity)), 0),
      out: inMonth.filter((m) => OUT_TYPES.includes(m.movementType ?? "")).reduce((t, m) => t + Math.abs(num(m.quantity)), 0),
    };
  }), [movements]);

  const byWarehouse = useMemo(() => {
    const map = new Map<string, { name: string; onHand: number; available: number }>();
    stock.forEach((s) => {
      const name = warehouseName(s.warehouse);
      const entry = map.get(name) ?? { name, onHand: 0, available: 0 };
      entry.onHand += num(s.quantity);
      entry.available += availableOf(s);
      map.set(name, entry);
    });
    return [...map.values()].sort((a, b) => b.onHand - a.onHand).slice(0, 6);
  }, [stock]);

  const today = new Date();
  const in30 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const expiring = batches
    .filter((b) => { const d = parseDate(b.expiryDate); return d && d <= in30; })
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));

  const recentMovements = useMemo(() => [...movements]
    .sort((a, b) => String(b.movementDate ?? "").localeCompare(String(a.movementDate ?? "")) || b.id - a.id)
    .slice(0, 6), [movements]);

  const countOrNull = (key: "adjustments" | "reservations" | "inspections") => (typeof data[key] === "number" ? (data[key] as number) : null);
  const tiles = [
    { name: "Warehouses", count: warehouses ? warehouses.length : null, icon: Warehouse, route: "/warehouse", tone: "blue" as const },
    { name: "Inventory Stock", count: data.stock ? stock.length : null, icon: Boxes, route: "/inventory", tone: "emerald" as const },
    { name: "Stock Level", count: data.stock ? lowStock.length + outOfStock.length : null, icon: Gauge, route: "/stock-level", tone: "red" as const },
    { name: "Stock Movement", count: data.movements ? movements.length : null, icon: ArrowLeftRight, route: "/stock-movement", tone: "cyan" as const },
    { name: "Stock Adjustment", count: countOrNull("adjustments"), icon: SlidersHorizontal, route: "/stock-adjustment", tone: "orange" as const },
    { name: "Reservations", count: countOrNull("reservations"), icon: BookmarkCheck, route: "/inventory-reservation", tone: "purple" as const },
    { name: "Quality Inspection", count: countOrNull("inspections"), icon: ShieldCheck, route: "/quality-inspection", tone: "teal" as const },
    { name: "Batches", count: data.batches ? batches.length : null, icon: Layers, route: "/batch", tone: "indigo" as const },
  ];

  return (
    <div className="mx-auto max-w-7xl px-1 pb-6 pt-1">
      <LoadNotice failed={failed} />
      <ModuleTiles tiles={tiles} loading={loading} />

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("Stock Value")} value={data.stock && data.products ? formatMoney(totals.value, null, true) : "—"}
          hint={totals.unpriced ? t("{count} record(s) have no standard cost", { count: totals.unpriced }) : t("On hand × standard cost")} icon={IndianRupee} tone="emerald" loading={loading} />
        <KpiCard label={t("Units on Hand")} value={data.stock ? formatNumber(totals.onHand) : "—"}
          hint={`${formatNumber(totals.reserved)} reserved · ${formatNumber(totals.products)} products`} icon={Boxes} tone="blue" loading={loading} />
        <KpiCard label={t("Low Stock")} value={data.stock ? formatNumber(lowStock.length) : "—"} hint={t("At or below reorder level")} icon={AlertTriangle} tone="amber" loading={loading} />
        <KpiCard label={t("Out of Stock")} value={data.stock ? formatNumber(outOfStock.length) : "—"}
          hint={data.batches ? `${expiring.length} batch(es) expire within 30 days` : undefined} icon={PackageX} tone="red" loading={loading} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={t("Stock In and Out")} subtitle={t("Quantity received and issued per month (last 6 months)")} icon={ArrowLeftRight} iconClass="text-cyan-500">
          {movements.length === 0 ? (
            <EmptyState loading={loading}>{t("No stock movements yet.")}</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={movementTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="in" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Issued" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title={t("Stock by Warehouse")} subtitle={t("Units on hand (top 6 warehouses)")} icon={Warehouse} iconClass="text-blue-500">
          {byWarehouse.length === 0 ? (
            <EmptyState loading={loading}>{t("No stock recorded yet.")}</EmptyState>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byWarehouse} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={110} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value, _n, item) => [`${formatNumber(Number(value))} on hand, ${formatNumber(Number(item?.payload?.available) || 0)} available`, "Units"]} />
                <Bar dataKey="onHand" radius={[0, 4, 4, 0]}>
                  {byWarehouse.map((w, i) => <Cell key={w.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title={t("Reorder Needed")} subtitle={t("Low stock, largest shortfall first")} bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>{t("Product")}</th>
                <th className={TABLE_HEAD}>{t("Warehouse")}</th>
                <th className={TABLE_HEAD}>{t("Available")}</th>
                <th className={TABLE_HEAD}>{t("Reorder at")}</th>
                <th className={TABLE_HEAD}>{t("Shortfall")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {lowStock.length === 0 && (
                <tr><td colSpan={5} className={`${TABLE_CELL} text-center`}>{t(loading ? "Loading…" : "Nothing is below its reorder level.")}</td></tr>
              )}
              {lowStock.slice(0, 6).map((s) => (
                <tr key={s.id} onClick={() => navigate("/stock-level")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{productLabel(s.productId)}</td>
                  <td className={TABLE_CELL}>{warehouseName(s.warehouse)}</td>
                  <td className={TABLE_CELL}>{formatNumber(s.availableQty)}</td>
                  <td className={TABLE_CELL}>{formatNumber(num(s.reorderLevel))}</td>
                  <td className={`${TABLE_CELL} font-semibold text-amber-600`}>{formatNumber(s.shortfall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={t("Recent Stock Movements")} subtitle={t("Latest receipts, issues and transfers")} bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>{t("Date")}</th>
                <th className={TABLE_HEAD}>{t("Type")}</th>
                <th className={TABLE_HEAD}>{t("Product")}</th>
                <th className={TABLE_HEAD}>{t("Quantity")}</th>
                <th className={TABLE_HEAD}>{t("Reference")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {recentMovements.length === 0 && (
                <tr><td colSpan={5} className={`${TABLE_CELL} text-center`}>{t(loading ? "Loading…" : "No stock movements yet.")}</td></tr>
              )}
              {recentMovements.map((m) => (
                <tr key={m.id} onClick={() => navigate("/stock-movement")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className={TABLE_CELL}>{formatDate(m.movementDate)}</td>
                  <td className={TABLE_CELL}>{movementLabel(m.movementType)}</td>
                  <td className={`${TABLE_CELL} font-medium text-gray-900 dark:text-white`}>{m.product?.productName || productLabel(m.productId ?? m.product?.id)}</td>
                  <td className={TABLE_CELL}>{formatNumber(num(m.quantity))}</td>
                  <td className={`${TABLE_CELL} font-mono`}>{m.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {expiring.length > 0 && (
        <Panel title={t("Batches Expiring")} subtitle={t("Expired or expiring within 30 days")} icon={AlertTriangle} iconClass="text-red-500" bodyClass="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className={TABLE_HEAD}>{t("Batch")}</th>
                <th className={TABLE_HEAD}>{t("Product")}</th>
                <th className={TABLE_HEAD}>{t("Expiry")}</th>
                <th className={TABLE_HEAD}>{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {expiring.slice(0, 6).map((b) => {
                const expired = (parseDate(b.expiryDate) ?? today) < today;
                return (
                  <tr key={b.id} onClick={() => navigate("/batch")} className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${TABLE_CELL} font-mono font-medium text-gray-900 dark:text-white`}>{b.batchNumber || `Batch #${b.id}`}</td>
                    <td className={TABLE_CELL}>{productLabel(b.productId)}</td>
                    <td className={TABLE_CELL}>{formatDate(b.expiryDate)}</td>
                    <td className={`${TABLE_CELL} font-semibold ${expired ? "text-red-600" : "text-amber-600"}`}>{t(expired ? "Expired" : "Expiring soon")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
