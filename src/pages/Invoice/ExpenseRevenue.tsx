import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircleIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import {
  GeneralAccount,
  INVOICE_API,
  Option,
  PAYMENT_METHOD_OPTIONS,
  accountLabel,
  apiError,
  dateLabel,
  labelOf,
  money,
  paymentMethodLabel,
  todayInput,
} from "./invoiceShared";
import { DialogFooter, StatusBadge } from "./invoiceUi";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/expenses-revenue`;
const PAGE_SIZE = 10;

interface Item {
  id: number;
  revenueExpenseType?: string;
  revenueExpenseCategory?: string;
  description?: string;
  amount?: number;
  transactionDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  generalAccount?: Pick<GeneralAccount, "id" | "accountCode" | "accountName"> | null;
}

// Expense and revenue first; the rest are the service's other movement types
const TYPE_OPTIONS: Option[] = ["EXPENSE", "REVENUE", "REFUND", "ADJUSTMENT", "TRANSFER", "CREDIT_NOTE", "DEBIT_NOTE", "CHARGEBACK", "WRITE_OFF", "OTHER"].map(
  (id) => ({ id, name: id === "REVENUE" ? "Revenue (income)" : labelOf(id) })
);

const CATEGORY_OPTIONS: Option[] = [
  "RENT", "SALARY", "UTILITIES", "FREIGHT", "OFFICE_SUPPLIES", "MAINTENANCE", "TRAVEL", "ENTERTAINMENT",
  "ADVERTISING", "INSURANCE", "TAXES", "DEPRECIATION", "INTEREST", "MISC", "OTHER",
].map((id) => ({ id, name: labelOf(id) }));

const TYPE_TONES: Record<string, string> = {
  EXPENSE: "bg-red-50 text-red-700 border-red-200/60",
  REVENUE: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  REFUND: "bg-blue-50 text-blue-700 border-blue-200/60",
};

// The account type that usually goes with each movement type
const ACCOUNT_TYPE_FOR: Record<string, string> = { EXPENSE: "EXPENSE", REVENUE: "INCOME" };

const emptyForm = () => ({
  revenueExpenseType: "EXPENSE",
  revenueExpenseCategory: "",
  description: "",
  amount: "",
  transactionDate: todayInput(),
  paymentMethod: "BANK_TRANSFER",
  generalAccountId: "",
});

const ExpenseRevenue: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [items, setItems] = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [month, setMonth] = useState(() => todayInput().slice(0, 7));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [itemRes, accountRes] = await Promise.all([
        axios.get<Item[]>(API_URL),
        axios.get<GeneralAccount[]>(`${INVOICE_API}/general-accounts`).catch(() => ({ data: [] as GeneralAccount[] })),
      ]);
      setItems(Array.isArray(itemRes.data) ? itemRes.data : []);
      const accountList = Array.isArray(accountRes.data) ? accountRes.data : [];
      setAccounts([...accountList].sort((a, b) => a.accountCode.localeCompare(b.accountCode)));
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load expenses and revenue"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Accounts of the matching type when there are any (expense → expense accounts, revenue → income accounts)
  const accountOptions = useMemo(() => {
    const usable = accounts.filter((account) => account.isActive !== false || String(account.id) === form.generalAccountId);
    const wanted = ACCOUNT_TYPE_FOR[form.revenueExpenseType];
    const matching = wanted ? usable.filter((account) => account.accountType === wanted) : [];
    return (matching.length ? matching : usable).map((account) => ({ id: String(account.id), name: accountLabel(account) }));
  }, [accounts, form.revenueExpenseType, form.generalAccountId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({
      revenueExpenseType: item.revenueExpenseType ?? "EXPENSE",
      revenueExpenseCategory: item.revenueExpenseCategory ?? "",
      description: item.description ?? "",
      amount: item.amount != null ? String(item.amount) : "",
      transactionDate: item.transactionDate ?? todayInput(),
      paymentMethod: item.paymentMethod || "BANK_TRANSFER",
      generalAccountId: item.generalAccount?.id ? String(item.generalAccount.id) : "",
    });
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.revenueExpenseCategory) return ToasterService.error("Choose a category");
    if (!form.description.trim()) return ToasterService.error("Describe what it was for");
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return ToasterService.error("Enter the amount");
    // The reference number is assigned by the server and kept on edit
    const payload = {
      revenueExpenseType: form.revenueExpenseType,
      revenueExpenseCategory: form.revenueExpenseCategory,
      description: form.description.trim(),
      amount,
      transactionDate: form.transactionDate || null,
      paymentMethod: form.paymentMethod || null,
      generalAccount: form.generalAccountId ? { id: Number(form.generalAccountId) } : null,
    };
    setBusy(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/${editing.id}`, payload);
        ToasterService.success(`${editing.referenceNumber ?? "Item"} updated`);
      } else {
        const res = await axios.post<Item>(API_URL, payload);
        ToasterService.success(`${res.data?.referenceNumber ?? "Item"} recorded`);
      }
      setFormOpen(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the item"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await axios.delete(`${API_URL}/${deleting.id}`);
      ToasterService.success(`${deleting.referenceNumber ?? "Item"} deleted`);
      setDeleting(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the item"));
    } finally {
      setBusy(false);
    }
  };

  const inMonth = useMemo(() => items.filter((item) => !month || item.transactionDate?.startsWith(month)), [items, month]);

  const filtered = useMemo(
    () => (typeFilter === "ALL" ? inMonth : inMonth.filter((item) => item.revenueExpenseType === typeFilter)),
    [inMonth, typeFilter]
  );

  const stats = useMemo(() => {
    const sum = (type: string) => inMonth.filter((item) => item.revenueExpenseType === type).reduce((total, item) => total + Number(item.amount || 0), 0);
    const expense = sum("EXPENSE");
    const revenue = sum("REVENUE");
    return { expense, revenue, net: revenue - expense, count: inMonth.length };
  }, [inMonth]);

  const columns: ColumnDef<Item>[] = [
    { key: "transactionDate", label: "Date", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.transactionDate)}</span> },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-800">
          <span className="font-medium">{row.description || "—"}</span>
          <span className="block text-xs text-slate-400">{row.referenceNumber ?? ""}</span>
        </span>
      ),
    },
    { key: "revenueExpenseType", label: "Type", sortable: true, render: (row) => <StatusBadge status={row.revenueExpenseType} tones={TYPE_TONES} /> },
    { key: "revenueExpenseCategory", label: "Category", sortable: true, render: (row) => <span className="text-sm text-slate-600">{labelOf(row.revenueExpenseCategory)}</span> },
    {
      key: "generalAccount",
      label: "Account",
      sortable: true,
      sortValueGetter: (row) => row.generalAccount?.accountCode ?? "",
      render: (row) => <span className="text-sm text-slate-600">{row.generalAccount ? accountLabel(row.generalAccount) : "—"}</span>,
    },
    { key: "paymentMethod", label: "Paid by", sortable: true, render: (row) => <span className="text-sm text-slate-600">{row.paymentMethod ? paymentMethodLabel(row.paymentMethod) : "—"}</span> },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.amount || 0),
      render: (row) => (
        <span className={`text-sm font-semibold ${row.revenueExpenseType === "REVENUE" ? "text-emerald-700" : "text-slate-900"}`}>{money(row.amount)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600" title={t("Edit")}>
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title={t("Delete")}>
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Expenses & Revenue")} description="Day-to-day expenses and other income" />
      <PageBreadcrumb pageTitle="Expenses & Revenue" actions={canCreate ? <AddButton onClick={openCreate} label={t("Record expense / income")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Expenses")} value={money(stats.expense)} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
          <StatsCard label={t("Revenue")} value={money(stats.revenue)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Net")} value={money(stats.net)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Items")} value={stats.count} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "ALL", name: "All" }, { id: "EXPENSE", name: "Expenses" }, { id: "REVENUE", name: "Revenue" }, { id: "REFUND", name: "Refunds" }].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTypeFilter(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${typeFilter === option.id ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.name}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-600">
            {t("Month")}
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            {month && (
              <button type="button" onClick={() => setMonth("")} className="text-cyan-700 hover:underline">{t("All months")}</button>
            )}
          </label>
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircleIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing recorded")}{month ? " this month" : ""}</p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title={editing ? `${t("Edit")} ${editing.referenceNumber ?? "item"}` : t("Record expense or income")}
        subtitle={editing ? undefined : "A reference number is assigned when it is saved"}
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1 label={t("Type")} name="revenueExpenseType" value={form.revenueExpenseType} options={TYPE_OPTIONS} includeEmptyOption={false}
                onChange={(event) => setForm((current) => ({ ...current, revenueExpenseType: event.target.value }))} />
              <FloatingSelect1 label={t("Category")} name="revenueExpenseCategory" required value={form.revenueExpenseCategory} options={CATEGORY_OPTIONS}
                onChange={(event) => setForm((current) => ({ ...current, revenueExpenseCategory: event.target.value }))} />
              <div className="sm:col-span-2">
                <FloatingInput label={t("Description")} name="description" required value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <FloatingInput label={t("Amount")} name="amount" type="number" required value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
              <FloatingInput label={t("Date")} name="transactionDate" type="date" value={form.transactionDate}
                onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
              <FloatingSelect1 label={t("Payment method")} name="paymentMethod" value={form.paymentMethod} options={PAYMENT_METHOD_OPTIONS}
                onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} />
              <FloatingSelect1 label={t("Ledger account (optional)")} name="generalAccountId" value={form.generalAccountId} options={accountOptions}
                onChange={(event) => setForm((current) => ({ ...current, generalAccountId: event.target.value }))} />
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={t(editing ? "Save changes" : "Record")} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("Delete item")}
        message={`Delete ${deleting?.referenceNumber ?? "this item"}: ${deleting?.description ?? ""} (${money(deleting?.amount)})?`}
        confirmLabel={t("Delete")}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
};

export default ExpenseRevenue;
