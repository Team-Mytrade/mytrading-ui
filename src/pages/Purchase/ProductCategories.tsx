import PurchaseResourcePage, {
  PurchaseResourceConfig,
  SelectOption,
  toNumberOrZero,
} from "./PurchaseResourcePage";

const CATEGORIES = "/v1/api/purchase/product-categories";

const getStoredTenantId = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.tenantId || "";
  } catch {
    return "";
  }
};

const getParentCategoryOptions = (categoryOptions: SelectOption[]) =>
  categoryOptions.filter((option) => !option.raw?.parentId);

const getChildCategoryOptions = (categoryOptions: SelectOption[], parentCategoryId: string | number) =>
  categoryOptions.filter((option) => String(option.raw?.parentId ?? "") === String(parentCategoryId));

const productCategoryConfig: PurchaseResourceConfig = {
  title: "Product Categories",
  description: "Manage product categories used by purchase products and requisition line items.",
  endpoint: CATEGORIES,
  allowInlineActiveToggle: true,
  getByIdEndpoint: (row) => `${CATEGORIES}/${row.id}`,
  getRequestParams: () => {
    const tenantId = getStoredTenantId();
    const params: Record<string, string | number | boolean> = {};
    if (tenantId) {
      params.tenantId = tenantId;
    }
    return params;
  },
  columns: [
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
      name: "parentCategoryId",
      label: "Parent Category",
      type: "select",
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
      placeholderOption: "Select Parent Category",
      getOptions: ({ options }) => getParentCategoryOptions(options.parentCategoryId || []),
      onValueChange: () => ({ parentId: "" }),
    },
    {
      name: "parentId",
      label: "Category",
      type: "select",
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
      placeholderOption: "Select Category",
      getOptions: ({ form, options }) =>
        form.parentCategoryId ? getChildCategoryOptions(options.parentId || [], form.parentCategoryId) : [],
    },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["categoryCode", "categoryName", "shortCode", "parentName"],
  normalizeForm: (row) => ({
    ...row,
    parentCategoryId: row.parentId ?? "",
    parentId: "",
  }),
  buildPayload: (form, editingRow) => {
    const payload: Record<string, unknown> = {
      ...(editingRow?.id ? { id: editingRow.id } : {}),
      categoryCode: form.categoryCode,
      categoryName: form.categoryName,
      shortCode: form.shortCode,
      description: form.description,
      active: Boolean(form.active),
    };

    const parentId = toNumberOrZero(form.parentId || form.parentCategoryId);
    if (parentId > 0) {
      payload.parentId = parentId;
    }

    return payload;
  },
};

export default function ProductCategories() {
  return <PurchaseResourcePage config={productCategoryConfig} />;
}
