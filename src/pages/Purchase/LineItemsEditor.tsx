import React, { useEffect, useState } from "react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

export type LineItem = {
  id?: number | string;
  productId: number | string;
  productName?: string;
  categoryId?: number | string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice?: number;
  discountAmount?: number;
  taxAmount?: number;
  remarks?: string;
};

type Props = {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Array<{ id: number | string; productName: string; uom?: string; categoryId?: number | string }>;
  categories?: Array<{ id: number | string; categoryName: string }>;
  uomOptions?: string[];
  showUom?: boolean;
  showPricing?: boolean;
  disabled?: boolean;
};

const DEFAULT_UOM = ["PIECES", "KG", "LITER", "METER", "BOX", "PACK"];

/** Units that can be measured in parts (2.5 KG). Everything else is counted in whole numbers. */
const FRACTION_UOMS = ["KG", "KILOGRAM", "GRAM", "G", "LITER", "LITRE", "L", "ML", "METER", "METRE", "M"];
const allowsFraction = (uom: string) => FRACTION_UOMS.includes(String(uom || "").toUpperCase());

/** Biggest number accepted in any box (stops typos like 10000000000). */
const MAX_VALUE = 99999999;

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number) =>
  `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Keeps only digits and (when allowed) one dot with at most `decimals` digits after it. */
const cleanNumberText = (raw: string, decimals: number) => {
  let text = raw.replace(/[^\d.]/g, ""); // no minus, no "e", no letters
  if (decimals === 0) return text.replace(/\./g, "");
  const firstDot = text.indexOf(".");
  if (firstDot >= 0) {
    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, "");
    const [whole, part = ""] = text.split(".");
    text = `${whole}.${part.slice(0, decimals)}`;
  }
  return text;
};

const cellInput =
  "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-cyan-900 dark:disabled:bg-gray-800";
const errorInput = "border-red-400 focus:border-red-400 focus:ring-red-100 dark:border-red-500";

/**
 * Number box that can never hold a negative value.
 * - Minus, "+", "e" are blocked while typing and removed when pasting.
 * - The box can be empty while typing (no stuck "0" in front); it becomes 0 when you leave it.
 * - Mouse wheel does not change the number by mistake.
 */
function NumberCell({
  value,
  onValue,
  decimals,
  disabled,
  error,
  label,
}: {
  value: unknown;
  onValue: (value: number) => void;
  decimals: number;
  disabled?: boolean;
  error?: string | null;
  label: string;
}) {
  const [text, setText] = useState(() => (value === "" || value == null ? "" : String(value)));

  // When the value changes from outside (product picked, PR loaded), show it.
  useEffect(() => {
    if (toNumber(text) !== toNumber(value)) setText(value === "" || value == null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <input
        type="text"
        inputMode={decimals > 0 ? "decimal" : "numeric"}
        value={text}
        aria-label={label}
        aria-invalid={Boolean(error)}
        title={error || undefined}
        onKeyDown={(event) => {
          if (["-", "+", "e", "E"].includes(event.key) || (decimals === 0 && event.key === ".")) event.preventDefault();
        }}
        onChange={(event) => {
          const cleaned = cleanNumberText(event.target.value, decimals);
          if (toNumber(cleaned) > MAX_VALUE) return; // ignore keys that would make it too big
          setText(cleaned);
          onValue(toNumber(cleaned));
        }}
        onBlur={() => {
          const final = toNumber(text);
          setText(text === "" ? "" : String(final));
          onValue(final);
        }}
        onWheel={(event) => (event.target as HTMLInputElement).blur()}
        disabled={disabled}
        className={`${cellInput} text-right ${error ? errorInput : ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function LineItemsEditor({
  items,
  onChange,
  products,
  categories = [],
  uomOptions = DEFAULT_UOM,
  showUom = true,
  showPricing = false,
  disabled = false,
}: Props) {
  const addRow = () => {
    onChange([
      ...items,
      {
        productId: "",
        categoryId: "",
        quantity: 1,
        unitOfMeasure: uomOptions[0] || "PIECES",
        unitPrice: 0,
        discountAmount: 0,
        taxAmount: 0,
        remarks: "",
      },
    ]);
  };

  const updateRow = (index: number, patch: Partial<LineItem>) => {
    onChange(items.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  /** Messages shown under a line's boxes. */
  const rowErrors = (row: LineItem) => {
    const quantity = toNumber(row.quantity);
    const lineValue = quantity * toNumber(row.unitPrice);
    return {
      quantity: quantity <= 0 ? "Must be more than 0" : null,
      unitPrice: showPricing && row.productId !== "" && toNumber(row.unitPrice) <= 0 ? "Enter a price" : null,
      discountAmount: showPricing && toNumber(row.discountAmount) > lineValue ? "More than the line value" : null,
    };
  };

  const lineTotal = (row: LineItem) =>
    Math.max(0, toNumber(row.quantity) * toNumber(row.unitPrice) - toNumber(row.discountAmount)) + toNumber(row.taxAmount);

  const grandTotal = items.reduce((sum, row) => sum + lineTotal(row), 0);

  const headCell = "px-3 py-2";

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-gray-800">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">Line Items</div>
          <div className="text-xs text-slate-500 dark:text-gray-400">
            {items.length === 0 ? "No items added yet" : `${items.length} item${items.length === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-900/40"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add Item
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-gray-400">
          Click <span className="font-medium text-slate-700 dark:text-gray-200">Add Item</span> to start building the list.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className={`${headCell} min-w-[180px]`}>Product</th>
                {categories.length > 0 && <th className={headCell}>Category</th>}
                <th className={`${headCell} w-24 text-right`}>Qty</th>
                {showUom && <th className={`${headCell} w-28`}>UOM</th>}
                {showPricing && <th className={`${headCell} w-28 text-right`}>Unit Price (₹)</th>}
                {showPricing && <th className={`${headCell} w-28 text-right`}>Discount (₹)</th>}
                {showPricing && <th className={`${headCell} w-28 text-right`}>Tax (₹)</th>}
                {showPricing && <th className={`${headCell} w-32 text-right`}>Line Total</th>}
                <th className={headCell}>Remarks</th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {items.map((row, index) => {
                const errors = rowErrors(row);
                // A product already used on another line can't be picked again (combine the quantity instead).
                const usedElsewhere = new Set(
                  items.filter((_, i) => i !== index).map((other) => String(other.productId)).filter(Boolean)
                );
                const quantityDecimals = allowsFraction(row.unitOfMeasure) ? 3 : 0;

                return (
                  <tr key={row.id ?? index} className="align-top">
                    <td className="px-3 py-2">
                      <select
                        value={row.productId}
                        onChange={(e) => {
                          const product = products.find((p) => String(p.id) === String(e.target.value));
                          updateRow(index, {
                            productId: e.target.value,
                            productName: product?.productName,
                            unitOfMeasure: product?.uom || row.unitOfMeasure || "PIECES",
                            categoryId: product?.categoryId || "",
                          });
                        }}
                        disabled={disabled}
                        aria-label="Product"
                        className={`${cellInput} ${row.productId === "" ? "text-slate-400 dark:text-gray-500" : ""}`}
                      >
                        <option value="">Select product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} disabled={usedElsewhere.has(String(p.id))}>
                            {p.productName}
                            {usedElsewhere.has(String(p.id)) ? " (already added)" : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    {categories.length > 0 && (
                      <td className="px-3 py-2">
                        <select
                          value={row.categoryId || ""}
                          onChange={(e) => updateRow(index, { categoryId: e.target.value })}
                          disabled={disabled}
                          aria-label="Category"
                          className={cellInput}
                        >
                          <option value="">—</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.categoryName}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <NumberCell
                        label="Quantity"
                        value={row.quantity}
                        decimals={quantityDecimals}
                        onValue={(quantity) => updateRow(index, { quantity })}
                        disabled={disabled}
                        error={errors.quantity}
                      />
                    </td>
                    {showUom && (
                      <td className="px-3 py-2">
                        <select
                          value={row.unitOfMeasure}
                          onChange={(e) => {
                            const unitOfMeasure = e.target.value;
                            // Switching KG → PIECES: 2.5 becomes 3, since pieces are whole.
                            const quantity = allowsFraction(unitOfMeasure)
                              ? toNumber(row.quantity)
                              : Math.ceil(toNumber(row.quantity));
                            updateRow(index, { unitOfMeasure, quantity });
                          }}
                          disabled={disabled}
                          aria-label="Unit of measure"
                          className={cellInput}
                        >
                          {/* Keep the product's own UOM visible even if it isn't in the list. */}
                          {!uomOptions.includes(row.unitOfMeasure) && row.unitOfMeasure && (
                            <option value={row.unitOfMeasure}>{row.unitOfMeasure}</option>
                          )}
                          {uomOptions.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    {showPricing &&
                      (["unitPrice", "discountAmount", "taxAmount"] as const).map((field) => (
                        <td key={field} className="px-3 py-2">
                          <NumberCell
                            label={field === "unitPrice" ? "Unit price" : field === "discountAmount" ? "Discount" : "Tax"}
                            value={row[field] ?? 0}
                            decimals={2}
                            onValue={(amount) => updateRow(index, { [field]: amount })}
                            disabled={disabled}
                            error={field === "taxAmount" ? null : errors[field]}
                          />
                        </td>
                      ))}
                    {showPricing && (
                      <td className="whitespace-nowrap px-3 py-2 pt-3.5 text-right text-sm font-medium text-slate-800 dark:text-gray-100">
                        {money(lineTotal(row))}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.remarks || ""}
                        maxLength={250}
                        onChange={(e) => updateRow(index, { remarks: e.target.value })}
                        disabled={disabled}
                        placeholder="Optional"
                        aria-label="Remarks"
                        className={cellInput}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={disabled}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        title="Remove this line"
                        aria-label="Remove this line"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {showPricing && (
              <tfoot className="border-t border-slate-200 dark:border-gray-700">
                <tr>
                  <td
                    colSpan={1 + (categories.length > 0 ? 1 : 0) + 1 + (showUom ? 1 : 0) + 3}
                    className="px-3 py-2.5 text-right text-sm font-semibold text-slate-600 dark:text-gray-300"
                  >
                    Total
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold text-slate-900 dark:text-gray-50">
                    {money(grandTotal)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
