import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, DocumentTextIcon, XMarkIcon, PlusIcon, ScaleIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { statusFieldCards, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingInput, FloatingDatePicker, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import SearchableSelect from "../../components/inputfeild/SearchableSelect";
import { toSelectOptions, useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";
import { todayIso } from "../../utils/localDate";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/journal-entries)       */
/* ------------------------------------------------------------------ */

/** One line as returned by GET. Note: GET gives accountCode/accountName, not generalAccountId. */
interface JournalLineResponse {
  id?: number;
  generalAccountId?: number; // only if the backend adds it to the response
  accountCode?: string;
  accountName?: string;
  debit?: number;
  credit?: number;
  narration?: string;
}

interface JournalEntry {
  id: number;
  entryNumber?: string;
  entryDate?: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
  entries?: JournalLineResponse[];
}

/** What POST / PUT accept. createdBy and tenantId are set by the server, so they are not sent. */
interface JournalEntryPayload {
  entryNumber?: string;
  entryDate: string;
  description?: string;
  sourceModule?: string;
  sourceId?: number;
  entries: { id?: number; generalAccountId: number; debit: number; credit: number; narration?: string }[];
}

interface GeneralAccount {
  id: number;
  accountCode?: string;
  accountName?: string;
  accountType?: string;
}

/** A line while the user edits it (inputs hold text). */
interface LineForm {
  key: string;
  id?: number;
  generalAccountId: string;
  debit: string;
  credit: string;
  narration: string;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/journal-entries";
const ACCOUNTS_URL = "/v1/api/invoice/general-accounts";
const PAGE_SIZE = 10;

/**
 * Confirmed 22 Oct: the backend ignores a typed entry number and returns its own (JE-2026-001).
 * So the field is hidden on Create and read-only on Edit.
 */
const ENTRY_NUMBER_FROM_BACKEND = true;

/** Dropdown value for "no source document". Never sent: the payload gets no sourceModule. */
const MANUAL_SOURCE = "__MANUAL__";

const SOURCE_MODULE_FALLBACK =["SALES_INVOICE", "PURCHASE_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "ADJUSTMENT_NOTE", "OTHER"];

const sourceTones: Record<string, string> = {
  SALES_INVOICE: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  PURCHASE_INVOICE: "bg-blue-50 text-blue-700 border-blue-200/40",
  CREDIT_NOTE: "bg-purple-50 text-purple-700 border-purple-200/40",
  DEBIT_NOTE: "bg-orange-50 text-orange-700 border-orange-200/40",
  ADJUSTMENT_NOTE: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
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

let lineCounter = 0;
const newLine = (patch: Partial<LineForm> = {}): LineForm => ({
  key: `line-${++lineCounter}`,
  generalAccountId: "",
  debit: "",
  credit: "",
  narration: "",
  ...patch,
});

/** Rupees → paise, so 0.1 + 0.2 adds up exactly (no floating-point errors). */
const toPaise = (value: string | number | undefined) => Math.round((Number(value) || 0) * 100);
const fromPaise = (paise: number) => paise / 100;

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const totalDebitOf = (entry: JournalEntry) => fromPaise((entry.entries || []).reduce((sum, line) => sum + toPaise(line.debit), 0));

const accountLabel = (account: GeneralAccount) => [account.accountCode, account.accountName].filter(Boolean).join(" – ") || `Account ${account.id}`;
const lineAccountText = (line: JournalLineResponse) => [line.accountCode, line.accountName].filter(Boolean).join(" – ") || "Account";

/** "Bank Loan → Bank – HDFC": debit accounts, then credit accounts. */
const flowText = (entry: JournalEntry) => {
  const names = (side: "debit" | "credit") =>
    (entry.entries || []).filter((l) => toPaise(l[side]) > 0).map((l) => l.accountName || l.accountCode || "Account");
  const debits = names("debit");
  const credits = names("credit");
  const short = (list: string[]) => (list.length > 1 ? `${list[0]} +${list.length - 1}` : list[0] || "--");
  return `${short(debits)} → ${short(credits)}`;
};

/** Number box that blocks - + e E and ignores mouse-wheel scrolling. */
const amountInputProps = {
  type: "number" as const,
  min: 0,
  step: "0.01",
  inputMode: "decimal" as const,
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault(),
  onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur(),
};

/** Notes box that starts as one line and grows as you type (same as the Purchase pages). */
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

/** Looks like a disabled input. Used for the backend-generated entry number on Edit. */
const ReadOnlyField = ({ label, value }: { label: string; value?: string }) => (
  <div style={{ position: "relative", marginBottom: "20px", width: "100%" }}>
    <div className="flex h-[52px] cursor-default items-center rounded-md border border-gray-300 bg-gray-50 px-3 pt-3 text-base text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
      <span className="truncate">{value || ""}</span>
    </div>
    <span className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-white px-1 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
      {label}
    </span>
  </div>
);

/** Debit / credit lines of a saved entry, shown in the row details drawer. */
const LinesTable = ({ entry }: { entry: JournalEntry }) => {
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
              {/* Credit lines are indented, the usual way of writing a journal entry */}
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

const JournalEntries: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [form, setForm] = useState<Partial<JournalEntry>>({});
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sourceModules = useInvoiceEnum("SOURCE_MODULE", SOURCE_MODULE_FALLBACK);

  const fetchEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setEntries(asArray<JournalEntry>(res.data));
    } catch (err) {
      console.error("Error fetching journal entries", err);
      ToasterService.error("Failed to load journal entries");
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await axios.get(ACCOUNTS_URL);
      // Only active accounts that allow transactions can be picked (inactive ones stay for old entries' names)
      setAccounts(
        asArray<any>(res.data).map((a) => ({
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountType: a.accountType,
          isActive: a.isActive,
          allowTransactions: a.allowTransactions,
        }))
      );
    } catch (err) {
      console.error("Error fetching general accounts", err);
      ToasterService.error("Failed to load accounts for the Account dropdown");
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
    // Toolbar Refresh icon reloads the list and the accounts dropdown
    const reload = () => {
      fetchEntries();
      fetchAccounts();
    };
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
  }, [fetchEntries, fetchAccounts]);

  /* ---------------- Cards ---------------- */
  // Total + one card per source module found in the data
  const cards = useMemo(() => statusFieldCards(entries, (e) => e.sourceModule || "MANUAL", "Total Entries", 4), [entries]);
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(entries, cards);

  /* ---------------- Lookups ---------------- */
  const sourceLabel = (code?: string) => (code ? sourceModules.find((s) => s.code === code)?.label || code : "Manual");

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a: any) => a.isActive !== false && a.allowTransactions !== false)
        .map((a) => ({
          value: String(a.id),
          label: `${accountLabel(a)}${a.accountType ? ` (${TYPE_LABELS[a.accountType] || a.accountType})` : ""}`,
          keywords: [a.accountCode || "", a.accountType || ""],
        })),
    [accounts]
  );
  const accountById = (id: string) => accounts.find((a) => String(a.id) === id);

  /** GET gives accountCode, not generalAccountId: find the account id from the code. */
  const findAccountId = (line: JournalLineResponse) => {
    if (line.generalAccountId) return String(line.generalAccountId);
    const match = accounts.find(
      (a) => (line.accountCode && a.accountCode === line.accountCode) || (!line.accountCode && line.accountName && a.accountName === line.accountName)
    );
    return match ? String(match.id) : "";
  };

  /* ---------------- Form ---------------- */
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const updateLine = (key: string, patch: Partial<LineForm>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const removeLine = (key: string) => setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current));

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, l) => sum + toPaise(l.debit), 0);
    const credit = lines.reduce((sum, l) => sum + toPaise(l.credit), 0);
    return { debit, credit, difference: debit - credit };
  }, [lines]);

  const isBalanced = totals.debit > 0 && totals.difference === 0;

  /** New line on the short side with the missing amount, so the entry balances in one click. */
  const addBalancingLine = () => {
    const missing = Math.abs(totals.difference);
    if (!missing) return;
    const side = totals.difference > 0 ? { credit: String(fromPaise(missing)) } : { debit: String(fromPaise(missing)) };
    setLines((current) => {
      // Reuse an empty last line instead of adding another one
      const last = current[current.length - 1];
      if (last && !last.generalAccountId && !last.debit && !last.credit) {
        return current.map((l) => (l.key === last.key ? { ...l, ...side } : l));
      }
      return [...current, newLine(side)];
    });
  };

  /** "Bank – HDFC is an Asset, so this debit makes it go up". Teaches debit / credit while typing. */
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

  const openCreate = () => {
    setForm({ entryDate: todayIso() });
    setLines([newLine()]);
    setEditingId(null);
    setShowFormModal(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    setForm({ ...entry, entryDate: entry.entryDate?.slice(0, 10) });
    const loaded: LineForm[] = (entry.entries || []).map((line) =>
      newLine({
        id: line.id,
        generalAccountId: findAccountId(line),
        debit: line.debit ? String(line.debit) : "",
        credit: line.credit ? String(line.credit) : "",
        narration: line.narration || "",
      })
    );
    if (!loaded.length) loaded.push(newLine());
    setLines(loaded);
    setEditingId(entry.id);
    setShowFormModal(true);

    const unmatched = (entry.entries || []).filter((line) => !findAccountId(line));
    if (unmatched.length) ToasterService.error(`Could not find the account for ${unmatched.length} line(s). Please choose the account again.`);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
    setLines([newLine()]);
  };

  /** Returns an error message, or null when the entry is valid. */
  const validate = (): string | null => {
    if (!ENTRY_NUMBER_FROM_BACKEND && !form.entryNumber?.trim()) return "Entry number is required";
    if (!form.entryDate) return "Entry date is required";
    if (form.entryDate > todayIso()) return "Entry date cannot be in the future";
    if (!form.description?.trim()) return "Description is required – say why this entry is made";

    // Ignore completely empty rows
    const filled = lines.filter((l) => l.generalAccountId || l.debit || l.credit || l.narration.trim());
    if (filled.length < 2) return "A journal entry needs at least 2 lines (one debit and one credit)";

    for (const line of filled) {
      const row = `Line ${lines.indexOf(line) + 1}`;
      const debit = toPaise(line.debit);
      const credit = toPaise(line.credit);
      if (!line.generalAccountId) return `${row}: choose an account`;
      if (debit > 0 && credit > 0) return `${row}: enter either a debit or a credit, not both`;
      if (debit === 0 && credit === 0) return `${row}: enter a debit or a credit amount`;
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
    if (error) {
      ToasterService.error(error);
      return;
    }

    const filled = lines.filter((l) => l.generalAccountId);
    const payload: JournalEntryPayload = {
      ...(ENTRY_NUMBER_FROM_BACKEND
        ? editingId !== null && form.entryNumber
          ? { entryNumber: form.entryNumber }
          : {}
        : { entryNumber: form.entryNumber?.trim() }),
      entryDate: form.entryDate as string,
      description: form.description?.trim() || undefined,
      // Empty = an entry typed by hand (no source document)
      sourceModule: form.sourceModule || undefined,
      // Source ID is not entered by the user. On Edit, the existing value is sent back so it is not lost.
      sourceId: editingId !== null && form.sourceId ? Number(form.sourceId) : undefined,
      entries: filled.map((l) => ({
        ...(editingId !== null && l.id ? { id: l.id } : {}),
        generalAccountId: Number(l.generalAccountId),
        debit: fromPaise(toPaise(l.debit)),
        credit: fromPaise(toPaise(l.credit)),
        narration: l.narration.trim() || undefined,
      })),
    };

    setSubmitting(true);
    try {
      const res = editingId !== null ? await axios.put(`${API_URL}/${editingId}`, payload) : await axios.post(API_URL, payload);
      if (res.status === 200 || res.status === 201) {
        const number = res.data?.entryNumber ? ` ${res.data.entryNumber}` : "";
        ToasterService.success(editingId !== null ? `Journal entry${number} updated` : `Journal entry${number} created`);
        closeModal();
        await fetchEntries();
      }
    } catch (err: any) {
      console.error("Error submitting journal entry", err);
      ToasterService.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to save journal entry");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Delete ---------------- */
  const handleDelete = (entry: JournalEntry) => {
    setEntryToDelete(entry);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${entryToDelete.id}`);
      ToasterService.success("Journal entry deleted successfully!");
      setShowDeletePopup(false);
      setEntryToDelete(null);
      fetchEntries();
    } catch (err: any) {
      console.error("Error deleting journal entry", err);
      ToasterService.error(err?.response?.data?.message || "Failed to delete journal entry");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- Table ---------------- */
  const tableColumns: ColumnDef<JournalEntry>[] = [
    {
      key: "entryNumber",
      label: "Entry Number",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (entry) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="truncate text-sm font-semibold leading-snug text-slate-900">{entry.entryNumber || "--"}</span>
        </div>
      ),
    },
    {
      key: "entryDate",
      label: "Date",
      sortable: true,
      headerClassName: "w-[11%] text-left",
      className: "w-[11%]",
      exportValueGetter: (entry) => (entry.entryDate ? formatDisplayDate(entry.entryDate) : ""),
      render: (entry) => <span className="text-sm text-slate-600">{entry.entryDate ? formatDisplayDate(entry.entryDate) : "--"}</span>,
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[22%] text-left",
      className: "w-[22%]",
      render: (entry) => (
        <span className="block truncate text-sm text-slate-600" title={entry.description}>
          {entry.description || "--"}
        </span>
      ),
    },
    {
      // Which accounts the money moved between: debit side → credit side.
      // In the details drawer it shows the full debit / credit table.
      key: "flow",
      label: "Accounts (Dr → Cr)",
      sortable: false,
      filterable: false,
      headerClassName: "w-[22%] text-left",
      className: "w-[22%]",
      exportValueGetter: (entry) => flowText(entry),
      detailFormatter: (entry) => <LinesTable entry={entry} />,
      render: (entry) => (
        <span className="block truncate text-sm text-slate-600" title={flowText(entry)}>
          {flowText(entry)}
        </span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      filterOptions: sourceModules.map((s) => ({ label: s.label, value: s.code })),
      detailFormatter: (entry) => sourceLabel(entry.sourceModule),
      exportValueGetter: (entry) => sourceLabel(entry.sourceModule),
      render: (entry) => (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sourceTones[entry.sourceModule || ""] || "border-gray-200/40 bg-gray-50 text-gray-700"}`}>
          {sourceLabel(entry.sourceModule)}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      headerClassName: "w-[10%] text-right",
      className: "w-[10%] text-right",
      filterable: false,
      sortValueGetter: (entry) => totalDebitOf(entry),
      exportValueGetter: (entry) => formatMoney(totalDebitOf(entry)),
      render: (entry) => <span className="text-sm font-semibold text-slate-700">{formatMoney(totalDebitOf(entry))}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[8%] text-right pr-4",
      className: "w-[8%] text-right",
      render: (entry) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => handleEdit(entry)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title="Edit Journal Entry">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => handleDelete(entry)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600" title="Delete Journal Entry">
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Journal Entries" description="Manage invoice journal entries" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Journal Entries"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Journal Entry" onClick={openCreate} /> : undefined}
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
            rowDetailsTitle={(entry) => `Journal Entry ${entry.entryNumber || ""}`.trim()}
            rowDetailsSubtitle="Debit and credit lines of this entry"
            // The raw `entries` list is replaced by the Dr / Cr table of the "Accounts" column
            hiddenDetailKeys={["sourceId", "entries"]}
            suspendRowDetails={showFormModal}
            rowDetailsActions={(entry: JournalEntry) =>
              canUpdate ? (
                <button type="button" onClick={() => handleEdit(entry)} className={ICON_BUTTON_CLASS} title="Edit" aria-label="Edit this record">
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No journal entries found</p>
                {selected !== "ALL" ? (
                  <p className="text-xs text-gray-400">Click the selected card again to show all entries</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={() => openCreate()} className="mt-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
                      Create your first journal entry
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        {/* Drawer, because of the line items */}
        <Dragger
          isOpen={showFormModal}
          title={editingId !== null ? `Edit Journal Entry ${form.entryNumber || ""}`.trim() : "Add Journal Entry"}
          subtitle="Money moves from the credit account(s) to the debit account(s). Both totals must be equal."
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          {/* Header fields */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ENTRY_NUMBER_FROM_BACKEND && editingId !== null && (
              <div className="md:col-span-2">
                <ReadOnlyField label="Entry Number" value={form.entryNumber} />
              </div>
            )}
            {!ENTRY_NUMBER_FROM_BACKEND && (
              <div className="md:col-span-2">
                <FloatingInput label="Entry Number" name="entryNumber" value={form.entryNumber || ""} onChange={handleChange} maxLength={50} required />
              </div>
            )}
            {/* The day the money moved (can be earlier than today, never later) */}
            <FloatingDatePicker label="Entry Date" name="entryDate" value={form.entryDate || ""} onChange={handleChange} maxDate={todayIso()} required />
            {/* "Manual entry" is a real option (not the empty one), so the label floats above it instead of overlapping */}
            <FloatingSelect
              label="Source"
              name="sourceModule"
              value={form.sourceModule || MANUAL_SOURCE}
              onChange={(e) => setForm({ ...form, sourceModule: e.target.value === MANUAL_SOURCE ? "" : e.target.value })}
              options={[{ id: MANUAL_SOURCE, name: "Manual entry (no document)" }, ...toSelectOptions(sourceModules)]}
              includeEmptyOption={false}
            />
            <div className="md:col-span-2">
              <AutoGrowTextarea
                label="Description"
                name="description"
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
              <p className="-mt-3 mb-3 px-1 text-xs text-slate-400">Why is this entry made? e.g. Loan repayment – October EMI</p>
            </div>
          </div>

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
                        // A line is either debit or credit: typing a debit clears the credit
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
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    isBalanced ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
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

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Journal Entry"
          subText={
            entryToDelete
              ? `Are you sure you want to delete "${entryToDelete.entryNumber}"? This action cannot be undone.`
              : "Are you sure you want to delete this journal entry?"
          }
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setEntryToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default JournalEntries;
