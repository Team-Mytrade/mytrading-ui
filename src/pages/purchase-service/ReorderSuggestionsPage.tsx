import { Fragment, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, ChevronDown, ChevronRight, PackageSearch, RefreshCw, ShoppingCart } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { formatDate, formatMoney, formatNumber } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const BASE = "/v1/api/purchase/reorder";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const CELL_INPUT =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

type Status = "ORDER_NOW" | "ORDER_SOON" | "OK" | "NO_SALES";
interface WarehouseStock { warehouseId: number; warehouseName: string; onHand: number; available: number; reorderLevel: number | null }
interface Suggestion {
  productId: number; productCode: string; productName: string; uom: string | null; onHand: number; available: number; onOrder: number;
  inDraft: number; reorderLevel: number | null; periodDays: number; soldInPeriod: number; dailyDemand: number; leadDays: number;
  leadTimeFrom: "PRODUCT" | "VENDOR" | "DEFAULT"; leadSamples: number; safetyStock: number; reorderPoint: number; targetStock: number;
  suggestedQuantity: number; daysOfCover: number | null; stockOutDate: string | null; status: Status; vendorId: number | null;
  vendorName: string | null; currency: string | null; lastUnitPrice: number | null; lastOrderDate: string | null; lastPoNumber: string | null;
  warehouses: WarehouseStock[]; weekly: number[];
}
interface Report {
  asOf: string; salesFrom: string; settings: { days: number; coverDays: number; serviceLevel: number; defaultLeadDays: number };
  summary: { orderNow: number; orderSoon: number; ok: number; noSales: number }; suggestions: Suggestion[];
}
interface Vendor { id: number; name: string; currency?: string | null; active?: boolean }
interface Draft { pick: boolean; quantity: string; vendorId: string; unitPrice: string; currency: string }
interface Created { id: number; poNumber: string; vendorName: string | null; currency: string | null; lines: number; totalAmount: number }

const STATUS: Record<Status, { label: string; tone: string }> = {
  ORDER_NOW: { label: "Order now", tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
  ORDER_SOON: { label: "Order soon", tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  OK: { label: "Enough stock", tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  NO_SALES: { label: "No sales", tone: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300" },
};
const HISTORY = [28, 56, 91, 182, 364];
const COVER = [14, 30, 45, 60, 90];
const SERVICE = [90, 95, 98, 99];

/** A tiny bar chart of the weeks' sales, oldest first. */
function Sparkline({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <span className="inline-flex h-6 items-end gap-px" aria-hidden="true">
      {weeks.map((w, i) => (
        <span key={i} className="w-1 rounded-sm bg-cyan-500/70" style={{ height: `${Math.max(2, Math.round((Math.max(0, w) / max) * 24))}px` }} />
      ))}
    </span>
  );
}

/**
 * Reorder suggestions (backlog 7.2.3): what to buy now, from whom and at what price, worked out from what each product
 * really sold, how long its vendors really take and what is already on order. Every number is explained on its row;
 * chosen lines become draft purchase orders, one per vendor and currency, approved as usual.
 */
export default function ReorderSuggestionsPage() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const canCreate = hasPermission(access, "PURCHASE:CREATE");
  const [days, setDays] = useState(91);
  const [cover, setCover] = useState(30);
  const [service, setService] = useState(95);
  const [lead, setLead] = useState("14");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"TO_ORDER" | "ALL">("TO_ORDER");
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [why, setWhy] = useState<number | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created[] | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const leadDays = Number(lead) > 0 ? Math.round(Number(lead)) : undefined;
    axios.get<Report>(`${BASE}/suggestions`, { params: { days, coverDays: cover, serviceLevel: service, leadDays } })
      .then((r) => {
        setReport(r.data);
        const next: Record<number, Draft> = {};
        for (const s of r.data.suggestions ?? []) {
          next[s.productId] = {
            pick: s.status === "ORDER_NOW" && s.suggestedQuantity > 0 && s.vendorId != null && s.lastUnitPrice != null,
            quantity: s.suggestedQuantity > 0 ? String(s.suggestedQuantity) : "",
            vendorId: s.vendorId != null ? String(s.vendorId) : "",
            unitPrice: s.lastUnitPrice != null ? String(s.lastUnitPrice) : "",
            currency: s.currency ?? "",
          };
        }
        setDrafts(next);
      })
      .catch((err) => {
        setReport(null);
        ToasterService.error(t("Reorder suggestions could not be worked out"), apiError(err, t("Please try again.")));
      })
      .finally(() => setLoading(false));
  }, [days, cover, service, lead]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get("/v1/api/common/vendors").then((r) => {
      const rows: Vendor[] = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.content) ? r.data.content : [];
      setVendors(rows.filter((v) => v.active !== false));
    }).catch(() => setVendors([]));
  }, []);

  const rows = useMemo(() => (report?.suggestions ?? []).filter((s) => view === "ALL" || s.status === "ORDER_NOW" || s.status === "ORDER_SOON"),
    [report, view]);
  const picked = (report?.suggestions ?? []).filter((s) => drafts[s.productId]?.pick);
  const set = (productId: number, change: Partial<Draft>) => setDrafts((d) => ({ ...d, [productId]: { ...d[productId], ...change } }));

  const chooseVendor = (s: Suggestion, vendorId: string) => {
    const vendor = vendors.find((v) => String(v.id) === vendorId);
    // Another vendor than last time: its own currency, and the price to be entered
    const same = vendorId === String(s.vendorId ?? "");
    set(s.productId, {
      vendorId,
      currency: same ? s.currency ?? "" : vendor?.currency ?? "",
      unitPrice: same && s.lastUnitPrice != null ? String(s.lastUnitPrice) : drafts[s.productId]?.unitPrice ?? "",
    });
  };

  const createOrders = async () => {
    const lines = picked.map((s) => {
      const d = drafts[s.productId];
      return { productId: s.productId, vendorId: d.vendorId ? Number(d.vendorId) : null, quantity: Number(d.quantity),
        unitPrice: d.unitPrice === "" ? null : Number(d.unitPrice), currency: d.currency || null, name: s.productName };
    });
    const missing = lines.find((l) => !l.vendorId || !(l.quantity >= 1) || !(Number(l.unitPrice) > 0));
    if (missing) {
      ToasterService.error(t("Check the lines"), t("{name} needs a vendor, a quantity and a unit price.", { name: missing.name }));
      return;
    }
    const vendorsCount = new Set(lines.map((l) => `${l.vendorId}|${l.currency ?? ""}`)).size;
    if (!window.confirm(t("Raise {orders} draft purchase order(s) for {lines} product(s)? They wait for approval as usual.",
      { orders: vendorsCount, lines: lines.length }))) return;
    setBusy(true);
    try {
      const { data } = await axios.post<Created[]>(`${BASE}/orders`, {
        lines: lines.map(({ name: _name, ...line }) => line), expectedDeliveryDate: expected || null,
      });
      setCreated(data);
      ToasterService.success(t("Draft purchase orders raised"), data.map((o) => o.poNumber).join(", "));
      load();
    } catch (err) {
      ToasterService.error(t("The purchase orders could not be raised"), apiError(err, t("Please try again.")));
    } finally {
      setBusy(false);
    }
  };

  const explain = (s: Suggestion) => {
    const parts = [
      t("Sold {sold} in the last {days} days: {daily} a day.", { sold: formatNumber(s.soldInPeriod, 0), days: s.periodDays, daily: formatNumber(s.dailyDemand) }),
      s.leadTimeFrom === "PRODUCT"
        ? t("Lead time {days} days, the average of its last {n} order(s).", { days: s.leadDays, n: s.leadSamples })
        : s.leadTimeFrom === "VENDOR"
          ? t("Lead time {days} days, from {vendor}'s other orders ({n}).", { days: s.leadDays, vendor: s.vendorName ?? t("the vendor"), n: s.leadSamples })
          : t("Lead time {days} days (the default: no receipts to learn from yet).", { days: s.leadDays }),
      t("Safety stock {safety} for a {level}% chance of not running out.", { safety: s.safetyStock, level: report?.settings.serviceLevel ?? 95 }),
      s.reorderLevel != null && s.reorderLevel >= s.reorderPoint
        ? t("Reorder point {point}: your reorder level.", { point: s.reorderPoint })
        : t("Reorder point {point} = demand over the lead time + safety stock.", { point: s.reorderPoint }),
      t("Stock position {position} = {available} available + {onOrder} on order + {inDraft} in draft orders.", {
        position: s.available + s.onOrder + s.inDraft, available: s.available, onOrder: s.onOrder, inDraft: s.inDraft }),
      s.suggestedQuantity > 0
        ? t("Ordering {qty} brings it to {target} (reorder point + {cover} days of sales).", { qty: s.suggestedQuantity, target: s.targetStock, cover: report?.settings.coverDays ?? 30 })
        : "",
    ];
    return parts.filter(Boolean).join(" ");
  };

  const chip = (label: string, count: number, tone: string) => (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{t(label)} · {count}</span>
  );

  return (
    <>
      <PageMeta title={t("Reorder Suggestions")} description="What to buy now, from whom and at what price" />
      <PageBreadcrumb pageTitle="Reorder Suggestions" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          {t("What to buy now, worked out from what each product really sold, how long its vendors really take to deliver and what is already on order. Open a row to see how its numbers were reached; chosen lines become draft purchase orders.")}
        </p>

        <section className={`${CARD} p-4`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Sales history")}
              <select className={`${INPUT} mt-1`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {HISTORY.map((d) => <option key={d} value={d}>{t("Last {n} weeks", { n: d / 7 })}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Order enough for")}
              <select className={`${INPUT} mt-1`} value={cover} onChange={(e) => setCover(Number(e.target.value))}>
                {COVER.map((d) => <option key={d} value={d}>{t("{n} days of sales", { n: d })}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Chance of not running out")}
              <select className={`${INPUT} mt-1`} value={service} onChange={(e) => setService(Number(e.target.value))}>
                {SERVICE.map((s) => <option key={s} value={s}>{s}%</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Lead time when unknown (days)")}
              <input className={`${INPUT} mt-1`} type="number" min={1} max={365} value={lead} onChange={(e) => setLead(e.target.value)} />
            </label>
            <div className="flex items-end">
              <button type="button" className={SECONDARY_BUTTON} onClick={load} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> {t("Work out again")}
              </button>
            </div>
          </div>
          {report && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chip("Order now", report.summary.orderNow, STATUS.ORDER_NOW.tone)}
              {chip("Order soon", report.summary.orderSoon, STATUS.ORDER_SOON.tone)}
              {chip("Enough stock", report.summary.ok, STATUS.OK.tone)}
              {chip("No sales", report.summary.noSales, STATUS.NO_SALES.tone)}
              <span className="text-xs text-slate-400">{t("Sales from {from} to {to}", { from: formatDate(report.salesFrom), to: formatDate(report.asOf) })}</span>
              <div className="ms-auto inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs dark:border-gray-700">
                {(["TO_ORDER", "ALL"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setView(v)}
                    className={`px-3 py-1.5 ${view === v ? "bg-cyan-600 text-white" : "bg-white text-slate-600 dark:bg-[#222222] dark:text-gray-300"}`}>
                    {v === "TO_ORDER" ? t("To order") : t("All products")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[72rem] divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr>
                <th className={`${TH} w-8`}><span className="sr-only">{t("Order")}</span></th>
                <th className={TH}>{t("Product")}</th>
                <th className={`${TH} text-end`}>{t("Available")}</th>
                <th className={`${TH} text-end`}>{t("On order")}</th>
                <th className={TH}>{t("Weekly sales")}</th>
                <th className={`${TH} text-end`}>{t("Lead time")}</th>
                <th className={`${TH} text-end`}>{t("Reorder point")}</th>
                <th className={TH}>{t("Runs out")}</th>
                <th className={`${TH} w-24`}>{t("Quantity")}</th>
                <th className={`${TH} w-48`}>{t("Vendor")}</th>
                <th className={`${TH} w-28`}>{t("Unit price")}</th>
                <th className={TH}>{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {report === null ? (
                <tr><td colSpan={12} className="px-3 py-6 text-center text-sm text-slate-400">{loading ? t("Loading...") : t("Nothing to show.")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-6 text-center text-sm text-slate-500">
                  {view === "TO_ORDER" ? t("Nothing needs ordering now.") : t("No stock products with sales or stock yet.")}
                </td></tr>
              ) : rows.map((s) => {
                const d = drafts[s.productId] ?? { pick: false, quantity: "", vendorId: "", unitPrice: "", currency: "" };
                const open = why === s.productId;
                const orderable = s.status !== "NO_SALES";
                return (
                  <Fragment key={s.productId}>
                    <tr className={d.pick ? "bg-cyan-50/50 dark:bg-cyan-950/20" : ""}>
                      <td className={TD}>
                        {orderable && canCreate && (
                          <input type="checkbox" aria-label={t("Order {name}", { name: s.productName })} checked={d.pick}
                            onChange={(e) => set(s.productId, { pick: e.target.checked, quantity: d.quantity || String(Math.max(1, s.suggestedQuantity)) })} />
                        )}
                      </td>
                      <td className={TD}>
                        <button type="button" className="flex items-start gap-1 text-start" onClick={() => setWhy(open ? null : s.productId)}>
                          {open ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 flex-none" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-none rtl:rotate-180" />}
                          <span>
                            <span className="font-medium">{s.productName}</span>
                            <span className="block font-mono text-xs text-slate-400" dir="ltr">{s.productCode}{s.uom ? ` · ${s.uom}` : ""}</span>
                          </span>
                        </button>
                      </td>
                      <td className={`${TD} text-end`} title={s.warehouses.map((w) => `${w.warehouseName}: ${w.available}`).join("\n")}>
                        {formatNumber(s.available, 0)}
                        {s.reorderLevel != null && <span className="block text-xs text-slate-400">{t("level {n}", { n: s.reorderLevel })}</span>}
                      </td>
                      <td className={`${TD} text-end`}>
                        {formatNumber(s.onOrder, 0)}
                        {s.inDraft > 0 && <span className="block text-xs text-slate-400">{t("+{n} in draft", { n: s.inDraft })}</span>}
                      </td>
                      <td className={TD}>
                        <Sparkline weeks={s.weekly} />
                        <span className="block text-xs text-slate-400">{t("{n} a day", { n: formatNumber(s.dailyDemand) })}</span>
                      </td>
                      <td className={`${TD} text-end`}>
                        {t("{n} days", { n: s.leadDays })}
                        <span className="block text-xs text-slate-400">{s.leadTimeFrom === "PRODUCT" ? t("from its orders") : s.leadTimeFrom === "VENDOR" ? t("from the vendor") : t("default")}</span>
                      </td>
                      <td className={`${TD} text-end`}>
                        {formatNumber(s.reorderPoint, 0)}
                        <span className="block text-xs text-slate-400">{t("safety {n}", { n: s.safetyStock })}</span>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {s.stockOutDate ? formatDate(s.stockOutDate) : "—"}
                        {s.daysOfCover != null && (
                          <span className="block text-xs text-slate-400">
                            {s.daysOfCover === 0 ? t("today") : s.daysOfCover === 1 ? t("tomorrow") : t("in {n} days", { n: s.daysOfCover })}
                          </span>
                        )}
                      </td>
                      <td className={TD}>
                        {orderable ? (
                          <input className={CELL_INPUT} type="number" min={1} value={d.quantity} disabled={!canCreate}
                            aria-label={t("Quantity for {name}", { name: s.productName })}
                            onChange={(e) => set(s.productId, { quantity: e.target.value })} />
                        ) : "—"}
                      </td>
                      <td className={TD}>
                        {orderable ? (
                          <select className={CELL_INPUT} value={d.vendorId} disabled={!canCreate} aria-label={t("Vendor for {name}", { name: s.productName })}
                            onChange={(e) => chooseVendor(s, e.target.value)}>
                            <option value="">{t("Choose a vendor")}</option>
                            {s.vendorId != null && !vendors.some((v) => v.id === s.vendorId) && <option value={String(s.vendorId)}>{s.vendorName}</option>}
                            {vendors.map((v) => <option key={v.id} value={String(v.id)}>{v.name}</option>)}
                          </select>
                        ) : "—"}
                        {s.lastPoNumber && <span className="mt-0.5 block text-xs text-slate-400">{t("last: {po}", { po: s.lastPoNumber })}</span>}
                      </td>
                      <td className={TD}>
                        {orderable ? (
                          <>
                            <input className={CELL_INPUT} type="number" min={0} step="0.001" value={d.unitPrice} disabled={!canCreate}
                              aria-label={t("Unit price for {name}", { name: s.productName })}
                              onChange={(e) => set(s.productId, { unitPrice: e.target.value })} />
                            <span className="mt-0.5 block text-xs text-slate-400">{d.currency || t("vendor's currency")}</span>
                          </>
                        ) : "—"}
                      </td>
                      <td className={TD}>
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[s.status].tone}`}>{t(STATUS[s.status].label)}</span>
                        {s.suggestedQuantity > 0 && <span className="mt-1 block text-xs text-slate-500">{t("suggested {n}", { n: s.suggestedQuantity })}</span>}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-slate-50/70 dark:bg-gray-900/40">
                        <td />
                        <td colSpan={11} className="px-3 pb-3 pt-1 text-xs leading-relaxed text-slate-600 dark:text-gray-300">
                          <div className="max-w-2xl">
                            {s.status === "NO_SALES" ? t("Nothing sold in the period, so nothing is suggested.") : explain(s)}
                            {s.warehouses.length > 0 && (
                              <span className="mt-1 block text-slate-400">
                                {s.warehouses.map((w) => `${w.warehouseName}: ${w.available}${w.reorderLevel != null ? ` (${t("level {n}", { n: w.reorderLevel })})` : ""}`).join(" · ")}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {canCreate && report && (
          <section className={`${CARD} flex flex-wrap items-end justify-between gap-3 p-4`}>
            <div>
              <h2 className={CARD_TITLE}>{t("{n} product(s) chosen", { n: picked.length })}</h2>
              <p className="text-xs text-slate-500">{t("One draft purchase order per vendor and currency, with each product's tax as the order screen adds it.")}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Expected delivery (optional)")}
                <input className={`${INPUT} mt-1`} type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
              </label>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy || picked.length === 0} onClick={createOrders}>
                <ShoppingCart className="h-4 w-4" /> {t("Raise draft purchase orders")}
              </button>
            </div>
          </section>
        )}

        {created && created.length > 0 && (
          <section className={`${CARD} space-y-2 p-4`}>
            <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{t("Raised as drafts, waiting for approval:")}</p>
            <ul className="space-y-1 text-sm">
              {created.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2">
                  <PackageSearch className="h-4 w-4 text-slate-400" />
                  <button type="button" className="font-mono text-xs underline decoration-dotted" dir="ltr"
                    onClick={() => navigate(`/purchase-service/orders?purchaseOrderId=${o.id}&poNumber=${encodeURIComponent(o.poNumber)}`)}>{o.poNumber}</button>
                  <span>{o.vendorName}</span>
                  <span className="text-slate-500">{t("{n} line(s)", { n: o.lines })} · {formatMoney(o.totalAmount, { currency: o.currency ?? undefined })}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
