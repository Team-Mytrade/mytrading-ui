import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
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
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import FilterPopover from "../../components/common/filter";
import PaginatedPopup from "../../components/common/unpopup";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1,
  FloatingTextarea,
  Option as FloatingOption,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

export type PurchaseRecord = Record<string, any> & { id?: number | string };

export type SelectOption = {
  value: string | number;
  label: string;
  raw?: PurchaseRecord;
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
  | "checkbox";

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
  placeholderOption?: string;
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

export type ResourceColumn = {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: PurchaseRecord) => React.ReactNode;
};

export type PurchaseResourceConfig = {
  title: string;
  description: string;
  endpoint: string;
  getByIdEndpoint?: (row: PurchaseRecord) => string;
  createEndpoint?: string;
  updateEndpoint?: (row: PurchaseRecord, form: PurchaseRecord) => string;
  deleteEndpoint?: (row: PurchaseRecord) => string;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  columns: ResourceColumn[];
  fields: FieldConfig[];
  searchFields?: string[];
  pageSize?: number;
  renderHeaderActions?: () => React.ReactNode;
  getListParams?: () => Record<string, string | number | boolean>;
  getRequestParams?: () => Record<string, string | number | boolean>;
  allowInlineActiveToggle?: boolean;
  inlineBooleanFields?: string[];
  inlineSelectFields?: Array<{
    name: string;
    options: SelectOption[];
    widthClassName?: string;
  }>;
  buildPayload?: (
    form: PurchaseRecord,
    editingRow: PurchaseRecord | null,
    context: { options: Record<string, SelectOption[]> }
  ) => PurchaseRecord | FormData;
  normalizeForm?: (row: PurchaseRecord) => PurchaseRecord;
  renderFormExtras?: (context: {
    form: PurchaseRecord;
    setForm: React.Dispatch<React.SetStateAction<PurchaseRecord>>;
    editingRow: PurchaseRecord | null;
    refreshRows: () => Promise<void>;
  }) => React.ReactNode;
  afterSubmit?: (context: {
    form: PurchaseRecord;
    editingRow: PurchaseRecord | null;
    savedRow: PurchaseRecord;
    isCreate: boolean;
    refreshRows: () => Promise<void>;
  }) => Promise<void> | void;
};

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

function searchableText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value).toLowerCase();
  return String(value).toLowerCase().trim();
}

function getInlineSelectTone(value: unknown) {
  const normalized = String(value || "").toLowerCase();

  if (["active", "approved", "issued", "closed", "received"].includes(normalized)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 focus:border-emerald-300";
  }

  if (["inactive", "rejected", "cancelled", "block"].includes(normalized)) {
    return "border-rose-200 bg-rose-50 text-red-600 focus:border-rose-300";
  }

  if (["draft", "pending", "submitted"].includes(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-700 focus:border-amber-300";
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

export const makeRelation = (id: any) => (id ? { id: Number(id) } : null);

export const toNumberOrNull = (value: any) =>
  value === "" || value == null ? null : Number(value);

export const toNumberOrZero = (value: any) =>
  value === "" || value == null ? 0 : Number(value);

export const PurchaseResourcePage: React.FC<{ config: PurchaseResourceConfig }> = ({ config }) => {
  const [rows, setRows] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState<PurchaseRecord | null>(null);
  const [form, setForm] = useState<PurchaseRecord>({});
  const [options, setOptions] = useState<Record<string, SelectOption[]>>({});
  const [deleteRow, setDeleteRow] = useState<PurchaseRecord | null>(null);
  const [apiFailed, setApiFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [inlineUpdatingId, setInlineUpdatingId] = useState<string | number | null>(null);
  const [search, setSearch] = useState("");

  const updateRowLocally = useCallback((rowId: string | number, updater: (row: PurchaseRecord) => PurchaseRecord) => {
    setRows((current) =>
      current.map((item) => {
        if (String(item.id) !== String(rowId)) return item;
        return updater(item);
      })
    );
  }, []);

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
    const optionFields = config.fields.filter((field) => field.optionsEndpoint);
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
  }, [config.fields]);

  useEffect(() => {
    loadRows();
    loadOptions();
  }, [loadRows, loadOptions]);

  const openCreate = () => {
    setEditingRow(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = async (row: PurchaseRecord) => {
    let selectedRow = row;
    if (config.getByIdEndpoint) {
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
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
    setForm({ ...emptyForm });
  };

  const setField = (field: FieldConfig, value: any) => {
    setForm((current) => mergeFormUpdate(field.name, value, current, field, options));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
      ToasterService.error(error.response?.data?.message || `Failed to save ${config.title}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    try {
      const url = config.deleteEndpoint ? config.deleteEndpoint(deleteRow) : `${config.endpoint}/${deleteRow.id}`;
      await axios.delete(url, { params: config.getRequestParams?.() });
      ToasterService.success(`${config.title} deleted`);
      setDeleteRow(null);
      loadRows();
    } catch (error: any) {
      console.error(`Failed to delete ${config.title}`, error);
      ToasterService.error(error.response?.data?.message || `Failed to delete ${config.title}`);
    }
  };

  const resolveRowForUpdate = async (row: PurchaseRecord) => {
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
      const payload = config.buildPayload ? config.buildPayload(nextForm, rowForUpdate, { options }) : nextForm;
      const url = config.updateEndpoint ? config.updateEndpoint(rowForUpdate, nextForm) : `${config.endpoint}/${row.id}`;
      await axios.put(url, payload, { params: config.getRequestParams?.() });
      updateRowLocally(row.id, (currentRow) => ({ ...currentRow, active: nextActive }));
      ToasterService.success(`${config.title} status updated`);
    } catch (error: any) {
      console.error(`Failed to update ${config.title} status`, error);
      ToasterService.error(error.response?.data?.message || `Failed to update ${config.title} status`);
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const handleInlineSelectChange = async (row: PurchaseRecord, fieldName: string, nextValue: string) => {
    if (!row?.id) return;

    try {
      setInlineUpdatingId(`${row.id}-${fieldName}`);
      const rowForUpdate = await resolveRowForUpdate(row);
      const baseForm = config.normalizeForm ? config.normalizeForm(rowForUpdate) : rowForUpdate;
      const nextForm = { ...emptyForm, ...baseForm, [fieldName]: nextValue };
      const payload = config.buildPayload ? config.buildPayload(nextForm, rowForUpdate, { options }) : nextForm;
      const url = config.updateEndpoint ? config.updateEndpoint(rowForUpdate, nextForm) : `${config.endpoint}/${row.id}`;
      await axios.put(url, payload, { params: config.getRequestParams?.() });
      updateRowLocally(row.id, (currentRow) => ({ ...currentRow, [fieldName]: nextValue }));
      ToasterService.success(`${config.title} updated`);
    } catch (error: any) {
      console.error(`Failed to update ${config.title}`, error);
      ToasterService.error(error.response?.data?.message || `Failed to update ${config.title}`);
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const tableColumns = useMemo<ColumnDef<PurchaseRecord>[]>(() => {
    const cols = config.columns.map((column) => ({
      key: column.key,
      label: column.label,
      sortable: column.sortable ?? true,
      sortValueGetter: (row: PurchaseRecord) => {
        const value = getValue(row, column.key);
        return typeof value === "object" ? formatCellValue(value) : value;
      },
      render: (row: PurchaseRecord) => {
        if (column.render) return column.render(row);
        const value = getValue(row, column.key);
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
        const inlineSelectConfig = config.inlineSelectFields?.find((field) => field.name === column.key);
        if (inlineSelectConfig) {
          const currentValue = String(value ?? "");
          return (
            <select
              value={currentValue}
              onChange={(event) => handleInlineSelectChange(row, column.key, event.target.value)}
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
        if (typeof value === "boolean") return <StatusPill active={value} />;
        return <span className="text-sm text-gray-700">{formatCellValue(value)}</span>;
      },
    }));

    if (config.allowEdit === false && config.allowDelete === false) return cols;

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
            {config.allowEdit !== false && (
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                title="Edit"
              >
                <PencilSquareIcon className="h-4 w-4" />
              </button>
            )}
            {config.allowDelete !== false && (
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
  }, [config, emptyForm, inlineUpdatingId, openEdit, options]);

  const supportsActiveFilter = useMemo(
    () => rows.some((row) => typeof row.active === "boolean"),
    [rows]
  );
  const searchableFields = (config.searchFields || config.columns.map((column) => column.key)) as any[];

  const filteredRows = useMemo(() => {
    const term = searchableText(search);
    return rows.filter((row) => {
      const matchesActive =
        !supportsActiveFilter || activeFilter === "ALL"
          ? true
          : Boolean(row.active) === (activeFilter === "ACTIVE");

      const matchesSearch =
        !term ||
        searchableFields.some((field) => searchableText(getValue(row, String(field))).includes(term));

      return matchesActive && matchesSearch;
    });
  }, [activeFilter, rows, search, supportsActiveFilter]);
  const activeCount = rows.filter((row) => row.active === true).length;
  const popupFields = config.fields.map((field) => {
    const fieldOptions = field.getOptions
      ? field.getOptions({ form, options })
      : field.options || options[field.name] || [];
    const value = form[field.name] ?? defaultForField(field);
    const floatingOptions: FloatingOption[] = fieldOptions.map((option) => ({
      id: option.value,
      name: option.label,
    }));

    let control: React.ReactNode;

    if (field.type === "textarea") {
      control = (
        <FloatingTextarea
          label={field.label}
          value={value}
          onChange={(event) => setField(field, event.target.value)}
          required={field.required}
          rows={4}
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
          emptyOptionLabel={field.placeholderOption || `Select ${field.label}`}
        />
      );
    } else if (field.type === "checkbox") {
      control = (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-700">{field.label}</div>
              <div className="text-xs text-slate-400">Enable this option for the current record.</div>
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
          onChange={(event) => setField(field, event.target.value)}
          required={field.required}
        />
      );
    }

    return (
      <div key={field.name} className={field.gridClassName || ""}>
        {control}
      </div>
    );
  });

  const extraFormContent = config.renderFormExtras?.({
    form,
    setForm,
    editingRow,
    refreshRows: loadRows,
  });

  if (extraFormContent) {
    popupFields.push(
      <div key="form-extras" className="md:col-span-2">
        {extraFormContent}
      </div>
    );
  }

  return (
    <>
      <PageMeta title={config.title} description={config.description} />
      <PageBreadcrumb className="mr-4" pageTitle={config.title} />

      <div className="w-full max-w-none px-0 py-8">
        <div className="flex justify-start sm:justify-end lg:-mt-[134px]">
          <div className="flex flex-wrap items-center gap-3">
            {config.renderHeaderActions?.()}
            {config.allowCreate !== false && <AddButton label={`Add ${config.title}`} onClick={openCreate} />}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label="Total Records" value={rows.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Active Records" value={activeCount || "--"} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard
            label="Loaded From API"
            value={loading ? "..." : apiFailed ? "API failed" : "Ready"}
            gradient={apiFailed ? "from-red-50 to-rose-50" : "from-purple-50 to-pink-50"}
            borderColor={apiFailed ? "border-red-100" : "border-purple-100"}
            labelColor={apiFailed ? "text-red-600" : "text-purple-600"}
            icon={apiFailed ? <XCircleIcon className="h-5 w-5" /> : <CheckCircleIcon className="h-5 w-5" />}
          />
        </div>

        <div className=" flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${config.title.toLowerCase()}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {supportsActiveFilter && (
            <div className="flex items-center gap-2">
              <FilterPopover
                title={`Filter ${config.title}`}
                buttonLabel="Filter"
                label="Status"
                value={activeFilter}
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Inactive", value: "INACTIVE" },
                ]}
                onChange={(value) => setActiveFilter((value as "ALL" | "ACTIVE" | "INACTIVE") || "ALL")}
                onReset={() => setActiveFilter("ALL")}
                onApply={() => undefined}
              />
            </div>
          )}
        </div>

        <ReusableTable<PurchaseRecord>
          data={filteredRows}
          columns={tableColumns}
          loading={loading}
          pageSize={config.pageSize || 10}
          defaultSortKey={config.columns[0]?.key}
          rowDetailsTitle={`${config.title} Details`}
        />
      </div>

      <PaginatedPopup
        isOpen={showForm}
        title={editingRow ? `Edit ${config.title}` : `Add ${config.title}`}
        subtitle="Fields follow the Purchase Service Swagger schema."
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitLabel={editingRow ? "Update" : "Create"}
        submitting={isSubmitting}
        maxWidthClassName="max-w-4xl"
        itemsPerPage={4}
        fields={popupFields}
      />

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
