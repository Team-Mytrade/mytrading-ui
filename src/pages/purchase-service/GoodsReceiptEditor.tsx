import React, { useEffect, useState } from "react";
import axios from "axios";
import { PurchaseRecord, SelectOption } from "../Purchase/PurchaseResourcePage";
import "../../styles/GoodsReceiptEditor.css";

type GrnItem = { purchaseOrderLineItemId: number | string; productName?: string; receivedQuantity: number | string; acceptedQuantity: number | string; rejectedQuantity: number | string; batchNumber: string | null; manufacturingDate: string | null; expiryDate: string | null; serialNumbers: string[]; };
type Props = { form: PurchaseRecord; purchaseOrders: SelectOption[]; warehouses: SelectOption[]; isEditing: boolean; onChange: (name: string, value: any) => void; onCancel: () => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; submitting: boolean; };

const asItems = (order: PurchaseRecord): GrnItem[] => (order.items || order.lineItems || order.purchaseOrderLineItems || []).map((line: PurchaseRecord) => ({
  purchaseOrderLineItemId: line.id ?? line.purchaseOrderLineItemId,
  productName: line.product?.productName || line.productName || line.product?.name || `Line item #${line.id}`,
  receivedQuantity: line.quantity ?? 0, acceptedQuantity: line.quantity ?? 0, rejectedQuantity: 0,
  batchNumber: null, manufacturingDate: null, expiryDate: null, serialNumbers: [],
}));

/** In-page GRN receipt form. Its submitted fields map exactly to the GRN API payload. */
export default function GoodsReceiptEditor({ form, purchaseOrders, warehouses, isEditing, onChange, onCancel, onSubmit, submitting }: Props) {
  const [loadingItems, setLoadingItems] = useState(false);
  const items = Array.isArray(form.items) ? form.items as GrnItem[] : [];
  const loadItems = async (id: string) => {
    onChange("purchaseOrderId", id);
    if (!id) return onChange("items", []);
    const cached = purchaseOrders.find((order) => String(order.value) === id)?.raw;
    if (cached && asItems(cached).length) return onChange("items", asItems(cached));
    try { setLoadingItems(true); const response = await axios.get(`/v1/api/purchase/purchase-orders/${id}`); onChange("items", asItems(response.data || {})); }
    finally { setLoadingItems(false); }
  };
  useEffect(() => { if (!isEditing && form.purchaseOrderId && !items.length) loadItems(String(form.purchaseOrderId)); /* initialise selected PO */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, form.purchaseOrderId]);
  const updateItem = (index: number, key: keyof GrnItem, value: any) => onChange("items", items.map((item, current) => current === index ? { ...item, [key]: value } : item));
  const updateReceived = (index: number, value: string) => { const received = Number(value || 0); updateItem(index, "receivedQuantity", received); updateItem(index, "acceptedQuantity", received - Number(items[index].rejectedQuantity || 0)); };

  return <form className="goods-receipt-editor" onSubmit={onSubmit}>
    <section className="goods-receipt-editor__receipt"><div className="goods-receipt-editor__receipt-head"><span>GRN RECEIPT</span><time>{form.receiptDate || "--"}</time></div><div className="goods-receipt-editor__controls">
      <label>Purchase order<select required disabled={isEditing} value={form.purchaseOrderId || ""} onChange={(event) => loadItems(event.target.value)}><option value="">Select purchase order</option>{purchaseOrders.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></label>
      <label>Warehouse<select required value={form.warehouseId || ""} onChange={(event) => onChange("warehouseId", event.target.value)}><option value="">Select warehouse</option>{warehouses.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></label>
      <label>Receipt date<input required type="date" value={form.receiptDate || ""} onChange={(event) => onChange("receiptDate", event.target.value)} /></label>
    </div></section>
    <section className="goods-receipt-editor__items"><div className="goods-receipt-editor__section-title"><h3>Received items</h3><span>{items.length} item{items.length === 1 ? "" : "s"}</span></div>{loadingItems && <p className="goods-receipt-editor__empty">Loading purchase order items…</p>}{!loadingItems && !items.length && <p className="goods-receipt-editor__empty">Select a purchase order to load its line items.</p>}
      {items.map((item, index) => <article className="goods-receipt-editor__item" key={String(item.purchaseOrderLineItemId)}><header><div><span>PO line #{item.purchaseOrderLineItemId}</span><h4>{item.productName || "Product"}</h4></div></header><div className="goods-receipt-editor__quantities"><label>Received quantity<input required min="0" type="number" value={item.receivedQuantity} onChange={(event) => updateReceived(index, event.target.value)} /></label><label>Accepted quantity<input required min="0" type="number" value={item.acceptedQuantity} onChange={(event) => updateItem(index, "acceptedQuantity", event.target.value)} /></label><label>Rejected quantity<input required min="0" type="number" value={item.rejectedQuantity} onChange={(event) => updateItem(index, "rejectedQuantity", event.target.value)} /></label></div><div className="goods-receipt-editor__tracking"><label>Batch number<input value={item.batchNumber || ""} onChange={(event) => updateItem(index, "batchNumber", event.target.value || null)} placeholder="Optional" /></label><label>Manufacturing date<input type="date" value={item.manufacturingDate || ""} onChange={(event) => updateItem(index, "manufacturingDate", event.target.value || null)} /></label><label>Expiry date<input type="date" value={item.expiryDate || ""} onChange={(event) => updateItem(index, "expiryDate", event.target.value || null)} /></label><label className="goods-receipt-editor__serials">Serial numbers<textarea value={item.serialNumbers.join("\n")} onChange={(event) => updateItem(index, "serialNumbers", event.target.value.split(/[\n,]/).map((serial) => serial.trim()).filter(Boolean))} placeholder="One serial number per line" rows={2} /></label></div></article>)}</section>
    <footer className="goods-receipt-editor__footer"><button type="button" className="goods-receipt-editor__cancel" onClick={onCancel}>Cancel</button><button type="submit" className="goods-receipt-editor__submit" disabled={submitting || !items.length}>{submitting ? "Saving…" : isEditing ? "Update receipt" : "Create GRN"}</button></footer>
  </form>;
}
