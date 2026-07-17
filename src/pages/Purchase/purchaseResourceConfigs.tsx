import React from "react";
import {
  makeRelation,
  PurchaseRecord,
  PurchaseResourceConfig,
  toNumberOrNull,
  toNumberOrZero,
} from "./PurchaseResourcePage";

const PURCHASE = "/v1/api/purchase";
const CATEGORIES = "/v1/api/purchase/product-categories";
const USER_DEPARTMENTS = "/v1/api/user/departments";
const USERS = "/v1/api/user/getAll";

const boolText = (value: boolean) => (
  <span className={value ? "text-green-700" : "text-gray-500"}>{value ? "Yes" : "No"}</span>
);

const statusBadge = (value: string) => {
  const status = String(value || "--");
  const tone =
    status === "APPROVED" || status === "RECEIVED" || status === "ACTIVE"
      ? "bg-green-50 text-green-700"
      : status === "REJECTED" || status === "CANCELLED"
        ? "bg-red-50 text-red-700"
        : status === "DRAFT" || status === "PENDING"
          ? "bg-amber-50 text-amber-700"
          : "bg-gray-100 text-gray-700";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
};

const dateOnly = (value: any) => (value ? String(value).slice(0, 10) : "");
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
const toUserActiveStatus = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value === true) return "ACTIVE";
  if (value === false) return "INACTIVE";
  return "ACTIVE";
};
const toRequesterRole = (value: unknown) => {
  const role = String(value || "").toUpperCase();
  if (role === "ADMIN" || role === "USER") return role;
  if (role.includes("ADMIN")) return "ADMIN";
  return "USER";
};
const emptyUserDetails = {
  phoneNumber: "",
  country: "",
  city: "",
  address: "",
  postalCode: "",
  designation: "",
  aboutMe: "",
  imageName: "",
  imageType: "",
};

const withAudit = (form: PurchaseRecord, editingRow: PurchaseRecord | null) => ({
  ...(editingRow || {}),
  ...form,
});

export const vendorConfig: PurchaseResourceConfig = {
  title: "Vendors",
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
  buildPayload: (form, editingRow) => {
    const now = new Date().toISOString();
    const session = getSessionMeta();

    return {
      id: Number(editingRow?.id ?? 0),
      createdDate: editingRow?.createdDate || now,
      updatedDate: now,
      createdBy: editingRow?.createdBy || session.userId,
      tenantId: editingRow?.tenantId || session.tenantId,
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
    };
  },
};

export const termsConfig: PurchaseResourceConfig = {
  title: "Terms and Conditions",
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
    { name: "content", label: "Content", type: "textarea", required: true, gridClassName: "md:col-span-2" },
  ],
  searchFields: ["title", "content"],
  buildPayload: withAudit,
};

export const productCategoryConfig: PurchaseResourceConfig = {
  title: "Product Categories",
  description: "Manage product categories used by purchase products and requisition line items.",
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
    { name: "parentId", label: "Parent Category", type: "select", optionsEndpoint: CATEGORIES, optionLabel: "categoryName" },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["categoryCode", "categoryName", "shortCode", "parentName"],
  buildPayload: (form, editingRow) => {
    const payload: Record<string, unknown> = {
      ...(editingRow?.id ? { id: editingRow.id } : {}),
      categoryCode: form.categoryCode,
      categoryName: form.categoryName,
      shortCode: form.shortCode,
      description: form.description,
      active: Boolean(form.active),
    };

    const parentId = toNumberOrZero(form.parentId);
    if (parentId > 0) {
      payload.parentId = parentId;
    }

    return payload;
  },
};

export const productConfig: PurchaseResourceConfig = {
  title: "Products",
  description: "Maintain purchase products from the purchase product controller.",
  endpoint: `${PURCHASE}/products`,
  columns: [
    { key: "productCode", label: "Code" },
    { key: "productName", label: "Product Name" },
    { key: "categoryName", label: "Category" },
    { key: "brand", label: "Brand" },
    { key: "uom", label: "UOM" },
    { key: "standardCost", label: "Standard Cost" },
    { key: "sellingPrice", label: "Selling Price" },
    { key: "stockItem", label: "Stock Item" },
    { key: "serviceItem", label: "Service Item" },
    { key: "active", label: "Status" },
  ],
  fields: [
    { name: "productName", label: "Product Name", required: true },
    { name: "shortName", label: "Short Name" },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "categoryId", label: "Category", type: "select", required: true, optionsEndpoint: CATEGORIES, optionLabel: "categoryName" },
    { name: "brand", label: "Brand" },
    { name: "modelNo", label: "Model No" },
    { name: "barcode", label: "Barcode" },
    { name: "uom", label: "UOM", type: "select", defaultValue: "PIECES", options: ["PIECES", "KG", "LITER", "METER", "BOX", "PACK"].map((item) => ({ value: item, label: item })) },
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

export const purchaseRequisitionConfig: PurchaseResourceConfig = {
  title: "Purchase Requisitions",
  description: "Create requisitions and track department, requester, status, and required-by dates.",
  endpoint: `${PURCHASE}/purchase-requisitions`,
  getByIdEndpoint: (row) => `${PURCHASE}/purchase-requisitions/${row.id}`,
  columns: [
    { key: "id", label: "ID" },
    { key: "notes", label: "Notes" },
    { key: "requiredByDate", label: "Required By" },
    { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
    { key: "departmentId", label: "Department" },
    {
      key: "requester",
      label: "Requester",
      render: (row) => row.requester?.fullName || row.requester?.username || row.requester?.userId || "--",
    },
  ],
  fields: [
    { name: "notes", label: "Notes", type: "textarea", required: true, gridClassName: "md:col-span-2" },
    { name: "requiredByDate", label: "Required By Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
    { name: "status", label: "Status", type: "select", defaultValue: "DRAFT", options: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"].map((item) => ({ value: item, label: item })) },
    {
      name: "departmentId",
      label: "Department",
      type: "select",
      required: true,
      optionsEndpoint: USER_DEPARTMENTS,
        optionLabel: (row) => [row.name, row.departmentCode ? `(${row.departmentCode})` : ""].filter(Boolean).join(" "),
    },
    {
      name: "requesterId",
      label: "Requester",
      type: "select",
      required: true,
      optionsEndpoint: USERS,
      optionLabel: (row) => row.username || row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.userId,
      optionValue: "userId",
    },
  ],
  searchFields: ["id", "notes", "status", "departmentId", "requester.username", "requester.fullName", "requester.userId"],
  normalizeForm: (row) => ({
    notes: row.notes || "",
    requiredByDate: dateOnly(row.requiredByDate),
    status: row.status || "DRAFT",
    departmentId: row.departmentId ?? "",
    requesterId: row.requester?.userId || row.requesterId || "",
  }),
  buildPayload: (form, editingRow, context) => {
    const now = new Date().toISOString();
    const session = getSessionMeta();
    const requesterOption = context.options.requesterId?.find(
      (option) => String(option.value) === String(form.requesterId)
    );
    const requester = requesterOption?.raw || editingRow?.requester || null;

    return {
      id: Number(editingRow?.id ?? 0),
      createdDate: editingRow?.createdDate || now,
      updatedDate: now,
      createdBy: editingRow?.createdBy || session.userId,
      tenantId: editingRow?.tenantId || session.tenantId,
      notes: form.notes,
      requiredByDate: form.requiredByDate,
      status: form.status || "DRAFT",
      departmentId: toNumberOrZero(form.departmentId),
      requester: requester
        ? {
            userId: requester.userId || "",
            email: requester.email || "",
            role: toRequesterRole(requester.role),
            active: toUserActiveStatus(requester.active),
            fullName:
              requester.fullName ||
              requester.username ||
              [requester.firstName, requester.lastName].filter(Boolean).join(" ").trim(),
            userDetails: {
              ...emptyUserDetails,
              ...(requester.userDetails || {}),
            },
              requisitions: requester.requisitions || [],
              createdDate: requester.createdDate || new Date().toISOString(),
              updatedDate: requester.updatedDate || new Date().toISOString(),
              createdBy: requester.createdBy || requester.userId || "system",
              tenantId: requester.tenantId || session.tenantId,
            }
          : {
              userId: "",
              email: "",
              role: "USER",
              active: "ACTIVE",
              fullName: "",
              userDetails: { ...emptyUserDetails },
              requisitions: [],
              createdDate: now,
              updatedDate: now,
              createdBy: session.userId,
              tenantId: session.tenantId,
            },
    };
  },
};

export const requisitionLineItemConfig: PurchaseResourceConfig = {
  title: "Requisition Line Items",
  description: "Manage line items for purchase requisitions.",
  endpoint: `${PURCHASE}/requisition-line-items`,
  columns: [
    { key: "id", label: "ID" },
    { key: "requisition.id", label: "Requisition" },
    { key: "product.productName", label: "Product" },
    { key: "category.categoryName", label: "Category" },
    { key: "quantity", label: "Quantity" },
    { key: "unitOfMeasure", label: "UOM" },
  ],
  fields: [
    { name: "requisitionId", label: "Requisition", type: "select", required: true, optionsEndpoint: `${PURCHASE}/purchase-requisitions`, optionLabel: (row) => `#${row.id} ${row.notes || ""}` },
    { name: "productId", label: "Product", type: "select", required: true, optionsEndpoint: `${PURCHASE}/products`, optionLabel: "productName" },
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
  buildPayload: (form, editingRow) => ({
    ...(editingRow || {}),
    requisition: makeRelation(form.requisitionId),
    product: makeRelation(form.productId),
    category: makeRelation(form.categoryId),
    quantity: toNumberOrZero(form.quantity),
    unitOfMeasure: form.unitOfMeasure,
    remarks: form.remarks,
  }),
};

export const purchaseOrderConfig: PurchaseResourceConfig = {
  title: "Purchase Orders",
  description: "Create and update purchase orders with vendor, requisition, terms, and totals.",
  endpoint: `${PURCHASE}/purchase-orders`,
  getByIdEndpoint: (row) => `${PURCHASE}/purchase-orders/${row.id}`,
  inlineSelectFields: [
    {
      name: "status",
      options: ["DRAFT", "ISSUED", "CANCELLED", "CLOSED"].map((item) => ({
        value: item,
        label: item.charAt(0) + item.slice(1).toLowerCase(),
      })),
      widthClassName: "w-[136px]",
    },
    {
      name: "approvalStatus",
      options: ["PENDING", "APPROVED", "REJECTED"].map((item) => ({
        value: item,
        label: item.charAt(0) + item.slice(1).toLowerCase(),
      })),
      widthClassName: "w-[136px]",
    },
  ],
  columns: [
    { key: "poNumber", label: "PO Number" },
    { key: "vendor.name", label: "Vendor" },
    { key: "orderDate", label: "Order Date" },
    { key: "expectedDeliveryDate", label: "Expected Delivery" },
    { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
    { key: "approvalStatus", label: "Approval", render: (row) => statusBadge(row.approvalStatus) },
    { key: "totalAmount", label: "Total" },
  ],
  fields: [
    { name: "poNumber", label: "PO Number", required: true },
    { name: "vendorId", label: "Vendor", type: "select", required: true, optionsEndpoint: `${PURCHASE}/vendors`, optionLabel: "name" },
    { name: "requisitionId", label: "Requisition", type: "select", optionsEndpoint: `${PURCHASE}/purchase-requisitions`, optionLabel: (row) => `#${row.id} ${row.notes || ""}` },
    { name: "termsAndConditionsId", label: "Terms and Conditions", type: "select", optionsEndpoint: `${PURCHASE}/terms`, optionLabel: "title" },
    { name: "orderDate", label: "Order Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
    { name: "expectedDeliveryDate", label: "Expected Delivery Date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", defaultValue: "DRAFT", options: ["DRAFT", "ISSUED", "CANCELLED", "CLOSED"].map((item) => ({ value: item, label: item })) },
    { name: "approvalStatus", label: "Approval Status", type: "select", defaultValue: "PENDING", options: ["PENDING", "APPROVED", "REJECTED"].map((item) => ({ value: item, label: item })) },
    { name: "totalAmount", label: "Total Amount", type: "number", defaultValue: 0 },
  ],
  searchFields: ["poNumber", "status", "approvalStatus"],
  normalizeForm: (row) => ({
    poNumber: row.poNumber || "",
    vendorId: row.vendor?.id ?? "",
    requisitionId: row.requisition?.id ?? "",
    termsAndConditionsId: row.termsAndConditions?.id ?? "",
    orderDate: dateOnly(row.orderDate),
    expectedDeliveryDate: dateOnly(row.expectedDeliveryDate),
    status: row.status || "DRAFT",
    approvalStatus: row.approvalStatus || "PENDING",
    totalAmount: row.totalAmount ?? 0,
  }),
  buildPayload: (form, editingRow, context) => {
    const now = new Date().toISOString();
    const session = getSessionMeta();
    const vendorOption = context.options.vendorId?.find(
      (option) => String(option.value) === String(form.vendorId)
    );
    const requisitionOption = context.options.requisitionId?.find(
      (option) => String(option.value) === String(form.requisitionId)
    );
    const termsOption = context.options.termsAndConditionsId?.find(
      (option) => String(option.value) === String(form.termsAndConditionsId)
    );

    const vendor = vendorOption?.raw || editingRow?.vendor || null;
    const requisition = requisitionOption?.raw || editingRow?.requisition || null;
    const terms = termsOption?.raw || editingRow?.termsAndConditions || null;

    return {
      id: Number(editingRow?.id ?? 0),
      createdDate: editingRow?.createdDate || now,
      updatedDate: now,
      createdBy: editingRow?.createdBy || session.userId,
      tenantId: editingRow?.tenantId || session.tenantId,
      poNumber: form.poNumber || "",
      orderDate: form.orderDate || "",
      expectedDeliveryDate: form.expectedDeliveryDate || "",
      status: form.status || "DRAFT",
      approvalStatus: form.approvalStatus || "PENDING",
      totalAmount: toNumberOrZero(form.totalAmount),
      vendor: vendor
        ? {
            id: Number(vendor.id ?? 0),
            createdDate: vendor.createdDate || now,
            updatedDate: vendor.updatedDate || now,
            createdBy: vendor.createdBy || session.userId,
            tenantId: vendor.tenantId || session.tenantId,
            name: vendor.name || "",
            contactName: vendor.contactName || "",
            contactEmail: vendor.contactEmail || "",
            contactPhone: vendor.contactPhone || "",
            address: vendor.address || "",
            city: vendor.city || "",
            state: vendor.state || "",
            postalCode: vendor.postalCode || "",
            country: vendor.country || "",
            active: Boolean(vendor.active),
          }
        : {
            id: 0,
            createdDate: now,
            updatedDate: now,
            createdBy: session.userId,
            tenantId: session.tenantId,
            name: "",
            contactName: "",
            contactEmail: "",
            contactPhone: "",
            address: "",
            city: "",
            state: "",
            postalCode: "",
            country: "",
            active: true,
          },
      requisition: requisition
        ? {
            id: Number(requisition.id ?? 0),
            createdDate: requisition.createdDate || now,
            updatedDate: requisition.updatedDate || now,
            createdBy: requisition.createdBy || session.userId,
            tenantId: requisition.tenantId || session.tenantId,
            notes: requisition.notes || "",
            requiredByDate: requisition.requiredByDate || "",
            status: requisition.status || "DRAFT",
            departmentId: Number(requisition.departmentId ?? 0),
            requester: requisition.requester || null,
          }
        : null,
      items: Array.isArray(editingRow?.items) ? editingRow.items : [],
      termsAndConditions: terms
        ? {
            id: Number(terms.id ?? 0),
            createdDate: terms.createdDate || now,
            updatedDate: terms.updatedDate || now,
            createdBy: terms.createdBy || session.userId,
            tenantId: terms.tenantId || session.tenantId,
            title: terms.title || "",
            content: terms.content || "",
            active: Boolean(terms.active),
          }
        : null,
      approvals: Array.isArray(editingRow?.approvals) ? editingRow.approvals : [],
      goodsReceiptNotes: Array.isArray(editingRow?.goodsReceiptNotes) ? editingRow.goodsReceiptNotes : [],
      deliveries: Array.isArray(editingRow?.deliveries) ? editingRow.deliveries : [],
    };
  },
};

export const goodsReceiptNoteConfig: PurchaseResourceConfig = {
  title: "Goods Receipt Notes",
  description: "Record received goods against purchase orders.",
  endpoint: `${PURCHASE}/grns`,
  getByIdEndpoint: (row) => `${PURCHASE}/grns/${row.id}`,
  columns: [
    { key: "id", label: "GRN ID" },
    { key: "poNumber", label: "PO Number" },
    { key: "receiptDate", label: "Receipt Date" },
    { key: "receivedQuantity", label: "Received Quantity" },
    { key: "remarks", label: "Remarks" },
  ],
  fields: [
    { name: "purchaseOrderId", label: "Purchase Order", type: "select", required: true, optionsEndpoint: `${PURCHASE}/purchase-orders`, optionLabel: "poNumber" },
    { name: "receiptDate", label: "Receipt Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
    { name: "receivedQuantity", label: "Received Quantity", type: "number", required: true, defaultValue: 0 },
    { name: "remarks", label: "Remarks", type: "textarea", gridClassName: "md:col-span-2" },
  ],
  searchFields: ["id", "poNumber", "receiptDate", "receivedQuantity", "remarks"],
  normalizeForm: (row) => ({
    purchaseOrderId: row.purchaseOrder?.id ?? row.purchaseOrderId ?? "",
    receiptDate: dateOnly(row.receiptDate),
    receivedQuantity: row.receivedQuantity ?? 0,
    remarks: row.remarks || "",
  }),
  buildPayload: (form) => {
    return {
      purchaseOrderId: toNumberOrZero(form.purchaseOrderId),
      receiptDate: form.receiptDate,
      receivedQuantity: toNumberOrZero(form.receivedQuantity),
      remarks: form.remarks || "",
    };
  },
};

export const deliveryConfig: PurchaseResourceConfig = {
  title: "Deliveries",
  description: "Manage purchase deliveries by vendor, order, and delivery date.",
  endpoint: `${PURCHASE}/deliveries`,
  columns: [
    { key: "id", label: "Delivery ID" },
    { key: "purchaseOrder.poNumber", label: "PO Number" },
    { key: "vendor.name", label: "Vendor" },
    { key: "deliveryDate", label: "Delivery Date" },
  ],
  fields: [
    { name: "purchaseOrderId", label: "Purchase Order", type: "select", optionsEndpoint: `${PURCHASE}/purchase-orders`, optionLabel: "poNumber" },
    { name: "vendorId", label: "Vendor", type: "select", required: true, optionsEndpoint: `${PURCHASE}/vendors`, optionLabel: "name" },
    { name: "deliveryDate", label: "Delivery Date", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
  ],
  searchFields: ["id", "deliveryDate"],
  normalizeForm: (row) => ({
    purchaseOrderId: row.purchaseOrder?.id ?? "",
    vendorId: row.vendor?.id ?? "",
    deliveryDate: dateOnly(row.deliveryDate),
  }),
  buildPayload: (form, editingRow, context) => {
    const vendorOption = context.options.vendorId?.find(
      (option) => String(option.value) === String(form.vendorId)
    );
    const now = new Date().toISOString();
    const session = getSessionMeta();

    if (editingRow?.id) {
      return {
        id: Number(editingRow.id),
        createdDate: editingRow.createdDate || now,
        updatedDate: now,
        createdBy: editingRow.createdBy || session.userId,
        tenantId: editingRow.tenantId || session.tenantId,
        deliveryDate: form.deliveryDate,
        vendor: vendorOption?.raw || editingRow?.vendor || makeRelation(form.vendorId),
      };
    }

    return {
      purchaseOrder: makeRelation(form.purchaseOrderId),
      vendor: vendorOption?.raw || editingRow?.vendor || makeRelation(form.vendorId),
      deliveryDate: form.deliveryDate,
    };
  },
};

export const approvalStatusConfig: PurchaseResourceConfig = {
  title: "Approval Status",
  description: "Create and update approval status entries for purchase orders.",
  endpoint: `${PURCHASE}/approval-status`,
  updateEndpoint: (_row, form) => `${PURCHASE}/approval-status/${form.purchaseOrderId}/${form.status}`,
  allowDelete: false,
  inlineSelectFields: [
    {
      name: "status",
      options: ["PENDING", "APPROVED", "REJECTED"].map((item) => ({
        value: item,
        label: item.charAt(0) + item.slice(1).toLowerCase(),
      })),
      widthClassName: "w-[136px]",
    },
  ],
  columns: [
    { key: "poNumber", label: "PO Number" },
    { key: "purchaseOrderId", label: "Purchase Order ID" },
    { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
    { key: "approvedBy", label: "Approved By" },
    { key: "approvalDate", label: "Approval Date" },
  ],
  fields: [
    { name: "purchaseOrderId", label: "Purchase Order", type: "select", required: true, optionsEndpoint: `${PURCHASE}/purchase-orders`, optionLabel: "poNumber" },
    { name: "approvedBy", label: "Approved By", required: true },
    { name: "status", label: "Status", type: "select", defaultValue: "PENDING", options: ["PENDING", "APPROVED", "REJECTED"].map((item) => ({ value: item, label: item })) },
    { name: "approvalDate", label: "Approval Date", type: "datetime-local", defaultValue: new Date().toISOString().slice(0, 16) },
  ],
  searchFields: ["poNumber", "purchaseOrderId", "status", "approvedBy"],
  normalizeForm: (row) => ({
    purchaseOrderId: row.purchaseOrderId ?? "",
    approvedBy: row.approvedBy || "",
    status: row.status || "PENDING",
    approvalDate: row.approvalDate ? String(row.approvalDate).slice(0, 16) : "",
  }),
  buildPayload: (form) => ({
    purchaseOrderId: toNumberOrZero(form.purchaseOrderId),
    approvedBy: form.approvedBy,
    status: form.status || "PENDING",
    approvalDate: form.approvalDate,
  }),
};

export const inventoryConfig: PurchaseResourceConfig = {
  title: "Inventory",
  description: "View and create purchase inventory records.",
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
    { name: "productId", label: "Product", type: "select", required: true, optionsEndpoint: `${PURCHASE}/products`, optionLabel: "productName" },
    { name: "quantityOnHand", label: "Quantity On Hand", type: "number", required: true, defaultValue: 0 },
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
  approvalStatus: approvalStatusConfig,
  inventory: inventoryConfig,
};

export { boolText, statusBadge };
