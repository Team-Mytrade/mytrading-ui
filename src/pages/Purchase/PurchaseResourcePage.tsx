import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, {
  ColumnDef,
  formatBooleanFor,
  formatDisplayText,
  formatMoney,
  isMoneyLikeKey,
} from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import FilterPopover from "../../components/common/filter";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, {
  defaultStatsCards,
  StatsCardOption,
  useStatsCardFilter,
} from "../../components/common/StatsCardFilter";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1,
  FloatingTextarea,
  Option as FloatingOption,
} from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { ToasterService } from "../../Services/ToasterService";

export type PurchaseRecord = Record<string, any> & { id?: number | string };

export type SelectOption = {
  value: string | number;
  label: string;
  raw?: PurchaseRecord;
  /** Extra words that also find this option in a searchable select (e.g. "TN" for Tamil Nadu). */
  keywords?: string[];
};

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "datetime-local"
  | "textarea"
  | "select"
  | "checkbox"
  | "toggle";

export type FieldConfig = {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: SelectOption[];
  optionsEndpoint?: string;
  getOptionsParams?: () => Record<string, string | number | boolean>;
  optionLabel?: string | ((row: PurchaseRecord) => string);
  optionValue?: string | ((row: PurchaseRecord) => string | number);
  gridClassName?: string;
  controlWidth?: string;
  /** Controls whether a field is shown for a new record or an existing record. */
  showOnCreate?: boolean;
  showOnEdit?: boolean;
  /** Shows the value as receipt/reference information instead of an input while editing. */
  readOnlyOnEdit?: boolean;
  /** Text shown when the field is read-only (e.g. the PR number when only its id is known). */
  displayValue?: (form: PurchaseRecord) => string | null | undefined;
  placeholderOption?: string;
  /** For long select lists: type a few letters and only matching options are shown. */
  searchable?: boolean;
  /** Changes letters while typing: "upper" (codes, GST, PAN), "title" (Names Like This) or "lower" (emails). */
  textCase?: "upper" | "lower" | "title";
  /** Number fields: lowest allowed value. Default 0, so negatives are blocked. */
  min?: number;
  /** Number fields: highest allowed value. */
  max?: number;
  /** Number fields: digits allowed after the decimal point (0 = whole numbers only). */
  decimals?: number;
  /** Number fields: allow negative values (off by default). */
  allowNegative?: boolean;
  /** Text fields: maximum number of characters. */
  maxLength?: number;
  /** Tab / section this field belongs to (e.g. "Bank Details"). Fields with a section are shown in named tabs. */
  section?: string;
  /** Field-level check; return an error message to show under the field, or null when valid. */
  validate?: (value: any, form: PurchaseRecord) => string | null;
  toggleOnValue?: string;
  toggleOffValue?: string;
  toggleOptions?: SelectOption[];
  getOptions?: (context: {
    form: PurchaseRecord;
    options: Record<string, SelectOption[]>;
  }) => SelectOption[];
  onValueChange?: (
    value: any,
    context: {
      form: PurchaseRecord;
      options: Record<string, SelectOption[]>;
    }
  ) => PurchaseRecord | void;
};

/** A clickable summary card (see StatsCardFilter). */
export type StatsCardConfig = StatsCardOption<PurchaseRecord>;

export type ResourceColumn = {
  key: string;
  label: string;
  /** How this column is shown in the row-details drawer. Defaults to the same output as `render`. */
  detailFormatter?: (row: PurchaseRecord) => React.ReactNode;
  /** Plain text for Export (PDF / Excel) when the cell shows a badge or other element. */
  exportValue?: (row: PurchaseRecord) => string | number | null | undefined;
  /** Value used for sorting (e.g. the real date behind "22 Oct 2026"). */
  sortValueGetter?: (row: PurchaseRecord) => string | number | null | undefined;
  /** Fixed values for the column filter row (a dropdown instead of a text box). */
  filterOptions?: { label: string; value: string }[];
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (row: PurchaseRecord) => React.ReactNode;
  link?: (row: PurchaseRecord) => { to: string; title: string } | null;
};

export type PurchaseResourceConfig = {
  title: string;
  description: string;
  endpoint: string;
   formSubtitle?: string
  getByIdEndpoint?: (row: PurchaseRecord) => string;
  /**
   * Custom loader for the full record (used by Edit and the inline status dropdown).
   * Use it when GET-by-id does not return every field. Overrides getByIdEndpoint.
   */
  loadRecord?: (row: PurchaseRecord) => Promise<PurchaseRecord>;
  createEndpoint?: string;
  updateEndpoint?: (row: PurchaseRecord, form: PurchaseRecord) => string;
  deleteEndpoint?: (row: PurchaseRecord) => string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  /**
   * Clickable summary cards above the table. Clicking a card shows only its rows.
   * Default: All, Active and Inactive (when records have an `active` flag).
   */
  statsCards?: (rows: PurchaseRecord[]) => StatsCardConfig[];
  /** Raw fields to leave out of the row-details drawer (ids are always hidden). */
  hiddenDetailKeys?: string[];
  /** Per-row check: return false to hide the Edit button for that row (e.g. a submitted PR). */
  canEditRow?: (row: PurchaseRecord) => boolean;
  /** Per-row check: return false to hide the Delete button for that row. */
  canDeleteRow?: (row: PurchaseRecord) => boolean;
  columns: ResourceColumn[];
  fields: FieldConfig[];
  searchFields?: string[];
  pageSize?: number;
  renderSearchExtras?: () => React.ReactNode;

  renderHeaderActions?: () => React.ReactNode;
  getListParams?: () => Record<string, string | number | boolean>;
  getRequestParams?: () => Record<string, string | number | boolean>;
  allowInlineActiveToggle?: boolean;
  inlineBooleanFields?: string[];
  inlineSelectFields?: Array<{
    name: string;
    options: SelectOption[];
    widthClassName?: string;
    defaultValue?: string;
    /** Handles field changes that use an endpoint other than the resource update URL. */
    onChange?: (row: PurchaseRecord, nextValue: string) => Promise<void> | void;
  }>;
  buildPayload?: (
    form: PurchaseRecord,
    editingRow: PurchaseRecord | null,
    context: { options: Record<string, SelectOption[]> }
  ) => PurchaseRecord | FormData;
  /** Return a message when the form is not safe to submit to the API. */
  validateForm?: (
    form: PurchaseRecord,
    editingRow: PurchaseRecord | null,
    context: { options: Record<string, SelectOption[]> }
  ) => string | null;
  /** Field-level errors ({ fieldName: message }), shown under each field and on its tab. */
  validateFields?: (
    form: PurchaseRecord,
    editingRow: PurchaseRecord | null,
    context: { options: Record<string, SelectOption[]> }
  ) => Record<string, string>;
  /** Friendly message when delete is refused because the record is still used elsewhere. */
  deleteInUseMessage?: string;
  /** Tab name for renderFormExtras content (e.g. line items) when the form uses sections. Default "Items". */
  formExtrasSection?: string;
  normalizeForm?: (row: PurchaseRecord) => PurchaseRecord;

  initialFormState?: PurchaseRecord;
  /** Values to merge into the form when an external flow opens a new record. */
  initialCreateState?: PurchaseRecord;
  autoOpenCreate?: boolean;
  /** Unique navigation key that prevents an external create flow from reopening after the form closes. */
  autoOpenCreateKey?: string;
  formPresentation?: "modal" | "drawer";
  /** Use an in-page editor for new records instead of a modal. */
  createPresentation?: "modal" | "inline";
  /** Use an in-page editor for existing records instead of a modal. */
  editPresentation?: "modal" | "inline";
  drawerReadOnlyByDefault?: boolean;
  drawerHeaderDateField?: string;
  drawerHeaderTextField?: string;
  drawerCompact?: boolean;
  scope?: { idParam: string; nameParam: string; label: string };

  /** Icon-only or extra action buttons rendered inside the Actions cell */
  renderRowActions?: (
    row: PurchaseRecord,
    context: { refreshRows: () => Promise<void> }
  ) => React.ReactNode;

  renderFormExtras?: (context: {
    form: PurchaseRecord;
    setForm: React.Dispatch<React.SetStateAction<PurchaseRecord>>;
    editingRow: PurchaseRecord | null;
    refreshRows: () => Promise<void>;
    options: Record<string, SelectOption[]>;
  }) => React.ReactNode;
  renderFormSidePanel?: (context: {
    form: PurchaseRecord;
    setForm: React.Dispatch<React.SetStateAction<PurchaseRecord>>;
    editingRow: PurchaseRecord | null;
    refreshRows: () => Promise<void>;
    options: Record<string, SelectOption[]>;
  }) => React.ReactNode;
  renderInlineEdit?: (context: {
    form: PurchaseRecord;
    setForm: React.Dispatch<React.SetStateAction<PurchaseRecord>>;
    editingRow: PurchaseRecord | null;
    refreshRows: () => Promise<void>;
    options: Record<string, SelectOption[]>;
    onClose: () => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    submitting: boolean;
  }) => React.ReactNode;
  renderCustomForm?: (context: {
    form: PurchaseRecord;
    setForm: React.Dispatch<React.SetStateAction<PurchaseRecord>>;
    editingRow: PurchaseRecord | null;
    options: Record<string, SelectOption[]>;
    onClose: () => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    submitting: boolean;
  }) => React.ReactNode;
  formMaxWidthClassName?: string;

  afterSubmit?: (context: {
    form: PurchaseRecord;
    editingRow: PurchaseRecord | null;
    savedRow: PurchaseRecord;
    isCreate: boolean;
    refreshRows: () => Promise<void>;
  }) => Promise<void> | void;
};
const HIDDEN_KEYS = new Set(["id", "purchaseOrderId", "grnId", "deliveryId", "vendorId", "requisitionId", "tenantId"]);

const asArray = (value: any): PurchaseRecord[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};


const getValue = (row: PurchaseRecord, path: string): any => {
  return path.split(".").reduce((acc, key) => acc?.[key], row);
};

const formatDateTimeForInput = (value: any) => {
  if (!value) return "";
  const text = String(value);
  return text.length >= 16 ? text.slice(0, 16) : text;
};

function defaultForField(field: FieldConfig) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "checkbox") return true;
  if (field.type === "number") return "";
  return "";
}

function mergeFormUpdate(
  name: string,
  value: any,
  current: PurchaseRecord,
  field: FieldConfig,
  options: Record<string, SelectOption[]>
) {
  const next = { ...current, [name]: value };
  const extra = field.onValueChange?.(value, { form: next, options });
  return extra ? { ...next, ...extra } : next;
}

function optionText(row: PurchaseRecord, label?: FieldConfig["optionLabel"]) {
  if (typeof label === "function") return label(row);
  if (label) return String(getValue(row, label) ?? "");
  return String(row.name ?? row.title ?? row.productName ?? row.poNumber ?? row.id ?? "");
}

function optionValue(row: PurchaseRecord, value?: FieldConfig["optionValue"]) {
  if (typeof value === "function") return value(row);
  if (value) return getValue(row, value);
  return row.id ?? "";
}

function formatCellValue(value: any) {
  if (value == null || value === "") return "--";
  if (typeof value === "boolean") return value ? "Active" : "Inactive";
  if (typeof value === "object") {
    return (
      value.username ||
      value.name ||
      value.title ||
      value.productName ||
      value.categoryName ||
      value.poNumber ||
      value.fullName ||
      value.userId ||
      value.id ||
      "--"
    );
  }
  return String(value);
}

/**
 * Delete error in plain words. When the record is still used (foreign key / 409),
 * the raw database text is never shown to the user.
 */
function deleteErrorMessage(error: any, config: PurchaseResourceConfig): string {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const raw = String(data?.message || data?.error || data?.detail || "");
  const inUse =
    status === 409 || /foreign key|constraint|referenced|violates|still in use|in use/i.test(raw);
  if (inUse) {
    return (
      config.deleteInUseMessage ||
      "This record is used by other records, so it cannot be deleted. Deactivate it instead."
    );
  }
  // Short, readable backend messages are fine to show; long SQL/stack text is not.
  if (raw && raw.length <= 160 && !/sql|exception|jdbc|hibernate/i.test(raw)) return raw;
  return `Failed to delete ${config.title}`;
}

function searchableText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value).toLowerCase();
  return String(value).toLowerCase().trim();
}

function getInlineSelectTone(value: unknown) {
  const normalized = String(value || "").toLowerCase();

  if (["active", "approved", "issued", "received"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-300";
  }

  if (["inactive", "rejected", "cancelled", "block"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-red-600 focus:border-rose-300";
  }

  if (["draft", "pending", "submitted"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700 focus:border-amber-300";
  }

  if (normalized === "closed") {
    return "border-slate-200 bg-slate-100 text-slate-600 focus:border-slate-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 focus:border-cyan-300";
}

const StatusPill = ({ active }: { active: boolean }) => (
  <span
    className={[
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
      active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600",
    ].join(" ")}
  >
    {active ? "Active" : "Inactive"}
  </span>
);

/** True when a dropdown loads from the same API (without extra params) as the page's table. */
function usesOwnList(field: FieldConfig, listEndpoint: string) {
  return Boolean(field.optionsEndpoint) && field.optionsEndpoint === listEndpoint && !field.getOptionsParams;
}

/** Applies a field's textCase while the user types. */
function applyTextCase(value: string, textCase: FieldConfig["textCase"]) {
  if (textCase === "upper") return value.toUpperCase();
  if (textCase === "lower") return value.toLowerCase();
  if (textCase === "title") return value.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
  return value;
}

/** Plain label without hints in brackets, e.g. "Standard Cost (₹)" → "Standard Cost". */
const plainLabel = (label: string) => label.replace(/\s*\(.*\)\s*$/, "");

/** Built-in checks for number fields: valid number, not negative, min / max, decimals. */
function numberFieldError(field: FieldConfig, value: unknown): string | null {
  if (value === "" || value == null) return null;
  const text = String(value).trim();
  const number = Number(text);
  const label = plainLabel(field.label);
  if (!Number.isFinite(number)) return `${label} must be a number`;
  const min = field.allowNegative ? field.min : field.min ?? 0;
  if (min !== undefined && number < min) {
    return min === 0 ? `${label} cannot be negative` : `${label} must be at least ${min}`;
  }
  if (field.max !== undefined && number > field.max) return `${label} can be at most ${field.max}`;
  if (field.decimals !== undefined) {
    const [, fraction = ""] = text.split(".");
    if (fraction.length > field.decimals) {
      return field.decimals === 0
        ? `${label} must be a whole number`
        : `${label} can have at most ${field.decimals} decimal places`;
    }
  }
  return null;
}

/**
 * Read-only field that looks like a disabled input: same height, border and floating label,
 * same white box as other inputs. An empty value shows nothing.
 */
/** App base path from vite.config ("/myTrading/"), so link hrefs work for "Open in new tab". */
const APP_BASE = String((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || "/").replace(/\/$/, "");

const ReadOnlyField = ({ label, value }: { label: string; value: React.ReactNode }) => {
  // Empty stays empty (no "Not set"), so it fills in by itself once the backend sends the value.
  const isEmpty = value == null || value === "" || value === "--";
  return (
    <div style={{ position: "relative", marginBottom: "20px", width: "100%" }}>
      <div
        className="flex h-[52px] cursor-default items-center rounded-md border border-gray-300 bg-white px-3 pt-3 text-base text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        aria-readonly="true"
      >
        <span className="truncate">{isEmpty ? "" : value}</span>
      </div>
      <span className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
        {label}
      </span>
    </div>
  );
};

/**
 * Text area that starts as one line (same height as an input) and grows as the text gets
 * longer, so short notes don't take up a big empty box.
 */
const AutoGrowTextarea = (props: React.ComponentProps<typeof FloatingTextarea>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resize = () => {
    const textarea = wrapperRef.current?.querySelector("textarea");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(52, textarea.scrollHeight + 2)}px`;
  };
  // Also resizes when the value is filled in from outside (edit form, prefill).
  useLayoutEffect(resize, [props.value]);
  return (
    <div ref={wrapperRef} onInput={resize}>
      <FloatingTextarea {...props} rows={1} />
    </div>
  );
};

export const makeRelation = (id: any) => (id ? { id: Number(id) } : null);

export const toNumberOrNull = (value: any) =>
  value === "" || value == null ? null : Number(value);

export const toNumberOrZero = (value: any) =>
  value === "" || value == null ? 0 : Number(value);

export const PurchaseResourcePage: React.FC<{ config: PurchaseResourceConfig }> = ({ config }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const scopeId = Number(config.scope ? searchParams.get(config.scope.idParam) : "") || null;
  const scopeName = config.scope ? searchParams.get(config.scope.nameParam) || `Selected ${config.scope.label.toLowerCase()}` : "";
  const isScoped = Boolean(config.scope && searchParams.has(config.scope.idParam));
  const [rows, setRows] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<PurchaseRecord | null>(null);
  const [form, setForm] = useState<PurchaseRecord>({});
  const [fetchedOptions, setOptions] = useState<Record<string, SelectOption[]>>({});
  const [deleteRow, setDeleteRow] = useState<PurchaseRecord | null>(null);
  const [isDrawerEditing, setIsDrawerEditing] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineUpdatingId, setInlineUpdatingId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");
  const autoOpenedKey = useRef<string | null>(null);
  // Form validation state: which fields were visited, whether Save was clicked, and the active tab.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const resetValidation = () => {
    setTouched({});
    setSubmitAttempted(false);
    setActiveStep(0);
  };

  const updateRowLocally = useCallback(
    (rowId: string | number, updater: (row: PurchaseRecord) => PurchaseRecord) => {
      setRows((current) =>
        current.map((item) => {
          if (String(item.id) !== String(rowId)) return item;
          return updater(item);
        })
      );
    },
    []
  );

  const emptyForm = useMemo(() => {
    return config.fields.reduce<PurchaseRecord>((acc, field) => {
      acc[field.name] = defaultForField(field);
      return acc;
    }, {});
  }, [config.fields]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setApiFailed(false);
    try {
      const res = await axios.get(config.endpoint, {
        params: {
          ...(config.getRequestParams?.() || {}),
          ...(config.getListParams?.() || {}),
        },
      });
      setRows(asArray(res.data));
    } catch (error: any) {
      console.error(`Failed to load ${config.title}`, error);
      ToasterService.error(`Failed to load ${config.title}`);
      setRows([]);
      setApiFailed(true);
    } finally {
      setLoading(false);
    }
  }, [config]);

  const loadOptions = useCallback(async () => {
    // Dropdowns that use this page's own list API (e.g. Parent Category) reuse the table rows
    // below instead of calling the same GET a second time.
    const optionFields = config.fields.filter(
      (field) => field.optionsEndpoint && !usesOwnList(field, config.endpoint)
    );
    if (!optionFields.length) return;

    const next: Record<string, SelectOption[]> = {};
    let hasFailure = false;

    await Promise.all(
      optionFields.map(async (field) => {
        try {
          const res = await axios.get(field.optionsEndpoint || "", {
            params: field.getOptionsParams?.() || config.getRequestParams?.(),
          });
          next[field.name] = asArray(res.data)
            .map((row) => ({
              value: optionValue(row, field.optionValue),
              label: optionText(row, field.optionLabel),
              raw: row,
            }))
            .filter((item) => item.value !== "" && item.label);
        } catch (error) {
          console.error(`Failed to load options for ${field.name}`, error);
          next[field.name] = [];
          hasFailure = true;
        }
      })
    );

    setOptions(next);
    if (hasFailure) setApiFailed(true);
  }, [config.endpoint, config.fields]);

  // Final dropdown options: fetched ones plus those built from the table rows.
  const options = useMemo(() => {
    const merged = { ...fetchedOptions };
    config.fields.filter((field) => usesOwnList(field, config.endpoint)).forEach((field) => {
      merged[field.name] = rows
        .map((row) => ({
          value: optionValue(row, field.optionValue),
          label: optionText(row, field.optionLabel),
          raw: row,
        }))
        .filter((item) => item.value !== "" && item.label);
    });
    return merged;
  }, [config.endpoint, config.fields, fetchedOptions, rows]);

  useEffect(() => {
    loadRows();
    loadOptions();
  }, [loadRows, loadOptions]);

  // Toolbar Refresh icon: call every GET again (the list and all dropdown lists).
  // You can see the requests in the browser's Network tab.
  useEffect(() => {
    const refreshAll = () => {
      loadRows();
      loadOptions();
    };
    window.addEventListener("reusable-table:refresh", refreshAll);
    return () => window.removeEventListener("reusable-table:refresh", refreshAll);
  }, [loadRows, loadOptions]);

  const openCreate = useCallback(
    (seed?: PurchaseRecord) => {
      setEditingRow(null);
      setForm({
        ...emptyForm,
        ...(config.initialFormState || {}),
        ...(seed || {}),
      });
      resetValidation();
      setShowForm(true);
    },
    [config.initialFormState, emptyForm]
  );

  useEffect(() => {
    const autoOpenKey = config.autoOpenCreateKey || config.title;
    if (config.autoOpenCreate && autoOpenedKey.current !== autoOpenKey) {
      autoOpenedKey.current = autoOpenKey;
      openCreate(config.initialCreateState);
    }
  }, [config.autoOpenCreate, config.autoOpenCreateKey, config.initialCreateState, config.title, openCreate]);

  const openEdit = async (row: PurchaseRecord) => {
    let selectedRow = row;
    if (config.loadRecord) {
      try {
        selectedRow = (await config.loadRecord(row)) || row;
      } catch (error) {
        console.error(`Failed to load ${config.title} details`, error);
        ToasterService.error(`Failed to load ${config.title} details`);
        setApiFailed(true);
      }
    } else if (config.getByIdEndpoint) {
      try {
        const res = await axios.get(config.getByIdEndpoint(row), {
          params: config.getRequestParams?.(),
        });
        selectedRow = res.data || row;
      } catch (error) {
        console.error(`Failed to load ${config.title} details`, error);
        ToasterService.error(`Failed to load ${config.title} details`);
        setApiFailed(true);
      }
    }

    const base = config.normalizeForm ? config.normalizeForm(selectedRow) : selectedRow;
    const nextForm = { ...emptyForm, ...base };
    if ("parentCategoryId" in nextForm && !nextForm.parentCategoryId && nextForm.categoryId) {
      const selectedCategory = (options.categoryId || []).find(
        (option) => String(option.value) === String(nextForm.categoryId)
      );
      if (selectedCategory?.raw?.parentId) {
        nextForm.parentCategoryId = selectedCategory.raw.parentId;
      }
    }

    setEditingRow(selectedRow);
    setForm(nextForm);
    resetValidation();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
    setForm({ ...emptyForm });
    setIsDrawerEditing(false);
    resetValidation();
  };

  const setField = (field: FieldConfig, value: any) => {
    setForm((current) => mergeFormUpdate(field.name, value, current, field, options));
  };

  /** Fields the user can actually see and fill in this form. */
  const isFieldEditable = (field: FieldConfig) => {
    if (config.drawerHeaderDateField === field.name || config.drawerHeaderTextField === field.name) return false;
    if ((!editingRow && field.showOnCreate === false) || (editingRow && field.showOnEdit === false)) return false;
    if (String(field.gridClassName || "").split(/\s+/).includes("hidden")) return false;
    if (Boolean(editingRow) && field.readOnlyOnEdit) return false;
    return true;
  };

  /** All current field errors: required fields, each field's own validate(), and config.validateFields(). */
  const fieldErrors = useMemo<Record<string, string>>(() => {
    if (!showForm || config.renderCustomForm) return {};
    const errors: Record<string, string> = {};
    config.fields.forEach((field) => {
      if (!isFieldEditable(field)) return;
      const value = form[field.name];
      const isEmpty = value === "" || value == null;
      if (field.required && field.type !== "checkbox" && field.type !== "toggle" && isEmpty) {
        errors[field.name] = `${field.label.replace(/\s*\(.*\)\s*$/, "")} is required`;
        return;
      }
      const builtIn =
        field.type === "number"
          ? numberFieldError(field, value)
          : field.maxLength && String(value ?? "").length > field.maxLength
            ? `${plainLabel(field.label)} can be at most ${field.maxLength} characters`
            : null;
      if (builtIn) {
        errors[field.name] = builtIn;
        return;
      }
      const message = field.validate?.(value, form);
      if (message) errors[field.name] = message;
    });
    const extra = config.validateFields?.(form, editingRow, { options }) || {};
    Object.entries(extra).forEach(([name, message]) => {
      if (message && !errors[name]) errors[name] = message;
    });
    return errors;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, form, editingRow, config, options]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Field errors first: show them under the fields and jump to the first tab that has one.
    const errorNames = orderedErrorNames();
    if (errorNames.length) {
      setSubmitAttempted(true);
      const stepIndex = stepIndexOfField(errorNames[0]);
      if (stepIndex >= 0) setActiveStep(stepIndex);
      ToasterService.error(fieldErrors[errorNames[0]]);
      return;
    }

    const validationError = config.validateForm?.(form, editingRow, { options });
    if (validationError) {
      ToasterService.error(validationError);
      return;
    }
    const payload = config.buildPayload ? config.buildPayload(form, editingRow, { options }) : form;

    try {
      setIsSubmitting(true);
      let savedRow: PurchaseRecord | null = null;
      if (editingRow && config.allowEdit !== false) {
        const url = config.updateEndpoint
          ? config.updateEndpoint(editingRow, form)
          : `${config.endpoint}/${editingRow.id}`;
        const response = await axios.put(url, payload, { params: config.getRequestParams?.() });
        savedRow = response.data || editingRow;
        ToasterService.success(`${config.title} updated`);
      } else {
        const response = await axios.post(config.createEndpoint || config.endpoint, payload, {
          params: config.getRequestParams?.(),
        });
        savedRow = response.data || null;
        ToasterService.success(`${config.title} created`);
      }
      if (savedRow && config.afterSubmit) {
        await config.afterSubmit({
          form,
          editingRow,
          savedRow,
          isCreate: !editingRow,
          refreshRows: loadRows,
        });
      }
      closeForm();
      await Promise.all([loadRows(), loadOptions()]);
    } catch (error: any) {
      console.error(`Failed to save ${config.title}`, error);
      ToasterService.error(
        error.response?.data?.message || error.response?.data?.error || `Failed to save ${config.title}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    try {
      const url = config.deleteEndpoint
        ? config.deleteEndpoint(deleteRow)
        : `${config.endpoint}/${deleteRow.id}`;
      await axios.delete(url, { params: config.getRequestParams?.() });
      ToasterService.success(`${config.title} deleted`);
      setDeleteRow(null);
      loadRows();
    } catch (error: any) {
      console.error(`Failed to delete ${config.title}`, error);
      ToasterService.error(deleteErrorMessage(error, config));
    }
  };

  const resolveRowForUpdate = async (row: PurchaseRecord) => {
    if (config.loadRecord) {
      // Must succeed: saving a half-loaded record would wipe the fields that are missing.
      return (await config.loadRecord(row)) || row;
    }
    if (!config.getByIdEndpoint) return row;

    try {
      const res = await axios.get(config.getByIdEndpoint(row), {
        params: config.getRequestParams?.(),
      });
      return res.data || row;
    } catch (error) {
      console.error(`Failed to load ${config.title} details for update`, error);
      return row;
    }
  };

  const handleInlineActiveChange = async (row: PurchaseRecord, nextActive: boolean) => {
    if (!row?.id) return;

    try {
      setInlineUpdatingId(row.id);
      const rowForUpdate = await resolveRowForUpdate(row);
      const baseForm = config.normalizeForm ? config.normalizeForm(rowForUpdate) : rowForUpdate;
      const nextForm = { ...emptyForm, ...baseForm, active: nextActive };
      const payload = config.buildPayload
        ? config.buildPayload(nextForm, rowForUpdate, { options })
        : nextForm;
      const url = config.updateEndpoint
        ? config.updateEndpoint(rowForUpdate, nextForm)
        : `${config.endpoint}/${row.id}`;
      await axios.put(url, payload, { params: config.getRequestParams?.() });
      updateRowLocally(row.id, (currentRow) => ({ ...currentRow, active: nextActive }));
      ToasterService.success(`${config.title} status updated`);
    } catch (error: any) {
      console.error(`Failed to update ${config.title} status`, error);
      ToasterService.error(
        error.response?.data?.message || `Failed to update ${config.title} status`
      );
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const handleInlineSelectChange = async (
    row: PurchaseRecord,
    fieldName: string,
    nextValue: string
  ) => {
    if (!row?.id) return;

    try {
      setInlineUpdatingId(`${row.id}-${fieldName}`);
      const inlineSelectConfig = config.inlineSelectFields?.find(
        (field) => field.name === fieldName
      );
      if (inlineSelectConfig?.onChange) {
        await inlineSelectConfig.onChange(row, nextValue);
        updateRowLocally(row.id, (currentRow) => ({ ...currentRow, [fieldName]: nextValue }));
        ToasterService.success(`${config.title} updated`);
        return;
      }
      const rowForUpdate = await resolveRowForUpdate(row);
      const baseForm = config.normalizeForm ? config.normalizeForm(rowForUpdate) : rowForUpdate;
      const nextForm = { ...emptyForm, ...baseForm, [fieldName]: nextValue };
      const payload = config.buildPayload
        ? config.buildPayload(nextForm, rowForUpdate, { options })
        : nextForm;
      const url = config.updateEndpoint
        ? config.updateEndpoint(rowForUpdate, nextForm)
        : `${config.endpoint}/${row.id}`;
      await axios.put(url, payload, { params: config.getRequestParams?.() });
      updateRowLocally(row.id, (currentRow) => ({ ...currentRow, [fieldName]: nextValue }));
      ToasterService.success(`${config.title} updated`);
    } catch (error: any) {
      console.error(`Failed to update ${config.title}`, error);
      ToasterService.error(
        error.response?.data?.message || error.response?.data?.error || `Failed to update ${config.title}`
      );
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const tableColumns = useMemo<ColumnDef<PurchaseRecord>[]>(() => {
    const cols = config.columns
  .filter((column) => !HIDDEN_KEYS.has(column.key))
  .map((column) => ({
      key: column.key,
      label: column.label,
      sortable: column.sortable ?? true,
      className: column.className,
      headerClassName: column.headerClassName,
      sortValueGetter: (row: PurchaseRecord) => {
        if (column.sortValueGetter) return column.sortValueGetter(row);
        const value = getValue(row, column.key);
        return typeof value === "object" ? formatCellValue(value) : value;
      },
      // The details drawer shows the same thing as the table cell (badges, ₹, names).
      detailFormatter: column.detailFormatter
        ? (row: PurchaseRecord) => column.detailFormatter!(row)
        : column.render
          ? (row: PurchaseRecord) => column.render!(row)
          : undefined,
      // Export (PDF / Excel) gets readable text: ₹ amounts, 13 Oct 2026 dates, Active/Inactive.
      exportValueGetter: (row: PurchaseRecord) => {
        if (column.exportValue) return column.exportValue(row);
        // A cell that renders plain text (e.g. vendor name from a nested object, ₹ amount) exports that text.
        const rendered = column.render?.(row);
        if (typeof rendered === "string" || typeof rendered === "number") return rendered;
        const value = getValue(row, column.key);
        if (value == null || value === "") return "--";
        if (typeof value === "boolean") return formatBooleanFor(column.key, value);
        if (typeof value === "number") return isMoneyLikeKey(column.key) ? formatMoney(value) : value.toLocaleString("en-IN");
        if (typeof value === "object") return Array.isArray(value) ? value.length : formatCellValue(value);
        return formatDisplayText(String(value));
      },
      // Filter row: Active/Inactive dropdown for the active flag; nested values filter by their name.
      filterOptions:
        column.filterOptions ??
        (column.key === "active"
          ? [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ]
          : undefined),
      filterValueGetter: (row: PurchaseRecord) => {
        const value = getValue(row, column.key);
        if (column.key === "active") return value ? "active" : "inactive";
        if (typeof value === "boolean") return value ? "yes" : "no";
        return typeof value === "object" ? formatCellValue(value) : (value as string | number | null | undefined);
      },
      render: (row: PurchaseRecord) => {
        const value = getValue(row, column.key);
        const link = column.link?.(row);
        if (link) {
          // Same text colour as the other cells; on hover it turns cyan and underlined like a link.
          // A real <a href>, so right-click → "Open in new tab" also works.
          const rendered = column.render?.(row);
          const text = typeof rendered === "string" || typeof rendered === "number" ? rendered : formatCellValue(value);
          const href = `${APP_BASE}${link.to}`;
          return (
            <a
              href={href}
              onClick={(event) => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                navigate(link.to);
              }}
              className="block max-w-[220px] truncate text-sm text-gray-700 transition-colors hover:text-cyan-700 hover:underline focus:outline-none focus-visible:underline dark:text-gray-300 dark:hover:text-cyan-300"
              title={link.title}
            >
              {text}
            </a>
          );
        }
        const isInlineBooleanField =
          typeof value === "boolean" &&
          ((column.key === "active" && config.allowInlineActiveToggle) ||
            config.inlineBooleanFields?.includes(column.key));
        if (isInlineBooleanField) {
          const isActive = Boolean(value);
          return (
            <select
              value={isActive ? "ACTIVE" : "INACTIVE"}
              onChange={(event) => handleInlineActiveChange(row, event.target.value === "ACTIVE")}
              disabled={inlineUpdatingId === row.id}
              className={[
                "w-[126px] rounded-2xl border px-4 py-2.5 text-sm font-medium outline-none transition",
                "focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-300"
                  : "border-rose-200 bg-rose-50 text-red-600 focus:border-rose-300",
              ].join(" ")}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          );
        }
        const inlineSelectConfig = config.inlineSelectFields?.find(
          (field) => field.name === column.key
        );
        if (inlineSelectConfig) {
          const currentValue = String(value ?? inlineSelectConfig.defaultValue ?? "");
          return (
            <select
              value={currentValue}
              onChange={(event) =>
                handleInlineSelectChange(row, column.key, event.target.value)
              }
              disabled={inlineUpdatingId === `${row.id}-${column.key}`}
              className={[
                inlineSelectConfig.widthClassName || "w-[126px]",
                "rounded-2xl border px-4 py-2.5 text-sm font-medium outline-none transition",
                "focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60",
                getInlineSelectTone(currentValue),
              ].join(" ")}
            >
              {inlineSelectConfig.options.map((option) => (
                <option key={String(option.value)} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        }
        if (column.render) return column.render(row);
        if (typeof value === "boolean") return <StatusPill active={value} />;
        return <span className="text-sm text-gray-700">{formatCellValue(value)}</span>;
      },
    }));

    if (config.allowEdit === false && config.allowDelete === false && !config.renderRowActions) {
      return cols;
    }

    return [
      ...cols,
      {
        key: "actions",
        label: "Actions",
        sortable: false,
        headerClassName: "!text-right pr-8",
        className: "text-right",
        render: (row: PurchaseRecord) => (
          <div className="flex items-center justify-end gap-1">
            {config.renderRowActions?.(row, { refreshRows: loadRows })}

            {config.allowEdit !== false && (config.canEditRow?.(row) ?? true) && (
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                title="Edit"
              >
                <PencilSquareIcon className="h-4 w-4" />
              </button>
            )}
            {config.allowDelete !== false && (config.canDeleteRow?.(row) ?? true) && (
              <button
                type="button"
                onClick={() => setDeleteRow(row)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ];
  }, [config, emptyForm, inlineUpdatingId, loadRows, navigate, openEdit, options]);

  // Clickable summary cards (shared component): the page's own cards, or a sensible default.
  const statsCards = useMemo(
    () => (config.statsCards ? config.statsCards(rows) : defaultStatsCards(rows)),
    [config, rows]
  );
  const { filteredRows: cardRows, cardFilterProps } = useStatsCardFilter(rows, statsCards);
  const searchableFields = (config.searchFields ||
    config.columns.map((column) => column.key)) as any[];

  const filteredRows = useMemo(() => {
    const term = searchableText(search);
    return cardRows.filter((row) => {
      const matchesScope = !isScoped || Number(row.id) === scopeId;

      const matchesSearch =
        !term ||
        searchableFields.some((field) =>
          searchableText(getValue(row, String(field))).includes(term)
        );

      return matchesScope && matchesSearch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardRows, isScoped, scopeId, search]);

  const fieldEntries = config.fields.map((field) => {
    const fieldOptions = field.getOptions
      ? field.getOptions({ form, options })
      : field.options || options[field.name] || [];
    const value = form[field.name] ?? defaultForField(field);
    const isHeaderDateField = config.drawerHeaderDateField === field.name;
    const isHeaderTextField = config.drawerHeaderTextField === field.name;
    if (isHeaderDateField || isHeaderTextField) return null;
    if ((!editingRow && field.showOnCreate === false) || (editingRow && field.showOnEdit === false)) {
      return null;
    }
    const floatingOptions: FloatingOption[] = fieldOptions.map((option) => ({
      id: option.value,
      name: option.label,
    }));

    const drawerReadOnly =
      (config.formPresentation === "drawer" && config.drawerReadOnlyByDefault && !isDrawerEditing) ||
      (Boolean(editingRow) && field.readOnlyOnEdit);
    let control: React.ReactNode;

    if (drawerReadOnly) {
      const displayValue =
        field.displayValue?.(form) ||
        (field.type === "select"
          ? floatingOptions.find((option) => String(option.id) === String(value))?.name || formatCellValue(value)
          : formatCellValue(value));
      control = <ReadOnlyField label={field.label} value={displayValue} />;
    } else if (field.type === "textarea") {
      control = (
        <AutoGrowTextarea
          label={field.label}
          value={value}
          onChange={(event) => setField(field, event.target.value)}
          required={field.required}
          maxLength={field.maxLength}
        />
      );
    } else if (field.type === "select" && field.searchable) {
      control = (
        <SearchableSelect
          label={field.label}
          value={value}
          options={fieldOptions}
          onChange={(nextValue) => setField(field, nextValue)}
          required={field.required}
          placeholder={field.placeholder}
          // Optional fields get a "None" row (text from placeholderOption) to clear the value.
          emptyOptionLabel={field.required ? undefined : field.placeholderOption}
        />
      );
    } else if (field.type === "select") {
      control = (
        <FloatingSelect1
          label={field.label}
          value={value}
          onChange={(event) => setField(field, event.target.value)}
          options={floatingOptions}
          required={field.required}
          emptyOptionLabel={field.placeholderOption ?? " "}
        />
      );
    } else if (field.type === "toggle") {
      const onValue = field.toggleOnValue || "APPROVED";
      const offValue = field.toggleOffValue || "PENDING";
      const isEnabled = value === onValue;
      control = field.toggleOptions?.length ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
          <div className="grid grid-cols-3 gap-1">
            {field.toggleOptions.map((option) => {
              const selected = String(value) === String(option.value);
              const tone = option.value === "APPROVED" ? "bg-emerald-600" : option.value === "REJECTED" ? "bg-rose-600" : "bg-amber-500";
              return <button key={String(option.value)} type="button" onClick={() => setField(field, option.value)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${selected ? `${tone} text-white shadow-sm` : "text-slate-600 hover:bg-white"}`}>{option.label}</button>;
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => setField(field, isEnabled ? offValue : onValue)}
          className="flex h-[58px] w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 text-left transition hover:border-cyan-300"
        >
          <span>
            <span className="block text-sm font-medium text-slate-700">{field.label}</span>
            <span className={`mt-0.5 block text-xs font-semibold ${isEnabled ? "text-emerald-600" : "text-amber-600"}`}>{isEnabled ? onValue : offValue}</span>
          </span>
          <span className={`relative h-6 w-11 rounded-full transition ${isEnabled ? "bg-emerald-500" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${isEnabled ? "left-5" : "left-0.5"}`} />
          </span>
        </button>
      );
    } else if (field.type === "checkbox") {
      control = (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-gray-200">{field.label}</div>
              <div className="text-xs text-slate-400 dark:text-gray-500">
                {value ? "Turned on" : "Turned off"}
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => setField(field, event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
          </div>
        </div>
      );
    } else if (field.type === "date") {
      control = (
        
        <FloatingDatePicker
          label={field.label}
          value={value}
          onChange={(event) => setField(field, event.target.value)}
          required={field.required}
        />
      );
    } else {
      control = (
        <FloatingInput
          label={field.label}
          type={field.type || "text"}
          value={field.type === "datetime-local" ? formatDateTimeForInput(value) : value}
          onChange={(event) => {
            const input = event.target;
            if (field.type === "number" || !field.textCase) {
              setField(field, input.value);
              return;
            }
            // Change the letters (e.g. to CAPITALS) but keep the cursor where the user is typing.
            const { selectionStart, selectionEnd } = input;
            setField(field, applyTextCase(input.value, field.textCase));
            requestAnimationFrame(() => {
              try {
                input.setSelectionRange(selectionStart, selectionEnd);
              } catch {
                // some input types (email, number) don't support selection
              }
            });
          }}
          required={field.required}
          maxLength={field.maxLength}
          {...(field.type === "number"
            ? {
                min: field.allowNegative ? field.min : field.min ?? 0,
                max: field.max,
                step: field.decimals === 0 ? 1 : field.decimals ? 1 / 10 ** field.decimals : "any",
                inputMode: field.decimals === 0 ? ("numeric" as const) : ("decimal" as const),
                // Block the keys that make a negative or odd number: - + e E (and . for whole numbers).
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                  const blocked = ["e", "E", "+", ...(field.allowNegative ? [] : ["-"]), ...(field.decimals === 0 ? ["."] : [])];
                  if (blocked.includes(event.key)) event.preventDefault();
                },
                // Scrolling the page over a number box must not change the value.
                onWheel: (event: React.WheelEvent<HTMLInputElement>) => event.currentTarget.blur(),
              }
            : {})}
        />
      );
    }

    // Error shows after the user leaves the field, or after Save was clicked.
    const error = !drawerReadOnly && (touched[field.name] || submitAttempted) ? fieldErrors[field.name] : undefined;

    return {
      field,
      node: (
        <div
          key={field.name}
          className={field.gridClassName || ""}
          style={field.controlWidth ? { width: field.controlWidth } : undefined}
          onBlur={() => setTouched((current) => (current[field.name] ? current : { ...current, [field.name]: true }))}
        >
          <div className={error ? "rounded-xl ring-1 ring-red-400" : undefined}>{control}</div>
          {error && (
            <p className="mt-1 px-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      ),
    };
  });

  const extraFormContent = config.renderFormExtras?.({
    form,
    setForm,
    editingRow,
    refreshRows: loadRows,
    options,
  });
  const sidePanel = config.renderFormSidePanel?.({
    form,
    setForm,
    editingRow,
    refreshRows: loadRows,
    options,
  });
  const isInlineForm = Boolean(
    showForm && config.renderInlineEdit && (
      (editingRow && config.editPresentation === "inline") ||
      (!editingRow && config.createPresentation === "inline")
    )
  );
  const inlineEdit = isInlineForm
    ? config.renderInlineEdit?.({
        form,
        setForm,
        editingRow,
        refreshRows: loadRows,
        options,
        onClose: closeForm,
        onSubmit: handleSubmit,
        submitting: isSubmitting,
      })
    : null;
  const customFormContent = config.renderCustomForm?.({
    form,
    setForm,
    editingRow,
    options,
    onClose: closeForm,
    onSubmit: handleSubmit,
    submitting: isSubmitting,
  });
  const headerDateValue = config.drawerHeaderDateField ? form[config.drawerHeaderDateField] : null;
  const headerDate = headerDateValue
    ? new Date(String(headerDateValue)).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  /* ---------------- Tabs / steps ----------------
   * If any field has a `section`, fields are grouped into named tabs (in the order the
   * sections first appear). Fields without a section join the previous section.
   * Otherwise the old behaviour is kept: 4 fields per "Step N".
   */
  type FormGroup = { label: string; names: string[]; nodes: React.ReactNode[] };
  const visibleEntries = fieldEntries.filter(
    (entry): entry is { field: FieldConfig; node: React.ReactElement } => Boolean(entry)
  );
  const usesSections = config.fields.some((field) => field.section);
  const extrasNode = extraFormContent ? (
    <div key="form-extras" className="md:col-span-2">
      {extraFormContent}
    </div>
  ) : null;

  const groups: FormGroup[] = [];
  if (usesSections) {
    let currentLabel = "Details";
    visibleEntries.forEach(({ field, node }) => {
      currentLabel = field.section || currentLabel;
      let group = groups.find((item) => item.label === currentLabel);
      if (!group) {
        group = { label: currentLabel, names: [], nodes: [] };
        groups.push(group);
      }
      group.names.push(field.name);
      group.nodes.push(node);
    });
    if (extrasNode) {
      const extrasLabel = config.formExtrasSection || "Items";
      let group = groups.find((item) => item.label === extrasLabel);
      if (!group) {
        group = { label: extrasLabel, names: [], nodes: [] };
        groups.push(group);
      }
      group.nodes.push(extrasNode);
    }
  } else {
    const all = [...visibleEntries.map((entry) => ({ name: entry.field.name, node: entry.node })), ...(extrasNode ? [{ name: "", node: extrasNode }] : [])];
    for (let index = 0; index < Math.max(1, Math.ceil(all.length / 4)); index += 1) {
      const slice = all.slice(index * 4, index * 4 + 4);
      groups.push({ label: `Step ${index + 1}`, names: slice.map((item) => item.name).filter(Boolean), nodes: slice.map((item) => item.node) });
    }
  }

  /** Field names that have errors, in the order they appear in the form. */
  function orderedErrorNames() {
    const inForm = groups.flatMap((group) => group.names).filter((name) => fieldErrors[name]);
    const others = Object.keys(fieldErrors).filter((name) => !inForm.includes(name));
    return [...inForm, ...others];
  }

  /** Index of the tab that contains a field, or -1. */
  function stepIndexOfField(name: string) {
    return groups.findIndex((group) => group.names.includes(name));
  }

  const stepHasError = (index: number) =>
    (submitAttempted || groups[index]?.names.some((name) => touched[name])) &&
    Boolean(groups[index]?.names.some((name) => fieldErrors[name]));

  /** Next is blocked while the current tab has errors; the errors are shown on that tab. */
  const handleBeforeNext = (index: number) => {
    const names = groups[index]?.names || [];
    const firstError = names.find((name) => fieldErrors[name]);
    if (!firstError) return true;
    setTouched((current) => ({ ...current, ...Object.fromEntries(names.map((name) => [name, true])) }));
    ToasterService.error(fieldErrors[firstError]);
    return false;
  };

  const popupFields = groups.flatMap((group) => group.nodes);

  const modalSteps = groups.map((group) => ({
    label: group.label,
    content: (
      <div className={sidePanel ? "grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,.9fr)]" : "grid grid-cols-1 gap-3 pt-1 md:grid-cols-2"}>
        <div className={sidePanel ? "grid grid-cols-1 gap-3 pt-1 md:grid-cols-2" : "contents"}>{group.nodes}</div>
        {sidePanel && <aside className="min-w-0 border-t border-slate-100 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">{sidePanel}</aside>}
      </div>
    ),
  }));

  // Drawer forms show all fields at once; with sections, each section gets a heading.
  const drawerFields = usesSections
    ? groups.flatMap((group) => [
        <h3 key={`section-${group.label}`} className="col-span-full mt-2 border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-gray-800 dark:text-gray-400">
          {group.label}
        </h3>,
        ...group.nodes,
      ])
    : popupFields;

  return (
    <>
      <PageMeta title={config.title} description={config.description} />
      <PageBreadcrumb className="mr-4" pageTitle={config.title} actions={<>{config.renderHeaderActions?.()}{config.allowCreate !== false && <AddButton className="-mr-5" label={`Add ${config.title}`} onClick={() => openCreate()} />}</>} />

      {isInlineForm ? (
        <div className="w-full px-3 py-6">{inlineEdit}</div>
      ) : <div className="w-full max-w-none px-0 py-8">
        {isScoped && config.scope && <div className="mx-3 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100"><span>Showing {config.scope.label.toLowerCase()}: <strong>{scopeName}</strong></span><button type="button" onClick={() => navigate(location.pathname)} className="font-semibold text-cyan-700 hover:text-cyan-900 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200">View all {config.scope.label.toLowerCase()}s</button></div>}

        <div className="py-5 px-3">
          {/* Click a card to show only its rows; click it again to show all. */}
          <StatsCardFilter {...cardFilterProps} />
          <div className="">
            <ReusableTable<PurchaseRecord>
              data={filteredRows}
              columns={tableColumns}
              loading={loading}
              pageSize={config.pageSize || 10}
              defaultSortKey={config.columns[0]?.key}
              rowDetailsTitle={`${config.title} Details`}
              searchFields={config.searchFields as any}
              hiddenDetailKeys={config.hiddenDetailKeys}
              // Edit straight from the details drawer: the drawer hides while the form is open
              // and comes back with the saved values (the list reloads after Update).
              rowDetailsActions={(row) =>
                config.allowEdit !== false && (config.canEditRow?.(row) ?? true) ? (
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    // No own colours: it takes the drawer header's button style, same as ✕.
                    title="Edit"
                    aria-label="Edit this record"
                  >
                    <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                ) : null
              }
              suspendRowDetails={showForm}
            />
          </div>
        </div>
      </div>}

      {/* Create and Edit open in the side drawer, unless a page asks for the centred popup. */}
      {!isInlineForm && (config.formPresentation !== "modal" ? (
        <Dragger
          isOpen={showForm}
          title={editingRow ? `Edit ${config.title}` : `Add ${config.title}`}
          subtitle={config.formSubtitle}
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitLabel={editingRow ? "Update" : "Create"}
          submitting={isSubmitting}
          headerMeta={config.drawerHeaderDateField || config.drawerHeaderTextField ? (
            <>
              {config.drawerHeaderTextField && (isDrawerEditing ? (
                <input
                  type="text"
                  value={String(form[config.drawerHeaderTextField] || "")}
                  onChange={(event) => setForm((current) => ({ ...current, [config.drawerHeaderTextField!]: event.target.value }))}
                  aria-label="Approved by"
                />
              ) : <span className="dragger__approved-by">Approved by: {String(form[config.drawerHeaderTextField] || "--")}</span>)}
              {config.drawerHeaderDateField && (isDrawerEditing ? (
                <input
                  type="datetime-local"
                  value={String(headerDateValue || "")}
                  onChange={(event) => setForm((current) => ({ ...current, [config.drawerHeaderDateField!]: event.target.value }))}
                  aria-label="Approval date"
                />
              ) : headerDate)}
            </>
          ) : undefined}
          headerAction={config.drawerHeaderDateField || config.drawerHeaderTextField ? (
            <button type="button" onClick={() => setIsDrawerEditing((current) => !current)} aria-label={isDrawerEditing ? "Lock approval date" : "Edit approval date"} title={isDrawerEditing ? "Lock approval date" : "Edit approval date"}>
              <PencilSquareIcon className="h-5 w-5" />
            </button>
          ) : undefined}
          showSubmit
          compact={config.drawerCompact}
          content={customFormContent}
        >
          {!customFormContent && (
            <div className={sidePanel ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(400px,.9fr)]" : "grid grid-cols-1 gap-3 md:grid-cols-2"}>
              {sidePanel ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{drawerFields}</div> : drawerFields}
              {sidePanel && <aside className="min-w-0 border-t border-slate-100 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">{sidePanel}</aside>}
            </div>
          )}
        </Dragger>
      ) : <Dragger
        isOpen={showForm}
        variant="modal"
        title={editingRow ? `Edit ${config.title}` : `Add ${config.title}`}
        subtitle={config.formSubtitle}
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitLabel={editingRow ? "Update" : "Create"}
        submitting={isSubmitting}
        steps={customFormContent ? undefined : modalSteps}
        activeStep={activeStep}
        onStepChange={setActiveStep}
        stepHasError={stepHasError}
        onBeforeNext={handleBeforeNext}
        // Named tabs: Save is available on every tab, like the reference design.
        submitOnEveryStep={usesSections}
        content={customFormContent}
      />)}

      <DynamicPopup
        isPopupOpen={Boolean(deleteRow)}
        setIsPopupOpen={(open) => !open && setDeleteRow(null)}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText={`Delete ${config.title}`}
        subText="Are you sure you want to delete this record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default PurchaseResourcePage;
