import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { DocumentTextIcon, DocumentDuplicateIcon, XMarkIcon, PlusIcon, ScaleIcon } from "@heroicons/react/24/outline";
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
  // ⚠ 22 Oct: POST answers "Account not found: null" with generalAccountId (Journal Entries accepts it).
  // Waiting for the General Ledger Swagger example to see which field it reads.
  entries: { generalAccountId: number; debit: number; credit: number; narration?: string }[];
}

interface GeneralAccount {
  id: number;
  accountCode?: string;
  accountName?: string;
  accountType?: string;
  isActive?: boolean;
  allowTransactions?: boolean;
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

/**
 * Set to true if the backend generates the entry number (Journal Entries does: JE-2026-001).
 * Check after the first successful General Ledger save.
 */
const ENTRY_NUMBER_FROM_BACKEND = false;

/** Dropdown value for "no source document". Never sent: the payload gets no sourceModule. */
const MANUAL_SOURCE = "__MANUAL__";

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

/**
 * What a debit does to each account type. Credit is the opposite.
 * Asset / Expense: debit = goes up. Liability / Equity / Income: debit = goes down.
 */
const DEBIT_INCREASES = new Set(["ASSET", "EXPENSE"]);
const TYPE_LABELS: Record<string, string> = { ASSET: "Asset", LIABILITY: "Liability", EQUITY: "Equity", INCOME: "Income", EXPENSE: "Expense" };
const TYPE_TONES: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-700 border-blue-200/50",
  LIABILITY: "bg-red-50 text-red-700 border-red-200/50",
  EQUITY: "bg-purple-50 text-purple-700 border-purple-200/50",
  INCOME: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  EXPENSE: "bg-orange-50 text-orange-700 border-orange-200/50",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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
const newLine = (patch: Partial<LineForm> = {}): LineForm => ({
  key: `line-${++lineCounter}`,
  generalAccountId: "",
  debit: "",
  credit: "",
  narration: "",
  ...patch,
});

const totalDebitOf = (entry: LedgerEntry) => fromPaise((entry.entries || []).reduce((sum, l) => sum + toPaise(l.debit), 0));

const accountLabel = (a: GeneralAccount) => [a.accountCode, a.accountName].filter(Boolean).join(" – ") || `Account ${a.id}`;
const lineAccountText = (line: LedgerLineResponse) => [line.accountCode, line.accountName].filter(Boolean).join(" – ") || "Account";

/** "Bank Loan → Bank – HDFC": debit accounts, then credit accounts. */
const flowText = (entry: LedgerEntry) => {
  const names = (side: "debit" | "credit") =>
    (entry.entries || []).filter((l) => toPaise(l[side]) > 0).map((l) => l.accountName || l.accountCode || "Account");
  const short = (list: string[]) => (list.length > 1 ? `${list[0]} +${list.length - 1}` : list[0] || "--");
  return `${short(names("debit"))} → ${short(names("credit"))}`;
};

/** Number box for money: blocks - + e E, ignores mouse-wheel scrolling. */
const amountInputProps = {
  type: "number" as const,
  min: 0,
  step: "0.01",
  inputMode: "decimal" as const,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault(),
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
};

/** Notes box that starts as one line and grows as you type (same as Journal Entries). */
const AutoGrowTextarea = (props: React.ComponentProps<typeof FloatingTextarea>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resize = () => {
    const textarea = wrapperRef.current?.querySelector("textarea");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(52, textarea.scrollHeight + 2)}px`;
  };
  useLayoutEffect(resize, [props.value]);
  return (
    <div ref={wrapperRef} onInput={resize}>
      <FloatingTextarea {...props} rows={1} />
    </div>
  );
};

/** Debit / credit lines of a saved entry, shown in the row details drawer. */
const LinesTable = ({ entry }: { entry: LedgerEntry }) => {
  const lines = entry.entries || [];
  if (!lines.length) return <span className="text-gray-400">--</span>;
  const debit = lines.reduce((s, l) => s + toPaise(l.debit), 0);
  const credit = lines.reduce((s, l) => s + toPaise(l.credit), 0);
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            <th className="px-3 py-2">Account</th>
            <th className="px-3 py-2 text-right">Debit</th>
            <th className="px-3 py-2 text-right">Credit</th>
            <th className="px-3 py-2">Narration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
          {lines.map((l, i) => (
            <tr key={l.id ?? i}>
              {/* Credit lines are indented, the usual way of writing an entry */}
              <td className={`px-3 py-2 text-slate-800 dark:text-gray-100 ${toPaise(l.credit) > 0 ? "pl-8" : ""}`}>{lineAccountText(l)}</td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-gray-200">{toPaise(l.debit) > 0 ? formatMoney(Number(l.debit)) : ""}</td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-gray-200">{toPaise(l.credit) > 0 ? formatMoney(Number(l.credit)) : ""}</td>
              <td className="px-3 py-2 text-slate-500">{l.narration || ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold dark:bg-gray-800">
          <tr>
            <td className="px-3 py-2 text-xs uppercase text-slate-500">Total</td>
            <td className="px-3 py-2 text-right text-slate-800 dark:text-gray-100">{formatMoney(fromPaise(debit))}</td>
            <td className="px-3 py-2 text-right text-slate-800 dark:text-gray-100">{formatMoney(fromPaise(credit))}</td>
            <td className="px-3 py-2">
              <span className={`text-xs ${debit === credit ? "text-emerald-700" : "text-red-600"}`}>{debit === credit ? "Balanced" : "Not balanced"}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
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
  const moduleLabel = (code?: string) => (code ? sourceModules.find((s) => s.code === code)?.label || formatEnumLabel(code) : "Manual");

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
      .then((r) =>
        setAccounts(
          asArray<any>(r.data).map((a) => ({
            id: a.id,
            accountCode: a.accountCode,
            accountName: a.accountName,
            accountType: a.accountType,
            isActive: a.isActive,
            allowTransactions: a.allowTransactions,
          }))
        )
      )
      .catch(() => ToasterService.error("Failed to load accounts for the Account dropdown"));

  const fetchSourceDocs = () =>
    Promise.all(
      Object.entries(SOURCE_LISTS).map(([module, url]) =>
        axios
          .get(url)
          // Only id and number are kept (purchase invoices also nest their vendor with every invoice)
          .then((r) => [module, asArray<SourceDocument>(r.data).map((d) => ({ id: d.id, invoiceNumber: d.invoiceNumber }))] as const)
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

  /* ---------------- Cards: Total + one per source found ---------------- */

  const cards = useMemo<StatsCardOption<LedgerEntry>[]>(() => {
    const present = new Set(entries.map((e) => e.sourceModule || "MANUAL"));
    const ordered = [
      ...sourceModules.map((s) => s.code).filter((code) => present.has(code)),
      ...[...present].filter((code) => !sourceModules.some((s) => s.code === code)),
    ].slice(0, 5);
    return [
      { key: "ALL", label: "Total Entries", match: () => true, tone: "cyan" },
      ...ordered.map((code) => ({
        key: code,
        label: code === "MANUAL" ? "Manual" : moduleLabel(code),
        match: (e: LedgerEntry) => (e.sourceModule || "MANUAL") === code,
        tone: MODULE_TONE[code] || "slate",
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, sourceModules]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(entries, cards);

  /* ---------------- Form ---------------- */

  // Only active accounts that allow transactions can be picked
  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.isActive !== false && a.allowTransactions !== false)
        .map((a) => ({
          value: String(a.id),
          label: `${accountLabel(a)}${a.accountType ? ` (${TYPE_LABELS[a.accountType] || a.accountType})` : ""}`,
          keywords: [a.accountCode || "", a.accountType || ""],
        })),
    [accounts]
  );
  const accountById = (id: string) => accounts.find((a) => String(a.id) === id);

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
    const copied: LineForm[] = (source.entries || []).map((l) =>
      newLine({
        generalAccountId: findAccountId(l),
        debit: l.debit ? String(l.debit) : "",
        credit: l.credit ? String(l.credit) : "",
        narration: l.narration || "",
      })
    );
    setForm({ entryDate: todayIso(), description: source.description || "", sourceModule: source.sourceModule || "" });
    setLines(copied.length ? copied : [newLine()]);
    setShowForm(true);
    if (copied.some((l) => !l.generalAccountId)) ToasterService.error("Some accounts could not be matched. Please choose them again.");
  };

  const closeForm = () => {
    setShowForm(false);
    setForm({});
    setLines([newLine()]);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const updateLine = (key: string, patch: Partial<LineForm>) => setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== key) : current));

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + toPaise(l.debit), 0);
    const credit = lines.reduce((s, l) => s + toPaise(l.credit), 0);
    return { debit, credit, difference: debit - credit };
  }, [lines]);
  const isBalanced = totals.debit > 0 && totals.difference === 0;

  /** New line on the short side with the missing amount, so the entry balances in one click. */
  const addBalancingLine = () => {
    const missing = Math.abs(totals.difference);
    if (!missing) return;
    const side = totals.difference > 0 ? { credit: String(fromPaise(missing)) } : { debit: String(fromPaise(missing)) };
    setLines((current) => {
      const last = current[current.length - 1];
      if (last && !last.generalAccountId && !last.debit && !last.credit) return current.map((l) => (l.key === last.key ? { ...l, ...side } : l));
      return [...current, newLine(side)];
    });
  };

  /** "Bank – HDFC goes down by ₹5,000" – what this line does to the account. */
  const lineEffect = (line: LineForm) => {
    const account = accountById(line.generalAccountId);
    const debit = toPaise(line.debit);
    const credit = toPaise(line.credit);
    if (!account?.accountType || (!debit && !credit)) return null;
    const goesUp = debit > 0 ? DEBIT_INCREASES.has(account.accountType) : !DEBIT_INCREASES.has(account.accountType);
    return (
      <span className={goesUp ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
        {goesUp ? "▲" : "▼"} {account.accountName || "Account"} goes {goesUp ? "up" : "down"} by {formatMoney(fromPaise(debit || credit))}
      </span>
    );
  };

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
    if (form.entryDate > todayIso()) return "Entry date cannot be in the future";
    if (!form.description?.trim()) return "Description is required – say why this entry is made";
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
    const accountIds = filled.map((l) => l.generalAccountId);
    if (new Set(accountIds).size !== accountIds.length) return "The same account is used on two lines. Combine them into one line.";
    if (!filled.some((l) => toPaise(l.debit) > 0) || !filled.some((l) => toPaise(l.credit) > 0)) return "Add at least one debit line and one credit line";
    if (totals.difference !== 0) {
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
      sourceId: form.sourceModule && form.sourceId ? Number(form.sourceId) : undefined,
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
      ToasterService.success(`Ledger entry${res.data?.entryNumber ? ` ${res.data.entryNumber}` : ""} created`);
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
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="truncate text-sm font-semibold leading-snug text-slate-900">{e.entryNumber || "--"}</span>
        </div>
      ),
    },
    {
      key: "entryDate",
      label: "Date",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      exportValueGetter: (e) => (e.entryDate ? formatDisplayDate(e.entryDate) : ""),
      render: (e) => <span className="text-sm text-slate-600">{e.entryDate ? formatDisplayDate(e.entryDate) : "--"}</span>,
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (e) => (
        <span className="block truncate text-sm text-slate-600" title={e.description}>
          {e.description || "--"}
        </span>
      ),
    },
    {
      // Debit side → credit side. In the details drawer it shows the full debit / credit table.
      key: "flow",
      label: "Accounts (Dr → Cr)",
      sortable: false,
      filterable: false,
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      exportValueGetter: (e) => flowText(e),
      detailFormatter: (e) => <LinesTable entry={e} />,
      render: (e) => (
        <span className="block truncate text-sm text-slate-600" title={flowText(e)}>
          {flowText(e)}
        </span>
      ),
    },
    {
      // Source module + document number together, e.g. "Purchase Invoice · INV-2026-0001"
      key: "sourceModule",
      label: "Source",
      sortable: true,
      headerClassName: "w-[16%] text-left",
      className: "w-[16%]",
      filterOptions: sourceModules.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (e) => (e.sourceId ? `${moduleLabel(e.sourceModule)} · ${sourceText(e.sourceModule, e.sourceId)}` : moduleLabel(e.sourceModule)),
      exportValueGetter: (e) => (e.sourceId ? `${moduleLabel(e.sourceModule)} ${sourceText(e.sourceModule, e.sourceId)}` : moduleLabel(e.sourceModule)),
      render: (e) => (
        <div className="leading-snug">
          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASS[MODULE_TONE[e.sourceModule || ""] || "slate"]}`}>
            {moduleLabel(e.sourceModule)}
          </span>
          {e.sourceId && <span className="block truncate text-xs text-slate-500">{sourceText(e.sourceModule, e.sourceId)}</span>}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      filterable: false,
      headerClassName: "w-[11%] text-right",
      className: "w-[11%] text-right",
      sortValueGetter: (e) => totalDebitOf(e),
      exportValueGetter: (e) => formatMoney(totalDebitOf(e)),
      render: (e) => <span className="text-sm font-semibold text-slate-700">{formatMoney(totalDebitOf(e))}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[9%] text-right pr-4",
      className: "w-[9%] text-right",
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
            rowDetailsSubtitle="Ledger entries cannot be edited – use Copy to start a new one"
            // The raw `entries` list is replaced by the Dr / Cr table of the "Accounts" column
            hiddenDetailKeys={["sourceId", "entries"]}
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
                <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No ledger entries found</p>
                {selected !== "ALL" ? (
                  <p className="text-xs text-gray-400">Click the selected card again to show all entries</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
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
          subtitle="Money moves from the credit account(s) to the debit account(s). Both totals must be equal. Entries can't be edited after saving."
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
            {/* The day the money moved (can be earlier than today, never later) */}
            <FloatingDatePicker label="Entry Date" name="entryDate" value={form.entryDate || ""} onChange={handleChange} maxDate={todayIso()} required />
            {/* "Manual entry" is a real option, so the label floats above it instead of overlapping */}
            <FloatingSelect
              label="Source"
              name="sourceModule"
              value={form.sourceModule || MANUAL_SOURCE}
              onChange={(e) => setForm({ ...form, sourceModule: e.target.value === MANUAL_SOURCE ? "" : e.target.value, sourceId: "" })}
              options={[{ id: MANUAL_SOURCE, name: "Manual entry (no document)" }, ...toSelectOptions(sourceModules)]}
              includeEmptyOption={false}
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
              ENTRY_NUMBER_FROM_BACKEND && <div className="hidden md:block" />
            )}
            <div className="md:col-span-2">
              <AutoGrowTextarea label="Description" name="description" value={form.description || ""} onChange={handleChange} required />
              <p className="-mt-3 mb-3 px-1 text-xs text-slate-400">Why is this entry made? e.g. Loan repayment – October EMI</p>
            </div>
          </div>

          {/* Already posted for this document? */}
          {form.sourceId && (
            <div
              className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
                sourceEntries.length
                  ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  : "border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100"
              }`}
            >
              {sourceLoading
                ? "Checking existing entries for this document…"
                : sourceEntries.length === 0
                  ? "No ledger entries posted for this document yet."
                  : `⚠ This document already has ${sourceEntries.length} ledger entr${sourceEntries.length === 1 ? "y" : "ies"}: ${sourceEntries
                      .map((s) => `${s.entryNumber || `#${s.id}`} (${formatMoney(totalDebitOf(s))})`)
                      .join(", ")}. Make sure you are not posting it twice.`}
            </div>
          )}

          {/* Lines */}
          <div className="mt-2 border-t border-slate-100 pt-4 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Entry Lines</h3>
              <span className="text-xs text-slate-400">Each line is a debit or a credit</span>
            </div>

            <div className="space-y-2">
              {lines.map((line, index) => {
                const account = accountById(line.generalAccountId);
                const side = toPaise(line.debit) > 0 ? "Dr" : toPaise(line.credit) > 0 ? "Cr" : "";
                return (
                  <div
                    key={line.key}
                    className={`rounded-xl border p-3 pb-1 transition-colors ${
                      side === "Dr"
                        ? "border-l-4 border-slate-200 border-l-cyan-500 dark:border-gray-700"
                        : side === "Cr"
                          ? "border-l-4 border-slate-200 border-l-amber-500 dark:border-gray-700"
                          : "border-slate-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        Line {index + 1}
                        {side && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${side === "Dr" ? "bg-cyan-50 text-cyan-700" : "bg-amber-50 text-amber-700"}`}>
                            {side === "Dr" ? "DEBIT" : "CREDIT"}
                          </span>
                        )}
                        {account?.accountType && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_TONES[account.accountType] || "border-gray-200 bg-gray-50 text-gray-600"}`}>
                            {TYPE_LABELS[account.accountType] || account.accountType}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        disabled={lines.length <= 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title={lines.length <= 1 ? "At least one line is needed" : "Remove line"}
                        aria-label="Remove line"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-x-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                      <SearchableSelect
                        label="Account"
                        value={line.generalAccountId}
                        options={accountOptions}
                        onChange={(value: string | number) => updateLine(line.key, { generalAccountId: String(value ?? "") })}
                        placeholder={accounts.length ? "Search by name, code or type" : "No accounts loaded"}
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
                    </div>
                    <FloatingInput
                      label="Narration (optional)"
                      name={`narration-${line.key}`}
                      value={line.narration}
                      onChange={(e) => updateLine(line.key, { narration: e.target.value })}
                      maxLength={255}
                    />
                    {lineEffect(line) && <p className="-mt-3 mb-2 px-1 text-xs font-medium">{lineEffect(line)}</p>}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setLines((current) => [...current, newLine()])}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                <PlusIcon className="h-3.5 w-3.5" /> Add Line
              </button>
              {totals.difference !== 0 && (totals.debit > 0 || totals.credit > 0) && (
                <button type="button" onClick={addBalancingLine} className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800">
                  <ScaleIcon className="h-3.5 w-3.5" />
                  Add {totals.difference > 0 ? "credit" : "debit"} line of {formatMoney(fromPaise(Math.abs(totals.difference)))} to balance
                </button>
              )}
            </div>

            {/* Running totals */}
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
