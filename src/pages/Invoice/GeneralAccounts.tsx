import React, { useEffect, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatMoney } from "../../components/common/Table";
import { FloatingInput, FloatingTextarea, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { toSelectOptions, useInvoiceEnum } from "./invoiceEnums";
import { usePermissions } from "../../access/usePermissions";

interface GeneralAccount {
  id: number;
  accountCode?: string;
  accountName?: string;
  accountType?: string;
  isActive?: boolean;
  description?: string;
  openingBalance?: number;
  currency?: string;
  allowTransactions?: boolean;
}

/**
 * Only the fields the user edits. Server fields (id, createdDate, createdBy, tenantId, ...)
 * and ledgerEntries / childAccounts / tags are never sent from this form.
 */
interface GeneralAccountPayload {
  accountCode?: string;
  accountName: string;
  accountType?: string;
  isActive: boolean;
  description?: string;
  currency: string;
  openingBalance: number;
  allowTransactions: boolean;
}

const API_URL = "/v1/api/invoice/general-accounts";
const PAGE_SIZE = 10;

/** Used until the ACCOUNT_TYPE enum API answers (or if it fails). */
const ACCOUNT_TYPE_FALLBACK = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE", "OTHER"];
const CURRENCY_FALLBACK = ["INR", "USD", "EUR"];

/** ₹ with Indian grouping for INR; other currencies show their code. */
const formatBalance = (amount?: number | string, currency?: string) => {
  const value = Number(amount || 0);
  if (!currency || currency === "INR") return formatMoney(value);
  return `${currency} ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const typeTones: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-700 border-blue-200/40",
  LIABILITY: "bg-red-50 text-red-700 border-red-200/40",
  EQUITY: "bg-purple-50 text-purple-700 border-purple-200/40",
  INCOME: "bg-green-50 text-green-700 border-green-200/40",
  EXPENSE: "bg-orange-50 text-orange-700 border-orange-200/40",
  OTHER: "bg-gray-50 text-gray-700 border-gray-200/40",
};

/** Clickable stats cards: click one to show only those rows, click again to show all. */
const STATS_CARDS: StatsCardOption<GeneralAccount>[] = [
  { key: "ALL", label: "Total Accounts", match: () => true, tone: "cyan" },
  { key: "ACTIVE", label: "Active", match: (a) => a.isActive === true, tone: "green" },
  { key: "INACTIVE", label: "Inactive", match: (a) => a.isActive !== true, tone: "red" },
];

const GeneralAccounts: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [form, setForm] = useState<Partial<GeneralAccount>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<GeneralAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const accountTypes = useInvoiceEnum("ACCOUNT_TYPE", ACCOUNT_TYPE_FALLBACK);
  const currencies = useInvoiceEnum("CURRENCY", CURRENCY_FALLBACK);

  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(accounts, STATS_CARDS);

  /** "ASSET" → "Asset" (label from the enum API). */
  const typeLabel = (code?: string) => accountTypes.find((t) => t.code === code)?.label || code || "--";

  useEffect(() => {
    fetchAccounts();
    // Toolbar Refresh icon reloads the list
    const reload = () => fetchAccounts();
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<GeneralAccount[]>(API_URL);
      setAccounts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching general accounts", err);
      ToasterService.error("Failed to load general accounts");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleActiveChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, isActive: e.target.checked });

  const handleAllowTransactionsChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, allowTransactions: e.target.checked });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.accountName?.trim()) {
      ToasterService.error("Account name is required");
      return;
    }

    const balanceText = String(form.openingBalance ?? "").trim();
    const openingBalance = balanceText === "" ? 0 : Number(balanceText);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      ToasterService.error("Opening balance must be a valid amount (0 or more)");
      return;
    }

    const payload: GeneralAccountPayload = {
      accountCode: form.accountCode?.trim() || undefined,
      accountName: form.accountName.trim(),
      accountType: form.accountType || undefined,
      isActive: form.isActive ?? true,
      description: form.description?.trim() || undefined,
      currency: form.currency?.toUpperCase() || "INR",
      // Sent as a number (before it went as text, e.g. "5001")
      openingBalance,
      allowTransactions: form.allowTransactions ?? true,
    };

    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload)
          : await axios.post(API_URL, payload);
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Account updated successfully!" : "Account added successfully!");
        closeModal();
        await fetchAccounts();
      }
    } catch (err: any) {
      console.error("Error submitting account", err);
      ToasterService.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to save account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (account: GeneralAccount) => {
    setForm(account);
    setEditingId(account.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    // New accounts start active, in INR, with transactions allowed
    setForm({ isActive: true, allowTransactions: true, currency: "INR" });
    setEditingId(null);
    setShowFormModal(true);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleDelete = (account: GeneralAccount) => {
    setAccountToDelete(account);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${accountToDelete.id}`);
      ToasterService.success("Account deleted successfully!");
      setShowDeletePopup(false);
      setAccountToDelete(null);
      fetchAccounts();
    } catch (err: any) {
      console.error("Error deleting account", err);
      ToasterService.error(err?.response?.data?.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const tableColumns: ColumnDef<GeneralAccount>[] = [
    {
      key: "accountName",
      label: "Account Name",
      sortable: true,
      headerClassName: "w-[25%] text-left",
      className: "w-[25%]",
      render: (account) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {account.accountName ? account.accountName.charAt(0).toUpperCase() : "A"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {account.accountName || "--"}
          </span>
        </div>
      ),
    },
    {
      key: "accountCode",
      label: "Account Code",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (account) => <span className="text-sm text-slate-600 truncate">{account.accountCode || "--"}</span>,
    },
    {
      key: "accountType",
      label: "Account Type",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      filterOptions: accountTypes.map((t) => ({ label: t.label, value: t.code })),
      detailFormatter: (account) => typeLabel(account.accountType),
      exportValueGetter: (account) => typeLabel(account.accountType),
      render: (account) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            typeTones[account.accountType || "OTHER"] || typeTones.OTHER
          }`}
        >
          {typeLabel(account.accountType)}
        </span>
      ),
    },
    {
      key: "openingBalance",
      label: "Opening Balance",
      sortable: true,
      filterable: false,
      headerClassName: "w-[15%] text-right",
      className: "w-[15%] text-right",
      sortValueGetter: (account) => Number(account.openingBalance || 0),
      detailFormatter: (account) => formatBalance(account.openingBalance, account.currency),
      exportValueGetter: (account) => formatBalance(account.openingBalance, account.currency),
      render: (account) => (
        <span className="text-sm text-slate-600">{formatBalance(account.openingBalance, account.currency)}</span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      filterValueGetter: (account) => (account.isActive ? "active" : "inactive"),
      detailFormatter: (account) => (account.isActive ? "Active" : "Inactive"),
      exportValueGetter: (account) => (account.isActive ? "Active" : "Inactive"),
      render: (account) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            account.isActive
              ? "bg-emerald-50 text-emerald-700 border-emerald-200/40"
              : "bg-gray-50 text-gray-700 border-gray-200/40"
          }`}
        >
          {account.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (account) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button
              type="button"
              onClick={() => handleEdit(account)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
              title="Edit Account"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDelete(account)}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
              title="Delete Account"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="General Accounts" description="Manage general accounts" />
      {/* Add button sits in the breadcrumb row, like the other modules */}
      <PageBreadcrumb
        className="mr-4"
        pageTitle="General Accounts"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Account" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as Payment Terms (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          {/* Clickable cards + toolbar (columns, export, search, filter, refresh) */}
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="accountName"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(account) => account.accountName || "Account Details"}
            rowDetailsSubtitle="General account details"
            // Backend-managed lists that are empty or not useful here; audit fields that are always null
            hiddenDetailKeys={["childAccounts", "tags", "ledgerEntries", "parentAccount", "createdAt", "updatedAt", "updatedBy"]}
            // Hides the details drawer while the edit form is open; it comes back with the saved data
            suspendRowDetails={showFormModal}
            // Edit icon next to ✕ in the row details drawer
            rowDetailsActions={(account: GeneralAccount) =>
              canUpdate ? (
                <button
                  type="button"
                  onClick={() => handleEdit(account)}
                  className={ICON_BUTTON_CLASS}
                  title="Edit"
                  aria-label="Edit this record"
                >
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-gray-500 text-sm mb-2">No accounts found</p>
                {selected !== "ALL" ? (
                  <p className="text-gray-400 text-xs">Click the selected card again to show all accounts</p>
                ) : (
                  canCreate && (
                    <button
                      type="button"
                      onClick={openCreate}
                      className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                    >
                      Create your first account
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        <Dragger
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Account" : "Add Account"}
          subtitle={editingId !== null ? "Update your account details" : "Add a new account"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FloatingInput
              label="Account Name"
              name="accountName"
              value={form.accountName || ""}
              onChange={handleChange}
              required
            />
            <FloatingInput
              label="Account Code"
              name="accountCode"
              value={form.accountCode || ""}
              onChange={handleChange}
            />
            <FloatingSelect
              label="Account Type"
              name="accountType"
              value={form.accountType || ""}
              options={toSelectOptions(accountTypes)}
              onChange={handleChange}
            />
            <FloatingSelect
              label="Currency"
              name="currency"
              value={form.currency || ""}
              // Shown as the code in capitals: INR, USD, EUR
              options={currencies.map((c) => ({ id: c.code, name: c.code.toUpperCase() }))}
              onChange={handleChange}
              required
            />
            <FloatingInput
              label="Opening Balance"
              name="openingBalance"
              type="number"
              min={0}
              step="0.01"
              value={form.openingBalance ?? ""}
              onChange={handleChange}
              // Block keys that make a negative or odd number; scrolling must not change the value
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
              onWheel={(e) => e.currentTarget.blur()}
            />
            <div className="md:col-span-2">
              <FloatingTextarea
                label="Description"
                name="description"
                rows={2}
                value={form.description || ""}
                onChange={handleChange}
              />
            </div>
            <label className="mb-5 flex h-[52px] cursor-pointer items-center justify-between rounded-md border border-gray-300 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
              <span className="text-sm text-gray-700 dark:text-gray-200">Allow Transactions</span>
              <input
                type="checkbox"
                name="allowTransactions"
                checked={form.allowTransactions ?? true}
                onChange={handleAllowTransactionsChange}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
            </label>
            <label className="mb-5 flex h-[52px] cursor-pointer items-center justify-between rounded-md border border-gray-300 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
              <span className="text-sm text-gray-700 dark:text-gray-200">Active Account</span>
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive ?? false}
                onChange={handleActiveChange}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
            </label>
          </div>
        </Dragger>

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Account"
          subText={
            accountToDelete
              ? `Are you sure you want to delete "${accountToDelete.accountName}"? This action cannot be undone.`
              : "Are you sure you want to delete this account?"
          }
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setAccountToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default GeneralAccounts;
