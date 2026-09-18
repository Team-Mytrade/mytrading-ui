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
  CheckCircleIcon,
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
import { toFilterOptions, toSelectOptions, useInvoiceEnum } from "./invoiceEnums";

interface AccountPayable {
  id: number;
  vendorId?: number;
  vendor?: { id: number; name?: string };
  invoiceAmount?: number;
  amountPaid?: number;
  balance?: number;
  accountsPayableStatus?: string;
  lastPaymentDate?: string;
  dueDate?: string;
  invoiceNumber?: string;
  vendorName?: string;
  purchaseInvoiceId?: number;
}

const API_URL = "/v1/api/invoice/accounts-payable";
const PAGE_SIZE = 10;

const STATUS_TONES: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200/40",
  PARTIALLY_PAID: "bg-yellow-50 text-yellow-700 border-yellow-200/40",
  OPEN: "bg-blue-50 text-blue-700 border-blue-200/40",
  OVERDUE: "bg-red-50 text-red-700 border-red-200/40",
};

const AccountsPayable: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [accountPayables, setAccountPayables] = useState<AccountPayable[]>([]);
  const [form, setForm] = useState<Partial<AccountPayable>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AccountPayable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [purchaseInvoices, setPurchaseInvoices] = useState<{id:number;invoiceNumber?:string;vendor?:{name?:string}}[]>([]);
  const [vendors, setVendors] = useState<{id:number;name?:string}[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const payableStatuses = useInvoiceEnum("ACCOUNTS_PAYABLE_STATUS", ["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "OTHER"]);

  useEffect(() => {
    fetchAccountPayables();
    axios.get("/v1/api/invoice/purchase-invoices", { headers }).then(r => setPurchaseInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    axios.get("/v1/api/invoice/vendors", { headers }).then(r => setVendors(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAccountPayables = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<AccountPayable[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setAccountPayables(
        data.map((ap: AccountPayable & { vendor?: { id: number; name?: string }; purchaseInvoice?: { invoiceNumber?: string } }) => ({
          ...ap,
          vendorName: ap.vendor?.name || ap.vendorName,
          invoiceNumber: ap.purchaseInvoice?.invoiceNumber || ap.invoiceNumber,
        }))
      );
    } catch (err) {
      console.error("Error fetching accounts payable", err);
      ToasterService.error("Failed to load accounts payable");
      setAccountPayables([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.vendorId) {
      ToasterService.error("Vendor is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        invoiceAmount: form.invoiceAmount ? Number(form.invoiceAmount) : undefined,
        amountPaid: form.amountPaid ? Number(form.amountPaid) : undefined,
        balance: form.invoiceAmount && form.amountPaid ? Number(form.invoiceAmount) - Number(form.amountPaid) : undefined,
        accountsPayableStatus: form.accountsPayableStatus,
        dueDate: form.dueDate,
        lastPaymentDate: form.lastPaymentDate,
      };
      if (form.vendorId) payload.vendor = { id: Number(form.vendorId) };
      if (form.purchaseInvoiceId) payload.purchaseInvoice = { id: Number(form.purchaseInvoiceId) };
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, payload, { headers })
          : await axios.post(`${API_URL}/create`, payload, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Account payable updated successfully!" : "Account payable added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchAccountPayables();
      }
    } catch (err: any) {
      console.error("Error submitting account payable", err);
      ToasterService.error(err?.response?.data?.error || "Failed to save account payable");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: AccountPayable) => {
    setForm({ ...item, vendorId: item.vendor?.id });
    setEditingId(item.id);
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

  const handleDelete = (item: AccountPayable) => {
    setItemToDelete(item);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API_URL}/${itemToDelete.id}`, { headers });
      ToasterService.success("Account payable deleted successfully!");
      setShowDeletePopup(false);
      setItemToDelete(null);
      fetchAccountPayables();
    } catch (err) {
      console.error("Error deleting account payable", err);
      ToasterService.error("Failed to delete account payable");
    }
  };

  const filteredAccountPayables = useMemo(() => {
    return accountPayables.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (item.vendorName || "").toLowerCase().includes(term) ||
        (item.invoiceNumber || "").toLowerCase().includes(term) ||
        (item.accountsPayableStatus || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter !== "ALL") {
        matchesFilter = (item.accountsPayableStatus || "") === activeFilter;
      }

      return matchesSearch && matchesFilter;
    });
  }, [accountPayables, search, activeFilter]);

  const stats = useMemo(
    () => ({
      total: accountPayables.length,
      paid: accountPayables.filter((a) => a.accountsPayableStatus === "PAID").length,
      overdue: accountPayables.filter((a) => a.accountsPayableStatus === "OVERDUE").length,
      totalBalance: accountPayables.reduce((sum, a) => sum + Number(a.balance || 0), 0),
    }),
    [accountPayables]
  );

  const tableColumns: ColumnDef<AccountPayable>[] = [
    {
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">
              {item.vendorName ? item.vendorName.charAt(0).toUpperCase() : "V"}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {item.vendorName || "Unknown Vendor"}
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
      render: (item) => (
        <span className="text-sm text-slate-600 truncate">{item.invoiceNumber || "N/A"}</span>
      ),
    },
    {
      key: "invoiceAmount",
      label: "Invoice Amount",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (item) => Number(item.invoiceAmount || 0),
      render: (item) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <CreditCardIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {Number(item.invoiceAmount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "amountPaid",
      label: "Amount Paid",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (item) => Number(item.amountPaid || 0),
      render: (item) => (
        <span className="text-sm text-slate-600">{Number(item.amountPaid || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      headerClassName: "w-[12%] text-right",
      className: "w-[12%] text-right",
      sortValueGetter: (item) => Number(item.balance || 0),
      render: (item) => (
        <span className="text-sm font-medium text-slate-700">{Number(item.balance || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "dueDate",
      label: "Due Date",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (item) => (
        <span className="text-sm text-slate-600 truncate">{item.dueDate || "N/A"}</span>
      ),
    },
    {
      key: "accountsPayableStatus",
      label: "Status",
      sortable: true,
      headerClassName: "w-[10%] text-center",
      className: "w-[10%] text-center",
      render: (item) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
            STATUS_TONES[item.accountsPayableStatus || ""] || "bg-gray-100 text-gray-600 border-gray-200"
          }`}
        >
          {item.accountsPayableStatus === "PAID" && <CheckCircleIcon className="h-3.5 w-3.5" />}
          {item.accountsPayableStatus || "N/A"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(item)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Record"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(item)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Record"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Accounts Payable" description="Manage accounts payable" />
      <PageBreadcrumb pageTitle="Accounts Payable" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Account Payable" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Paid"
            value={stats.paid}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Overdue"
            value={stats.overdue}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
          <StatsCard
            label="Total Balance"
            value={stats.totalBalance.toLocaleString()}
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
                placeholder="Search by vendor, invoice, or status..."
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
              title="Filter Accounts Payable"
              buttonLabel="Filters"
              label="Filter by Status"
              value={activeFilter}
              options={[
                { label: "All Records", value: "ALL" },
                ...toFilterOptions(payableStatuses),
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredAccountPayables}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="vendorName"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No accounts payable records found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first account payable record
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Record" : "Create New Record"}
          subtitle={editingId !== null ? "Update your account payable details" : "Add a new account payable record"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Record" : "Create Record"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingSelect
                  label="Vendor"
                  name="vendorId"
                  value={form.vendorId ?? ""}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value ? Number(e.target.value) : undefined })}
                  options={vendors.map((v) => ({ id: String(v.id), name: v.name || `Vendor ${v.id}` }))}
                  required
                />,
                <FloatingSelect
                  label="Purchase Invoice"
                  name="purchaseInvoiceId"
                  value={form.purchaseInvoiceId ?? ""}
                  onChange={(e) => setForm({ ...form, purchaseInvoiceId: e.target.value ? Number(e.target.value) : undefined })}
                  options={purchaseInvoices.map((pi) => ({ id: String(pi.id), name: pi.invoiceNumber || `Invoice ${pi.id}` }))}
                />,
                <FloatingInput
                  label="Invoice Amount"
                  name="invoiceAmount"
                  type="number"
                  value={form.invoiceAmount ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Amount Paid"
                  name="amountPaid"
                  type="number"
                  value={form.amountPaid ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  label="Due Date"
                  name="dueDate"
                  type="date"
                  value={form.dueDate || ""}
                  onChange={handleChange}
                />,
                <FloatingSelect
                  label="Status"
                  name="accountsPayableStatus"
                  value={form.accountsPayableStatus || ""}
                  onChange={(e) => setForm({ ...form, accountsPayableStatus: e.target.value })}
                  options={toSelectOptions(payableStatuses)}
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
          innerText="Delete Record"
          subText={
            itemToDelete
              ? `Are you sure you want to delete the account payable record for "${itemToDelete.vendorName || "this vendor"}"? This action cannot be undone.`
              : "Are you sure you want to delete this record?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setItemToDelete(null)}
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

export default AccountsPayable;
