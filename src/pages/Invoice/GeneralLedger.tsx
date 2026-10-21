import React, { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { DocumentTextIcon, DocumentDuplicateIcon, XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, StatsCardTone, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingDatePicker, FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { formatEnumLabel, toSelectOptions, useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/general-ledger)        */
/* ------------------------------------------------------------------ */

/** A line as returned by GET (accountCode / accountName, no generalAccountId). */
interface LedgerLineResponse {
  id?: number;
  generalAccountId?: number; // only if the backend adds it
  accountCode?: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  narration?: string;
}

interface LedgerEntry {
  id: number;
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
  entries?: LedgerLineResponse[];
}

/** POST body. createdBy and tenantId are set by the server, so they are not sent. */
interface CreateLedgerPayload {
  entryNumber?: string;
  entryDate: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
  entries: { generalAccountId: number; debit: number; credit: number; narration?: string }[];
}

interface GeneralAccount {
  id: number;
  accountCode?: string;
  accountName?: string;
}

interface SourceDocument {
  id: number;
  invoiceNumber?: string;
}

interface LineForm {
  key: string;
  generalAccountId: string;
  debit: string;
  credit: string;
  narration: string;
}

type HeaderForm = {
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  sourceModule?: string;
  sourceId?: string;
};

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/general-ledger";
const ACCOUNTS_URL = "/v1/api/invoice/general-accounts";
/** Lists used to pick the source document by its number instead of typing an id. */
const SOURCE_LISTS: Record<string, string> = {
  SALES_INVOICE: "/v1/api/invoice/invoices",
  PURCHASE_INVOICE: "/v1/api/invoice/purchase-invoices",
};
const PAGE_SIZE = 10;

/** Set to true if the backend generates the entry number. Then the field is hidden. */
const ENTRY_NUMBER_FROM_BACKEND = false;

const SOURCE_MODULE_FALLBACK = ["SALES_INVOICE", "PURCHASE_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "ADJUSTMENT_NOTE", "OTHER"];

const MODULE_TONE: Record<string, StatsCardTone> = {
  SALES_INVOICE: "green",
  PURCHASE_INVOICE: "blue",
  CREDIT_NOTE: "cyan",
  DEBIT_NOTE: "red",
  ADJUSTMENT_NOTE: "amber",
};

const BADGE_CLASS: Record<StatsCardTone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  blue: "bg-blue-50 text-blue-700 border-blue-200/40",
  amber: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  red: "bg-red-50 text-red-700 border-red-200/40",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200/40",
  slate: "bg-gray-50 text-gray-700 border-gray-200/40",
};

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const apiError = (err: any, fallback: string) => err?.response?.data?.message || err?.response?.data?.error || fallback;

/** Paise maths so totals add up exactly (0.1 + 0.2 = 0.3). */
const toPaise = (value: unknown) => Math.round((Number(value) || 0) * 100);
const fromPaise = (paise: number) => paise / 100;

let lineCounter = 0;
const newLine = (): LineForm => ({ key: `line-${++lineCounter}`, generalAccountId: "", debit: "", credit: "", narration: "" });

const totalDebitOf = (entry: LedgerEntry) => fromPaise((entry.entries || []).reduce((sum, l) => sum + toPaise(l.debit), 0));

/** Number box for money: blocks - + e E, ignores mouse-wheel scrolling. */
const amountInputProps = {
  type: "number" as const,
  min: 0,
  step: "0.01",
  inputMode: "decimal" as const,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault(),
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * Ledger entries can be added and viewed; the API has no edit or delete.
 * "Copy" (GET /general-ledger/{id}) starts a new entry from an existing one.
 */
const GeneralLedger: React.FC = () => {
  const { canCreate } = usePermissions();

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [sourceDocs, setSourceDocs] = useState<Record<string, SourceDocument[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const sourceModules = useInvoiceEnum("SOURCE_MODULE", SOURCE_MODULE_FALLBACK);
  const moduleLabel = (code?: string) => sourceModules.find((s) => s.code === code)?.label || (code ? formatEnumLabel(code) : "--");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<HeaderForm>({});
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);

  // Existing entries for the chosen source document: GET /general-ledger/source?module=&sourceId=
  const [sourceEntries, setSourceEntries] = useState<LedgerEntry[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setEntries(asArray<LedgerEntry>(res.data));
    } catch (err) {
      console.error("Error fetching general ledger entries", err);
      ToasterService.error("Failed to load general ledger entries");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAccounts = () =>
    axios
      .get(ACCOUNTS_URL)
      .then((r) => setAccounts(asArray<GeneralAccount>(r.data)))
      .catch(() => ToasterService.error("Failed to load accounts for the Account dropdown"));

  const fetchSourceDocs = () =>
    Promise.all(
      Object.entries(SOURCE_LISTS).map(([module, url]) =>
        axios
          .get(url)
          .then((r) => [module, asArray<SourceDocument>(r.data)] as const)
          .catch(() => [module, [] as SourceDocument[]] as const)
      )
    ).then((pairs) => setSourceDocs(Object.fromEntries(pairs)));

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
    fetchSourceDocs();
    // Toolbar Refresh icon reloads every list
    const reload = () => {
      fetchEntries();
      fetchAccounts();
      fetchSourceDocs();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Source document number when known, otherwise #id. */
  const sourceText = (module?: string, id?: number) => {
    if (!id) return "--";
    const doc = (sourceDocs[module || ""] || []).find((d) => d.id === id);
    return doc?.invoiceNumber || `#${id}`;
  };

  /* ---------------- Cards: Total + one per source module found ---------------- */

  const cards = useMemo<StatsCardOption<LedgerEntry>[]>(() => {
    const present = new Set(entries.map((e) => e.sourceModule).filter(Boolean) as string[]);
    const ordered = [
      ...sourceModules.map((s) => s.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !sourceModules.some((s) => s.code === code)),
    ].slice(0, 5);
    return [
      { key: "ALL", label: "Total Entries", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: moduleLabel(code),
        match: (e: LedgerEntry) => e.sourceModule === code,
        tone: MODULE_TONE[code] || "slate",
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, sourceModules]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(entries, cards);

  /* ---------------- Form ---------------- */

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        value: String(a.id),
        label: [a.accountCode, a.accountName].filter(Boolean).join(" – ") || `Account ${a.id}`,
        keywords: [a.accountCode || ""],
      })),
    [accounts]
  );

  /** GET returns accountCode, not generalAccountId: find the account id from the code. */
  const findAccountId = (line: LedgerLineResponse) => {
    if (line.generalAccountId) return String(line.generalAccountId);
    const match = accounts.find(
      (a) => (line.accountCode && a.accountCode === line.accountCode) || (!line.accountCode && line.accountName && a.accountName === line.accountName)
    );
    return match ? String(match.id) : "";
  };

  const openCreate = () => {
    setForm({ entryDate: todayIso() });
    setLines([newLine()]);
    setShowForm(true);
  };

  /** Copy: loads the entry (GET /general-ledger/{id}) and starts a new one with the same lines. */
  const openCopy = async (entry: LedgerEntry) => {
    let source = entry;
    try {
      const res = await axios.get<LedgerEntry>(`${API_URL}/${entry.id}`);
      source = res.data || entry;
    } catch (err) {
      console.error("Error loading ledger entry", err);
      ToasterService.error(apiError(err, "Could not load the latest copy of this entry"));
    }
    const copied: LineForm[] = (source.entries || []).map((l) => ({
      key: `line-${++lineCounter}`,
      generalAccountId: findAccountId(l),
      debit: l.debit ? String(l.debit) : "",
      credit: l.credit ? String(l.credit) : "",
      narration: l.narration || "",
    }));
    setForm({ entryDate: todayIso(), description: source.description || "", sourceModule: source.sourceModule || "" });
    setLines(copied.length ? copied : [newLine()]);
    setShowForm(true);
    if (copied.some((l) => !l.generalAccountId)) {
      ToasterService.error("Some accounts could not be matched. Please choose them again.");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({});
    setLines([newLine()]);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const updateLine = (key: string, patch: Partial<LineForm>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + toPaise(l.debit), 0);
    const credit = lines.reduce((s, l) => s + toPaise(l.credit), 0);
    return { debit, credit, difference: debit - credit };
  }, [lines]);
  const isBalanced = totals.debit > 0 && totals.difference === 0;

  // Show existing ledger entries for the chosen source document (avoids posting twice)
  useEffect(() => {
    if (!showForm || !form.sourceModule || !form.sourceId) {
      setSourceEntries([]);
      return;
    }
    let active = true;
    setSourceLoading(true);
    axios
      .get(`${API_URL}/source`, { params: { module: form.sourceModule, sourceId: Number(form.sourceId) } })
      .then((res) => active && setSourceEntries(asArray<LedgerEntry>(res.data)))
      .catch((err) => {
        console.error("Error loading entries for the source", err);
        if (active) setSourceEntries([]);
      })
      .finally(() => active && setSourceLoading(false));
    return () => {
      active = false;
    };
  }, [showForm, form.sourceModule, form.sourceId]);

  const validate = (): string | null => {
    if (!ENTRY_NUMBER_FROM_BACKEND && !form.entryNumber?.trim()) return "Entry number is required";
    if (!form.entryDate) return "Entry date is required";
    const filled = lines.filter((l) => l.generalAccountId || l.debit || l.credit || l.narration.trim());
    if (filled.length < 2) return "A ledger entry needs at least 2 lines (one debit and one credit)";
    for (const line of filled) {
      const row = `Line ${lines.indexOf(line) + 1}`;
      const debit = toPaise(line.debit);
      const credit = toPaise(line.credit);
      if (!line.generalAccountId) return `${row}: choose an account`;
      if (debit > 0 && credit > 0) return `${row}: enter either a debit or a credit, not both`;
      if (debit <= 0 && credit <= 0) return `${row}: enter a debit or a credit amount`;
    }
    if (totals.debit !== totals.credit) {
      return `Total debit (${formatMoney(fromPaise(totals.debit))}) and total credit (${formatMoney(fromPaise(totals.credit))}) must be equal`;
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) return ToasterService.error(error);

    const payload: CreateLedgerPayload = {
      ...(ENTRY_NUMBER_FROM_BACKEND ? {} : { entryNumber: form.entryNumber?.trim() }),
      entryDate: form.entryDate as string,
      description: form.description?.trim() || undefined,
      sourceModule: form.sourceModule || undefined,
      sourceId: form.sourceId ? Number(form.sourceId) : undefined,
      entries: lines
        .filter((l) => l.generalAccountId)
        .map((l) => ({
          generalAccountId: Number(l.generalAccountId),
          debit: fromPaise(toPaise(l.debit)),
          credit: fromPaise(toPaise(l.credit)),
          narration: l.narration.trim() || undefined,
        })),
    };
    setSubmitting(true);
    try {
      const res = await axios.post<LedgerEntry>(API_URL, payload);
      ToasterService.success(`Ledger entry ${res.data?.entryNumber || ""} added`.replace("  ", " "));
      closeForm();
      fetchEntries();
    } catch (err) {
      console.error("Error creating ledger entry", err);
      ToasterService.error(apiError(err, "Failed to save ledger entry"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Table ---------------- */

  const tableColumns: ColumnDef<LedgerEntry>[] = [
    {
      key: "entryNumber",
      label: "Entry Number",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">{e.entryNumber || "--"}</span>
        </div>
      ),
    },
    {
      key: "entryDate",
      label: "Entry Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      exportValueGetter: (e) => (e.entryDate ? formatDisplayDate(e.entryDate) : ""),
      render: (e) => <span className="text-sm text-slate-600">{e.entryDate ? formatDisplayDate(e.entryDate) : "--"}</span>,
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[24%] text-left",
      className: "w-[24%]",
      render: (e) => <span className="block truncate text-sm text-slate-600" title={e.description}>{e.description || "--"}</span>,
    },
    {
      key: "sourceModule",
      label: "Source Module",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      filterOptions: sourceModules.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (e) => moduleLabel(e.sourceModule),
      exportValueGetter: (e) => moduleLabel(e.sourceModule),
      render: (e) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${BADGE_CLASS[MODULE_TONE[e.sourceModule || ""] || "slate"]}`}>
          {moduleLabel(e.sourceModule)}
        </span>
      ),
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      headerClassName: "w-[11%] text-left",
      className: "w-[11%]",
      sortValueGetter: (e) => sourceText(e.sourceModule, e.sourceId),
      detailFormatter: (e) => sourceText(e.sourceModule, e.sourceId),
      exportValueGetter: (e) => sourceText(e.sourceModule, e.sourceId),
      render: (e) => <span className="text-sm text-slate-600">{sourceText(e.sourceModule, e.sourceId)}</span>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      filterable: false,
      headerClassName: "w-[13%] text-right",
      className: "w-[13%] text-right",
      sortValueGetter: (e) => totalDebitOf(e),
      exportValueGetter: (e) => formatMoney(totalDebitOf(e)),
      render: (e) => <span className="text-sm font-semibold text-slate-700">{formatMoney(totalDebitOf(e))}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (e) => (
        <div className="flex items-center justify-end gap-0.5">
          {canCreate && (
            <button
              type="button"
              onClick={() => openCopy(e)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
              title="Copy to a new entry"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const sourceOptions = sourceDocs[form.sourceModule || ""];

  return (
    <>
      <PageMeta title="General Ledger" description="General ledger entries" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="General Ledger"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Ledger Entry" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="entryDate"
            defaultSortOrder="desc"
            loading={isLoading}
            rowDetailsTitle={(e) => `Ledger Entry ${e.entryNumber || ""}`.trim()}
            rowDetailsSubtitle="Ledger entries cannot be edited"
            suspendRowDetails={showForm}
            rowDetailsActions={(e: LedgerEntry) =>
              canCreate ? (
                <button type="button" onClick={() => openCopy(e)} className={ICON_BUTTON_CLASS} title="Copy to a new entry" aria-label="Copy to a new entry">
                  <DocumentDuplicateIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No ledger entries found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all entries</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium">
                      Create your first ledger entry
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        <Dragger
          isOpen={showForm}
          title="Add Ledger Entry"
          subtitle="Total debit must equal total credit. Ledger entries cannot be edited after saving."
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Create"
        >
          {/* Header fields */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {!ENTRY_NUMBER_FROM_BACKEND && (
              <FloatingInput label="Entry Number" name="entryNumber" value={form.entryNumber || ""} onChange={handleChange} maxLength={50} required />
            )}
            <FloatingDatePicker label="Entry Date" name="entryDate" value={form.entryDate || ""} onChange={handleChange} required />
            <FloatingSelect
              label="Source Module"
              name="sourceModule"
              value={form.sourceModule || ""}
              onChange={(e) => setForm({ ...form, sourceModule: e.target.value, sourceId: "" })}
              options={toSelectOptions(sourceModules)}
            />
            {sourceOptions ? (
              <SearchableSelect
                label="Source Document"
                value={form.sourceId || ""}
                options={sourceOptions.map((d) => ({ value: String(d.id), label: d.invoiceNumber || `#${d.id}` }))}
                onChange={(value: string | number) => setForm({ ...form, sourceId: String(value ?? "") })}
                placeholder={sourceOptions.length ? "Search document (optional)" : "No documents loaded"}
                emptyOptionLabel="None"
              />
            ) : (
              <div className="hidden md:block" />
            )}
            <div className="md:col-span-2">
              <FloatingTextarea label="Description" name="description" rows={2} value={form.description || ""} onChange={handleChange} />
            </div>
          </div>

          {/* Already posted for this document? */}
          {form.sourceId && (
            <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100">
              {sourceLoading
                ? "Checking existing entries for this document…"
                : sourceEntries.length === 0
                  ? "No ledger entries posted for this document yet."
                  : `This document already has ${sourceEntries.length} ledger entr${sourceEntries.length === 1 ? "y" : "ies"}: ${sourceEntries
                      .map((s) => `${s.entryNumber || `#${s.id}`} (${formatMoney(totalDebitOf(s))})`)
                      .join(", ")}`}
            </div>
          )}

          {/* Lines */}
          <div className="mt-2 border-t border-slate-100 pt-4 dark:border-gray-800">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Entry Lines</h3>
            {lines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-1 gap-x-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_36px] md:items-start">
                <SearchableSelect
                  label={`Account ${index + 1}`}
                  value={line.generalAccountId}
                  options={accountOptions}
                  onChange={(value: string | number) => updateLine(line.key, { generalAccountId: String(value ?? "") })}
                  placeholder={accounts.length ? "Search account" : "No accounts loaded"}
                  required
                />
                <FloatingInput
                  label="Debit"
                  name={`debit-${line.key}`}
                  {...amountInputProps}
                  value={line.debit}
                  // A line is either debit or credit: typing one clears the other
                  onChange={(e) => updateLine(line.key, { debit: e.target.value, credit: e.target.value ? "" : line.credit })}
                />
                <FloatingInput
                  label="Credit"
                  name={`credit-${line.key}`}
                  {...amountInputProps}
                  value={line.credit}
                  onChange={(e) => updateLine(line.key, { credit: e.target.value, debit: e.target.value ? "" : line.debit })}
                />
                <FloatingInput label="Narration" name={`narration-${line.key}`} value={line.narration} onChange={(e) => updateLine(line.key, { narration: e.target.value })} maxLength={255} />
                <button
                  type="button"
                  onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== line.key) : current))}
                  disabled={lines.length <= 1}
                  className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Remove line"
                  aria-label="Remove line"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setLines((current) => [...current, newLine()])} className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
              <PlusIcon className="h-3.5 w-3.5" /> Add Line
            </button>

            <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-800/60">
              <div>
                <span className="block text-xs text-slate-500">Total Debit</span>
                <strong className="text-slate-800 dark:text-gray-100">{formatMoney(fromPaise(totals.debit))}</strong>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Total Credit</span>
                <strong className="text-slate-800 dark:text-gray-100">{formatMoney(fromPaise(totals.credit))}</strong>
              </div>
              <div>
                <span className="block text-xs text-slate-500">Difference</span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASS[isBalanced ? "green" : "red"]}`}>
                  {isBalanced
                    ? "Balanced"
                    : totals.debit === 0 && totals.credit === 0
                      ? "Enter amounts"
                      : `Out by ${formatMoney(fromPaise(Math.abs(totals.difference)))}`}
                </span>
              </div>
            </div>
          </div>
        </Dragger>
      </div>
    </>
  );
};

export default GeneralLedger;
