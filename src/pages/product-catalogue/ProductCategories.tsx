import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CheckCircleIcon, NoSymbolIcon, PlusCircleIcon } from "@heroicons/react/24/outline";
import PurchaseResourcePage, {
  PurchaseRecord,
  PurchaseResourceConfig,
  SelectOption,
} from "../Purchase/PurchaseResourcePage";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";

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

/* ------------------------------------------------------------------ */
/* Field checks — shown under each field while typing                   */
/* ------------------------------------------------------------------ */

/** Category code: letters/numbers/underscore, 2–20 characters (checked after cleaning). */
const validateCategoryCode = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null; // "required" message comes from required: true
  const cleaned = code(raw) ?? "";
  if (!/^[A-Z0-9_]+$/.test(cleaned)) return "Use only letters, numbers and spaces (e.g. PHARMA, MED_DEVICES)";
  if (cleaned.length < 2) return "Category code must be at least 2 characters";
  if (cleaned.length > 20) return "Category code can be at most 20 characters";
  return null;
};

/** Short code goes into every product code (PHARMA-PHR-0001), so keep it short: 2–6 letters/numbers. */
const validateShortCode = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  const cleaned = code(raw) ?? "";
  if (!/^[A-Z0-9]+$/.test(cleaned)) return "Short code: letters and numbers only, no spaces (e.g. PHR)";
  if (cleaned.length < 2 || cleaned.length > 6) return "Short code must be 2–6 characters (e.g. PHR)";
  return null;
};

const validateCategoryName = (value: unknown): string | null => {
  const name = text(value);
  if (!name) return null;
  if (name.length < 2) return "Category name is too short";
  if (!/[A-Za-z]/.test(name)) return "Category name must contain letters";
  return null;
};

/**
 * Parent options for the category being edited:
 *  - only active categories (new children should not go under an inactive parent),
 *  - not the category itself, and not any of its own sub-categories
 *    (that would make a loop: A → B → A).
 * The current parent is always kept, so an existing record still shows its value.
 */
const parentOptionsFor = (form: PurchaseRecord, all: SelectOption[]): SelectOption[] => {
  const selfId = form.id != null ? String(form.id) : null;
  const currentParent = String(form.parentId ?? "");

  // Collect the ids of every category below this one.
  const blocked = new Set<string>();
  if (selfId) {
    blocked.add(selfId);
    let added = true;
    while (added) {
      added = false;
      for (const option of all) {
        const parentId = String(option.raw?.parentId ?? "");
        if (blocked.has(parentId) && !blocked.has(String(option.value))) {
          blocked.add(String(option.value));
          added = true;
        }
      }
    }
  }

  return all.filter((option) => {
    const id = String(option.value);
    if (id === currentParent) return true;
    if (blocked.has(id)) return false;
    return option.raw?.active !== false;
  });
};

/** Product categories (owned by the Product Catalogue service). */
const productCategoryConfig: PurchaseResourceConfig = {
  title: "Product Categories",
  formSubtitle: "Add or update a product category.",
  description: "Manage product categories from the Product Catalogue service.",
  endpoint: CATEGORIES,
  // Activate / deactivate use their own PATCH APIs (row action below),
  // not a full PUT of the record, so the backend can apply its rules.
  allowInlineActiveToggle: false,
  getByIdEndpoint: (row) => `${CATEGORIES}/${row.id}`,
  // Delete is only for a category created by mistake (no products, no sub-categories).
  // A category in use is refused by the backend; the user is told to deactivate it instead.
  deleteInUseMessage:
    "This category has products or sub-categories, so it cannot be deleted. Use Deactivate (⛔) to stop new products being added to it.",

  columns: [
    { key: "categoryCode", label: "Category Code" },
    { key: "categoryName", label: "Category Name" },
    { key: "shortCode", label: "Short Code" },
    { key: "parentName", label: "Parent" },
    {
      key: "active",
      label: "Status",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            row.active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {row.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ],

  // One named tab, so the form is not split into "Step 1 / Step 2".
  fields: [
    {
      name: "categoryCode", section: "Category Details",
      label: "Category Code (e.g. PHARMA)",
      required: true,
      // Part of every product code, so it cannot change after creation.
      readOnlyOnEdit: true,
      validate: validateCategoryCode,
    },
    {
      name: "categoryName", section: "Category Details",
      label: "Category Name",
      required: true,
      validate: validateCategoryName,
    },
    {
      name: "shortCode", section: "Category Details",
      label: "Short Code (used in product codes, e.g. PHR)",
      required: true,
      readOnlyOnEdit: true,
      validate: validateShortCode,
    },
    {
      name: "parentId", section: "Category Details",
      label: "Parent Category",
      type: "select",
      searchable: true, // type a few letters to find the parent
      placeholder: "Type to search parent category",
      placeholderOption: "None (this is a main category)",
      optionsEndpoint: CATEGORIES,
      optionLabel: "categoryName",
      getOptions: ({ form, options }) => parentOptionsFor(form, options.parentId || []),
    },
    { name: "description", section: "Category Details", label: "Description", type: "textarea", gridClassName: "md:col-span-2" },
    // Only on create. Existing categories are activated/deactivated with the row buttons.
    { name: "active", section: "Category Details", label: "Active", type: "checkbox", defaultValue: true, showOnEdit: false },
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

  // Backend returns parentId 0 for a main category (should be null); treat 0 as "no parent".
  normalizeForm: (row) => ({ ...row, parentId: toId(row.parentId) ?? "" }),

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
      // Edit keeps the current status; status changes go through PATCH activate/deactivate.
      active: editingRow ? Boolean(editingRow.active) : Boolean(form.active),
    };
  },
};

export default function ProductCategories() {
  const navigate = useNavigate();
  const { canCreate, canUpdate } = usePermissions();
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  /** Calls PATCH /{id}/activate or /{id}/deactivate, then reloads the list. */
  const changeStatus = async (row: PurchaseRecord, activate: boolean) => {
    const name = String(row.categoryName || "this category");
    if (!activate && !window.confirm(`Deactivate ${name}? New products cannot be added to it.`)) return;

    try {
      setBusyId(row.id ?? null);
      await axios.patch(`${CATEGORIES}/${row.id}/${activate ? "activate" : "deactivate"}`);
      ToasterService.success(`${name} ${activate ? "activated" : "deactivated"}`);
      setReloadKey((current) => current + 1);
    } catch (error: any) {
      ToasterService.error(
        error?.response?.data?.message || error?.response?.data?.error || `Could not change the status of ${name}`
      );
    } finally {
      setBusyId(null);
    }
  };

  const config = useMemo<PurchaseResourceConfig>(
    () => ({
      ...productCategoryConfig,
      renderRowActions: (row) => {
        const categoryName = String(row.categoryName || "this category");
        const isBusy = busyId === row.id;

        return (
          <>
            {!canUpdate ? null : row.active ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  changeStatus(row, false);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                title={`Deactivate ${categoryName}`}
                aria-label={`Deactivate ${categoryName}`}
              >
                <NoSymbolIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  changeStatus(row, true);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                title={`Activate ${categoryName}`}
                aria-label={`Activate ${categoryName}`}
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {/* New products can only go into active categories. */}
            {row.active && canCreate && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const params = new URLSearchParams({ categoryId: String(row.id), categoryName });
                  navigate(`/product-catalogue/products?${params.toString()}`);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                title={`Add product to ${categoryName}`}
                aria-label={`Add product to ${categoryName}`}
              >
                <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </>
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, busyId, canCreate, canUpdate]
  );

  // Changing the key reloads the list (and the parent dropdown) after a status change.
  return <PurchaseResourcePage key={reloadKey} config={config} />;
}
