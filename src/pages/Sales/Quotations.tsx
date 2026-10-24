import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ArrowRightCircleIcon,
  PencilSquareIcon,
  TrashIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import QuotationEmailDialog from "../../components/quotation/QuotationEmailDialog";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCardFilter, { StatsCardOption, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { fitLogo, loadImageAsDataUrl } from "../../components/common/export";
import { CompanyProfile, companyAddressLines, loadCompanyLogo, useCompany } from "../../company/companyApi";
import { ToasterService } from "../../Services/ToasterService";
import { SellerProfile } from "../../components/quotation/QuotationPreviewTemplate";
import { toLocalIsoDate, todayIso } from "../../utils/localDate";
import { publicAsset } from "../../utils/assets";
import { usePermissions } from "../../access/usePermissions";
import QuotationItemsEditor, {
  blankLine,
  formatRupees,
  lineAmounts,
  lineError,
  QuotationLine,
  QuotationProduct,
  quotationTotals,
} from "./QuotationItemsEditor";

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
};

const API_URL = "/v1/api/sales/quotations";
const CUSTOMERS_API = "/v1/api/sales/quotations/getCustomers";
// Quotation line items are sourced from Product Catalogue, not Purchase.
// Tenant context is supplied by the shared Axios interceptor via X-Tenant-ID.
const PRODUCT_CATALOGUE_PRODUCTS_API = "/v1/api/product/products";
const PAGE_SIZE = 10;
const statusOptions = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"];
/** Status moves the backend allows: a draft is sent, then the customer accepts or rejects it. */
const nextQuotationStatuses: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED"],
  VIEWED: ["ACCEPTED", "REJECTED"],
};
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

// The seller block of a quotation, from Company Settings
function sellerFromCompany(company: CompanyProfile | null): SellerProfile {
  const companyName = company?.companyName || "My Trading";
  const addressLines = companyAddressLines(company);
  return {
    companyName,
    legalName: company?.legalName || companyName,
    contactEmail: company?.email || "",
    contactPhone: company?.phone || "",
    gstin: company?.gstin || "",
    addressLines: addressLines.length > 0 ? addressLines : ["Address not set (Company Settings)"],
  };
}

const today = todayIso();

/** Quotations are valid for 30 days unless the user picks another date. */
const defaultValidUntil = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toLocalIsoDate(date);
};

const emptyForm: QuotationForm = {
  tenantId: getStoredTenantId(),
  customerId: "",
  customerName: "",
  customerCode: "",
  quotationType: "PRODUCT",
  validUntil: defaultValidUntil(),
  currencyCode: "INR",
  customerReference: "",
  customerReferenceDate: "",
  paymentTerms: "",
  creditDays: "",
  deliveryTerms: "",
  shippingMethod: "",
  quotationAdditionalDiscount: "0",
  remarks: "",
  internalNotes: "",
  customerNotes: "",
  subject: "",
  email: "",
  quoteNumber: "",
  quoteDate: today,
  status: "DRAFT",
  discountPercentage: "0",
  salesPersonId: "",
  termsAndConditions: "",
  versionNo: "0",
  billingAddressLine1: "",
  billingAddressLine2: "",
  billingStreet: "",
  billingCity: "",
  billingState: "",
  billingCountry: "",
  billingPostalCode: "",
  shippingAddressLine1: "",
  shippingAddressLine2: "",
  shippingStreet: "",
  shippingCity: "",
  shippingState: "",
  shippingCountry: "",
  shippingPostalCode: "",
};

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
  // The company's logo when it has one, else the app logo
  const companyLogo = await loadCompanyLogo();
  const logo = companyLogo ?? { dataUrl: await loadImageAsDataUrl(publicAsset("images/logo/logo.png")), format: "PNG" as const };
  const logoDataUrl = logo.dataUrl;
  const logoSize = companyLogo ? fitLogo(companyLogo, 38, 9) : { width: 38, height: 9 };
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
      doc.addImage(logoDataUrl, logo.format, reportMargin + 2 + (38 - logoSize.width) / 2, 8.5 + (9 - logoSize.height) / 2,
        logoSize.width, logoSize.height);
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

/** Totals of saved lines, for the PDF of a quotation that came back without totals. */
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

/** Clickable cards above the table: click one to show only those quotations. */
const quotationCards: StatsCardOption<Quotation>[] = [
  { key: "ALL", label: "All Quotations", match: () => true, tone: "cyan" },
  { key: "DRAFT", label: "Draft", match: (row) => getQuotationStatus(row.status) === "DRAFT", tone: "slate" },
  { key: "SENT", label: "Sent", match: (row) => getQuotationStatus(row.status) === "SENT", tone: "blue" },
  { key: "ACCEPTED", label: "Accepted", match: (row) => getQuotationStatus(row.status) === "ACCEPTED", tone: "green" },
  { key: "REJECTED", label: "Rejected", match: (row) => getQuotationStatus(row.status) === "REJECTED", tone: "red" },
];

/** Section heading inside the drawer (same look as the other create / edit drawers). */
const sectionTitle =
  "col-span-full mt-2 mb-1 border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-gray-800 dark:text-gray-400";

const quotationTypeChoices = quotationTypeOptions.map((type) => ({
  id: type,
  name: type.charAt(0) + type.slice(1).toLowerCase(),
}));

/** A saved line as an editable line. The discount comes back as the line's effective %. */
const toLine = (item: QuotationItem): QuotationLine => ({
  ...blankLine(item.itemType === "SERVICE" ? "SERVICE" : "PRODUCT"),
  id: item.id || undefined,
  productId: item.productId || undefined,
  categoryId: item.categoryId || undefined,
  categoryName: item.categoryName || "",
  productName: item.productName || "",
  productCode: item.productCode || "",
  description: item.description || "",
  uom: item.uom || "",
  quantity: Number(item.quantity) || 1,
  unitPrice: Number(item.unitPrice) || 0,
  discountPercentage: Number(item.discountPercentage) || 0,
  taxRate: Number(item.taxRate) || 0,
  taxCode: item.taxCode || "",
  remarks: item.remarks || "",
});

const ADDRESS_FIELDS = [
  { suffix: "AddressLine1", label: "Address" },
  { suffix: "City", label: "City" },
  { suffix: "State", label: "State" },
  { suffix: "Country", label: "Country" },
  { suffix: "PostalCode", label: "PIN Code" },
] as const;

const Quotations: React.FC = () => {
  const { canApprove, canCreate, canDelete, canExport, canUpdate } = usePermissions();
  // Statuses the user may move a quotation to: send is a POST, accept needs SALES:APPROVE, the rest are updates
  const canSetStatus = (status: string) =>
    status === "ACCEPTED" ? canApprove : status === "SENT" ? canCreate : canUpdate;
  const { canCreate: canCreateCustomer } = usePermissions("CRM");
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([]);
  const [products, setProducts] = useState<QuotationProduct[]>([]);
  const [form, setForm] = useState<QuotationForm>(emptyForm);
  const [lines, setLines] = useState<QuotationLine[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Line errors show only after the first Save, not while a new line is still being filled in
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [deleteQuotation, setDeleteQuotation] = useState<Quotation | null>(null);
  // Email dialog; markSent when it was opened by moving a draft to Sent
  const [emailing, setEmailing] = useState<{ quotation: Quotation; markSent: boolean } | null>(null);
  const [quotationApiErrors, setQuotationApiErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchQuotations();
    fetchCustomers();
    fetchSalesPersons();
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { company } = useCompany();
  const sellerProfile = useMemo(() => sellerFromCompany(company), [company]);
  const activeProducts = useMemo(() => products.filter((product) => product.active !== false), [products]);
  const { filteredRows, cardFilterProps } = useStatsCardFilter(quotations, quotationCards);

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customerOptionLabel(customer),
        keywords: [customer.customerCode, customer.tradeName].filter(Boolean),
      })),
    [customers]
  );
  const salesPersonOptions = salesPersons
    .filter((person) => person.active !== false || String(person.id) === form.salesPersonId)
    .map((person) => ({ id: String(person.id), name: person.name || `Sales person #${person.id}` }));

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

  const fetchProducts = async () => {
    try {
      const res = await axios.get<QuotationProduct[]>(PRODUCT_CATALOGUE_PRODUCTS_API, { headers });
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
      setProducts([]);
    }
  };

  /** Sets one field. Picking a customer copies its currency, addresses and sales person; a sales person, their email. */
  const setField = (name: keyof QuotationForm, value: string) => {
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
        // The customer's own sales person, unless one is already chosen
        const customerSalesPerson = salesPersons.find((person) => person.id === customer?.salesPersonId);
        if (!current.salesPersonId && customerSalesPerson) {
          next.salesPersonId = String(customerSalesPerson.id);
          next.email = customerSalesPerson.email || "";
        }
      }
      if (name === "salesPersonId") {
        const person = salesPersons.find((item) => String(item.id) === value);
        next.email = person?.email || "";
      }
      return next;
    });
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setField(e.target.name as keyof QuotationForm, e.target.value);

  const copyBillingToShipping = () =>
    setForm((current) => ({
      ...current,
      shippingAddressLine1: current.billingAddressLine1,
      shippingAddressLine2: current.billingAddressLine2,
      shippingStreet: current.billingStreet,
      shippingCity: current.billingCity,
      shippingState: current.billingState,
      shippingCountry: current.billingCountry,
      shippingPostalCode: current.billingPostalCode,
    }));

  const buildSalesPerson = (): Partial<SalesPerson> => {
    const selected = salesPersons.find((person) => String(person.id) === form.salesPersonId);
    return {
      id: toNumber(form.salesPersonId),
      tenantId: form.tenantId.trim(),
      name: selected?.name || "",
      code: selected?.code || "",
      email: selected?.email || "",
      region: selected?.region || "",
      active: selected?.active ?? true,
      userId: selected?.userId ?? "",
      employeeId: selected?.employeeId ?? 0,
    };
  };

  const buildPayload = () => {
    const totals = quotationTotals(lines, toNumber(form.quotationAdditionalDiscount));

    return {
      id: editingId || 0,
      customerId: toNumber(form.customerId),
      salesPersonId: toNumber(form.salesPersonId),
      quotationType: form.quotationType,
      validUntil: form.validUntil,
      currencyCode: form.currencyCode,
      customerReference: form.customerReference,
      customerReferenceDate: form.customerReferenceDate || null,
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
      items: lines.map((line) => ({
        id: line.id || 0,
        itemType: line.itemType,
        categoryId: line.categoryId,
        categoryName: line.categoryName,
        productId: line.itemType === "PRODUCT" ? line.productId : undefined,
        productName: line.productName.trim(),
        productCode: line.productCode,
        description: line.description.trim(),
        // Blank is sent as null: the server only accepts its own unit names
        uom: line.uom || null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercentage: line.discountPercentage,
        discountAmount: lineAmounts(line).discount,
        taxRate: line.taxRate,
        taxCode: line.taxCode,
        remarks: line.remarks,
        additionalDiscount: 0,
      })),
      quoteNumber: form.quoteNumber,
      quoteDate: form.quoteDate,
      status: form.status,
      subTotal: totals.subTotal,
      // Line discounts are inside each line; the header carries only the extra discount
      // (sending the line discounts here too made the server take them off twice)
      discountAmount: 0,
      discountPercentage: 0,
      additionalDiscount: totals.additionalDiscount,
      taxAmount: totals.tax,
      grandTotal: totals.grandTotal,
      salesPerson: buildSalesPerson(),
      termsAndConditions: form.termsAndConditions,
      versionNo: toNumber(form.versionNo),
    };
  };

  /** First reason the quotation can't be saved yet, or null. */
  const formProblem = () => {
    if (!form.tenantId.trim()) return "Your session has no company selected. Sign in again.";
    if (!isPositiveNumber(form.customerId)) return "Choose the customer.";
    if (!isPositiveNumber(form.salesPersonId)) return "Choose the sales person.";
    if (!form.quoteDate || !form.validUntil) return "Enter the quote date and the valid-until date.";
    if (form.validUntil < form.quoteDate) return "Valid until can't be before the quote date.";
    if (lines.length === 0) return "Add at least one product or service.";
    const badLine = lines.findIndex((line) => lineError(line));
    if (badLine >= 0) return `Item ${badLine + 1}: ${lineError(lines[badLine])}.`;
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    const problem = formProblem();
    if (problem) {
      ToasterService.error("Can't save the quotation yet", problem);
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
    setSubmitAttempted(false);
    setLines([blankLine("PRODUCT")]);
    setForm({
      ...emptyForm,
      tenantId: getStoredTenantId(),
      quoteDate: todayIso(),
      validUntil: defaultValidUntil(),
    });
    setShowForm(true);
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
      const customer = customers.find((item) => Number(item.id) === Number(full.customerId));
      setLines((full.items || []).map(toLine));
      setEditingId(full.id);
      setSubmitAttempted(false);
      setForm({
        ...emptyForm,
        tenantId: getStoredTenantId(),
        customerId: String(full.customerId || ""),
        customerName: customer?.customerName || full.billingAddress?.customerName || "",
        customerCode: customer?.customerCode || full.billingAddress?.customerCode || "",
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
        discountPercentage: "0",
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
      });
      setShowForm(true);
    } catch (error) {
      ToasterService.error("Failed to load quotation", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const updateQuotationStatus = async (quotation: Quotation, status: string, withoutEmail = false) => {
    if (status === getQuotationStatus(quotation.status)) return;
    // Sending a draft emails it to the customer (the dialog can still mark it sent without an email)
    if (status === "SENT" && !withoutEmail) {
      setEmailing({ quotation, markSent: true });
      return;
    }

    try {
      setLoading(true);
      const requestConfig = { headers, params: { tenantId: getStoredTenantId() } };
      // Each status move has its own endpoint; a plain edit (PUT) never changes the status
      const action = status === "SENT" ? "send" : status === "ACCEPTED" ? "accept" : "reject";
      const res = await axios.post<Quotation>(`${API_URL}/${quotation.id}/${action}`, {}, requestConfig);
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

  /** The quotation's PDF as a file, built the same way as the download. */
  const quotationPdfBlob = async (quotation: Quotation): Promise<Blob> => {
    const res = await axios.get<Quotation>(`${API_URL}/${quotation.id}`, { headers });
    const customer = customers.find((item) => Number(item.id) === Number(res.data.customerId));
    const pdfUrl = await createQuotationPdfUrl(res.data, sellerProfile, customer);
    try {
      return await (await fetch(pdfUrl)).blob();
    } finally {
      URL.revokeObjectURL(pdfUrl);
    }
  };

  const customerEmailFor = (quotation: Quotation) =>
    quotation.email || customers.find((item) => Number(item.id) === Number(quotation.customerId))?.email || "";

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
    setShowForm(false);
    setEditingId(null);
    setLines([]);
    setSubmitAttempted(false);
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
      // 20 Oct 2026; sorting still uses the real date
      render: (quotation) => (quotation.quoteDate ? formatPdfDate(quotation.quoteDate) : "--"),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (quotation) => {
        const apiError = quotationApiErrors[quotation.id];
        const currentStatus = getQuotationStatus(quotation.status) || "DRAFT";
        const next = nextQuotationStatuses[currentStatus] || [];
        const choices = statusOptions.filter(
          (status) => status === currentStatus || (next.includes(status) && canSetStatus(status))
        );
        if (choices.length <= 1) {
          return (
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
              {currentStatus}
            </span>
          );
        }
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
            {choices.map((status) => (
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
      className: "text-right",
      headerClassName: "text-right",
      render: (quotation) => (
        <span className="font-semibold text-slate-900 dark:text-white">
          {formatRupees(Number(quotation.grandTotal || 0))}
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
          {canExport && (<button
            type="button"
            onClick={() => exportQuotationPdf(quotation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
            title="Export quotation as PDF"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
          </button>)}
          {canCreate && ["DRAFT", "SENT", "VIEWED", "ACCEPTED"].includes(getQuotationStatus(quotation.status) || "DRAFT") && (
            <button
              type="button"
              onClick={() => setEmailing({ quotation, markSent: false })}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
              title="Email quotation to the customer"
            >
              <EnvelopeIcon className="h-4 w-4" />
            </button>
          )}
          {getQuotationStatus(quotation.status) === "DRAFT" && (
            canUpdate && <button
              type="button"
              onClick={() => openEdit(quotation)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
              title="Edit draft quotation"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {getQuotationStatus(quotation.status) === "ACCEPTED" && canCreate && (
            <button
              type="button"
              onClick={() => convertQuotationToSalesOrder(quotation)}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
              title={quotationApiErrors[quotation.id] || "Convert to sales order"}
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (<button
            type="button"
            onClick={() => setDeleteQuotation(quotation)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>)}
        </div>
      ),
    },
  ];

  /** Billing or shipping address boxes, one column of the Addresses section. */
  const addressColumn = (prefix: "billing" | "shipping") => (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">
          {prefix === "billing" ? "Billing" : "Shipping"}
        </span>
        {prefix === "shipping" && (
          <button
            type="button"
            onClick={copyBillingToShipping}
            className="text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Same as billing
          </button>
        )}
      </div>
      {ADDRESS_FIELDS.map(({ suffix, label }) => {
        const name = `${prefix}${suffix}` as keyof QuotationForm;
        return (
          <FloatingInput
            key={name}
            label={label}
            name={name}
            value={form[name]}
            onChange={handleChange}
            maxLength={suffix === "PostalCode" ? 10 : 150}
          />
        );
      })}
    </div>
  );

  return (
    <>
      <PageMeta title="Quotations" description="Manage sales quotations" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Quotations"
        actions={canCreate ? <AddButton className="-mr-5" onClick={openCreate} label="Add Quotation" /> : undefined}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="px-3 py-5">
          {/* Click a card to show only its quotations; click it again to show all. */}
          <StatsCardFilter {...cardFilterProps} />
          <ReusableTable
            data={filteredRows}
            columns={columns}
            loading={loading}
            pageSize={PAGE_SIZE}
            defaultSortKey="quoteDate"
            defaultSortOrder="desc"
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
                <p className="mb-2 text-sm text-gray-500 dark:text-slate-400">No quotations found</p>
                {canCreate && (<button
                  type="button"
                  onClick={openCreate}
                  className="text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  Create your first quotation
                </button>)}
              </div>
            }
          />
        </div>
      </div>

      {/* Create / edit in the standard side drawer: sections, floating fields, Cancel / Save at the bottom */}
      <Dragger
        isOpen={showForm}
        title={editingId ? "Edit Quotation" : "Add Quotation"}
        subtitle={editingId ? `Draft ${form.quoteNumber || ""}`.trim() : "Prepare a price quote for a customer."}
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitLabel={editingId ? "Update" : "Create"}
        submitting={submitting}
      >
        <div className="grid grid-cols-1 gap-x-3 md:grid-cols-2">
          <h3 className={sectionTitle}>Quotation Details</h3>
          <div className="mb-5">
            <SearchableSelect
              label="Customer"
              required
              value={form.customerId}
              options={
                // A saved customer that is no longer listed still shows by name
                form.customerId && !customerOptions.some((option) => option.value === form.customerId)
                  ? [{ value: form.customerId, label: form.customerName || "Unknown customer" }, ...customerOptions]
                  : customerOptions
              }
              onChange={(value) => setField("customerId", value)}
              placeholder="Type a customer name or code"
            />
            {customers.length === 0 && canCreateCustomer && (
              <button
                type="button"
                onClick={() => navigate("/customers/new")}
                className="mt-1 px-1 text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
              >
                No customers yet: create one
              </button>
            )}
          </div>
          <FloatingSelect1
            label="Sales Person"
            required
            name="salesPersonId"
            value={form.salesPersonId}
            onChange={handleChange}
            options={
              form.salesPersonId && !salesPersonOptions.some((option) => option.id === form.salesPersonId)
                ? [{ id: form.salesPersonId, name: "Selected sales person" }, ...salesPersonOptions]
                : salesPersonOptions
            }
          />
          <FloatingDatePicker
            label="Quote Date"
            required
            name="quoteDate"
            value={form.quoteDate}
            onChange={handleChange}
          />
          <FloatingDatePicker
            label="Valid Until"
            required
            name="validUntil"
            value={form.validUntil}
            onChange={handleChange}
            minDate={form.quoteDate || undefined}
          />
          <FloatingSelect1
            label="Quotation Type"
            name="quotationType"
            value={form.quotationType}
            onChange={handleChange}
            options={quotationTypeChoices}
            includeEmptyOption={false}
          />
          <FloatingInput
            label="Currency (from the customer)"
            name="currencyCode"
            value={form.currencyCode}
            readOnly
            tabIndex={-1}
            className="cursor-default bg-slate-50"
          />
          <div className="md:col-span-2">
            <FloatingInput
              label="Subject (e.g. Quotation for Q3 office furniture)"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              maxLength={200}
            />
          </div>

          <h3 className={sectionTitle}>Items</h3>
          <div className="mb-5 md:col-span-2">
            <QuotationItemsEditor
              lines={lines}
              onChange={setLines}
              products={activeProducts}
              additionalDiscount={toNumber(form.quotationAdditionalDiscount)}
              onAdditionalDiscountChange={(value) => setField("quotationAdditionalDiscount", String(value))}
              showErrors={submitAttempted}
              onCreateProduct={() => navigate("/purchase-products")}
            />
          </div>

          <h3 className={sectionTitle}>Terms &amp; Delivery</h3>
          <FloatingInput label="Payment Terms" name="paymentTerms" value={form.paymentTerms} onChange={handleChange} maxLength={100} />
          <FloatingInput
            label="Credit Days"
            type="number"
            min={0}
            name="creditDays"
            value={form.creditDays}
            onChange={handleChange}
            onKeyDown={(event) => ["-", "+", "e", "E", "."].includes(event.key) && event.preventDefault()}
            onWheel={(event) => event.currentTarget.blur()}
          />
          <FloatingInput label="Delivery Terms" name="deliveryTerms" value={form.deliveryTerms} onChange={handleChange} maxLength={100} />
          <FloatingInput label="Shipping Method" name="shippingMethod" value={form.shippingMethod} onChange={handleChange} maxLength={100} />
          <FloatingInput label="Customer Reference (PO / enquiry no.)" name="customerReference" value={form.customerReference} onChange={handleChange} maxLength={100} />
          <FloatingDatePicker label="Customer Reference Date" name="customerReferenceDate" value={form.customerReferenceDate} onChange={handleChange} />

          <h3 className={sectionTitle}>Addresses</h3>
          {addressColumn("billing")}
          {addressColumn("shipping")}

          <h3 className={sectionTitle}>Notes</h3>
          <FloatingTextarea label="Customer Notes (on the quotation)" name="customerNotes" value={form.customerNotes} onChange={handleChange} rows={3} />
          <FloatingTextarea label="Terms and Conditions" name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} rows={3} />
          <FloatingTextarea label="Remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={3} />
          <FloatingTextarea label="Internal Notes (not shown to the customer)" name="internalNotes" value={form.internalNotes} onChange={handleChange} rows={3} />
        </div>
      </Dragger>

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

      {emailing && (
        <QuotationEmailDialog
          quotation={emailing.quotation}
          defaultTo={customerEmailFor(emailing.quotation)}
          companyName={company?.companyName || "My Trading"}
          markSent={emailing.markSent && getQuotationStatus(emailing.quotation.status) === "DRAFT"}
          getPdf={() => quotationPdfBlob(emailing.quotation)}
          onClose={() => setEmailing(null)}
          onSent={(updated) => {
            const id = emailing.quotation.id;
            setQuotations((current) => current.map((item) => (item.id === id ? { ...item, ...updated } as Quotation : item)));
            setEmailing(null);
          }}
          onSendWithoutEmail={() => {
            const target = emailing.quotation;
            setEmailing(null);
            updateQuotationStatus(target, "SENT", true);
          }}
        />
      )}
    </>
  );
};

export default Quotations;
