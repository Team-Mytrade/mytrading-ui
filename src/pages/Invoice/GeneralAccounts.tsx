import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import FilterPopover from "../../components/common/filter";
import { FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

interface GeneralAccount {
  id: number;
  accountCode?: string;
  accountName?: string;
  accountType?: string;
  isActive?: boolean;
  description?: string;
  openingBalance?: number;
}

const API_URL = "/v1/api/invoice/general-accounts";
const PAGE_SIZE = 10;

const ACCOUNT_TYPE_OPTIONS = [
  { id: "ASSET", name: "ASSET" },
  { id: "LIABILITY", name: "LIABILITY" },
  { id: "EQUITY", name: "EQUITY" },
  { id: "INCOME", name: "INCOME" },
  { id: "EXPENSE", name: "EXPENSE" },
  { id: "OTHER", name: "OTHER" },
];

const typeTones: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-700 border-blue-200/40",
  LIABILITY: "bg-red-50 text-red-700 border-red-200/40",
  EQUITY: "bg-purple-50 text-purple-700 border-purple-200/40",
  INCOME: "bg-green-50 text-green-700 border-green-200/40",
  EXPENSE: "bg-orange-50 text-orange-700 border-orange-200/40",
  OTHER: "bg-gray-50 text-gray-700 border-gray-200/40",
};

const GeneralAccounts: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [form, setForm] = useState<Partial<GeneralAccount>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<GeneralAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccounts = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<GeneralAccount[]>(API_URL, { headers });
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.accountName?.trim()) {
      ToasterService.error("Account name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Account updated successfully!" : "Account added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchAccounts();
      }
    } catch (err) {
      console.error("Error submitting account", err);
      ToasterService.error("Failed to save account");
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
    setShowFormModal(true);
    setForm({});
    setEditingId(null);
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
    if (!accountToDelete) return;
    try {
      await axios.delete(`${API_URL}/${accountToDelete.id}`, { headers });
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
        (account.accountName || "").toLowerCase().includes(term) ||
        (account.accountCode || "").toLowerCase().includes(term) ||
        (account.accountType || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "ACTIVE") {
        matchesFilter = account.isActive === true;
      } else if (activeFilter === "INACTIVE") {
        matchesFilter = account.isActive !== true;
      }

      return matchesSearch && matchesFilter;
    });
  }, [accounts, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalAccounts: accounts.length,
      active: accounts.filter((a) => a.isActive === true).length,
      inactive: accounts.filter((a) => a.isActive !== true).length,
    }),
    [accounts]
  );

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
            {account.accountName || "Unnamed Account"}
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
      render: (account) => (
        <span className="text-sm text-slate-600 truncate">{account.accountCode || "N/A"}</span>
      ),
    },
    {
      key: "accountType",
      label: "Account Type",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (account) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
          typeTones[account.accountType || "OTHER"] || "bg-gray-50 text-gray-700 border-gray-200/40"
        }`}>
          {account.accountType || "OTHER"}
        </span>
      ),
    },
    {
      key: "openingBalance",
      label: "Opening Balance",
      sortable: true,
      headerClassName: "w-[15%] text-right",
      className: "w-[15%] text-right",
      sortValueGetter: (account) => Number(account.openingBalance || 0),
      render: (account) => (
        <span className="text-sm text-slate-600">
          {Number(account.openingBalance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      sortable: true,
      headerClassName: "w-[10%] text-left",
      className: "w-[10%]",
      render: (account) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
          account.isActive
            ? "bg-emerald-50 text-emerald-700 border-emerald-200/40"
            : "bg-gray-50 text-gray-700 border-gray-200/40"
        }`}>
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
      <PageMeta title="General Accounts" description="Manage general accounts" />
      <PageBreadcrumb pageTitle="General Accounts" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Account" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Accounts"
            value={stats.totalAccounts}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Inactive"
            value={stats.inactive}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
          <StatsCard
            label="Filtered"
            value={filteredAccounts.length}
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
                placeholder="Search accounts by name, code, or type..."
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
                { label: "Active", value: "ACTIVE" },
                { label: "Inactive", value: "INACTIVE" },
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
          defaultSortKey="accountName"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No accounts found</p>
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
                  label="Account Name"
                  name="accountName"
                  value={form.accountName || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingInput
                  label="Account Code"
                  name="accountCode"
                  value={form.accountCode || ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  label="Account Type"
                  name="accountType"
                  value={form.accountType || ""}
                  options={ACCOUNT_TYPE_OPTIONS}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Opening Balance"
                  name="openingBalance"
                  type="number"
                  value={form.openingBalance ?? ""}
                  onChange={handleChange}
                />,
                <FloatingTextarea
                  label="Description"
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                  rows={3}
                />,
                <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                  <label htmlFor="isActive" className="text-sm text-gray-600">
                    Active Account
                  </label>
                  <input
                    id="isActive"
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive ?? false}
                    onChange={handleActiveChange}
                    className="h-4 w-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                  />
                </div>,
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
              ? `Are you sure you want to delete "${accountToDelete.accountName}"? This action cannot be undone.`
              : "Are you sure you want to delete this account?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setAccountToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />

        <style>{`
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.25s ease-out;
          }
        `}</style>
      </div>
    </>
  );
};

export default GeneralAccounts;
