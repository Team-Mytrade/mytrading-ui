import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import {
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowRightCircleIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { loadImageAsDataUrl } from "../../components/common/export";
import { ToasterService } from "../../Services/ToasterService";
import { SellerProfile } from "../../components/quotation/QuotationPreviewTemplate";

type Address = {
  id: number;
  customerId?: number;
  customerName: string;
  customerCode: string;
  type: "BILLING" | string;
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

type QuotationItem = {
  id: number;
  categoryId: number;
  categoryName: string;
  itemType: "PRODUCT" | "SERVICE" | string;
  productId: number;
  productName: string;
  serviceItemId: number;
  description: string;
  productCode: string;
  uom: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  taxRate: number;
  taxCode: string;
  remarks: string;
  additionalDiscount: number;
};

type QuotationItemPayload = Omit<QuotationItem, "categoryId" | "productId" | "serviceItemId"> & {
  categoryId?: number;
  productId?: number;
  serviceItemId?: number;
};

type SalesPerson = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  name: string;
  code: string;
  email: string;
  region: string;
  active: boolean;
  userId: string | number | null;
  employeeId: number | null;
};

type CustomerContact = {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  primaryContact: boolean | null;
  role: string;
};

type Customer = {
  id: number;
  tenantId: string;
  customerCode: string;
  customerName: string;
  tradeName: string;
  customerType: string;
  status: string;
  phone: string;
  email: string;
  currencyCode: string;
  salesPersonId: number | null;
  salesPersonName: string | null;
  active: boolean;
  addresses: Address[];
  contacts: CustomerContact[];
};

type ProductCategory = {
  id: number;
  categoryCode: string;
  categoryName: string;
  shortCode: string;
  description: string;
  parentId: number | null;
  parentName: string | null;
  active: boolean;
};

type ProductOption = {
  id: number;
  productCode?: string;
  productName: string;
  shortName?: string;
  description?: string;
  uom?: string;
  sellingPrice?: number;
  standardCost?: number;
  categoryId?: number;
  categoryName?: string;
  category?: {
    id?: number;
    categoryName?: string;
    parentId?: number | null;
  };
};

type Quotation = {
  id: number;
  customerId: number;
  quotationType: "PRODUCT" | "SERVICE" | string;
  validUntil: string;
  currencyCode: string;
  remarks: string;
  internalNotes: string;
  customerNotes: string;
  subject: string;
  email: string;
  billingAddress: Address;
  shippingAddress: Address;
  items: QuotationItem[];
  quoteNumber: string;
  quoteDate: string;
  status: string;
  subTotal: number;
  discountAmount: number;
  additionalDiscount: number;
  discountPercentage: number;
  taxAmount: number;
  grandTotal: number;
  salesPerson: SalesPerson;
  termsAndConditions: string;
  versionNo: number;
  customerReference?: string;
  customerReferenceDate?: string;
  paymentTerms?: string;
  creditDays?: number;
  deliveryTerms?: string;
  shippingMethod?: string;
};

type QuotationForm = {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  quotationType: string;
  validUntil: string;
  currencyCode: string;
  customerReference: string;
  customerReferenceDate: string;
  paymentTerms: string;
  creditDays: string;
  deliveryTerms: string;
  shippingMethod: string;
  quotationAdditionalDiscount: string;
  remarks: string;
  internalNotes: string;
  customerNotes: string;
  subject: string;
  email: string;
  quoteNumber: string;
  quoteDate: string;
  status: string;
  discountPercentage: string;
  salesPersonId: string;
  termsAndConditions: string;
  versionNo: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingCountry: string;
  billingPostalCode: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  shippingPostalCode: string;
  itemCategoryId: string;
  itemCategoryName: string;
  itemType: string;
  itemProductId: string;
  itemProductName: string;
  itemServiceItemId: string;
  itemDescription: string;
  itemProductCode: string;
  itemUom: string;
  itemQuantity: string;
  itemUnitPrice: string;
  itemDiscountPercentage: string;
  itemDiscountAmount: string;
  itemTaxRate: string;
  itemTaxCode: string;
  itemRemarks: string;
  itemAdditionalDiscount: string;
  itemAdditionalDiscountPercentage: string;
};

const API_URL = "/v1/api/sales/quotations";
const CUSTOMERS_API = "/v1/api/sales/quotations/getCustomers";
// Quotation line items are sourced from Product Catalogue, not Purchase.
// Tenant context is supplied by the shared Axios interceptor via X-Tenant-ID.
const PRODUCT_CATALOGUE_PRODUCTS_API = "/v1/api/product/products";
const PRODUCT_CATALOGUE_CATEGORIES_API = "/v1/api/product/product-categories";
const PAGE_SIZE = 10;
const statusOptions = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];
const quotationTypeOptions = ["PRODUCT", "SERVICE"];

/** Normalizes API status values before they drive quotation actions. */
const getQuotationStatus = (status?: string | null) => String(status || "").trim().toUpperCase();

function getQuotationCustomerName(quotation: Quotation, customers: Customer[]) {
  const customer = customers.find((item) => Number(item.id) === Number(quotation.customerId));
  return customer?.customerName || quotation.billingAddress?.customerName || "Unknown Customer";
}

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "";
  } catch {
    return "";
  }
}

function getSellerProfile(): SellerProfile {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const companyName = user?.companyName || user?.tenantName || "My Trading";
    const legalName = user?.legalName || companyName;
    const addressLines = [
      user?.addressLine1,
      user?.addressLine2,
      [user?.city, user?.state].filter(Boolean).join(", "),
      [user?.country, user?.postalCode].filter(Boolean).join(" - "),
    ]
      .map((line) => String(line || "").trim())
      .filter(Boolean);

    return {
      companyName,
      legalName,
      contactEmail: user?.email || "sales@company.com",
      contactPhone: user?.phone || "+91 00000 00000",
      gstin: user?.gstin || user?.taxId || "--",
      addressLines: addressLines.length > 0 ? addressLines : ["Business address not configured"],
    };
  } catch {
    return {
      companyName: "My Trading",
      legalName: "My Trading",
      contactEmail: "sales@company.com",
      contactPhone: "+91 00000 00000",
      gstin: "--",
      addressLines: ["Business address not configured"],
    };
  }
}

const today = new Date().toISOString().split("T")[0];

const emptyForm: QuotationForm = {
  tenantId: getStoredTenantId(),
  customerId: "5",
  customerName: "ABC Technologies Pvt Ltd",
  customerCode: "",
  quotationType: "PRODUCT",
  validUntil: "2026-10-31",
  currencyCode: "INR",
  customerReference: "RFQ-ABC-2026-1001",
  customerReferenceDate: "2026-09-25",
  paymentTerms: "30 days from invoice",
  creditDays: "30",
  deliveryTerms: "Delivery at customer premises",
  shippingMethod: "ROAD",
  quotationAdditionalDiscount: "5000",
  remarks: "Delivery within agreed timeline",
  internalNotes: "Priority corporate customer",
  customerNotes: "Please mention PO number on invoice",
  subject: "Quotation for Business Laptops",
  email: "purchase@abctech.example",
  quoteNumber: "",
  quoteDate: "2026-09-25",
  status: "DRAFT",
  discountPercentage: "0",
  salesPersonId: "1",
  termsAndConditions: "Prices are valid until quotation expiry. Payment due within 30 days from invoice date.",
  versionNo: "0",
  billingAddressLine1: "ABC Technologies Pvt Ltd",
  billingAddressLine2: "Building 10",
  billingStreet: "Hitech City Road",
  billingCity: "Hyderabad",
  billingState: "Telangana",
  billingCountry: "India",
  billingPostalCode: "500081",
  shippingAddressLine1: "ABC Technologies Warehouse",
  shippingAddressLine2: "Gate 2",
  shippingStreet: "Financial District",
  shippingCity: "Hyderabad",
  shippingState: "Telangana",
  shippingCountry: "India",
  shippingPostalCode: "500032",
  itemCategoryId: "",
  itemCategoryName: "",
  itemType: "PRODUCT",
  itemProductId: "2",
  itemProductName: "Dell Latitude 5450",
  itemServiceItemId: "0",
  itemDescription: "Dell Latitude business laptop",
  itemProductCode: "",
  itemUom: "",
  itemQuantity: "2",
  itemUnitPrice: "63000",
  itemDiscountPercentage: "3",
  itemDiscountAmount: "0",
  itemTaxRate: "18",
  itemTaxCode: "GST18",
  itemRemarks: "3-year warranty",
  itemAdditionalDiscount: "0",
  itemAdditionalDiscountPercentage: "0",
};

const defaultQuotationLineItems: QuotationItemPayload[] = [
  {
    id: 0,
    categoryName: "",
    itemType: "PRODUCT",
    productId: 1,
    productName: "Paracetamol 500mg",
    description: "Paracetamol 500mg tablets",
    productCode: "",
    uom: "",
    quantity: 200,
    unitPrice: 250,
    discountPercentage: 5,
    discountAmount: 2500,
    taxRate: 18,
    taxCode: "GST18",
    remarks: "3-year warranty",
    additionalDiscount: 0,
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (String(data?.error || "").includes("feign.Response$Body.asInputStream")) {
      return "Backend could not resolve one of the referenced IDs. Check tenantId, customerId, salesPersonId, productId, serviceItemId, and categoryId.";
    }
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function toNumber(value: string | number | undefined | null) {
  return Number(value || 0);
}

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const formatPdfDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const quotationItemAmount = (item: QuotationItemPayload) => {
  const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const discounts = Number(item.discountAmount || 0) + Number(item.additionalDiscount || 0);
  const taxable = Math.max(0, gross - discounts);
  return taxable + (taxable * Number(item.taxRate || 0)) / 100;
};

/** Builds a client-side PDF for downloading an individual quotation. */
const createQuotationPdfUrl = async (
  quotation: Quotation,
  sellerProfile: SellerProfile,
  customer?: Customer | null
) => {
  const logoDataUrl = await loadImageAsDataUrl("/images/logo/logo.png");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const reportWidth = doc.internal.pageSize.getWidth();
  const reportHeight = doc.internal.pageSize.getHeight();
  const reportMargin = 14;
  const reportCurrency = quotation.currencyCode || "INR";
  const reportTotals = calculateQuotationTotals(quotation.items || []);
  const apiHasTotals = [quotation.subTotal, quotation.discountAmount, quotation.additionalDiscount, quotation.taxAmount, quotation.grandTotal]
    .some((value) => Number(value || 0) !== 0);
  const resolvedTotals = apiHasTotals
    ? {
        subTotal: Number(quotation.subTotal || 0), discountAmount: Number(quotation.discountAmount || 0),
        additionalDiscount: Number(quotation.additionalDiscount || 0), taxAmount: Number(quotation.taxAmount || 0),
        grandTotal: Number(quotation.grandTotal || 0),
      }
    : { ...reportTotals, additionalDiscount: reportTotals.additionalDiscount + Number(quotation.additionalDiscount || 0), grandTotal: Math.max(0, reportTotals.grandTotal - Number(quotation.additionalDiscount || 0)) };
  const reportAddress = (address?: Address) => [address?.addressLine1, address?.addressLine2, address?.street, address?.city, address?.state, address?.country, address?.postalCode].filter(Boolean).join(", ") || "Not available";
  const reportCustomerName = customer?.customerName || quotation.billingAddress?.customerName || `Customer #${quotation.customerId}`;
  const tableEnd = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 0;
  const drawReportHeader = () => {
    doc.setFillColor(8, 145, 178);
    doc.rect(0, 0, reportWidth, 31, "F");
    if (logoDataUrl) {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(reportMargin, 7, 42, 12, 2, 2, "F");
      doc.addImage(logoDataUrl, "PNG", reportMargin + 2, 8.5, 38, 9);
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(sellerProfile.companyName || "My Trading", reportMargin, 18);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("QUOTATION", reportWidth - reportMargin, 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`No. ${quotation.quoteNumber || quotation.id}  |  ${getQuotationStatus(quotation.status) || "DRAFT"}`, reportWidth - reportMargin, 20, { align: "right" });
    doc.setTextColor(15, 23, 42);
  };
  const reportTableOptions = {
    theme: "grid" as const,
    styles: { font: "helvetica", fontSize: 7.7, cellPadding: 2.4, textColor: [15, 23, 42] as [number, number, number], lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.15, valign: "middle" as const },
    headStyles: { fillColor: [14, 116, 144] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    margin: { left: reportMargin, right: reportMargin, top: 37, bottom: 18 },
  };

  drawReportHeader();
  autoTable(doc, { ...reportTableOptions, startY: 39, tableWidth: 87, head: [["SELLER"]], body: [[sellerProfile.legalName || sellerProfile.companyName || "My Trading"], [sellerProfile.addressLines.join(", ")], [`Email: ${sellerProfile.contactEmail || "-"}`], [`Phone: ${sellerProfile.contactPhone || "-"}   GSTIN: ${sellerProfile.gstin || "-"}`]] });
  const sellerTableEnd = tableEnd();
  autoTable(doc, { ...reportTableOptions, startY: 39, margin: { ...reportTableOptions.margin, left: 109 }, tableWidth: 87, head: [["CUSTOMER"]], body: [[reportCustomerName], [`Code: ${customer?.customerCode || quotation.billingAddress?.customerCode || "-"}   Type: ${customer?.customerType || "-"}`], [`Email: ${quotation.email || customer?.email || "-"}`], [`Phone: ${customer?.phone || "-"}`]] });
  let reportY = Math.max(sellerTableEnd, tableEnd(), 79) + 5;
  autoTable(doc, { ...reportTableOptions, startY: reportY, head: [["QUOTE DETAILS", "", "COMMERCIAL DETAILS", ""]], body: [
    ["Quote date", formatPdfDate(quotation.quoteDate), "Customer reference", quotation.customerReference || "-"],
    ["Valid until", formatPdfDate(quotation.validUntil), "Reference date", quotation.customerReferenceDate ? formatPdfDate(quotation.customerReferenceDate) : "-"],
    ["Type", quotation.quotationType || "-", "Payment terms", quotation.paymentTerms || "-"],
    ["Status", getQuotationStatus(quotation.status) || "DRAFT", "Credit days", quotation.creditDays ?? "-"],
    ["Sales person", quotation.salesPerson?.name || "-", "Delivery terms", quotation.deliveryTerms || "-"],
    ["Currency", reportCurrency, "Shipping method", quotation.shippingMethod || "-"],
    ["Version", quotation.versionNo != null ? `v${quotation.versionNo}` : "-", "Quotation discount", `${Number(quotation.discountPercentage || 0)}%`],
  ], columnStyles: { 0: { cellWidth: 28, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { cellWidth: 63 }, 2: { cellWidth: 31, fontStyle: "bold", textColor: [71, 85, 105] }, 3: { cellWidth: 60 } } });
  reportY = tableEnd() + 5;
  autoTable(doc, { ...reportTableOptions, startY: reportY, head: [["BILLING ADDRESS", "SHIPPING ADDRESS"]], body: [[reportAddress(quotation.billingAddress), reportAddress(quotation.shippingAddress)]], columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } } });
  reportY = tableEnd() + 5;
  const subjectStartY = reportY;
  autoTable(doc, { ...reportTableOptions, startY: subjectStartY, tableWidth: 100, head: [["SUBJECT"]], body: [[quotation.subject || "-"]] });
  const subjectTableEnd = tableEnd();
  autoTable(doc, { ...reportTableOptions, startY: subjectStartY, margin: { ...reportTableOptions.margin, left: 118 }, tableWidth: 78, head: [["TOTALS", "AMOUNT"]], body: [["Subtotal", `${reportCurrency} ${money(resolvedTotals.subTotal)}`], ["Item discount", `- ${reportCurrency} ${money(resolvedTotals.discountAmount)}`], ["Additional discount", `- ${reportCurrency} ${money(resolvedTotals.additionalDiscount)}`], ["Tax", `${reportCurrency} ${money(resolvedTotals.taxAmount)}`], ["GRAND TOTAL", `${reportCurrency} ${money(resolvedTotals.grandTotal)}`]], columnStyles: { 0: { cellWidth: 43 }, 1: { cellWidth: 35, halign: "right", fontStyle: "bold" } } });
  reportY = Math.max(subjectTableEnd, tableEnd()) + 6;
  autoTable(doc, { ...reportTableOptions, startY: reportY, head: [["#", "ITEM / DESCRIPTION", "QTY", "RATE", "DISC.", "ADD. DISC.", "TAX", "AMOUNT"]], body: (quotation.items || []).map((item, index) => [
    String(index + 1),
    [item.productName || item.description || "Quotation item", [item.productCode, item.categoryName, item.uom].filter(Boolean).join(" | "), item.description && item.description !== item.productName ? item.description : "", item.remarks ? `Remarks: ${item.remarks}` : ""].filter(Boolean).join("\n"),
    String(item.quantity || 0), `${reportCurrency} ${money(item.unitPrice)}`, `${Number(item.discountPercentage || 0)}%`, `${reportCurrency} ${money(item.additionalDiscount)}`, `${Number(item.taxRate || 0)}%`, `${reportCurrency} ${money(quotationItemAmount(item))}`
  ]), columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 55 }, 2: { cellWidth: 11, halign: "right" }, 3: { cellWidth: 22, halign: "right" }, 4: { cellWidth: 13, halign: "right" }, 5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 11, halign: "right" }, 7: { cellWidth: 27, halign: "right" } }, didDrawPage: drawReportHeader });
  reportY = tableEnd() + 6;
  const noteRows = [["Customer notes", quotation.customerNotes], ["Terms and conditions", quotation.termsAndConditions], ["Remarks", quotation.remarks], ["Internal notes", quotation.internalNotes]].filter(([, value]) => Boolean(value));
  if (noteRows.length) {
    if (reportY > reportHeight - 50) { doc.addPage(); drawReportHeader(); reportY = 40; }
    autoTable(doc, { ...reportTableOptions, startY: reportY, head: [["NOTES AND TERMS", ""]], body: noteRows, columnStyles: { 0: { cellWidth: 36, fontStyle: "bold", textColor: [71, 85, 105] }, 1: { cellWidth: 146 } } });
  }
  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(reportMargin, reportHeight - 13, reportWidth - reportMargin, reportHeight - 13);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("System generated quotation", reportMargin, reportHeight - 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, reportWidth - reportMargin, reportHeight - 8, { align: "right" });
  }
  return URL.createObjectURL(doc.output("blob"));
};

function customerOptionLabel(customer: Customer) {
  const name = customer.customerName || customer.tradeName || "Unnamed Customer";
  return customer.customerCode ? `${name} (${customer.customerCode})` : name;
}

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function optionalPositiveNumber(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function isPercent(value: string) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;
}

function buildAddress(form: QuotationForm, type: "BILLING" | "SHIPPING"): Address {
  const prefix = type === "BILLING" ? "billing" : "shipping";
  return {
    id: 0,
    customerId: toNumber(form.customerId),
    customerName: form.customerName,
    customerCode: form.customerCode,
    type,
    addressLine1: form[`${prefix}AddressLine1` as keyof QuotationForm] as string,
    addressLine2: form[`${prefix}AddressLine2` as keyof QuotationForm] as string,
    street: form[`${prefix}Street` as keyof QuotationForm] as string,
    city: form[`${prefix}City` as keyof QuotationForm] as string,
    state: form[`${prefix}State` as keyof QuotationForm] as string,
    country: form[`${prefix}Country` as keyof QuotationForm] as string,
    postalCode: form[`${prefix}PostalCode` as keyof QuotationForm] as string,
    primaryAddress: type === "BILLING",
    defaultAddress: true,
  };
}

function calculateItem(form: QuotationForm) {
  const quantity = toNumber(form.itemQuantity);
  const unitPrice = toNumber(form.itemUnitPrice);
  const grossAmount = quantity * unitPrice;

  const percentageDiscount = (grossAmount * toNumber(form.itemDiscountPercentage)) / 100;
  const discountAmount = toNumber(form.itemDiscountAmount) || Number(percentageDiscount.toFixed(2));

  const additionalDiscountAmount = toNumber(form.itemAdditionalDiscount);
  const additionalDiscountFromPercent =
    (grossAmount * toNumber(form.itemAdditionalDiscountPercentage)) / 100;
  const additionalDiscount =
    additionalDiscountAmount || Number(additionalDiscountFromPercent.toFixed(2));

  const taxableAmount = Math.max(0, grossAmount - discountAmount - additionalDiscount);
  const taxAmount = Number(((taxableAmount * toNumber(form.itemTaxRate)) / 100).toFixed(2));
  return {
    grossAmount,
    discountAmount,
    additionalDiscount,
    taxAmount,
    lineTotal: taxableAmount + taxAmount,
  };
}

function resetItemFields(form: QuotationForm): QuotationForm {
  return {
    ...form,
    itemCategoryId: "",
    itemCategoryName: "",
    itemType: "PRODUCT",
    itemProductId: "",
    itemProductName: "",
    itemServiceItemId: "0",
    itemDescription: "",
    itemProductCode: "",
    itemUom: "",
    itemQuantity: "1",
    itemUnitPrice: "0",
    itemDiscountPercentage: "0",
    itemDiscountAmount: "0",
    itemTaxRate: "0",
    itemTaxCode: "",
    itemRemarks: "",
    itemAdditionalDiscount: "0",
    itemAdditionalDiscountPercentage: "0",
  };
}

function calculateLineTotal(item: QuotationItemPayload) {
  const grossAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
  const discountAmount = toNumber(item.discountAmount);
  const additionalDiscount = toNumber(item.additionalDiscount);
  const taxableAmount = Math.max(0, grossAmount - discountAmount - additionalDiscount);
  const taxAmount = Number(((taxableAmount * toNumber(item.taxRate)) / 100).toFixed(2));
  return Number((taxableAmount + taxAmount).toFixed(2));
}

function calculateQuotationTotals(items: QuotationItemPayload[]) {
  return items.reduce(
    (acc, item) => {
      const grossAmount = toNumber(item.quantity) * toNumber(item.unitPrice);
      const discountAmount = toNumber(item.discountAmount);
      const additionalDiscount = toNumber(item.additionalDiscount);
      const taxableAmount = Math.max(0, grossAmount - discountAmount - additionalDiscount);
      const taxAmount = Number(((taxableAmount * toNumber(item.taxRate)) / 100).toFixed(2));

      acc.subTotal += grossAmount;
      acc.discountAmount += discountAmount;
      acc.additionalDiscount += additionalDiscount;
      acc.taxAmount += taxAmount;
      acc.grandTotal += taxableAmount + taxAmount;
      return acc;
    },
    { subTotal: 0, discountAmount: 0, additionalDiscount: 0, taxAmount: 0, grandTotal: 0 }
  );
}

const itemFieldClass =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800";

const itemFieldClassSmall =
  "w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800";

const itemStaticChipClass =
  "rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400";

const Quotations: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<QuotationForm>(emptyForm);
  const [lineItems, setLineItems] = useState<QuotationItemPayload[]>([]);
  const [editingLineItemIndex, setEditingLineItemIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteQuotation, setDeleteQuotation] = useState<Quotation | null>(null);
  const [quotationApiErrors, setQuotationApiErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
    fetchSalesPersons();
    fetchProductCategories();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCustomer = customers.find((customer) => String(customer.id) === form.customerId);
  const selectedSalesPerson = salesPersons.find((person) => String(person.id) === form.salesPersonId);
  const activeCategories = productCategories.filter((category) => category.active !== false);
  const selectedCategory = productCategories.find(
    (category) => String(category.id) === form.itemCategoryId
  );
  const sellerProfile = useMemo(() => getSellerProfile(), []);
  const filteredProducts = products.filter((product) => {
    if (form.itemType !== "PRODUCT") return false;
    if (!form.itemCategoryId) return true;
    const productCategoryId = product.category?.id ?? product.categoryId ?? 0;
    const productCategoryName = String(
      product.category?.categoryName || product.categoryName || ""
    )
      .trim()
      .toLowerCase();
    const selectedCategoryName = String(selectedCategory?.categoryName || "").trim().toLowerCase();

    return (
      String(productCategoryId) === String(form.itemCategoryId) ||
      (Boolean(selectedCategoryName) && productCategoryName === selectedCategoryName)
    );
  });

  const draftItemTotals = calculateItem(form);
  const displayTotals = useMemo(() => {
    const draftAsPayload: QuotationItemPayload = {
      id: 0,
      categoryName: form.itemCategoryName,
      itemType: form.itemType,
      productName: form.itemProductName,
      description: form.itemDescription,
      productCode: form.itemProductCode,
      uom: form.itemUom,
      quantity: toNumber(form.itemQuantity),
      unitPrice: toNumber(form.itemUnitPrice),
      discountPercentage: toNumber(form.itemDiscountPercentage),
      discountAmount: draftItemTotals.discountAmount,
      taxRate: toNumber(form.itemTaxRate),
      taxCode: form.itemTaxCode,
      remarks: form.itemRemarks,
      additionalDiscount: draftItemTotals.additionalDiscount,
    };
    const draftHasData =
      isPositiveNumber(form.itemQuantity) &&
      isPositiveNumber(form.itemUnitPrice) &&
      (form.itemProductName.trim() || form.itemDescription.trim());
    const itemsForTotals =
      editingLineItemIndex != null && draftHasData
        ? lineItems.map((item, index) => (index === editingLineItemIndex ? draftAsPayload : item))
        : lineItems.length > 0
          ? draftHasData
            ? [...lineItems, draftAsPayload]
            : lineItems
          : [draftAsPayload];
    const totals = calculateQuotationTotals(itemsForTotals);
    const quotationAdditionalDiscount = toNumber(form.quotationAdditionalDiscount);
    return {
      ...totals,
      additionalDiscount: totals.additionalDiscount + quotationAdditionalDiscount,
      grandTotal: Math.max(0, totals.grandTotal - quotationAdditionalDiscount),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lineItems,
    editingLineItemIndex,
    form.itemQuantity,
    form.itemUnitPrice,
    form.itemProductName,
    form.itemDescription,
    form.quotationAdditionalDiscount,
    form.itemDiscountPercentage,
    form.itemDiscountAmount,
    form.itemTaxRate,
    form.itemAdditionalDiscount,
    form.itemAdditionalDiscountPercentage,
  ]);

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Quotation[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setQuotations(data);
      if (data.length === 0) ToasterService.noData("No quotations found");
    } catch (error) {
      ToasterService.error("Failed to load quotations", getErrorMessage(error, "Please try again."));
      setQuotations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPersons = async () => {
    try {
      const res = await axios.get<SalesPerson[]>("/v1/api/sales/sales-persons", { headers });
      setSalesPersons(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load sales persons", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get<Customer[]>(CUSTOMERS_API, { headers });
      const availableCustomers = Array.isArray(res.data) ? res.data : [];
      setCustomers(availableCustomers);
      setForm((current) => {
        if (!current.customerId || availableCustomers.some((customer) => String(customer.id) === current.customerId)) {
          return current;
        }

        return { ...current, customerId: "", customerName: "", customerCode: "" };
      });
    } catch (error) {
      ToasterService.error("Failed to load customers", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchProductCategories = async () => {
    try {
      const res = await axios.get<ProductCategory[]>(PRODUCT_CATALOGUE_CATEGORIES_API, { headers });
      setProductCategories(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error(
        "Failed to load product categories",
        getErrorMessage(error, "Please try again.")
      );
      setProductCategories([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get<ProductOption[]>(PRODUCT_CATALOGUE_PRODUCTS_API, { headers });
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
      setProducts([]);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "customerId") {
        const customer = customers.find((item) => String(item.id) === value);
        const billingAddress =
          customer?.addresses?.find((address) => address.type === "BILLING") ||
          customer?.addresses?.[0];
        const shippingAddress =
          customer?.addresses?.find((address) => address.type === "SHIPPING") || billingAddress;

        next.customerName = customer?.customerName || "";
        next.customerCode = customer?.customerCode || "";
        next.currencyCode = customer?.currencyCode || current.currencyCode || "INR";
        next.billingAddressLine1 = billingAddress?.addressLine1 || "";
        next.billingAddressLine2 = billingAddress?.addressLine2 || "";
        next.billingStreet = billingAddress?.street || "";
        next.billingCity = billingAddress?.city || "";
        next.billingState = billingAddress?.state || "";
        next.billingCountry = billingAddress?.country || "";
        next.billingPostalCode = billingAddress?.postalCode || "";
        next.shippingAddressLine1 = shippingAddress?.addressLine1 || "";
        next.shippingAddressLine2 = shippingAddress?.addressLine2 || "";
        next.shippingStreet = shippingAddress?.street || "";
        next.shippingCity = shippingAddress?.city || "";
        next.shippingState = shippingAddress?.state || "";
        next.shippingCountry = shippingAddress?.country || "";
        next.shippingPostalCode = shippingAddress?.postalCode || "";
      }
      if (name === "salesPersonId") {
        const person = salesPersons.find((item) => String(item.id) === value);
        next.email = person?.email || "";
      }
      if (name === "itemType") {
        next.itemCategoryId = "";
        next.itemCategoryName = "";
        next.itemProductId = "";
        next.itemProductName = "";
        next.itemProductCode = "";
        next.itemDescription = "";
        next.itemUom = "";
        next.itemUnitPrice = "0";
      }
      if (name === "itemCategoryId") {
        const category = productCategories.find((item) => String(item.id) === value);
        next.itemCategoryName = category?.categoryName || "";
        next.itemProductId = "";
        next.itemProductName = "";
        next.itemProductCode = "";
        next.itemDescription = "";
        next.itemUom = "";
        next.itemUnitPrice = "0";
      }
      if (name === "itemProductId") {
        const product = products.find((item) => String(item.id) === value);
        const categoryName = String(
          product?.category?.categoryName || product?.categoryName || ""
        )
          .trim()
          .toLowerCase();
        const matchedCategoryByName = productCategories.find(
          (item) => String(item.categoryName || "").trim().toLowerCase() === categoryName
        );
        const resolvedCategoryId = String(
          product?.category?.id ??
            product?.categoryId ??
            matchedCategoryByName?.id ??
            next.itemCategoryId ??
            ""
        );
        const resolvedCategory =
          productCategories.find((item) => String(item.id) === resolvedCategoryId) ||
          matchedCategoryByName;

        next.itemCategoryId = resolvedCategoryId;
        next.itemCategoryName = resolvedCategory?.categoryName || "";
        next.itemProductName = product?.productName || "";
        next.itemProductCode = product?.productCode || "";
        next.itemDescription = product?.description || "";
        next.itemUom = product?.uom || "";
        next.itemUnitPrice = String(product?.sellingPrice ?? product?.standardCost ?? 0);
      }
      return next;
    });
  };

  const getPendingDraftItem = (): QuotationItemPayload | null => {
    const hasValidDraft =
      isPositiveNumber(form.itemQuantity) &&
      isPositiveNumber(form.itemUnitPrice) &&
      (form.itemProductName.trim() || form.itemDescription.trim());
    return hasValidDraft ? buildItem() : null;
  };

  const buildItem = (): QuotationItemPayload => {
    const calculated = calculateItem(form);
    const item: QuotationItemPayload = {
      id: 0,
      categoryName: form.itemCategoryName,
      itemType: form.itemType,
      productName: form.itemProductName,
      description: form.itemDescription,
      productCode: form.itemProductCode,
      uom: form.itemUom,
      quantity: toNumber(form.itemQuantity),
      unitPrice: toNumber(form.itemUnitPrice),
      discountPercentage: toNumber(form.itemDiscountPercentage),
      discountAmount: calculated.discountAmount,
      taxRate: toNumber(form.itemTaxRate),
      taxCode: form.itemTaxCode,
      remarks: form.itemRemarks,
      additionalDiscount: calculated.additionalDiscount,
    };

    const categoryId = optionalPositiveNumber(form.itemCategoryId);
    const productId = optionalPositiveNumber(form.itemProductId);
    const serviceItemId = optionalPositiveNumber(form.itemServiceItemId);

    if (categoryId) item.categoryId = categoryId;
    if (form.itemType === "SERVICE") {
      if (serviceItemId) item.serviceItemId = serviceItemId;
    } else if (productId) {
      item.productId = productId;
    }

    return item;
  };

  const buildSalesPerson = (): Partial<SalesPerson> => ({
    id: toNumber(form.salesPersonId),
    tenantId: form.tenantId.trim(),
    name: selectedSalesPerson?.name || "",
    code: selectedSalesPerson?.code || "",
    email: selectedSalesPerson?.email || "",
    region: selectedSalesPerson?.region || "",
    active: selectedSalesPerson?.active ?? true,
    userId: selectedSalesPerson?.userId ?? "",
    employeeId: selectedSalesPerson?.employeeId ?? 0,
  });

  const addCurrentItem = () => {
    if (
      lineItems.length === 0 &&
      (!isPositiveNumber(form.itemQuantity) ||
        !isPositiveNumber(form.itemUnitPrice) ||
        (!form.itemProductName.trim() && !form.itemDescription.trim()))
    ) {
      ToasterService.error("Line item required", "Add at least one product using the + button.");
      return;
    }
    if (
      !isPercent(form.itemDiscountPercentage) ||
      !isPercent(form.itemTaxRate) ||
      !isPercent(form.itemAdditionalDiscountPercentage)
    ) {
      ToasterService.error(
        "Invalid percentage",
        "Discount, additional discount, and tax percentages must be between 0 and 100."
      );
      return;
    }

    setLineItems((current) =>
      editingLineItemIndex == null
        ? [...current, buildItem()]
        : current.map((item, index) => (index === editingLineItemIndex ? buildItem() : item))
    );
    setEditingLineItemIndex(null);
    setForm((current) => resetItemFields(current));
  };

  const removeLineItem = (index: number) => {
    setLineItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setEditingLineItemIndex((current) => {
      if (current == null || current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const editLineItem = (item: QuotationItemPayload, index: number) => {
    setEditingLineItemIndex(index);
    setForm((current) => ({
      ...current,
      itemCategoryId: String(item.categoryId || ""),
      itemCategoryName: item.categoryName || "",
      itemType: item.itemType || "PRODUCT",
      itemProductId: String(item.productId || ""),
      itemProductName: item.productName || "",
      itemServiceItemId: String(item.serviceItemId || "0"),
      itemDescription: item.description || "",
      itemProductCode: item.productCode || "",
      itemUom: item.uom || "",
      itemQuantity: String(item.quantity || 1),
      itemUnitPrice: String(item.unitPrice || 0),
      itemDiscountPercentage: String(item.discountPercentage || 0),
      itemDiscountAmount: String(item.discountAmount || 0),
      itemTaxRate: String(item.taxRate || 0),
      itemTaxCode: item.taxCode || "",
      itemRemarks: item.remarks || "",
      itemAdditionalDiscount: String(item.additionalDiscount || 0),
      itemAdditionalDiscountPercentage: "0",
    }));
  };

  const buildPayload = () => {
    const pendingDraft = getPendingDraftItem();
    const payloadItems =
      editingLineItemIndex != null && pendingDraft
        ? lineItems.map((item, index) => (index === editingLineItemIndex ? pendingDraft : item))
        : lineItems.length > 0
          ? pendingDraft
            ? [...lineItems, pendingDraft]
            : lineItems
          : [buildItem()];
    const totals = calculateQuotationTotals(payloadItems);

    return {
      id: editingId || 0,
      customerId: toNumber(form.customerId),
      salesPersonId: toNumber(form.salesPersonId),
      quotationType: form.quotationType,
      validUntil: form.validUntil,
      currencyCode: form.currencyCode,
      customerReference: form.customerReference,
      customerReferenceDate: form.customerReferenceDate,
      paymentTerms: form.paymentTerms,
      creditDays: toNumber(form.creditDays),
      deliveryTerms: form.deliveryTerms,
      shippingMethod: form.shippingMethod,
      remarks: form.remarks,
      internalNotes: form.internalNotes,
      customerNotes: form.customerNotes,
      subject: form.subject,
      email: form.email,
      billingAddress: buildAddress(form, "BILLING"),
      shippingAddress: buildAddress(form, "SHIPPING"),
      items: payloadItems,
      quoteNumber: form.quoteNumber,
      quoteDate: form.quoteDate,
      status: form.status,
      subTotal: Number(totals.subTotal.toFixed(2)),
      discountAmount: Number(totals.discountAmount.toFixed(2)),
      additionalDiscount: Number(totals.additionalDiscount.toFixed(2)),
      discountPercentage: toNumber(form.discountPercentage),
      taxAmount: Number(totals.taxAmount.toFixed(2)),
      grandTotal: Number(totals.grandTotal.toFixed(2)),
      salesPerson: buildSalesPerson(),
      termsAndConditions: form.termsAndConditions,
      versionNo: toNumber(form.versionNo),
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.tenantId.trim()) {
      ToasterService.error("Tenant ID is required");
      return;
    }
    if (!isPositiveNumber(form.customerId) || !form.validUntil || !form.quoteDate) {
      ToasterService.error(
        "Required fields missing",
        "Customer, quote date, and valid until date are required."
      );
      return;
    }
    if (!isPositiveNumber(form.salesPersonId)) {
      ToasterService.error("Sales person required", "Select a sales person from the dropdown.");
      return;
    }
    if (
      lineItems.length === 0 &&
      (!isPositiveNumber(form.itemQuantity) ||
        !isPositiveNumber(form.itemUnitPrice) ||
        (!form.itemProductName.trim() && !form.itemDescription.trim()))
    ) {
      ToasterService.error(
        "Line item required",
        "Add at least one item using the + button on the Items tab."
      );
      return;
    }
    if (
      !isPercent(form.discountPercentage) ||
      !isPercent(form.itemDiscountPercentage) ||
      !isPercent(form.itemTaxRate) ||
      !isPercent(form.itemAdditionalDiscountPercentage)
    ) {
      ToasterService.error(
        "Invalid percentage",
        "Discount, additional discount, and tax percentages must be between 0 and 100."
      );
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      // The current Sales API requires tenantId as a request parameter in addition
      // to the tenant context header supplied by the shared Axios interceptor.
      const requestConfig = {
        headers,
        params: { tenantId: form.tenantId.trim() },
      };
      const res = editingId
        ? await axios.put<Quotation>(`${API_URL}/${editingId}`, payload, requestConfig)
        : await axios.post<Quotation>(API_URL, payload, requestConfig);

      setQuotations((current) => {
        const exists = current.some((item) => item.id === res.data.id);
        if (exists) return current.map((item) => (item.id === res.data.id ? res.data : item));
        return [res.data, ...current];
      });
      ToasterService.success(editingId ? "Quotation updated" : "Quotation created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setEditingLineItemIndex(null);
    setLineItems(defaultQuotationLineItems);
    setForm({
      ...emptyForm,
      tenantId: getStoredTenantId(),
    });
    setShowFormModal(true);
  };

  const openEdit = async (quotation: Quotation) => {
    if (getQuotationStatus(quotation.status) !== "DRAFT") {
      ToasterService.error("Quotation cannot be edited", "Only draft quotations can be edited.");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<Quotation>(`${API_URL}/${quotation.id}`, { headers });
      const full = res.data;
      setLineItems(
        (full.items || []).map((item) => ({
          id: item.id || 0,
          categoryId: item.categoryId,
          categoryName: item.categoryName || "",
          itemType: item.itemType || "PRODUCT",
          productId: item.productId,
          productName: item.productName || "",
          serviceItemId: item.serviceItemId,
          description: item.description || "",
          productCode: item.productCode || "",
          uom: item.uom || "",
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          discountPercentage: item.discountPercentage || 0,
          discountAmount: item.discountAmount || 0,
          taxRate: item.taxRate || 0,
          taxCode: item.taxCode || "",
          remarks: item.remarks || "",
          additionalDiscount: item.additionalDiscount || 0,
        }))
      );
      setEditingId(full.id);
      setEditingLineItemIndex(null);
      setForm({
        tenantId: getStoredTenantId(),
        customerId: String(full.customerId || ""),
        customerName:
          customers.find((customer) => Number(customer.id) === Number(full.customerId))
            ?.customerName ||
          full.billingAddress?.customerName ||
          "",
        customerCode:
          customers.find((customer) => Number(customer.id) === Number(full.customerId))
            ?.customerCode ||
          full.billingAddress?.customerCode ||
          "",
        quotationType: full.quotationType || "PRODUCT",
        validUntil: full.validUntil || today,
        currencyCode: full.currencyCode || "INR",
        customerReference: full.customerReference || "",
        customerReferenceDate: full.customerReferenceDate || "",
        paymentTerms: full.paymentTerms || "",
        creditDays: String(full.creditDays || 0),
        deliveryTerms: full.deliveryTerms || "",
        shippingMethod: full.shippingMethod || "",
        quotationAdditionalDiscount: String(full.additionalDiscount || 0),
        remarks: full.remarks || "",
        internalNotes: full.internalNotes || "",
        customerNotes: full.customerNotes || "",
        subject: full.subject || "",
        email: full.email || "",
        quoteNumber: full.quoteNumber || "",
        quoteDate: full.quoteDate || today,
        status: full.status || "DRAFT",
        discountPercentage: String(full.discountPercentage || 0),
        salesPersonId: String(full.salesPerson?.id || ""),
        termsAndConditions: full.termsAndConditions || "",
        versionNo: String(full.versionNo || 0),
        billingAddressLine1: full.billingAddress?.addressLine1 || "",
        billingAddressLine2: full.billingAddress?.addressLine2 || "",
        billingStreet: full.billingAddress?.street || "",
        billingCity: full.billingAddress?.city || "",
        billingState: full.billingAddress?.state || "",
        billingCountry: full.billingAddress?.country || "",
        billingPostalCode: full.billingAddress?.postalCode || "",
        shippingAddressLine1: full.shippingAddress?.addressLine1 || "",
        shippingAddressLine2: full.shippingAddress?.addressLine2 || "",
        shippingStreet: full.shippingAddress?.street || "",
        shippingCity: full.shippingAddress?.city || "",
        shippingState: full.shippingAddress?.state || "",
        shippingCountry: full.shippingAddress?.country || "",
        shippingPostalCode: full.shippingAddress?.postalCode || "",
        itemCategoryId: "",
        itemCategoryName: "",
        itemType: "PRODUCT",
        itemProductId: "",
        itemProductName: "",
        itemServiceItemId: "0",
        itemDescription: "",
        itemProductCode: "",
        itemUom: "",
        itemQuantity: "1",
        itemUnitPrice: "0",
        itemDiscountPercentage: "0",
        itemDiscountAmount: "0",
        itemTaxRate: "0",
        itemTaxCode: "",
        itemRemarks: "",
        itemAdditionalDiscount: "0",
        itemAdditionalDiscountPercentage: "0",
      });
      setShowFormModal(true);
    } catch (error) {
      ToasterService.error("Failed to load quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const updateQuotationStatus = async (quotation: Quotation, status: string) => {
    if (status === getQuotationStatus(quotation.status)) return;

    try {
      setLoading(true);
      const requestConfig = { headers, params: { tenantId: getStoredTenantId() } };
      const res =
        status === "SENT"
          ? await axios.post<Quotation>(`${API_URL}/${quotation.id}/send`, {}, requestConfig)
          : status === "ACCEPTED"
            ? await axios.post<Quotation>(`${API_URL}/${quotation.id}/accept`, {}, requestConfig)
          : await axios.put<Quotation>(
              `${API_URL}/${quotation.id}`,
              { ...(await axios.get<Quotation>(`${API_URL}/${quotation.id}`, { headers })).data, status },
              requestConfig
            );
      const updatedQuotation =
        res.data && typeof res.data === "object" ? res.data : {};
      setQuotations((current) =>
        current.map((item) =>
          item.id === quotation.id ? { ...item, ...updatedQuotation, status } : item
        )
      );
      setQuotationApiErrors((current) => {
        const { [quotation.id]: _cleared, ...remaining } = current;
        return remaining;
      });
      ToasterService.success("Quotation status updated");
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");
      setQuotationApiErrors((current) => ({ ...current, [quotation.id]: message }));
      ToasterService.error(
        "Failed to update quotation status",
        message
      );
    } finally {
      setLoading(false);
    }
  };

  const convertQuotationToSalesOrder = async (quotation: Quotation) => {
    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/${quotation.id}/convert-to-order`,
        {},
        { headers, params: { tenantId: getStoredTenantId() } }
      );
      const refreshed = await axios.get<Quotation>(`${API_URL}/${quotation.id}`, { headers });
      setQuotations((current) =>
        current.map((item) => (item.id === quotation.id ? refreshed.data : item))
      );
      setQuotationApiErrors((current) => {
        const { [quotation.id]: _cleared, ...remaining } = current;
        return remaining;
      });
      ToasterService.success("Quotation converted to sales order");
      navigate(`/sales-orders?quotationId=${quotation.id}`, {
        state: { convertedQuotationId: quotation.id, convertedQuotationNumber: quotation.quoteNumber },
      });
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");
      setQuotationApiErrors((current) => ({ ...current, [quotation.id]: message }));
      ToasterService.error(
        "Failed to convert quotation",
        message
      );
    } finally {
      setLoading(false);
    }
  };

  const exportQuotationPdf = async (quotation: Quotation) => {
    try {
      const res = await axios.get<Quotation>(`${API_URL}/${quotation.id}`, { headers });
      const customer = customers.find((item) => Number(item.id) === Number(res.data.customerId));
      const pdfUrl = await createQuotationPdfUrl(res.data, sellerProfile, customer);
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `${String(res.data.quoteNumber || `quotation-${res.data.id}`).replace(/[^a-z0-9_-]+/gi, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pdfUrl);
    } catch (error) {
      ToasterService.error(
        "Failed to export quotation PDF",
        getErrorMessage(error, "Please try again.")
      );
    }
  };

  const closeForm = () => {
    setShowFormModal(false);
    setEditingId(null);
    setLineItems([]);
    setEditingLineItemIndex(null);
    setForm(emptyForm);
  };

  const confirmDelete = async () => {
    if (!deleteQuotation) return;

    try {
      await axios.delete(`${API_URL}/${deleteQuotation.id}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setQuotations((current) => current.filter((item) => item.id !== deleteQuotation.id));
      ToasterService.success("Quotation deleted");
    } catch (error) {
      ToasterService.error("Failed to delete quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteQuotation(null);
    }
  };

  const stats = useMemo(
    () => ({
      total: quotations.length,
      draft: quotations.filter((item) => getQuotationStatus(item.status) === "DRAFT").length,
      accepted: quotations.filter((item) => getQuotationStatus(item.status) === "ACCEPTED").length,
      rejected: quotations.filter((item) => getQuotationStatus(item.status) === "REJECTED").length,
    }),
    [quotations]
  );

  const columns: ColumnDef<Quotation>[] = [
    {
      key: "quoteNumber",
      label: "Quotation",
      sortable: true,
      className: "w-[250px] max-w-[250px] !overflow-visible",
      headerClassName: "w-[250px]",
      tooltipContent: (quotation) => quotation.quoteNumber || "Untitled Quotation",
      render: (quotation) => (
        <div className="min-w-0 max-w-full">
          <span className="block truncate font-medium text-cyan-700 dark:text-cyan-400">
            {quotation.quoteNumber || "Untitled Quotation"}
          </span>
          <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400" title={quotation.subject || "No subject"}>
            {quotation.subject || "No subject"}
          </div>
        </div>
      ),
    },
    {
      key: "customerId",
      label: "Customer",
      sortable: true,
      render: (quotation) => {
        const name = getQuotationCustomerName(quotation, customers);
        const code =
          customers.find((c) => Number(c.id) === Number(quotation.customerId))?.customerCode ||
          quotation.billingAddress?.customerCode ||
          "";
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(
                `/customer-management?customerIds=${quotation.customerId}&customerName=${encodeURIComponent(
                  name
                )}`
              );
            }}
            className="max-w-[220px] text-left"
            title={`View ${name}`}
          >
            <div className="truncate text-sm font-semibold text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300">
              {name}
            </div>
            {code && (
              <div className="text-xs text-slate-500 dark:text-slate-400">{code}</div>
            )}
          </button>
        );
      },
    },
    {
      key: "salesPerson",
      label: "Sales Person",
      sortable: true,
      render: (quotation) => {
        const person = salesPersons.find((sp) => sp.id === quotation.salesPerson?.id);
        const salesPerson = person || quotation.salesPerson;
        const name = salesPerson?.name || "Unassigned";
        return salesPerson?.id ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigate(
                `/sales-persons?salesPersonId=${salesPerson.id}&salesPersonName=${encodeURIComponent(
                  name
                )}`
              );
            }}
            className="max-w-[180px] truncate text-left text-cyan-700 hover:text-cyan-800 hover:underline dark:text-cyan-400 dark:hover:text-cyan-300"
            title={`View ${name}`}
          >
            {name}
          </button>
        ) : (
          <span>{name}</span>
        );
      },
    },
    {
      key: "quoteDate",
      label: "Quote Date",
      sortable: true,
      render: (quotation) => quotation.quoteDate || "--",
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (quotation) => {
        const apiError = quotationApiErrors[quotation.id];
        return (
          <select
            value={getQuotationStatus(quotation.status) || "DRAFT"}
            onChange={(event) => updateQuotationStatus(quotation, event.target.value)}
            onClick={(event) => event.stopPropagation()}
            title={apiError || "Update quotation status"}
            className={`rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${
              apiError
                ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                : "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"
            }`}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      sortable: true,
      render: (quotation) => (
        <span className="font-semibold text-slate-900 dark:text-white">
          {money(quotation.grandTotal)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (quotation) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => exportQuotationPdf(quotation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
            title="Export quotation as PDF"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>
          {getQuotationStatus(quotation.status) === "DRAFT" && (
            <button
              type="button"
              onClick={() => openEdit(quotation)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
              title="Edit draft quotation"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {getQuotationStatus(quotation.status) === "ACCEPTED" && (
            <button
              type="button"
              onClick={() => convertQuotationToSalesOrder(quotation)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
              title={quotationApiErrors[quotation.id] || "Convert to sales order"}
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setDeleteQuotation(quotation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (showFormModal) {
    const itemTotals = draftItemTotals;

    return (
      <>
        <PageMeta
          title={editingId ? "Edit Quotation" : "Create New Quotation"}
          description="Manage sales quotations"
        />
        <Dragger
          isOpen={showFormModal}
          title={editingId ? "Edit Quotation" : "Create Quotation"}
          subtitle="Configure quotation, customer, and line-item details."
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitLabel={editingId ? "Update Quotation" : "Create Quotation"}
          submitting={submitting}
          content={
            <form onSubmit={handleSubmit} className="p-1">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                  <div className="flex flex-col gap-5">
                    <div className="flex w-full flex-col gap-5">
                      {/* CUSTOMER */}
                      <div className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-start md:gap-6">
                        <label className="mt-3 shrink-0 text-[13px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600 dark:text-slate-400 dark:group-focus-within:text-blue-400 md:w-48">
                          Customer <span className="text-red-500">*</span>
                        </label>
                        <div className="flex-1">
                          <div className="flex max-w-[520px] overflow-hidden rounded-xl shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500/20">
                            <select
                              name="customerId"
                              value={form.customerId}
                              onChange={handleChange}
                              required
                              className="min-w-0 flex-1 border border-slate-200 border-r-0 bg-slate-50 px-4 py-2.5 text-[15px] font-medium text-slate-800 transition hover:bg-slate-100 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                            >
                              <option value="">Select Customer</option>
                              {form.customerId &&
                                !customers.some(
                                  (customer) => String(customer.id) === form.customerId
                                ) && (
                                  <option value={form.customerId}>
                                    {form.customerName || "Unknown Customer"}
                                  </option>
                                )}
                              {customers.map((customer) => (
                                <option key={customer.id} value={customer.id}>
                                  {customerOptionLabel(customer)}
                                </option>
                              ))}
                            </select>
                            {selectedCustomer && (
                              <div className="flex items-center justify-center border border-l-0 border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-900">
                                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                                    ₹
                                  </span>
                                  {selectedCustomer.currencyCode || form.currencyCode}
                                </span>
                              </div>
                            )}
                            {customers.length === 0 && (
                              <button
                                type="button"
                                onClick={() => navigate("/customers/new")}
                                className="flex items-center justify-center border border-l-0 border-slate-200 bg-cyan-50 px-3 text-cyan-700 transition hover:bg-cyan-100 dark:border-slate-700 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-900/50"
                                title="Create customer"
                                aria-label="Create customer"
                              >
                                <PlusIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                          <details className="mt-3 max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-800/40">
                            <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-slate-600 marker:text-cyan-600 dark:text-slate-300">
                              Address snapshots
                              <span className="ml-2 font-normal text-slate-400">Billing and shipping details</span>
                            </summary>
                            <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
                            <input
                              name="billingAddressLine1"
                              value={form.billingAddressLine1}
                              onChange={handleChange}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                              placeholder="Billing address"
                            />
                            <input
                              name="shippingAddressLine1"
                              value={form.shippingAddressLine1}
                              onChange={handleChange}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                              placeholder="Shipping address"
                            />
                            <input
                              name="billingAddressLine2"
                              value={form.billingAddressLine2}
                              onChange={handleChange}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                              placeholder="Billing address line 2"
                            />
                            <input
                              name="shippingAddressLine2"
                              value={form.shippingAddressLine2}
                              onChange={handleChange}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                              placeholder="Shipping address line 2"
                            />
                            <input
                              name="billingStreet"
                              value={form.billingStreet}
                              onChange={handleChange}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                              placeholder="Billing street"
                            />
                            <input
                              name="shippingStreet"
                              value={form.shippingStreet}
                              onChange={handleChange}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                              placeholder="Shipping street"
                            />
                            <input name="billingCity" value={form.billingCity} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Billing city" />
                            <input name="shippingCity" value={form.shippingCity} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Shipping city" />
                            <input name="billingState" value={form.billingState} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Billing state" />
                            <input name="shippingState" value={form.shippingState} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Shipping state" />
                            <input name="billingCountry" value={form.billingCountry} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Billing country" />
                            <input name="shippingCountry" value={form.shippingCountry} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Shipping country" />
                            <input name="billingPostalCode" value={form.billingPostalCode} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Billing postal code" />
                            <input name="shippingPostalCode" value={form.shippingPostalCode} onChange={handleChange} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500" placeholder="Shipping postal code" />
                            </div>
                          </details>
                        </div>
                      </div>

                      {/* QUOTE DETAILS */}
                      <div className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:gap-6">
                        <label className="shrink-0 text-[13px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600 dark:text-slate-400 dark:group-focus-within:text-blue-400 md:w-48">
                          Quote Details
                        </label>
                        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <input
                            name="quoteDate"
                            type="date"
                            value={form.quoteDate}
                            onChange={handleChange}
                            required
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <input
                            name="validUntil"
                            type="date"
                            value={form.validUntil}
                            onChange={handleChange}
                            required
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                          <select
                            name="quotationType"
                            value={form.quotationType}
                            onChange={handleChange}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {quotationTypeOptions.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:gap-6">
                        <label className="shrink-0 text-[13px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600 dark:text-slate-400 dark:group-focus-within:text-blue-400 md:w-48">
                          Commercial Details
                        </label>
                        <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <input name="customerReference" value={form.customerReference} onChange={handleChange} placeholder="Customer reference" className={itemFieldClass} />
                          <input name="customerReferenceDate" type="date" value={form.customerReferenceDate} onChange={handleChange} className={itemFieldClass} />
                          <input name="paymentTerms" value={form.paymentTerms} onChange={handleChange} placeholder="Payment terms" className={itemFieldClass} />
                          <input name="creditDays" type="number" min="0" value={form.creditDays} onChange={handleChange} placeholder="Credit days" className={itemFieldClass} />
                          <input name="deliveryTerms" value={form.deliveryTerms} onChange={handleChange} placeholder="Delivery terms" className={itemFieldClass} />
                          <input name="shippingMethod" value={form.shippingMethod} onChange={handleChange} placeholder="Shipping method" className={itemFieldClass} />
                          <input name="quotationAdditionalDiscount" type="number" min="0" step="0.01" value={form.quotationAdditionalDiscount} onChange={handleChange} placeholder="Additional discount" className={itemFieldClass} />
                        </div>
                      </div>

                      {/* SALES PERSON */}
                      <div className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:gap-6">
                        <label className="shrink-0 text-[13px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600 dark:text-slate-400 dark:group-focus-within:text-blue-400 md:w-48">
                          Sales Person <span className="text-red-500">*</span>
                        </label>
                        <div className="w-full max-w-3xl">
                          <select
                            name="salesPersonId"
                            value={form.salesPersonId}
                            onChange={handleChange}
                            required
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="">Select sales person</option>
                            {form.salesPersonId &&
                              !salesPersons.some(
                                (person) => String(person.id) === form.salesPersonId
                              ) && (
                                <option value={form.salesPersonId}>
                                  Selected sales person
                                </option>
                              )}
                            {salesPersons.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name || "Unnamed sales person"}
                              </option>
                            ))}
                          </select>
                          {selectedSalesPerson?.email && (
                            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                              Contact: {selectedSalesPerson.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* SUBJECT */}
                      <div className="group flex flex-col gap-2 md:flex-row md:items-start md:gap-6">
                        <label className="mt-3 shrink-0 text-[13px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600 dark:text-slate-400 dark:group-focus-within:text-blue-400 md:w-48">
                          Subject
                        </label>
                        <textarea
                          name="subject"
                          value={form.subject}
                          onChange={handleChange}
                          rows={2}
                          className="w-full max-w-xl resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-medium text-slate-800 shadow-sm transition placeholder:text-slate-400 hover:bg-slate-100 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:bg-slate-800 dark:focus:bg-slate-900"
                          placeholder="e.g., Quotation for Q3 office furniture supply"
                        />
                      </div>
                    </div>

                    {/* ADD ITEM CARD */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-cyan-50/60 to-white px-5 py-4 dark:border-slate-800 dark:from-cyan-950/30 dark:to-slate-900">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400">
                            <PlusIcon className="h-5 w-5" />
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              Add Item
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Fill in the details, then add it to this quotation
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("/purchase-products")}
                          className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 shadow-sm transition hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400 dark:hover:bg-cyan-900/50"
                        >
                          Create Product Now
                        </button>
                      </div>

                      <div className="space-y-4 p-5">
                        {/* ITEM TYPE TOGGLE */}
                        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
                          {(["PRODUCT", "SERVICE"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() =>
                                handleChange({
                                  target: { name: "itemType", value: type },
                                } as ChangeEvent<HTMLInputElement>)
                              }
                              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                                form.itemType === type
                                  ? "bg-white text-cyan-700 shadow-sm dark:bg-slate-900 dark:text-cyan-400"
                                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>

                        {/* CATEGORY / PRODUCT — PRODUCT mode uses selects,
                            SERVICE mode shows name/code/UOM inputs. */}
                        {form.itemType === "PRODUCT" ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <select
                              name="itemCategoryId"
                              value={form.itemCategoryId}
                              onChange={handleChange}
                              className={itemFieldClass}
                            >
                              <option value="">Select category</option>
                              {activeCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.parentName
                                    ? `${category.parentName} / ${category.categoryName}`
                                    : category.categoryName}
                                </option>
                              ))}
                            </select>
                            <select
                              name="itemProductId"
                              value={form.itemProductId}
                              onChange={handleChange}
                              className={itemFieldClass}
                            >
                              <option value="">Select product</option>
                              {filteredProducts.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.productName ||
                                    product.shortName ||
                                    "Unnamed product"}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <input
                              name="itemProductName"
                              value={form.itemProductName}
                              onChange={handleChange}
                              className={itemFieldClass}
                              placeholder="Service name"
                            />
                            <input
                              name="itemProductCode"
                              value={form.itemProductCode}
                              onChange={handleChange}
                              className={itemFieldClass}
                              placeholder="Service code"
                            />
                            <input
                              name="itemUom"
                              value={form.itemUom}
                              onChange={handleChange}
                              className={itemFieldClass}
                              placeholder="UOM"
                            />
                          </div>
                        )}

                        {/* DESCRIPTION ROW */}
                        {form.itemType === "PRODUCT" ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className={itemStaticChipClass}>
                              {form.itemProductCode || "Product code"}
                            </div>
                            <div className={itemStaticChipClass}>
                              {form.itemDescription || "Description"}
                            </div>
                            <div className={itemStaticChipClass}>
                              {form.itemUom || "UOM"}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3">
                            <input
                              name="itemDescription"
                              value={form.itemDescription}
                              onChange={handleChange}
                              className={itemFieldClass}
                              placeholder="Description"
                            />
                          </div>
                        )}

                        {/* QTY / RATE / DISC % / ADD DISC % / TAX % */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Quantity
                            </label>
                            <input
                              name="itemQuantity"
                              type="number"
                              min="1"
                              value={form.itemQuantity}
                              onChange={handleChange}
                              required
                              className={itemFieldClassSmall}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Rate
                            </label>
                            <input
                              name="itemUnitPrice"
                              type="number"
                              min="0"
                              step="0.01"
                              value={form.itemUnitPrice}
                              onChange={handleChange}
                              required
                              className={itemFieldClassSmall}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Disc %
                            </label>
                            <input
                              name="itemDiscountPercentage"
                              type="number"
                              min="0"
                              max="100"
                              value={form.itemDiscountPercentage}
                              onChange={handleChange}
                              className={itemFieldClassSmall}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Add Disc %
                            </label>
                            <input
                              name="itemAdditionalDiscountPercentage"
                              type="number"
                              min="0"
                              max="100"
                              value={form.itemAdditionalDiscountPercentage}
                              onChange={handleChange}
                              className={itemFieldClassSmall}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Tax %
                            </label>
                            <input
                              name="itemTaxRate"
                              type="number"
                              min="0"
                              max="100"
                              value={form.itemTaxRate}
                              onChange={handleChange}
                              className={itemFieldClassSmall}
                            />
                          </div>
                        </div>

                        {/* LIVE LINE TOTAL + ADD BUTTON */}
                        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Line total{" "}
                            <span className="ml-2 text-base font-black text-slate-900 dark:text-white">
                              {money(itemTotals.lineTotal)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={addCurrentItem}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
                          >
                            <PlusIcon className="h-4 w-4" />
                            {editingLineItemIndex == null ? "Add to Quotation" : "Update Item"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Items in this Quotation
                        </h4>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
                        </span>
                      </div>

                      {lineItems.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                          No items added yet — use the card above to add your first item.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {lineItems.map((item, index) => (
                            <div
                              key={`line-item-${index}`}
                              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={() => editLineItem(item, index)}
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
                                    title="Edit item"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLineItem(index)}
                                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                    title="Remove item"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {item.productName || "--"}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    {item.productCode && <span>{item.productCode}</span>}
                                    {item.description && <span>{item.description}</span>}
                                    {item.uom && <span>{item.uom}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 pl-9 text-xs text-slate-500 dark:text-slate-400 sm:pl-0">
                                <span>
                                  Qty{" "}
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {item.quantity}
                                  </strong>
                                </span>
                                <span>
                                  Rate{" "}
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {money(item.unitPrice)}
                                  </strong>
                                </span>
                                <span>
                                  Disc{" "}
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {item.discountPercentage}%
                                  </strong>
                                </span>
                                {item.additionalDiscount > 0 && (
                                  <span>
                                    Add Disc{" "}
                                    <strong className="text-slate-800 dark:text-slate-200">
                                      {money(item.additionalDiscount)}
                                    </strong>
                                  </span>
                                )}
                                <span>
                                  Tax{" "}
                                  <strong className="text-slate-800 dark:text-slate-200">
                                    {item.taxRate}%
                                  </strong>
                                </span>
                                <span className="rounded-lg bg-cyan-50 px-2.5 py-1 font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400">
                                  {money(calculateLineTotal(item))}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* NOTES */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <textarea
                        name="customerNotes"
                        value={form.customerNotes}
                        onChange={handleChange}
                        rows={3}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                        placeholder="Customer notes"
                      />
                      <textarea
                        name="termsAndConditions"
                        value={form.termsAndConditions}
                        onChange={handleChange}
                        rows={3}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                        placeholder="Terms and conditions"
                      />
                      <textarea
                        name="remarks"
                        value={form.remarks}
                        onChange={handleChange}
                        rows={3}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                        placeholder="Remarks"
                      />
                      <textarea
                        name="internalNotes"
                        value={form.internalNotes}
                        onChange={handleChange}
                        rows={3}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                        placeholder="Internal notes"
                      />
                    </div>
                  </div>

                  {/* RIGHT SIDEBAR — TOTALS */}
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-6">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Sub Total</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {money(displayTotals.subTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Discount</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          -{money(displayTotals.discountAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Additional Discount
                        </span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          -{money(displayTotals.additionalDiscount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Tax</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {money(displayTotals.taxAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black dark:border-slate-700">
                        <span className="text-slate-900 dark:text-white">Grand Total</span>
                        <span className="text-cyan-600 dark:text-cyan-400">
                          {money(displayTotals.grandTotal)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:disabled:bg-slate-700"
                      >
                        {submitting
                          ? "Saving..."
                          : editingId
                          ? "Update Quotation"
                          : "Create Quotation"}
                      </button>
                      <button
                        type="button"
                        onClick={closeForm}
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
            </form>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageMeta title="Quotations" description="Manage sales quotations" />
      <PageBreadcrumb
        pageTitle="Quotations"
        actions={<AddButton onClick={openCreate} label="Add Quotation" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Quotations" value={stats.total} icon={<DocumentTextIcon />} />
          <StatsCard
            label="Draft"
            value={stats.draft}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
            icon={<CalendarDaysIcon />}
          />
          <StatsCard
            label="Accepted"
            value={stats.accepted}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<DocumentTextIcon />}
          />
          <StatsCard
            label="Rejected"
            value={stats.rejected}
            gradient="from-rose-50 to-red-50"
            borderColor="border-rose-100"
            labelColor="text-rose-600"
            icon={<BanknotesIcon />}
          />
        </div>

        <ReusableTable
          data={quotations}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="quoteDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">No quotations found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Create your first quotation
              </button>
            </div>
          }
        />
      </div>

      <DynamicPopup
        isPopupOpen={!!deleteQuotation}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteQuotation(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
        iconBg="bg-red-100 dark:bg-red-950/40"
        innerText="Delete Quotation"
        subText={
          deleteQuotation
            ? `Are you sure you want to delete "${deleteQuotation.quoteNumber || "this quotation"}"?`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteQuotation(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default Quotations;
