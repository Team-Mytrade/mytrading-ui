import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CheckCircleIcon,
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
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";

export type PurchaseRecord = Record<string, any> & { id?: number | string };

export type SelectOption = {
  value: string | number;
  label: string;
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
  optionLabel?: string | ((row: PurchaseRecord) => string);
  optionValue?: string | ((row: PurchaseRecord) => string | number);
  gridClassName?: string;
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
  getListParams?: () => Record<string, string | number | boolean>;
  buildPayload?: (form: PurchaseRecord, editingRow: PurchaseRecord | null) => PurchaseRecord;
  normalizeForm?: (row: PurchaseRecord) => PurchaseRecord;
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

const inputBase =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-gray-100";

function defaultForField(field: FieldConfig) {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "checkbox") return true;
  if (field.type === "number") return "";
  return "";
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
      const res = await axios.get(config.endpoint, { params: config.getListParams?.() });
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
          const res = await axios.get(field.optionsEndpoint || "");
          next[field.name] = asArray(res.data)
            .map((row) => ({
              value: optionValue(row, field.optionValue),
              label: optionText(row, field.optionLabel),
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
        const res = await axios.get(config.getByIdEndpoint(row));
        selectedRow = res.data || row;
      } catch (error) {
        console.error(`Failed to load ${config.title} details`, error);
        ToasterService.error(`Failed to load ${config.title} details`);
        setApiFailed(true);
      }
    }

    const base = config.normalizeForm ? config.normalizeForm(selectedRow) : selectedRow;
    setEditingRow(selectedRow);
    setForm({ ...emptyForm, ...base });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
    setForm({ ...emptyForm });
  };

  const setField = (name: string, value: any) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = config.buildPayload ? config.buildPayload(form, editingRow) : form;

    try {
      if (editingRow && config.allowEdit !== false) {
        const url = config.updateEndpoint
          ? config.updateEndpoint(editingRow, form)
          : `${config.endpoint}/${editingRow.id}`;
        await axios.put(url, payload);
        ToasterService.success(`${config.title} updated`);
      } else {
        await axios.post(config.createEndpoint || config.endpoint, payload);
        ToasterService.success(`${config.title} created`);
      }
      closeForm();
      loadRows();
    } catch (error: any) {
      console.error(`Failed to save ${config.title}`, error);
      ToasterService.error(error.response?.data?.message || `Failed to save ${config.title}`);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    try {
      const url = config.deleteEndpoint ? config.deleteEndpoint(deleteRow) : `${config.endpoint}/${deleteRow.id}`;
      await axios.delete(url);
      ToasterService.success(`${config.title} deleted`);
      setDeleteRow(null);
      loadRows();
    } catch (error: any) {
      console.error(`Failed to delete ${config.title}`, error);
      ToasterService.error(error.response?.data?.message || `Failed to delete ${config.title}`);
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
  }, [config, openEdit]);

  const searchableFields = (config.searchFields || config.columns.map((column) => column.key)) as any[];
  const activeCount = rows.filter((row) => row.active === true).length;

  return (
    <>
      <PageMeta title={config.title} description={config.description} />
      <PageBreadcrumb pageTitle={config.title} />

      <div className="w-full px-0 py-6 space-y-6">
        <div className="flex justify-start sm:justify-end lg:-mt-[134px]">
          {config.allowCreate !== false && <AddButton label={`Add ${config.title}`} onClick={openCreate} />}
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

        <ReusableTable<PurchaseRecord>
          data={rows}
          columns={tableColumns}
          loading={loading}
          searchable
          searchPlaceholder={`Search ${config.title.toLowerCase()}...`}
          searchFields={searchableFields}
          pageSize={config.pageSize || 10}
          defaultSortKey={config.columns[0]?.key}
          rowDetailsTitle={`${config.title} Details`}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 py-8">
            <div className="fixed inset-0 bg-black/50" onClick={closeForm} />
            <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingRow ? `Edit ${config.title}` : `Add ${config.title}`}
                  </h3>
                  <p className="text-sm text-gray-500">Fields follow the Purchase Service Swagger schema.</p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-5 py-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {config.fields.map((field) => {
                    const fieldOptions = field.options || options[field.name] || [];
                    const value = form[field.name] ?? defaultForField(field);
                    const fieldId = `${config.title}-${field.name}`;

                    return (
                      <label key={field.name} htmlFor={fieldId} className={field.gridClassName || ""}>
                        <span className="mb-1 block text-sm font-medium text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-500"> *</span>}
                        </span>

                        {field.type === "textarea" ? (
                          <textarea
                            id={fieldId}
                            value={value}
                            onChange={(event) => setField(field.name, event.target.value)}
                            required={field.required}
                            placeholder={field.placeholder}
                            rows={4}
                            className={inputBase}
                          />
                        ) : field.type === "select" ? (
                          <select
                            id={fieldId}
                            value={value}
                            onChange={(event) => setField(field.name, event.target.value)}
                            required={field.required}
                            className={inputBase}
                          >
                            <option value="">Select {field.label}</option>
                            {fieldOptions.map((option) => (
                              <option key={String(option.value)} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "checkbox" ? (
                          <div className="flex h-10 items-center gap-2">
                            <input
                              id={fieldId}
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(event) => setField(field.name, event.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className="text-sm text-gray-600">Enabled</span>
                          </div>
                        ) : (
                          <input
                            id={fieldId}
                            type={field.type || "text"}
                            value={field.type === "datetime-local" ? formatDateTimeForInput(value) : value}
                            onChange={(event) => setField(field.name, event.target.value)}
                            required={field.required}
                            placeholder={field.placeholder}
                            className={inputBase}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-5 flex justify-end gap-3 border-t pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-700"
                  >
                    {editingRow ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
