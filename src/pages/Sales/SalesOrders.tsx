import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ListingPdfExportButton } from "../../components/common/export";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDateRangePicker,
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type Address = {
  id: number;
  customerId: number;
  customerName: string;
  customerCode: string;
  type: "BILLING" | "SHIPPING" | string;
  addressLine1: string;
  addressLine2: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  primaryAddress: boolean;
  defaultAddress: boolean;
};

type SalesOrderItem = {
  id: number;
  quotationItemId: number;
  itemType: "PRODUCT" | "SERVICE" | string;
  serviceItemId: number;
  productId: number;
  productCode: string;
  productName: string;
  description: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  additionalDiscount: number;
  taxRate: number;
  taxCode: string;
  remarks: string;
  status: "NEW" | string;
  grossAmount: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
  deliveredQuantity: number;
  pendingQuantity: number;
};

type SalesOrder = {
  id: number;
  orderNumber: string;
  quotationType: "PRODUCT" | "SERVICE" | string;
  orderDate: string;
  status: string;
  quotationId: number;
  quotationNumber: string;
  quotationVersionNo: number;
  customerId: number;
  salesChannelId: number;
  subTotal: number;
  discountAmount: number;
  additionalDiscount: number;
  discountPercentage: number;
  taxAmount: number;
  grandTotal: number;
  currencyCode: string;
  remarks: string;
  internalNotes: string;
  customerNotes: string;
  billingAddress: Address;
  shippingAddress: Address;
  salesPersonId: number;
  subject: string;
  termsAndConditions: string;
  email: string;
  quotationDate: string;
  quotationValidUntil: string;
  paid: boolean;
  paidAmount: number;
  balanceAmount: number;
  creditDays: number;
  paymentTerms: string;
  dueDate: string;
  items: SalesOrderItem[];
};

type SalesPersonOption = {
  id?: number;
  salesPersonId?: number;
  personId?: number;
  employeeId?: number;
  name?: string;
  code?: string;
};

type SalesChannelOption = {
  id?: number;
  salesChannelId?: number;
  channelId?: number;
  name?: string;
  channelType?: string;
};

type CustomerOption = {
  id: number;
  customerName?: string;
  tradeName?: string;
  email?: string;
  currencyCode?: string;
};

type ProductOption = {
  id: number;
  productCode?: string;
  productName?: string;
  categoryName?: string;
  brand?: string;
  uom?: string;
  standardCost?: number;
  sellingPrice?: number;
  stockItem?: boolean;
  serviceItem?: boolean;
  active?: boolean;
  imageName?: string | null;
  imageType?: string | null;
};

type QuotationItemOption = {
  id?: number;
  quotationItemId?: number;
  productId?: number;
  productCode?: string;
  productName?: string;
  description?: string;
  uom?: string;
  quantity?: number;
  unitPrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  additionalDiscount?: number;
  taxRate?: number;
  taxCode?: string;
  remarks?: string;
};

type QuotationOption = {
  id?: number;
  quotationId?: number;
  quoteId?: number;
  quoteNumber?: string;
  quotationNumber?: string;
  versionNo?: number;
  quotationVersionNo?: number;
  quoteDate?: string;
  quotationDate?: string;
  validUntil?: string;
  quotationValidUntil?: string;
  customerId?: number;
  customer?: { id?: number; email?: string };
  email?: string;
  subject?: string;
  grandTotal?: number;
  totalAmount?: number;
  items?: QuotationItemOption[];
};

type OrderForm = {
  tenantId: string;
  orderNumber: string;
  quotationType: string;
  orderDate: string;
  status: string;
  quotationId: string;
  quotationNumber: string;
  quotationVersionNo: string;
  customerId: string;
  salesChannelId: string;
  salesPersonId: string;
  subject: string;
  email: string;
  currencyCode: string;
  subTotal: string;
  discountAmount: string;
  additionalDiscount: string;
  discountPercentage: string;
  taxAmount: string;
  grandTotal: string;
  paid: string;
  paidAmount: string;
  balanceAmount: string;
  creditDays: string;
  paymentTerms: string;
  dueDate: string;
  quotationDate: string;
  quotationValidUntil: string;
  billingAddressLine1: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingPostalCode: string;
  shippingAddressLine1: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  shippingPostalCode: string;
  remarks: string;
  internalNotes: string;
  customerNotes: string;
  termsAndConditions: string;
  itemQuotationItemId: string;
  itemType: string;
  itemServiceItemId: string;
  itemProductId: string;
  itemProductCode: string;
  itemProductName: string;
  itemDescription: string;
  itemUom: string;
  itemQuantity: string;
  itemUnitPrice: string;
  itemDiscountPercentage: string;
  itemDiscountAmount: string;
  itemAdditionalDiscount: string;
  itemTaxRate: string;
  itemTaxCode: string;
  itemRemarks: string;
};

const API_URL = "/v1/api/sales/sales-orders";
const PAGE_SIZE = 10;

const statusOptions = ["DRAFT"];
const quotationTypeOptions = ["PRODUCT", "SERVICE"];

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "";
  } catch {
    return "";
  }
}

const emptyForm: OrderForm = {
  tenantId: getStoredTenantId(),
  orderNumber: "",
  quotationType: "PRODUCT",
  orderDate: new Date().toISOString().split("T")[0],
  status: "DRAFT",
  quotationId: "",
  quotationNumber: "",
  quotationVersionNo: "0",
  customerId: "",
  salesChannelId: "",
  salesPersonId: "",
  subject: "",
  email: "",
  currencyCode: "INR",
  subTotal: "0",
  discountAmount: "0",
  additionalDiscount: "0",
  discountPercentage: "0",
  taxAmount: "0",
  grandTotal: "0",
  paid: "false",
  paidAmount: "0",
  balanceAmount: "0",
  creditDays: "0",
  paymentTerms: "",
  dueDate: "",
  quotationDate: "",
  quotationValidUntil: "",
  billingAddressLine1: "",
  billingCity: "",
  billingState: "",
  billingCountry: "",
  billingPostalCode: "",
  shippingAddressLine1: "",
  shippingCity: "",
  shippingState: "",
  shippingCountry: "",
  shippingPostalCode: "",
  remarks: "",
  internalNotes: "",
  customerNotes: "",
  termsAndConditions: "",
  itemQuotationItemId: "0",
  itemType: "PRODUCT",
  itemServiceItemId: "0",
  itemProductId: "",
  itemProductCode: "",
  itemProductName: "",
  itemDescription: "",
  itemUom: "",
  itemQuantity: "1",
  itemUnitPrice: "0",
  itemDiscountPercentage: "0",
  itemDiscountAmount: "0",
  itemAdditionalDiscount: "0",
  itemTaxRate: "0",
  itemTaxCode: "",
  itemRemarks: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (String(data?.error || "").includes("feign.Response$Body.asInputStream")) {
      return "Backend could not resolve one of the referenced IDs. Check tenantId, quotationId, customerId, salesChannelId, salesPersonId, productId, and quotationItemId.";
    }
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function toNumber(value: string) {
  return Number(value || 0);
}

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function toDateValue(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputDateValue(date: Date | null) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isPercent(value: string) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;
}

function firstPositiveNumber(...values: Array<number | string | undefined | null>) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
}

function getSalesPersonId(person: SalesPersonOption) {
  return firstPositiveNumber(person.id, person.salesPersonId, person.personId, person.employeeId);
}

function getSalesChannelId(channel: SalesChannelOption) {
  return firstPositiveNumber(channel.id, channel.salesChannelId, channel.channelId);
}

function getQuotationId(quotation: QuotationOption) {
  return firstPositiveNumber(quotation.id, quotation.quotationId, quotation.quoteId);
}

function getQuotationItemId(item: QuotationItemOption) {
  return firstPositiveNumber(item.id, item.quotationItemId);
}

function customerOptionLabel(customer: CustomerOption) {
  return customer.customerName || customer.tradeName || `Customer #${customer.id}`;
}

function buildAddress(form: OrderForm, type: "BILLING" | "SHIPPING"): Address {
  const prefix = type === "BILLING" ? "billing" : "shipping";
  return {
    id: 0,
    customerId: toNumber(form.customerId),
    customerName: "",
    customerCode: "",
    type,
    addressLine1: form[`${prefix}AddressLine1` as keyof OrderForm] as string,
    addressLine2: "",
    street: "",
    city: form[`${prefix}City` as keyof OrderForm] as string,
    state: form[`${prefix}State` as keyof OrderForm] as string,
    country: form[`${prefix}Country` as keyof OrderForm] as string,
    postalCode: form[`${prefix}PostalCode` as keyof OrderForm] as string,
    primaryAddress: type === "BILLING",
    defaultAddress: true,
  };
}

function buildItem(form: OrderForm): SalesOrderItem {
  const quantity = toNumber(form.itemQuantity);
  const unitPrice = toNumber(form.itemUnitPrice);
  const discountAmount = toNumber(form.itemDiscountAmount);
  const additionalDiscount = toNumber(form.itemAdditionalDiscount);
  const taxRate = toNumber(form.itemTaxRate);
  const grossAmount = quantity * unitPrice;
  const taxableAmount = Math.max(0, grossAmount - discountAmount - additionalDiscount);
  const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
  const lineTotal = Number((taxableAmount + taxAmount).toFixed(2));

  return {
    id: 0,
    quotationItemId: toNumber(form.itemQuotationItemId),
    itemType: form.itemType,
    serviceItemId: toNumber(form.itemServiceItemId),
    productId: toNumber(form.itemProductId),
    productCode: form.itemProductCode,
    productName: form.itemProductName,
    description: form.itemDescription,
    uom: form.itemUom,
    quantity,
    unitPrice,
    discountPercentage: toNumber(form.itemDiscountPercentage),
    discountAmount,
    additionalDiscount,
    taxRate,
    taxCode: form.itemTaxCode,
    remarks: form.itemRemarks,
    status: "NEW",
    grossAmount,
    taxableAmount,
    taxAmount,
    lineTotal,
    deliveredQuantity: 0,
    pendingQuantity: quantity,
  };
}

const SalesOrders: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteOrder, setDeleteOrder] = useState<SalesOrder | null>(null);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [salesChannels, setSalesChannels] = useState<SalesChannelOption[]>([]);
  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  useEffect(() => {
    fetchOrders();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-calculate order-level Sub Total, Discount, Discount %, Tax Amount and
  // Grand Total directly from the line item's own fields, so the Totals tab
  // always matches what buildItem() actually computes and sends in the payload.
  useEffect(() => {
    const quantity = toNumber(form.itemQuantity);
    const unitPrice = toNumber(form.itemUnitPrice);
    const discountAmount = toNumber(form.itemDiscountAmount);
    const additionalDiscount = toNumber(form.itemAdditionalDiscount);
    const taxRate = toNumber(form.itemTaxRate);

    const subTotal = quantity * unitPrice;
    const taxableAmount = Math.max(0, subTotal - discountAmount - additionalDiscount);
    const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
    const grandTotal = Number((taxableAmount + taxAmount).toFixed(2));
    const discountPercentage =
      subTotal > 0 ? Number((((discountAmount + additionalDiscount) / subTotal) * 100).toFixed(2)) : 0;

    setForm((current) => {
      const nextSubTotal = String(subTotal);
      const nextDiscountAmount = String(discountAmount);
      const nextAdditionalDiscount = String(additionalDiscount);
      const nextTaxAmount = String(taxAmount);
      const nextGrandTotal = String(grandTotal);
      const nextDiscountPercentage = String(discountPercentage);

      if (
        current.subTotal === nextSubTotal &&
        current.discountAmount === nextDiscountAmount &&
        current.additionalDiscount === nextAdditionalDiscount &&
        current.taxAmount === nextTaxAmount &&
        current.grandTotal === nextGrandTotal &&
        current.discountPercentage === nextDiscountPercentage
      ) {
        return current;
      }

      return {
        ...current,
        subTotal: nextSubTotal,
        discountAmount: nextDiscountAmount,
        additionalDiscount: nextAdditionalDiscount,
        taxAmount: nextTaxAmount,
        grandTotal: nextGrandTotal,
        discountPercentage: nextDiscountPercentage,
      };
    });
  }, [form.itemQuantity, form.itemUnitPrice, form.itemDiscountAmount, form.itemAdditionalDiscount, form.itemTaxRate]);

  const upsertOrder = (order: SalesOrder) => {
    setOrders((current) => {
      const exists = current.some((item) => item.id === order.id);
      if (exists) return current.map((item) => (item.id === order.id ? order : item));
      return [order, ...current];
    });
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SalesOrder[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setOrders(data);
      if (data.length === 0) ToasterService.noData("No sales orders found");
    } catch (error) {
      ToasterService.error("Failed to load sales orders", getErrorMessage(error, "Please try again."));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    const [personsRes, channelsRes, quotationsRes, customersRes, productsRes] = await Promise.allSettled([
      axios.get<SalesPersonOption[]>("/v1/api/sales/sales-persons", { headers }),
      axios.get<SalesChannelOption[]>("/v1/api/sales/channels", { headers }),
      axios.get<QuotationOption[]>("/v1/api/sales/quotations", { headers }),
      axios.get<CustomerOption[]>("/v1/api/crm/customers", { headers }),
      axios.get<ProductOption[]>("/v1/api/purchase/products", { headers }),
    ]);

    if (personsRes.status === "fulfilled") {
      setSalesPersons(Array.isArray(personsRes.value.data) ? personsRes.value.data : []);
    } else {
      console.error("Failed to load sales persons:", personsRes.reason);
      ToasterService.error("Failed to load sales persons", getErrorMessage(personsRes.reason, "Please try again."));
    }

    if (channelsRes.status === "fulfilled") {
      setSalesChannels(Array.isArray(channelsRes.value.data) ? channelsRes.value.data : []);
    } else {
      console.error("Failed to load sales channels:", channelsRes.reason);
      ToasterService.error("Failed to load sales channels", getErrorMessage(channelsRes.reason, "Please try again."));
    }

    if (quotationsRes.status === "fulfilled") {
      setQuotations(Array.isArray(quotationsRes.value.data) ? quotationsRes.value.data : []);
    } else {
      console.error("Failed to load quotations:", quotationsRes.reason);
      ToasterService.error("Failed to load quotations", getErrorMessage(quotationsRes.reason, "Please try again."));
    }

    if (customersRes.status === "fulfilled") {
      setCustomers(Array.isArray(customersRes.value.data) ? customersRes.value.data : []);
    } else {
      console.error("Failed to load customers:", customersRes.reason);
      ToasterService.error("Failed to load customers", getErrorMessage(customersRes.reason, "Please try again."));
    }

    if (productsRes.status === "fulfilled") {
      setProducts(Array.isArray(productsRes.value.data) ? productsRes.value.data : []);
    } else {
      console.error("Failed to load products:", productsRes.reason);
      ToasterService.error("Failed to load products", getErrorMessage(productsRes.reason, "Please try again."));
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };

      if (name === "quotationId") {
        const quotation = quotations.find((item) => String(getQuotationId(item)) === value);
        if (quotation) {
          const quotationNumber = quotation.quoteNumber || quotation.quotationNumber || "";
          next.quotationNumber = quotationNumber;
          next.quotationVersionNo = String(quotation.versionNo ?? quotation.quotationVersionNo ?? 0);
          next.quotationDate = quotation.quoteDate || quotation.quotationDate || "";
          next.quotationValidUntil = quotation.validUntil || quotation.quotationValidUntil || "";

          const quotationCustomerId = quotation.customerId ?? quotation.customer?.id;
          if (quotationCustomerId !== undefined && String(quotationCustomerId) !== current.customerId && current.customerId) {
            ToasterService.error(
              "Customer changed",
              `This quotation belongs to a different customer (#${quotationCustomerId}). Customer has been updated to match.`
            );
          }
          next.customerId = String(quotationCustomerId ?? next.customerId);
          next.email = quotation.email || quotation.customer?.email || next.email;
          next.subject = quotation.subject || next.subject;
          next.grandTotal = String(quotation.grandTotal ?? quotation.totalAmount ?? next.grandTotal);

          const firstItem = quotation.items?.[0];
          if (firstItem) {
            next.itemQuotationItemId = String(getQuotationItemId(firstItem) || next.itemQuotationItemId);
            next.itemProductId = String(firstPositiveNumber(firstItem.productId) || next.itemProductId);
            next.itemProductCode = firstItem.productCode || next.itemProductCode;
            next.itemProductName = firstItem.productName || next.itemProductName;
            next.itemDescription = firstItem.description || next.itemDescription;
            next.itemUom = firstItem.uom || next.itemUom;
            next.itemQuantity = String(firstItem.quantity ?? next.itemQuantity);
            next.itemUnitPrice = String(firstItem.unitPrice ?? next.itemUnitPrice);
            next.itemDiscountPercentage = String(firstItem.discountPercentage ?? next.itemDiscountPercentage);
            next.itemDiscountAmount = String(firstItem.discountAmount ?? next.itemDiscountAmount);
            next.itemAdditionalDiscount = String(firstItem.additionalDiscount ?? next.itemAdditionalDiscount);
            next.itemTaxRate = String(firstItem.taxRate ?? next.itemTaxRate);
            next.itemTaxCode = firstItem.taxCode || next.itemTaxCode;
            next.itemRemarks = firstItem.remarks || next.itemRemarks;
          }
        }
      }

      if (name === "itemType" && value !== "SERVICE") {
        next.itemServiceItemId = "0";
      }


      if (name === "customerId") {
        const customer = customers.find((item) => String(item.id) === value);
        if (customer) {
          next.email = customer.email || next.email;
          next.currencyCode = customer.currencyCode || next.currencyCode || "INR";
        }
      }

      if (name === "itemProductId") {
        const product = products.find((item) => String(item.id) === value);
        if (product) {
          const newUnitPrice = product.sellingPrice;
          if (
            newUnitPrice !== undefined &&
            current.itemProductId &&
            current.itemProductId !== value &&
            String(newUnitPrice) !== current.itemUnitPrice
          ) {
            ToasterService.success(
              "Unit price updated",
              `Price set to ${money(newUnitPrice)} based on ${product.productName || product.productCode || "the selected product"}'s master price. Review before submitting.`
            );
          }
          next.itemProductCode = product.productCode || "";
          next.itemProductName = product.productName || "";
          next.itemUom = product.uom || next.itemUom;
          next.itemUnitPrice = String(newUnitPrice ?? next.itemUnitPrice);
        } else if (!value) {
          next.itemProductCode = "";
          next.itemProductName = "";
        }
      }

      return next;
    });
  };

  const buildPayload = () => ({
    id: editingId || 0,
    orderNumber: form.orderNumber,
    quotationType: form.quotationType,
    orderDate: form.orderDate,
    status: "DRAFT",
    quotationId: toNumber(form.quotationId),
    quotationNumber: form.quotationNumber,
    quotationVersionNo: toNumber(form.quotationVersionNo),
    customerId: toNumber(form.customerId),
    salesChannelId: toNumber(form.salesChannelId),
    subTotal: toNumber(form.subTotal),
    discountAmount: toNumber(form.discountAmount),
    additionalDiscount: toNumber(form.additionalDiscount),
    discountPercentage: toNumber(form.discountPercentage),
    taxAmount: toNumber(form.taxAmount),
    grandTotal: toNumber(form.grandTotal),
    currencyCode: form.currencyCode,
    remarks: form.remarks,
    internalNotes: form.internalNotes,
    customerNotes: form.customerNotes,
    billingAddress: buildAddress(form, "BILLING"),
    shippingAddress: buildAddress(form, "SHIPPING"),
    salesPersonId: toNumber(form.salesPersonId),
    subject: form.subject,
    termsAndConditions: form.termsAndConditions,
    email: form.email,
    quotationDate: form.quotationDate,
    quotationValidUntil: form.quotationValidUntil,
    paid: form.paid === "true",
    paidAmount: toNumber(form.paidAmount),
    balanceAmount: toNumber(form.balanceAmount),
    creditDays: toNumber(form.creditDays),
    paymentTerms: form.paymentTerms,
    dueDate: form.dueDate,
    items: [buildItem(form)],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.tenantId.trim()) {
      ToasterService.error("Tenant ID is required");
      return;
    }
    if (!form.customerId || !form.orderDate) {
      ToasterService.error("Required fields missing", "Customer ID and order date are required.");
      return;
    }
    const missingReferences = [
      !isPositiveNumber(form.quotationId) ? "Quotation" : "",
      !isPositiveNumber(form.customerId) ? "Customer ID" : "",
      !isPositiveNumber(form.salesChannelId) ? "Sales Channel" : "",
      !isPositiveNumber(form.salesPersonId) ? "Sales Person" : "",
    ].filter(Boolean);

    if (missingReferences.length > 0) {
      ToasterService.error(
        "Valid referenced IDs required",
        `${missingReferences.join(", ")} ${missingReferences.length === 1 ? "is" : "are"} missing. Select from the dropdowns or enter a valid ID.`
      );
      return;
    }
    if (!form.itemProductId || !form.itemQuantity || !form.itemUnitPrice) {
      ToasterService.error("Line item required", "Product ID, quantity, and unit price are required.");
      return;
    }
    if (!isPositiveNumber(form.itemQuotationItemId) || !isPositiveNumber(form.itemProductId)) {
      ToasterService.error(
        "Valid item IDs required",
        "Quotation item ID and product ID must exist for this tenant."
      );
      return;
    }
    if (!isPercent(form.discountPercentage) || !isPercent(form.itemDiscountPercentage) || !isPercent(form.itemTaxRate)) {
      ToasterService.error("Invalid percentage", "Discount and tax percentages must be between 0 and 100.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const config = { headers, params: { tenantId: form.tenantId } };
      const res = editingId
        ? await axios.put<SalesOrder>(`${API_URL}/${editingId}`, payload, config)
        : await axios.post<SalesOrder>(API_URL, payload, config);

      upsertOrder(res.data);
      ToasterService.success(editingId ? "Sales order updated" : "Sales order created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save sales order", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, tenantId: getStoredTenantId() });
    setShowFormModal(true);
  };

  const openEdit = (order: SalesOrder) => {
    setEditingId(order.id);
    setForm({
      tenantId: getStoredTenantId(),
      orderNumber: order.orderNumber || "",
      quotationType: order.quotationType || "PRODUCT",
      orderDate: order.orderDate || new Date().toISOString().split("T")[0],
      status: order.status || "DRAFT",
      quotationId: String(order.quotationId || ""),
      quotationNumber: order.quotationNumber || "",
      quotationVersionNo: String(order.quotationVersionNo || 0),
      customerId: String(order.customerId || ""),
      salesChannelId: String(order.salesChannelId || ""),
      salesPersonId: String(order.salesPersonId || ""),
      subject: order.subject || "",
      email: order.email || "",
      currencyCode: order.currencyCode || "INR",
      subTotal: String(order.subTotal || 0),
      discountAmount: String(order.discountAmount || 0),
      additionalDiscount: String(order.additionalDiscount || 0),
      discountPercentage: String(order.discountPercentage || 0),
      taxAmount: String(order.taxAmount || 0),
      grandTotal: String(order.grandTotal || 0),
      paid: String(order.paid ?? false),
      paidAmount: String(order.paidAmount || 0),
      balanceAmount: String(order.balanceAmount || 0),
      creditDays: String(order.creditDays || 0),
      paymentTerms: order.paymentTerms || "",
      dueDate: order.dueDate || "",
      quotationDate: order.quotationDate || "",
      quotationValidUntil: order.quotationValidUntil || "",
      billingAddressLine1: order.billingAddress?.addressLine1 || "",
      billingCity: order.billingAddress?.city || "",
      billingState: order.billingAddress?.state || "",
      billingCountry: order.billingAddress?.country || "",
      billingPostalCode: order.billingAddress?.postalCode || "",
      shippingAddressLine1: order.shippingAddress?.addressLine1 || "",
      shippingCity: order.shippingAddress?.city || "",
      shippingState: order.shippingAddress?.state || "",
      shippingCountry: order.shippingAddress?.country || "",
      shippingPostalCode: order.shippingAddress?.postalCode || "",
      remarks: order.remarks || "",
      internalNotes: order.internalNotes || "",
      customerNotes: order.customerNotes || "",
      termsAndConditions: order.termsAndConditions || "",
      itemQuotationItemId: String(order.items?.[0]?.quotationItemId || 0),
      itemType: order.items?.[0]?.itemType || "PRODUCT",
      itemServiceItemId: String(order.items?.[0]?.serviceItemId || 0),
      itemProductId: String(order.items?.[0]?.productId || ""),
      itemProductCode: order.items?.[0]?.productCode || "",
      itemProductName: order.items?.[0]?.productName || "",
      itemDescription: order.items?.[0]?.description || "",
      itemUom: order.items?.[0]?.uom || "",
      itemQuantity: String(order.items?.[0]?.quantity || 1),
      itemUnitPrice: String(order.items?.[0]?.unitPrice || 0),
      itemDiscountPercentage: String(order.items?.[0]?.discountPercentage || 0),
      itemDiscountAmount: String(order.items?.[0]?.discountAmount || 0),
      itemAdditionalDiscount: String(order.items?.[0]?.additionalDiscount || 0),
      itemTaxRate: String(order.items?.[0]?.taxRate || 0),
      itemTaxCode: order.items?.[0]?.taxCode || "",
      itemRemarks: order.items?.[0]?.remarks || "",
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deleteOrder) return;
    const orderId = Number(deleteOrder.id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      ToasterService.error("Invalid order ID");
      setDeleteOrder(null);
      return;
    }

    try {
      await axios.delete(`${API_URL}/${orderId}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setOrders((current) => current.filter((order) => Number(order.id) !== orderId));
      ToasterService.success("Sales order deleted");
    } catch (error) {
      ToasterService.error("Failed to delete sales order", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteOrder(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = searchableText(search);
    if (!term) return orders;

    return orders.filter((order) => {
      const customer = customers.find((item) => Number(item.id) === Number(order.customerId));
      const salesPerson = salesPersons.find(
        (item) => Number(getSalesPersonId(item)) === Number(order.salesPersonId)
      );
      const salesChannel = salesChannels.find(
        (item) => Number(getSalesChannelId(item)) === Number(order.salesChannelId)
      );

      const haystack = [
        order.orderNumber,
        order.status,
        order.quotationNumber,
        order.subject,
        order.email,
        order.currencyCode,
        order.orderDate,
        order.quotationDate,
        order.quotationValidUntil,
        order.dueDate,
        order.customerId,
        customer?.customerName,
        customer?.tradeName,
        customer?.email,
        order.salesChannelId,
        salesChannel?.name,
        salesChannel?.channelType,
        order.salesPersonId,
        salesPerson?.name,
        salesPerson?.code,
        order.grandTotal,
        order.subTotal,
        order.taxAmount,
        order.paidAmount,
        order.balanceAmount,
        order.remarks,
        order.internalNotes,
        order.customerNotes,
        order.termsAndConditions,
        order.id,
        order.paid ? "paid yes true" : "paid no false",
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [customers, orders, salesChannels, salesPersons, search]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      draft: orders.filter((order) => order.status === "DRAFT").length,
      paid: orders.filter((order) => order.paid).length,
      grandTotal: orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0),
    }),
    [orders]
  );

  const columns: ColumnDef<SalesOrder>[] = [
    {
      key: "orderNumber",
      label: "Order",
      sortable: true,
      render: (order) => (
        <div>
          <div className="text-sm font-semibold text-slate-900">{order.orderNumber || `Order #${order.id}`}</div>
          <div className="text-xs text-slate-500">{order.subject || order.quotationNumber || "No subject"}</div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      render: (order) => {
        const customer = customers.find((item) => Number(item.id) === Number(order.customerId));
        return (
          <span className="text-sm text-slate-700">
            {customer ? customerOptionLabel(customer) : order.customerId ? `Customer #${order.customerId}` : "--"}
          </span>
        );
      },
    },
    {
      key: "salesChannelId",
      label: "Channel",
      sortable: true,
      render: (order) => {
        const channel = salesChannels.find(
          (item) => Number(getSalesChannelId(item)) === Number(order.salesChannelId)
        );
        return (
          <span className="text-sm text-slate-700">
            {channel?.name || (order.salesChannelId ? `Channel #${order.salesChannelId}` : "--")}
          </span>
        );
      },
    },
    {
      key: "orderDate",
      label: "Order Date",
      sortable: true,
      render: (order) => <span className="text-sm text-slate-700">{order.orderDate || "--"}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (order) => (
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {order.status || "N/A"}
        </span>
      ),
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      sortable: true,
      render: (order) => <span className="font-semibold text-slate-900">{money(order.grandTotal)}</span>,
    },
    {
      key: "paid",
      label: "Paid",
      sortable: true,
      render: (order) => (order.paid ? "Yes" : "No"),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (order) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(order)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOrder(order)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Sales Orders" description="Manage sales orders" />
      <PageBreadcrumb pageTitle="Sales Orders" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Sales Order" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Orders" value={stats.total} icon={<ShoppingCartIcon />} />
          <StatsCard
            label="Draft"
            value={stats.draft}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<CalendarDaysIcon />}
          />
          <StatsCard
            label="Paid"
            value={stats.paid}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Grand Total"
            value={money(stats.grandTotal)}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BanknotesIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:pb-0.5">
          <div className="relative w-full sm:max-w-md md:-mt-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search sales orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

         <ListingPdfExportButton
  title="Sales Orders"
  subtitle="Filtered sales order listing"
  reportLabel="Sales Report"
  data={filteredOrders}
  columns={[
    { key: "orderNumber", header: "Order Number" },
    { key: "quotationType", header: "Type" },
    { key: "orderDate", header: "Order Date" },
    { key: "status", header: "Status" },
    { key: "quotationNumber", header: "Quotation No" },
    { key: "customerId", header: "Customer" },
    {
      key: "billingAddress",
      header: "Billing Address",
      accessor: (order) =>
        [order.billingAddress?.addressLine1, order.billingAddress?.city, order.billingAddress?.state]
          .filter(Boolean)
          .join(", "),
    },
    {
      key: "shippingAddress",
      header: "Shipping Address",
      accessor: (order) =>
        [order.shippingAddress?.addressLine1, order.shippingAddress?.city, order.shippingAddress?.state]
          .filter(Boolean)
          .join(", "),
    },
    { key: "subTotal", header: "Sub Total", align: "right" },
    { key: "taxAmount", header: "Tax", align: "right" },
    { key: "grandTotal", header: "Grand Total", align: "right" },
    { key: "paid", header: "Paid" },
    { key: "dueDate", header: "Due Date" },
  ]}
  fileName="Sales_Orders"
  disabled={loading}
  metadata={(rows, rangeLabel) => [
    { label: "Total", value: rows.length },
    { label: "Range", value: rangeLabel },
    { label: "Search", value: search || "None" },
  ]}
/>
        </div>

        <ReusableTable
          data={filteredOrders}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="orderDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingCartIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No sales orders found</p>
              <button type="button" onClick={openCreate} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                Create your first sales order
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Sales Order" : "Create Sales Order"}
        subtitle="Enter sales order details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Sales Order" : "Create Sales Order"}
        maxWidthClassName="max-w-5xl"
        tabs={[
          {
            label: "Order Info",
            fields: [
              ...(editingId
                ? [
                    <FloatingInput
                      label="Order Number"
                      name="orderNumber"
                      value={form.orderNumber}
                      onChange={handleChange}
                      disabled
                    />,
                  ]
                : []),
              <FloatingSelect
                label="Quotation Type"
                name="quotationType"
                value={form.quotationType}
                onChange={handleChange}
                includeEmptyOption={false}
                options={quotationTypeOptions.map((item) => ({ id: item, name: item }))}
              />,
              <FloatingDateRangePicker
                label="Order Date"
                startDate={toDateValue(form.orderDate)}
                endDate={toDateValue(form.orderDate)}
                onChange={([start, end]) =>
                  setForm((current) => ({
                    ...current,
                    orderDate: toInputDateValue(end || start),
                  }))
                }
                placeholder=""
                required
                singleSelection
              />,
              <FloatingSelect
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                includeEmptyOption={false}
                options={statusOptions.map((item) => ({ id: item, name: item }))}
              />,
              <FloatingSelect
                label="Customer"
                name="customerId"
                value={form.customerId}
                onChange={handleChange}
                emptyOptionLabel=""
                options={customers.map((customer) => ({
                  id: String(customer.id),
                  name: customerOptionLabel(customer),
                }))}
                required
              />,
              <FloatingSelect
                label="Sales Channel"
                name="salesChannelId"
                value={form.salesChannelId}
                onChange={handleChange}
                emptyOptionLabel=""
                options={salesChannels
                  .map((channel) => {
                    const id = getSalesChannelId(channel);
                    return {
                      id: String(id),
                      name: `${channel.name || `Channel #${id}`}${channel.channelType ? ` (${channel.channelType})` : ""}`,
                    };
                  })
                  .filter((channel) => Number(channel.id) > 0)}
              />,
            ],
          },
          {
            label: "Order Details",
            fields: [
              <FloatingSelect
                label="Sales Person"
                name="salesPersonId"
                value={form.salesPersonId}
                onChange={handleChange}
                emptyOptionLabel=""
                options={salesPersons
                  .map((person) => {
                    const id = getSalesPersonId(person);
                    return {
                      id: String(id),
                      name: `${person.name || `Person #${id}`}${person.code ? ` (${person.code})` : ""}`,
                    };
                  })
                  .filter((person) => Number(person.id) > 0)}
              />,
              <FloatingInput label="Subject" name="subject" value={form.subject} onChange={handleChange} />,
              <FloatingInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} />,
              <FloatingInput label="Currency Code" name="currencyCode" value={form.currencyCode} onChange={handleChange} />,
            ],
          },
          {
            label: "Quotation",
            fields: [
              <FloatingSelect
                label="Quotation"
                name="quotationId"
                value={form.quotationId}
                onChange={handleChange}
                emptyOptionLabel=""
                options={quotations
                  .map((quotation) => {
                    const id = getQuotationId(quotation);
                    return {
                      id: String(id),
                      name: `${quotation.quoteNumber || quotation.quotationNumber || `Quotation #${id}`}`,
                    };
                  })
                  .filter((quotation) => Number(quotation.id) > 0)}
              />,
              <FloatingInput label="Quotation Version" name="quotationVersionNo" type="number" value={form.quotationVersionNo} onChange={handleChange} />,
              <FloatingDateRangePicker
                label="Quotation Date Range"
                startDate={toDateValue(form.quotationDate)}
                endDate={toDateValue(form.quotationValidUntil)}
                onChange={([start, end]) =>
                  setForm((current) => ({
                    ...current,
                    quotationDate: toInputDateValue(start),
                    quotationValidUntil: toInputDateValue(end),
                  }))
                }
                placeholder=""
              />,
              <FloatingDateRangePicker
                label="Due Date"
                startDate={toDateValue(form.dueDate)}
                endDate={toDateValue(form.dueDate)}
                onChange={([start, end]) =>
                  setForm((current) => ({
                    ...current,
                    dueDate: toInputDateValue(end || start),
                  }))
                }
                placeholder=""
                singleSelection
              />,
            ],
          },
          {
            label: "Order Item",
            fields: [
              <FloatingInput label="Order Item Number" name="itemQuotationItemId" type="number" value={form.itemQuotationItemId} onChange={handleChange} />,
              <FloatingSelect
                label="Item Type"
                name="itemType"
                value={form.itemType}
                onChange={handleChange}
                includeEmptyOption={false}
                options={[
                  { id: "PRODUCT", name: "PRODUCT" },
                  { id: "SERVICE", name: "SERVICE" },
                ]}
              />,
              <FloatingInput
                label="Service Number"
                name="itemServiceItemId"
                type="number"
                value={form.itemServiceItemId}
                onChange={handleChange}
                disabled={form.itemType !== "SERVICE"}
              />,
              <FloatingSelect
                label="Product Name"
                name="itemProductId"
                value={form.itemProductId}
                onChange={handleChange}
                emptyOptionLabel=""
                options={products
                  .filter((product) => Number(product.id) > 0)
                  .map((product) => ({
                    id: String(product.id),
                    name: product.productName || product.productCode || `Product #${product.id}`,
                  }))}
                required
              />,
            ],
          },
          {
            label: "Item Details",
            fields: [
              <FloatingInput label="Description" name="itemDescription" value={form.itemDescription} onChange={handleChange} />,
              <FloatingInput label="UOM" name="itemUom" value={form.itemUom} onChange={handleChange} />,
              <FloatingInput label="Quantity" name="itemQuantity" type="number" value={form.itemQuantity} onChange={handleChange} required />,
              <FloatingInput label="Unit Price" name="itemUnitPrice" type="number" value={form.itemUnitPrice} onChange={handleChange} required />,
              <FloatingInput label="Item Discount %" name="itemDiscountPercentage" type="number" value={form.itemDiscountPercentage} onChange={handleChange} />,
              <FloatingInput label="Item Discount Amount" name="itemDiscountAmount" type="number" value={form.itemDiscountAmount} onChange={handleChange} />,
            ],
          },
          {
            label: "Item Pricing",
            fields: [
              <FloatingInput label="Item Additional Discount" name="itemAdditionalDiscount" type="number" value={form.itemAdditionalDiscount} onChange={handleChange} />,
              <FloatingInput label="Tax Rate" name="itemTaxRate" type="number" value={form.itemTaxRate} onChange={handleChange} />,
              <FloatingInput label="Tax Code" name="itemTaxCode" value={form.itemTaxCode} onChange={handleChange} />,
              <FloatingInput label="Item Remarks" name="itemRemarks" value={form.itemRemarks} onChange={handleChange} />,
            ],
          },
          {
            label: "Totals",
            fields: [
              <FloatingInput
                label="Sub Total"
                name="subTotal"
                type="number"
                value={form.subTotal}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                label="Discount Amount"
                name="discountAmount"
                type="number"
                value={form.discountAmount}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                label="Additional Discount"
                name="additionalDiscount"
                type="number"
                value={form.additionalDiscount}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                label="Discount %"
                name="discountPercentage"
                type="number"
                value={form.discountPercentage}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                label="Tax Amount"
                name="taxAmount"
                type="number"
                value={form.taxAmount}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                label="Grand Total"
                name="grandTotal"
                type="number"
                value={form.grandTotal}
                onChange={handleChange}
                disabled
              />,
            ],
          },
          {
            label: "Payment",
            fields: [
              <FloatingInput label="Payment Terms" name="paymentTerms" value={form.paymentTerms} onChange={handleChange} />,
              <FloatingInput label="Credit Days" name="creditDays" type="number" value={form.creditDays} onChange={handleChange} />,
              <FloatingSelect
                label="Paid"
                name="paid"
                value={form.paid}
                onChange={handleChange}
                includeEmptyOption={false}
                options={[
                  { id: "true", name: "Yes" },
                  { id: "false", name: "No" },
                ]}
              />,
            ],
          },
          {
            label: "Settlement",
            fields: [
              <FloatingInput label="Paid Amount" name="paidAmount" type="number" value={form.paidAmount} onChange={handleChange} />,
              <FloatingInput label="Balance Amount" name="balanceAmount" type="number" value={form.balanceAmount} onChange={handleChange} />,
            ],
          },
          {
            label: "Addresses",
            fields: [
              <FloatingInput label="Billing Address" name="billingAddressLine1" value={form.billingAddressLine1} onChange={handleChange} />,
              <FloatingInput label="Shipping Address" name="shippingAddressLine1" value={form.shippingAddressLine1} onChange={handleChange} />,
              <FloatingInput label="Billing City" name="billingCity" value={form.billingCity} onChange={handleChange} />,
              <FloatingInput label="Shipping City" name="shippingCity" value={form.shippingCity} onChange={handleChange} />,
              <FloatingInput label="Billing State" name="billingState" value={form.billingState} onChange={handleChange} />,
              <FloatingInput label="Shipping State" name="shippingState" value={form.shippingState} onChange={handleChange} />,
            ],
          },
          {
            label: "Address More",
            fields: [
              <FloatingInput label="Billing Country" name="billingCountry" value={form.billingCountry} onChange={handleChange} />,
              <FloatingInput label="Shipping Country" name="shippingCountry" value={form.shippingCountry} onChange={handleChange} />,
              <FloatingInput label="Billing Postal Code" name="billingPostalCode" value={form.billingPostalCode} onChange={handleChange} />,
              <FloatingInput label="Shipping Postal Code" name="shippingPostalCode" value={form.shippingPostalCode} onChange={handleChange} />,
            ],
          },
          {
            label: "Notes",
            fields: [
              <FloatingTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={3} />,
              <FloatingTextarea label="Terms and Conditions" name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} rows={3} />,
              <FloatingTextarea label="Internal Notes" name="internalNotes" value={form.internalNotes} onChange={handleChange} rows={3} />,
              <FloatingTextarea label="Customer Notes" name="customerNotes" value={form.customerNotes} onChange={handleChange} rows={3} />,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteOrder}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteOrder(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Sales Order"
        subText={deleteOrder ? `Are you sure you want to delete order #${deleteOrder.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOrder(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default SalesOrders;
