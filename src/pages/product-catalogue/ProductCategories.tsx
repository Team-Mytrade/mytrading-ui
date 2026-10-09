import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";

const CATEGORIES = "/v1/api/product/product-categories";

/** Trimmed string, or null when empty (so the API stores NULL instead of ""). */
const text = (value: unknown): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * Code in one clean format: upper-case, spaces and hyphens become underscores,
 * repeated underscores collapse to one, none at the start or end.
 * Hyphens are not allowed because the product code uses "-" as its separator
 * (CATEGORY-SHORTCODE-0001).
 * e.g. "med  test" -> "MED_TEST", "cat--01" -> "CAT_01", " phr " -> "PHR"
 */
const code = (value: unknown): string | null => {
  const cleaned = text(value)
    ?.toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned ? cleaned : null;
};

/** Positive integer id, or null (top-level category). */
const toId = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Product categories (owned by the Product Catalogue service). */
const productCategoryConfig: PurchaseResourceConfig = {
  title: "Product Categories",
  formSubtitle: "Add or update a product category.",
  description: "Manage product categories from the Product Catalogue service.",
  endpoint: CATEGORIES,
  allowInlineActiveToggle: true,
  getByIdEndpoint: (row) => `${CATEGORIES}/${row.id}`,

  columns: [
    { key: "categoryCode", label: "Category Code" },
    { key: "categoryName", label: "Category Name" },
    { key: "shortCode", label: "Short Code" },
    { key: "parentName", label: "Parent" },
    { key: "active", label: "Status" },
  ],

  fields: [
    { name: "categoryCode", label: "Category Code", required: true },
    { name: "categoryName", label: "Category Name", required: true },
    { name: "shortCode", label: "Short Code (used in product codes)", required: true },
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

  searchFields: ["categoryCode", "categoryName", "shortCode", "parentName", "description"],

  // A new category starts empty.
  initialFormState: {
    categoryCode: "",
    categoryName: "",
    shortCode: "",
    description: "",
    parentId: "",
    active: true,
  },

  normalizeForm: (row) => ({ ...row, parentId: row.parentId ?? "" }),

  // Only business fields are sent. parentName is looked up by the server from parentId.
  buildPayload: (form, editingRow) => {
    const parentId = toId(form.parentId);

    return {
      // Category code and short code are part of every generated product code
      // (e.g. PHARMA-PHR-0001), so they keep their original values once created.
      categoryCode: editingRow ? editingRow.categoryCode : code(form.categoryCode),
      shortCode: editingRow ? editingRow.shortCode : code(form.shortCode),
      categoryName: text(form.categoryName),
      description: text(form.description),
      // A category cannot be its own parent.
      parentId: editingRow && parentId === Number(editingRow.id) ? null : parentId,
      active: Boolean(form.active),
    };
  },
};

export default function ProductCategories() {
  const navigate = useNavigate();

  const config = useMemo<PurchaseResourceConfig>(
    () => ({
      ...productCategoryConfig,
      renderRowActions: (row) => {
        // New products should only go into active categories.
        if (!row.active) return null;

        const categoryName = String(row.categoryName || "this category");

        return (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                categoryId: String(row.id),
                categoryName,
              });
              navigate(`/product-catalogue/products?${params.toString()}`);
            }}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
            title={`Add product to ${categoryName}`}
            aria-label={`Add product to ${categoryName}`}
          >
            <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      },
    }),
    [navigate]
  );

  return <PurchaseResourcePage config={config} />;
}