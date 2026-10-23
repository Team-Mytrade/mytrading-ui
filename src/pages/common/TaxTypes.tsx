import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, TagIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { toSelectOptions, useInvoiceEnum } from "../Invoice/invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/tax-types)             */
/* ------------------------------------------------------------------ */

interface TaxType {
  id: number;
  taxName?: string;
  taxRate?: number;
  region?: string;
  isActive?: boolean;
  description?: string;
  createdDate?: string;
  updatedDate?: string;
}

/** POST /create and PUT /{id} body. Server fields (id, dates, createdBy, tenantId) are never sent. */
interface TaxTypePayload {
  taxName: string;
  taxRate: number;
  region?: string;
  isActive: boolean;
  description?: string;
}

type TaxTypeForm = {
  taxName: string;
  taxRate: string;
  region: string;
  isActive: boolean;
  description: string;
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/tax-types";
const PAGE_SIZE = 10;
// Used only if the REGION enum API fails
const REGION_FALLBACK = ["INDIA", "EU", "USA", "QATAR", "UAE", "CANADA", "AUSTRALIA", "UK", "OTHER"];

const EMPTY_FORM: TaxTypeForm = { taxName: "", taxRate: "", region: "INDIA", isActive: true, description: "" };

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};


/** "18" → "18%", "2.5" → "2.5%" */
const rateText = (rate?: number) => (rate == null ? "--" : `${Number(rate).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const TaxTypes: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const regions = useInvoiceEnum("REGION", REGION_FALLBACK);
  const regionLabel = (code?: string) => regions.find((r) => r.code === code)?.label || code || "--";

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaxTypeForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<TaxType | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchTaxTypes = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setTaxTypes(asArray<TaxType>(res.data));
    } catch (err) {
      console.error("Error fetching tax types", err);
      ToasterService.error("Failed to load tax types");
      setTaxTypes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxTypes();
    // Toolbar Refresh icon reloads the list
    const reload = () => fetchTaxTypes();
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Cards ---------------- */

  const cards = useMemo<StatsCardOption<TaxType>[]>(
    () => [
      { key: "ALL", label: "Total Tax Types", match: () => true, tone: "cyan" },
      { key: "ACTIVE", label: "Active", match: (t) => t.isActive !== false, tone: "green" },
      { key: "INACTIVE", label: "Inactive", match: (t) => t.isActive === false, tone: "red" },
    ],
    []
  );
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(taxTypes, cards);

  /* ---------------- Form ---------------- */

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (t: TaxType) => {
    setForm({
      taxName: t.taxName || "",
      taxRate: t.taxRate != null ? String(t.taxRate) : "",
      region: t.region || "",
      isActive: t.isActive !== false,
      description: t.description || "",
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.taxName.trim();
    const rate = Number(form.taxRate);
    if (!name) return ToasterService.error("Tax name is required");
    if (form.taxRate === "" || !Number.isFinite(rate)) return ToasterService.error("Tax rate is required");
    if (rate < 0 || rate > 100) return ToasterService.error("Tax rate must be between 0 and 100");
    if (!/^\d+(\.\d{1,2})?$/.test(form.taxRate.trim())) return ToasterService.error("Tax rate can have at most 2 decimal places");
    // Same name + region twice would make the Tax Type dropdowns confusing
    const duplicate = taxTypes.find(
      (t) => t.id !== editingId && (t.taxName || "").trim().toLowerCase() === name.toLowerCase() && (t.region || "") === form.region
    );
    if (duplicate) return ToasterService.error(`"${name}" already exists for ${regionLabel(form.region)}`);

    const payload: TaxTypePayload = {
      taxName: name,
      taxRate: rate,
      region: form.region || undefined,
      isActive: form.isActive,
      description: form.description.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (editingId !== null) await axios.put(`${API_URL}/${editingId}`, payload);
      else await axios.post(`${API_URL}/create`, payload);
      ToasterService.success(editingId !== null ? `${name} updated` : `${name} added`);
      closeForm();
      fetchTaxTypes();
    } catch (err) {
      console.error("Error saving tax type", err);
      ToasterService.error(apiError(err, "Failed to save tax type"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Delete ---------------- */

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${toDelete.id}`);
      ToasterService.success(`${toDelete.taxName || "Tax type"} deleted`);
      setShowDelete(false);
      setToDelete(null);
      fetchTaxTypes();
    } catch (err: any) {
      console.error("Error deleting tax type", err);
      // A tax type used by tax details / records can't be deleted: suggest deactivating it instead
      const inUse = err?.response?.status === 409 || /constraint|foreign key|in use|referenced/i.test(String(err?.response?.data?.message || ""));
      ToasterService.error(inUse ? "This tax type is in use, so it cannot be deleted. Edit it and turn it inactive instead." : apiError(err, "Failed to delete tax type"));
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- Table ---------------- */

  const tableColumns: ColumnDef<TaxType>[] = [
    {
      key: "taxName",
      label: "Tax Name",
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
            <TagIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="truncate text-sm font-semibold leading-snug text-slate-900">{t.taxName || "--"}</span>
        </div>
      ),
    },
    {
      key: "taxRate",
      label: "Rate",
      sortable: true,
      filterable: false,
      sortValueGetter: (t) => Number(t.taxRate || 0),
      detailFormatter: (t) => rateText(t.taxRate),
      exportValueGetter: (t) => rateText(t.taxRate),
      render: (t) => (
        <span className="inline-flex items-center rounded-full border border-blue-200/40 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{rateText(t.taxRate)}</span>
      ),
    },
    {
      key: "region",
      label: "Region",
      sortable: true,
      filterOptions: regions.map((r) => ({ label: r.label, value: r.code })),
      detailFormatter: (t) => regionLabel(t.region),
      exportValueGetter: (t) => regionLabel(t.region),
      render: (t) => (
        <span className="inline-flex items-center gap-1 text-sm text-slate-600">
          <GlobeAltIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          {regionLabel(t.region)}
        </span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (t) => (
        <span className="block truncate text-sm text-slate-600" title={t.description}>
          {t.description || "--"}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      filterValueGetter: (t) => (t.isActive !== false ? "active" : "inactive"),
      detailFormatter: (t) => (t.isActive !== false ? "Active" : "Inactive"),
      exportValueGetter: (t) => (t.isActive !== false ? "Active" : "Inactive"),
      render: (t) =>
        t.isActive !== false ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200/40 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Active</span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Inactive</span>
        ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (t) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title="Edit Tax Type">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => { setToDelete(t); setShowDelete(true); }} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title="Delete Tax Type">
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Tax Types" description="Tax rates used across invoices" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Tax Types"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Tax Type" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as the Invoice pages (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="taxRate"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(t) => `${t.taxName || "Tax Type"} (${rateText(t.taxRate)})`}
            rowDetailsSubtitle="Tax type details"
            suspendRowDetails={showForm || showDelete}
            rowDetailsActions={(t: TaxType) =>
              canUpdate ? (
                <button type="button" onClick={() => openEdit(t)} className={ICON_BUTTON_CLASS} title="Edit" aria-label="Edit this record">
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <TagIcon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No tax types found</p>
                {selected !== "ALL" ? (
                  <p className="text-xs text-gray-400">Click the selected card again to show all tax types</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
                      Create your first tax type (e.g. GST 18%)
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Small form, so a popup */}
        <Dragger
          isOpen={showForm}
          variant="modal"
          title={editingId !== null ? "Edit Tax Type" : "Add Tax Type"}
          subtitle="A tax and its rate, e.g. GST 18%"
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FloatingInput label="Tax Name" name="taxName" value={form.taxName} onChange={handleChange} maxLength={100} required />
            <FloatingInput
              label="Tax Rate (%)"
              name="taxRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={form.taxRate}
              onChange={handleChange}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
              onWheel={(e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()}
              required
            />
            <FloatingSelect
              label="Region"
              name="region"
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              options={toSelectOptions(regions)}
            />
            {/* Inactive tax types stay on old records but are hidden from new ones */}
            <label className="mb-5 flex h-[52px] cursor-pointer items-center justify-between rounded-md border border-gray-300 px-4 text-sm dark:border-gray-700">
              <span>
                <span className="block font-medium text-slate-700 dark:text-gray-200">Active</span>
                <span className="text-xs text-slate-400">{form.isActive ? "Can be used on new records" : "Hidden from new records"}</span>
              </span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
            </label>
            <div className="md:col-span-2">
              <FloatingInput label="Description" name="description" value={form.description} onChange={handleChange} maxLength={255} />
            </div>
          </div>
        </Dragger>

        <DynamicPopup
          isPopupOpen={showDelete}
          setIsPopupOpen={setShowDelete}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Tax Type"
          subText={toDelete ? `Delete "${toDelete.taxName}" (${rateText(toDelete.taxRate)})? If it is already used, turn it inactive instead.` : ""}
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default TaxTypes;
