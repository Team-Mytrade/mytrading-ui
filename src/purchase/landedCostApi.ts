// Purchase → Landed Costs: freight, duty and insurance spread over goods receipts.
import axios from "axios";

const BASE = "/v1/api/purchase/landed-costs";

export const CHARGE_TYPES = ["FREIGHT", "DUTY", "INSURANCE", "CLEARING", "HANDLING", "OTHER"] as const;

export interface LandedCostReceipt {
  id: number;
  receiptNumber: string;
  receiptDate: string | null;
  poNumber: string | null;
  vendorName: string | null;
  value: number | null;
}

export interface LandedCostCharge {
  id?: number;
  chargeType: string;
  description: string | null;
  amount: number;
  taxAmount: number | null;
  vendorId: number | null;
  vendorName?: string | null;
  billNumber: string | null;
  billDate: string | null;
  billId?: number | null;
}

export interface LandedCostAllocation {
  grnNumber: string;
  productCode: string | null;
  productName: string | null;
  quantity: number;
  lineValue: number | null;
  amount: number;
  perUnit: number | null;
}

export interface LandedCostVoucher {
  id: number;
  voucherNumber: string;
  voucherDate: string;
  allocationMethod: "VALUE" | "QUANTITY";
  status: "DRAFT" | "POSTED";
  notes: string | null;
  receipts: LandedCostReceipt[];
  charges: LandedCostCharge[];
  allocations: LandedCostAllocation[];
  totalCharges: number;
  onHandAmount: number | null;
  soldAmount: number | null;
  postedAt: string | null;
  postedBy: string | null;
}

export interface LandedCostRequest {
  voucherDate: string | null;
  allocationMethod: "VALUE" | "QUANTITY";
  notes: string | null;
  grnIds: number[];
  charges: Omit<LandedCostCharge, "id" | "vendorName" | "billId">[];
}

export const landedCostApi = {
  list: () => axios.get<LandedCostVoucher[]>(BASE).then((r) => r.data),
  receipts: () => axios.get<LandedCostReceipt[]>(`${BASE}/receipts`).then((r) => r.data),
  save: (id: number | null, body: LandedCostRequest) =>
    (id ? axios.put<LandedCostVoucher>(`${BASE}/${id}`, body) : axios.post<LandedCostVoucher>(BASE, body)).then((r) => r.data),
  post: (id: number) => axios.post<LandedCostVoucher>(`${BASE}/${id}/post`).then((r) => r.data),
  remove: (id: number) => axios.delete(`${BASE}/${id}`),
};
