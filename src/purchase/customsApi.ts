// Purchase → Customs (backlog 7.2.1 step 2): HS tariff, customs settings and declarations for arrived shipments.
import axios from "axios";

const BASE = "/v1/api/purchase/customs";

export interface CustomsSettings { defaultDutyRate: number; importVatRate: number; customsVendorId: number | null; customsVendorName: string | null }
export interface HsTariff { id: number; hsCode: string; description: string | null; dutyRate: number }

export interface DeclarationLine {
  purchaseOrderLineItemId: number;
  poNumber: string | null;
  productId: number | null;
  productCode: string | null;
  productName: string | null;
  hsCode: string | null;
  quantity: number;
  goodsValue: number;
  freightShare: number;
  insuranceShare: number;
  otherShare: number;
  customsValue: number;
  dutyRate: number;
  // The HS entry used, DEFAULT, NO_HS_CODE or MANUAL
  rateSource: string;
  dutyAmount: number;
  vatAmount: number;
}

export interface Declaration {
  id: number;
  entryNumber: string;
  declarationDate: string;
  shipmentId: number;
  shipmentNumber: string | null;
  customsOffice: string | null;
  currency: string | null;
  exchangeRate: number;
  freightAmount: number;
  insuranceAmount: number;
  otherAmount: number;
  importVatRate: number;
  payeeVendorId: number | null;
  payeeVendorName: string | null;
  status: "DRAFT" | "POSTED";
  customsValue: number;
  dutyAmount: number;
  vatAmount: number;
  totalPayable: number;
  landedCostId: number | null;
  landedCostNumber: string | null;
  postedAt: string | null;
  postedBy: string | null;
  lines: DeclarationLine[];
}

export interface DeclarationRequest {
  shipmentId: number;
  entryNumber: string;
  declarationDate: string | null;
  customsOffice: string | null;
  exchangeRate: number | null;
  freightAmount: number | null;
  insuranceAmount: number | null;
  otherAmount: number | null;
  importVatRate: number | null;
  payeeVendorId: number | null;
  lines: { purchaseOrderLineItemId: number; hsCode: string | null; dutyRate: number | null }[];
}

export const customsApi = {
  settings: () => axios.get<CustomsSettings>(`${BASE}/settings`).then((r) => r.data),
  saveSettings: (body: { defaultDutyRate: number; importVatRate: number; customsVendorId: number | null }) =>
    axios.put<CustomsSettings>(`${BASE}/settings`, body).then((r) => r.data),
  tariffs: () => axios.get<HsTariff[]>(`${BASE}/tariffs`).then((r) => r.data),
  saveTariff: (id: number | null, body: { hsCode: string; description: string | null; dutyRate: number }) =>
    (id ? axios.put<HsTariff>(`${BASE}/tariffs/${id}`, body) : axios.post<HsTariff>(`${BASE}/tariffs`, body)).then((r) => r.data),
  deleteTariff: (id: number) => axios.delete(`${BASE}/tariffs/${id}`),
  declarations: (shipmentId?: number) =>
    axios.get<Declaration[]>(`${BASE}/declarations`, { params: { shipmentId } }).then((r) => r.data),
  save: (id: number | null, body: DeclarationRequest) =>
    (id ? axios.put<Declaration>(`${BASE}/declarations/${id}`, body) : axios.post<Declaration>(`${BASE}/declarations`, body)).then((r) => r.data),
  remove: (id: number) => axios.delete(`${BASE}/declarations/${id}`),
  post: (id: number) => axios.post<Declaration>(`${BASE}/declarations/${id}/post`).then((r) => r.data),
};
