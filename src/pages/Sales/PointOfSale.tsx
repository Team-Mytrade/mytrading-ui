import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Minus, Plus, Printer, RotateCw, Settings, Trash2, Undo2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import { companyAddressLines, loadCompany } from "../../company/companyApi";
import { companyCurrency, formatDateTime, formatMoney, todayIso } from "../../company/format";
import { currencies } from "../../company/regional";
import { pricingApi } from "../../sales/pricingApi";
import { taxRateFromCode } from "../Purchase/LineItemsEditor";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";

import { t } from "../../i18n/i18n";

const POS = "/v1/api/sales/pos";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const CELL = "w-20 rounded border border-slate-200 bg-white px-2 py-1 text-end text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";
const TILL_KEY = "pos.till";

interface Till { id: number; code: string; name: string; warehouseId: number; walkInCustomerId: number; currencyCode: string; cashAccountId: number | null; cardAccountId: number | null; active: boolean }
interface Shift {
  id: number; tillId: number; status: string; openedAt: string; openedBy: string | null; openingCash: number; closedAt: string | null; expectedCash: number;
  countedCash: number | null; cashDifference: number | null; saleCount: number; invoicesPending: number; cashSales: number; cardSales: number; taxTotal: number; salesTotal: number;
  cashRefunds: number; cardRefunds: number; returnsPending: number;
}
interface ReturnableSale {
  id: number; saleNumber: string; invoiceNumber: string | null; soldAt: string; customerName: string | null; currencyCode: string; status: string;
  lines: { saleLineId: number; productCode: string | null; productName: string | null; quantity: number; lineTotal: number; returnable: number }[];
}
interface PosReturn {
  id: number; returnNumber: string; saleNumber: string; returnedAt: string; returnedBy: string | null; reason: string | null; restock: boolean; refundMethod: string; refundAmount: number;
  currencyCode: string; creditNoteNumber: string | null; status: string; errorMessage: string | null; lines: { productCode: string | null; productName: string | null; quantity: number; amount: number }[];
}
type ReturnForm = { number: string; sale: ReturnableSale | null; quantities: Record<number, string>; reason: string; restock: boolean; method: "CASH" | "CARD"; reference: string };
const blankReturn = (number = ""): ReturnForm => ({ number, sale: null, quantities: {}, reason: "", restock: true, method: "CASH", reference: newReference() });
interface SaleLine { productCode: string | null; productName: string | null; quantity: number; unitPrice: number; discountAmount: number | null; taxRate: number | null; taxAmount: number | null; lineTotal: number }
interface Sale {
  id: number; saleNumber: string; soldAt: string; soldBy: string | null; customerName: string | null; currencyCode: string; invoiceNumber: string | null; status: string; invoiceError: string | null;
  subTotal: number; taxAmount: number; grandTotal: number; cashAmount: number; cardAmount: number; cashTendered: number; changeGiven: number; cardReference: string | null; lines: SaleLine[];
}
interface Product { id: number; productCode?: string; productName?: string; barcode?: string | null; sellingPrice?: number | null; taxCode?: string | null; stockItem?: boolean; active?: boolean; batchTracking?: boolean; serialTracking?: boolean; expiryTracking?: boolean }
interface Named { id: number; name?: string; accountName?: string; customerName?: string; customerCode?: string; active?: boolean }
type CartLine = { key: string; product: Product; quantity: string; unitPrice: string; discount: string; batchNumber: string; serials: string };
type TillForm = { id: number | null; code: string; name: string; warehouseId: string; walkInCustomerId: string; currencyCode: string; cashAccountId: string; cardAccountId: string; active: boolean };

let seq = 0;
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const newReference = () => (crypto.randomUUID ? crypto.randomUUID() : `pos-${Date.now()}-${seq++}`);
const decimalsOf = (currency: string) => {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
};
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** The sales counter: open a shift on a till, sell, take cash or card, print the receipt, count the cash at the end. */
export default function PointOfSale() {
  const currencyList = useMemo(() => currencies(), []);
  const { canCreate, canUpdate, canApprove } = usePermissions("SALES");
  const [returns, setReturns] = useState<PosReturn[]>([]);
  const [returning, setReturning] = useState<ReturnForm | null>(null);
  const [tills, setTills] = useState<Till[] | null>(null);
  const [tillId, setTillId] = useState<number | null>(() => {
    try { return Number(localStorage.getItem(TILL_KEY)) || null; } catch { return null; }
  });
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftLoaded, setShiftLoaded] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Named[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [banks, setBanks] = useState<Named[]>([]);
  const [tillForm, setTillForm] = useState<TillForm | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [closing, setClosing] = useState<{ counted: string; notes: string } | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [cardReference, setCardReference] = useState("");
  const [reference, setReference] = useState(newReference);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const till = tills?.find((x) => x.id === tillId) ?? null;
  const currency = till?.currencyCode ?? companyCurrency();
  const decimals = decimalsOf(currency);
  const round = useCallback((value: number) => Math.round(value * 10 ** decimals) / 10 ** decimals, [decimals]);
  const money = useCallback((value: number | null | undefined) => (value == null ? "—" : formatMoney(value, { currency })), [currency]);

  const loadTills = useCallback(() => {
    axios.get<Till[]>(`${POS}/tills`).then((r) => setTills(asArray<Till>(r.data))).catch((err) => {
      setTills([]);
      ToasterService.error("The tills could not be loaded", errorText(err, "Is the sales service running?"));
    });
  }, []);

  useEffect(() => {
    loadTills();
    axios.get("/v1/api/common/products").then((r) => setProducts(asArray<Product>(r.data).filter((p) => p.active !== false && p.stockItem !== false))).catch(() => setProducts([]));
    axios.get("/v1/api/common/customers").then((r) => setCustomers(asArray<Named>(r.data))).catch(() => setCustomers([]));
    axios.get("/v1/api/inventory/warehouses").then((r) => setWarehouses(asArray<Named>(r.data))).catch(() => setWarehouses([]));
    // Finance's accounts are optional here: a cashier without finance access just uses the company's defaults
    axios.get("/v1/api/invoice/bank-accounts").then((r) => setBanks(asArray<Named>(r.data))).catch(() => setBanks([]));
  }, [loadTills]);

  const loadShift = useCallback(async () => {
    if (!tillId) return;
    try {
      const { data, status } = await axios.get<Shift>(`${POS}/shifts/current`, { params: { tillId } });
      const current = status === 204 || !data ? null : data;
      setShift(current);
      setSales(current ? asArray<Sale>((await axios.get(`${POS}/sales`, { params: { shiftId: current.id } })).data) : []);
      setReturns(current ? asArray<PosReturn>((await axios.get(`${POS}/returns`, { params: { shiftId: current.id } })).data) : []);
    } catch (err) {
      ToasterService.error("The shift could not be loaded", errorText(err, "Please try again."));
    } finally {
      setShiftLoaded(true);
    }
  }, [tillId]);

  useEffect(() => {
    setShiftLoaded(false);
    void loadShift();
    try {
      if (tillId) localStorage.setItem(TILL_KEY, String(tillId));
    } catch { /* only a convenience */ }
  }, [tillId, loadShift]);

  // A remembered till that's gone: choose again; a single till needs no choosing
  useEffect(() => {
    if (!tills) return;
    const usable = tills.filter((x) => x.active);
    if (tillId && !usable.some((x) => x.id === tillId)) setTillId(usable.length === 1 ? usable[0].id : null);
    else if (!tillId && usable.length === 1) setTillId(usable[0].id);
  }, [tills, tillId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => [p.productCode, p.productName, p.barcode].some((v) => String(v ?? "").toLowerCase().includes(q))).slice(0, 8);
  }, [search, products]);

  const addProduct = async (product: Product) => {
    setSearch("");
    searchRef.current?.focus();
    const existing = cart.find((l) => l.product.id === product.id);
    if (existing && !product.serialTracking) {
      setCart((c) => c.map((l) => (l.key === existing.key ? { ...l, quantity: String(Number(l.quantity) + 1) } : l)));
      return;
    }
    if (existing) {
      ToasterService.error("This item is already on the sale; add its serial numbers there.");
      return;
    }
    const key = `c${seq++}`;
    const price = product.sellingPrice != null ? String(product.sellingPrice) : "";
    setCart((c) => [...c, { key, product, quantity: "1", unitPrice: price, discount: "", batchNumber: "", serials: "" }]);
    // The customer's or price list's price, when there is one
    const customer = Number(customerId) || till?.walkInCustomerId || null;
    try {
      const [line] = await pricingApi.prices(customer, currency, todayIso(), [{ productId: product.id, quantity: 1 }]);
      if (line?.unitPrice != null) setCart((c) => c.map((l) => (l.key === key ? { ...l, unitPrice: String(line.unitPrice) } : l)));
    } catch { /* the catalogue price stays */ }
  };

  // A barcode scanner types the code and presses Enter
  const onSearchKey = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const q = search.trim().toLowerCase();
    const exact = products.find((p) => [p.barcode, p.productCode].some((v) => String(v ?? "").toLowerCase() === q));
    if (exact) void addProduct(exact);
    else if (matches.length === 1) void addProduct(matches[0]);
    else if (q) ToasterService.error("No product with that barcode or code.");
  };

  const setLine = (key: string, patch: Partial<CartLine>) => setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const lineAmounts = useCallback((line: CartLine) => {
    const gross = round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
    const taxable = Math.max(0, round(gross - (Number(line.discount) || 0)));
    const rate = taxRateFromCode(line.product.taxCode) ?? 0;
    const tax = round((taxable * rate) / 100);
    return { taxable, rate, tax, total: round(taxable + tax) };
  }, [round]);

  const totals = useMemo(() => {
    const rows = cart.map(lineAmounts);
    const subTotal = round(rows.reduce((s, r) => s + r.taxable, 0));
    const tax = round(rows.reduce((s, r) => s + r.tax, 0));
    return { subTotal, tax, total: round(subTotal + tax) };
  }, [cart, lineAmounts, round]);

  const cardAmount = Number(card) || 0;
  const cashDue = round(Math.max(0, totals.total - cardAmount));
  const tendered = Number(cash) || 0;
  const change = round(Math.max(0, tendered - cashDue));
  const short = round(Math.max(0, cashDue - tendered));

  const resetSale = () => {
    setCart([]);
    setCash("");
    setCard("");
    setCardReference("");
    setCustomerId("");
    setReference(newReference());
    searchRef.current?.focus();
  };

  const complete = async () => {
    if (!shift || cart.length === 0) return;
    if (cart.some((l) => !(Number(l.quantity) > 0) || l.unitPrice === "" || Number(l.unitPrice) < 0)) {
      ToasterService.error("Each item needs a quantity and a price.");
      return;
    }
    const noSerials = cart.find((l) => l.product.serialTracking && l.serials.split(/[\s,]+/).filter(Boolean).length !== Number(l.quantity));
    if (noSerials) {
      ToasterService.error(t("{product}: enter one serial number per unit.", { product: noSerials.product.productCode ?? "" }));
      return;
    }
    const noBatch = cart.find((l) => (l.product.batchTracking || l.product.expiryTracking) && !l.batchNumber.trim());
    if (noBatch) {
      ToasterService.error(t("{product}: enter the batch number.", { product: noBatch.product.productCode ?? "" }));
      return;
    }
    if (short > 0) {
      ToasterService.error(t("The payment is {amount} short.", { amount: money(short) }));
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post<Sale>(`${POS}/sales`, {
        clientReference: reference, shiftId: shift.id, customerId: customerId ? Number(customerId) : null,
        cashTendered: tendered, cardAmount, cardReference: cardReference.trim() || null,
        lines: cart.map((l) => ({
          productId: l.product.id, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discountAmount: Number(l.discount) || null,
          taxCode: l.product.taxCode ?? null, taxRate: lineAmounts(l).rate, batchNumber: l.batchNumber.trim() || null,
          serialNumbers: l.serials.split(/[\s,]+/).filter(Boolean),
        })),
      });
      setLastSale(data);
      if (data.status === "COMPLETED") ToasterService.success(`${data.saleNumber}: ${t("sale complete")}.`);
      else ToasterService.error(t("The goods are sold but the invoice is pending. Retry it from the shift's sales."), data.invoiceError ?? undefined);
      resetSale();
      await loadShift();
    } catch (err) {
      ToasterService.error("The sale could not be completed", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const retry = async (sale: Sale) => {
    try {
      const { data } = await axios.post<Sale>(`${POS}/sales/${sale.id}/retry-invoice`);
      if (data.status === "COMPLETED") ToasterService.success(`${data.saleNumber}: ${data.invoiceNumber}`);
      else ToasterService.error("The invoice could not be made yet", data.invoiceError ?? undefined);
      await loadShift();
    } catch (err) {
      ToasterService.error("The invoice could not be made yet", errorText(err, "Please try again."));
    }
  };

  const findSale = async (number: string) => {
    if (!number.trim()) return;
    try {
      const { data } = await axios.get<ReturnableSale>(`${POS}/sales/lookup`, { params: { number: number.trim() } });
      setReturning({ ...blankReturn(number.trim()), sale: data });
    } catch (err) {
      ToasterService.error("That receipt could not be found", errorText(err, "Check the number."));
    }
  };

  const returnValue = (form: ReturnForm) =>
    round((form.sale?.lines ?? []).reduce((sum, l) => sum + (l.lineTotal / l.quantity) * (Number(form.quantities[l.saleLineId]) || 0), 0));

  const submitReturn = async () => {
    if (!shift || !returning?.sale) return;
    const lines = returning.sale.lines.map((l) => ({ saleLineId: l.saleLineId, quantity: Number(returning.quantities[l.saleLineId]) || 0 })).filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      ToasterService.error("Enter how many are coming back.");
      return;
    }
    if (lines.some((l) => !Number.isInteger(l.quantity))) {
      ToasterService.error("Returns are in whole units.");
      return;
    }
    if (!returning.reason.trim()) {
      ToasterService.error("Enter why the goods came back.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post<PosReturn>(`${POS}/returns`, {
        clientReference: returning.reference, saleId: returning.sale.id, shiftId: shift.id, refundMethod: returning.method,
        reason: returning.reason.trim(), restock: returning.restock, lines,
      });
      if (data.status === "COMPLETED") ToasterService.success(`${data.returnNumber}: ${t("refund")} ${money(data.refundAmount)}`);
      else ToasterService.error("The return isn't finished. Retry it from the shift's returns.", data.errorMessage ?? undefined);
      setReturning(null);
      await loadShift();
    } catch (err) {
      ToasterService.error("The return could not be made", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const retryReturn = async (item: PosReturn) => {
    try {
      const { data } = await axios.post<PosReturn>(`${POS}/returns/${item.id}/retry`);
      if (data.status === "COMPLETED") ToasterService.success(`${data.returnNumber}: ${t("finished")}`);
      else ToasterService.error("The return isn't finished. Retry it from the shift's returns.", data.errorMessage ?? undefined);
      await loadShift();
    } catch (err) {
      ToasterService.error("The return could not be made", errorText(err, "Please try again."));
    }
  };

  const openShift = async () => {
    if (!tillId) return;
    setBusy(true);
    try {
      await axios.post(`${POS}/shifts`, { tillId, openingCash: Number(openingCash) || 0 });
      setOpeningCash("");
      await loadShift();
    } catch (err) {
      ToasterService.error("The shift could not be opened", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const closeShift = async () => {
    if (!shift || !closing) return;
    if (closing.counted === "") {
      ToasterService.error("Enter the cash counted in the till.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post<Shift>(`${POS}/shifts/${shift.id}/close`, { countedCash: Number(closing.counted), notes: closing.notes || null });
      const difference = Number(data.cashDifference);
      ToasterService.success(difference === 0 ? t("Shift closed. The cash matches.")
        : t("Shift closed. Cash is {state} by {amount}.", { state: t(difference < 0 ? "short" : "over"), amount: money(Math.abs(difference)) }));
      setClosing(null);
      setLastSale(null);
      await loadShift();
    } catch (err) {
      ToasterService.error("The shift could not be closed", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const saveTill = async () => {
    if (!tillForm) return;
    if (!tillForm.code.trim() || !tillForm.name.trim() || !tillForm.warehouseId || !tillForm.walkInCustomerId) {
      ToasterService.error("Enter the code and name, and choose the warehouse and walk-in customer.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        code: tillForm.code, name: tillForm.name, warehouseId: Number(tillForm.warehouseId), walkInCustomerId: Number(tillForm.walkInCustomerId), currencyCode: tillForm.currencyCode,
        cashAccountId: tillForm.cashAccountId ? Number(tillForm.cashAccountId) : null, cardAccountId: tillForm.cardAccountId ? Number(tillForm.cardAccountId) : null, active: tillForm.active,
      };
      const { data } = await (tillForm.id ? axios.put<Till>(`${POS}/tills/${tillForm.id}`, body) : axios.post<Till>(`${POS}/tills`, body));
      setTillForm(null);
      setTillId(data.id);
      loadTills();
    } catch (err) {
      ToasterService.error("The till could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const printReceipt = async (sale: Sale) => {
    const company = await loadCompany().catch(() => null);
    const line = (label: string, value: string, strong = false) => `<tr${strong ? ' class="b"' : ""}><td>${escapeHtml(label)}</td><td class="r">${escapeHtml(value)}</td></tr>`;
    const amount = (value: number | null) => formatMoney(value ?? 0, { currency: sale.currencyCode });
    const taxNumber = company?.taxRegime === "VAT" ? company?.taxNumber : company?.gstin;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.saleNumber)}</title><style>
      body{font:12px monospace;width:72mm;margin:0 auto;padding:4mm}h1{font-size:14px;text-align:center;margin:0}p{margin:2px 0;text-align:center}
      table{width:100%;border-collapse:collapse;margin-top:6px}td{padding:1px 0;vertical-align:top}.r{text-align:right;white-space:nowrap}.b td{font-weight:bold;border-top:1px dashed #000}
      @media print{@page{margin:0;size:80mm auto}}</style></head><body>
      <h1>${escapeHtml(company?.legalName || company?.companyName || "")}</h1>
      <p>${escapeHtml(company ? companyAddressLines(company).join(", ") : "")}</p>
      ${taxNumber ? `<p>${company?.taxRegime === "VAT" ? "TRN" : "GSTIN"}: ${escapeHtml(taxNumber)}</p>` : ""}
      <p><b>${company?.taxRegime === "VAT" ? "SIMPLIFIED TAX INVOICE" : "RECEIPT"}</b></p>
      <p>${escapeHtml(sale.invoiceNumber ?? sale.saleNumber)} · ${escapeHtml(formatDateTime(sale.soldAt))}</p>
      <p>${escapeHtml(sale.saleNumber)}${sale.soldBy ? ` · ${escapeHtml(sale.soldBy)}` : ""}</p>
      <table>${sale.lines.map((l) => `<tr><td colspan="2">${escapeHtml(l.productName ?? l.productCode)}</td></tr>
        <tr><td>${Number(l.quantity)} x ${escapeHtml(amount(l.unitPrice))}${Number(l.discountAmount) ? ` - ${escapeHtml(amount(l.discountAmount))}` : ""}${l.taxRate != null ? ` (${Number(l.taxRate)}%)` : ""}</td><td class="r">${escapeHtml(amount(l.lineTotal))}</td></tr>`).join("")}</table>
      <table>${line("Subtotal", amount(sale.subTotal), true)}${line(company?.taxRegime === "GST" ? "GST" : "VAT", amount(sale.taxAmount))}${line("Total", amount(sale.grandTotal), true)}
      ${sale.cashAmount ? line("Cash", amount(sale.cashTendered)) : ""}${sale.cardAmount ? line("Card", amount(sale.cardAmount)) : ""}${sale.changeGiven ? line("Change", amount(sale.changeGiven)) : ""}</table>
      <p style="margin-top:8px">Thank you</p></body></html>`;
    const win = window.open("", "_blank", "width=340,height=600");
    if (!win) {
      ToasterService.error("Allow pop-ups to print the receipt.");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const newTillForm = (): TillForm => ({
    id: null, code: "", name: "", warehouseId: "", walkInCustomerId: "", currencyCode: companyCurrency(), cashAccountId: "", cardAccountId: "", active: true,
  });
  const nameOf = (n: Named) => n.name ?? n.accountName ?? n.customerName ?? String(n.id);

  return (
    <>
      <PageMeta title={t("Point of Sale")} description="Sell at the counter" />
      <PageBreadcrumb pageTitle="Point of Sale" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <select className={`${INPUT} w-56`} aria-label={t("Till")} value={tillId ?? ""} onChange={(e) => setTillId(Number(e.target.value) || null)}>
              <option value="">{t("Choose a till")}</option>
              {(tills ?? []).filter((x) => x.active || x.id === tillId).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
            </select>
            {canUpdate && till && (
              <button type="button" className={ROW_ICON_BUTTON} title={t("Till settings")} aria-label={t("Till settings")}
                onClick={() => setTillForm({ id: till.id, code: till.code, name: till.name, warehouseId: String(till.warehouseId), walkInCustomerId: String(till.walkInCustomerId), currencyCode: till.currencyCode,
                  cashAccountId: till.cashAccountId ? String(till.cashAccountId) : "", cardAccountId: till.cardAccountId ? String(till.cardAccountId) : "", active: till.active })}>
                <Settings className="h-4 w-4" />
              </button>
            )}
            {canCreate && <button type="button" className={SECONDARY_BUTTON} onClick={() => setTillForm(newTillForm())}><Plus className="h-4 w-4" /> {t("New till")}</button>}
          </div>
          {shift && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-gray-300">
              <span>{t("Sales")}: <b>{shift.saleCount}</b> · <b>{money(shift.salesTotal)}</b></span>
              <span>{t("Cash")}: <b>{money(shift.cashSales)}</b></span>
              <span>{t("Card")}: <b>{money(shift.cardSales)}</b></span>
              {(Number(shift.cashRefunds) > 0 || Number(shift.cardRefunds) > 0) && <span>{t("Refunds")}: <b>{money(Number(shift.cashRefunds) + Number(shift.cardRefunds))}</b></span>}
              {canApprove && !returning && <button type="button" className={SECONDARY_BUTTON} onClick={() => setReturning(blankReturn())}><Undo2 className="h-4 w-4" /> {t("Return")}</button>}
              {canCreate && !closing && <button type="button" className={SECONDARY_BUTTON} onClick={() => setClosing({ counted: "", notes: "" })}>{t("Close shift")}</button>}
            </div>
          )}
        </div>

        {tillForm && (
          <div className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{tillForm.id ? t("Till settings") : t("New till")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div><label className={LABEL} htmlFor="till-code">{t("Code")}</label><input id="till-code" className={INPUT} value={tillForm.code} maxLength={30} onChange={(e) => setTillForm({ ...tillForm, code: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="till-name">{t("Name")}</label><input id="till-name" className={INPUT} value={tillForm.name} maxLength={150} onChange={(e) => setTillForm({ ...tillForm, name: e.target.value })} /></div>
              <div><label className={LABEL} htmlFor="till-cur">{t("Currency")}</label><select id="till-cur" className={INPUT} value={tillForm.currencyCode} onChange={(e) => setTillForm({ ...tillForm, currencyCode: e.target.value })}>
                {!currencyList.some((c) => c.code === tillForm.currencyCode) && <option value={tillForm.currencyCode}>{tillForm.currencyCode}</option>}
                {currencyList.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
              </select></div>
              <div>
                <label className={LABEL} htmlFor="till-wh">{t("Sells from warehouse")}</label>
                <select id="till-wh" className={INPUT} value={tillForm.warehouseId} onChange={(e) => setTillForm({ ...tillForm, warehouseId: e.target.value })}>
                  <option value="">—</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{nameOf(w)}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="till-cust">{t("Walk-in customer")}</label>
                <select id="till-cust" className={INPUT} value={tillForm.walkInCustomerId} onChange={(e) => setTillForm({ ...tillForm, walkInCustomerId: e.target.value })}>
                  <option value="">—</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{nameOf(c)}</option>)}
                </select>
              </div>
              <div />
              <div>
                <label className={LABEL} htmlFor="till-cash">{t("Cash goes to")}</label>
                <select id="till-cash" className={INPUT} value={tillForm.cashAccountId} onChange={(e) => setTillForm({ ...tillForm, cashAccountId: e.target.value })}>
                  <option value="">{t("Company default")}</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{nameOf(b)}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="till-card">{t("Card goes to")}</label>
                <select id="till-card" className={INPUT} value={tillForm.cardAccountId} onChange={(e) => setTillForm({ ...tillForm, cardAccountId: e.target.value })}>
                  <option value="">{t("Company default")}</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{nameOf(b)}</option>)}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-gray-200">
                <input type="checkbox" checked={tillForm.active} onChange={(e) => setTillForm({ ...tillForm, active: e.target.checked })} /> {t("Active")}
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setTillForm(null)}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={saveTill}>{t("Save")}</button>
            </div>
          </div>
        )}

        {closing && shift && (
          <div className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t("Close shift")}</h2>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-4 dark:text-gray-200">
              <div><span className={LABEL}>{t("Float at the start")}</span>{money(shift.openingCash)}</div>
              <div><span className={LABEL}>{t("Cash sales")}</span>{money(shift.cashSales)}</div>
              <div><span className={LABEL}>{t("Cash refunds")}</span>{money(shift.cashRefunds)}</div>
              <div><span className={LABEL}>{t("Tax collected")}</span>{money(shift.taxTotal)}</div>
              <div><span className={LABEL}>{t("Opened")}</span>{formatDateTime(shift.openedAt)} · {shift.openedBy}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div><label className={LABEL} htmlFor="close-count">{t("Cash counted")}</label><input id="close-count" type="number" min="0" step="any" className={INPUT} value={closing.counted} onChange={(e) => setClosing({ ...closing, counted: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={LABEL} htmlFor="close-notes">{t("Notes")}</label><input id="close-notes" className={INPUT} value={closing.notes} maxLength={500} onChange={(e) => setClosing({ ...closing, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setClosing(null)}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={closeShift}>{t("Close shift")}</button>
            </div>
          </div>
        )}

        {returning && shift && (
          <div className={`${CARD} space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t("Return goods")}</h2>
            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void findSale(returning.number); }}>
              <div className="min-w-64"><label className={LABEL} htmlFor="ret-number">{t("Receipt or invoice number")}</label><input id="ret-number" autoFocus className={INPUT} value={returning.number} onChange={(e) => setReturning({ ...returning, number: e.target.value })} /></div>
              <button type="submit" className={SECONDARY_BUTTON}>{t("Find")}</button>
            </form>
            {returning.sale && (
              <>
                <p className="text-sm text-slate-600 dark:text-gray-300">{returning.sale.saleNumber}{returning.sale.invoiceNumber ? ` · ${returning.sale.invoiceNumber}` : ""} · {formatDateTime(returning.sale.soldAt)} · {returning.sale.customerName}</p>
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr><th className={TH}>{t("Item")}</th><th className={`${TH} text-end`}>{t("Sold")}</th><th className={`${TH} text-end`}>{t("Can come back")}</th><th className={`${TH} text-end`}>{t("Paid")}</th><th className={TH}>{t("Coming back")}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {returning.sale.lines.map((l) => (
                        <tr key={l.saleLineId}>
                          <td className={TD}>{l.productCode} · {l.productName}</td>
                          <td className={`${TD} text-end`}>{Number(l.quantity)}</td>
                          <td className={`${TD} text-end`}>{l.returnable}</td>
                          <td className={`${TD} text-end`}>{money(l.lineTotal)}</td>
                          <td className={TD}><input type="number" min="0" max={l.returnable} step="1" disabled={l.returnable <= 0} className={CELL} aria-label={t("Coming back")} value={returning.quantities[l.saleLineId] ?? ""} onChange={(e) => setReturning({ ...returning, quantities: { ...returning.quantities, [l.saleLineId]: e.target.value } })} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><label className={LABEL} htmlFor="ret-reason">{t("Reason")}</label><input id="ret-reason" className={INPUT} value={returning.reason} maxLength={200} onChange={(e) => setReturning({ ...returning, reason: e.target.value })} /></div>
                  <div>
                    <label className={LABEL} htmlFor="ret-method">{t("Refund by")}</label>
                    <select id="ret-method" className={INPUT} value={returning.method} onChange={(e) => setReturning({ ...returning, method: e.target.value as "CASH" | "CARD" })}>
                      <option value="CASH">{t("Cash")}</option>
                      <option value="CARD">{t("Card")}</option>
                    </select>
                  </div>
                  <label className="inline-flex items-center gap-2 self-end pb-2 text-sm text-slate-700 dark:text-gray-200">
                    <input type="checkbox" checked={returning.restock} onChange={(e) => setReturning({ ...returning, restock: e.target.checked })} /> {t("Goods can be sold again (back into stock)")}
                  </label>
                </div>
              </>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {returning.sale && <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">{t("Refund")}: {money(returnValue(returning))}</span>}
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setReturning(null)}>{t("Close")}</button>
              {returning.sale && <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={submitReturn}>{t("Make the return")}</button>}
            </div>
          </div>
        )}

        {tills !== null && tills.length === 0 && !tillForm && (
          <div className={`${CARD} p-8 text-center text-sm text-slate-500`}>{t("Set up a till first: its warehouse and its customer for walk-in sales.")}</div>
        )}

        {till && shiftLoaded && !shift && (
          <div className={`${CARD} mx-auto max-w-md space-y-3 p-6`}>
            <h2 className={CARD_TITLE}>{t("Open a shift on {till}", { till: till.name })}</h2>
            <div><label className={LABEL} htmlFor="open-cash">{t("Cash in the till at the start")}</label><input id="open-cash" type="number" min="0" step="any" className={INPUT} value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} /></div>
            {canCreate && <button type="button" className={`${PRIMARY_BUTTON} w-full justify-center`} disabled={busy} onClick={openShift}>{t("Open shift")}</button>}
          </div>
        )}

        {shift && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={`${CARD} space-y-3 p-4 lg:col-span-2`}>
              <div className="relative">
                <input ref={searchRef} autoFocus className={INPUT} placeholder={t("Scan a barcode, or search by code or name")} aria-label={t("Find a product")}
                  value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchKey} />
                {matches.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-gray-700 dark:bg-[#222222]">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button type="button" className="flex w-full justify-between px-3 py-2 text-start text-sm text-slate-700 hover:bg-cyan-50 dark:text-gray-200 dark:hover:bg-gray-800" onClick={() => void addProduct(p)}>
                          <span>{p.productCode} · {p.productName}</span>
                          <span className="text-slate-500">{p.sellingPrice != null ? money(p.sellingPrice) : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={TH}>{t("Item")}</th>
                      <th className={TH}>{t("Qty")}</th>
                      <th className={TH}>{t("Price")}</th>
                      <th className={TH}>{t("Discount")}</th>
                      <th className={`${TH} text-end`}>{t("Tax")}</th>
                      <th className={`${TH} text-end`}>{t("Total")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {cart.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-400">{t("Scan or search for the first item.")}</td></tr>}
                    {cart.map((l) => {
                      const a = lineAmounts(l);
                      return (
                        <tr key={l.key}>
                          <td className={TD}>
                            <div className="font-medium">{l.product.productName}</div>
                            <div className="text-xs text-slate-500">{l.product.productCode}</div>
                            {(l.product.batchTracking || l.product.expiryTracking) && (
                              <input className={`${INPUT} mt-1`} placeholder={t("Batch number")} aria-label={t("Batch number")} value={l.batchNumber} onChange={(e) => setLine(l.key, { batchNumber: e.target.value })} />
                            )}
                            {l.product.serialTracking && (
                              <input className={`${INPUT} mt-1`} placeholder={t("Serial numbers, separated by spaces")} aria-label={t("Serial numbers")} value={l.serials} onChange={(e) => setLine(l.key, { serials: e.target.value })} />
                            )}
                          </td>
                          <td className={TD}>
                            <div className="flex items-center gap-1">
                              <button type="button" className={ROW_ICON_BUTTON} aria-label={t("Less")} onClick={() => setLine(l.key, { quantity: String(Math.max(1, Number(l.quantity) - 1)) })}><Minus className="h-3.5 w-3.5" /></button>
                              <input type="number" min="0" step="any" className={CELL} aria-label={t("Quantity")} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                              <button type="button" className={ROW_ICON_BUTTON} aria-label={t("More")} onClick={() => setLine(l.key, { quantity: String(Number(l.quantity) + 1) })}><Plus className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                          <td className={TD}><input type="number" min="0" step="any" className={CELL} aria-label={t("Price")} value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} /></td>
                          <td className={TD}><input type="number" min="0" step="any" className={CELL} aria-label={t("Discount")} value={l.discount} onChange={(e) => setLine(l.key, { discount: e.target.value })} /></td>
                          <td className={`${TD} whitespace-nowrap text-end`}>{money(a.tax)}<div className="text-xs text-slate-500">{a.rate}%</div></td>
                          <td className={`${TD} whitespace-nowrap text-end font-medium`}>{money(a.total)}</td>
                          <td className={TD}><button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")} onClick={() => setCart((c) => c.filter((x) => x.key !== l.key))}><Trash2 className="h-4 w-4" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${CARD} space-y-3 p-4`}>
              <div>
                <label className={LABEL} htmlFor="pos-customer">{t("Customer")}</label>
                <select id="pos-customer" className={INPUT} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t("Walk-in")}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{nameOf(c)}</option>)}
                </select>
              </div>
              <dl className="space-y-1 border-y border-slate-100 py-3 text-sm text-slate-700 dark:border-gray-800 dark:text-gray-200">
                <div className="flex justify-between"><dt>{t("Subtotal")}</dt><dd>{money(totals.subTotal)}</dd></div>
                <div className="flex justify-between"><dt>{t("Tax")}</dt><dd>{money(totals.tax)}</dd></div>
                <div className="flex justify-between text-xl font-bold text-slate-900 dark:text-white"><dt>{t("Total")}</dt><dd>{money(totals.total)}</dd></div>
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={LABEL} htmlFor="pos-card">{t("Card")}</label><input id="pos-card" type="number" min="0" step="any" className={INPUT} value={card} onChange={(e) => setCard(e.target.value)} /></div>
                <div><label className={LABEL} htmlFor="pos-auth">{t("Card reference")}</label><input id="pos-auth" className={INPUT} value={cardReference} maxLength={100} onChange={(e) => setCardReference(e.target.value)} /></div>
              </div>
              <div>
                <label className={LABEL} htmlFor="pos-cash">{t("Cash received")}</label>
                <input id="pos-cash" type="number" min="0" step="any" className={INPUT} value={cash} onChange={(e) => setCash(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON} disabled={cart.length === 0} onClick={() => setCash(String(cashDue))}>{t("Exact cash")}</button>
                <button type="button" className={SECONDARY_BUTTON} disabled={cart.length === 0} onClick={() => { setCard(String(totals.total)); setCash(""); }}>{t("All on card")}</button>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span className="text-slate-600 dark:text-gray-300">{t(short > 0 ? "Still to pay" : "Change")}</span>
                <span className={short > 0 ? "text-rose-600" : "text-emerald-700"}>{money(short > 0 ? short : change)}</span>
              </div>
              {canCreate && (
                <button type="button" className={`${PRIMARY_BUTTON} w-full justify-center`} disabled={busy || cart.length === 0 || short > 0} onClick={complete}>
                  {t(busy ? "Working..." : "Complete sale")}
                </button>
              )}
              {cart.length > 0 && <button type="button" className={`${SECONDARY_BUTTON} w-full justify-center`} disabled={busy} onClick={resetSale}>{t("Clear the sale")}</button>}
              {lastSale && (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <div className="font-semibold">{lastSale.saleNumber}{lastSale.invoiceNumber ? ` · ${lastSale.invoiceNumber}` : ""}</div>
                  <div>{t("Change")}: {money(lastSale.changeGiven)}</div>
                  <button type="button" className={`${SECONDARY_BUTTON} mt-2`} onClick={() => void printReceipt(lastSale)}><Printer className="h-4 w-4" /> {t("Print receipt")}</button>
                </div>
              )}
            </div>

            {sales.length > 0 && (
              <div className={`${CARD} overflow-hidden lg:col-span-3`}>
                <h3 className={`${CARD_TITLE} border-b border-slate-100 px-4 py-3 dark:border-gray-800`}>{t("This shift's sales")}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr>
                        <th className={TH}>{t("Sale")}</th>
                        <th className={TH}>{t("Time")}</th>
                        <th className={TH}>{t("Customer")}</th>
                        <th className={TH}>{t("Invoice")}</th>
                        <th className={`${TH} text-end`}>{t("Cash")}</th>
                        <th className={`${TH} text-end`}>{t("Card")}</th>
                        <th className={`${TH} text-end`}>{t("Total")}</th>
                        <th className={TH} aria-label={t("Actions")} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {sales.map((s) => (
                        <tr key={s.id}>
                          <td className={`${TD} font-medium`}>{s.saleNumber}</td>
                          <td className={`${TD} whitespace-nowrap`}>{formatDateTime(s.soldAt)}</td>
                          <td className={TD}>{s.customerName}</td>
                          <td className={TD}>{s.invoiceNumber ?? <span className="text-xs font-semibold text-rose-600" title={s.invoiceError ?? ""}>{t("Invoice pending")}</span>}</td>
                          <td className={`${TD} text-end`}>{money(s.cashAmount)}</td>
                          <td className={`${TD} text-end`}>{money(s.cardAmount)}</td>
                          <td className={`${TD} text-end font-medium`}>{money(s.grandTotal)}</td>
                          <td className={`${TD} whitespace-nowrap text-end`}>
                            {s.status !== "COMPLETED" && canCreate && <button type="button" className={ROW_ICON_BUTTON} title={t("Retry the invoice")} aria-label={t("Retry the invoice")} onClick={() => void retry(s)}><RotateCw className="h-4 w-4" /></button>}
                            <button type="button" className={ROW_ICON_BUTTON} title={t("Print receipt")} aria-label={t("Print receipt")} onClick={() => void printReceipt(s)}><Printer className="h-4 w-4" /></button>
                            {s.status === "COMPLETED" && canApprove && <button type="button" className={ROW_ICON_BUTTON} title={t("Return")} aria-label={t("Return")} onClick={() => void findSale(s.saleNumber)}><Undo2 className="h-4 w-4" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {returns.length > 0 && (
              <div className={`${CARD} overflow-hidden lg:col-span-3`}>
                <h3 className={`${CARD_TITLE} border-b border-slate-100 px-4 py-3 dark:border-gray-800`}>{t("This shift's returns")}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                    <thead className="bg-slate-50 dark:bg-[#222222]">
                      <tr><th className={TH}>{t("Return")}</th><th className={TH}>{t("Sale")}</th><th className={TH}>{t("Reason")}</th><th className={TH}>{t("Credit note")}</th><th className={TH}>{t("Refund by")}</th><th className={`${TH} text-end`}>{t("Refund")}</th><th className={TH} aria-label={t("Actions")} /></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                      {returns.map((r) => (
                        <tr key={r.id}>
                          <td className={`${TD} font-medium`}>{r.returnNumber}</td>
                          <td className={TD}>{r.saleNumber}</td>
                          <td className={TD}>{r.reason}{!r.restock && <span className="ms-2 text-xs text-amber-600">{t("Not restocked")}</span>}</td>
                          <td className={TD}>{r.creditNoteNumber ?? "—"}</td>
                          <td className={TD}>{t(r.refundMethod === "CASH" ? "Cash" : "Card")}</td>
                          <td className={`${TD} text-end font-medium`}>{money(r.refundAmount)}</td>
                          <td className={`${TD} whitespace-nowrap text-end`}>
                            {r.status !== "COMPLETED" && (
                              <button type="button" className={ROW_ICON_BUTTON} title={r.errorMessage ?? t("Retry the return")} aria-label={t("Retry the return")} onClick={() => void retryReturn(r)}><RotateCw className="h-4 w-4 text-rose-600" /></button>
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
        )}
      </div>
    </>
  );
}
