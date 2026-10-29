import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { BuildingLibraryIcon, PencilSquareIcon, ScaleIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { companyCurrency } from "../../company/format";
import { GeneralAccount, INVOICE_API, accountLabel, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import { BANK_API, BankAccount, BankAccountKind } from "./bankShared";

import { t } from "../../i18n/i18n";
const KIND_OPTIONS = [
  { id: "BANK", name: "Bank account" },
  { id: "CASH", name: "Cash box / petty cash" },
];

const emptyForm = () => ({
  accountName: "",
  kind: "BANK" as BankAccountKind,
  bankName: "",
  accountNumber: "",
  iban: "",
  swiftCode: "",
  currency: companyCurrency(),
  generalAccountId: "",
  openingDate: todayInput(),
  openingBalance: "",
  defaultAccount: false,
  active: true,
});

/** Bank accounts and cash boxes: where receipts go in and payments go out; each opens its reconciliation. */
const BankAccounts: React.FC = () => {
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const canSetUp = hasPermission(access, "INVOICE:ADMIN");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [ledgerAccounts, setLedgerAccounts] = useState<GeneralAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [bankRes, ledgerRes] = await Promise.all([
        axios.get<BankAccount[]>(BANK_API),
        axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`).catch(() => ({ data: [] as GeneralAccount[] })),
      ]);
      setAccounts(Array.isArray(bankRes.data) ? bankRes.data : []);
      setLedgerAccounts(Array.isArray(ledgerRes.data) ? ledgerRes.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load the bank accounts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Asset accounts that take postings and keep no other bank account's money
  const ledgerOptions = useMemo(() => {
    const taken = new Set(accounts.filter((a) => a.id !== editing?.id).map((a) => a.generalAccountId));
    return [
      { id: "", name: "New account in the chart (next free code)" },
      ...ledgerAccounts
        .filter((a) => a.accountType === "ASSET" && a.isActive !== false && a.allowTransactions !== false && !taken.has(a.id))
        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
        .map((a) => ({ id: String(a.id), name: accountLabel(a) })),
    ];
  }, [accounts, editing, ledgerAccounts]);

  const openForm = (account?: BankAccount) => {
    setEditing(account ?? null);
    setForm(
      account
        ? {
            accountName: account.accountName,
            kind: account.kind,
            bankName: account.bankName ?? "",
            accountNumber: account.accountNumber ?? "",
            iban: account.iban ?? "",
            swiftCode: account.swiftCode ?? "",
            currency: account.currency ?? "",
            generalAccountId: String(account.generalAccountId),
            openingDate: account.openingDate,
            openingBalance: account.openingBalance ? String(account.openingBalance) : "",
            defaultAccount: account.defaultAccount,
            active: account.active,
          }
        : emptyForm()
    );
    setShowForm(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.accountName.trim()) return ToasterService.error("Name the account");
    setBusy(true);
    try {
      const body = {
        ...form,
        generalAccountId: form.generalAccountId ? Number(form.generalAccountId) : null,
        openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
        openingDate: form.openingDate || null,
      };
      if (editing) {
        await axios.put(`${BANK_API}/${editing.id}`, body);
        ToasterService.success(`${form.accountName} saved`);
      } else {
        const res = await axios.post<BankAccount>(BANK_API, body);
        ToasterService.success(`${res.data.accountName} added; its money is kept in ${res.data.generalAccountCode}`);
      }
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the account"));
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.active);
    const total = (kind: BankAccountKind) => active.filter((a) => a.kind === kind).reduce((sum, a) => sum + Number(a.bookBalance || 0), 0);
    return { bank: total("BANK"), cash: total("CASH"), count: active.length };
  }, [accounts]);

  const columns: ColumnDef<BankAccount>[] = [
    {
      key: "accountName",
      label: "Account",
      sortable: true,
      render: (a) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{a.accountName}</span>
          {a.defaultAccount && <span className="ml-2 rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-700">{t("Default")}</span>}
          {(a.bankName || a.accountNumber) && (
            <span className="block text-xs text-slate-500">{[a.bankName, a.accountNumber && `A/c ${a.accountNumber}`].filter(Boolean).join(" · ")}</span>
          )}
          {a.iban && <span className="block text-xs text-slate-400">{t("IBAN")} {a.iban}</span>}
        </span>
      ),
    },
    { key: "kind", label: "Kind", sortable: true, render: (a) => <span className="text-sm text-slate-600">{a.kind === "CASH" ? "Cash" : "Bank"}</span> },
    {
      key: "generalAccountCode",
      label: "Ledger account",
      sortable: true,
      render: (a) => <span className="text-sm text-slate-600">{a.generalAccountCode} · {a.generalAccountName}</span>,
    },
    {
      key: "bookBalance",
      label: "Balance in books",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      // In the account's own money; an account in another currency also shows what it is worth in the books
      render: (a) => (
        <span className="text-sm font-medium text-slate-800">
          {money(a.balanceInCurrency ?? a.bookBalance, a.currency)}
          {a.currency && a.currency !== companyCurrency() && (
            <span className="block text-xs font-normal text-slate-500">{money(a.bookBalance, companyCurrency())}</span>
          )}
        </span>
      ),
    },
    {
      key: "active",
      label: "Status",
      sortable: true,
      render: (a) => (
        <span className={`rounded-full border px-2 py-0.5 text-xs ${a.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-100 text-gray-500"}`}>
          {a.active ? "Active" : "Closed"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (a) => (
        <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => navigate(`/bankAccounts/${a.id}/reconcile`)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Reconcile with the bank statement")}>
            <ScaleIcon className="h-4 w-4" />
          </button>
          {canSetUp && (
            <button type="button" onClick={() => openForm(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit")}>
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const set = <K extends keyof ReturnType<typeof emptyForm>>(key: K, value: ReturnType<typeof emptyForm>[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const isBank = form.kind === "BANK";

  return (
    <>
      <PageMeta title={t("Bank & Cash")} description="Bank accounts and cash boxes, and their reconciliation" />
      <PageBreadcrumb pageTitle="Bank & Cash" actions={canSetUp ? <AddButton onClick={() => openForm()} label={t("Add account")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label={t("In the bank")} value={money(stats.bank)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Cash in hand")} value={money(stats.cash)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Active accounts")} value={stats.count} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <ReusableTable
          data={accounts}
          columns={columns}
          pageSize={10}
          searchable
          searchPlaceholder={t("Search accounts…")}
          searchFields={["accountName", "bankName", "accountNumber", "iban"]}
          onRowClick={(a) => navigate(`/bankAccounts/${a.id}/reconcile`)}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BuildingLibraryIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No bank accounts or cash boxes yet")}</p>
              <p className="mt-1 max-w-md text-center text-xs text-gray-400">
                {t("Until you add one, receipts and payments post to the Cash or Bank posting account by their method.")}
              </p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showForm}
        title={editing ? `Edit ${editing.accountName}` : "Add bank account or cash box"}
        subtitle={t("Receipts and payments choose it; its money is kept in one asset account of the chart, and its statement is reconciled against that account.")}
        onClose={() => setShowForm(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="max-h-[65dvh] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingInput label={t("Name")} name="accountName" required value={form.accountName} onChange={(e) => set("accountName", e.target.value)} />
                <FloatingSelect1 label={t("Kind")} name="kind" value={form.kind} options={KIND_OPTIONS} includeEmptyOption={false}
                  onChange={(e) => set("kind", e.target.value as BankAccountKind)} />
                {isBank && (
                  <>
                    <FloatingInput label={t("Bank")} name="bankName" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                    <FloatingInput label={t("Account number")} name="accountNumber" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
                    <FloatingInput label={t("IBAN")} name="iban" value={form.iban} onChange={(e) => set("iban", e.target.value)} />
                    <FloatingInput label={t("SWIFT / BIC")} name="swiftCode" value={form.swiftCode} onChange={(e) => set("swiftCode", e.target.value)} />
                  </>
                )}
                <FloatingInput label={t("Currency")} name="currency" value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} />
                <FloatingSelect1 label={t("Ledger account")} name="generalAccountId" value={form.generalAccountId} options={ledgerOptions}
                  includeEmptyOption={false} disabled={!!editing} onChange={(e) => set("generalAccountId", e.target.value)} />
                <FloatingInput label={t("Opening date")} name="openingDate" type="date" value={form.openingDate} onChange={(e) => set("openingDate", e.target.value)} />
                <FloatingInput label={t("Balance on the opening date")} name="openingBalance" type="number" value={form.openingBalance}
                  onChange={(e) => set("openingBalance", e.target.value)} />
              </div>
              <p className="text-xs text-slate-500">
                The opening balance is posted against opening balance equity on the opening date (an overdraft as a negative amount).
                Reconciliation starts on that date. Linking an account that already has postings? Leave the balance at 0.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.defaultAccount} onChange={(e) => set("defaultAccount", e.target.checked)} />
                  {t("Default for")} {isBank ? "bank transfers, cheques and cards" : "cash"}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
                  Active (closed accounts can't take new receipts or payments)
                </label>
              </div>
              {editing && <p className="text-xs text-slate-400">{t("Opened")} {dateLabel(editing.openingDate)} · ledger account {editing.generalAccountCode}</p>}
            </div>
            <DialogFooter onCancel={() => setShowForm(false)} submitLabel={editing ? "Save" : "Add account"} busy={busy} />
          </form>
        }
      />
    </>
  );
};

export default BankAccounts;
