import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowPathIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import type { PurchaseRecord } from "../Purchase/PurchaseResourcePage";
import { todayIso } from "../../utils/localDate";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";

const GRN_API = "/v1/api/purchase/grns";

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (Array.isArray((value as { content?: unknown[] })?.content)) return (value as { content: T[] }).content;
  if (Array.isArray((value as { data?: unknown[] })?.data)) return (value as { data: T[] }).data;
  return [];
};

/**
 * Retry for an accepted GRN whose goods did not reach Inventory (sync FAILED or never sent).
 * The server re-posts it and returns the receipt with its new sync status.
 */
export default function GoodsReceiptSyncAction({
  row,
  refreshRows,
  onReceive,
}: {
  row: PurchaseRecord;
  refreshRows: () => Promise<void>;
  onReceive?: (seed: PurchaseRecord) => void;
}) {
  // The retry is a POST, so it needs PURCHASE:CREATE like creating the receipt
  const { canCreate } = usePermissions("PURCHASE");
  const [busy, setBusy] = useState(false);
  const [hasPendingProduct, setHasPendingProduct] = useState(false);

  const status = String(row.status ?? "").toUpperCase();
  const sync = String(row.inventorySyncStatus ?? "").toUpperCase();
  const orderId = row.purchaseOrderId ?? row.purchaseOrder?.id;
  /** PO lines that belong to this GRN's products. */
  const matchingOrderLines = (order: PurchaseRecord) => {
    const lines = order.items || order.lineItems || order.purchaseOrderLineItems;
    const receiptLines = Array.isArray(row.items) ? row.items : row.lineItems;
    if (!Array.isArray(lines) || !Array.isArray(receiptLines)) return [];

    return lines.filter((line: PurchaseRecord) =>
      receiptLines.some((receiptLine: PurchaseRecord) => {
        const sameLine = receiptLine.purchaseOrderLineItemId != null &&
          String(line.id ?? line.purchaseOrderLineItemId) === String(receiptLine.purchaseOrderLineItemId);
        const sameProduct = receiptLine.productId != null && String(line.productId ?? line.product?.id) === String(receiptLine.productId);
        return sameLine || sameProduct;
      })
    );
  };
  /** Replacement pending = ordered quantity minus every accepted quantity, never minus rejected units. */
  const replacementLines = (order: PurchaseRecord, receipts: PurchaseRecord[]) =>
    matchingOrderLines(order).map((line: PurchaseRecord) => {
      const lineId = line.id ?? line.purchaseOrderLineItemId;
      const productId = line.productId ?? line.product?.id;
      const accepted = receipts
        .filter((receipt) => String(receipt.status || "").toUpperCase() !== "CANCELLED")
        .flatMap((receipt) => Array.isArray(receipt.items) ? receipt.items : receipt.lineItems || [])
        .filter((item: PurchaseRecord) =>
          String(item.purchaseOrderLineItemId) === String(lineId) || String(item.productId) === String(productId))
        .reduce((total: number, item: PurchaseRecord) => total + Number(item.acceptedQuantity || 0), 0);
      return { line, pending: Math.max(0, Number(line.quantity || 0) - accepted) };
    }).filter(({ pending }) => pending > 0);
  const isReceiptProduct = (receipt: PurchaseRecord) => {
    const candidateLines = Array.isArray(receipt.items) ? receipt.items : receipt.lineItems;
    const receiptLines = Array.isArray(row.items) ? row.items : row.lineItems;
    return Array.isArray(candidateLines) && Array.isArray(receiptLines) && candidateLines.some((candidate: PurchaseRecord) =>
      receiptLines.some((line: PurchaseRecord) =>
        (line.purchaseOrderLineItemId != null && String(candidate.purchaseOrderLineItemId) === String(line.purchaseOrderLineItemId)) ||
        (line.productId != null && String(candidate.productId) === String(line.productId))
      )
    );
  };
  useEffect(() => {
    let cancelled = false;
    setHasPendingProduct(false);
    if (!canCreate || status !== "ACCEPTED" || !orderId) return undefined;

    Promise.all([
      axios.get(`/v1/api/purchase/purchase-orders/${orderId}`),
      axios.get(GRN_API, { params: { purchaseOrderId: orderId } }).catch(() => ({ data: [] })),
    ]).then(([orderResponse, receiptsResponse]) => {
        if (!cancelled) setHasPendingProduct(replacementLines(orderResponse.data, asArray<PurchaseRecord>(receiptsResponse.data)).length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasPendingProduct(false);
      });

    return () => { cancelled = true; };
  }, [canCreate, orderId, row.items, row.lineItems, status]);

  if (!canCreate || status !== "ACCEPTED") return null;
  const canReceive = Boolean(onReceive && orderId && hasPendingProduct);
  const receive = async () => {
    setBusy(true);
    try {
      const [orderResponse, receiptsResponse] = await Promise.all([
        axios.get(`/v1/api/purchase/purchase-orders/${orderId}`),
        axios.get(GRN_API, { params: { purchaseOrderId: orderId } }).catch(() => ({ data: [] })),
      ]);
      const data = orderResponse.data;
      const receipts = asArray<PurchaseRecord>(receiptsResponse.data);
      const pendingLines = replacementLines(data, receipts);
      if (!["APPROVED", "SENT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(String(data.status).toUpperCase()) || !pendingLines.length) {
        ToasterService.error("This GRN's products have no replacement quantity pending.");
        return;
      }
      const latest = receipts
        .filter((receipt) => String(receipt.purchaseOrderId ?? receipt.purchaseOrder?.id) === String(orderId) && isReceiptProduct(receipt))
        .sort((a, b) => String(b.updatedDate ?? b.receiptDate ?? "").localeCompare(String(a.updatedDate ?? a.receiptDate ?? "")))[0];
      const latestItems = Array.isArray(latest?.items) ? latest.items : latest?.lineItems;
      const reviewItems = Array.isArray(latestItems) ? latestItems.filter((item: PurchaseRecord) =>
        (Array.isArray(row.items) ? row.items : row.lineItems || []).some((line: PurchaseRecord) =>
          String(line.purchaseOrderLineItemId) === String(item.purchaseOrderLineItemId) || String(line.productId) === String(item.productId)
        )) : [];
      onReceive?.({ purchaseOrderId: orderId, warehouseId: row.warehouseId ?? row.warehouse?.id ?? "",
        receiptDate: todayIso(), items: pendingLines.map(({ line, pending }, index) => ({
          id: `replacement-${line.id ?? index}`,
          purchaseOrderLineItemId: line.id ?? line.purchaseOrderLineItemId,
          productId: line.productId ?? line.product?.id,
          productName: line.productName ?? line.product?.productName ?? "Product",
          productCode: line.productCode ?? line.product?.productCode ?? "",
          orderedQuantity: Number(line.quantity || 0), pendingQuantity: pending,
          receivedQuantity: "", acceptedQuantity: "", rejectedQuantity: 0, serialNumbers: [],
        })),
        lastGrnReview: latest ? {
          receiptNumber: latest.receiptNumber,
          updatedDate: latest.updatedDate ?? latest.receiptDate,
          receivedQuantity: reviewItems.reduce((total: number, item: PurchaseRecord) => total + Number(item.receivedQuantity || 0), 0),
          acceptedQuantity: reviewItems.reduce((total: number, item: PurchaseRecord) => total + Number(item.acceptedQuantity || 0), 0),
        } : undefined });
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      ToasterService.error(data?.message || "Could not check the purchase order's pending quantities.");
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setBusy(true);
    try {
      const response = await axios.post(`${GRN_API}/${row.id}/retry-inventory-sync`);
      const name = String(row.receiptNumber || "Receipt");
      const result = String(response.data?.inventorySyncStatus || "").toUpperCase();
      if (result === "SYNCED") {
        ToasterService.success(`${name}: goods added to stock`);
      } else if (["FAILED", "ERROR"].includes(result) || response.data?.inventorySyncError) {
        ToasterService.error(`${name}: inventory sync failed. ${response.data?.inventorySyncError || "Please retry shortly."}`);
      } else {
        ToasterService.success(`${name}: inventory sync retry was accepted and is being processed.`);
      }
      await refreshRows();
    } catch (err) {
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      ToasterService.error(data?.message || data?.error || "Could not post the receipt to Inventory");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    {canReceive && <button type="button" disabled={busy}
      onClick={(event) => { event.stopPropagation(); receive(); }}
      title="Receive Pending Goods — create a new receipt" aria-label="Receive Pending Goods"
      className="inline-flex items-center gap-1 rounded-lg p-2 text-xs font-medium text-cyan-600 hover:bg-cyan-50 disabled:opacity-50">
      <PencilSquareIcon className="h-4 w-4" aria-hidden="true" /> Receive Pending
    </button>}
    {sync !== "SYNCED" && <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        retry();
      }}
      title="Retry posting to Inventory"
      aria-label="Retry posting to Inventory"
      className="rounded-lg p-2 text-amber-500 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
    >
      <ArrowPathIcon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
    </button>}
    </>
  );
}
