// A product's other units (backlog 9.1.2, COM-2, step 1): the product's own unit stays its base unit (stock is kept in
// it); other units say how many base units they hold (1 CARTON = 24 PIECES), with their own barcode and price, and
// which one the product is usually bought and sold in. Arabic labels are here (English wording is the key).
import React from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { language, t } from "../../i18n/i18n";

export interface ProductUnitRow {
  unitCode: string;
  factor: string | number;
  barcode?: string | null;
  sellingPrice?: string | number | null;
  defaultPurchase?: boolean;
  defaultSales?: boolean;
}

/** Units offered while typing (any other name can be typed). */
export const UNIT_SUGGESTIONS = ["CARTON", "CASE", "BOX", "PACK", "DOZEN", "BAG", "ROLL", "PALLET", "CRATE", "TRAY", "BUNDLE",
  "SET", "PAIR", "SHEET", "BOTTLE", "CAN", "TIN", "DRUM", "TONNE", "KILOGRAM", "LITRE", "METER"];

const AR: Record<string, string> = {
  Units: "الوحدات",
  "Other units": "وحدات أخرى",
  Unit: "الوحدة",
  "Holds": "تحتوي",
  Barcode: "الباركود",
  "Price (optional)": "السعر (اختياري)",
  "Buy in": "الشراء بها",
  "Sell in": "البيع بها",
  "Add unit": "إضافة وحدة",
  "Remove unit": "إزالة الوحدة",
  "No other units: the product is bought, sold and counted in {base}.":
    "لا توجد وحدات أخرى: يُشترى المنتج ويُباع ويُعدّ بـ{base}.",
  "Stock is always kept in the base unit ({base}). Another unit holds a number of {base}: 1 CARTON = 24 PIECES. Its price is for one of it; empty = the product's price × its size. Tick the unit it is usually bought or sold in (else {base}).":
    "يُحفظ المخزون دائمًا بالوحدة الأساسية ({base}). وتحتوي الوحدة الأخرى على عدد من {base}: 1 CARTON = 24 PIECES. وسعرها لواحدة منها؛ والفارغ = سعر المنتج × حجمها. حدّد الوحدة التي يُشترى بها أو يُباع بها عادةً (وإلا {base}).",
  "Enter the unit's name, e.g. CARTON": "أدخل اسم الوحدة، مثل CARTON",
  "Use letters, digits, - or _ (e.g. CARTON or BOX_12)": "استخدم أحرفًا وأرقامًا و- أو _ (مثل CARTON أو BOX_12)",
  "{unit} is the base unit": "{unit} هي الوحدة الأساسية",
  "{unit} is listed twice": "{unit} مذكورة مرتين",
  "Enter how many {base} one {unit} holds (not 1)": "أدخل كم {base} تحتوي {unit} واحدة (ليس 1)",
  "A barcode is on two units": "باركود مكرر على وحدتين",
  "Only one unit can be the usual buying unit": "يمكن لوحدة واحدة فقط أن تكون وحدة الشراء المعتادة",
  "Only one unit can be the usual selling unit": "يمكن لوحدة واحدة فقط أن تكون وحدة البيع المعتادة",
  "At most 10 units": "10 وحدات كحد أقصى",
};

/** The text in the screen language (this module's Arabic first, then the shared dictionary). */
export const tu = (text: string, vars?: Record<string, string | number>): string => {
  const own = language() === "ar" ? AR[text] : undefined;
  const value = own ?? t(text, vars);
  return own && vars ? own.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : value;
};

const code = (value: string) => value.trim().toUpperCase().replace(/\s+/g, "_");
const blank = (row: ProductUnitRow) => !String(row.unitCode ?? "").trim() && (row.factor === "" || row.factor == null);

/** The first problem with the units (same rules as the server), or null. */
export const unitsError = (rows: ProductUnitRow[] | undefined, base: string): string | null => {
  const filled = (rows ?? []).filter((r) => !blank(r));
  if (filled.length > 10) return tu("At most 10 units");
  const seen = new Set<string>();
  const barcodes = new Set<string>();
  for (const row of filled) {
    const c = code(String(row.unitCode ?? ""));
    if (!c) return tu("Enter the unit's name, e.g. CARTON");
    if (!/^[A-Z][A-Z0-9_-]{0,19}$/.test(c)) return tu("Use letters, digits, - or _ (e.g. CARTON or BOX_12)");
    if (c === base) return tu("{unit} is the base unit", { unit: c });
    if (seen.has(c)) return tu("{unit} is listed twice", { unit: c });
    seen.add(c);
    const factor = Number(row.factor);
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1 || factor > 1_000_000) {
      return tu("Enter how many {base} one {unit} holds (not 1)", { base, unit: c });
    }
    const barcode = String(row.barcode ?? "").trim();
    if (barcode) {
      if (barcodes.has(barcode)) return tu("A barcode is on two units");
      barcodes.add(barcode);
    }
  }
  if (filled.filter((r) => r.defaultPurchase).length > 1) return tu("Only one unit can be the usual buying unit");
  if (filled.filter((r) => r.defaultSales).length > 1) return tu("Only one unit can be the usual selling unit");
  return null;
};

/** The units as the server takes them (blank rows left out). */
export const unitsPayload = (rows: ProductUnitRow[] | undefined) =>
  (rows ?? []).filter((r) => !blank(r)).map((r) => ({
    unitCode: code(String(r.unitCode)),
    factor: Number(r.factor),
    barcode: String(r.barcode ?? "").replace(/\s/g, "") || null,
    sellingPrice: r.sellingPrice === "" || r.sellingPrice == null ? null : Number(r.sellingPrice),
    defaultPurchase: Boolean(r.defaultPurchase),
    defaultSales: Boolean(r.defaultSales),
  }));

/** "PIECES · CARTON 24, PACK 6" for the products list. */
export const unitsSummary = (base?: string | null, units?: ProductUnitRow[] | null) =>
  [base || "", ...(units ?? []).map((u) => `${u.unitCode} ${Number(u.factor)}`)].filter(Boolean).join(" · ");

const input = "h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

/** The units table on the product form. */
export const ProductUnitsEditor: React.FC<{ value?: ProductUnitRow[]; base: string; onChange: (rows: ProductUnitRow[]) => void; error?: string }> = ({
  value,
  base,
  onChange,
  error,
}) => {
  const rows = value ?? [];
  const set = (index: number, patch: Partial<ProductUnitRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : patch.defaultPurchase || patch.defaultSales
      ? { ...row, ...(patch.defaultPurchase ? { defaultPurchase: false } : {}), ...(patch.defaultSales ? { defaultSales: false } : {}) }
      : row)));
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">{tu("Stock is always kept in the base unit ({base}). Another unit holds a number of {base}: 1 CARTON = 24 PIECES. Its price is for one of it; empty = the product's price × its size. Tick the unit it is usually bought or sold in (else {base}).", { base })}</p>
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">{tu("No other units: the product is bought, sold and counted in {base}.", { base })}</p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="product-units">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="px-1 py-1 font-medium">{tu("Unit")}</th>
                <th className="px-1 py-1 font-medium">{tu("Holds")}</th>
                <th className="px-1 py-1 font-medium">{tu("Barcode")}</th>
                <th className="px-1 py-1 font-medium">{tu("Price (optional)")}</th>
                <th className="px-1 py-1 text-center font-medium">{tu("Buy in")}</th>
                <th className="px-1 py-1 text-center font-medium">{tu("Sell in")}</th>
                <th className="px-1 py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="px-1 py-1">
                    <input className={input} list="unit-suggestions" value={row.unitCode ?? ""} maxLength={20} aria-label={tu("Unit")}
                      onChange={(e) => set(i, { unitCode: e.target.value.toUpperCase() })} placeholder="CARTON" />
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <input className={input} type="number" min={0} step="any" value={row.factor ?? ""} aria-label={tu("Holds")}
                        onChange={(e) => set(i, { factor: e.target.value })} placeholder="24" />
                      <span className="whitespace-nowrap text-xs text-slate-500">{base}</span>
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <input className={input} value={row.barcode ?? ""} maxLength={50} inputMode="numeric" aria-label={tu("Barcode")}
                      onChange={(e) => set(i, { barcode: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <input className={input} type="number" min={0} step="any" value={row.sellingPrice ?? ""} aria-label={tu("Price (optional)")}
                      onChange={(e) => set(i, { sellingPrice: e.target.value })} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" checked={Boolean(row.defaultPurchase)} aria-label={tu("Buy in")}
                      onChange={(e) => set(i, { defaultPurchase: e.target.checked })} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" checked={Boolean(row.defaultSales)} aria-label={tu("Sell in")}
                      onChange={(e) => set(i, { defaultSales: e.target.checked })} />
                  </td>
                  <td className="px-1 py-1 text-right">
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tu("Remove unit")}
                      title={tu("Remove unit")} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <datalist id="unit-suggestions">
        {UNIT_SUGGESTIONS.filter((u) => u !== base).map((u) => <option key={u} value={u} />)}
      </datalist>
      {rows.length < 10 && (
        <button type="button" onClick={() => onChange([...rows, { unitCode: "", factor: "" }])}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-200">
          <PlusIcon className="h-4 w-4" /> {tu("Add unit")}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};
