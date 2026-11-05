// Purchase → Inbound Shipments (backlog 7.2.1): orders travelling together, tracked to arrival and received.
import axios from "axios";

const BASE = "/v1/api/purchase/shipments";

export const SHIPMENT_MODES = ["SEA", "AIR", "ROAD", "RAIL", "COURIER"] as const;
export const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;
export const CONTAINER_TYPES = ["20GP", "40GP", "40HC", "45HC", "20RF", "40RF", "20OT", "40OT", "20FR", "40FR", "LCL"] as const;
export const SHIPMENT_FLOW = ["BOOKED", "IN_TRANSIT", "ARRIVED", "CLEARED", "RECEIVED"] as const;
export type ShipmentStatus = (typeof SHIPMENT_FLOW)[number] | "CANCELLED";

export interface ShipmentContainer { containerNumber: string | null; containerType: string; sealNumber: string | null }

export interface ShipmentLine {
  purchaseOrderLineItemId: number;
  purchaseOrderId: number;
  poNumber: string | null;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  unitOfMeasure: string | null;
  quantity: number;
  received: number;
  open: number;
}

export interface ShipmentEvent { status: string; date: string | null; note: string | null; recordedBy: string | null; recordedAt: string | null }
export interface ShipmentReceipt { id: number; receiptNumber: string; receiptDate: string | null; poNumber: string | null; status: string }
export interface ShipmentLandedCost { id: number; voucherNumber: string; voucherDate: string | null; status: string; totalCharges: number }

export interface Shipment {
  id: number;
  shipmentNumber: string;
  vendorId: number;
  vendorName: string | null;
  mode: string;
  incoterm: string | null;
  carrier: string | null;
  transportDocument: string | null;
  vesselVoyage: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  originCountry: string | null;
  etd: string | null;
  eta: string | null;
  departedOn: string | null;
  arrivedOn: string | null;
  clearedOn: string | null;
  status: ShipmentStatus;
  overdue: boolean;
  notes: string | null;
  containers: ShipmentContainer[];
  lines: ShipmentLine[];
  events: ShipmentEvent[];
  receipts: ShipmentReceipt[];
  landedCosts: ShipmentLandedCost[];
  totalQuantity: number;
  receivedQuantity: number;
}

export interface OpenLine {
  purchaseOrderLineItemId: number;
  purchaseOrderId: number;
  poNumber: string | null;
  expectedDeliveryDate: string | null;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  unitOfMeasure: string | null;
  ordered: number;
  received: number;
  onShipments: number;
  open: number;
}

export interface ShipmentRequest {
  vendorId: number | null;
  mode: string;
  incoterm: string | null;
  carrier: string | null;
  transportDocument: string | null;
  vesselVoyage: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  originCountry: string | null;
  etd: string | null;
  eta: string | null;
  notes: string | null;
  containers: ShipmentContainer[];
  lines: { purchaseOrderLineItemId: number; quantity: number }[] | null;
}

export interface ReceiveLine {
  purchaseOrderLineItemId: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  batchNumber: string | null;
  expiryDate: string | null;
  serialNumbers: string[] | null;
  remarks: string | null;
}

export const shipmentApi = {
  list: () => axios.get<Shipment[]>(BASE).then((r) => r.data),
  get: (id: number) => axios.get<Shipment>(`${BASE}/${id}`).then((r) => r.data),
  openLines: (vendorId: number, shipmentId?: number | null) =>
    axios.get<OpenLine[]>(`${BASE}/open-lines`, { params: { vendorId, shipmentId: shipmentId ?? undefined } }).then((r) => r.data),
  save: (id: number | null, body: ShipmentRequest) =>
    (id ? axios.put<Shipment>(`${BASE}/${id}`, body) : axios.post<Shipment>(BASE, body)).then((r) => r.data),
  move: (id: number, status: string, date: string | null, note: string | null) =>
    axios.post<Shipment>(`${BASE}/${id}/status`, { status, date, note }).then((r) => r.data),
  cancel: (id: number, note: string) => axios.post<Shipment>(`${BASE}/${id}/cancel`, { note }).then((r) => r.data),
  receive: (id: number, body: { receiptDate: string | null; warehouseId: number; remarks: string | null; lines: ReceiveLine[] }) =>
    axios.post<Shipment>(`${BASE}/${id}/receive`, body).then((r) => r.data),
};

/** "IN_TRANSIT" → "In transit". */
export const statusLabel = (status: string) => {
  const text = status.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Shipment statuses have their own words ("Cleared" alone already means a cleared cheque in the translations)
const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  BOOKED: "Booked", IN_TRANSIT: "In transit", ARRIVED: "Arrived", CLEARED: "Customs cleared", RECEIVED: "Fully received", CANCELLED: "Cancelled",
};
export const shipmentStatusLabel = (status: string) => SHIPMENT_STATUS_LABEL[status] ?? statusLabel(status);

export const STATUS_TONE: Record<string, string> = {
  BOOKED: "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-200",
  IN_TRANSIT: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  ARRIVED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  CLEARED: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  RECEIVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
};
