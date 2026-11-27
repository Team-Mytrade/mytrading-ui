// Stock, promise dates, price list and margin floor on quote and deal lines (backlog 8.4.18 V2, 8.4.19 V3, 8.4.8 Q2),
// the company's pricing rules and price approval on quotations (8.4.7 Q1).
import axios from "axios";

export interface WarehouseStock {
  warehouseId: number;
  warehouseCode: string | null;
  warehouseName: string | null;
  onHand: number;
  reserved: number;
  free: number;
}

export interface IncomingGoods {
  quantity: number;
  expectedDate: string | null;
  late: boolean;
  /** SHIPMENT (an inbound shipment) or ORDER (the rest of an open purchase order). */
  source: "SHIPMENT" | "ORDER" | string;
  reference: string | null;
}

/** NOW: free stock covers it; ON_DATE: once goods due by promiseDate arrive; NO_DATE: only goods with no date yet; SHORT. */
export type Promise_ = "NOW" | "ON_DATE" | "NO_DATE" | "SHORT";

export interface LineStock {
  onHand: number;
  reserved: number;
  free: number;
  warehouses: WarehouseStock[];
  incoming: IncomingGoods[];
  incomingTotal: number;
  /** False: purchase couldn't be asked, so incoming goods aren't counted. */
  incomingKnown: boolean;
  promise: Promise_;
  promiseDate: string | null;
  shortBy: number;
}

export interface LineCheck {
  /** 1-based position among the lines sent. */
  line: number;
  productId: number;
  quantity: number;
  listPrice: number | null;
  listSource: "CUSTOMER" | "PRICE_LIST" | "CATALOGUE" | null;
  priceListName: string | null;
  /** Per unit after every discount (the quotation's own shared out). */
  netPrice: number;
  belowList: boolean;
  /** False: cost, margin and floor price are not for this person (the flags stay). */
  costShown: boolean;
  costKnown: boolean;
  unitCost: number | null;
  marginPercent: number | null;
  floorPrice: number | null;
  belowFloor: boolean;
  /** None for services and products not kept in stock. */
  stock: LineStock | null;
}

export interface CheckResult {
  currencyCode: string | null;
  marginFloorPercent: number | null;
  priceListApproval: boolean;
  costShown: boolean;
  costChecked: boolean;
  stockKnown: boolean;
  marginPercent: number | null;
  needsApproval: boolean;
  reasons: string[];
  lines: LineCheck[];
}

export interface QuoteLineInput {
  productId: number;
  quantity: number;
  unitPrice: number | null;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  additionalDiscount?: number | null;
  /** COM-2: base units in one of the line's unit (24 for a CARTON of 24); stock and costs are checked in base units. */
  unitFactor?: number | null;
}

export interface PricingRules {
  marginFloorPercent: number | null;
  priceListApproval: boolean;
}

export type PriceApproval = "PENDING" | "APPROVED" | "REJECTED" | null;

/** What a quotation carries about its price approval (QuotationDTO). */
export interface PriceApprovalInfo {
  id?: number;
  quoteNumber?: string;
  priceApproval?: PriceApproval;
  priceApprovalReasons?: string[];
  priceApprovalAskedBy?: string | null;
  priceApprovalAskedAt?: string | null;
  priceApprovalByName?: string | null;
  priceApprovalAt?: string | null;
  priceApprovalNote?: string | null;
}

export const quoteCheckApi = {
  /** A quotation's lines (Sales). */
  quote: (body: {
    customerId: number | null;
    currencyCode: string | null;
    date: string | null;
    discountPercentage?: number | null;
    discountAmount?: number | null;
    additionalDiscount?: number | null;
    lines: QuoteLineInput[];
  }) => axios.post<CheckResult>("/v1/api/sales/quotations/line-check", body).then((r) => r.data),
  /** A deal's lines (CRM; a line without a price is judged at the price its quotation would take). */
  deal: (body: { customerId: number | null; currencyCode: string | null; lines: { productId: number; quantity: number; expectedPrice: number | null }[] }) =>
    axios.post<CheckResult>("/v1/api/crm/deals/line-check", body).then((r) => r.data),
  rules: () => axios.get<PricingRules>("/v1/api/sales/pricing-settings").then((r) => r.data),
  saveRules: (body: PricingRules) => axios.put<PricingRules>("/v1/api/sales/pricing-settings", body).then((r) => r.data),
  approve: (id: number, reason: string) =>
    axios.post(`/v1/api/sales/quotations/${id}/price-approval/approve`, { reason }).then((r) => r.data),
  reject: (id: number, reason: string) =>
    axios.post(`/v1/api/sales/quotations/${id}/price-approval/reject`, { reason }).then((r) => r.data),
};

/** Who may see cost and margin (as the server decides: QuoteCheckService.COST_VIEWERS). */
export const COST_VIEWERS = ["INVOICE:VIEW", "SALES:APPROVE"];
