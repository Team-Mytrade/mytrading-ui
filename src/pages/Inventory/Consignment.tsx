import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowDownToLine, ArrowRightLeft, ClipboardCheck, HandCoins, Plus, Tag, Undo2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { usePermissions } from "../../access/usePermissions";
import { companyCurrency, formatDate, formatMoney } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const API = "/v1/api/inventory/consignment";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Named { id: number; name?: string; customerName?: string; productCode?: string; productName?: string; code?: string; active?: boolean; isActive?: boolean; consignmentType?: string | null }
interface StockLine { productId: number; quantity: number; unitValue: number | null; value: number | null }
interface Site { id: number; code: string; name: string; consignmentType: "CUSTOMER_SITE" | "VENDOR_OWNED"; partyId: number; partyName: string; active: boolean; stock: StockLine[]; units: number; value: number }
interface Settlement { id: number; settlementNumber: string; settlementDate: string; warehouseCode: string; vendorName: string; toWarehouseCode: string; amount: number; billNumber: string | null; lines: { productId: number; quantity: number; unitPrice: number; amount: number }[] }
type Action =
  | { kind: "site"; type: Site["consignmentType"] }
  | { kind: "send" | "back" | "usage" | "receive" | "return" | "price" | "takeover"; site: Site };

const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, { currency: companyCurrency() }));

/**
 * Consignment stock (backlog 7.2.2 step 3): our goods at customers' sites (moved by transfer, usage becomes the
 * customer's sales order from the site) and vendors' goods held in ours (off the books until taken over at the
 * agreed price, which bills them from the vendor).
 */
export default function Consignment() {
  const { canCreate, canUpdate } = usePermissions("INVENTORY");
  const [tab, setTab] = useState<"customers" | "vendors" | "settlements">("customers");
  const [sites, setSites] = useState<Site[] | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [products, setProducts] = useState<Record<number, Named>>({});
  const [customers, setCustomers] = useState<Named[]>([]);
  const [vendors, setVendors] = useState<Named[]>([]);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    axios.get<Site[]>(`${API}/sites`).then((r) => setSites(r.data)).catch((err) => {
      setSites([]);
      ToasterService.error("Consignment stock could not be loaded", apiError(err, "Is the inventory service running?"));
    });
    axios.get<Settlement[]>(`${API}/settlements`).then((r) => setSettlements(r.data)).catch(() => setSettlements([]));
    axios.get("/v1/api/inventory/warehouses").then((r) => setWarehouses(asArray<Named>(r.data))).catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/products").then((r) => {
      const map: Record<number, Named> = {};
      asArray<Named>(r.data).forEach((p) => { map[p.id] = p; });
      setProducts(map);
    }).catch(() => undefined);
    axios.get("/v1/api/common/customers").then((r) => setCustomers(asArray<Named>(r.data))).catch(() => undefined);
    axios.get("/v1/api/common/vendors").then((r) => setVendors(asArray<Named>(r.data))).catch(() => undefined);
  }, [load]);

  const product = (id: number) => {
    const p = products[id];
    return p ? `${p.productCode ?? ""} ${p.productName ?? ""}`.trim() : `#${id}`;
  };
  const ownWarehouses = useMemo(() => warehouses.filter((w) => !w.consignmentType && w.active !== false && w.isActive !== false), [warehouses]);
  const shown = (sites ?? []).filter((s) => s.consignmentType === (tab === "customers" ? "CUSTOMER_SITE" : "VENDOR_OWNED"));

  const submit = async (call: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    try {
      await call();
      ToasterService.success(done);
      setAction(null);
      load();
    } catch (err) {
      ToasterService.error(failed, apiError(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageMeta title={t("Consignment")} description="Consignment stock at customers and from vendors" />
      <PageBreadcrumb pageTitle="Consignment" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm dark:border-gray-700 dark:bg-[#191919]">
          {(["customers", "vendors", "settlements"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-cyan-600 text-white" : "text-slate-600 dark:text-gray-300"}`}>
              {t(k === "customers" ? "At customers" : k === "vendors" ? "Vendors' stock" : "Take-overs")}
            </button>
          ))}
        </div>

        {tab !== "settlements" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-3xl text-xs text-slate-500">{t(tab === "customers"
                ? "Your goods held at a customer's: still your stock, at your cost. Send and take back by transfer; what the customer used becomes their sales order from the site, with a dispatch to invoice."
                : "A vendor's goods held in your warehouse: not your stock, not valued and not sellable until taken over. Taking over moves them into one of your warehouses at the agreed price and bills them from the vendor.")}</p>
              {canCreate && <button type="button" className={PRIMARY_BUTTON} onClick={() => setAction({ kind: "site", type: tab === "customers" ? "CUSTOMER_SITE" : "VENDOR_OWNED" })}>
                <Plus className="h-4 w-4" /> {t(tab === "customers" ? "Add a customer site" : "Add a vendor's stock location")}</button>}
            </div>
            {sites === null ? <p className="text-sm text-slate-400">{t("Loading...")}</p>
              : shown.length === 0 ? <div className={`${CARD} p-6 text-center text-sm text-slate-400`}>{t(tab === "customers" ? "No customer sites yet." : "No vendors' stock locations yet.")}</div>
              : shown.map((site) => (
                <div key={site.id} className={`${CARD} overflow-hidden`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                    <div>
                      <h2 className={CARD_TITLE}>{site.partyName} <span className="ms-1 font-mono text-xs text-slate-400">{site.code}</span></h2>
                      <p className="text-xs text-slate-500">{t("{units} units · {value}", { units: site.units, value: money(site.value) })}{site.consignmentType === "VENDOR_OWNED" ? ` ${t("at agreed prices")}` : ` ${t("at your cost")}`}</p>
                    </div>
                    {canUpdate && (
                      <div className="flex flex-wrap gap-2">
                        {site.consignmentType === "CUSTOMER_SITE" ? (
                          <>
                            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAction({ kind: "send", site })}><ArrowRightLeft className="h-4 w-4" /> {t("Send stock")}</button>
                            <button type="button" className={SECONDARY_BUTTON} disabled={site.units === 0} onClick={() => setAction({ kind: "back", site })}><Undo2 className="h-4 w-4" /> {t("Take back")}</button>
                            <button type="button" className={PRIMARY_BUTTON} disabled={site.units === 0} onClick={() => setAction({ kind: "usage", site })}><ClipboardCheck className="h-4 w-4" /> {t("Report usage")}</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAction({ kind: "price", site })}><Tag className="h-4 w-4" /> {t("Agreed price")}</button>
                            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAction({ kind: "receive", site })}><ArrowDownToLine className="h-4 w-4" /> {t("Receive")}</button>
                            <button type="button" className={SECONDARY_BUTTON} disabled={site.units === 0} onClick={() => setAction({ kind: "return", site })}><Undo2 className="h-4 w-4" /> {t("Return to vendor")}</button>
                            <button type="button" className={PRIMARY_BUTTON} disabled={site.units === 0} onClick={() => setAction({ kind: "takeover", site })}><HandCoins className="h-4 w-4" /> {t("Take over")}</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("Product")}</th><th className={`${TH} text-end`}>{t("Qty")}</th>
                      <th className={`${TH} text-end`}>{t(site.consignmentType === "VENDOR_OWNED" ? "Agreed price" : "Unit cost")}</th><th className={`${TH} text-end`}>{t("Value")}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {site.stock.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-slate-400">{t("Nothing held here.")}</td></tr>
                        : site.stock.map((s) => (
                          <tr key={s.productId}>
                            <td className={TD}>{product(s.productId)}</td>
                            <td className={`${TD} text-end`}>{s.quantity}</td>
                            <td className={`${TD} text-end`}>{s.unitValue == null ? <span className="text-amber-700">{t(site.consignmentType === "VENDOR_OWNED" ? "No price yet" : "—")}</span> : money(s.unitValue)}</td>
                            <td className={`${TD} text-end`}>{money(s.value)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}

        {tab === "settlements" && (
          <div className={`${CARD} overflow-hidden`}>
            <h2 className={`${CARD_TITLE} border-b border-slate-100 px-4 py-3 dark:border-gray-800`}>{t("Vendors' stock taken over")}</h2>
            <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
              <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("No.")}</th><th className={TH}>{t("Date")}</th><th className={TH}>{t("Vendor")}</th><th className={TH}>{t("Products")}</th><th className={TH}>{t("Into")}</th><th className={`${TH} text-end`}>{t("Amount")}</th><th className={TH}>{t("Bill")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {settlements.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">{t("Nothing taken over yet.")}</td></tr>
                  : settlements.map((s) => (
                    <tr key={s.id}>
                      <td className={`${TD} font-medium`}>{s.settlementNumber}</td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(s.settlementDate)}</td>
                      <td className={TD}>{s.vendorName}</td>
                      <td className={TD}>{s.lines.map((l) => `${product(l.productId)} × ${l.quantity}`).join(", ")}</td>
                      <td className={TD}>{s.toWarehouseCode}</td>
                      <td className={`${TD} text-end`}>{money(s.amount)}</td>
                      <td className={TD}>{s.billNumber ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {action && (
        <ActionDialog action={action} busy={busy} customers={customers} vendors={vendors} products={products} product={product}
          ownWarehouses={ownWarehouses} onCancel={() => setAction(null)} onSubmit={submit} />
      )}
    </>
  );
}

function ActionDialog({ action, busy, customers, vendors, products, product, ownWarehouses, onCancel, onSubmit }: {
  action: Action; busy: boolean; customers: Named[]; vendors: Named[]; products: Record<number, Named>; product: (id: number) => string;
  ownWarehouses: Named[]; onCancel: () => void; onSubmit: (call: () => Promise<unknown>, done: string, failed: string) => void;
}) {
  const site = action.kind === "site" ? null : action.site;
  const held = site?.stock ?? [];
  const [f, setF] = useState({ partyId: "", code: "", productId: held[0] ? String(held[0].productId) : "", quantity: "", price: "",
    warehouse: ownWarehouses[0] ? String(ownWarehouses[0].id) : "", reference: "", billNumber: "" });
  const productOptions = action.kind === "receive" || action.kind === "price" || action.kind === "send"
    ? Object.values(products).map((p) => p.id) : held.map((s) => s.productId);
  const title: Record<string, string> = {
    site: action.kind === "site" && action.type === "CUSTOMER_SITE" ? "Add a customer site" : "Add a vendor's stock location",
    send: "Send stock to {party}", back: "Take stock back from {party}", usage: "What {party} used", receive: "Receive from {party}",
    return: "Return to {party}", price: "Agreed price with {party}", takeover: "Take over {party}'s stock",
  };
  const qty = Number(f.quantity);
  const go = () => {
    if (action.kind === "site") {
      const list = action.type === "CUSTOMER_SITE" ? customers : vendors;
      const party = list.find((p) => String(p.id) === f.partyId);
      if (!party || !f.code.trim()) return ToasterService.error("Choose who it is for and enter a code.");
      return onSubmit(() => axios.post(`${API}/sites`, { consignmentType: action.type, partyId: party.id, partyName: party.customerName ?? party.name, code: f.code }),
        "Location added.", "The location could not be added");
    }
    if (!site) return;
    if (!f.productId) return ToasterService.error("Choose the product.");
    const pid = Number(f.productId);
    switch (action.kind) {
      case "price":
        return onSubmit(() => axios.put(`${API}/sites/${site.id}/prices`, { productId: pid, unitPrice: Number(f.price) }), "Price saved.", "The price could not be saved");
      case "receive":
      case "return":
        return onSubmit(() => axios.post(`${API}/sites/${site.id}/${action.kind}`, { productId: pid, quantity: qty, reference: f.reference || null }),
          action.kind === "receive" ? "Received on consignment." : "Returned to the vendor.", "The stock could not be moved");
      case "takeover":
        return onSubmit(() => axios.post(`${API}/sites/${site.id}/take-over`, { toWarehouseId: Number(f.warehouse), billNumber: f.billNumber || null,
          lines: [{ productId: pid, quantity: qty }] }), "Taken over and billed by the vendor.", "The stock could not be taken over");
      case "usage":
        return onSubmit(() => axios.post(`${API}/sites/${site.id}/usage`, { currencyCode: companyCurrency(), reference: f.reference || null,
          lines: [{ productId: pid, quantity: qty }] }).then((r) => {
          ToasterService.success(t("Order {order} and dispatch {dispatch} made: confirm the dispatch, then invoice it.", { order: r.data.orderNumber, dispatch: r.data.dispatchNumber }));
        }), "Usage recorded.", "The usage could not be recorded");
      case "send":
      case "back": {
        const own = ownWarehouses.find((w) => String(w.id) === f.warehouse);
        if (!own) return ToasterService.error("Choose your warehouse.");
        return onSubmit(() => axios.post("/v1/api/inventory/stock-movements", { movementType: "WAREHOUSE_TRANSFER", productId: pid, quantity: qty,
          fromLocation: String(action.kind === "send" ? own.id : site.id), toLocation: String(action.kind === "send" ? site.id : own.id),
          reference: f.reference || `Consignment ${site.code}` }), action.kind === "send" ? "Sent to the customer's site." : "Taken back.", "The transfer could not be made");
      }
    }
  };
  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t(title[action.kind], { party: site?.partyName ?? "" })}>
      <div className={`${CARD} w-full max-w-md space-y-3 p-4`}>
        <h2 className={CARD_TITLE}>{t(title[action.kind], { party: site?.partyName ?? "" })}</h2>
        {action.kind === "site" ? (
          <>
            <div><label className={LABEL} htmlFor="cs-party">{t(action.type === "CUSTOMER_SITE" ? "Customer" : "Vendor")}</label>
              <select id="cs-party" className={INPUT} value={f.partyId} onChange={(e) => setF({ ...f, partyId: e.target.value })}>
                <option value="">{t("Choose…")}</option>
                {(action.type === "CUSTOMER_SITE" ? customers : vendors).filter((p) => p.active !== false).map((p) => <option key={p.id} value={String(p.id)}>{p.customerName ?? p.name}</option>)}
              </select></div>
            <div><label className={LABEL} htmlFor="cs-code">{t("Location code")}</label>
              <input id="cs-code" className={`${INPUT} uppercase`} maxLength={50} placeholder={action.type === "CUSTOMER_SITE" ? "CS-HARRY" : "CV-SZC"} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          </>
        ) : (
          <>
            <div><label className={LABEL} htmlFor="cs-product">{t("Product")}</label>
              <select id="cs-product" className={INPUT} value={f.productId} onChange={(e) => setF({ ...f, productId: e.target.value })}>
                <option value="">{t("Choose…")}</option>
                {productOptions.map((id) => <option key={id} value={String(id)}>{product(id)}{held.find((h) => h.productId === id) ? ` · ${t("{count} held", { count: held.find((h) => h.productId === id)!.quantity })}` : ""}</option>)}
              </select></div>
            {action.kind === "price" ? (
              <div><label className={LABEL} htmlFor="cs-price">{t("Agreed price per unit")} ({companyCurrency()})</label>
                <input id="cs-price" type="number" min="0" step="any" className={INPUT} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            ) : (
              <div><label className={LABEL} htmlFor="cs-qty">{t("Quantity")}</label>
                <input id="cs-qty" type="number" min="1" className={INPUT} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
            )}
            {(action.kind === "send" || action.kind === "back" || action.kind === "takeover") && (
              <div><label className={LABEL} htmlFor="cs-wh">{t(action.kind === "send" ? "From your warehouse" : "Into your warehouse")}</label>
                <select id="cs-wh" className={INPUT} value={f.warehouse} onChange={(e) => setF({ ...f, warehouse: e.target.value })}>
                  {ownWarehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code ? `${w.code} · ` : ""}{w.name}</option>)}
                </select></div>
            )}
            {action.kind === "takeover" && (
              <div><label className={LABEL} htmlFor="cs-bill">{t("Vendor's bill number")}</label>
                <input id="cs-bill" className={INPUT} maxLength={50} placeholder={t("The take-over number if blank")} value={f.billNumber} onChange={(e) => setF({ ...f, billNumber: e.target.value })} /></div>
            )}
            {action.kind !== "price" && action.kind !== "takeover" && (
              <div><label className={LABEL} htmlFor="cs-ref">{t("Reference")}</label>
                <input id="cs-ref" className={INPUT} maxLength={100} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
            )}
            <p className="text-xs text-slate-500">{t(action.kind === "takeover" ? "Moves the units into your warehouse at the agreed price (a purchase receipt) and creates the vendor's bill."
              : action.kind === "usage" ? "Makes the customer's sales order from this site, confirmed, with a draft dispatch to confirm and invoice."
              : action.kind === "receive" ? "Held for the vendor: no cost, not in your stock value." : action.kind === "send" ? "Stays your stock at its cost while at the customer's." : "")}</p>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={onCancel}>{t("Cancel")}</button>
          <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={go}>{t("Save")}</button>
        </div>
      </div>
    </div>
  );
}
