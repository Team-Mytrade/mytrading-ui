import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import { CustomerPrice, PriceList, pricingApi } from "../../sales/pricingApi";
import { currencyChoices, companyCurrency, formatDate, formatMoney } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Product { id: number; productCode?: string; productName?: string; sellingPrice?: number; active?: boolean }
interface Customer { id: number; customerCode?: string; customerName?: string }

type ItemRow = { key: string; productId: string; minQuantity: string; unitPrice: string };
type ListForm = {
  id: number | null; name: string; currencyCode: string; validFrom: string; validTo: string; active: boolean;
  defaultList: boolean; notes: string; items: ItemRow[]; customerIds: number[];
};

let rowSeq = 0;
const row = (productId = "", minQuantity = "1", unitPrice = ""): ItemRow => ({ key: `r${rowSeq++}`, productId, minQuantity, unitPrice });
const emptyList = (): ListForm => ({
  id: null, name: "", currencyCode: companyCurrency(), validFrom: "", validTo: "", active: true, defaultList: false,
  notes: "", items: [row()], customerIds: [],
});

const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];

/**
 * Selling prices by customer: price lists (with quantity breaks, assigned to customers, one default per currency) and
 * prices agreed with one customer. Quotation lines take the customer's price, else their list's, else the catalogue's.
 */
export default function PriceListsPage() {
  const { canCreate, canUpdate, canDelete } = usePermissions("SALES");
  const [tab, setTab] = useState<"lists" | "customer">("lists");
  const [lists, setLists] = useState<PriceList[] | null>(null);
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<ListForm | null>(null);
  const [customerFilter, setCustomerFilter] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [priceForm, setPriceForm] = useState<{ id: number | null; customerId: string; productId: string; currencyCode: string;
    unitPrice: string; validFrom: string; validTo: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    pricingApi.lists().then(setLists).catch((err) => {
      setLists([]);
      ToasterService.error("Price lists could not be loaded", errorText(err, "Is the sales service running?"));
    });
    pricingApi.customerPrices().then(setPrices).catch(() => setPrices([]));
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/products").then((r) => setProducts(asArray<Product>(r.data))).catch(() => undefined);
    axios.get("/v1/api/common/customers").then((r) => setCustomers(asArray<Customer>(r.data))).catch(() => undefined);
  }, [load]);

  const productName = useMemo(() => new Map(products.map((p) => [p.id, `${p.productCode ?? ""} ${p.productName ?? ""}`.trim()])), [products]);
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.customerName || c.customerCode || `#${c.id}`])), [customers]);
  // Which list each customer is on (a customer has one)
  const listOf = useMemo(() => {
    const map = new Map<number, string>();
    (lists ?? []).forEach((l) => l.customerIds.forEach((id) => map.set(id, l.name)));
    return map;
  }, [lists]);

  const edit = (list: PriceList) => setForm({
    id: list.id, name: list.name, currencyCode: list.currencyCode, validFrom: list.validFrom ?? "", validTo: list.validTo ?? "",
    active: list.active, defaultList: list.defaultList, notes: list.notes ?? "",
    items: list.items.length ? list.items.map((i) => row(String(i.productId), String(i.minQuantity), String(i.unitPrice))) : [row()],
    customerIds: [...list.customerIds],
  });

  const setItem = (key: string, patch: Partial<ItemRow>) =>
    setForm((f) => (f ? { ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : f));

  const saveList = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      ToasterService.error("Enter the price list name.");
      return;
    }
    const items = form.items.filter((i) => i.productId);
    if (items.some((i) => i.unitPrice === "" || Number(i.unitPrice) < 0 || Number(i.minQuantity) <= 0)) {
      ToasterService.error("Each line needs a price (zero or more) and a from-quantity above zero.");
      return;
    }
    setSaving(true);
    try {
      await pricingApi.saveList(form.id, {
        name: form.name.trim(), currencyCode: form.currencyCode, validFrom: form.validFrom || null, validTo: form.validTo || null,
        active: form.active, defaultList: form.defaultList, notes: form.notes || null, customerIds: form.customerIds,
        items: items.map((i) => ({ productId: Number(i.productId), minQuantity: Number(i.minQuantity || 1), unitPrice: Number(i.unitPrice) })),
      });
      ToasterService.success(form.id ? "Price list saved." : "Price list added.");
      setForm(null);
      load();
    } catch (err) {
      ToasterService.error("The price list could not be saved", errorText(err, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const removeList = async (list: PriceList) => {
    if (!window.confirm(t("Delete the price list {name}? Its customers then get the default list or the catalogue price.", { name: list.name }))) return;
    try {
      await pricingApi.deleteList(list.id);
      ToasterService.success("Price list deleted.");
      load();
    } catch (err) {
      ToasterService.error("The price list could not be deleted", errorText(err, "Please try again."));
    }
  };

  const savePrice = async () => {
    if (!priceForm) return;
    if (!priceForm.customerId || !priceForm.productId || priceForm.unitPrice === "") {
      ToasterService.error("Choose the customer and product and enter the price.");
      return;
    }
    setSaving(true);
    try {
      await pricingApi.saveCustomerPrice(priceForm.id, {
        customerId: Number(priceForm.customerId), productId: Number(priceForm.productId), currencyCode: priceForm.currencyCode,
        unitPrice: Number(priceForm.unitPrice), validFrom: priceForm.validFrom || null, validTo: priceForm.validTo || null,
      });
      ToasterService.success("Customer price saved.");
      setPriceForm(null);
      load();
    } catch (err) {
      ToasterService.error("The customer price could not be saved", errorText(err, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const removePrice = async (price: CustomerPrice) => {
    if (!window.confirm(t("Remove this customer price?"))) return;
    try {
      await pricingApi.deleteCustomerPrice(price.id);
      load();
    } catch (err) {
      ToasterService.error("The customer price could not be removed", errorText(err, "Please try again."));
    }
  };

  const validity = (from: string | null, to: string | null) =>
    !from && !to ? t("Always") : `${from ? formatDate(from) : "…"} – ${to ? formatDate(to) : "…"}`;

  const shownPrices = prices.filter((p) => !customerFilter || String(p.customerId) === customerFilter);
  const shownCustomers = customers.filter((c) => {
    const q = customerSearch.trim().toLowerCase();
    return !q || `${c.customerName ?? ""} ${c.customerCode ?? ""}`.toLowerCase().includes(q);
  });
  const activeProducts = products.filter((p) => p.active !== false);

  return (
    <>
      <PageMeta title={t("Price Lists")} description="Selling prices by customer" />
      <PageBreadcrumb pageTitle="Price Lists" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} p-4 text-sm text-slate-600 dark:text-gray-300`}>
          {t("Quotation lines take the customer's own price, else their price list's (the quantity break the quantity reaches), else the catalogue price. A rate typed on the line always stays.")}
        </div>

        <div className="flex gap-2" role="tablist">
          {(["lists", "customer"] as const).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={tab === key ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
              {t(key === "lists" ? "Price lists" : "Customer prices")}
            </button>
          ))}
        </div>

        {tab === "lists" && !form && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Price lists")}</h2>
              {canCreate && (
                <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm(emptyList())}>
                  <Plus className="h-4 w-4" /> {t("New price list")}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Name")}</th>
                    <th className={TH}>{t("Currency")}</th>
                    <th className={TH}>{t("Valid")}</th>
                    <th className={TH}>{t("Prices")}</th>
                    <th className={TH}>{t("Customers")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {lists === null ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : lists.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("No price lists yet: every customer gets the catalogue price.")}</td></tr>
                  ) : lists.map((list) => (
                    <tr key={list.id}>
                      <td className={`${TD} font-medium`}>
                        {list.name}
                        {list.defaultList && (
                          <span className="ms-2 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                            {t("Default")}
                          </span>
                        )}
                      </td>
                      <td className={TD}>{list.currencyCode}</td>
                      <td className={`${TD} whitespace-nowrap`}>{validity(list.validFrom, list.validTo)}</td>
                      <td className={TD}>{list.items.length}</td>
                      <td className={TD}>{list.defaultList && list.customerIds.length === 0 ? t("Everyone else") : list.customerIds.length}</td>
                      <td className={TD}>{t(list.active ? "Active" : "Inactive")}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        {canUpdate && (
                          <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => edit(list)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => removeList(list)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "lists" && form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <h2 className={CARD_TITLE}>{form.id ? t("Edit price list") : t("New price list")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="pl-name">{t("Name")} *</label>
                <input id="pl-name" className={INPUT} value={form.name} maxLength={100} placeholder={t("e.g. Wholesale AED")}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="pl-currency">{t("Currency")} *</label>
                <select id="pl-currency" className={INPUT} value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}>
                  {currencyChoices(form.currencyCode).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-4 pb-2 text-sm text-slate-700 dark:text-gray-200">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> {t("Active")}
                </label>
                <label className="inline-flex items-center gap-2" title={t("Used for customers without a list of their own")}>
                  <input type="checkbox" checked={form.defaultList} onChange={(e) => setForm({ ...form, defaultList: e.target.checked })} /> {t("Default for this currency")}
                </label>
              </div>
              <div>
                <label className={LABEL} htmlFor="pl-from">{t("Valid from")}</label>
                <input id="pl-from" type="date" className={INPUT} value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="pl-to">{t("Valid to")}</label>
                <input id="pl-to" type="date" className={INPUT} value={form.validTo} min={form.validFrom || undefined}
                  onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="pl-notes">{t("Notes")}</label>
                <input id="pl-notes" className={INPUT} value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={CARD_TITLE}>{t("Prices")}</span>
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm({ ...form, items: [...form.items, row()] })}>
                  <Plus className="h-4 w-4" /> {t("Add price")}
                </button>
              </div>
              <p className="mb-2 text-xs text-slate-500">{t("Add a product again with a higher from-quantity for a quantity break (e.g. 1 → 40, 100 → 35).")}</p>
              <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Product")}</th>
                      <th className={`${TH} w-32`}>{t("From quantity")}</th>
                      <th className={`${TH} w-40`}>{t("Price")} ({form.currencyCode})</th>
                      <th className={`${TH} w-32`}>{t("Catalogue")}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {form.items.map((item) => {
                      const product = products.find((p) => String(p.id) === item.productId);
                      return (
                        <tr key={item.key}>
                          <td className={TD}>
                            <select className={INPUT} value={item.productId} aria-label={t("Product")}
                              onChange={(e) => {
                                const picked = products.find((p) => String(p.id) === e.target.value);
                                setItem(item.key, { productId: e.target.value, unitPrice: item.unitPrice || String(picked?.sellingPrice ?? "") });
                              }}>
                              <option value="">{t("Select product")}</option>
                              {item.productId && !activeProducts.some((p) => String(p.id) === item.productId) && (
                                <option value={item.productId}>{productName.get(Number(item.productId)) || `#${item.productId}`}</option>
                              )}
                              {activeProducts.map((p) => <option key={p.id} value={String(p.id)}>{`${p.productCode ?? ""} ${p.productName ?? ""}`.trim()}</option>)}
                            </select>
                          </td>
                          <td className={TD}>
                            <input type="number" min="0" step="any" className={INPUT} value={item.minQuantity} aria-label={t("From quantity")}
                              onChange={(e) => setItem(item.key, { minQuantity: e.target.value })} />
                          </td>
                          <td className={TD}>
                            <input type="number" min="0" step="any" className={INPUT} value={item.unitPrice} aria-label={t("Price")}
                              onChange={(e) => setItem(item.key, { unitPrice: e.target.value })} />
                          </td>
                          <td className={`${TD} text-slate-500`}>{product?.sellingPrice != null ? formatMoney(product.sellingPrice) : "—"}</td>
                          <td className={TD}>
                            <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")}
                              onClick={() => setForm({ ...form, items: form.items.filter((i) => i.key !== item.key) })}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className={CARD_TITLE}>{t("Customers on this list")} ({form.customerIds.length})</span>
                <input className={`${INPUT} max-w-xs`} placeholder={t("Search customers")} value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)} />
              </div>
              {form.defaultList && (
                <p className="mb-2 text-xs text-slate-500">{t("As the default list it also prices every customer without a list of their own.")}</p>
              )}
              <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-slate-100 p-2 sm:grid-cols-2 lg:grid-cols-3 dark:border-gray-800">
                {shownCustomers.map((c) => {
                  const other = listOf.get(c.id);
                  const onOther = !!other && !form.customerIds.includes(c.id) && (form.id === null || !(lists ?? []).find((l) => l.id === form.id)?.customerIds.includes(c.id));
                  return (
                    <label key={c.id} className={`flex items-start gap-2 rounded px-2 py-1 text-sm ${onOther ? "text-slate-400" : "text-slate-700 dark:text-gray-200"}`}>
                      <input type="checkbox" disabled={onOther} checked={form.customerIds.includes(c.id)}
                        onChange={(e) => setForm({ ...form, customerIds: e.target.checked ? [...form.customerIds, c.id] : form.customerIds.filter((id) => id !== c.id) })} />
                      <span>
                        {c.customerName || c.customerCode}
                        {onOther && <span className="block text-[11px]">{t("On")} {other}</span>}
                      </span>
                    </label>
                  );
                })}
                {shownCustomers.length === 0 && <p className="px-2 py-1 text-sm text-slate-400">{t("No customers found.")}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm(null)} disabled={saving}>{t("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} onClick={saveList} disabled={saving}>{t(saving ? "Saving..." : "Save")}</button>
            </div>
          </div>
        )}

        {tab === "customer" && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <h2 className={CARD_TITLE}>{t("Customer prices")}</h2>
                <select className={`${INPUT} w-56`} value={customerFilter} aria-label={t("Customer")} onChange={(e) => setCustomerFilter(e.target.value)}>
                  <option value="">{t("All customers")}</option>
                  {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.customerName || c.customerCode}</option>)}
                </select>
              </div>
              {canCreate && !priceForm && (
                <button type="button" className={PRIMARY_BUTTON}
                  onClick={() => setPriceForm({ id: null, customerId: customerFilter, productId: "", currencyCode: companyCurrency(), unitPrice: "", validFrom: "", validTo: "" })}>
                  <Plus className="h-4 w-4" /> {t("Add customer price")}
                </button>
              )}
            </div>
            {priceForm && (
              <div className="grid gap-3 border-b border-slate-100 bg-slate-50/60 p-4 md:grid-cols-4 dark:border-gray-800 dark:bg-[#1d1d1d]">
                <div>
                  <label className={LABEL} htmlFor="cp-customer">{t("Customer")} *</label>
                  <select id="cp-customer" className={INPUT} value={priceForm.customerId} onChange={(e) => setPriceForm({ ...priceForm, customerId: e.target.value })}>
                    <option value="">{t("Choose")}</option>
                    {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.customerName || c.customerCode}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor="cp-product">{t("Product")} *</label>
                  <select id="cp-product" className={INPUT} value={priceForm.productId} onChange={(e) => setPriceForm({ ...priceForm, productId: e.target.value })}>
                    <option value="">{t("Choose")}</option>
                    {activeProducts.map((p) => <option key={p.id} value={String(p.id)}>{`${p.productCode ?? ""} ${p.productName ?? ""}`.trim()}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL} htmlFor="cp-currency">{t("Currency")}</label>
                    <select id="cp-currency" className={INPUT} value={priceForm.currencyCode} onChange={(e) => setPriceForm({ ...priceForm, currencyCode: e.target.value })}>
                      {currencyChoices(priceForm.currencyCode).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="cp-price">{t("Price")} *</label>
                    <input id="cp-price" type="number" min="0" step="any" className={INPUT} value={priceForm.unitPrice}
                      onChange={(e) => setPriceForm({ ...priceForm, unitPrice: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL} htmlFor="cp-from">{t("Valid from")}</label>
                    <input id="cp-from" type="date" className={INPUT} value={priceForm.validFrom} onChange={(e) => setPriceForm({ ...priceForm, validFrom: e.target.value })} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="cp-to">{t("Valid to")}</label>
                    <input id="cp-to" type="date" className={INPUT} value={priceForm.validTo} onChange={(e) => setPriceForm({ ...priceForm, validTo: e.target.value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 md:col-span-4">
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => setPriceForm(null)} disabled={saving}>{t("Cancel")}</button>
                  <button type="button" className={PRIMARY_BUTTON} onClick={savePrice} disabled={saving}>{t(saving ? "Saving..." : "Save")}</button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Customer")}</th>
                    <th className={TH}>{t("Product")}</th>
                    <th className={TH}>{t("Price")}</th>
                    <th className={TH}>{t("Valid")}</th>
                    <th className={TH}>{t("Price list")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {shownPrices.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">{t("No customer prices yet.")}</td></tr>
                  ) : shownPrices.map((p) => (
                    <tr key={p.id}>
                      <td className={TD}>{customerName.get(p.customerId) ?? p.customerName}</td>
                      <td className={TD}>{`${p.productCode ?? ""} ${p.productName ?? ""}`.trim()}</td>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{formatMoney(p.unitPrice, { currency: p.currencyCode })}</td>
                      <td className={`${TD} whitespace-nowrap`}>{validity(p.validFrom, p.validTo)}</td>
                      <td className={`${TD} text-slate-500`}>{listOf.get(p.customerId) ?? "—"}</td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        {canUpdate && (
                          <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")}
                            onClick={() => setPriceForm({ id: p.id, customerId: String(p.customerId), productId: String(p.productId), currencyCode: p.currencyCode,
                              unitPrice: String(p.unitPrice), validFrom: p.validFrom ?? "", validTo: p.validTo ?? "" })}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")} onClick={() => removePrice(p)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
