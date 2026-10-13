import React, { useEffect, useState } from "react";
import axios from "axios";
import { PurchaseRecord, SelectOption } from "../Purchase/PurchaseResourcePage";
import { ToasterService } from "../../Services/ToasterService";
import "../../styles/GoodsReceiptEditor.css";

type GrnItem = {
  purchaseOrderLineItemId: number | string;
  productName?: string;
  orderedQuantity?: number;
  pendingQuantity?: number;
  receivedQuantity: number | string;
  acceptedQuantity: number | string;
  rejectedQuantity: number | string;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  serialNumbers: string[];
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

const num = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Quantity still to be received on a PO line (uses backend values when they are provided). */
const pendingFor = (line: PurchaseRecord) => {
  if (line.pendingQuantity != null) return Math.max(0, num(line.pendingQuantity));
  return Math.max(0, num(line.quantity) - num(line.receivedQuantity));
};

/** Turns PO lines into GRN lines, defaulting each line to the quantity still pending. */
const asItems = (order: PurchaseRecord): GrnItem[] =>
  (order.items || order.lineItems || order.purchaseOrderLineItems || [])
    .map((line: PurchaseRecord) => {
      const pending = pendingFor(line);
      return {
        purchaseOrderLineItemId: line.id ?? line.purchaseOrderLineItemId,
        productName:
          line.productName || line.product?.productName || line.product?.name || `Line item #${line.id}`,
        orderedQuantity: num(line.quantity),
        pendingQuantity: pending,
        receivedQuantity: pending,
        acceptedQuantity: pending,
        rejectedQuantity: 0,
        batchNumber: null,
        manufacturingDate: null,
        expiryDate: null,
        serialNumbers: [],
      };
    })
    // Lines with nothing left to receive are left out.
    .filter((item: GrnItem) => item.pendingQuantity !== 0);

/** Returns an error message for the first invalid line, or null when all lines are valid. */
const validateItems = (items: GrnItem[]): string | null => {
  if (!items.length) return "This purchase order has nothing left to receive.";

  for (const item of items) {
    const name = item.productName || `Line #${item.purchaseOrderLineItemId}`;
    const received = num(item.receivedQuantity);
    const accepted = num(item.acceptedQuantity);
    const rejected = num(item.rejectedQuantity);

    if (received <= 0) return `${name}: received quantity must be more than 0.`;
    if (accepted < 0 || rejected < 0) return `${name}: quantities cannot be negative.`;
    if (accepted + rejected !== received) {
      return `${name}: accepted (${accepted}) + rejected (${rejected}) must equal received (${received}).`;
    }
    if (item.pendingQuantity != null && received > item.pendingQuantity) {
      return `${name}: only ${item.pendingQuantity} still to receive on this PO line.`;
    }
    if (item.manufacturingDate && item.expiryDate && item.expiryDate <= item.manufacturingDate) {
      return `${name}: expiry date must be after the manufacturing date.`;
    }

    const serials = item.serialNumbers;
    if (serials.length) {
      if (new Set(serials).size !== serials.length) return `${name}: the same serial number is entered twice.`;
      if (serials.length !== accepted) {
        return `${name}: enter exactly ${accepted} serial number(s), one for each accepted unit.`;
      }
    }
  }
  return null;
};

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
  const items = Array.isArray(form.items) ? (form.items as GrnItem[]) : [];

  const loadItems = async (id: string) => {
    onChange("purchaseOrderId", id);
    if (!id) return onChange("items", []);

    // Always load the PO fresh, so pending quantities reflect earlier GRNs.
    try {
      setLoadingItems(true);
      const response = await axios.get(`/v1/api/purchase/purchase-orders/${id}`);
      const order = response.data || {};
      onChange("items", asItems(order));
      if (order.warehouseId && !form.warehouseId) onChange("warehouseId", String(order.warehouseId));
    } catch (error) {
      const cached = purchaseOrders.find((option) => String(option.value) === id)?.raw;
      onChange("items", cached ? asItems(cached) : []);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (!isEditing && form.purchaseOrderId && !items.length) loadItems(String(form.purchaseOrderId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form.purchaseOrderId]);

  /** Updates several fields of one line in a single change (two separate updates would overwrite each other). */
  const updateItem = (index: number, changes: Partial<GrnItem>) =>
    onChange("items", items.map((item, current) => (current === index ? { ...item, ...changes } : item)));

  // Received or rejected changes keep accepted = received - rejected.
  const updateReceived = (index: number, value: string) => {
    const received = num(value);
    updateItem(index, {
      receivedQuantity: value,
      acceptedQuantity: Math.max(0, received - num(items[index].rejectedQuantity)),
    });
  };
  const updateRejected = (index: number, value: string) => {
    const rejected = num(value);
    updateItem(index, {
      rejectedQuantity: value,
      acceptedQuantity: Math.max(0, num(items[index].receivedQuantity) - rejected),
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const error = validateItems(items);
    if (error) {
      event.preventDefault();
      ToasterService.error(error);
      return;
    }
    onSubmit(event);
  };

  return (
    <form className="goods-receipt-editor" onSubmit={handleSubmit}>
      <section className="goods-receipt-editor__receipt">
        <div className="goods-receipt-editor__receipt-head">
          <span>GRN RECEIPT</span>
          <time>{form.receiptDate || "--"}</time>
        </div>
        <div className="goods-receipt-editor__controls">
          <label>
            Purchase order
            <select
              required
              disabled={isEditing}
              value={form.purchaseOrderId || ""}
              onChange={(event) => loadItems(event.target.value)}
            >
              <option value="">Select purchase order</option>
              {purchaseOrders.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
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

        {items.map((item, index) => (
          <article className="goods-receipt-editor__item" key={String(item.purchaseOrderLineItemId)}>
            <header>
              <div>
                <span>
                  PO line #{item.purchaseOrderLineItemId}
                  {item.orderedQuantity != null && ` · Ordered ${item.orderedQuantity}`}
                  {item.pendingQuantity != null && ` · Pending ${item.pendingQuantity}`}
                </span>
                <h4>{item.productName || "Product"}</h4>
              </div>
            </header>
            <div className="goods-receipt-editor__quantities">
              <label>
                Received quantity
                <input
                  required
                  min="0"
                  max={item.pendingQuantity}
                  type="number"
                  value={item.receivedQuantity}
                  onChange={(event) => updateReceived(index, event.target.value)}
                />
              </label>
              <label>
                Accepted quantity
                <input
                  required
                  min="0"
                  type="number"
                  value={item.acceptedQuantity}
                  onChange={(event) => updateItem(index, { acceptedQuantity: event.target.value })}
                />
              </label>
              <label>
                Rejected quantity
                <input
                  required
                  min="0"
                  type="number"
                  value={item.rejectedQuantity}
                  onChange={(event) => updateRejected(index, event.target.value)}
                />
              </label>
            </div>
            <div className="goods-receipt-editor__tracking">
              <label>
                Batch number
                <input
                  value={item.batchNumber || ""}
                  onChange={(event) => updateItem(index, { batchNumber: event.target.value.trim() || null })}
                  placeholder="Optional"
                />
              </label>
              <label>
                Manufacturing date
                <input
                  type="date"
                  value={item.manufacturingDate || ""}
                  onChange={(event) => updateItem(index, { manufacturingDate: event.target.value || null })}
                />
              </label>
              <label>
                Expiry date
                <input
                  type="date"
                  value={item.expiryDate || ""}
                  onChange={(event) => updateItem(index, { expiryDate: event.target.value || null })}
                />
              </label>
              <label className="goods-receipt-editor__serials">
                Serial numbers
                <textarea
                  value={item.serialNumbers.join("\n")}
                  onChange={(event) =>
                    updateItem(index, {
                      serialNumbers: event.target.value
                        .split(/[\n,]/)
                        .map((serial) => serial.trim().toUpperCase())
                        .filter(Boolean),
                    })
                  }
                  placeholder="One serial number per line"
                  rows={2}
                />
              </label>
            </div>
          </article>
        ))}
      </section>

      <footer className="goods-receipt-editor__footer">
        <button type="button" className="goods-receipt-editor__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="goods-receipt-editor__submit"
          disabled={submitting || loadingItems || !items.length}
        >
          {submitting ? "Saving…" : isEditing ? "Update receipt" : "Create GRN"}
        </button>
      </footer>
    </form>
  );
}
