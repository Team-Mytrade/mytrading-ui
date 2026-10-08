import PurchaseResourcePage, {
  PurchaseResourceConfig,
} from "../Purchase/PurchaseResourcePage";

const CATEGORIES = "/v1/api/product/product-categories";

const productCategoryConfig: PurchaseResourceConfig = {
  title: "Product Categories",
  description: "Manage product categories from the Product Catalogue service.",
  endpoint: CATEGORIES,
  allowInlineActiveToggle: true,
  getByIdEndpoint: (row) => `${CATEGORIES}/${row.id}`,
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
      name: "parentId",
      label: "Parent Category",
      type: "select",
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
      placeholderOption: "No Parent Category",
    },
    { name: "description", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    { name: "active", label: "Active", type: "checkbox", defaultValue: true },
  ],
  searchFields: ["categoryCode", "categoryName", "shortCode", "parentName"],
  initialFormState: {
    categoryCode: "PHARMA",
    categoryName: "General Medicine",
    shortCode: "PHR",
    description: "General Medicine Products",
    parentId: "",
    active: true,
  },
  normalizeForm: (row) => ({ ...row, parentId: row.parentId ?? "" }),
  buildPayload: (form, editingRow) => {
    return {
      // The Product Category API accepts this exact request body.
      categoryCode: form.categoryCode || editingRow?.categoryCode || "",
      categoryName: form.categoryName,
      shortCode: form.shortCode,
      description: form.description,
      parentId: form.parentId === "" || form.parentId == null ? null : Number(form.parentId),
      active: Boolean(form.active),
    };
  },
};

export default function ProductCategories() {
  return <PurchaseResourcePage config={productCategoryConfig} />;
}
