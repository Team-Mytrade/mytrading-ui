import PurchaseResourcePage, {
  PurchaseResourceConfig,
} from "../Purchase/PurchaseResourcePage";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  return (
    <PurchaseResourcePage
      config={{
        ...productCategoryConfig,
        renderRowActions: (row) => (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                categoryId: String(row.id),
                categoryName: String(row.categoryName || "Selected category"),
              });
              navigate(`/product-catalogue/products?${params.toString()}`);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
            title={`Add product to ${row.categoryName || "this category"}`}
            aria-label={`Add product to ${row.categoryName || "this category"}`}
          >
            <PlusCircleIcon className="h-4 w-4" />
          </button>
        ),
      }}
    />
  );
}
