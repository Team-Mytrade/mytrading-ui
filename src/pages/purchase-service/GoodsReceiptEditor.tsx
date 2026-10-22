import React, { useEffect, useState } from "react";
import axios from "axios";
import { PurchaseRecord, SelectOption } from "../Purchase/PurchaseResourcePage";
import { ToasterService } from "../../Services/ToasterService";
import "../../styles/GoodsReceiptEditor.css";

type GrnItem = {
  id?: number | string;
  purchaseOrderLineItemId: number | string;
  productId?: number | string;
  productName?: string;
  productCode?: string;
  orderedQuantity?: number;
  pendingQuantity?: number;
  /** On edit: what this GRN already received on the line (it may be received again up to pending + this). */
  originalReceived?: number;
  receivedQuantity: number | string;
  acceptedQuantity: number | string;
  rejectedQuantity: number | string;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  serialNumbers: string[];
  /** What the product master says to capture for this line. Missing = not known, so all fields are shown. */
  tracking?: Tracking;
};

/** Product master flags (Products → Inventory Tracking). */
type Tracking = { batch: boolean; expiry: boolean; serial: boolean };

/** One line of the purchase order, shown read-only in "Ordered products". */
type OrderLine = {
  key: string;
  productName: string;
  productCode: string;
  unitOfMeasure: string;
  ordered: number;
  received: number;
  pending: number;
};

type Props = {
  form: PurchaseRecord;
  purchaseOrders: SelectOption[];
  warehouses: SelectOption[];
  isEditing: boolean;
  onChange: (name: string, value: any) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
};

const PO_API = "/v1/api/purchase/purchase-orders";
const PRODUCTS_API = "/v1/api/product/products";

/** Product Catalogue lookup by id, used when the PO line comes back without a product name or code. */
type ProductInfo = { name: string; code: string; tracking: Tracking };
let productCache: Promise<Record<string, ProductInfo>> | null = null;
const loadProductLookup = () => {
  // One GET per page load, shared by every GRN form opened afterwards.
  productCache ??= axios
    .get(PRODUCTS_API)
    .then((response) => {
      const list = Array.isArray(response.data) ? response.data : response.data?.content || response.data?.data || [];
      return Object.fromEntries(
        list.map((p: PurchaseRecord) => [
          String(p.id),
          {
            name: String(p.productName || ""),
            code: String(p.productCode || ""),
            tracking: trackingOf(p) ?? { batch: false, expiry: false, serial: false },
          },
        ])
      );
    })
    .catch(() => {
      productCache = null; // try again next time
      return {};
    });
  return productCache;
};

/** Adds productName / productCode from the catalogue to PO lines that are missing them. */
const withProductNames = (order: PurchaseRecord, lookup: Record<string, ProductInfo>): PurchaseRecord => {
  const fill = (line: PurchaseRecord) => {
    const info = lookup[String(line.productId ?? line.product?.id ?? "")];
    if (!info) return line;
    return {
      ...line,
      productName: line.productName || info.name,
      productCode: line.productCode || info.code,
      tracking: trackingOf(line) ?? info.tracking,
    };
  };
  return {
    ...order,
    items: linesOf(order).map(fill),
    lineItems: undefined,
    purchaseOrderLineItems: undefined,
  };
};

/**
 * Tracking flags from a product (or a PO line that carries its product).
 * Returns undefined when the record has none of the flags, so the caller can look elsewhere.
 */
function trackingOf(record: PurchaseRecord | undefined): Tracking | undefined {
  if (!record) return undefined;
  if (record.tracking) return record.tracking as Tracking;
  const source = [record, record.product].find(
    (r) => r && (r.batchTracking != null || r.serialTracking != null || r.expiryTracking != null)
  );
  if (!source) return undefined;
  const batch = Boolean(source.batchTracking);
  return { batch, expiry: batch && Boolean(source.expiryTracking), serial: Boolean(source.serialTracking) };
}

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Date as yyyy-MM-dd for <input type="date">; accepts "2026-10-14", "2026-10-14T10:00" or [2026,10,14]. */
const toInputDate = (value: unknown): string | null => {
  if (Array.isArray(value) && value.length >= 3) {
    const [y, m, d] = value;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
};

/** "2026-10-09" → "09 Oct 2026" for the receipt header. */
const displayDate = (value: unknown) => {
  const iso = toInputDate(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1];
  return `${d} ${month} ${y}`;
};

/** Serial numbers can come back as an array, a comma/line separated string, or null. Always returns an array. */
const toSerials = (value: unknown): string[] => {
  // Keep empty slots in an array: each one is a box on screen, so positions must not shift while typing.
  if (Array.isArray(value)) return value.map((s) => String(s ?? "").trim());
  if (typeof value === "string") return value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  return [];
};

const productNameOf = (line: PurchaseRecord) =>
  line.productName || line.product?.productName || line.product?.name || line.purchaseOrderLineItem?.productName || "";
const productCodeOf = (line: PurchaseRecord) =>
  line.productCode || line.product?.productCode || line.purchaseOrderLineItem?.productCode || "";

/** Quantity still to be received on a PO line (uses backend values when they are provided). */
const pendingFor = (line: PurchaseRecord) => {
  if (line.pendingQuantity != null) return Math.max(0, num(line.pendingQuantity));
  return Math.max(0, num(line.quantity) - num(line.receivedQuantity));
};

const linesOf = (order: PurchaseRecord): PurchaseRecord[] => {
  const lines = order.items || order.lineItems || order.purchaseOrderLineItems;
  return Array.isArray(lines) ? lines : [];
};

/** PO lines for the read-only "Ordered products" table. */
const asOrderLines = (order: PurchaseRecord): OrderLine[] =>
  linesOf(order).map((line, index) => {
    const ordered = num(line.quantity);
    const pending = pendingFor(line);
    return {
      key: String(line.id ?? index),
      productName: productNameOf(line) || "Product",
      productCode: productCodeOf(line),
      unitOfMeasure: String(line.unitOfMeasure || line.uom || ""),
      ordered,
      received: line.receivedQuantity != null ? num(line.receivedQuantity) : Math.max(0, ordered - pending),
      pending,
    };
  });

/** Create: turns PO lines into GRN lines, defaulting each line to the quantity still pending. */
const asItems = (order: PurchaseRecord): GrnItem[] =>
  linesOf(order)
    .map((line) => {
      const pending = pendingFor(line);
      return {
        purchaseOrderLineItemId: line.id ?? line.purchaseOrderLineItemId,
        productId: line.productId ?? line.product?.id,
        productName: productNameOf(line) || productCodeOf(line) || "Product",
        productCode: productCodeOf(line),
        orderedQuantity: num(line.quantity),
        pendingQuantity: pending,
        receivedQuantity: pending,
        acceptedQuantity: pending,
        rejectedQuantity: 0,
        batchNumber: null,
        manufacturingDate: null,
        expiryDate: null,
        serialNumbers: [],
        tracking: trackingOf(line),
      };
    })
    // Lines with nothing left to receive are left out.
    .filter((item) => item.pendingQuantity !== 0);

/**
 * Edit: a saved GRN line from the API, made safe to show.
 * Fills anything missing (serial numbers, dates, ids) so the form never crashes on null.
 */
const toGrnItem = (raw: PurchaseRecord): GrnItem => ({
  id: raw.id,
  purchaseOrderLineItemId: raw.purchaseOrderLineItemId ?? raw.purchaseOrderLineItem?.id ?? "",
  productId: raw.productId ?? raw.product?.id ?? raw.purchaseOrderLineItem?.productId,
  productName: productNameOf(raw) || productCodeOf(raw) || "Product",
  productCode: productCodeOf(raw),
  orderedQuantity: raw.orderedQuantity != null ? num(raw.orderedQuantity) : undefined,
  pendingQuantity: raw.pendingQuantity != null ? num(raw.pendingQuantity) : undefined,
  originalReceived: raw.originalReceived != null ? num(raw.originalReceived) : num(raw.receivedQuantity),
  receivedQuantity: raw.receivedQuantity ?? 0,
  acceptedQuantity: raw.acceptedQuantity ?? 0,
  rejectedQuantity: raw.rejectedQuantity ?? 0,
  batchNumber: raw.batchNumber ?? null,
  manufacturingDate: toInputDate(raw.manufacturingDate),
  expiryDate: toInputDate(raw.expiryDate),
  serialNumbers: toSerials(raw.serialNumbers),
  tracking: trackingOf(raw),
});

/**
 * Most this line can receive: what's pending, plus (on edit) what this GRN already took.
 * Never more than the ordered quantity (protects against pending values that don't count this GRN).
 */
const maxFor = (item: GrnItem, isEditing: boolean) => {
  if (item.pendingQuantity == null) return undefined;
  const max = item.pendingQuantity + (isEditing ? num(item.originalReceived) : 0);
  return item.orderedQuantity != null && item.orderedQuantity > 0 ? Math.min(max, item.orderedQuantity) : max;
};

/** Returns an error message for the first invalid line, or null when all lines are valid. */
const validateItems = (items: GrnItem[], isEditing: boolean): string | null => {
  if (!items.length) return "This purchase order has nothing left to receive.";

  for (const item of items) {
    const name = item.productName || "A line";
    const received = num(item.receivedQuantity);
    const rejected = num(item.rejectedQuantity);
    const accepted = num(item.acceptedQuantity);
    const max = maxFor(item, isEditing);

    if (received <= 0) return `${name}: received quantity must be more than 0.`;
    if (accepted < 0 || rejected < 0) return `${name}: quantities cannot be negative.`;
    if (accepted + rejected !== received) {
      return `${name}: accepted (${accepted}) + rejected (${rejected}) must equal received (${received}).`;
    }
    if (max != null && received > max) return `${name}: only ${max} can be received on this PO line.`;
    // Required by the product's tracking settings (only when known).
    const t = item.tracking;
    if (t?.batch && !item.batchNumber) return `${name}: enter the batch number (this product is batch tracked).`;
    if (t?.expiry && !item.expiryDate) return `${name}: enter the expiry date (this product is expiry tracked).`;
    if (t?.serial && accepted > 0 && !item.serialNumbers.some(Boolean)) {
      return `${name}: enter ${accepted} serial number(s) (this product is serial tracked).`;
    }
    if (item.manufacturingDate && item.expiryDate && item.expiryDate <= item.manufacturingDate) {
      return `${name}: expiry date must be after the manufacturing date.`;
    }

    const serials = item.serialNumbers.filter(Boolean);
    if (serials.length) {
      if (new Set(serials).size !== serials.length) return `${name}: the same serial number is entered twice.`;
      if (serials.length !== accepted) {
        return `${name}: enter exactly ${accepted} serial number(s), one for each accepted unit.`;
      }
    }
  }
  return null;
};

const MAX_SERIAL_BOXES = 200;

/**
 * One box per accepted unit (3 accepted = 3 boxes). Easier than one big text box:
 * - Enter (or a barcode scanner, which types the code + Enter) jumps to the next box.
 * - Pasting several lines into a box fills the following boxes.
 * - A duplicate serial is marked red.
 */
function SerialInputs({
  count,
  required,
  values,
  onChange,
}: {
  count: number;
  required: boolean;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const boxes = Math.min(Math.max(0, Math.floor(count)), MAX_SERIAL_BOXES);
  const slots = Array.from({ length: boxes }, (_, i) => values[i] ?? "");
  const filled = slots.filter(Boolean).length;
  const seen = new Map<string, number>();
  slots.forEach((v) => v && seen.set(v, (seen.get(v) || 0) + 1));

  const setAt = (start: number, incoming: string[]) => {
    const next = [...slots];
    incoming.forEach((v, i) => {
      if (start + i < boxes) next[start + i] = v.trim().toUpperCase();
    });
    onChange(next);
  };

  const focusBox = (form: HTMLFormElement | null, i: number) =>
    (form?.querySelector(`[data-serial-box="${i}"]`) as HTMLInputElement | null)?.focus();

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span>
          Serial numbers{required && <span className="text-red-500"> *</span>}
        </span>
        {boxes > 0 && (
          <span className={`text-xs ${filled === boxes ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}>
            {filled} of {boxes} entered
          </span>
        )}
      </div>
      {boxes === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Enter the accepted quantity first; one box appears per unit.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((value, i) => {
            const duplicate = Boolean(value) && (seen.get(value) || 0) > 1;
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-right text-xs text-gray-400 dark:text-gray-500">{i + 1}.</span>
                <input
                  data-serial-box={i}
                  value={value}
                  aria-label={`Serial number ${i + 1}`}
                  aria-invalid={duplicate}
                  title={duplicate ? "This serial number is entered twice" : undefined}
                  placeholder={`Serial ${i + 1}`}
                  className={duplicate ? "!border-red-400 !text-red-700 dark:!text-red-300" : undefined}
                  onChange={(event) => setAt(i, [event.target.value])}
                  onPaste={(event) => {
                    const lines = event.clipboardData.getData("text").split(/[\n,\t]+/).map((l) => l.trim()).filter(Boolean);
                    if (lines.length > 1) {
                      event.preventDefault();
                      setAt(i, lines);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault(); // don't submit the form
                      focusBox(event.currentTarget.form, i + 1);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      {count > MAX_SERIAL_BOXES && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Showing the first {MAX_SERIAL_BOXES} boxes. For more units, split the receipt into two GRNs.
        </p>
      )}
    </div>
  );
}

/** In-page GRN receipt form. Its submitted fields map to the GRN API payload. */
export default function GoodsReceiptEditor({
  form,
  purchaseOrders,
  warehouses,
  isEditing,
  onChange,
  onCancel,
  onSubmit,
  submitting,
}: Props) {
  const [loadingItems, setLoadingItems] = useState(false);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);

  // Every line goes through toGrnItem, so a null or odd value from the API can't crash the page.
  const items: GrnItem[] = Array.isArray(form.items) ? (form.items as PurchaseRecord[]).map(toGrnItem) : [];

  /** Loads the PO fresh (so pending quantities include earlier GRNs). Returns null if it fails. */
  const fetchOrder = async (id: string): Promise<PurchaseRecord | null> => {
    let order: PurchaseRecord | null;
    try {
      const response = await axios.get(`${PO_API}/${id}`);
      order = response.data || {};
    } catch {
      order = purchaseOrders.find((option) => String(option.value) === id)?.raw ?? null;
    }
    if (!order) return null;
    // The PO line may not carry the product name yet: fill it from the Product Catalogue.
    // Fill missing product names and the tracking flags from the Product Catalogue (one cached GET).
    const needsLookup = linesOf(order).some(
      (line) => !productNameOf(line) || !productCodeOf(line) || !trackingOf(line)
    );
    return needsLookup ? withProductNames(order, await loadProductLookup()) : order;
  };

  /** Create: picking a PO fills the GRN lines and the "Ordered products" table. */
  const loadItems = async (id: string) => {
    onChange("purchaseOrderId", id);
    if (!id) {
      setOrderLines([]);
      onChange("items", []);
      return;
    }
    setLoadingItems(true);
    const order = await fetchOrder(id);
    setOrderLines(order ? asOrderLines(order) : []);
    onChange("items", order ? asItems(order) : []);
    if (order?.warehouseId && !form.warehouseId) onChange("warehouseId", String(order.warehouseId));
    setLoadingItems(false);
  };

  // Create: load lines if a PO is already set (e.g. opened from the PO page).
  useEffect(() => {
    if (!isEditing && form.purchaseOrderId && !items.length) loadItems(String(form.purchaseOrderId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form.purchaseOrderId]);

  // Edit: load the PO only for the "Ordered products" table and the pending limits. The saved lines stay as they are.
  useEffect(() => {
    if (!isEditing || !form.purchaseOrderId) return;
    let cancelled = false;
    fetchOrder(String(form.purchaseOrderId)).then((order) => {
      if (cancelled || !order) return;
      const lines = linesOf(order);
      setOrderLines(asOrderLines(order));
      // Copy ordered / pending numbers onto the saved lines so limits and labels work.
      onChange(
        "items",
        items.map((item) => {
          const line = lines.find((l) => String(l.id) === String(item.purchaseOrderLineItemId));
          if (!line) return item;
          return {
            ...item,
            productName: item.productName !== "Product" ? item.productName : productNameOf(line) || "Product",
            productCode: item.productCode || productCodeOf(line),
            productId: item.productId ?? line.productId ?? line.product?.id,
            orderedQuantity: num(line.quantity),
            pendingQuantity: pendingFor(line),
            tracking: item.tracking ?? trackingOf(line),
          };
        })
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form.purchaseOrderId]);

  /** Updates several fields of one line in a single change (two separate updates would overwrite each other). */
  const updateItem = (index: number, changes: Partial<GrnItem>) =>
    onChange("items", items.map((item, current) => (current === index ? {
      ...item, ...changes,
      ...(changes.acceptedQuantity != null ? { serialNumbers: item.serialNumbers.slice(0, Math.max(0, Math.floor(num(changes.acceptedQuantity)))) } : {}),
    } : item)));

  // Received or rejected changes keep accepted = received - rejected.
  const updateReceived = (index: number, value: string) => {
    const rejected = Math.min(num(items[index].rejectedQuantity), num(value));
    updateItem(index, {
      receivedQuantity: value,
      rejectedQuantity: rejected,
      acceptedQuantity: Math.max(0, num(value) - rejected),
    });
  };
  /** Editing accepted quantity recalculates rejected so both reconcile with received. */
  const updateAccepted = (index: number, value: string) => {
    const received = num(items[index].receivedQuantity);
    const accepted = value === "" ? "" : String(Math.max(0, Math.min(num(value), received)));
    updateItem(index, {
      acceptedQuantity: accepted,
      rejectedQuantity: received - num(accepted),
    });
  };
  const updateRejected = (index: number, value: string) => {
    const received = num(items[index].receivedQuantity);
    // Can't reject more than was received.
    const rejected = value === "" ? "" : String(Math.min(num(value), received));
    updateItem(index, {
      rejectedQuantity: rejected,
      acceptedQuantity: Math.max(0, received - num(rejected)),
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const error = validateItems(items, isEditing);
    if (error) {
      event.preventDefault();
      ToasterService.error(error);
      return;
    }
    onSubmit(event);
  };

  // On edit the PO may already be fully received, so it is no longer in the dropdown: show its number as text.
  const poLabel =
    form.poNumber ||
    purchaseOrders.find((option) => String(option.value) === String(form.purchaseOrderId))?.label ||
    "";

  // Same padding for header and cells; nowrap keeps every heading on one line, so the header row stays short.
  const th = "whitespace-nowrap px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";
  const td = "px-4 py-3 align-middle text-sm text-gray-800 dark:text-gray-200";

  return (
    <form className="goods-receipt-editor" onSubmit={handleSubmit}>
      <section className="goods-receipt-editor__receipt">
        <div className="goods-receipt-editor__receipt-head">
          <span>GRN RECEIPT</span>
          <time>{displayDate(form.receiptDate)}</time>
        </div>
        <div className="goods-receipt-editor__controls">
          <label>
            Purchase order
            {isEditing ? (
              // Can't move a saved GRN to another PO.
              <input value={poLabel} readOnly aria-readonly="true" />
            ) : (
              <select required value={form.purchaseOrderId || ""} onChange={(event) => loadItems(event.target.value)}>
                <option value="">Select purchase order</option>
                {purchaseOrders.map((option) => (
                  <option key={String(option.value)} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label>
            Warehouse
            <select
              required
              value={form.warehouseId || ""}
              onChange={(event) => onChange("warehouseId", event.target.value)}
            >
              <option value="">Select warehouse</option>
              {warehouses.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Receipt date
            <input
              required
              type="date"
              value={form.receiptDate || ""}
              onChange={(event) => onChange("receiptDate", event.target.value)}
            />
          </label>
        </div>
      </section>

      {/* Ordered products: every line of the PO, read-only.
          The outer section uses the same class as "Received items", so both have the same side margins. */}
      {orderLines.length > 0 && (
        <section className="goods-receipt-editor__items">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            {/* Header bar: same left padding (px-4) as the table cells, so the title lines up with "Product". */}
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Ordered products</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {orderLines.length} product{orderLines.length === 1 ? "" : "s"} on this purchase order
              </span>
            </div>
            <div className="overflow-x-auto">
              {/* Product takes the free space; the 4 quantity columns are all the same width, so the gaps are even. */}
              {/* Fixed columns add up to 660px; min width 900px keeps at least 240px for the product name,
                  so Product and Code never overlap in a narrow drawer (it scrolls sideways instead). */}
              <table className="w-full min-w-[900px] table-fixed">
                <colgroup>
                  <col />
                  <col className="w-[160px]" />
                  <col className="w-[120px]" />
                  <col className="w-[140px]" />
                  <col className="w-[120px]" />
                  <col className="w-[120px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className={th}>Product</th>
                    <th className={th}>Code</th>
                    <th className={`${th} text-center`}>Ordered</th>
                    <th className={`${th} text-center`}>Received so far</th>
                    <th className={`${th} text-center`}>Pending</th>
                    <th className={`${th} text-center`}>UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {orderLines.map((line) => (
                    <tr key={line.key}>
                      <td className={`${td} truncate font-medium`} title={line.productName}>
                        {line.productName}
                      </td>
                      <td className={`${td} truncate text-gray-500 dark:text-gray-400`} title={line.productCode}>
                        {line.productCode}
                      </td>
                      <td className={`${td} text-center tabular-nums`}>{line.ordered}</td>
                      <td className={`${td} text-center tabular-nums`}>{line.received}</td>
                      <td className={`${td} text-center font-semibold tabular-nums`}>
                        {line.pending === 0 ? (
                          <span className="text-green-700 dark:text-green-400">Done</span>
                        ) : (
                          line.pending
                        )}
                      </td>
                      <td className={`${td} text-center text-gray-500 dark:text-gray-400`}>{line.unitOfMeasure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="goods-receipt-editor__items">
        <div className="goods-receipt-editor__section-title">
          <h3>Received items</h3>
          <span>
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        {loadingItems && <p className="goods-receipt-editor__empty">Loading purchase order items…</p>}
        {!loadingItems && !items.length && (
          <p className="goods-receipt-editor__empty">
            {form.purchaseOrderId
              ? "Nothing left to receive on this purchase order."
              : "Select a purchase order to load its line items."}
          </p>
        )}

        {items.map((item, index) => {
          const max = maxFor(item, isEditing);
          return (
            <article className="goods-receipt-editor__item" key={String(item.id ?? item.purchaseOrderLineItemId ?? index)}>
              <header>
                <div>
                  <span>
                    {item.productCode || "PO line"}
                    {item.orderedQuantity != null && ` · Ordered ${item.orderedQuantity}`}
                    {max != null && ` · Can receive ${max}`}
                  </span>
                  <h4 className="!font-semibold text-gray-900 dark:text-gray-100">{item.productName || "Product"}</h4>
                </div>
              </header>
              <div className="goods-receipt-editor__quantities">
                <label>
                  Ordered quantity
                  {/* Grey, so it doesn't look like a box you can type in. */}
                  <input
                    value={item.orderedQuantity ?? ""}
                    readOnly
                    tabIndex={-1}
                    aria-readonly="true"
                    title="Quantity from the purchase order"
                    className="!cursor-default !bg-gray-50 !text-gray-500 dark:!bg-gray-800/60 dark:!text-gray-400"
                  />
                </label>
                <label>
                  Received quantity
                  <input
                    required
                    min="0"
                    max={max}
                    type="number"
                    value={item.receivedQuantity}
                    onKeyDown={(event) => ["-", "+", "e", "E"].includes(event.key) && event.preventDefault()}
                    onWheel={(event) => (event.target as HTMLInputElement).blur()}
                    onChange={(event) => updateReceived(index, event.target.value)}
                  />
                </label>
                <label>
                  Accepted quantity
                  <input
                    type="number"
                    required
                    min="0"
                    max={num(item.receivedQuantity)}
                    value={item.acceptedQuantity}
                    onKeyDown={(event) => ["-", "+", "e", "E"].includes(event.key) && event.preventDefault()}
                    onWheel={(event) => (event.target as HTMLInputElement).blur()}
                    onChange={(event) => updateAccepted(index, event.target.value)}
                    // Hint moved to a tooltip, so all four boxes stay the same height.
                    title="Rejected quantity updates automatically"
                  />
                </label>
                <label>
                  Rejected quantity
                  <input
                    required
                    min="0"
                    type="number"
                    value={item.rejectedQuantity}
                    onKeyDown={(event) => ["-", "+", "e", "E"].includes(event.key) && event.preventDefault()}
                    onWheel={(event) => (event.target as HTMLInputElement).blur()}
                    onChange={(event) => updateRejected(index, event.target.value)}
                  />
                </label>
              </div>
              {(() => {
                // Unknown tracking (product not found) → show every field, all optional, as before.
                const t = item.tracking;
                const showBatch = !t || t.batch;
                const showExpiry = !t || t.expiry;
                const showSerial = !t || t.serial;
                if (!showBatch && !showExpiry && !showSerial) {
                  return (
                    <p className="px-1 pb-1 text-xs text-gray-500 dark:text-gray-400">
                      No batch, expiry or serial tracking for this product.
                    </p>
                  );
                }
                return (
                  <div className="goods-receipt-editor__tracking">
                    {showBatch && (
                      <label>
                        Batch number{t?.batch && <span className="text-red-500"> *</span>}
                        <input
                          value={item.batchNumber || ""}
                          onChange={(event) => updateItem(index, { batchNumber: event.target.value.trim().toUpperCase() || null })}
                          placeholder={t?.batch ? "e.g. B2026-10" : "Optional"}
                        />
                      </label>
                    )}
                    {showBatch && (
                      <label>
                        Manufacturing date
                        <input
                          type="date"
                          value={item.manufacturingDate || ""}
                          onChange={(event) => updateItem(index, { manufacturingDate: event.target.value || null })}
                        />
                      </label>
                    )}
                    {showExpiry && (
                      <label>
                        Expiry date{t?.expiry && <span className="text-red-500"> *</span>}
                        <input
                          type="date"
                          min={item.manufacturingDate || undefined}
                          value={item.expiryDate || ""}
                          onChange={(event) => updateItem(index, { expiryDate: event.target.value || null })}
                        />
                      </label>
                    )}
                    {showSerial && (
                      <div className="goods-receipt-editor__serials">
                        <SerialInputs
                          count={num(item.acceptedQuantity)}
                          required={Boolean(t?.serial)}
                          values={item.serialNumbers}
                          onChange={(serialNumbers) => updateItem(index, { serialNumbers })}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
            </article>
          );
        })}
      </section>

      {/* Same footer and buttons as every other create / edit drawer (styles from Dragger.css). */}
      <footer className="dragger__footer mt-6">
        <div className="dragger__footer-actions">
          <button type="button" className="dragger__cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="dragger__submit" disabled={submitting || loadingItems || !items.length}>
            {submitting ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </footer>
    </form>
  );
}
