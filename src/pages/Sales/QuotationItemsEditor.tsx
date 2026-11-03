import { useCallback, useEffect, useMemo, useRef } from "react";
import SearchableSelect, { SearchableOption } from "../../components/inputfeild/SearchableSelect";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { allowsFraction, cellInput, NumberCell, taxRateFromCode } from "../Purchase/LineItemsEditor";
import { formatMoney, companyCurrency, moneyDecimals, roundMoney } from "../../company/format";
import { PriceSource, pricingApi } from "../../sales/pricingApi";

import { t } from "../../i18n/i18n";
/** One quotation line as edited on screen. Discount is a % of the line value, tax a % of what is left. */
export type QuotationLine = {
  /** Stable React key (new lines have no id yet). */
  key: string;
  id?: number;
  itemType: "PRODUCT" | "SERVICE";
  productId?: number;
  categoryId?: number;
  categoryName: string;
  productName: string;
  productCode: string;
  description: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxRate: number;
  taxCode: string;
  remarks: string;
  /** The rate came from pricing (not typed): it follows the customer, currency and quantity breaks. */
  priceAuto?: boolean;
  priceSource?: PriceSource;
  priceListName?: string;
};

export type QuotationProduct = {
  id: number;
  productName: string;
  productCode?: string;
  shortName?: string;
  description?: string;
  uom?: string;
  sellingPrice?: number;
  standardCost?: number;
  taxCode?: string;
  categoryId?: number;
  categoryName?: string;
  category?: { id?: number; categoryName?: string };
  active?: boolean;
};

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

// currency: the quotation's (the company's when not given); amounts round to its decimals, as the server does
export const formatPrice = (value: number, currency?: string | null) => formatMoney(num(value), { currency });

/** Same arithmetic as the Sales service, so the screen shows what will be saved. */
export const lineAmounts = (line: QuotationLine, currency?: string | null) => {
  const round = (value: number) => roundMoney(value, currency);
  const gross = round(num(line.quantity) * num(line.unitPrice));
  const discount = Math.min(gross, round((gross * num(line.discountPercentage)) / 100));
  const taxable = gross - discount;
  const tax = round((taxable * num(line.taxRate)) / 100);
  return { gross, discount, taxable, tax, total: round(taxable + tax) };
};

/** Additional discount is an amount taken off the taxable total of the whole quotation (tax stays as is). */
export const quotationTotals = (lines: QuotationLine[], additionalDiscount: number, currency?: string | null) => {
  const round2 = (value: number) => roundMoney(value, currency);
  const sums = lines.map((line) => lineAmounts(line, currency)).reduce(
    (acc, line) => ({
      subTotal: acc.subTotal + line.gross,
      discount: acc.discount + line.discount,
      taxable: acc.taxable + line.taxable,
      tax: acc.tax + line.tax,
    }),
    { subTotal: 0, discount: 0, taxable: 0, tax: 0 }
  );
  const extra = Math.min(Math.max(0, num(additionalDiscount)), sums.taxable);
  return {
    subTotal: round2(sums.subTotal),
    discount: round2(sums.discount),
    tax: round2(sums.tax),
    additionalDiscount: round2(extra),
    grandTotal: round2(sums.taxable - extra + sums.tax),
  };
};

let keySequence = 0;
export const blankLine = (itemType: QuotationLine["itemType"] = "PRODUCT"): QuotationLine => ({
  key: `line-${Date.now()}-${keySequence++}`,
  itemType,
  categoryName: "",
  productName: "",
  productCode: "",
  description: "",
  uom: "",
  quantity: 1,
  unitPrice: 0,
  discountPercentage: 0,
  taxRate: 0,
  taxCode: "",
  remarks: "",
});

/** A catalogue product's code, name, unit, price and tax % as line fields. */
export const productLinePatch = (product: QuotationProduct | undefined, taxRate = 0): Partial<QuotationLine> => ({
  productId: product?.id,
  productName: product?.productName || "",
  productCode: product?.productCode || "",
  description: product?.description || "",
  uom: product?.uom || "",
  categoryId: product?.category?.id ?? product?.categoryId,
  categoryName: product?.category?.categoryName || product?.categoryName || "",
  unitPrice: num(product?.sellingPrice ?? product?.standardCost),
  taxCode: product?.taxCode || "",
  taxRate: taxRateFromCode(product?.taxCode) ?? taxRate,
});

/** What is wrong with a line, or null. Shown under the line once the user has tried to save. */
export const lineError = (line: QuotationLine): string | null => {
  if (line.itemType === "PRODUCT" && !line.productId) return "Choose a product";
  if (line.itemType === "SERVICE" && !line.productName.trim()) return "Enter the service name";
  if (num(line.quantity) <= 0) return "Quantity must be more than 0";
  if (num(line.unitPrice) <= 0) return "Enter the rate";
  if (num(line.discountPercentage) > 100 || num(line.taxRate) > 100) return "Discount and tax are % (0 to 100)";
  return null;
};

type Props = {
  lines: QuotationLine[];
  onChange: (lines: QuotationLine[]) => void;
  products: QuotationProduct[];
  additionalDiscount: number;
  onAdditionalDiscountChange: (value: number) => void;
  /** Show line errors (after a save attempt). */
  showErrors?: boolean;
  onCreateProduct?: () => void;
  /** The quotation's currency (the company's when not set). */
  currency?: string | null;
  /** The customer and date the rates are for (price lists and customer prices); none: the default list. */
  customerId?: number | null;
  priceDate?: string | null;
};

/** Units a service can be priced in (the Sales service only accepts its own unit names). */
const SERVICE_UNITS = [
  { value: "HOURS", label: "Hours" },
  { value: "DAY", label: "Days" },
  { value: "WEEK", label: "Weeks" },
  { value: "MONTH", label: "Months" },
  { value: "PIECES", label: "Pieces" },
];

const fieldLabel = "mb-0.5 block text-[11px] font-medium text-slate-500 dark:text-gray-400";
const addButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/40";

/** Quotation lines as an editable table (products from the catalogue, or free-text services) with the totals. */
export default function QuotationItemsEditor({
  lines,
  onChange,
  products,
  additionalDiscount,
  onAdditionalDiscountChange,
  showErrors = false,
  onCreateProduct,
  currency,
  customerId,
  priceDate,
}: Props) {
  const totals = quotationTotals(lines, additionalDiscount, currency);
  const code = currency || companyCurrency();
  const priceDecimals = moneyDecimals(currency);
  // The lines as last sent up, for prices that arrive after the user typed on
  const latest = useRef(lines);
  latest.current = lines;

  const change = (next: QuotationLine[]) => {
    latest.current = next;
    onChange(next);
  };

  const update = (index: number, patch: Partial<QuotationLine>) =>
    change(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  /**
   * Asks Sales for the rates of priced-automatically product lines (all, or the given keys): the customer's own price,
   * else their price list's quantity break, else the catalogue price. A rate the user typed is left alone.
   */
  const reprice = useCallback(async (keys: string[] | null) => {
    const targets = latest.current.filter(
      (line) => line.itemType === "PRODUCT" && line.productId && line.priceAuto && (keys === null || keys.includes(line.key))
    );
    if (targets.length === 0) return;
    try {
      const prices = await pricingApi.prices(customerId ?? null, currency ?? null, priceDate ?? null,
        targets.map((line) => ({ productId: Number(line.productId), quantity: num(line.quantity) || 1 })));
      const byKey = new Map(targets.map((line, i) => [line.key, prices[i]]));
      change(latest.current.map((line) => {
        const price = byKey.get(line.key);
        if (!price || !line.priceAuto || Number(line.productId) !== Number(price.productId) || price.unitPrice == null) return line;
        return { ...line, unitPrice: Number(price.unitPrice), priceSource: price.source, priceListName: price.priceListName ?? undefined };
      }));
    } catch {
      // Pricing not reachable: the catalogue price stays
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, currency, priceDate]);

  // A new customer, currency or date re-prices the lines priced automatically
  useEffect(() => {
    reprice(null);
  }, [reprice]);

  /** Picking a product copies its code, name, unit, price and GST % onto the line, then asks for the customer's rate. */
  const pickProduct = (index: number, productId: string) => {
    const product = products.find((item) => String(item.id) === productId);
    // Clearing the product keeps the category chosen to look in
    const category = product ? {} : { categoryId: lines[index].categoryId, categoryName: lines[index].categoryName };
    update(index, { ...productLinePatch(product, lines[index].taxRate), ...category, priceAuto: !!product, priceSource: "CATALOGUE", priceListName: undefined });
    if (product) reprice([lines[index].key]);
  };

  // The categories the catalogue's products are in (the line keeps the product's own category when saved)
  const categoryOf = (product: QuotationProduct) => product.category?.id ?? product.categoryId;
  const categoryOptions = useMemo(() => {
    const byId = new Map<string, string>();
    products.forEach((product) => {
      const id = categoryOf(product);
      if (id != null) byId.set(String(id), product.category?.categoryName || product.categoryName || `Category #${id}`);
    });
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

  /**
   * The products a line can pick: those in its category (all when none is chosen), not already on another line.
   * The line's own saved product stays listed even if it left the catalogue.
   */
  const productOptions = (line: QuotationLine, usedElsewhere: Set<string>): SearchableOption[] => {
    const options: SearchableOption[] = products
      .filter((product) => !usedElsewhere.has(String(product.id)))
      .filter((product) => !line.categoryId || String(categoryOf(product)) === String(line.categoryId))
      .map((product) => ({
        value: String(product.id),
        label: product.productName || product.shortName || `Product #${product.id}`,
        keywords: [product.productCode, product.shortName].filter((word): word is string => !!word),
      }));
    if (line.productId && !options.some((option) => option.value === String(line.productId))) {
      options.unshift({ value: String(line.productId), label: line.productName || `Product #${line.productId}` });
    }
    return options;
  };

  /** Choosing a category narrows the products; a product from another category is cleared. */
  const pickCategory = (index: number, categoryId: string) => {
    const line = lines[index];
    const product = products.find((item) => String(item.id) === String(line.productId));
    const keepsProduct = !categoryId || (product && String(categoryOf(product)) === categoryId);
    const name = categoryOptions.find((option) => option.value === categoryId)?.label || "";
    update(index, {
      categoryId: categoryId ? Number(categoryId) : undefined,
      categoryName: name,
      ...(keepsProduct ? {} : {
        ...productLinePatch(undefined, 0), categoryId: Number(categoryId), categoryName: name,
        priceAuto: false, priceSource: undefined, priceListName: undefined,
      }),
    });
  };

  /** A new quantity may reach another quantity break. */
  const changeQuantity = (index: number, quantity: number) => {
    update(index, { quantity });
    if (lines[index].priceAuto) reprice([lines[index].key]);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-gray-800">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{t("Line Items")}</div>
          <div className="text-xs text-slate-500 dark:text-gray-400">
            {lines.length === 0 ? t("No items added yet") : lines.length === 1 ? t("1 item") : t("{count} items", { count: lines.length })}
            {onCreateProduct && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={onCreateProduct}
                  className="font-medium text-cyan-700 hover:underline dark:text-cyan-400"
                >
                  {t("New product")}
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onChange([...lines, blankLine("PRODUCT")])} className={addButton}>
            <PlusIcon className="h-3.5 w-3.5" />
            {t("Product")}
          </button>
          <button type="button" onClick={() => onChange([...lines, blankLine("SERVICE")])} className={addButton}>
            <PlusIcon className="h-3.5 w-3.5" />
            {t("Service")}
          </button>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-gray-400">
          {t("Add a")} <span className="font-medium text-slate-700 dark:text-gray-200">{t("Product")}</span> {t("or a")}{" "}
          <span className="font-medium text-slate-700 dark:text-gray-200">{t("Service")}</span> {t("to build the quotation.")}
        </div>
      ) : (
        <ul className="space-y-3 p-3">
          {lines.map((line, index) => {
            const error = showErrors ? lineError(line) : null;
            // A product already on another line can't be picked again (change that line's quantity instead)
            const usedElsewhere = new Set(
              lines
                .filter((other, i) => i !== index && other.itemType === "PRODUCT" && other.productId)
                .map((other) => String(other.productId))
            );
            const meta = [line.productCode, line.uom].filter(Boolean).join(" · ");
            const isService = line.itemType === "SERVICE";
            return (
              <li
                key={line.key}
                className={`rounded-lg border bg-white p-3 dark:bg-gray-900 ${error ? "border-red-300 dark:border-red-700" : "border-slate-200 dark:border-gray-700"}`}
              >
                {/* What is quoted: a catalogue product or a free-text service */}
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isService
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                    : "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"}`}>
                    {index + 1}. {t(isService ? "Service" : "Product")}
                  </span>
                  <div className="min-w-0 flex-1">
                    {isService ? (
                      <input
                        value={line.productName}
                        onChange={(event) => update(index, { productName: event.target.value })}
                        placeholder={t("Service name")}
                        aria-label={t("Service name")}
                        maxLength={150}
                        className={cellInput}
                      />
                    ) : (
                      // Category first (optional, only narrows the list), then the product; both searchable
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                        <SearchableSelect
                          label={t("Category")}
                          value={line.categoryId ? String(line.categoryId) : ""}
                          options={categoryOptions}
                          onChange={(value) => pickCategory(index, value)}
                          placeholder={t("Type a category")}
                          emptyOptionLabel={t("All categories")}
                        />
                        <SearchableSelect
                          label={t("Product")}
                          value={line.productId ? String(line.productId) : ""}
                          options={productOptions(line, usedElsewhere)}
                          onChange={(value) => pickProduct(index, value)}
                          placeholder={t("Type a product name or code")}
                          noResultsText={line.categoryId ? t("No product in this category") : t("No match found")}
                        />
                      </div>
                    )}
                    {!isService && meta && <div className="mt-1 truncate px-0.5 text-[11px] text-slate-400 dark:text-gray-500">{meta}</div>}
                    {!isService && line.priceAuto && line.priceSource && line.priceSource !== "CATALOGUE" && (
                      <div className="mt-0.5 px-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
                        {line.priceSource === "CUSTOMER" ? t("Customer price") : `${t("Price list")}: ${line.priceListName ?? ""}`}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange(lines.filter((_, i) => i !== index))}
                    className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    title={t("Remove this line")}
                    aria-label={t("Remove this line")}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                {isService && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <input
                      value={line.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder={t("Description (optional)")}
                      aria-label={t("Service description")}
                      maxLength={250}
                      className={`${cellInput} text-xs`}
                    />
                    <select
                      value={line.uom}
                      onChange={(event) => update(index, { uom: event.target.value })}
                      aria-label={t("Unit")}
                      title={t("Unit")}
                      className={`${cellInput} text-xs ${line.uom ? "" : "text-slate-400 dark:text-gray-500"}`}
                    >
                      <option value="">{t("Unit (optional)")}</option>
                      {SERVICE_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>
                          {unit.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* The numbers, each with its own label */}
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <label className="block">
                    <span className={fieldLabel}>{t("Qty")}</span>
                    <NumberCell
                      label={t("Quantity")}
                      value={line.quantity}
                      decimals={allowsFraction(line.uom) ? 3 : 0}
                      onValue={(quantity) => changeQuantity(index, quantity)}
                    />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>{t("Rate ({currency})", { currency: code })}</span>
                    <NumberCell
                      label={t("Rate")}
                      value={line.unitPrice}
                      decimals={priceDecimals}
                      onValue={(unitPrice) => update(index, { unitPrice, priceAuto: false, priceSource: undefined, priceListName: undefined })}
                    />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>{t("Disc %")}</span>
                    <NumberCell
                      label={t("Discount %")}
                      value={line.discountPercentage}
                      decimals={2}
                      onValue={(discountPercentage) => update(index, { discountPercentage: Math.min(100, discountPercentage) })}
                    />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>{t("Tax %")}</span>
                    <NumberCell
                      label={t("Tax %")}
                      value={line.taxRate}
                      decimals={2}
                      onValue={(taxRate) => update(index, { taxRate: Math.min(100, taxRate) })}
                    />
                  </label>
                  <div className="col-span-2 sm:col-span-1">
                    <span className={fieldLabel}>{t("Amount")}</span>
                    <div className="rounded-md bg-slate-50 px-2 py-1.5 text-right text-sm font-semibold text-slate-800 dark:bg-gray-800 dark:text-gray-100">
                      {formatPrice(lineAmounts(line, currency).total, currency)}
                    </div>
                  </div>
                </div>
                {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {/* Totals, worked out the same way the server does */}
      <div className="flex justify-end border-t border-slate-200 px-4 py-3 dark:border-gray-700">
        <dl className="w-full max-w-[300px] space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-gray-400">{t("Sub Total")}</dt>
            <dd className="font-medium text-slate-800 dark:text-gray-100">{formatPrice(totals.subTotal, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-gray-400">{t("Discount")}</dt>
            <dd className="font-medium text-rose-600 dark:text-rose-400">−{formatPrice(totals.discount, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500 dark:text-gray-400">{t("Tax")}</dt>
            <dd className="font-medium text-slate-800 dark:text-gray-100">{formatPrice(totals.tax, currency)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500 dark:text-gray-400">{t("Additional Discount ({currency})", { currency: code })}</dt>
            <dd className="w-28">
              <NumberCell
                label={t("Additional discount")}
                value={additionalDiscount}
                decimals={priceDecimals}
                onValue={onAdditionalDiscountChange}
              />
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold dark:border-gray-700">
            <dt className="text-slate-900 dark:text-gray-50">{t("Grand Total")}</dt>
            <dd className="text-cyan-700 dark:text-cyan-400">{formatPrice(totals.grandTotal, currency)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
