import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  ShoppingCartIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
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

type OrderItemForm = {
  key: string;
  quotationItemId: string;
  itemType: string;
  serviceItemId: string;
  productId: string;
  productCode: string;
  productName: string;
  description: string;
  uom: string;
  quantity: string;
  unitPrice: string;
  discountPercentage: string;
  discountAmount: string;
  additionalDiscount: string;
  taxRate: string;
  taxCode: string;
  remarks: string;
};

type OrderForm = {
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
  items: OrderItemForm[];
};

const API_URL = "/v1/api/sales/sales-orders";
const PAGE_SIZE = 10;

const quotationTypeOptions = ["PRODUCT", "SERVICE"];

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "";
  } catch {
    return "";
  }
}

let itemKeySeq = 0;
function nextItemKey() {
  itemKeySeq += 1;
  return `item-${itemKeySeq}`;
}

function itemFromQuotationItem(qItem: QuotationItemOption): OrderItemForm {
  return {
    key: nextItemKey(),
    quotationItemId: String(firstPositiveNumber(qItem.id, qItem.quotationItemId)),
    itemType: "PRODUCT",
    serviceItemId: "0",
    productId: String(firstPositiveNumber(qItem.productId)),
    productCode: qItem.productCode || "",
    productName: qItem.productName || "",
    description: qItem.description || "",
    uom: qItem.uom || "",
    quantity: String(qItem.quantity ?? 1),
    unitPrice: String(qItem.unitPrice ?? 0),
    discountPercentage: String(qItem.discountPercentage ?? 0),
    discountAmount: String(qItem.discountAmount ?? 0),
    additionalDiscount: String(qItem.additionalDiscount ?? 0),
    taxRate: String(qItem.taxRate ?? 0),
    taxCode: qItem.taxCode || "",
    remarks: qItem.remarks || "",
  };
}

function itemFromOrderItem(item: SalesOrderItem): OrderItemForm {
  return {
    key: nextItemKey(),
    quotationItemId: String(item.quotationItemId || 0),
    itemType: item.itemType || "PRODUCT",
    serviceItemId: String(item.serviceItemId || 0),
    productId: String(item.productId || ""),
    productCode: item.productCode || "",
    productName: item.productName || "",
    description: item.description || "",
    uom: item.uom || "",
    quantity: String(item.quantity || 1),
    unitPrice: String(item.unitPrice || 0),
    discountPercentage: String(item.discountPercentage || 0),
    discountAmount: String(item.discountAmount || 0),
    additionalDiscount: String(item.additionalDiscount || 0),
    taxRate: String(item.taxRate || 0),
    taxCode: item.taxCode || "",
    remarks: item.remarks || "",
  };
}

const emptyForm: OrderForm = {
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
  items: [],
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (String(data?.error || "").includes("feign.Response$Body.asInputStream")) {
      return "Backend could not resolve one of the referenced IDs. Check quotationId, customerId, salesChannelId, salesPersonId, productId, and quotationItemId.";
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

function computeItemTotals(item: OrderItemForm) {
  const quantity = toNumber(item.quantity);
  const unitPrice = toNumber(item.unitPrice);
  const discountAmount = toNumber(item.discountAmount);
  const additionalDiscount = toNumber(item.additionalDiscount);
  const taxRate = toNumber(item.taxRate);
  const grossAmount = quantity * unitPrice;
  const taxableAmount = Math.max(0, grossAmount - discountAmount - additionalDiscount);
  const taxAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
  const lineTotal = Number((taxableAmount + taxAmount).toFixed(2));
  return {
    quantity,
    unitPrice,
    discountAmount,
    additionalDiscount,
    taxRate,
    grossAmount,
    taxableAmount,
    taxAmount,
    lineTotal,
  };
}

function buildOrderItemPayload(item: OrderItemForm): SalesOrderItem {
  const totals = computeItemTotals(item);
  return {
    id: 0,
    quotationItemId: toNumber(item.quotationItemId),
    itemType: item.itemType,
    serviceItemId: toNumber(item.serviceItemId),
    productId: toNumber(item.productId),
    productCode: item.productCode,
    productName: item.productName,
    description: item.description,
    uom: item.uom,
    quantity: totals.quantity,
    unitPrice: totals.unitPrice,
    discountPercentage: toNumber(item.discountPercentage),
    discountAmount: totals.discountAmount,
    additionalDiscount: totals.additionalDiscount,
    taxRate: totals.taxRate,
    taxCode: item.taxCode,
    remarks: item.remarks,
    status: "NEW",
    grossAmount: totals.grossAmount,
    taxableAmount: totals.taxableAmount,
    taxAmount: totals.taxAmount,
    lineTotal: totals.lineTotal,
    deliveredQuantity: 0,
    pendingQuantity: totals.quantity,
  };
}

const SalesOrders: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOrder, setDeleteOrder] = useState<SalesOrder | null>(null);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [salesChannels, setSalesChannels] = useState<SalesChannelOption[]>([]);
  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerOrders, setCustomerOrders] = useState<SalesOrder[]>([]);
  const [creditCheck, setCreditCheck] = useState<{
    status: "idle" | "checking" | "ok" | "insufficient" | "error";
    availableCredit?: number;
    message?: string;
  }>({ status: "idle" });

  useEffect(() => {
    fetchOrders();
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const totalsPerItem = form.items.map(computeItemTotals);
    const subTotal = totalsPerItem.reduce((sum, t) => sum + t.grossAmount, 0);
    const discountAmount = totalsPerItem.reduce((sum, t) => sum + t.discountAmount, 0);
    const additionalDiscount = totalsPerItem.reduce((sum, t) => sum + t.additionalDiscount, 0);
    const taxAmount = Number(totalsPerItem.reduce((sum, t) => sum + t.taxAmount, 0).toFixed(2));
    const grandTotal = Number(totalsPerItem.reduce((sum, t) => sum + t.lineTotal, 0).toFixed(2));
    const discountPercentage =
      subTotal > 0
        ? Number((((discountAmount + additionalDiscount) / subTotal) * 100).toFixed(2))
        : 0;

    setForm((current) => {
      const next = {
        subTotal: String(subTotal),
        discountAmount: String(discountAmount),
        additionalDiscount: String(additionalDiscount),
        taxAmount: String(taxAmount),
        grandTotal: String(grandTotal),
        discountPercentage: String(discountPercentage),
      };
      const unchanged = (Object.keys(next) as (keyof typeof next)[]).every(
        (key) => current[key] === next[key]
      );
      return unchanged ? current : { ...current, ...next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.items]);

  useEffect(() => {
    const isPaid = form.paid === "true";
    const nextPaidAmount = isPaid ? form.grandTotal : "0";
    const nextBalanceAmount = isPaid ? "0" : form.grandTotal;

    setForm((current) => {
      if (current.paidAmount === nextPaidAmount && current.balanceAmount === nextBalanceAmount) {
        return current;
      }
      return { ...current, paidAmount: nextPaidAmount, balanceAmount: nextBalanceAmount };
    });
  }, [form.paid, form.grandTotal]);

  useEffect(() => {
    const customerId = Number(form.customerId);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      setCustomerOrders([]);
      return;
    }
    let cancelled = false;
    axios
      .get<SalesOrder[]>(`${API_URL}/customer/${customerId}`, { headers })
      .then((res) => {
        if (cancelled) return;
        setCustomerOrders(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setCustomerOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.customerId, headers]);

  useEffect(() => {
    const customerId = Number(form.customerId);
    const orderAmount = Number(form.grandTotal);

    if (
      !Number.isFinite(customerId) ||
      customerId <= 0 ||
      !Number.isFinite(orderAmount) ||
      orderAmount <= 0
    ) {
      setCreditCheck({ status: "idle" });
      return;
    }

    setCreditCheck({ status: "checking" });
    const timeoutId = setTimeout(async () => {
      try {
        const res = await axios.post<{ sufficient: boolean; availableCredit: number }>(
          "/v1/api/sales/credit/check",
          { tenantId: getStoredTenantId(), customerId, orderAmount },
          { headers }
        );
        setCreditCheck({
          status: res.data.sufficient ? "ok" : "insufficient",
          availableCredit: Number(res.data.availableCredit || 0),
        });
      } catch (error) {
        setCreditCheck({
          status: "error",
          message: getErrorMessage(error, "Could not verify credit."),
        });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.customerId, form.grandTotal, headers]);

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
      ToasterService.error(
        "Failed to load sales orders",
        getErrorMessage(error, "Please try again.")
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    const [personsRes, channelsRes, quotationsRes, customersRes] = await Promise.allSettled([
      axios.get<SalesPersonOption[]>("/v1/api/sales/sales-persons", { headers }),
      axios.get<SalesChannelOption[]>("/v1/api/sales/channels", { headers }),
      axios.get<QuotationOption[]>("/v1/api/sales/quotations", { headers }),
      axios.get<CustomerOption[]>("/v1/api/crm/customers", { headers }),
    ]);

    if (personsRes.status === "fulfilled") {
      setSalesPersons(Array.isArray(personsRes.value.data) ? personsRes.value.data : []);
    } else {
      console.error("Failed to load sales persons:", personsRes.reason);
      ToasterService.error(
        "Failed to load sales persons",
        getErrorMessage(personsRes.reason, "Please try again.")
      );
    }

    if (channelsRes.status === "fulfilled") {
      setSalesChannels(Array.isArray(channelsRes.value.data) ? channelsRes.value.data : []);
    } else {
      console.error("Failed to load sales channels:", channelsRes.reason);
      ToasterService.error(
        "Failed to load sales channels",
        getErrorMessage(channelsRes.reason, "Please try again.")
      );
    }

    if (quotationsRes.status === "fulfilled") {
      setQuotations(Array.isArray(quotationsRes.value.data) ? quotationsRes.value.data : []);
    } else {
      console.error("Failed to load quotations:", quotationsRes.reason);
      ToasterService.error(
        "Failed to load quotations",
        getErrorMessage(quotationsRes.reason, "Please try again.")
      );
    }

    if (customersRes.status === "fulfilled") {
      setCustomers(Array.isArray(customersRes.value.data) ? customersRes.value.data : []);
    } else {
      console.error("Failed to load customers:", customersRes.reason);
      ToasterService.error(
        "Failed to load customers",
        getErrorMessage(customersRes.reason, "Please try again.")
      );
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
          next.quotationNumber = quotation.quoteNumber || quotation.quotationNumber || "";
          next.quotationVersionNo = String(
            quotation.versionNo ?? quotation.quotationVersionNo ?? 0
          );
          next.quotationDate = quotation.quoteDate || quotation.quotationDate || "";
          next.quotationValidUntil =
            quotation.validUntil || quotation.quotationValidUntil || "";

          const quotationCustomerId = quotation.customerId ?? quotation.customer?.id;
          next.customerId = String(quotationCustomerId ?? next.customerId);
          const matchedCustomer = customers.find(
            (c) => Number(c.id) === Number(quotationCustomerId)
          );
          next.email =
            matchedCustomer?.email || quotation.customer?.email || quotation.email || "";
          next.subject = quotation.subject || next.subject;

          next.items =
            quotation.items && quotation.items.length > 0
              ? quotation.items.map(itemFromQuotationItem)
              : [];
        } else {
          next.items = [];
        }
      }

      if (name === "customerId") {
        const customer = customers.find((item) => String(item.id) === value);
        if (customer) {
          next.email = customer.email || next.email;
          next.currencyCode = customer.currencyCode || next.currencyCode || "INR";
        }
      }

      return next;
    });
  };

  const updateItemField = (index: number, patch: Partial<OrderItemForm>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const handleItemInputChange =
    (index: number) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      updateItemField(index, { [name]: value } as Partial<OrderItemForm>);
    };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));
  };

  const buildPayload = () => ({
    id: editingId || 0,
    orderNumber: form.orderNumber,
    quotationType: form.quotationType,
    orderDate: form.orderDate,
    status: form.status,
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
    items: form.items.map(buildOrderItemPayload),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (creditCheck.status === "insufficient") {
      ToasterService.error(
        "Insufficient credit",
        `Available: ${money(creditCheck.availableCredit)}, required: ${money(
          form.grandTotal
        )}. Reduce the order, clear the customer's outstanding balance, or raise their credit limit before submitting.`
      );
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
        `${missingReferences.join(", ")} ${
          missingReferences.length === 1 ? "is" : "are"
        } missing. Select from the dropdowns or enter a valid ID.`
      );
      return;
    }

    if (form.items.length === 0) {
      ToasterService.error(
        "At least one item required",
        "Pick a quotation that has line items, or add items before submitting."
      );
      return;
    }

    for (const item of form.items) {
      if (
        !isPositiveNumber(item.productId) ||
        !isPositiveNumber(item.quantity) ||
        !isPositiveNumber(item.unitPrice)
      ) {
        ToasterService.error(
          "Line item incomplete",
          "Every item needs a product, a quantity, and a unit price greater than zero."
        );
        return;
      }
      if (!isPositiveNumber(item.quotationItemId)) {
        ToasterService.error(
          "Valid item reference required",
          "Every item must be linked to a quotation item."
        );
        return;
      }
      if (!isPercent(item.discountPercentage) || !isPercent(item.taxRate)) {
        ToasterService.error(
          "Invalid percentage",
          "Discount and tax percentages must be between 0 and 100."
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const config = { headers, params: { tenantId: getStoredTenantId() } };
      const res = editingId
        ? await axios.put<SalesOrder>(`${API_URL}/${editingId}`, payload, config)
        : await axios.post<SalesOrder>(API_URL, payload, config);

      upsertOrder(res.data);
      ToasterService.success(editingId ? "Sales order updated" : "Sales order created");
      closeForm();
    } catch (error) {
      ToasterService.error(
        "Failed to save sales order",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCustomerOrders([]);
    setShowFormModal(true);
  };

  const openEdit = (order: SalesOrder) => {
    setEditingId(order.id);
    setForm({
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
      items: (order.items || []).map(itemFromOrderItem),
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCustomerOrders([]);
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
      ToasterService.error(
        "Failed to delete sales order",
        getErrorMessage(error, "Please try again.")
      );
    } finally {
      setDeleteOrder(null);
    }
  };

  const stats = useMemo(
    () => ({
      total: orders.length,
      draft: orders.filter((order) => order.status === "DRAFT").length,
      paid: orders.filter((order) => order.paid).length,
      unpaid: orders.filter((order) => !order.paid).length,
    }),
    [orders]
  );

  const customerOutstanding = useMemo(
    () => customerOrders.reduce((sum, o) => sum + Number(o.balanceAmount || 0), 0),
    [customerOrders]
  );

  const columns: ColumnDef<SalesOrder>[] = [
    {
      key: "orderNumber",
      label: "Order",
      sortable: true,
      render: (order) => (
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            {order.orderNumber || `Order #${order.id}`}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {order.subject || order.quotationNumber || "No subject"}
          </div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      render: (order) => {
        const customer = customers.find((item) => Number(item.id) === Number(order.customerId));
        const name = customer
          ? customerOptionLabel(customer)
          : order.customerId
          ? `Customer #${order.customerId}`
          : "--";
        return order.customerId ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(
                `/customer-management?customerIds=${order.customerId}&customerName=${encodeURIComponent(
                  name
                )}`
              );
            }}
            className="max-w-[220px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-300">{name}</span>
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
        const name =
          channel?.name || (order.salesChannelId ? `Channel #${order.salesChannelId}` : "--");
        return order.salesChannelId ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(
                `/sales-channels?channelId=${order.salesChannelId}&channelName=${encodeURIComponent(
                  name
                )}`
              );
            }}
            className="max-w-[180px] truncate text-left text-sm text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        ) : (
          <span className="text-sm text-slate-700 dark:text-slate-300">{name}</span>
        );
      },
    },
    {
      key: "orderDate",
      label: "Order Date",
      sortable: true,
      render: (order) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">
          {order.orderDate || "--"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (order) => (
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          {order.status || "N/A"}
        </span>
      ),
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      sortable: true,
      render: (order) => (
        <span className="font-semibold text-slate-900 dark:text-white">
          {money(order.grandTotal)}
        </span>
      ),
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
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOrder(order)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ✅ Dark variants added to the shared class strings used inside the Items tab.
  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-cyan-500";
  const readOnlyClass =
    "w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  const miniLabelClass =
    "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

  return (
    <>
      <PageMeta title="Sales Orders" description="Manage sales orders" />
      <PageBreadcrumb
        pageTitle="Sales Orders"
        actions={<AddButton onClick={openCreate} label="Add Sales Order" />}
      />

      <div className="w-full max-w-none space-y-6 bg-slate-50 px-0 py-8 dark:bg-slate-950">
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
            label="Unpaid"
            value={stats.unpaid}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BanknotesIcon />}
          />
        </div>

        <ReusableTable
          data={orders}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="orderDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ShoppingCartIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">
                No sales orders found
              </p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Create your first sales order
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Sales Order" : "Create Sales Order"}
        subtitle={
          editingId
            ? `Status: ${form.status || "DRAFT"} — status changes are managed elsewhere, not from this form`
            : "Start from a quotation — its customer and items carry over automatically"
        }
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Sales Order" : "Create Sales Order"}
        maxWidthClassName="max-w-5xl"
        tabs={[
          {
            label: "Quotation",
            fields: [
              ...(editingId
                ? [
                    <FloatingInput
                      key="orderNumber"
                      label="Order Number"
                      name="orderNumber"
                      value={form.orderNumber}
                      onChange={handleChange}
                      disabled
                    />,
                  ]
                : []),
              <FloatingSelect
                key="quotationId"
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
                required
              />,
              <FloatingInput
                key="quotationVersionNo"
                label="Quotation Version"
                name="quotationVersionNo"
                type="number"
                value={form.quotationVersionNo}
                onChange={handleChange}
                disabled
              />,
              <FloatingDateRangePicker
                key="quotationDates"
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
              <FloatingSelect
                key="customerId"
                label="Customer"
                name="customerId"
                value={form.customerId}
                onChange={handleChange}
                emptyOptionLabel=""
                disabled={isPositiveNumber(form.quotationId)}
                options={customers.map((customer) => ({
                  id: String(customer.id),
                  name: customerOptionLabel(customer),
                }))}
                required
              />,
              ...(isPositiveNumber(form.quotationId)
                ? [
                    <p
                      key="customerLockedHint"
                      className="md:col-span-2 -mt-2 text-xs text-slate-400 dark:text-slate-500"
                    >
                      Customer follows the selected quotation. Clear the Quotation above to pick a
                      different customer.
                    </p>,
                  ]
                : []),

              ...(customerOrders.length > 0
                ? [
                    <div
                      key="customerOrdersPanel"
                      className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60"
                    >
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Existing orders for this customer
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        {customerOrders.length} order(s) · Outstanding balance{" "}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {money(customerOutstanding)}
                        </span>
                      </div>
                    </div>,
                  ]
                : []),

              <div key="creditCheckBanner" className="md:col-span-2">
                {creditCheck.status === "checking" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Checking available credit for this customer…
                  </div>
                )}
                {creditCheck.status === "ok" && (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Credit check passed — {money(creditCheck.availableCredit)} available against
                    this order.
                  </div>
                )}
                {creditCheck.status === "insufficient" && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
                    <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Insufficient credit for this customer. Available:{" "}
                      {money(creditCheck.availableCredit)}, this order requires{" "}
                      {money(form.grandTotal)}. The backend will reject this order as-is — reduce
                      the order, clear outstanding balance, or raise the credit limit first.
                    </span>
                  </div>
                )}
                {creditCheck.status === "error" && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                    Could not verify credit automatically ({creditCheck.message}). The order may
                    still be rejected on submit if credit is insufficient.
                  </div>
                )}
              </div>,
            ],
          },
          {
            label: "Order Details",
            fields: [
              <FloatingSelect
                key="quotationType"
                label="Quotation Type"
                name="quotationType"
                value={form.quotationType}
                onChange={handleChange}
                includeEmptyOption={false}
                options={quotationTypeOptions.map((item) => ({ id: item, name: item }))}
              />,
              <FloatingDateRangePicker
                key="orderDate"
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
              <FloatingDateRangePicker
                key="dueDate"
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
              <FloatingSelect
                key="salesChannelId"
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
                      name: `${channel.name || `Channel #${id}`}${
                        channel.channelType ? ` (${channel.channelType})` : ""
                      }`,
                    };
                  })
                  .filter((channel) => Number(channel.id) > 0)}
                required
              />,
              <FloatingSelect
                key="salesPersonId"
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
                      name: `${person.name || `Person #${id}`}${
                        person.code ? ` (${person.code})` : ""
                      }`,
                    };
                  })
                  .filter((person) => Number(person.id) > 0)}
                required
              />,
              <FloatingInput
                key="subject"
                label="Subject"
                name="subject"
                value={form.subject}
                onChange={handleChange}
              />,
              <FloatingInput
                key="email"
                label="Email (from customer/quotation)"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                key="currencyCode"
                label="Currency Code (from customer)"
                name="currencyCode"
                value={form.currencyCode}
                onChange={handleChange}
                disabled
              />,
            ],
          },
          {
            label: "Items",
            fields: [
              <div key="itemsList" className="md:col-span-2 space-y-3">
                {form.items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                    Select a quotation on the Quotation tab to load its items here. Items are
                    inherited from the quotation and cannot be swapped out — change the quotation
                    instead.
                  </div>
                ) : (
                  form.items.map((item, index) => {
                    const lineTotals = computeItemTotals(item);
                    return (
                      <div
                        key={item.key}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              Item {index + 1}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Quotation item #{item.quotationItemId}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title="Remove item from this order"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {item.productName ||
                                item.productCode ||
                                `Product #${item.productId}`}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.uom ? `${item.uom} · ` : ""}
                              Qty {item.quantity} × {money(item.unitPrice)}
                              {item.taxRate ? ` · Tax ${item.taxRate}%` : ""}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {money(lineTotals.lineTotal)}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className={miniLabelClass}>Quantity</label>
                            <input
                              name="quantity"
                              type="number"
                              className={inputClass}
                              value={item.quantity}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>
                          <div>
                            <label className={miniLabelClass}>
                              Unit Price (from quotation)
                            </label>
                            <input className={readOnlyClass} value={item.unitPrice} readOnly />
                          </div>

                          <div>
                            <label className={miniLabelClass}>Discount %</label>
                            <input
                              name="discountPercentage"
                              type="number"
                              className={inputClass}
                              value={item.discountPercentage}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>
                          <div>
                            <label className={miniLabelClass}>Discount Amount</label>
                            <input
                              name="discountAmount"
                              type="number"
                              className={inputClass}
                              value={item.discountAmount}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>

                          <div>
                            <label className={miniLabelClass}>Additional Discount</label>
                            <input
                              name="additionalDiscount"
                              type="number"
                              className={inputClass}
                              value={item.additionalDiscount}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>
                          <div>
                            <label className={miniLabelClass}>Tax Rate</label>
                            <input
                              name="taxRate"
                              type="number"
                              className={inputClass}
                              value={item.taxRate}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>

                          <div>
                            <label className={miniLabelClass}>Tax Code</label>
                            <input
                              name="taxCode"
                              className={inputClass}
                              value={item.taxCode}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>
                          <div>
                            <label className={miniLabelClass}>UOM</label>
                            <input className={readOnlyClass} value={item.uom} readOnly />
                          </div>

                          <div className="sm:col-span-2">
                            <label className={miniLabelClass}>Remarks</label>
                            <input
                              name="remarks"
                              className={inputClass}
                              value={item.remarks}
                              onChange={handleItemInputChange(index)}
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800">
                            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                              Gross
                            </div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {money(lineTotals.grossAmount)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800">
                            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                              Taxable
                            </div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {money(lineTotals.taxableAmount)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800">
                            <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                              Tax
                            </div>
                            <div className="font-semibold text-slate-700 dark:text-slate-200">
                              {money(lineTotals.taxAmount)}
                            </div>
                          </div>
                          <div className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs dark:bg-cyan-950/40">
                            <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">
                              Line Total
                            </div>
                            <div className="font-semibold text-cyan-800 dark:text-cyan-300">
                              {money(lineTotals.lineTotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Items are inherited from the selected quotation. To change which products appear
                  on this order, change the quotation — not the rows below.
                </p>
              </div>,

              <div
                key="itemTotalsSummary"
                className="md:col-span-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Order totals (summed from all items above)
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Sub Total
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {money(form.subTotal)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Discount ({form.discountPercentage || 0}%)
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {money(toNumber(form.discountAmount) + toNumber(form.additionalDiscount))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Tax
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {money(form.taxAmount)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 dark:border-cyan-800 dark:bg-cyan-950/40">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-cyan-600 dark:text-cyan-400">
                      Grand Total
                    </div>
                    <div className="mt-1 text-sm font-semibold text-cyan-800 dark:text-cyan-300">
                      {money(form.grandTotal)}
                    </div>
                  </div>
                </div>
              </div>,
            ],
          },
          {
            label: "Payment",
            fields: [
              <FloatingInput
                key="paymentTerms"
                label="Payment Terms"
                name="paymentTerms"
                value={form.paymentTerms}
                onChange={handleChange}
              />,
              <FloatingInput
                key="creditDays"
                label="Credit Days"
                name="creditDays"
                type="number"
                value={form.creditDays}
                onChange={handleChange}
              />,
              <FloatingSelect
                key="paid"
                label="Paid"
                name="paid"
                value={form.paid}
                onChange={handleChange}
                includeEmptyOption={false}
                options={[
                  { id: "true", name: "Yes — fully paid" },
                  { id: "false", name: "No — unpaid" },
                ]}
              />,
              <div
                key="settlementNote"
                className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Paid Amount and Balance Amount follow this setting automatically. True partial
                payments would need a real payment-status field from backend rather than a strict
                yes/no flag.
              </div>,
              <FloatingInput
                key="paidAmount"
                label="Paid Amount"
                name="paidAmount"
                type="number"
                value={form.paidAmount}
                onChange={handleChange}
                disabled
              />,
              <FloatingInput
                key="balanceAmount"
                label="Balance Amount"
                name="balanceAmount"
                type="number"
                value={form.balanceAmount}
                onChange={handleChange}
                disabled
              />,
            ],
          },
          {
            label: "Addresses",
            fields: [
              <p
                key="addressesHint"
                className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Both addresses belong to the customer — Billing is where the invoice is addressed,
                Shipping is where goods/services are delivered. Neither is your company's own
                address.
              </p>,
              <FloatingInput
                key="billingAddressLine1"
                label="Billing Address"
                name="billingAddressLine1"
                value={form.billingAddressLine1}
                onChange={handleChange}
              />,
              <FloatingInput
                key="shippingAddressLine1"
                label="Shipping Address"
                name="shippingAddressLine1"
                value={form.shippingAddressLine1}
                onChange={handleChange}
              />,
              <FloatingInput
                key="billingCity"
                label="Billing City"
                name="billingCity"
                value={form.billingCity}
                onChange={handleChange}
              />,
              <FloatingInput
                key="shippingCity"
                label="Shipping City"
                name="shippingCity"
                value={form.shippingCity}
                onChange={handleChange}
              />,
              <FloatingInput
                key="billingState"
                label="Billing State"
                name="billingState"
                value={form.billingState}
                onChange={handleChange}
              />,
              <FloatingInput
                key="shippingState"
                label="Shipping State"
                name="shippingState"
                value={form.shippingState}
                onChange={handleChange}
              />,
              <FloatingInput
                key="billingCountry"
                label="Billing Country"
                name="billingCountry"
                value={form.billingCountry}
                onChange={handleChange}
              />,
              <FloatingInput
                key="shippingCountry"
                label="Shipping Country"
                name="shippingCountry"
                value={form.shippingCountry}
                onChange={handleChange}
              />,
              <FloatingInput
                key="billingPostalCode"
                label="Billing Postal Code"
                name="billingPostalCode"
                value={form.billingPostalCode}
                onChange={handleChange}
              />,
              <FloatingInput
                key="shippingPostalCode"
                label="Shipping Postal Code"
                name="shippingPostalCode"
                value={form.shippingPostalCode}
                onChange={handleChange}
              />,
            ],
          },
          {
            label: "Notes",
            fields: [
              <FloatingTextarea
                key="remarks"
                label="Remarks"
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                rows={3}
              />,
              <FloatingTextarea
                key="termsAndConditions"
                label="Terms and Conditions"
                name="termsAndConditions"
                value={form.termsAndConditions}
                onChange={handleChange}
                rows={3}
              />,
              <FloatingTextarea
                key="internalNotes"
                label="Internal Notes"
                name="internalNotes"
                value={form.internalNotes}
                onChange={handleChange}
                rows={3}
              />,
              <FloatingTextarea
                key="customerNotes"
                label="Customer Notes"
                name="customerNotes"
                value={form.customerNotes}
                onChange={handleChange}
                rows={3}
              />,
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
        subText={
          deleteOrder
            ? `Are you sure you want to delete order #${deleteOrder.id}?`
            : "Are you sure?"
        }
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