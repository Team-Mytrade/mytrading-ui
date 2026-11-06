import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, Boxes, Download, FileUp, Link2, PlugZap, Plus, ShoppingBag, Trash2, Upload, Wallet } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { formatDate, formatDateTime, formatMoney, todayIso } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

// Times from the server are UTC without a zone mark (like the audit log); shown in the company's zone
const utc = (value: string | null | undefined) => (value ? `${value}Z` : null);

const BASE = "/v1/api/sales/stores";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Store {
  id: number; platform: string; shopDomain: string; shopName: string | null; tokenHint: string | null; apiVersion: string;
  shopCurrency: string | null; taxesIncluded: boolean; warehouseId: number | null; locationId: string | null; locationName: string | null;
  autoConfirm: boolean; pushStock: boolean; importOrders: boolean; active: boolean; ordersSince: string | null;
  lastOrderSyncAt: string | null; lastStockSyncAt: string | null; lastError: string | null; linkedProducts: number;
  // Stores that push orders (noon): where they call, and the secret (only in the answer to connect / a new secret)
  webhookPath: string | null; webhookSecret: string | null;
}
interface PayoutResult { sent: number; alreadyPosted: number; linesToMatch: number; references: string[]; problems: string[] }
interface Link { id: number; productId: number; productCode: string | null; sku: string | null; title: string | null; lastPushedQuantity: number | null; lastPushedAt: string | null }
interface StoreOrder {
  id: number; externalNumber: string; status: "IMPORTED" | "NEEDS_ATTENTION" | "SKIPPED"; problem: string | null; customerName: string | null;
  storeTotal: number | null; currency: string | null; paymentStatus: string | null; orderedAt: string | null; salesOrderId: number | null;
  salesOrderNumber: string | null; importedAt: string | null; cancelledInStore: boolean;
}
interface Named { id: number; name?: string; code?: string; active?: boolean }
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const TONE: Record<string, string> = {
  IMPORTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  NEEDS_ATTENTION: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  SKIPPED: "bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300",
};
const STATUS_TEXT: Record<string, string> = { IMPORTED: "Came in", NEEDS_ATTENTION: "Needs attention", SKIPPED: "Skipped" };

type Platform = "SHOPIFY" | "SALLA" | "ZID" | "AMAZON" | "NOON";
const PLATFORM_NAME: Record<string, string> = { SHOPIFY: "Shopify", SALLA: "Salla", ZID: "Zid", AMAZON: "Amazon", NOON: "noon" };
const PLATFORMS: Platform[] = ["SHOPIFY", "SALLA", "ZID", "AMAZON", "NOON"];
// Amazon's Gulf marketplaces (the store's "location")
const AMAZON_MARKETS = [{ id: "A2VIGQ35RCS4UG", name: "Amazon.ae" }, { id: "A17E79C6D8DWNP", name: "Amazon.sa" }];
// The statement layout noon payouts are uploaded in
const STATEMENT_TEMPLATE = "Order number,Type,Amount,Description\nNF123456789,Order,105.00,Sale\nNF123456789,Fee,-15.75,Commission\n,Other,-5.00,Adjustment\n";
// How to get each platform's token; the last step (SKU = product code) is the same everywhere
const STEPS: Record<Platform, string[]> = {
  SHOPIFY: [
    "In Shopify admin: Settings → Apps and sales channels → Develop apps → Create an app.",
    "Admin API access scopes: read_products, read_inventory, write_inventory, read_locations, read_orders.",
    "Install the app and reveal the Admin API access token once (it starts with shpat_).",
  ],
  SALLA: [
    "In Salla Partners: create an app and install it on the store (a demo store to try it out).",
    "Scopes: products read & write, orders read, and branches read if stock is kept per branch.",
    "Copy the store's access token and refresh token. The access token lasts 14 days; with the refresh token MyTrade renews it (your administrator sets up the app's client id and secret once).",
  ],
  ZID: [
    "In the Zid Partner Dashboard: create an app and install it on the store. Your administrator sets up the app's Authorization token once.",
    "Scopes: products read & write, inventories read & write, orders read.",
    "Copy the store's manager token (X-Manager-Token) from the app's install.",
  ],
  AMAZON: [
    "In Seller Central: authorise the MyTrade app (Apps and Services → Manage Your Apps); your administrator sets up the app's Login with Amazon client once.",
    "Roles: Inventory and Order Tracking, Product Listing, Finance and Accounting.",
    "Copy the refresh token the authorisation gives, and your seller ID (Settings → Account Info → Merchant Token). Only orders you ship yourself come in; Fulfilled by Amazon stock is Amazon's.",
  ],
  NOON: [
    "In noon's Access app (access.noon.partners): create an API user with a role that can read orders and write stock, and download its key file (JSON).",
    "Set up an integration warehouse in Seller Lab for the orders you ship yourself (Fulfilled by Partner).",
    "After connecting, add MyTrade's webhook address and secret as a destination in noon's developer portal and subscribe it to FBPI order sync: noon tells MyTrade about each order.",
  ],
};
const TOKEN_LABEL: Record<Platform, string> = {
  SHOPIFY: "Admin API access token", SALLA: "Salla access token", ZID: "Zid manager token", AMAZON: "", NOON: "noon API key file (JSON)",
};

/**
 * Online stores (backlog 7.2.4 steps 3–4: Shopify, Salla, Zid): connect a store with its platform's API token, link
 * its products by SKU, and let MyTrade keep its stock and bring its orders in as sales orders every few minutes.
 */
export default function OnlineStores() {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const canAdmin = hasPermission(access, "SALES:ADMIN");
  const canSync = canAdmin || hasPermission(access, "SALES:UPDATE");
  const [stores, setStores] = useState<Store[] | null>(null);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [form, setForm] = useState<{
    platform: Platform; shopDomain: string; accessToken: string; refreshToken: string; warehouseId: string; ordersSince: string; autoConfirm: boolean;
    accountId: string; locationId: string;
  } | null>(null);
  // A webhook secret just made: shown once, until dismissed
  const [secret, setSecret] = useState<{ storeId: number; url: string; secret: string } | null>(null);
  const [payoutForm, setPayoutForm] = useState<{
    storeId: number; reference: string; periodFrom: string; periodTo: string; payoutDate: string; amount: string; currency: string; file: File | null;
  } | null>(null);
  const [open, setOpen] = useState<{ id: number; tab: "orders" | "products" } | null>(null);
  const [links, setLinks] = useState<Link[] | null>(null);
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    axios.get<Store[]>(BASE).then((r) => setStores(r.data)).catch((err) => {
      setStores([]);
      ToasterService.error(t("Online stores could not be loaded"), apiError(err, t("Please try again.")));
    });
  }, []);
  useEffect(() => {
    load();
    axios.get("/v1/api/inventory/warehouses").then((r) => setWarehouses(asArray<Named>(r.data))).catch(() => undefined);
  }, [load]);

  const loadDetail = useCallback((id: number, tab: "orders" | "products") => {
    if (tab === "orders") {
      setOrders(null);
      axios.get<StoreOrder[]>(`${BASE}/${id}/orders`).then((r) => setOrders(r.data)).catch(() => setOrders([]));
    } else {
      setLinks(null);
      axios.get<Link[]>(`${BASE}/${id}/products`).then((r) => setLinks(r.data)).catch(() => setLinks([]));
    }
  }, []);
  useEffect(() => {
    if (open) loadDetail(open.id, open.tab);
  }, [open, loadDetail]);

  const run = async (key: string, work: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await work();
      if (message) ToasterService.success(message);
      load();
      if (open) loadDetail(open.id, open.tab);
    } catch (err) {
      ToasterService.error(t("The store could not be updated"), apiError(err, t("Please try again.")));
    } finally {
      setBusy(null);
    }
  };

  const showSecret = (s: Store) => {
    if (s.webhookSecret && s.webhookPath) setSecret({ storeId: s.id, url: `${window.location.origin}${s.webhookPath}`, secret: s.webhookSecret });
  };

  const connect = () => form && run("connect", async () => {
    const amazon = form.platform === "AMAZON";
    const { data } = await axios.post<Store>(BASE, { platform: form.platform, shopDomain: form.platform === "SHOPIFY" ? form.shopDomain.trim() : null,
      accessToken: amazon ? null : form.accessToken.trim(),
      refreshToken: (form.platform === "SALLA" || amazon) && form.refreshToken.trim() ? form.refreshToken.trim() : null,
      accountId: amazon ? form.accountId.trim() : null,
      locationId: (amazon || form.platform === "NOON") && form.locationId.trim() ? form.locationId.trim() : null,
      warehouseId: form.warehouseId ? Number(form.warehouseId) : null, ordersSince: form.ordersSince || null, autoConfirm: form.autoConfirm });
    setForm(null);
    showSecret(data);
    return t("Store connected. Link its products next.");
  });

  const newSecret = (s: Store) => {
    if (!window.confirm(t("Make a new webhook secret? The old one stops working, so update it in noon's developer portal straight away."))) return;
    run(`secret-${s.id}`, async () => {
      const { data } = await axios.post<Store>(`${BASE}/${s.id}/webhook-secret`);
      showSecret(data);
    });
  };

  const payoutMessage = (data: PayoutResult) => data.problems.length
    ? `${t("Some payouts could not be sent")}: ${data.problems.join("; ")}`
    : t("{sent} payout(s) sent to finance ({posted} already posted); {lines} line(s) wait for an invoice. Post them on Marketplace Payouts.",
      { sent: data.sent, posted: data.alreadyPosted, lines: data.linesToMatch });

  const fetchPayouts = (s: Store) => run(`payouts-${s.id}`, async () => {
    const { data } = await axios.post<PayoutResult>(`${BASE}/${s.id}/sync/payouts`);
    return payoutMessage(data);
  });

  const uploadPayout = () => payoutForm && run(`upload-${payoutForm.storeId}`, async () => {
    if (!payoutForm.file) throw new Error(t("Choose the statement file"));
    const body = new FormData();
    body.append("file", payoutForm.file);
    body.append("reference", payoutForm.reference.trim());
    body.append("amount", payoutForm.amount.trim());
    if (payoutForm.currency.trim()) body.append("currency", payoutForm.currency.trim());
    if (payoutForm.periodFrom) body.append("periodFrom", payoutForm.periodFrom);
    if (payoutForm.periodTo) body.append("periodTo", payoutForm.periodTo);
    if (payoutForm.payoutDate) body.append("payoutDate", payoutForm.payoutDate);
    const { data } = await axios.post<PayoutResult>(`${BASE}/${payoutForm.storeId}/payouts/upload`, body);
    setPayoutForm(null);
    return payoutMessage(data);
  });

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([STATEMENT_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "payout-statement-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const setting = (s: Store, patch: Partial<Pick<Store, "autoConfirm" | "pushStock" | "importOrders" | "active">> & { warehouseId?: number }) =>
    run(`set-${s.id}`, async () => {
      await axios.put(`${BASE}/${s.id}`, patch);
    });

  const sync = (s: Store, what: "products" | "stock" | "orders") => run(`${what}-${s.id}`, async () => {
    const { data } = await axios.post(`${BASE}/${s.id}/sync/${what}`);
    if (what === "products") {
      setOpen({ id: s.id, tab: "products" });
      return t("{linked} of {variants} store products linked; {unmatched} SKUs match no product code.", { linked: data.linked, variants: data.variants, unmatched: data.unmatchedSkus.length });
    }
    if (what === "stock") return data.problems.length ? `${t("The store refused some quantities")}: ${data.problems.join("; ")}` : t("{n} quantities sent to the store.", { n: data.updated });
    setOpen({ id: s.id, tab: "orders" });
    return t("{imported} order(s) came in; {attention} need attention; {skipped} skipped.", { imported: data.imported, attention: data.needsAttention, skipped: data.skipped });
  });

  const disconnect = (s: Store) => {
    if (!window.confirm(t("Disconnect {shop}? Its links and order log go; sales orders already made stay.", { shop: s.shopDomain }))) return;
    run(`del-${s.id}`, async () => {
      await axios.delete(`${BASE}/${s.id}`);
      if (open?.id === s.id) setOpen(null);
      return t("Store disconnected.");
    });
  };

  const warehouseName = (id: number | null) => warehouses.find((w) => w.id === id)?.name ?? (id ? `#${id}` : "—");

  return (
    <>
      <PageMeta title={t("Online Stores")} description="Shopify, Salla, Zid, Amazon and noon: stock, orders and payouts" />
      <PageBreadcrumb pageTitle="Online Stores" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-gray-300">{t("Online stores and marketplaces whose stock MyTrade keeps and whose orders come in as sales orders every 5 minutes; marketplace payouts go to finance.")}</p>
          {canAdmin && !form && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm({ platform: "SHOPIFY", shopDomain: "", accessToken: "", refreshToken: "", warehouseId: "", ordersSince: todayIso(), autoConfirm: true, accountId: "", locationId: "" })}><Plus className="h-4 w-4" /> {t("Connect a store")}</button>}
        </div>

        {secret && (
          <div className={`${CARD} space-y-2 border-cyan-200 p-4`}>
            <h2 className={CARD_TITLE}>{t("noon webhook: copy these now")}</h2>
            <p className="text-xs text-slate-600 dark:text-gray-300">{t("In noon's developer portal, add an HTTPS destination with this address and a header X-MyTrade-Store-Key with this secret, then subscribe it to FBPI order sync. The secret isn't shown again.")}</p>
            {([["Address", secret.url], ["Header", `X-MyTrade-Store-Key: ${secret.secret}`]] as const).map(([label, value]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-16 text-xs font-semibold text-slate-500">{t(label)}</span>
                <code className="flex-1 break-all rounded bg-slate-50 px-2 py-1 text-xs dark:bg-gray-800" dir="ltr">{value}</code>
                <button type="button" className={SECONDARY_BUTTON} onClick={() => navigator.clipboard?.writeText(label === "Header" ? secret.secret : value)}>{t("Copy")}</button>
              </div>
            ))}
            <div className="flex justify-end"><button type="button" className={SECONDARY_BUTTON} onClick={() => setSecret(null)}>{t("Done")}</button></div>
          </div>
        )}

        {payoutForm && (
          <div className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t("Upload a payout statement")}</h2>
            <p className="text-xs text-slate-600 dark:text-gray-300">
              {t("A CSV with the columns Order number, Type (Order, Refund, Fee or Other) and Amount (refunds and fees negative), plus a Description. The lines must add up to the amount paid out.")}{" "}
              <button type="button" className="underline decoration-dotted" onClick={downloadTemplate}>{t("Download the template")}</button>
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div><label className={LABEL} htmlFor="po-ref">{t("Statement number")} *</label><input id="po-ref" className={INPUT} dir="ltr" value={payoutForm.reference} onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="po-amount">{t("Amount paid out")} *</label><input id="po-amount" className={INPUT} dir="ltr" inputMode="decimal" value={payoutForm.amount} onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="po-cur">{t("Currency")}</label><input id="po-cur" className={INPUT} dir="ltr" maxLength={3} value={payoutForm.currency} onChange={(e) => setPayoutForm({ ...payoutForm, currency: e.target.value.toUpperCase() })} /></div>
              <div><label className={LABEL} htmlFor="po-from">{t("Period from")}</label><input id="po-from" type="date" className={INPUT} value={payoutForm.periodFrom} onChange={(e) => setPayoutForm({ ...payoutForm, periodFrom: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="po-to">{t("Period to")}</label><input id="po-to" type="date" className={INPUT} value={payoutForm.periodTo} onChange={(e) => setPayoutForm({ ...payoutForm, periodTo: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="po-date">{t("Paid on")}</label><input id="po-date" type="date" className={INPUT} value={payoutForm.payoutDate} onChange={(e) => setPayoutForm({ ...payoutForm, payoutDate: e.target.value })} /></div>
              <div className="md:col-span-3"><label className={LABEL} htmlFor="po-file">{t("Statement (CSV)")} *</label><input id="po-file" type="file" accept=".csv,text/csv" className="text-sm" onChange={(e) => setPayoutForm({ ...payoutForm, file: e.target.files?.[0] ?? null })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => setPayoutForm(null)}>{t("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null} onClick={uploadPayout}><Upload className="h-4 w-4" /> {t("Send to finance")}</button>
            </div>
          </div>
        )}

        {form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <h2 className={CARD_TITLE}>{t("Connect a store")}</h2>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-gray-700" role="radiogroup" aria-label={t("Platform")}>
              {PLATFORMS.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={form.platform === p}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${form.platform === p ? "bg-[rgb(var(--brand-600,0_151_167))] text-white" : "text-slate-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  onClick={() => setForm({ ...form, platform: p })}>{PLATFORM_NAME[p]}</button>
              ))}
            </div>
            <ol className="list-decimal space-y-1 ps-5 text-xs text-slate-600 dark:text-gray-300">
              {STEPS[form.platform].map((step) => <li key={step}>{t(step)}</li>)}
              <li>{t("Give every product a SKU equal to its MyTrade product code.")}</li>
            </ol>
            <div className="grid gap-3 md:grid-cols-2">
              {form.platform === "SHOPIFY" && (
                <div>
                  <label className={LABEL} htmlFor="st-domain">{t("Store address")} *</label>
                  <input id="st-domain" className={INPUT} dir="ltr" placeholder="your-store.myshopify.com" value={form.shopDomain} onChange={(e) => setForm({ ...form, shopDomain: e.target.value })} />
                </div>
              )}
              {form.platform === "AMAZON" ? (
                <>
                  <div>
                    <label className={LABEL} htmlFor="st-seller">{t("Seller ID (Merchant Token)")} *</label>
                    <input id="st-seller" className={INPUT} dir="ltr" placeholder="A1B2C3D4E5F6G7" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="st-amzrefresh">{t("Refresh token")} *</label>
                    <input id="st-amzrefresh" type="password" autoComplete="off" className={INPUT} dir="ltr" placeholder="Atzr|…" value={form.refreshToken} onChange={(e) => setForm({ ...form, refreshToken: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="st-market">{t("Marketplace")}</label>
                    <select id="st-market" className={INPUT} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                      <option value="">{t("The first one the seller sells in")}</option>
                      {AMAZON_MARKETS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </>
              ) : form.platform === "NOON" ? (
                <>
                  <div className="md:col-span-2">
                    <label className={LABEL} htmlFor="st-key">{t(TOKEN_LABEL.NOON)} *</label>
                    <textarea id="st-key" rows={4} className={`${INPUT} font-mono text-xs`} dir="ltr" placeholder='{"key_id": "…", "private_key": "-----BEGIN PRIVATE KEY-----…", "project_code": "…"}'
                      value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="st-whcode">{t("noon warehouse code")}</label>
                    <input id="st-whcode" className={INPUT} dir="ltr" placeholder={t("The first active one")} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} />
                  </div>
                </>
              ) : (
                <div>
                  <label className={LABEL} htmlFor="st-token">{t(TOKEN_LABEL[form.platform])} *</label>
                  <input id="st-token" type="password" autoComplete="off" className={INPUT} dir="ltr" placeholder={form.platform === "SHOPIFY" ? "shpat_…" : ""} value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} />
                </div>
              )}
              {form.platform === "SALLA" && (
                <div>
                  <label className={LABEL} htmlFor="st-refresh">{t("Salla refresh token")}</label>
                  <input id="st-refresh" type="password" autoComplete="off" className={INPUT} dir="ltr" value={form.refreshToken} onChange={(e) => setForm({ ...form, refreshToken: e.target.value })} />
                </div>
              )}
              <div>
                <label className={LABEL} htmlFor="st-wh">{t("Sells from warehouse")} *</label>
                <select id="st-wh" className={INPUT} value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
                  <option value="">{t("Choose…")}</option>
                  {warehouses.filter((w) => w.active !== false).map((w) => <option key={w.id} value={String(w.id)}>{w.name || w.code}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="st-since">{t("Bring in orders from")}</label>
                <input id="st-since" type="date" className={INPUT} value={form.ordersSince} max={todayIso()} onChange={(e) => setForm({ ...form, ordersSince: e.target.value })} />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200 md:col-span-2">
                <input type="checkbox" checked={form.autoConfirm} onChange={(e) => setForm({ ...form, autoConfirm: e.target.checked })} />
                {t("Confirm orders as they come in (reserves the stock); untick to check each draft first")}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => setForm(null)}>{t("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy !== null} onClick={connect}><PlugZap className="h-4 w-4" /> {t("Connect")}</button>
            </div>
          </div>
        )}

        {stores === null ? (
          <div className={`${CARD} p-6 text-sm text-slate-400`}>{t("Loading...")}</div>
        ) : stores.length === 0 && !form ? (
          <div className={`${CARD} p-6 text-sm text-slate-500`}>{t("No store connected yet.")}</div>
        ) : stores.map((s) => (
          <section key={s.id} className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[rgb(var(--brand-600,0_151_167))]" />
                <div>
                  <h2 className={CARD_TITLE}>{s.shopName ?? s.shopDomain} <span className="font-mono text-xs font-normal text-slate-400" dir="ltr">{s.shopDomain}</span></h2>
                  <p className="text-xs text-slate-500">
                    {PLATFORM_NAME[s.platform] ?? s.platform} · {s.shopCurrency ?? "—"} · {t(s.taxesIncluded ? "prices include tax" : "prices before tax")} · {t("location")} {s.locationName ?? (s.locationId ? s.locationId : t("whole store"))} ·{t("warehouse")} {warehouseName(s.warehouseId)} · {t("{n} products linked", { n: s.linkedProducts })}
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.active ? TONE.IMPORTED : TONE.SKIPPED}`}>{t(s.active ? "Active" : "Paused")}</span>
            </div>
            {s.lastError && <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />{s.lastError}</p>}
            <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-300">
              <span>{t("Orders last checked")}: {s.lastOrderSyncAt ? formatDateTime(utc(s.lastOrderSyncAt)) : t("Never")}</span>
              <span>{t("Stock last sent")}: {s.lastStockSyncAt ? formatDateTime(utc(s.lastStockSyncAt)) : t("Never")}</span>
              <span>{t("Orders from")}: {s.ordersSince ? formatDate(s.ordersSince) : "—"}</span>
              <span dir="ltr">{t("Token")}: {s.tokenHint}</span>
            </div>
            {s.webhookPath && (
              <p className="text-xs text-slate-600 dark:text-gray-300">
                {t("noon calls")} <code className="break-all rounded bg-slate-50 px-1 dark:bg-gray-800" dir="ltr">{`${window.location.origin}${s.webhookPath}`}</code>
                {canAdmin && <> · <button type="button" className="underline decoration-dotted" disabled={busy !== null} onClick={() => newSecret(s)}>{t("New webhook secret")}</button></>}
              </p>
            )}
            {canAdmin && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-gray-200">
                {([["importOrders", "Bring orders in"], ["pushStock", "Send stock"], ["autoConfirm", "Confirm orders"], ["active", "Active"]] as const).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={s[key]} disabled={busy !== null} onChange={(e) => setting(s, { [key]: e.target.checked })} /> {t(label)}
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {canSync && <>
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => sync(s, "products")}><Link2 className="h-4 w-4" /> {t("Link products by SKU")}</button>
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => sync(s, "stock")}><Upload className="h-4 w-4" /> {t("Send stock now")}</button>
                <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => sync(s, "orders")}><Download className="h-4 w-4" /> {t("Bring orders in now")}</button>
                {s.platform === "AMAZON" && <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => fetchPayouts(s)}><Wallet className="h-4 w-4" /> {t("Get payouts")}</button>}
                {(s.platform === "NOON" || s.platform === "AMAZON") && (
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null}
                    onClick={() => setPayoutForm({ storeId: s.id, reference: "", periodFrom: "", periodTo: "", payoutDate: todayIso(), amount: "", currency: s.shopCurrency ?? "", file: null })}>
                    <FileUp className="h-4 w-4" /> {t("Upload payout statement")}
                  </button>
                )}
              </>}
              {(s.platform === "NOON" || s.platform === "AMAZON") && <button type="button" className={SECONDARY_BUTTON} onClick={() => navigate("/marketplacePayouts")}><Wallet className="h-4 w-4" /> {t("Marketplace payouts")}</button>}
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(open?.id === s.id && open.tab === "orders" ? null : { id: s.id, tab: "orders" })}><ShoppingBag className="h-4 w-4" /> {t("Order log")}</button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(open?.id === s.id && open.tab === "products" ? null : { id: s.id, tab: "products" })}><Boxes className="h-4 w-4" /> {t("Linked products")}</button>
              {canAdmin && <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Disconnect")} aria-label={t("Disconnect")} onClick={() => disconnect(s)}><Trash2 className="h-4 w-4" /></button>}
            </div>

            {open?.id === s.id && open.tab === "orders" && (
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="w-full min-w-[56rem] divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Store order")}</th><th className={TH}>{t("Buyer")}</th><th className={`${TH} text-end`}>{t("Total")}</th>
                      <th className={TH}>{t("Payment")}</th><th className={TH}>{t("Status")}</th><th className={TH}>{t("Sales order")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {orders === null ? <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                      : orders.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">{t("No orders yet.")}</td></tr>
                        : orders.map((o) => (
                          <tr key={o.id}>
                            <td className={TD}><span className="font-medium">{o.externalNumber}</span><span className="block text-xs text-slate-400">{o.orderedAt ? formatDateTime(utc(o.orderedAt)) : ""}</span></td>
                            <td className={TD}>{o.customerName}</td>
                            <td className={`${TD} whitespace-nowrap text-end`}>{o.storeTotal == null ? "—" : formatMoney(o.storeTotal, { currency: o.currency ?? undefined })}</td>
                            <td className={`${TD} text-xs`}>{o.paymentStatus ?? "—"}</td>
                            <td className={TD}>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${o.cancelledInStore ? TONE.NEEDS_ATTENTION : TONE[o.status]}`}>{t(o.cancelledInStore ? "Cancelled in store" : STATUS_TEXT[o.status])}</span>
                              {o.problem && <span className="mt-1 block max-w-md text-xs text-amber-700">{o.problem}</span>}
                            </td>
                            <td className={TD}>
                              {o.salesOrderNumber ? <button type="button" className="text-start underline decoration-dotted hover:text-cyan-700" onClick={() => navigate("/sales-orders")}>{o.salesOrderNumber}</button> : "—"}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
            {open?.id === s.id && open.tab === "products" && (
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="w-full min-w-[40rem] divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr><th className={TH}>{t("SKU")}</th><th className={TH}>{t("Store product")}</th><th className={TH}>{t("MyTrade product")}</th><th className={`${TH} text-end`}>{t("Last sent")}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {links === null ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                      : links.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("Nothing linked yet: use Link products by SKU.")}</td></tr>
                        : links.map((l) => (
                          <tr key={l.id}>
                            <td className={`${TD} font-mono text-xs`} dir="ltr">{l.sku}</td>
                            <td className={TD}>{l.title}</td>
                            <td className={TD}>{l.productCode}</td>
                            <td className={`${TD} whitespace-nowrap text-end text-xs`}>{l.lastPushedQuantity ?? "—"}{l.lastPushedAt ? ` · ${formatDateTime(utc(l.lastPushedAt))}` : ""}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
