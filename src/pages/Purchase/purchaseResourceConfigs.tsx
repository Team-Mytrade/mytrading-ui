import React from "react";
import axios from "axios";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import {
  makeRelation,
  PurchaseRecord,
  PurchaseResourceConfig,
  SelectOption,
  toNumberOrZero,
} from "./PurchaseResourcePage";
import LineItemsEditor, { LineItem, taxRateFromCode } from "../Purchase/LineItemsEditor";
import GoodsReceiptEditor from "../purchase-service/GoodsReceiptEditor";
import RequisitionWorkflowActions from "./RequisitionWorkflowActions";
import { todayIso } from "../../utils/localDate";
import { APP_ROUTES, recordLink } from "../../utils/appRoutes";

const PURCHASE = "/v1/api/purchase";
const CATEGORIES = "/v1/api/purchase/product-categories";
const PRODUCT_CATALOGUE_PRODUCTS = "/v1/api/product/products";

const boolText = (value: boolean, onText = "Enabled", offText = "Disabled") => (
  <span className={value ? "text-green-700 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}>{value ? onText : offText}</span>
);

/** Status names shown to users (SUBMITTED reads better as "Pending Approval"). */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending Approval",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
  RECEIVED: "Received",
  PARTIALLY_RECEIVED: "Partly Received",
  ISSUED: "Issued",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** Readable status text (for export and anywhere a badge can't be used). */
const statusLabel = (value: unknown) => {
  const status = String(value || "").toUpperCase();
  if (!status) return "--";
  return STATUS_LABELS[status] || status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
};

const statusBadge = (value: string) => {
  const status = String(value || "").toUpperCase();
  if (!status) return <span className="text-gray-400">--</span>;
  // One colour per meaning, with dark-mode variants.
  const tone =
    ["APPROVED", "RECEIVED", "ACTIVE", "ISSUED"].includes(status)
      ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"
      : ["REJECTED", "INACTIVE"].includes(status)
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : ["SUBMITTED", "PENDING", "PARTIALLY_RECEIVED"].includes(status)
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
          : status === "DRAFT"
            ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            : ["CANCELLED", "CLOSED"].includes(status)
              ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  const label = STATUS_LABELS[status] || status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
};

/**
 * Any date the API returns → "YYYY-MM-DD" (what the date picker needs), or "" if empty.
 * Handles "2026-10-22", "2026-10-22T00:00:00", [2026, 10, 22] (Java LocalDate as array)
 * and "22-10-2026" / "22/10/2026".
 */
const dateOnly = (value: unknown): string => {
  if (value == null || value === "") return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value.map(Number);
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const dayFirst = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`;
  return "";
};
const currentLocalDateTime = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
};
const EMPTY_OPTIONS: SelectOption[] = [];
const EMPTY_LINE_ITEMS: LineItem[] = [];

const getStoredUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getSessionMeta = () => {
  const storedUser = getStoredUser();
  return {
    userId: storedUser?.userId || storedUser?.id || "system",
    tenantId: storedUser?.tenantId || "TENANT_1",
  };
};

/** Returns the most useful display name available for the signed-in user. */
const getLoggedInUserName = () => {
  const user = getStoredUser();
  return user?.fullName || user?.name || user?.username || user?.userName || user?.email || user?.userId || user?.id || "System";
};

type RequisitionItemsEditorProps = {
  form: PurchaseRecord;
  setForm: React.Dispatch<React.SetStateAction<PurchaseRecord>>;
  options: Record<string, SelectOption[]>;
};

/** Renders product choices sourced from the live Product Catalogue list. */
const RequisitionItemsEditor = ({ form, setForm, options }: RequisitionItemsEditorProps) => {
    const products = options.productId || EMPTY_OPTIONS;
  const items = Array.isArray(form.items) ? (form.items as LineItem[]) : EMPTY_LINE_ITEMS;

  // Copies product code, name and UOM from the Product Catalogue onto each line.
  const withProductDetails = (next: LineItem[]) =>
    next.map((item) => {
      const product = products.find((option) => String(option.value) === String(item.productId))?.raw;
      if (!product) return item;
      return {
        ...item,
              productCode: product.productCode ?? (item as PurchaseRecord).productCode ?? "",
        productName: product.productName ?? (item as PurchaseRecord).productName ?? "",
        unitOfMeasure: item.unitOfMeasure || product.uom || "PIECES",
      };
    });

  return (
    <LineItemsEditor
      items={items}
      onChange={(next) => setForm((current) => ({ ...current, items: withProductDetails(next) }))}
      products={products.map((option) => ({
        id: option.value,
        productName: option.label,
        uom: String(option.raw?.uom || "PIECES"),
        categoryId: option.raw?.productCategory?.id ?? option.raw?.category?.id ?? option.raw?.categoryId ?? "",
      }))}
      uomOptions={["PIECES", "BOX", "PACK", "KILOGRAM", "GRAM", "LITRE", "METER"]}
    />
  );
};

// ─────────────────────────────────────────────────────────────
// VENDORS
// ─────────────────────────────────────────────────────────────
export const vendorConfig: PurchaseResourceConfig = {
  title: "Vendors",
  formSubtitle:"Add or update a supplier record.",
  description: "Create and manage purchase vendors from the Purchase Service vendor controller.",
  endpoint: `${PURCHASE}/vendors`,
  allowInlineActiveToggle: true,
  columns: [
    { key: "name", label: "Vendor Name" },
    { key: "contactName", label: "Contact" },
    {
      key: "contactEmail",
      label: "Email",
      render: (row) => {
        const email = row.contactEmail || "--";
        return (
          <span className="block max-w-[180px] truncate text-sm text-gray-700" title={email}>
            {email}
          </span>
        );
      },
    },
    { key: "contactPhone", label: "Phone" },
    { key: "city", label: "City" },
    { key: "active", label: "Status" },
  ],
  fields: [
    { name: "name", label: "Vendor Name", required: true },
    { name: "contactName", label: "Contact Name" },
    { name: "contactEmail", label: "Contact Email", type: "email" },
    { name: "contactPhone", label: "Contact Phone", type: "tel" },
    { name: "address", label: "Address", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "city", label: "City" },
    { name: "state", label: "State" },
    { name: "postalCode", label: "Postal Code" },
    { name: "country", label: "Country" },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["name", "contactName", "contactEmail", "city", "country"],
  buildPayload: (form) => ({
    name: form.name || "",
    contactName: form.contactName || "",
    contactEmail: form.contactEmail || "",
    contactPhone: form.contactPhone || "",
    address: form.address || "",
    city: form.city || "",
    state: form.state || "",
    postalCode: form.postalCode || "",
    country: form.country || "",
    active: Boolean(form.active),
  }),
};

// ─────────────────────────────────────────────────────────────
// TERMS AND CONDITIONS
// ─────────────────────────────────────────────────────────────
export const termsConfig: PurchaseResourceConfig = {
  title: "Terms and Conditions",
  formSubtitle:"Add a product to the purchase catalog.",
  description: "Maintain purchase terms and conditions exactly as exposed by the terms controller.",
  endpoint: `${PURCHASE}/terms`,
  allowInlineActiveToggle: true,
  columns: [
    { key: "title", label: "Title" },
    { key: "content", label: "Content" },
    { key: "active", label: "Status" },
  ],
  fields: [
    { name: "title", label: "Title", required: true },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
    {
      name: "content",
      label: "Content",
      type: "textarea",
      required: true,
      gridClassName: "md:col-span-2",
    },
  ],
  searchFields: ["title", "content"],
  buildPayload: (form) => ({
    title: form.title || "",
    content: form.content || "",
    active: Boolean(form.active),
  }),
};

// ─────────────────────────────────────────────────────────────
// PRODUCT CATEGORIES
// ─────────────────────────────────────────────────────────────
export const productCategoryConfig: PurchaseResourceConfig = {
  title: "Product Categories",
  description: "Manage product categories used by purchase products and requisition line items.",
  formSubtitle:"Group products under a category.",
  endpoint: CATEGORIES,
  getByIdEndpoint: (row) => `${CATEGORIES}/${row.id}`,
  columns: [
    { key: "categoryCode", label: "Code" },
    { key: "categoryName", label: "Category Name" },
    { key: "shortCode", label: "Short Code" },
    { key: "parentName", label: "Parent" },
    { key: "active", label: "Status" },
  ],
  fields: [
    { name: "categoryCode", label: "Category Code", required: true },
    { name: "categoryName", label: "Category Name", required: true },
    { name: "shortCode", label: "Short Code" },
    {
      name: "parentId",
      label: "Parent Category",
      type: "select",
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
    },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["categoryCode", "categoryName", "shortCode", "parentName"],
  buildPayload: (form) => {
    const payload: Record<string, unknown> = {
      categoryCode: form.categoryCode,
      categoryName: form.categoryName,
      shortCode: form.shortCode,
      description: form.description,
      active: Boolean(form.active),
    };
    const parentId = toNumberOrZero(form.parentId);
    if (parentId > 0) payload.parentId = parentId;
    return payload;
  },
};

// ─────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────
export const productConfig: PurchaseResourceConfig = {
  title: "Products",
  description: "Maintain purchase products from the purchase product controller.",
  formSubtitle:"Define terms and conditions for purchase orders.",
  endpoint: `${PURCHASE}/products`,
  scope: { idParam: "productId", nameParam: "productName", label: "Product" },
  columns: [
    { key: "productCode", label: "Code" },
    { key: "productName", label: "Product Name" },
    { key: "categoryName", label: "Category" },
    { key: "brand", label: "Brand" },
    { key: "uom", label: "UOM" },
    { key: "standardCost", label: "Standard Cost" },
    { key: "sellingPrice", label: "Selling Price" },
    { key: "stockItem", label: "Stock Item", render: (row) => boolText(Boolean(row.stockItem)) },
    { key: "serviceItem", label: "Service Item", render: (row) => boolText(Boolean(row.serviceItem)) },
    { key: "active", label: "Status" },
  ],
  fields: [
    { name: "productName", label: "Product Name", required: true },
    { name: "shortName", label: "Short Name" },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      required: true,
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
    },
    { name: "brand", label: "Brand" },
    { name: "modelNo", label: "Model No" },
    { name: "barcode", label: "Barcode" },
    {
      name: "uom",
      label: "UOM",
      type: "select",
      defaultValue: "PIECES",
      options: ["PIECES", "KG", "LITER", "METER", "BOX", "PACK"].map((item) => ({
        value: item,
        label: item,
      })),
    },
    { name: "standardCost", label: "Standard Cost", type: "number", defaultValue: 0 },
    { name: "sellingPrice", label: "Selling Price", type: "number", defaultValue: 0 },
    { name: "taxCode", label: "Tax Code" },
    { name: "stockItem", label: "Stock Item", type: "checkbox", defaultValue: true },
    { name: "serviceItem", label: "Service Item", type: "checkbox", defaultValue: false },
    { name: "serialTracking", label: "Serial Tracking", type: "checkbox", defaultValue: false },
    { name: "batchTracking", label: "Batch Tracking", type: "checkbox", defaultValue: false },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["productCode", "productName", "categoryName", "brand", "uom"],
  normalizeForm: (row) => ({ ...row, categoryId: row.category?.id ?? row.categoryId ?? "" }),
  buildPayload: (form) => ({
    productName: form.productName,
    shortName: form.shortName,
    description: form.description,
    categoryId: toNumberOrZero(form.categoryId),
    brand: form.brand,
    modelNo: form.modelNo,
    barcode: form.barcode,
    uom: form.uom || "PIECES",
    standardCost: toNumberOrZero(form.standardCost),
    sellingPrice: toNumberOrZero(form.sellingPrice),
    taxCode: form.taxCode,
    stockItem: Boolean(form.stockItem),
    serviceItem: Boolean(form.serviceItem),
    serialTracking: Boolean(form.serialTracking),
    batchTracking: Boolean(form.batchTracking),
    active: Boolean(form.active),
  }),
};

// ─────────────────────────────────────────────────────────────
// PURCHASE REQUISITIONS  — with icon-only Create PO action
// ─────────────────────────────────────────────────────────────
/** Today's date as YYYY-MM-DD in local time (toISOString() uses UTC). */
const todayLocal = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Reads the payload (middle part) of a JWT, or null if it isn't a readable JWT. */
const decodeJwtPayload = (token: unknown) => {
  try {
    const part = String(token || "").replace(/^Bearer\s+/i, "").split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
  } catch {
    return null;
  }
};

/** First positive numeric user id found on an object (stored user or JWT payload). */
const pickUserId = (source: any) =>
  [source?.userId, source?.id, source?.user_id, source?.user?.userId, source?.user?.id]
    .map((value) => toNumberOrZero(value))
    .find((value) => value > 0) ?? 0;

/**
 * Numeric id of the signed-in user, or 0 if it can't be found.
 * 1. localStorage "user" (userId / id).  2. userId inside the login token (JWT).
 */
const getLoggedInUserId = () => {
  if (typeof window === "undefined") return 0;
  const fromUser = pickUserId(getStoredUser());
  if (fromUser > 0) return fromUser;

  const storage = window.localStorage;
  for (let index = 0; index < storage.length; index += 1) {
    const raw = storage.getItem(storage.key(index) || "") || "";
    let fromToken = pickUserId(decodeJwtPayload(raw));
    if (fromToken > 0) return fromToken;
    try {
      const parsed = JSON.parse(raw);
      fromToken = pickUserId(decodeJwtPayload(parsed?.token ?? parsed?.accessToken ?? parsed?.jwt));
      if (fromToken > 0) return fromToken;
    } catch {
      // not JSON, ignore
    }
  }
  return 0;
};

/** PR status in upper case; a PR without a status is treated as DRAFT. */
/** A PO can be changed only while it is waiting for approval and nothing has been received. */
const isPoEditable = (row: PurchaseRecord) => {
  const approval = String(row.approvalStatus || "PENDING").toUpperCase();
  const status = String(row.status || "DRAFT").toUpperCase();
  return approval === "PENDING" && !["RECEIVED", "PARTIALLY_RECEIVED", "CANCELLED", "CLOSED"].includes(status);
};

/**
 * The backend writes the reject / cancel reason into `notes`, e.g. ",kbhjvgh Rejected: no budget".
 * Splits it into the requester's remarks and the reason. A separate rejectionReason /
 * cancellationReason field from the backend is used when present.
 */
const splitNotes = (value: unknown, row?: PurchaseRecord) => {
  const text = String(value ?? "").trim();
  const match = text.match(/\s*(Rejected|Cancelled|Canceled):\s*(.*)$/is);
  const separate = row?.rejectionReason || row?.cancellationReason;
  if (!match) return { remarks: text, reason: separate ? String(separate) : "", reasonLabel: "Reason" };
  const label = match[1].toLowerCase().startsWith("rej") ? "Rejection reason" : "Cancellation reason";
  return { remarks: text.slice(0, match.index).trim(), reason: match[2].trim(), reasonLabel: label };
};

const prStatus = (row: PurchaseRecord) => String(row.status || "DRAFT").toUpperCase();

export const purchaseRequisitionConfig: PurchaseResourceConfig = {
  title: "Purchase Requisitions",
  formSubtitle: "Create a requisition with the products and quantities required.",
  description: "Create purchase requisitions for products from the Product Catalogue service.",
  endpoint: `${PURCHASE}/purchase-requisitions`,
  getByIdEndpoint: (row) => `${PURCHASE}/purchase-requisitions/${row.id}`,
  // Opened from a link (e.g. PR number in a PO): show only that requisition.
  scope: { idParam: "requisitionId", nameParam: "requisitionNumber", label: "Requisition" },
  // Status flow: DRAFT -> SUBMITTED -> APPROVED / REJECTED; CANCELLED.
  // Status changes only via the Submit/Approve/Reject/Cancel buttons.
  // Only a DRAFT PR can be edited or deleted; after Submit it is waiting for approval.
  canEditRow: (row) => prStatus(row) === "DRAFT",
  // Clickable status cards above the table (click one to show only those PRs).
  statsCards: () => [
    { key: "ALL", label: "All Requisitions", match: () => true, tone: "cyan" },
    { key: "DRAFT", label: "Draft", match: (row) => prStatus(row) === "DRAFT", tone: "slate" },
    { key: "SUBMITTED", label: "Pending Approval", match: (row) => prStatus(row) === "SUBMITTED", tone: "blue" },
    { key: "APPROVED", label: "Approved", match: (row) => prStatus(row) === "APPROVED", tone: "green" },
    { key: "REJECTED", label: "Rejected", match: (row) => prStatus(row) === "REJECTED", tone: "red" },
    { key: "CANCELLED", label: "Cancelled", match: (row) => prStatus(row) === "CANCELLED", tone: "amber" },
  ],
  canDeleteRow: (row) => prStatus(row) === "DRAFT",
  // Line items get their own tab.
  formExtrasSection: "Items",
  columns: [
    { key: "requisitionNumber", label: "PR Number" },
    {
      key: "requiredByDate",
      label: "Required By",
      // Shown as 22 Oct 2026; sorting still uses the real date.
      render: (row) => {
        const date = dateOnly(row.requiredByDate ?? row.requiredDate);
        if (!date) return "--";
        const [year, month, day] = date.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      },
      sortValueGetter: (row) => dateOnly(row.requiredByDate ?? row.requiredDate),
    },
    { key: "items", label: "Items", render: (row) => String(Array.isArray(row.items) ? row.items.length : 0) },
    // The backend adds "Rejected: <reason>" to the end of notes. Remarks shows the requester's text,
    // and for a rejected / cancelled PR the reason under it in red.
    {
      key: "notes",
      label: "Remarks",
      render: (row) => {
        const { remarks, reason, reasonLabel } = splitNotes(row.notes, row);
        if (!reason) return remarks || "--";
        return (
          <div className="leading-snug">
            <div>{remarks || "--"}</div>
            <div className="mt-0.5 text-xs text-red-600 dark:text-red-400">
              {reasonLabel}: {reason}
            </div>
          </div>
        );
      },
      exportValue: (row) => splitNotes(row.notes, row).remarks,
      detailFormatter: (row) => splitNotes(row.notes, row).remarks || "--",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => statusBadge(String(row.status ?? "")),
      detailFormatter: (row) => {
        const { reason, reasonLabel } = splitNotes(row.notes, row);
        return (
          <div className="space-y-1">
            {statusBadge(String(row.status ?? ""))}
            {reason && (
              <p className="text-sm text-red-700 dark:text-red-300">
                <span className="font-medium">{reasonLabel}:</span> {reason}
              </p>
            )}
          </div>
        );
      },
      exportValue: (row) => {
        const { reason } = splitNotes(row.notes, row);
        return reason ? `${statusLabel(row.status)} (${reason})` : statusLabel(row.status);
      },
    },
  ],
  fields: [
    // Starts empty: the requester picks when the goods are really needed (today or later).
    {
      name: "requiredByDate", section: "Requisition Details",
      label: "Required By Date",
      type: "date",
      required: true,
      validate: (value) => {
        const date = String(value || "");
        if (!date) return null; // "required" message comes from required: true
        return date < todayLocal() ? "Required-by date cannot be in the past" : null;
      },
    },
    // Pre-filled with the signed-in user; can be typed if it could not be found.
    {
      name: "userId", section: "Requisition Details",
      label: "User ID",
      type: "number",
      required: true,
      min: 1,
      decimals: 0,
      validate: (value) => (value !== "" && toNumberOrZero(value) <= 0 ? "Enter a valid User ID" : null),
    },
    // Shown as "Remarks"; the API field is still `notes`.
    { name: "notes", section: "Requisition Details", label: "Remarks", type: "textarea", gridClassName: "md:col-span-2" },
    {
      name: "productId",
      label: "Product",
      type: "select",
      optionsEndpoint: PRODUCT_CATALOGUE_PRODUCTS,
      optionLabel: "productName",
      gridClassName: "hidden",
    },
  ],
  searchFields: ["requisitionNumber", "notes", "status", "userId"],
  initialFormState: {
    requiredByDate: "",
    userId: getLoggedInUserId() || "",
    notes: "",
    items: [],
  },
  normalizeForm: (row) => ({
    requiredByDate: dateOnly(row.requiredByDate ?? row.requiredDate ?? row.required_by_date),
    userId: row.userId ?? "",
    // Edit shows only the requester's remarks, not the "Rejected: …" part added by the backend.
    notes: splitNotes(row.notes || row.remarks, row).remarks,
    items: Array.isArray(row.items) ? row.items : [],
  }),
  validateForm: (form) => {
    const requiredByDate = String(form.requiredByDate || "");
    if (!requiredByDate) return "Select the required-by date.";
    if (requiredByDate < todayLocal()) return "Required-by date cannot be in the past.";
    if (toNumberOrZero(form.userId) <= 0) return "Enter a valid User ID.";

    const items = Array.isArray(form.items) ? (form.items as LineItem[]) : [];
    if (!items.length) return "Add at least one product.";
    if (items.some((item) => toNumberOrZero(item.productId) <= 0)) return "Select a product for every line.";
    if (items.some((item) => toNumberOrZero(item.quantity) <= 0)) return "Each line must have a quantity greater than zero.";

    const productIds = items.map((item) => String(item.productId));
    if (new Set(productIds).size !== productIds.length) {
      return "The same product is added more than once. Combine them into one line.";
    }
    return null;
  },
  renderFormExtras: ({ form, setForm, options }) => (
    <RequisitionItemsEditor form={form} setForm={setForm} options={options} />
  ),
  // Field names match the Purchase service (requiredByDate, userId, notes).
  // No status: it changes only through the workflow buttons (Submit/Approve/Reject/Cancel).
  buildPayload: (form, editingRow) => ({
    requiredByDate: form.requiredByDate,
    userId: toNumberOrZero(form.userId),
    notes: String(form.notes || "").trim() || null,
    items: (Array.isArray(form.items) ? form.items : [])
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => {
        const lineId = toNumberOrZero(item.id);
        return {
          ...(lineId > 0 ? { id: lineId, requisitionId: editingRow?.id } : {}),
          productId: toNumberOrZero(item.productId),
          productCode: item.productCode || "",
          productName: item.productName || "",
          quantity: toNumberOrZero(item.quantity),
          unitOfMeasure: item.unitOfMeasure || "PIECES",
          estimatedUnitCost: toNumberOrZero(item.estimatedUnitCost ?? item.unitPrice),
          remarks: String(item.remarks || "").trim(),
        };
      }),
  }),
  // Workflow buttons by status and permission (the server enforces both), plus Create PO once approved.
  renderRowActions: (row, { refreshRows }) => (
    <>
      <RequisitionWorkflowActions row={row} refreshRows={refreshRows} />
      {/* Create PO only for an APPROVED PR. */}
      {prStatus(row) === "APPROVED" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            document.dispatchEvent(
              new CustomEvent("purchase:convert-requisition", {
                detail: { requisitionId: row.id },
              })
            );
          }}
          title="Create Purchase Order"
          aria-label="Create Purchase Order"
          // Icon only, same look as the edit/delete icons; the tooltip says what it does.
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600 dark:text-gray-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400"
        >
          <ShoppingCartIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </>
  ),
};

// ─────────────────────────────────────────────────────────────
// REQUISITION LINE ITEMS
// ─────────────────────────────────────────────────────────────
export const requisitionLineItemConfig: PurchaseResourceConfig = {
  title: "Requisition Line Items",
  description: "Manage line items for purchase requisitions.",
  formSubtitle:"Add a product line to this requisition.",
  endpoint: `${PURCHASE}/requisition-line-items`,
  columns: [
    // { key: "id", label: "ID" },
    // { key: "requisition.id", label: "Requisition" },
    { key: "product.productName", label: "Product" },
    { key: "category.categoryName", label: "Category" },
    { key: "quantity", label: "Quantity" },
    { key: "unitOfMeasure", label: "UOM" },
  ],
  fields: [
    {
      name: "requisitionId",
      label: "Requisition",
      type: "select",
      required: true,
      optionsEndpoint: `${PURCHASE}/purchase-requisitions`,
      optionLabel: (row) => row.requisitionNumber || row.notes || "Requisition",
    },
    {
      name: "productId",
      label: "Product",
      type: "select",
      required: true,
      optionsEndpoint: `${PURCHASE}/products`,
      optionLabel: "productName",
    },
    {
      name: "categoryId",
      label: "Category",
      type: "select",
      optionsEndpoint: CATEGORIES,
      getOptionsParams: () => ({ tenantId: getSessionMeta().tenantId }),
      optionLabel: "categoryName",
    },
    { name: "quantity", label: "Quantity", type: "number", required: true, defaultValue: 1 },
    { name: "unitOfMeasure", label: "Unit Of Measure", required: true },
    { name: "remarks", label: "Remarks", type: "textarea", gridClassName: "md:col-span-2" },
  ],
  searchFields: ["id", "unitOfMeasure", "remarks"],
  normalizeForm: (row) => ({
    requisitionId: row.requisition?.id ?? "",
    productId: row.product?.id ?? "",
    categoryId: row.category?.id ?? "",
    quantity: row.quantity ?? 1,
    unitOfMeasure: row.unitOfMeasure || "",
    remarks: row.remarks || "",
  }),
  buildPayload: (form) => ({
    requisition: makeRelation(form.requisitionId),
    product: makeRelation(form.productId),
    category: makeRelation(form.categoryId),
    quantity: toNumberOrZero(form.quantity),
    unitOfMeasure: form.unitOfMeasure,
    remarks: form.remarks,
  }),
};

// ─────────────────────────────────────────────────────────────
// PURCHASE ORDERS  — with line items + auto-fill
// ─────────────────────────────────────────────────────────────
export const purchaseOrderConfig: PurchaseResourceConfig = {
  title: "Purchase Orders",
  description: "Create and update purchase orders with vendor, requisition, terms, and totals.",
  formSubtitle: "Create a purchase order for an approved vendor.",
  formPresentation: "drawer",
  allowCreate: false,
  endpoint: `${PURCHASE}/purchase-orders`,
  getByIdEndpoint: (row) => `${PURCHASE}/purchase-orders/${row.id}`,
  // Opened from a link (e.g. PO number in a GRN): show only that order.
  scope: { idParam: "purchaseOrderId", nameParam: "poNumber", label: "Purchase Order" },
  // Only a PO still waiting for approval can be edited or deleted (vendor, dates, items…).
  // Once approved it has gone to the vendor: cancel it and create a new PO instead.
  canEditRow: (row) => isPoEditable(row),
  canDeleteRow: (row) => isPoEditable(row),
  formExtrasSection: "Items & Pricing",
  // Clickable cards: approval first (what needs action), then delivery progress.
  statsCards: () => {
    const approval = (row: PurchaseRecord) => String(row.approvalStatus || "PENDING").toUpperCase();
    const status = (row: PurchaseRecord) => String(row.status || "").toUpperCase();
    return [
      { key: "ALL", label: "All Orders", match: () => true, tone: "cyan" },
      { key: "PENDING", label: "Pending Approval", match: (row) => approval(row) === "PENDING", tone: "blue" },
      { key: "APPROVED", label: "Approved", match: (row) => approval(row) === "APPROVED", tone: "green" },
      { key: "REJECTED", label: "Rejected", match: (row) => approval(row) === "REJECTED", tone: "red" },
      { key: "RECEIVED", label: "Received", match: (row) => status(row) === "RECEIVED", tone: "slate" },
    ];
  },
  // The PO API returns the vendor as a nested object (row.vendor.name), so the column reads from there.
  // Only one Vendor column (the name). The vendor code is still shown in the details drawer.
  columns: [
    { key: "poNumber", label: "PO Number" },
    {
      key: "vendorName",
      label: "Vendor",
      render: (row) => row.vendor?.name || row.vendorName || row.name || "--",
      // Click → Vendors page showing only this vendor.
      link: (row) =>
        recordLink(APP_ROUTES.vendors, "vendorId", row.vendor?.id ?? row.vendorId, "vendorName", row.vendor?.name || row.vendorName),
    },
    {
      key: "requisitionNumber",
      label: "PR Number",
      render: (row) => row.requisitionNumber || row.requisition?.requisitionNumber || "--",
      // Click → Purchase Requisitions page showing only this PR.
      link: (row) =>
        recordLink(
          APP_ROUTES.purchaseRequisitions,
          "requisitionId",
          row.requisitionId ?? row.requisition?.id,
          "requisitionNumber",
          row.requisitionNumber || row.requisition?.requisitionNumber
        ),
    },
    { key: "orderDate", label: "Order Date", render: (row) => dateOnly(row.orderDate) || "--" },
    { key: "expectedDeliveryDate", label: "Expected Delivery", render: (row) => dateOnly(row.expectedDeliveryDate) || "--" },
    {
      key: "totalAmount",
      label: "Total",
      render: (row) =>
        row.totalAmount == null
          ? "--"
          : Number(row.totalAmount).toLocaleString("en-IN", { style: "currency", currency: row.currency || "INR" }),
    },
    // Two different statuses: where the PO is in its life (DRAFT → RECEIVED) and its approval.
    { key: "status", label: "PO Status", render: (row) => statusBadge(row.status), exportValue: (row) => statusLabel(row.status) },
    { key: "approvalStatus", label: "Approval" },
  ],
  inlineSelectFields: [
    {
      name: "approvalStatus",
      options: ["PENDING", "APPROVED", "REJECTED"].map((value) => ({
        value,
        label: value.charAt(0) + value.slice(1).toLowerCase(),
      })),
      widthClassName: "w-[136px]",
      // Approval-status changes need PURCHASE:APPROVE
      permission: "APPROVE",
      onChange: async (row, status) => {
        await axios.put(`${PURCHASE}/approval-status/${row.id}/${status}`);
      },
    },
  ],
  fields: [
    {
      name: "vendorId", section: "Vendor & Delivery",
      label: "Vendor",
      type: "select",
      required: true,
      optionsEndpoint: "/v1/api/product/vendors",
      optionLabel: "name",
      searchable: true,
      // Only active vendors can get a new PO (the server refuses an inactive one with "Vendor is inactive").
      // The PO's current vendor stays in the list on edit, even if it was deactivated later.
      getOptions: ({ form, options }) =>
        (options.vendorId || []).filter(
          (option) => option.raw?.active !== false || String(option.value) === String(form.vendorId ?? "")
        ),
      onValueChange: (value, { options }) => {
        const vendor = options.vendorId?.find((option) => String(option.value) === String(value))?.raw;
        return { vendorCode: vendor?.vendorCode || "", name: vendor?.name || "" };
      },
    },
    {
      name: "purchaseRequisitionId", section: "Vendor & Delivery",
      label: "Purchase Requisition",
      type: "select",
      required: true,
      // One PO belongs to one PR. On edit the PR is shown as text and can't be changed;
      // the PO's items were copied from that PR.
      readOnlyOnEdit: true,
      // Read-only text: the PR number (falls back when the PR list doesn't include this PR).
      displayValue: (form) => form.requisitionNumber || null,
      // When creating, only APPROVED PRs can be picked (normally it is already filled from 🛒 Create PO).
      getOptions: ({ form, options }) =>
        (options.purchaseRequisitionId || []).filter(
          (option) =>
            String(option.raw?.status || "").toUpperCase() === "APPROVED" ||
            String(option.value) === String(form.purchaseRequisitionId ?? "")
        ),
      optionsEndpoint: `${PURCHASE}/purchase-requisitions`,
      optionLabel: (row) => row.requisitionNumber || row.notes || "Requisition",
      onValueChange: (value, { options }) => {
        const selected = options.purchaseRequisitionId?.find(
          (o) => String(o.value) === String(value)
        );
        if (!selected?.raw) return { items: [] };

        const requisitionItems: PurchaseRecord[] = Array.isArray(selected.raw.items)
          ? (selected.raw.items as PurchaseRecord[])
          : [];
        const items: LineItem[] = requisitionItems.map((item, index: number) => {
          const productId = item.productId ?? item.product?.id ?? "";
          const product = options.productId?.find(
            (option) => String(option.value) === String(productId)
          )?.raw;

          return {
            // New PO lines: no id, so they are not mistaken for existing PO line ids.
            id: `new-${index}`,
            productId,
            // The PR API returns productCode / productName at the top level of each item.
            productCode: item.productCode ?? product?.productCode ?? "",
            productName: item.productName ?? item.product?.productName ?? product?.productName ?? "",
            categoryId: item.category?.id ?? item.categoryId ?? product?.productCategory?.id ?? product?.category?.id ?? product?.categoryId ?? "",
            quantity: item.quantity ?? 1,
            // Requested quantity: the PO may order this much or less (checked on save).
            prQuantity: item.quantity ?? 1,
            // PR estimate if given, otherwise the product's standard cost; the buyer can change it.
            unitPrice: toNumberOrZero(item.estimatedUnitCost) || toNumberOrZero(product?.standardCost),
            unitOfMeasure: item.unitOfMeasure ?? product?.uom ?? "PIECES",
            remarks: item.remarks ?? "",
          };
        });

        return { items };
      },
    },
    {
      name: "orderDate", section: "Vendor & Delivery",
      label: "Order Date",
      type: "date",
      required: true,
      defaultValue: todayIso(),
    },
    { name: "expectedDeliveryDate", section: "Vendor & Delivery", label: "Expected Delivery Date", type: "date", required: true },
    { name: "currency", section: "Terms & Shipping", label: "Currency", type: "select", required: true, defaultValue: "INR", options: ["INR", "USD", "EUR", "GBP", "AED"].map((value) => ({ value, label: value })) },
    { name: "paymentTerms", section: "Terms & Shipping", label: "Payment Terms", type: "select", required: true, options: ["Due on Receipt", "Advance Payment", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"].map((value) => ({ value, label: value })) },
    { name: "shippingAddress", section: "Terms & Shipping", label: "Shipping Address", type: "textarea", required: true, gridClassName: "md:col-span-2" },
    { name: "notes", section: "Terms & Shipping", label: "Notes", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "productId", label: "Product", type: "select", optionsEndpoint: PRODUCT_CATALOGUE_PRODUCTS, optionLabel: "productName", gridClassName: "hidden" },
  ],
  searchFields: ["poNumber", "requisitionNumber", "approvalStatus", "status", "currency", "paymentTerms"],
  // A new PO starts empty (it is normally pre-filled from a requisition).
  initialFormState: {
    vendorId: "",
    vendorCode: "",
    name: "",
    purchaseRequisitionId: "",
    orderDate: todayLocal(),
    expectedDeliveryDate: "",
    currency: "INR",
    paymentTerms: "30 Days",
    shippingAddress: "",
    notes: "",
    items: [],
  },
  validateForm: (form) => {
    const orderDate = String(form.orderDate || "");
    const expectedDeliveryDate = String(form.expectedDeliveryDate || "");
    if (orderDate && expectedDeliveryDate && expectedDeliveryDate < orderDate) {
      return "Expected delivery date cannot be before the order date.";
    }

    const items = Array.isArray(form.items) ? form.items as LineItem[] : [];
    if (!items.length) return "Add at least one purchase-order line item.";
    if (items.some((item) => toNumberOrZero(item.productId) <= 0)) {
      return "Select a product for every purchase-order line item.";
    }
    if (items.some((item) => toNumberOrZero(item.quantity) <= 0)) {
      return "Each purchase-order line item must have a quantity greater than zero.";
    }
    // Lines created from a PR carry the PR quantity; a PO may not order more than was requested.
    const overOrdered = items.find((item) => {
      const prQuantity = toNumberOrZero((item as PurchaseRecord).prQuantity);
      return prQuantity > 0 && toNumberOrZero(item.quantity) > prQuantity;
    });
    if (overOrdered) {
      const prQuantity = toNumberOrZero((overOrdered as PurchaseRecord).prQuantity);
      return `${overOrdered.productName || "A product"}: quantity cannot be more than the requisition quantity (${prQuantity}).`;
    }
    if (items.some((item) => toNumberOrZero(item.unitPrice) <= 0)) {
      return "Enter a unit price greater than zero for every line.";
    }
    if (items.some((item) => toNumberOrZero(item.discountAmount) < 0 || toNumberOrZero(item.taxAmount) < 0)) {
      return "Discount and tax cannot be negative.";
    }
    if (
      items.some(
        (item) => toNumberOrZero(item.discountAmount) > toNumberOrZero(item.quantity) * toNumberOrZero(item.unitPrice)
      )
    ) {
      return "Discount cannot be more than the line amount.";
    }
    return null;
  },
  // The PO response nests the vendor and returns requisitionId (not purchaseRequisitionId).
  normalizeForm: (row) => ({
    vendorId: row.vendor?.id ?? row.vendorId ?? "",
    vendorCode: row.vendor?.vendorCode || row.vendorCode || "",
    name: row.vendor?.name || row.vendorName || row.name || "",
    // GET returns requisitionId; the save schema uses requisition: { id }.
    purchaseRequisitionId: row.requisitionId ?? row.requisition?.id ?? row.purchaseRequisitionId ?? "",
    requisitionNumber: row.requisitionNumber ?? row.requisition?.requisitionNumber ?? "",
    orderDate: dateOnly(row.orderDate),
    expectedDeliveryDate: dateOnly(row.expectedDeliveryDate),
    currency: row.currency || "INR",
    paymentTerms: row.paymentTerms || "",
    shippingAddress: row.shippingAddress || "",
    notes: row.notes || "",
    items: Array.isArray(row.items) ? row.items : [],
  }),
  renderFormExtras: ({ form, setForm, options }) => {
    const items: LineItem[] = Array.isArray(form.items) ? form.items : [];
    const productOptions = options.productId || [];

    return (
      <LineItemsEditor
        items={items}
        onChange={(next) => setForm((f) => ({ ...f, items: next }))}
        products={productOptions.map((p) => ({
          id: p.value,
          productName: p.label,
          uom: String(p.raw?.uom || "PIECES"),
          categoryId: p.raw?.productCategory?.id ?? p.raw?.category?.id ?? p.raw?.categoryId ?? "",
        }))}
        showUom={false}
        showPricing
        // Tax = (Qty × Unit price − Discount) × the product's GST % (from its tax code, e.g. GST18 → 18%).
        taxRateFor={(productId) =>
          taxRateFromCode(productOptions.find((p) => String(p.value) === String(productId))?.raw?.taxCode)
        }
      />
    );
  },
  /**
   * Request body follows the PO schema (POST and PUT):
   * vendor id/code/name, requisition: { id }, dates, terms, totals and items with
   * product code/name/UOM/line total. No warehouse: the goods' warehouse is chosen on the GRN.
   */
  buildPayload: (form, editingRow, { options }) => {
    const products = options.productId || [];
    const items = (Array.isArray(form.items) ? form.items : []).map((item: LineItem) => {
      const product = products.find((option) => String(option.value) === String(item.productId))?.raw;
      const quantity = toNumberOrZero(item.quantity);
      const unitPrice = toNumberOrZero(item.unitPrice);
      const discountAmount = toNumberOrZero(item.discountAmount);
      // Same rule as the form: GST % of the product on (qty × price − discount); typed value if no tax code.
      const rate = taxRateFromCode(product?.taxCode);
      const taxAmount =
        rate == null
          ? toNumberOrZero(item.taxAmount)
          : Math.round(Math.max(0, quantity * unitPrice - discountAmount) * rate) / 100;
      return {
        // Existing PO lines keep their id on edit so they are updated, not duplicated.
        ...(toNumberOrZero(item.id) > 0 ? { id: toNumberOrZero(item.id) } : {}),
        productId: toNumberOrZero(item.productId),
        productCode: String((item as PurchaseRecord).productCode || product?.productCode || ""),
        productName: String(item.productName || product?.productName || ""),
        unitOfMeasure: String(item.unitOfMeasure || product?.uom || "PIECES"),
        quantity,
        unitPrice,
        discountAmount,
        taxAmount,
        totalPrice: quantity * unitPrice - discountAmount + taxAmount,
        remarks: String(item.remarks || "").trim(),
      };
    });

    const sum = (pick: (item: (typeof items)[number]) => number) => items.reduce((total, item) => total + pick(item), 0);
    const subtotal = sum((item) => item.quantity * item.unitPrice);
    const discountAmount = sum((item) => item.discountAmount);
    const taxAmount = sum((item) => item.taxAmount);
    const requisitionId = toNumberOrZero(form.purchaseRequisitionId);

    return {
      // On edit, keep the values the server created.
      ...(editingRow ? { id: editingRow.id, poNumber: editingRow.poNumber } : {}),
      vendorId: toNumberOrZero(form.vendorId),
      vendorCode: String(form.vendorCode || "").trim(),
      vendorName: String(form.name || "").trim(),
      requisition: requisitionId > 0 ? { id: requisitionId } : null,
      orderDate: form.orderDate || "",
      expectedDeliveryDate: form.expectedDeliveryDate || "",
      currency: form.currency || "INR",
      paymentTerms: form.paymentTerms || "",
      shippingAddress: String(form.shippingAddress || "").trim(),
      notes: String(form.notes || "").trim(),
      // New PO starts as DRAFT / PENDING. Editing keeps its current status — an approved PO
      // must not go back to pending just because a note was changed.
      status: editingRow?.status || "DRAFT",
      approvalStatus: editingRow?.approvalStatus || "PENDING",
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount: subtotal - discountAmount + taxAmount,
      items,
    };
  },
  afterSubmit: async ({ savedRow, isCreate }) => {
    if (!isCreate || !savedRow.id) return;

    await axios.post(`${PURCHASE}/approval-status`, {
      purchaseOrderId: toNumberOrZero(savedRow.id),
      approvedBy: getLoggedInUserName(),
      status: "PENDING",
      approvalDate: currentLocalDateTime(),
    });
  },
};

// ─────────────────────────────────────────────────────────────
// GOODS RECEIPT NOTES
// ─────────────────────────────────────────────────────────────
export const goodsReceiptNoteConfig: PurchaseResourceConfig = {
  title: "Goods Receipt Notes",
  formMaxWidthClassName: "max-w-3xl",
  formPresentation: "drawer",
  description: "Record received goods against purchase orders.",
  endpoint: `${PURCHASE}/grns`,
  getByIdEndpoint: (row) => `${PURCHASE}/grns/${row.id}`,
  // Cards that mean something for receipts: all, clean receipts, and receipts with rejected goods.
  statsCards: () => {
    const rejectedQty = (row: PurchaseRecord) =>
      (Array.isArray(row.items) ? row.items : []).reduce(
        (total: number, item: PurchaseRecord) => total + toNumberOrZero(item.rejectedQuantity),
        0
      );
    return [
      { key: "ALL", label: "All Receipts", match: () => true, tone: "cyan" },
      { key: "CLEAN", label: "Fully Accepted", match: (row) => rejectedQty(row) === 0, tone: "green" },
      { key: "REJECTS", label: "With Rejections", match: (row) => rejectedQty(row) > 0, tone: "red" },
    ];
  },
  columns: [
    { key: "receiptNumber", label: "GRN Number" },
    {
      key: "poNumber",
      label: "PO Number",
      // Click → Purchase Orders page showing only this PO.
      link: (row) =>
        recordLink(APP_ROUTES.purchaseOrders, "purchaseOrderId", row.purchaseOrderId ?? row.purchaseOrder?.id, "poNumber", row.poNumber),
    },
    {
      key: "receiptDate",
      label: "Receipt Date",
      // 15 Oct 2026; sorting uses the real date.
      render: (row) => {
        const date = dateOnly(row.receiptDate);
        if (!date) return "--";
        const [year, month, day] = date.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
      },
      sortValueGetter: (row) => dateOnly(row.receiptDate),
    },
    { key: "items", label: "Items", render: (row) => String(row.items?.length ?? row.lineItems?.length ?? 0) },
    {
      key: "receivedQuantity",
      label: "Accepted / Received",
      render: (row) => {
        const items: PurchaseRecord[] = Array.isArray(row.items) ? row.items : [];
        const received = items.reduce((t, i) => t + toNumberOrZero(i.receivedQuantity), 0);
        const accepted = items.reduce((t, i) => t + toNumberOrZero(i.acceptedQuantity), 0);
        return `${accepted} / ${received}`;
      },
    },
  ],
  fields: [
    {
      name: "purchaseOrderId",
      label: "Purchase Order",
      type: "select",
      required: true,
      optionsEndpoint: `${PURCHASE}/purchase-orders`,
      optionLabel: "poNumber",
      showOnCreate: false,
      showOnEdit: false,
    },
    {
      name: "warehouseId",
      label: "Warehouse",
      type: "select",
      required: true,
      optionsEndpoint: "/v1/api/inventory/warehouses",
      optionLabel: "name",
      showOnCreate: false,
      showOnEdit: false,
    },
    {
      name: "receiptDate",
      label: "Receipt Date",
      type: "date",
      required: true,
      defaultValue: todayIso(),
      showOnCreate: false,
      showOnEdit: false,
    },
    { name: "items", label: "Items", defaultValue: [], showOnCreate: false, showOnEdit: false },
  ],
  searchFields: ["id", "poNumber", "receiptDate"],
  normalizeForm: (row) => ({
    purchaseOrderId: row.purchaseOrder?.id ?? row.purchaseOrderId ?? "",
    // Shown as text on edit (the PO may no longer be in the dropdown once fully received).
    poNumber: row.poNumber || row.purchaseOrder?.poNumber || "",
    warehouseId: row.warehouse?.id ?? row.warehouseId ?? "",
    receiptDate: dateOnly(row.receiptDate),
    items: row.items || row.lineItems || [],
  }),
  buildPayload: (form) => ({
    purchaseOrderId: toNumberOrZero(form.purchaseOrderId),
    warehouseId: toNumberOrZero(form.warehouseId),
    receiptDate: form.receiptDate || todayIso(),
    items: (Array.isArray(form.items) ? form.items : []).map((item) => ({
      purchaseOrderLineItemId: toNumberOrZero(item.purchaseOrderLineItemId),
      // Product details sent too, so the backend doesn't depend only on the PO line having them.
      productId: toNumberOrZero(item.productId) || null,
      productCode: item.productCode || null,
      productName: item.productName && item.productName !== "Product" ? item.productName : null,
      receivedQuantity: toNumberOrZero(item.receivedQuantity),
      acceptedQuantity: toNumberOrZero(item.acceptedQuantity),
      rejectedQuantity: toNumberOrZero(item.rejectedQuantity),
      // Only send what the product tracks (tracking unknown = send whatever was entered).
      batchNumber: item.tracking?.batch === false ? null : item.batchNumber || null,
      manufacturingDate: item.tracking?.batch === false ? null : item.manufacturingDate || null,
      expiryDate: item.tracking?.expiry === false ? null : item.expiryDate || null,
      // Empty boxes are left out.
      serialNumbers:
        item.tracking?.serial === false
          ? []
          : Array.isArray(item.serialNumbers)
            ? item.serialNumbers.map((serial: unknown) => String(serial ?? "").trim()).filter(Boolean)
            : [],
    })),
  }),
  renderCustomForm: ({ form, setForm, options, editingRow, onClose, onSubmit, submitting }) => {
    // Only approved POs that still have goods to receive. A fully received, closed or
    // cancelled PO has nothing pending, so the backend would reject the GRN.
    const approvedPurchaseOrders = (options.purchaseOrderId || []).filter((option) => {
      const approval = String(option.raw?.approvalStatus || "").toUpperCase();
      const status = String(option.raw?.status || "").toUpperCase();
      return approval === "APPROVED" && !["RECEIVED", "CLOSED", "CANCELLED"].includes(status);
    });

    return (
      <GoodsReceiptEditor
        form={form}
        purchaseOrders={approvedPurchaseOrders}
        warehouses={options.warehouseId || []}
        isEditing={Boolean(editingRow)}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onCancel={onClose}
        onSubmit={onSubmit}
        submitting={submitting}
      />
    );
  },
};

// ─────────────────────────────────────────────────────────────
// DELIVERIES
// ─────────────────────────────────────────────────────────────
export const deliveryConfig: PurchaseResourceConfig = {
  title: "Deliveries",
  description: "Manage purchase deliveries by vendor, order, and delivery date.",
  formSubtitle:"Track delivery of a purchase order.",
  endpoint: `${PURCHASE}/deliveries`,
  columns: [
    // { key: "id", label: "Delivery ID" },
    { key: "purchaseOrder.poNumber", label: "PO Number" },
    { key: "vendor.name", label: "Vendor" },
    { key: "deliveryDate", label: "Delivery Date" },
  ],
  fields: [
    {
      name: "purchaseOrderId",
      label: "Purchase Order",
      type: "select",
      optionsEndpoint: `${PURCHASE}/purchase-orders`,
      optionLabel: "poNumber",
    },
    {
      name: "vendorId",
      label: "Vendor",
      type: "select",
      required: true,
      optionsEndpoint: `${PURCHASE}/vendors`,
      optionLabel: "name",
    },
    {
      name: "deliveryDate",
      label: "Delivery Date",
      type: "date",
      required: true,
      defaultValue: todayIso(),
    },
  ],
  searchFields: ["id", "deliveryDate"],
  normalizeForm: (row) => ({
    purchaseOrderId: row.purchaseOrder?.id ?? "",
    vendorId: row.vendor?.id ?? "",
    deliveryDate: dateOnly(row.deliveryDate),
  }),
  buildPayload: (form) => ({
    purchaseOrder: makeRelation(form.purchaseOrderId),
    vendor: makeRelation(form.vendorId),
    deliveryDate: form.deliveryDate,
  }),
};

// ─────────────────────────────────────────────────────────────
// APPROVAL STATUS
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────────────────────────
export const inventoryConfig: PurchaseResourceConfig = {
  title: "Inventory",
  description: "View and create purchase inventory records.",
  formSubtitle: "Record stock quantity for a product.",
  endpoint: `${PURCHASE}/inventory`,
  allowEdit: false,
  allowDelete: false,
  getListParams: () => ({ param: "" }),
  columns: [
    { key: "productCode", label: "Product Code" },
    { key: "productName", label: "Product Name" },
    { key: "quantityOnHand", label: "On Hand" },
    { key: "reorderLevel", label: "Reorder Level" },
    { key: "warehouseLocation", label: "Warehouse" },
  ],
  fields: [
    {
      name: "productId",
      label: "Product",
      type: "select",
      required: true,
      optionsEndpoint: `${PURCHASE}/products`,
      optionLabel: "productName",
    },
    {
      name: "quantityOnHand",
      label: "Quantity On Hand",
      type: "number",
      required: true,
      defaultValue: 0,
    },
    { name: "reorderLevel", label: "Reorder Level", type: "number", defaultValue: 0 },
    { name: "warehouseLocation", label: "Warehouse Location", required: true },
  ],
  searchFields: ["productCode", "productName", "warehouseLocation"],
  buildPayload: (form) => ({
    productId: toNumberOrZero(form.productId),
    quantityOnHand: toNumberOrZero(form.quantityOnHand),
    reorderLevel: toNumberOrZero(form.reorderLevel),
    warehouseLocation: form.warehouseLocation,
  }),
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────
export const purchaseResourceConfigs = {
  vendors: vendorConfig,
  terms: termsConfig,
  productCategories: productCategoryConfig,
  products: productConfig,
  purchaseRequisitions: purchaseRequisitionConfig,
  requisitionLineItems: requisitionLineItemConfig,
  purchaseOrders: purchaseOrderConfig,
  goodsReceiptNotes: goodsReceiptNoteConfig,
  deliveries: deliveryConfig,
  inventory: inventoryConfig,
};

export { boolText, statusBadge };
