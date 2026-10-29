import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BuildingOffice2Icon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
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
import { ACCOUNT_TYPE_OPTIONS, GeneralAccount, INVOICE_API, apiError, isDebitNormal, labelOf, money } from "./invoiceShared";
import { DialogFooter, StatusBadge } from "./invoiceUi";
import { companyCurrency, currencyChoices } from "../../company/format";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/general-accounts`;
const PAGE_SIZE = 15;

// The invoice service's Currency enum
const currencyOptions = (stored?: string) => currencyChoices(stored).map((id) => ({ id, name: id }));

const TYPE_TONES: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-700 border-blue-200/60",
  LIABILITY: "bg-red-50 text-red-700 border-red-200/60",
  EQUITY: "bg-purple-50 text-purple-700 border-purple-200/60",
  INCOME: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  EXPENSE: "bg-orange-50 text-orange-700 border-orange-200/60",
};

// A small starting chart for a trading business; codes follow the usual 1xxx–5xxx ranges
const STARTER_ACCOUNTS: [string, string, string][] = [
  ["1000", "Cash in hand", "ASSET"],
  ["1010", "Bank", "ASSET"],
  ["1100", "Accounts receivable", "ASSET"],
  ["1200", "Inventory", "ASSET"],
  ["1300", "GST input credit", "ASSET"],
  ["2000", "Accounts payable", "LIABILITY"],
  ["2100", "GST payable", "LIABILITY"],
  ["3000", "Owner's capital", "EQUITY"],
  ["3100", "Retained earnings", "EQUITY"],
  ["4000", "Sales", "INCOME"],
  ["4100", "Other income", "INCOME"],
  ["5000", "Cost of goods sold", "EXPENSE"],
  ["5100", "Freight and delivery", "EXPENSE"],
  ["5200", "Rent", "EXPENSE"],
  ["5300", "Salaries and wages", "EXPENSE"],
  ["5400", "Utilities", "EXPENSE"],
  ["5900", "Miscellaneous expenses", "EXPENSE"],
];

const emptyForm = () => ({
  accountCode: "",
  accountName: "",
  accountType: "",
  currency: companyCurrency(),
  openingBalance: "",
  description: "",
  isActive: true,
  allowTransactions: true,
});

const Toggle = ({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) => (
  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
    <span className="text-sm text-slate-700">
      {label}
      <span className="block text-xs text-slate-500">{hint}</span>
    </span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500" />
  </label>
);

const GeneralAccounts: React.FC = () => {
  const navigate = useNavigate();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GeneralAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<GeneralAccount | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<GeneralAccount[]>(API_URL);
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (account: GeneralAccount) => {
    setEditing(account);
    setForm({
      accountCode: account.accountCode ?? "",
      accountName: account.accountName ?? "",
      accountType: account.accountType ?? "",
      currency: account.currency || companyCurrency(),
      openingBalance: account.openingBalance != null ? String(account.openingBalance) : "",
      description: account.description ?? "",
      isActive: account.isActive !== false,
      allowTransactions: account.allowTransactions !== false,
    });
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.accountCode.trim()) return ToasterService.error("Enter the account code");
    if (!form.accountName.trim()) return ToasterService.error("Enter the account name");
    if (!form.accountType) return ToasterService.error("Choose the account type");
    const payload = {
      accountCode: form.accountCode.trim(),
      accountName: form.accountName.trim(),
      accountType: form.accountType,
      currency: form.currency || null,
      openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
      description: form.description.trim() || null,
      isActive: form.isActive,
      allowTransactions: form.allowTransactions,
    };
    setBusy(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/${editing.id}`, payload);
        ToasterService.success(`${payload.accountCode} updated`);
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success(`${payload.accountCode} ${payload.accountName} added`);
      }
      setFormOpen(false);
      await fetchAccounts();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the account"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${deleting.id}`);
      ToasterService.success(`${deleting.accountCode} deleted`);
      setDeleting(null);
      await fetchAccounts();
    } catch (err) {
      setDeleting(null);
      ToasterService.error(apiError(err, "Could not delete the account"));
    } finally {
      setBusy(false);
    }
  };

  // Adds the starter accounts one by one; codes that already exist are skipped
  const seedStarterChart = async () => {
    setSeeding(true);
    const existing = new Set(accounts.map((account) => account.accountCode.toUpperCase()));
    let added = 0;
    try {
      for (const [accountCode, accountName, accountType] of STARTER_ACCOUNTS) {
        if (existing.has(accountCode)) continue;
        await axios.post(API_URL, { accountCode, accountName, accountType, currency: companyCurrency(), openingBalance: 0, isActive: true, allowTransactions: true });
        added++;
      }
      ToasterService.success(`${added} accounts added`);
    } catch (err) {
      ToasterService.error(apiError(err, `Stopped after ${added} accounts`));
    } finally {
      setSeeding(false);
      await fetchAccounts();
    }
  };

  const filtered = useMemo(() => {
    if (typeFilter === "ALL") return accounts;
    if (typeFilter === "INACTIVE") return accounts.filter((account) => account.isActive === false);
    return accounts.filter((account) => account.accountType === typeFilter);
  }, [accounts, typeFilter]);

  const stats = useMemo(
    () => ({
      total: accounts.length,
      active: accounts.filter((account) => account.isActive !== false).length,
      posting: accounts.filter((account) => account.isActive !== false && account.allowTransactions !== false).length,
      inactive: accounts.filter((account) => account.isActive === false).length,
    }),
    [accounts]
  );

  const columns: ColumnDef<GeneralAccount>[] = [
    { key: "accountCode", label: "Code", sortable: true, render: (row) => <span className="font-mono text-sm font-semibold text-slate-900">{row.accountCode}</span> },
    {
      key: "accountName",
      label: "Account",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-800">
          <span className="font-medium">{row.accountName}</span>
          {row.description && <span className="block text-xs text-slate-400">{row.description}</span>}
        </span>
      ),
    },
    { key: "accountType", label: "Type", sortable: true, render: (row) => <StatusBadge status={row.accountType} tones={TYPE_TONES} /> },
    {
      key: "openingBalance",
      label: "Opening balance",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.openingBalance || 0),
      render: (row) => (
        <span className="text-sm text-slate-600">
          {money(row.openingBalance, row.currency)}
          {Number(row.openingBalance) ? <span className="ml-1 text-xs text-slate-400">{t(isDebitNormal(row.accountType) ? "Dr" : "Cr")}</span> : null}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      sortValueGetter: (row) => (row.isActive === false ? 1 : 0),
      render: (row) => (
        <span className="text-sm">
          {row.isActive === false ? (
            <span className="text-slate-400">{t("Inactive")}</span>
          ) : row.allowTransactions === false ? (
            <span className="text-amber-700">{t("Header (no postings)")}</span>
          ) : (
            <span className="text-emerald-700">{t("Active")}</span>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
          {canUpdate && (
            <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit account")}>
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title={t("Delete account")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("General Accounts")} description="The chart of accounts" />
      <PageBreadcrumb pageTitle="General Accounts" actions={canCreate ? <AddButton onClick={openCreate} label={t("Add account")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Accounts")} value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Active")} value={stats.active} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Accept postings")} value={stats.posting} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label={t("Inactive")} value={stats.inactive} gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ id: "ALL", name: "All" }, ...ACCOUNT_TYPE_OPTIONS.filter((option) => option.id !== "OTHER"), { id: "INACTIVE", name: "Inactive" }].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTypeFilter(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${typeFilter === option.id ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
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
          defaultSortKey="accountCode"
          defaultSortOrder="asc"
          onRowClick={(row) => navigate("/generalLedger", { state: { accountId: row.id } })}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BuildingOffice2Icon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No accounts yet")}</p>
              {canCreate && accounts.length === 0 && (
                <button
                  type="button"
                  disabled={seeding}
                  onClick={seedStarterChart}
                  className="mt-2 rounded-lg border border-cyan-200 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                >
                  {seeding ? t("Adding accounts…") : `Start with a standard chart (${STARTER_ACCOUNTS.length} accounts)`}
                </button>
              )}
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title={editing ? `${t("Edit")} ${editing.accountCode}` : t("Add account")}
        subtitle={t("Codes are unique within your company")}
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingInput label={t("Code")} name="accountCode" required value={form.accountCode}
                onChange={(event) => setForm((current) => ({ ...current, accountCode: event.target.value }))} />
              <FloatingInput label={t("Name")} name="accountName" required value={form.accountName}
                onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))} />
              <FloatingSelect1 label={t("Type")} name="accountType" required value={form.accountType} options={ACCOUNT_TYPE_OPTIONS}
                onChange={(event) => setForm((current) => ({ ...current, accountType: event.target.value }))} />
              <FloatingSelect1 label={t("Currency")} name="currency" value={form.currency} options={currencyOptions(form.currency)}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))} />
              <FloatingInput label={t("Opening balance")} name="openingBalance" type="number" value={form.openingBalance}
                onChange={(event) => setForm((current) => ({ ...current, openingBalance: event.target.value }))} />
              <p className="self-center text-xs text-slate-500">
                {form.accountType
                  ? `${labelOf(form.accountType)} accounts hold a ${isDebitNormal(form.accountType) ? "debit" : "credit"} balance; enter it as a positive amount.`
                  : "Choose the type to see which side the balance sits on."}
              </p>
              <div className="sm:col-span-2">
                <FloatingTextarea label={t("Description")} name="description" rows={2} value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <Toggle label={t("Active")} hint={t("Inactive accounts are hidden from pickers")} checked={form.isActive}
                onChange={(isActive) => setForm((current) => ({ ...current, isActive }))} />
              <Toggle label={t("Accepts postings")} hint={t("Turn off for heading accounts that only group others")} checked={form.allowTransactions}
                onChange={(allowTransactions) => setForm((current) => ({ ...current, allowTransactions }))} />
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={t(editing ? "Save changes" : "Add account")} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("Delete account")}
        message={`Delete ${deleting?.accountCode ?? ""} ${deleting?.accountName ?? ""}? Accounts with postings can't be deleted; make them inactive instead.`}
        confirmLabel={t("Delete")}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
};

export default GeneralAccounts;
