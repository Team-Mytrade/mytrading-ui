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
import LineItemsEditor, { LineItem } from "../Purchase/LineItemsEditor";
import GoodsReceiptEditor from "../purchase-service/GoodsReceiptEditor";

const PURCHASE = "/v1/api/purchase";
const CATEGORIES = "/v1/api/purchase/product-categories";
const PRODUCT_CATALOGUE_PRODUCTS = "/v1/api/product/products";

const boolText = (value: boolean) => (
  <span className={value ? "text-green-700" : "text-gray-500"}>{value ? "Yes" : "No"}</span>
);

const statusBadge = (value: string) => {
  const status = String(value || "--");
  const tone =
    status === "APPROVED" || status === "RECEIVED" || status === "ACTIVE" || status === "ISSUED"
      ? "bg-green-50 text-green-700"
      : status === "REJECTED" || status === "CANCELLED"
        ? "bg-red-50 text-red-700"
        : status === "DRAFT" || status === "PENDING" || status === "SUBMITTED"
          ? "bg-amber-50 text-amber-700"
          : status === "CLOSED"
            ? "bg-slate-100 text-slate-600"
            : "bg-gray-100 text-gray-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
};

const dateOnly = (value: unknown) => (value ? String(value).slice(0, 10) : "");
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

  return (
    <LineItemsEditor
      items={items}
      onChange={(next) => setForm((current) => ({ ...current, items: next }))}
      products={products.map((option) => ({
        id: option.value,
        productName: option.label,
        uom: String(option.raw?.uom || "PIECES"),
        categoryId: option.raw?.category?.id ?? option.raw?.categoryId ?? "",
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
export const purchaseRequisitionConfig: PurchaseResourceConfig = {
  title: "Purchase Requisitions",
  formSubtitle: "Create a requisition with the products and quantities required.",
  description: "Create purchase requisitions for products from the Product Catalogue service.",
  endpoint: `${PURCHASE}/purchase-requisitions`,
  getByIdEndpoint: (row) => `${PURCHASE}/purchase-requisitions/${row.id}`,
  columns: [
    { key: "remarks", label: "Remarks" },
    { key: "requestDate", label: "Request Date" },
    { key: "requiredDate", label: "Required Date" },
    { key: "userId", label: "Requested By" },
  ],
  fields: [
    {
      name: "requestDate",
      label: "Request Date",
      type: "date",
      required: true,
      defaultValue: new Date().toISOString().slice(0, 10),
    },
    {
      name: "requiredDate",
      label: "Required Date",
      type: "date",
      required: true,
      defaultValue: new Date().toISOString().slice(0, 10),
    },
    { name: "remarks", label: "Remarks", type: "textarea", required: true, gridClassName: "md:col-span-2" },
    { name: "userId", label: "User ID", type: "number", required: true, defaultValue: 1 },
    {
      name: "productId",
      label: "Product",
      type: "select",
      optionsEndpoint: PRODUCT_CATALOGUE_PRODUCTS,
      optionLabel: "productName",
      gridClassName: "hidden",
    },
  ],
  searchFields: ["id", "remarks", "status", "userId"],
  initialFormState: {
    requestDate: "2026-09-24",
    requiredDate: "2026-10-05",
    remarks: "Batch and serial tracking integration test",
    userId: 1,
    items: [],
  },
  normalizeForm: (row) => ({
    requestDate: dateOnly(row.requestDate),
    requiredDate: dateOnly(row.requiredDate || row.requiredByDate),
    remarks: row.remarks || row.notes || "",
    userId: row.userId ?? row.requester?.userId ?? "",
    items: Array.isArray(row.items) ? row.items : [],
  }),
  renderFormExtras: ({ form, setForm, options }) => (
    <RequisitionItemsEditor form={form} setForm={setForm} options={options} />
  ),
  buildPayload: (form) => ({
    requestDate: form.requestDate,
    requiredDate: form.requiredDate,
    remarks: String(form.remarks || "").trim(),
    userId: toNumberOrZero(form.userId),
    ...(form.status ? { status: form.status } : {}),
    items: (Array.isArray(form.items) ? form.items : [])
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item) => ({
        productId: toNumberOrZero(item.productId),
        // The current Purchase Service still reads item.product.id even though
        // its new request DTO also accepts productId.
        product: makeRelation(item.productId),
        quantity: toNumberOrZero(item.quantity),
      })),
  }),
  // Icon-only Create PO button with tooltip in the Actions column.
  renderRowActions: (row) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const event = new CustomEvent("purchase:convert-requisition", {
            detail: { requisitionId: row.id },
          });
          document.dispatchEvent(event);
        }}
        title="Create Purchase Order"
        aria-label="Create Purchase Order"
        className="group relative rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
      >
        <ShoppingCartIcon className="h-4 w-4" />
      </button>
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
      optionLabel: (row) => `#${row.id} ${row.notes || ""}`,
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
  columns: [
    { key: "vendorCode", label: "Vendor Code" },
    { key: "name", label: "Vendor" },
    { key: "orderDate", label: "Order Date" },
    { key: "expectedDeliveryDate", label: "Expected Delivery" },
    { key: "currency", label: "Currency" },
    { key: "paymentTerms", label: "Payment Terms" },
    { key: "approvalStatus", label: "Status" },
  ],
  inlineSelectFields: [
    {
      name: "approvalStatus",
      options: ["PENDING", "APPROVED", "REJECTED"].map((value) => ({
        value,
        label: value.charAt(0) + value.slice(1).toLowerCase(),
      })),
      widthClassName: "w-[136px]",
      onChange: async (row, status) => {
        await axios.put(`${PURCHASE}/approval-status/${row.id}/${status}`);
      },
    },
  ],
  fields: [
    {
      name: "vendorId",
      label: "Vendor",
      type: "select",
      required: true,
      optionsEndpoint: "/v1/api/product/vendors",
      optionLabel: "name",
      onValueChange: (value, { options }) => {
        const vendor = options.vendorId?.find((option) => String(option.value) === String(value))?.raw;
        return { vendorCode: vendor?.vendorCode || "", name: vendor?.name || "" };
      },
    },
    {
      name: "warehouseId",
      label: "Warehouse",
      type: "select",
      required: true,
      optionsEndpoint: "/v1/api/inventory/warehouses",
      optionLabel: "name",
    },
    {
      name: "purchaseRequisitionId",
      label: "Purchase Requisition",
      type: "select",
      required: true,
      optionsEndpoint: `${PURCHASE}/purchase-requisitions`,
      optionLabel: (row) => `#${row.id} ${row.notes || ""}`,
      onValueChange: (value, { options }) => {
        const selected = options.purchaseRequisitionId?.find(
          (o) => String(o.value) === String(value)
        );
        if (!selected?.raw) return { items: [] };

        const requisitionItems: PurchaseRecord[] = Array.isArray(selected.raw.items)
          ? (selected.raw.items as PurchaseRecord[])
          : [];
        const items: LineItem[] = requisitionItems.map((item, index: number) => {
          const productId = item.product?.id ?? item.productId ?? "";
          const product = options.productId?.find(
            (option) => String(option.value) === String(productId)
          )?.raw;

          return {
            id: item.id ?? `new-${index}`,
            productId,
            productName: item.product?.productName ?? "",
            categoryId: item.category?.id ?? item.categoryId ?? product?.category?.id ?? product?.categoryId ?? "",
            quantity: item.quantity ?? 1,
            unitOfMeasure: item.unitOfMeasure ?? "PIECES",
            remarks: item.remarks ?? "",
          };
        });

        return { items };
      },
    },
    {
      name: "orderDate",
      label: "Order Date",
      type: "date",
      required: true,
      defaultValue: new Date().toISOString().slice(0, 10),
    },
    { name: "expectedDeliveryDate", label: "Expected Delivery Date", type: "date", required: true },
    { name: "currency", label: "Currency", type: "select", required: true, defaultValue: "INR", options: ["INR", "USD", "EUR", "GBP", "AED"].map((value) => ({ value, label: value })) },
    { name: "paymentTerms", label: "Payment Terms", type: "select", required: true, options: ["Due on Receipt", "Advance Payment", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"].map((value) => ({ value, label: value })) },
    { name: "shippingAddress", label: "Shipping Address", type: "textarea", required: true, gridClassName: "md:col-span-2" },
    { name: "notes", label: "Notes", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "productId", label: "Product", type: "select", optionsEndpoint: PRODUCT_CATALOGUE_PRODUCTS, optionLabel: "productName", gridClassName: "hidden" },
  ],
  searchFields: ["vendorCode", "name", "currency", "paymentTerms"],
  initialFormState: {
    vendorId: 1,
    vendorCode: "VEN-001",
    name: "ABC Industrial Supplies",
    warehouseId: 1,
    purchaseRequisitionId: 1,
    orderDate: "2026-09-24",
    expectedDeliveryDate: "2026-10-05",
    currency: "INR",
    paymentTerms: "30 Days",
    shippingAddress: "MyTrade Warehouse, Visakhapatnam",
    notes: "Test purchase order",
    items: [
      { productId: 1, categoryId: 1, quantity: 10, unitPrice: 250, discountAmount: 30, taxAmount: 40, unitOfMeasure: "PIECES", remarks: "Test PO item" },
      { productId: 2, categoryId: 2, quantity: 3, unitPrice: 65000, discountAmount: 800, taxAmount: 550, unitOfMeasure: "PIECES", remarks: "Test PO item" },
      { productId: 3, categoryId: 3, quantity: 2, unitPrice: 25000, discountAmount: 1500, taxAmount: 1836, unitOfMeasure: "PIECES", remarks: "Test PO item" },
    ],
  },
  validateForm: (form) => {
    const items = Array.isArray(form.items) ? form.items as LineItem[] : [];
    if (!items.length) return "Add at least one purchase-order line item.";
    if (items.some((item) => toNumberOrZero(item.productId) <= 0)) {
      return "Select a product for every purchase-order line item.";
    }
    if (items.some((item) => toNumberOrZero(item.quantity) <= 0)) {
      return "Each purchase-order line item must have a quantity greater than zero.";
    }
    return null;
  },
  normalizeForm: (row) => ({
    vendorId: row.vendorId ?? row.vendor?.id ?? "",
    vendorCode: row.vendorCode || row.vendor?.vendorCode || "",
    name: row.name || row.vendor?.name || "",
    warehouseId: row.warehouseId ?? row.warehouse?.id ?? "",
    purchaseRequisitionId: row.purchaseRequisitionId ?? row.requisition?.id ?? "",
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
          categoryId: p.raw?.category?.id ?? p.raw?.categoryId ?? "",
        }))}
        showUom={false}
        showPricing
      />
    );
  },
  buildPayload: (form) => {
    const items = Array.isArray(form.items)
      ? form.items.map((item: LineItem) => ({
          productId: toNumberOrZero(item.productId),
          quantity: toNumberOrZero(item.quantity),
          unitPrice: toNumberOrZero(item.unitPrice),
          discountAmount: toNumberOrZero(item.discountAmount),
          taxAmount: toNumberOrZero(item.taxAmount),
          remarks: item.remarks || "",
        }))
      : [];

    const totalAmount = items.reduce(
      (total, item) => total + item.quantity * item.unitPrice - item.discountAmount + item.taxAmount,
      0
    );

    return {
      vendorId: toNumberOrZero(form.vendorId),
      vendorCode: String(form.vendorCode || "").trim(),
      name: String(form.name || "").trim(),
      warehouseId: toNumberOrZero(form.warehouseId),
      purchaseRequisitionId: toNumberOrZero(form.purchaseRequisitionId),
      orderDate: form.orderDate || "",
      expectedDeliveryDate: form.expectedDeliveryDate || "",
      currency: form.currency || "INR",
      paymentTerms: form.paymentTerms || "",
      shippingAddress: form.shippingAddress || "",
      notes: form.notes || "",
      // Purchase-order creation is submitted for approval; these are system-managed
      // defaults rather than fields a requester should be able to alter.
      approvalStatus: "PENDING",
      status: "DRAFT",
      totalAmount,
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
  columns: [
    // { key: "id", label: "GRN ID" },
    { key: "poNumber", label: "PO Number" },
    { key: "receiptDate", label: "Receipt Date" },
    { key: "items", label: "Items", render: (row) => String(row.items?.length ?? row.lineItems?.length ?? "--") },
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
      defaultValue: new Date().toISOString().slice(0, 10),
      showOnCreate: false,
      showOnEdit: false,
    },
    { name: "items", label: "Items", defaultValue: [], showOnCreate: false, showOnEdit: false },
  ],
  searchFields: ["id", "poNumber", "receiptDate"],
  normalizeForm: (row) => ({
    purchaseOrderId: row.purchaseOrder?.id ?? row.purchaseOrderId ?? "",
    warehouseId: row.warehouse?.id ?? row.warehouseId ?? "",
    receiptDate: dateOnly(row.receiptDate),
    items: row.items || row.lineItems || [],
  }),
  buildPayload: (form) => ({
    purchaseOrderId: toNumberOrZero(form.purchaseOrderId),
    warehouseId: toNumberOrZero(form.warehouseId),
    receiptDate: form.receiptDate || new Date().toISOString().slice(0, 10),
    items: (Array.isArray(form.items) ? form.items : []).map((item) => ({
      purchaseOrderLineItemId: toNumberOrZero(item.purchaseOrderLineItemId),
      receivedQuantity: toNumberOrZero(item.receivedQuantity),
      acceptedQuantity: toNumberOrZero(item.acceptedQuantity),
      rejectedQuantity: toNumberOrZero(item.rejectedQuantity),
      batchNumber: item.batchNumber || null,
      manufacturingDate: item.manufacturingDate || null,
      expiryDate: item.expiryDate || null,
      serialNumbers: Array.isArray(item.serialNumbers) ? item.serialNumbers : [],
    })),
  }),
  renderCustomForm: ({ form, setForm, options, editingRow, onClose, onSubmit, submitting }) => {
    const approvedPurchaseOrders = (options.purchaseOrderId || []).filter(
      (option) => String(option.raw?.approvalStatus || "").toUpperCase() === "APPROVED"
    );

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
      defaultValue: new Date().toISOString().slice(0, 10),
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
