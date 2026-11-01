// Purchase → Requests for Quotation: quotes from several vendors, compared and awarded per line.
import axios from "axios";

export const RFQ_BASE = "/v1/api/purchase/rfqs";

export interface RfqOffer {
  rfqVendorId: number;
  unitPrice: number;
  currency: string | null;
  companyPrice: number | null;
  leadTimeDays: number | null;
  remarks: string | null;
  best: boolean;
}

export interface RfqLine {
  id: number;
  productId: number;
  productCode: string | null;
  productName: string | null;
  uom: string | null;
  quantity: number;
  remarks: string | null;
  offers: RfqOffer[];
  awardedRfqVendorId: number | null;
  awardedUnitPrice: number | null;
  purchaseOrderNumber: string | null;
}

export interface RfqVendor {
  id: number;
  vendorId: number;
  vendorCode: string | null;
  vendorName: string | null;
  currency: string | null;
  status: "INVITED" | "QUOTED" | "DECLINED";
  sentAt: string | null;
  sentTo: string | null;
  quoteReference: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  notes: string | null;
  quotedTotal: number | null;
  quotedTotalCompany: number | null;
  linesQuoted: number;
}

export interface Rfq {
  id: number;
  rfqNumber: string;
  title: string | null;
  rfqDate: string;
  responseDueDate: string | null;
  requisitionId: number | null;
  requisitionNumber: string | null;
  status: "DRAFT" | "SENT" | "AWARDED" | "CANCELLED";
  notes: string | null;
  companyCurrency: string | null;
  lines: RfqLine[];
  vendors: RfqVendor[];
  purchaseOrders: string[];
  awardedAt: string | null;
  awardedBy: string | null;
}

export interface RfqRequest {
  title: string | null;
  rfqDate: string | null;
  responseDueDate: string | null;
  requisitionId: number | null;
  notes: string | null;
  lines: { productId: number; quantity: number; remarks: string | null }[];
  vendorIds: number[];
}

export interface QuoteRequest {
  quoteReference: string | null;
  quoteDate: string | null;
  validUntil: string | null;
  currency: string | null;
  notes: string | null;
  declined: boolean;
  lines: { rfqLineId: number; unitPrice: number | null; leadTimeDays: number | null; remarks: string | null }[];
}

export const rfqApi = {
  list: () => axios.get<Rfq[]>(RFQ_BASE).then((r) => r.data),
  get: (id: number) => axios.get<Rfq>(`${RFQ_BASE}/${id}`).then((r) => r.data),
  save: (id: number | null, body: RfqRequest) =>
    (id ? axios.put<Rfq>(`${RFQ_BASE}/${id}`, body) : axios.post<Rfq>(RFQ_BASE, body)).then((r) => r.data),
  cancel: (id: number) => axios.post<Rfq>(`${RFQ_BASE}/${id}/cancel`).then((r) => r.data),
  markSent: (id: number, vendorRow: number) => axios.put<Rfq>(`${RFQ_BASE}/${id}/vendors/${vendorRow}/sent`).then((r) => r.data),
  quote: (id: number, vendorRow: number, body: QuoteRequest) =>
    axios.post<Rfq>(`${RFQ_BASE}/${id}/vendors/${vendorRow}/quote`, body).then((r) => r.data),
  award: (id: number, lines: { rfqLineId: number; rfqVendorId: number }[]) =>
    axios.post<Rfq>(`${RFQ_BASE}/${id}/award`, { lines }).then((r) => r.data),
};
