// Sales → Price Lists: price lists, customer prices, and the prices quotation lines take from them.
import axios from "axios";

const BASE = "/v1/api/sales";

export interface PriceListItem {
  id?: number;
  productId: number;
  productCode?: string;
  productName?: string;
  /** The price applies from this quantity up. */
  minQuantity: number;
  unitPrice: number;
}

export interface PriceList {
  id: number;
  name: string;
  currencyCode: string;
  validFrom: string | null;
  validTo: string | null;
  active: boolean;
  defaultList: boolean;
  notes: string | null;
  items: PriceListItem[];
  customerIds: number[];
}

export type PriceListRequest = Omit<PriceList, "id" | "items"> & { items: { productId: number; minQuantity: number; unitPrice: number }[] };

export interface CustomerPrice {
  id: number;
  customerId: number;
  customerName: string | null;
  productId: number;
  productCode: string | null;
  productName: string | null;
  currencyCode: string;
  unitPrice: number;
  validFrom: string | null;
  validTo: string | null;
}

export type CustomerPriceRequest = Pick<CustomerPrice, "customerId" | "productId" | "currencyCode" | "unitPrice" | "validFrom" | "validTo">;

/** CUSTOMER: agreed with the customer; PRICE_LIST: from their list; CATALOGUE: the product's selling price. */
export type PriceSource = "CUSTOMER" | "PRICE_LIST" | "CATALOGUE";

export interface LinePrice {
  productId: number;
  quantity: number;
  unitPrice: number | null;
  source: PriceSource;
  priceListName: string | null;
}

export const pricingApi = {
  lists: () => axios.get<PriceList[]>(`${BASE}/price-lists`).then((r) => r.data),
  saveList: (id: number | null, body: PriceListRequest) =>
    (id ? axios.put<PriceList>(`${BASE}/price-lists/${id}`, body) : axios.post<PriceList>(`${BASE}/price-lists`, body)).then((r) => r.data),
  deleteList: (id: number) => axios.delete(`${BASE}/price-lists/${id}`),
  customerPrices: (customerId?: number) =>
    axios.get<CustomerPrice[]>(`${BASE}/customer-prices`, { params: customerId ? { customerId } : {} }).then((r) => r.data),
  saveCustomerPrice: (id: number | null, body: CustomerPriceRequest) =>
    (id ? axios.put<CustomerPrice>(`${BASE}/customer-prices/${id}`, body) : axios.post<CustomerPrice>(`${BASE}/customer-prices`, body)).then((r) => r.data),
  deleteCustomerPrice: (id: number) => axios.delete(`${BASE}/customer-prices/${id}`),
  /** Prices for a document's lines (customer price, else their list, else the catalogue). */
  prices: (customerId: number | null, currencyCode: string | null, date: string | null, lines: { productId: number; quantity: number }[]) =>
    axios.post<LinePrice[]>(`${BASE}/pricing/prices`, { customerId, currencyCode, date, lines }).then((r) => r.data),
};
