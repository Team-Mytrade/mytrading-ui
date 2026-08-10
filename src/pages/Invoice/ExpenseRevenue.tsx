import React, { useEffect, useState, ChangeEvent, FormEvent, useMemo } from "react";
import PaginatedPopup from "../../components/common/unpopup";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
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

interface ExpenseRevenueItem {
  id: number;
  revenueExpenseType?: string;
  revenueExpenseCategory?: string;
  description?: string;
  amount?: number;
  transactionDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
}

const API_URL = "/v1/api/invoice/expenses-revenue";
const PAGE_SIZE = 10;

const REVENUE_EXPENSE_TYPES = ["EXPENSE", "REVENUE", "TRANSFER", "ADJUSTMENT", "CREDIT_NOTE", "DEBIT_NOTE", "REFUND", "CHARGEBACK", "WRITE_OFF", "OTHER"];
const REVENUE_EXPENSE_CATEGORIES = ["RENT", "FREIGHT", "MISC", "SALARY", "UTILITIES", "OFFICE_SUPPLIES", "MAINTENANCE", "TRAVEL", "ENTERTAINMENT", "ADVERTISING", "INSURANCE", "TAXES", "DEPRECIATION", "INTEREST", "OTHER"];

const typeTone = (type?: string) => {
  switch (type) {
    case "EXPENSE":
      return "bg-red-50 text-red-700 border-red-200/40";
    case "REVENUE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/40";
    case "REFUND":
      return "bg-blue-50 text-blue-700 border-blue-200/40";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200/40";
  }
};

const ExpenseRevenue: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [items, setItems] = useState<ExpenseRevenueItem[]>([]);
  const [form, setForm] = useState<Partial<ExpenseRevenueItem>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ExpenseRevenueItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get<ExpenseRevenueItem[]>(API_URL, { headers });
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching expenses and revenue", err);
      ToasterService.error("Failed to load expenses and revenue");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.description?.trim()) {
      ToasterService.error("Description is required");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        editingId !== null
          ? await axios.put(`${API_URL}/${editingId}`, form, { headers })
          : await axios.post(API_URL, form, { headers });
      if (res.status === 200 || res.status === 201) {
        ToasterService.success(editingId !== null ? "Item updated successfully!" : "Item added successfully!");
        setShowFormModal(false);
        setForm({});
        setEditingId(null);
        await fetchItems();
      }
    } catch (err) {
      console.error("Error submitting expense/revenue item", err);
      ToasterService.error("Failed to save item");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: ExpenseRevenueItem) => {
    setForm(item);
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

  const handleDelete = (item: ExpenseRevenueItem) => {
    setItemToDelete(item);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await axios.delete(`${API_URL}/${itemToDelete.id}`, { headers });
      ToasterService.success("Item deleted successfully!");
      setShowDeletePopup(false);
      setItemToDelete(null);
      fetchItems();
    } catch (err) {
      console.error("Error deleting expense/revenue item", err);
      ToasterService.error("Failed to delete item");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const term = search.toLowerCase();
      const matchesSearch =
        (item.description || "").toLowerCase().includes(term) ||
        (item.revenueExpenseType || "").toLowerCase().includes(term) ||
        (item.referenceNumber || "").toLowerCase().includes(term);

      let matchesFilter = true;
      if (activeFilter === "EXPENSE") {
        matchesFilter = item.revenueExpenseType === "EXPENSE";
      } else if (activeFilter === "REVENUE") {
        matchesFilter = item.revenueExpenseType === "REVENUE";
      } else if (activeFilter === "REFUND") {
        matchesFilter = item.revenueExpenseType === "REFUND";
      }

      return matchesSearch && matchesFilter;
    });
  }, [items, search, activeFilter]);

  const stats = useMemo(
    () => ({
      totalItems: items.length,
      expenses: items.filter((i) => i.revenueExpenseType === "EXPENSE").length,
      revenue: items.filter((i) => i.revenueExpenseType === "REVENUE").length,
      totalAmount: items.reduce((acc, i) => acc + Number(i.amount || 0), 0),
    }),
    [items]
  );

  const tableColumns: ColumnDef<ExpenseRevenueItem>[] = [
    {
      key: "description",
      label: "Description",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <CheckCircleIcon className="h-4 w-4 text-cyan-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate leading-snug">
            {item.description || "Unnamed Item"}
          </span>
        </div>
      ),
    },
    {
      key: "revenueExpenseType",
      label: "Type",
      sortable: true,
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (item) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${typeTone(item.revenueExpenseType)}`}>
          {item.revenueExpenseType || "N/A"}
        </span>
      ),
    },
    {
      key: "revenueExpenseCategory",
      label: "Category",
      sortable: true,
      headerClassName: "w-[14%] text-left",
      className: "w-[14%]",
      render: (item) => (
        <span className="text-sm text-slate-600 truncate">{item.revenueExpenseCategory || "N/A"}</span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      headerClassName: "w-[14%] text-right",
      className: "w-[14%] text-right",
      sortValueGetter: (item) => Number(item.amount || 0),
      render: (item) => (
        <span className="text-sm font-semibold text-slate-700">
          {Number(item.amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "transactionDate",
      label: "Transaction Date",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (item) => (
        <span className="text-sm text-slate-600">
          {item.transactionDate ? new Date(item.transactionDate).toLocaleDateString() : "N/A"}
        </span>
      ),
    },
    {
      key: "referenceNumber",
      label: "Reference Number",
      sortable: true,
      headerClassName: "w-[15%] text-left",
      className: "w-[15%]",
      render: (item) => (
        <span className="text-sm text-slate-600 truncate">{item.referenceNumber || "N/A"}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[14%] text-right pr-4",
      className: "w-[14%] text-right",
      render: (item) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => handleEdit(item)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Item"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(item)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Item"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Expenses & Revenue" description="Manage expenses and revenue" />
      <PageBreadcrumb pageTitle="Expenses & Revenue" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Item" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Items"
            value={stats.totalItems}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Expenses"
            value={stats.expenses}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
          <StatsCard
            label="Revenue"
            value={stats.revenue}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Total Amount"
            value={stats.totalAmount.toLocaleString()}
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
                placeholder="Search items by description, type, or reference..."
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
              title="Filter Expenses & Revenue"
              buttonLabel="Filters"
              label="Filter by Type"
              value={activeFilter}
              options={[
                { label: "All Items", value: "ALL" },
                { label: "Expenses", value: "EXPENSE" },
                { label: "Revenue", value: "REVENUE" },
                { label: "Refunds", value: "REFUND" },
              ]}
              onChange={setActiveFilter}
              onReset={() => setActiveFilter("ALL")}
              onApply={() => undefined}
            />
          </div>
        </div>

        <ReusableTable
          data={filteredItems}
          columns={tableColumns}
          pageSize={PAGE_SIZE}
          defaultSortKey="description"
          defaultSortOrder="asc"
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircleIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No expense or revenue items found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={() => openCreate()}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first expense or revenue item
                </button>
              )}
            </div>
          }
        />

        <PaginatedPopup
          isOpen={showFormModal}
          title={editingId !== null ? "Edit Expense / Revenue" : "Create New Expense / Revenue"}
          subtitle={editingId !== null ? "Update this expense or revenue item" : "Add a new expense or revenue item"}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update Item" : "Create Item"}
          maxWidthClassName="max-w-2xl"
          tabs={[
            {
              label: "Basic Info",
              fields: [
                <FloatingInput
                  key="description"
                  label="Description"
                  name="description"
                  value={form.description || ""}
                  onChange={handleChange}
                  required
                />,
                <FloatingSelect
                  key="revenueExpenseType"
                  label="Type"
                  name="revenueExpenseType"
                  value={form.revenueExpenseType || ""}
                  onChange={(e) => setForm({ ...form, revenueExpenseType: e.target.value })}
                  options={REVENUE_EXPENSE_TYPES.map((t) => ({ id: t, name: t }))}
                />,
                <FloatingSelect
                  key="revenueExpenseCategory"
                  label="Category"
                  name="revenueExpenseCategory"
                  value={form.revenueExpenseCategory || ""}
                  onChange={(e) => setForm({ ...form, revenueExpenseCategory: e.target.value })}
                  options={REVENUE_EXPENSE_CATEGORIES.map((c) => ({ id: c, name: c }))}
                />,
                <FloatingInput
                  key="amount"
                  label="Amount"
                  name="amount"
                  type="number"
                  value={form.amount ?? ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="transactionDate"
                  label="Transaction Date"
                  name="transactionDate"
                  type="date"
                  value={form.transactionDate || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="paymentMethod"
                  label="Payment Method"
                  name="paymentMethod"
                  value={form.paymentMethod || ""}
                  onChange={handleChange}
                />,
                <FloatingInput
                  key="referenceNumber"
                  label="Reference Number"
                  name="referenceNumber"
                  value={form.referenceNumber || ""}
                  onChange={handleChange}
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
          innerText="Delete Item"
          subText={
            itemToDelete
              ? `Are you sure you want to delete "${itemToDelete.description}"? This action cannot be undone.`
              : "Are you sure you want to delete this item?"
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setItemToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />


      </div>
    </>
  );
};

export default ExpenseRevenue;
