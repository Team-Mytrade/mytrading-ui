import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { DocumentTextIcon, LockClosedIcon, PencilSquareIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { FloatingInput, FloatingSelect1, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import {
  GeneralAccount,
  INVOICE_API,
  JournalEntry,
  SOURCE_MODULE_OPTIONS,
  AUTOMATIC_SOURCE_OPTIONS,
  accountLabel,
  apiError,
  dateLabel,
  labelOf,
  money,
  todayInput,
} from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import { companyCurrency } from "../../company/format";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/journal-entries`;
const PAGE_SIZE = 10;

interface LineForm {
  generalAccountId: string;
  debit: string;
  credit: string;
  narration: string;
}

const blankLine = (): LineForm => ({ generalAccountId: "", debit: "", credit: "", narration: "" });

const emptyForm = () => ({ entryDate: todayInput(), description: "", sourceModule: "OTHER", sourceId: "" });

const totalOf = (entry: JournalEntry) => (entry.entries ?? []).reduce((sum, line) => sum + Number(line.debit || 0), 0);

// Amounts compared in paise so 0.1 + 0.2 balances against 0.3
const paise = (value: string | number) => Math.round(Number(value || 0) * 100);

const JournalEntries: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [viewing, setViewing] = useState<JournalEntry | null>(null);
  // A document in another currency: its own amounts are shown under each line
  const foreign = !!viewing?.currency && viewing.currency !== companyCurrency() && viewing.exchangeRate != null;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [lines, setLines] = useState<LineForm[]>([blankLine(), blankLine()]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<JournalEntry | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [entryRes, accountRes] = await Promise.all([
        axios.get<JournalEntry[]>(API_URL),
        axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`),
      ]);
      setEntries(Array.isArray(entryRes.data) ? entryRes.data : []);
      const accountList = Array.isArray(accountRes.data) ? accountRes.data : [];
      setAccounts([...accountList].sort((a, b) => a.accountCode.localeCompare(b.accountCode)));
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load journal entries"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Only active accounts that accept postings, plus whatever an edited entry already uses
  const accountOptions = useMemo(() => {
    const used = new Set(lines.map((line) => line.generalAccountId));
    return accounts
      .filter((account) => (account.isActive !== false && account.allowTransactions !== false) || used.has(String(account.id)))
      .map((account) => ({ id: String(account.id), name: accountLabel(account) }));
  }, [accounts, lines]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + paise(line.debit), 0);
    const credit = lines.reduce((sum, line) => sum + paise(line.credit), 0);
    return { debit: debit / 100, credit: credit / 100, difference: (debit - credit) / 100 };
  }, [lines]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setLines([blankLine(), blankLine()]);
    setFormOpen(true);
  };

  const openEdit = (entry: JournalEntry) => {
    // Lines from older servers carry only the account code
    const idOf = (line: JournalEntry["entries"][number]) =>
      line.generalAccountId ?? accounts.find((account) => account.accountCode === line.accountCode)?.id;
    setEditing(entry);
    setViewing(null);
    setForm({
      entryDate: entry.entryDate ?? todayInput(),
      description: entry.description ?? "",
      sourceModule: entry.sourceModule ?? "OTHER",
      sourceId: entry.sourceId != null ? String(entry.sourceId) : "",
    });
    setLines(
      (entry.entries ?? []).map((line) => ({
        generalAccountId: idOf(line) != null ? String(idOf(line)) : "",
        debit: Number(line.debit) ? String(line.debit) : "",
        credit: Number(line.credit) ? String(line.credit) : "",
        narration: line.narration ?? "",
      }))
    );
    setFormOpen(true);
  };

  const updateLine = (index: number, patch: Partial<LineForm>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const filled = lines.filter((line) => line.generalAccountId || Number(line.debit) || Number(line.credit));
    if (filled.length < 2) return ToasterService.error("An entry needs at least two lines: one debit and one credit");
    const problem = filled.findIndex(
      (line) => !line.generalAccountId || (Number(line.debit) > 0) === (Number(line.credit) > 0) || Number(line.debit) < 0 || Number(line.credit) < 0
    );
    if (problem >= 0) return ToasterService.error(`Line ${problem + 1}: choose the account and enter either a debit or a credit`);
    if (totals.difference !== 0) return ToasterService.error(`Debits and credits differ by ${money(Math.abs(totals.difference))}`);

    const payload = {
      entryDate: form.entryDate || null,
      description: form.description.trim() || null,
      sourceModule: form.sourceModule || null,
      sourceId: form.sourceId ? Number(form.sourceId) : null,
      entries: filled.map((line) => ({
        generalAccountId: Number(line.generalAccountId),
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        narration: line.narration.trim() || null,
      })),
    };
    setBusy(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/${editing.id}`, payload);
        ToasterService.success(`${editing.entryNumber} updated`);
      } else {
        const res = await axios.post<JournalEntry>(API_URL, payload);
        ToasterService.success(`${res.data?.entryNumber ?? "Journal entry"} posted`);
      }
      setFormOpen(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the journal entry"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${deleting.id}`);
      ToasterService.success(`${deleting.entryNumber} deleted`);
      setDeleting(null);
      setViewing(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the journal entry"));
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(
    () => (sourceFilter === "ALL" ? entries : entries.filter((entry) => (entry.sourceModule ?? "OTHER") === sourceFilter)),
    [entries, sourceFilter]
  );

  const stats = useMemo(() => {
    const month = todayInput().slice(0, 7);
    const thisMonth = entries.filter((entry) => entry.entryDate?.startsWith(month));
    return {
      count: entries.length,
      thisMonth: thisMonth.length,
      postedThisMonth: thisMonth.reduce((sum, entry) => sum + totalOf(entry), 0),
      accounts: accounts.filter((account) => account.isActive !== false).length,
    };
  }, [entries, accounts]);

  const columns: ColumnDef<JournalEntry>[] = [
    {
      key: "entryNumber",
      label: "Entry",
      sortable: true,
      render: (row) => <span className="text-sm font-semibold text-slate-900">{row.entryNumber}</span>,
    },
    { key: "entryDate", label: "Date", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.entryDate)}</span> },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.description || "—"}
          <span className="block text-xs text-slate-400">
            {(row.entries ?? []).map((line) => line.accountName).filter(Boolean).slice(0, 3).join(", ")}
            {(row.entries ?? []).length > 3 ? "…" : ""}
          </span>
        </span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-600">
          {labelOf(row.sourceModule ?? "OTHER")}
          {row.automatic && (
            <span className="ml-1.5 rounded-full bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700" title={t("Posted automatically from the document")}>
              {t(row.reversalOf ? "Auto · reversal" : "Auto")}
            </span>
          )}
          {row.sourceId != null && <span className="block text-xs text-slate-400">#{row.sourceId}</span>}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: totalOf,
      render: (row) => <span className="text-sm font-semibold text-slate-900">{money(totalOf(row))}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
          {row.automatic && (
            <span className="p-1.5 text-slate-300" title={t("Posted automatically: correct or cancel the document instead")}>
              <LockClosedIcon className="h-4 w-4" />
            </span>
          )}
          {canUpdate && !row.automatic && (
            <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit entry")}>
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && !row.automatic && (
            <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title={t("Delete entry")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Journal Entries")} description="Double-entry postings to the general ledger" />
      <PageBreadcrumb pageTitle="Journal Entries" actions={canCreate ? <AddButton onClick={openCreate} label={t("New journal entry")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Entries")} value={stats.count} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("This month")} value={stats.thisMonth} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Posted this month")} value={money(stats.postedThisMonth)} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label={t("Active accounts")} value={stats.accounts} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ id: "ALL", name: "All sources" }, ...SOURCE_MODULE_OPTIONS, ...AUTOMATIC_SOURCE_OPTIONS].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSourceFilter(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${sourceFilter === option.id ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.name}
            </button>
          ))}
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          loading={loading}
          onRowClick={(row) => setViewing(row)}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <DocumentTextIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No journal entries yet")}</p>
              {accounts.length === 0 && <p className="text-xs text-gray-400">{t("Set up the chart of accounts under General Accounts first.")}</p>}
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={Boolean(viewing)}
        title={viewing?.entryNumber ?? ""}
        subtitle={`${dateLabel(viewing?.entryDate)} · ${labelOf(viewing?.sourceModule ?? "OTHER")}${viewing?.sourceId != null ? ` #${viewing.sourceId}` : ""}`}
        onClose={() => setViewing(null)}
        maxWidthClassName="max-w-3xl"
        content={
          viewing ? (
            <div className="space-y-3 px-4 py-4 sm:px-5">
              {viewing.description && <p className="text-sm text-slate-700">{viewing.description}</p>}
              {foreign && (
                <p className="text-xs text-slate-500">
                  {t("A {currency} document booked at 1 {currency} = {rate} {company}; amounts are in {company}, the document's own under each line.", { currency: viewing.currency ?? "", rate: Number(viewing.exchangeRate), company: companyCurrency() })}
                </p>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">{t("Account")}</th>
                      <th className="px-3 py-2 text-left">{t("Narration")}</th>
                      <th className="px-3 py-2 text-right">{t("Debit")}</th>
                      <th className="px-3 py-2 text-right">{t("Credit")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(viewing.entries ?? []).map((line, index) => (
                      <tr key={line.id ?? index}>
                        <td className="px-3 py-2 font-medium text-slate-800">{accountLabel({ accountCode: line.accountCode ?? "", accountName: line.accountName ?? "" })}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {line.narration || "—"}
                          {foreign && line.currencyAmount != null && (
                            <span className="block text-xs text-slate-400">{money(Math.abs(Number(line.currencyAmount)), viewing.currency)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{Number(line.debit) ? money(line.debit) : ""}</td>
                        <td className="px-3 py-2 text-right">{Number(line.credit) ? money(line.credit) : ""}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2" colSpan={2}>{t("Total")}</td>
                      <td className="px-3 py-2 text-right">{money(totalOf(viewing))}</td>
                      <td className="px-3 py-2 text-right">{money((viewing.entries ?? []).reduce((sum, line) => sum + Number(line.credit || 0), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {viewing.automatic && (
                <p className="rounded-lg bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                  {t("Posted automatically")}{viewing.reversalOf ? " to reverse an earlier entry" : ""}. It follows its document: to change
                  it, correct, cancel or reverse the document.
                </p>
              )}
              <div className="flex justify-end gap-2">
                {canDelete && !viewing.automatic && (
                  <button type="button" onClick={() => setDeleting(viewing)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                    {t("Delete")}
                  </button>
                )}
                {canUpdate && !viewing.automatic && (
                  <button type="button" onClick={() => openEdit(viewing)} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700">
                    {t("Edit")}
                  </button>
                )}
              </div>
            </div>
          ) : null
        }
      />

      <PaginatedPopup
        isOpen={formOpen}
        title={editing ? `${t("Edit")} ${editing.entryNumber}` : t("New journal entry")}
        subtitle={t(editing ? "Saving replaces the entry's lines" : "The entry number is assigned when it is posted")}
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-4xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <FloatingInput label={t("Date")} name="entryDate" type="date" value={form.entryDate}
                  onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))} />
                <FloatingSelect1 label={t("Source")} name="sourceModule" value={form.sourceModule} options={SOURCE_MODULE_OPTIONS} includeEmptyOption={false}
                  onChange={(event) => setForm((current) => ({ ...current, sourceModule: event.target.value }))} />
                <FloatingInput label={t("Source document id (optional)")} name="sourceId" type="number" value={form.sourceId}
                  onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))} />
              </div>
              <FloatingTextarea label={t("Description")} name="description" rows={2} value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />

              <div className="space-y-2">
                <div className="hidden grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid">
                  <span>{t("Account")}</span>
                  <span className="text-right">{t("Debit")}</span>
                  <span className="text-right">{t("Credit")}</span>
                  <span>{t("Narration")}</span>
                  <span className="w-7" />
                </div>
                {lines.map((line, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:border-0 sm:p-0">
                    <FloatingSelect1 label={t("Account")} name={`account_${index}`} value={line.generalAccountId} options={accountOptions}
                      onChange={(event) => updateLine(index, { generalAccountId: event.target.value })} />
                    <FloatingInput label={t("Debit")} name={`debit_${index}`} type="number" value={line.debit}
                      onChange={(event) => updateLine(index, { debit: event.target.value, credit: event.target.value ? "" : line.credit })} />
                    <FloatingInput label={t("Credit")} name={`credit_${index}`} type="number" value={line.credit}
                      onChange={(event) => updateLine(index, { credit: event.target.value, debit: event.target.value ? "" : line.debit })} />
                    <FloatingInput label={t("Narration")} name={`narration_${index}`} value={line.narration}
                      onChange={(event) => updateLine(index, { narration: event.target.value })} />
                    <button
                      type="button"
                      disabled={lines.length <= 2}
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      className="self-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      title={t("Remove line")}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <button type="button" onClick={() => setLines((current) => [...current, blankLine()])} className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline">
                    <PlusIcon className="h-3.5 w-3.5" /> {t("Add line")}
                  </button>
                  <span className={`text-sm font-medium ${totals.difference === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                    {t("Debit")} {money(totals.debit)} · Credit {money(totals.credit)}
                    {totals.difference !== 0 && ` · off by ${money(Math.abs(totals.difference))}`}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={t(editing ? "Save changes" : "Post entry")} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("Delete journal entry")}
        message={`Delete ${deleting?.entryNumber ?? "this entry"} (${money(deleting ? totalOf(deleting) : 0)})? Its postings leave the ledger.`}
        confirmLabel={t("Delete")}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
};

export default JournalEntries;
