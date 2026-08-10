import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOffice2Icon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface AccountsReceivable {
  id: number;
  customerId?: number;
  invoiceAmount?: number;
  amountPaid?: number;
  balance?: number;
  accountsReceivableStatus?: string;
  invoiceDate?: string;
  dueDate?: string;
  invoiceNumber?: string;
  customerName?: string;
  invoiceId?: number;
}

const API_BASE = "/v1/api/invoice/accounts-receivable";
const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { id: "OPEN", name: "OPEN" },
  { id: "PARTIALLY_PAID", name: "PARTIALLY_PAID" },
  { id: "PAID", name: "PAID" },
  { id: "OVERDUE", name: "OVERDUE" },
  { id: "OTHER", name: "OTHER" },
];

const getStatusBadgeClass = (status?: string) => {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/40";
    case "PARTIALLY_PAID":
      return "bg-yellow-50 text-yellow-700 border-yellow-200/40";
    case "OPEN":
      return "bg-blue-50 text-blue-700 border-blue-200/40";
    case "OVERDUE":
      return "bg-red-50 text-red-700 border-red-200/40";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
};

const AccountsReceivable: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [accounts, setAccounts] = useState<AccountsReceivable[]>([]);
  const [form, setForm] = useState<Partial<AccountsReceivable>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<AccountsReceivable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoices, setInvoices] = useState<{id:number;invoiceNumber?:string;customerId?:number}[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchAccounts();
    axios.get("/v1/api/invoice/invoices", { headers }).then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      let data: unknown = null;
      try {
        const res = await axios.get(API_BASE, { headers });
        data = res.data;
      } catch {
        const res = await axios.get(`${API_BASE}/overdue`, { headers });
        data = res.data;
      }
      setAccounts(Array.isArray(data) ? (data as AccountsReceivable[]) : []);
    } catch (err) {
      console.error("Error fetching accounts receivable", err);
      ToasterService.error("Failed to load accounts receivable");
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.customerName?.trim()) {
      ToasterService.error("Customer name is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        customerId: form.customerId ? Number(form.customerId) : undefined,
        invoiceAmount: form.invoiceAmount ? Number(form.invoiceAmount) : undefined,
        amountPaid: form.amountPaid ? Number(form.amountPaid) : undefined,
        balance: form.invoiceAmount && form.amountPaid ? Number(form.invoiceAmount) - Number(form.amountPaid) : undefined,
        accountsReceivableStatus: form.accountsReceivableStatus,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
      };
      if (form.invoiceId) payload.invoice = { id: Number(form.invoiceId) };
      const res =
        editingId !== null
          ? await axios.put(`${API_BASE}/${editingId}`, payload, { headers })
          : await axios.post(API_BASE, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Account updated successfully!" : "Account added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchAccounts();
      }
    } catch (err: any) {
      console.error("Error submitting account", err);
      ToasterService.error(err?.response?.data?.error || "Failed to save account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (account: AccountsReceivable) => {
    setForm(account);
    setEditingId(account.id);
    setShowFormModal(true);
  };

  const openCreate = () => {
    setShowFormModal(true);
    setForm({});
    setEditingId(null);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingId(null);
    setForm({});
  };

  const handleDelete = (account: AccountsReceivable) => {
    setAccountToDelete(account);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    try {
      await axios.delete(`${API_BASE}/${accountToDelete.id}`, { headers });
      ToasterService.success("Account deleted successfully!");
      setShowDeletePopup(false);
      setAccountToDelete(null);
      fetchAccounts();
    } catch (err) {
      console.error("Error deleting account", err);
      ToasterService.error("Failed to delete account");
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (account.customerName || "").toLowerCase().includes(term) ||
        (account.invoiceNumber || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter !== "ALL") {
        matchesFilter = (account.accountsReceivableStatus || "") === activeFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [accounts, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: accounts.length,
      overdue: accounts.filter((a) => a.accountsReceivableStatus === "OVERDUE").length,
      paid: accounts.filter((a) => a.accountsReceivableStatus === "PAID").length,
      totalBalance: accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0),
    }),
    [accounts]
  );

  const tableColumns: ColumnDef<AccountsReceivable>[] = [
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (account) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {account.customerName ? account.customerName.charAt(0).toUpperCase() : "A"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {account.customerName || "Unnamed Customer"}
          </span>
        </div>
      ),
    },
    {
      key: "invoiceNumber",
      label: "Invoice",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (account) => (
        <span className="text-sm text-slate-600 truncate">{account.invoiceNumber || "N/A"}</span>
      ),
    },
    {
      key: "invoiceAmount",
      label: "Invoice Amount",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (account) => Number(account.invoiceAmount || 0),
      render: (account) => (
        <span className="text-sm text-slate-600">{Number(account.invoiceAmount || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "amountPaid",
      label: "Amount Paid",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (account) => Number(account.amountPaid || 0),
      render: (account) => (
        <span className="text-sm text-slate-600">{Number(account.amountPaid || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (account) => Number(account.balance || 0),
      render: (account) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {Number(account.balance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (account) => (
        <span className="text-sm text-slate-600 truncate">{account.dueDate || "N/A"}</span>
      ),
    },
    {
      key: "accountsReceivableStatus",
      label: "Status",
      sortable: true,
      headerClassName: "w-[12%] text-center",
      className: "w-[12%] text-center",
      render: (account) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadgeClass(account.accountsReceivableStatus)}`}>
          {account.accountsReceivableStatus || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[8%] text-right pr-4",
      className: "w-[8%] text-right",
      render: (account) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(account)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Account"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(account)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Account"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Accounts Receivable" description="Manage accounts receivable" />
      <PageBreadcrumb pageTitle="Accounts Receivable" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Account" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Accounts"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Overdue"
            value={stats.overdue}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
          <StatsCard
            label="Paid"
            value={stats.paid}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Balance"
            value={stats.totalBalance}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts by customer or invoice..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => { setSearch(""); }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <FilterPopover
              title="Filter Accounts"
              buttonLabel="Filters"
              label="Filter by Status"
              value={activeFilter}
              options={[
                { label: "All Accounts", value: "ALL" },
                { label: "Open", value: "OPEN" },
                { label: "Partially Paid", value: "PARTIALLY_PAID" },
                { label: "Paid", value: "PAID" },
                { label: "Overdue", value: "OVERDUE" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredAccounts}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="customerName"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No accounts receivable found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first account
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Account" : "Create New Account"}
          subtitle={editingId !== null ? "Update your account details" : "Add a new account"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Account" : "Create Account"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="customerName"
                  label="Customer Name"
                  name="customerName"
                  value={form.customerName || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingSelect
                  key="invoiceId"
                  label="Invoice"
                  name="invoiceId"
                  value={form.invoiceId ?? ""}
                  onChange={(e) => setForm({ ...form, invoiceId: e.target.value ? Number(e.target.value) : undefined })}
                  options={invoices.map((inv) => ({ id: String(inv.id), name: inv.invoiceNumber || `Invoice ${inv.id}` }))}
                />,
                <FloatingInput
                  key="customerId"
                  label="Customer ID"
                  name="customerId"
                  type="number"
                  value={form.customerId ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="invoiceAmount"
                  label="Invoice Amount"
                  name="invoiceAmount"
                  type="number"
                  value={form.invoiceAmount ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="amountPaid"
                  label="Amount Paid"
                  name="amountPaid"
                  type="number"
                  value={form.amountPaid ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="dueDate"
                  label="Due Date"
                  name="dueDate"
                  type="date"
                  value={form.dueDate || ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  key="accountsReceivableStatus"
                  label="Status"
                  name="accountsReceivableStatus"
                  value={form.accountsReceivableStatus || ""}
                  onChange={(e) => setForm({ ...form, accountsReceivableStatus: e.target.value })}
                  options={STATUS_OPTIONS}
                />,
              ],
            },
          ]}
        />

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Account"
          subText={
            accountToDelete
              ? `Are you sure you want to delete "${accountToDelete.customerName || accountToDelete.invoiceNumber || "this account"}"? This action cannot be undone.`
              : "Are you sure you want to delete this account?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setAccountToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />


      </div>
    </>
  );
};

export default AccountsReceivable;
