import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  TagIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  EyeIcon,
  ReceiptPercentIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  PrinterIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  ReceiptRefundIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ToasterService } from "../../Services/ToasterService";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

/* -------------------- Enums -------------------- */

export enum RevenueExpenseType {
  REVENUE = "REVENUE",
  EXPENSE = "EXPENSE"
}

export enum RevenueExpenseCategory {
  RENT = "RENT",
  FREIGHT = "FREIGHT",
  MISC = "MISC",
  SALARY = "SALARY",
  UTILITIES = "UTILITIES",
  OFFICE_SUPPLIES = "OFFICE_SUPPLIES",
  MAINTENANCE = "MAINTENANCE",
  TRAVEL = "TRAVEL",
  ENTERTAINMENT = "ENTERTAINMENT",
  ADVERTISING = "ADVERTISING",
  INSURANCE = "INSURANCE",
  TAXES = "TAXES",
  DEPRECIATION = "DEPRECIATION",
  INTEREST = "INTEREST",
  OTHER = "OTHER"
}

/* -------------------- Interfaces -------------------- */

interface GeneralAccount {
  id: number;
  accountCode: string;
  accountName: string;
}

interface ExpenseRevenueItem {
  [x: string]: any;
  id?: number;
  revenueExpenseType: RevenueExpenseType;
  revenueExpenseCategory: RevenueExpenseCategory;
  description: string;
  amount: number;
  transactionDate: string;
  generalAccountId: number;
  generalAccount?: GeneralAccount;
  paymentMethod?: string;
  referenceNumber?: string;
}

// Payload interface with nested generalAccount object
interface ExpenseRevenuePayload {
  revenueExpenseType: RevenueExpenseType;
  revenueExpenseCategory: RevenueExpenseCategory;
  description: string;
  amount: number;
  transactionDate: string;
  generalAccount: {
    id: number;
  };
  paymentMethod?: string;
  referenceNumber?: string;
}

/* -------------------- API -------------------- */
const API_URL = "/v1/api/invoice/expenses-revenue";
const ACCOUNT_API = "/v1/api/invoice/general-accounts";
const ITEMS_PER_PAGE = 10;

/* -------------------- Component -------------------- */

const ExpenseRevenueItemPage: React.FC = () => {
  const [items, setItems] = useState<ExpenseRevenueItem[]>([]);
  const [accounts, setAccounts] = useState<GeneralAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof ExpenseRevenueItem>("transactionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<RevenueExpenseType | "">("");
  const [selectedCategory, setSelectedCategory] = useState<RevenueExpenseCategory | "">("");
  const [selectedItem, setSelectedItem] = useState<ExpenseRevenueItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  const [form, setForm] = useState<ExpenseRevenueItem>({
    id: undefined,
    generalAccountId: 0,
    revenueExpenseType: RevenueExpenseType.EXPENSE,
    revenueExpenseCategory: RevenueExpenseCategory.RENT,
    description: "",
    amount: 0,
    transactionDate: new Date().toISOString().split('T')[0],
    paymentMethod: "",
    referenceNumber: ""
  });

  const voucherRef = useRef<HTMLDivElement>(null);

  /* -------------------- Fetch Data -------------------- */
  const loadItems = async () => {
    try {
      const res = await axios.get(API_URL);
      console.log("Expense/Revenue Items:", res.data);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to load items", error);
      ToasterService.error("Failed to load items");
    }
  };

  const loadAccounts = async () => {
    try {
      const acc = await axios.get(ACCOUNT_API);
      console.log("Accounts:", acc.data);
      setAccounts(Array.isArray(acc.data) ? acc.data : []);
    } catch (error) {
      console.error("Failed to load accounts", error);
      ToasterService.error("Failed to load accounts");
    }
  };

  useEffect(() => {
    loadItems();
    loadAccounts();
  }, []);

  /* -------------------- Helpers -------------------- */
  const clearForm = () => {
    setForm({
      revenueExpenseType: RevenueExpenseType.EXPENSE,
      revenueExpenseCategory: RevenueExpenseCategory.MISC,
      description: "",
      amount: 0,
      transactionDate: new Date().toISOString().split('T')[0],
      generalAccountId: 0,
      paymentMethod: "",
      referenceNumber: "",
    });
    setEditingId(null);
  };

  const handleChange = (key: keyof ExpenseRevenueItem, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (item: ExpenseRevenueItem) => {
    setForm({
      ...item,
      generalAccountId: item.generalAccount?.id || item.generalAccountId || 0,
      transactionDate: item.transactionDate.split('T')[0]
    });
    setEditingId(item.id || null);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this item? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Item deleted successfully");
      loadItems();
      loadAccounts();
    } catch (error: any) {
      console.error("Delete failed", error);
      ToasterService.error(error.response?.data?.message || "Failed to delete item");
    }
  };

  const handleViewDetails = (item: ExpenseRevenueItem) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!form.generalAccountId || form.generalAccountId === 0) {
      ToasterService.error("Please select a general account");
      return;
    }

    if (!form.description) {
      ToasterService.error("Description is required");
      return;
    }

    if (form.amount <= 0) {
      ToasterService.error("Amount must be greater than 0");
      return;
    }

    // Create payload with nested generalAccount object
    const payload: ExpenseRevenuePayload = {
      revenueExpenseType: form.revenueExpenseType,
      revenueExpenseCategory: form.revenueExpenseCategory,
      description: form.description,
      amount: form.amount,
      transactionDate: form.transactionDate,
      generalAccount: {
        id: form.generalAccountId
      },
      paymentMethod: form.paymentMethod,
      referenceNumber: form.referenceNumber
    };

    console.log("Submitting payload:", payload);

    try {
      if (editingId) {
        // For PUT request, ensure the ID is in the URL and payload doesn't contain id
        await axios.put(`${API_URL}/${editingId}`, payload);
        ToasterService.success("Item updated successfully");
      } else {
        await axios.post(API_URL, payload);
        ToasterService.success("Item created successfully");
      }
      loadItems();
      loadAccounts();
      clearForm();
      setShowForm(false);
    } catch (error: any) {
      console.error("Save failed", error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
        console.error("Error response headers:", error.response.headers);
        ToasterService.error(`Error: ${error.response.data.message || error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Error request:", error.request);
        ToasterService.error("No response from server");
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error message:", error.message);
        ToasterService.error("Error saving item");
      }
    }
  };

  /* -------------------- Filter & Pagination -------------------- */
  const filtered = items.filter((i) => {
    const matchesSearch = [
      i.description,
      i.revenueExpenseCategory,
      i.revenueExpenseType,
      i.paymentMethod,
      i.referenceNumber,
      accounts.find(a => a.id === (i.generalAccountId || i.generalAccount?.id))?.accountName
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType ? i.revenueExpenseType === selectedType : true;
    const matchesCategory = selectedCategory ? i.revenueExpenseCategory === selectedCategory : true;

    return matchesSearch && matchesType && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "transactionDate") {
      const dateA = new Date(valA as string).getTime();
      const dateB = new Date(valB as string).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (sortKey === "amount") {
      return sortOrder === "asc"
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return 0;
  });

  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);

  const handleSort = (field: keyof ExpenseRevenueItem) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof ExpenseRevenueItem }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ?
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> :
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  /* -------------------- Export / Print -------------------- */
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Expense & Revenue Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: [["Type", "Category", "Description", "Amount", "Date", "Account", "Payment", "Ref#"]],
      body: items.map(i => [
        i.revenueExpenseType,
        i.revenueExpenseCategory,
        i.description,
        i.amount.toFixed(2),
        new Date(i.transactionDate).toLocaleDateString(),
        accounts.find(a => a.id === (i.generalAccountId || i.generalAccount?.id))?.accountName || "",
        i.paymentMethod || "",
        i.referenceNumber || ""
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`expense_revenue_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const wsData = items.map(i => ({
      Type: i.revenueExpenseType,
      Category: i.revenueExpenseCategory,
      Description: i.description,
      Amount: i.amount.toFixed(2),
      Date: new Date(i.transactionDate).toLocaleDateString(),
      Account: accounts.find(a => a.id === (i.generalAccountId || i.generalAccount?.id))?.accountName || "",
      'Payment Method': i.paymentMethod || "",
      'Reference Number': i.referenceNumber || ""
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ExpenseRevenue");
    XLSX.writeFile(wb, `expense_revenue_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  const printVoucher = () => {
    if (!voucherRef.current) return;
    const printContents = voucherRef.current.innerHTML;
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Expense/Revenue Voucher</title>
            <style>
              body { font-family: 'Nunito', sans-serif; padding: 20px; }
              h2 { color: #333; text-align: center; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { background: #f3f4f6; padding: 10px; text-align: left; border: 1px solid #e5e7eb; }
              td { padding: 8px; border: 1px solid #e5e7eb; }
              .total-row { font-weight: bold; border-top: 2px solid #000; }
            </style>
          </head>
          <body>${printContents}</body>
        </html>
      `);
      newWindow.document.close();
      newWindow.print();
    }
    setShowExportMenu(false);
  };

  const getTypeIcon = (type: RevenueExpenseType) => {
    switch (type) {
      case RevenueExpenseType.REVENUE:
        return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
      case RevenueExpenseType.EXPENSE:
        return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
      default:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTypeColor = (type: RevenueExpenseType) => {
    switch (type) {
      case RevenueExpenseType.REVENUE:
        return "bg-green-100 text-green-800";
      case RevenueExpenseType.EXPENSE:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryColor = (category: RevenueExpenseCategory) => {
    switch (category) {
      case RevenueExpenseCategory.RENT:
        return "bg-blue-100 text-blue-800";
      case RevenueExpenseCategory.FREIGHT:
        return "bg-purple-100 text-purple-800";
      case RevenueExpenseCategory.SALARY:
        return "bg-yellow-100 text-yellow-800";
      case RevenueExpenseCategory.UTILITIES:
        return "bg-indigo-100 text-indigo-800";
      case RevenueExpenseCategory.OFFICE_SUPPLIES:
        return "bg-pink-100 text-pink-800";
      case RevenueExpenseCategory.MAINTENANCE:
        return "bg-orange-100 text-orange-800";
      case RevenueExpenseCategory.TRAVEL:
        return "bg-teal-100 text-teal-800";
      case RevenueExpenseCategory.ENTERTAINMENT:
        return "bg-amber-100 text-amber-800";
      case RevenueExpenseCategory.ADVERTISING:
        return "bg-rose-100 text-rose-800";
      case RevenueExpenseCategory.INSURANCE:
        return "bg-lime-100 text-lime-800";
      case RevenueExpenseCategory.TAXES:
        return "bg-red-100 text-red-800";
      case RevenueExpenseCategory.DEPRECIATION:
        return "bg-gray-100 text-gray-800";
      case RevenueExpenseCategory.INTEREST:
        return "bg-emerald-100 text-emerald-800";
      case RevenueExpenseCategory.MISC:
        return "bg-gray-100 text-gray-800";
      case RevenueExpenseCategory.OTHER:
        return "bg-stone-100 text-stone-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <PageMeta title="Expense & Revenue" description="Manage expenses and revenue items" />
      <PageBreadcrumb pageTitle="Expense & Revenue" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Export Menu with Share Icon */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <ShareIcon className="h-5 w-5 text-gray-600" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                  <button
                    onClick={exportPDF}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                    PDF
                  </button>
                  <button
                    onClick={exportExcel}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                  >
                    <TableCellsIcon className="h-4 w-4 text-green-600" />
                    Excel
                  </button>
                  <button
                    onClick={printVoucher}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                  >
                    <PrinterIcon className="h-4 w-4 text-purple-600" />
                    Print
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
            </button>
            <AddButton
              label="Add Item"
              onClick={() => {
                clearForm();
                setShowForm(true);
              }}
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as RevenueExpenseType)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Types</option>
                  {Object.values(RevenueExpenseType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as RevenueExpenseCategory)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Categories</option>
                  {Object.values(RevenueExpenseCategory).map((category) => (
                    <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              {(selectedType || selectedCategory) && (
                <button
                  onClick={() => {
                    setSelectedType("");
                    setSelectedCategory("");
                  }}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards with Icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-2xl font-semibold text-gray-900">{items.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-semibold text-green-600">
                  {items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + (i.amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <BanknotesIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-2xl font-semibold text-red-600">
                  {items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + (i.amount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <ReceiptRefundIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Balance</p>
                <p className={`text-2xl font-semibold ${items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + (i.amount || 0), 0) -
                  items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + (i.amount || 0), 0) >= 0
                  ? 'text-cyan-600' : 'text-red-600'
                  }`}>
                  {(
                    items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + (i.amount || 0), 0) -
                    items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + (i.amount || 0), 0)
                  ).toFixed(2)}
                </p>
              </div>
              <div className={`p-3 rounded-full ${items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + (i.amount || 0), 0) -
                items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + (i.amount || 0), 0) >= 0
                ? 'bg-cyan-100' : 'bg-red-100'
                }`}>
                <CurrencyDollarIcon className={`h-6 w-6 ${items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + (i.amount || 0), 0) -
                  items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + (i.amount || 0), 0) >= 0
                  ? 'text-cyan-600' : 'text-red-600'
                  }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {!showForm && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: 'revenueExpenseType', label: 'Type' },
                      { key: 'revenueExpenseCategory', label: 'Category' },
                      { key: 'description', label: 'Description' },
                      { key: 'amount', label: 'Amount' },
                      { key: 'transactionDate', label: 'Date' },
                      { key: null, label: 'Account' },
                      { key: null, label: 'Actions' },
                    ].map((column, index) => (
                      <th
                        key={index}
                        onClick={() => column.key && handleSort(column.key as keyof ExpenseRevenueItem)}
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                      >
                        <span className="flex items-center">
                          {column.label}
                          {column.key && <SortIcon column={column.key as keyof ExpenseRevenueItem} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginated.length > 0 ? (
                    paginated.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(item)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(item.revenueExpenseType)}`}>
                            {getTypeIcon(item.revenueExpenseType)}
                            <span className="ml-1">{item.revenueExpenseType}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.revenueExpenseCategory)}`}>
                            <TagIcon className="h-3 w-3 mr-1" />
                            {item.revenueExpenseCategory.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{item.description}</div>
                          {item.referenceNumber && (
                            <div className="text-xs text-gray-500">Ref: {item.referenceNumber}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`flex items-center text-sm font-medium ${item.revenueExpenseType === RevenueExpenseType.REVENUE ? 'text-green-600' : 'text-red-600'
                            }`}>
                            <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                            {item.amount.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-500">
                            <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                            {new Date(item.transactionDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-1" />
                            {accounts.find(a => a.id === (item.generalAccountId || item.generalAccount?.id))?.accountName || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right relative">
                          <Menu as="div" className="relative inline-block text-left">
                            <Menu.Button
                              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                            </Menu.Button>
                            <Menu.Items
                              className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200"
                              style={{ zIndex: 9999 }}
                            >
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDetails(item);
                                    }}
                                    className={`${active ? "bg-gray-50" : ""
                                      } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                  >
                                    <EyeIcon className="h-4 w-4 text-blue-600" />
                                    View Details
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(item);
                                    }}
                                    className={`${active ? "bg-gray-50" : ""
                                      } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                  >
                                    <PencilSquareIcon className="h-4 w-4 text-cyan-600" />
                                    Edit
                                  </button>
                                )}
                              </Menu.Item>
                              <Menu.Item>
                                {({ active }) => (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item.id!);
                                    }}
                                    className={`${active ? "bg-gray-50" : ""
                                      } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600`}
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                    Delete
                                  </button>
                                )}
                              </Menu.Item>
                            </Menu.Items>
                          </Menu>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                          <p className="text-gray-500 text-sm mb-2">No items found</p>
                          <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                      <span className="font-medium">
                        {Math.min(page * ITEMS_PER_PAGE, filtered.length)}
                      </span>{' '}
                      of <span className="font-medium">{filtered.length}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = page;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                              ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                              : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Last
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Modal */}
        <Modal
          isOpen={showForm}
          onClose={() => {
            clearForm();
            setShowForm(false);
          }}
          title={editingId ? "Edit Item" : "Add New Item"}
          icon={<BanknotesIcon className="h-5 w-5 text-cyan-600" />}
          size="2xl"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  clearForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-revenue-form"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                {editingId ? "Update Item" : "Create Item"}
              </button>
            </div>
          }
        >
          <form id="expense-revenue-form" onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  value={form.revenueExpenseType}
                  onChange={e => handleChange("revenueExpenseType", e.target.value as RevenueExpenseType)}
                  required
                >
                  {Object.values(RevenueExpenseType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  value={form.revenueExpenseCategory}
                  onChange={e => handleChange("revenueExpenseCategory", e.target.value as RevenueExpenseCategory)}
                  required
                >
                  {Object.values(RevenueExpenseCategory).map((category) => (
                    <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  placeholder="Enter description"
                  value={form.description}
                  onChange={e => handleChange("description", e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 pl-7"
                    placeholder="0.00"
                    value={form.amount}
                    step="0.01"
                    min="0.01"
                    onChange={e => handleChange("amount", Number(e.target.value))}
                    required
                  />
                  <CurrencyDollarIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  selected={form.transactionDate ? new Date(form.transactionDate) : null}
                  onChange={(date) => handleChange("transactionDate", date ? date.toISOString().split('T')[0] : "")}
                  dateFormat="yyyy-MM-dd"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  General Account <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  value={form.generalAccountId || 0}
                  onChange={e => handleChange("generalAccountId", Number(e.target.value))}
                  required
                >
                  <option value={0}>Select Account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} - {a.accountName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <input
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., Cash, Card"
                  value={form.paymentMethod}
                  onChange={e => handleChange("paymentMethod", e.target.value)}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Number
                </label>
                <input
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  placeholder="e.g., INV-001"
                  value={form.referenceNumber}
                  onChange={e => handleChange("referenceNumber", e.target.value)}
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Details Modal */}
        <Modal
          isOpen={showDetailsModal && !!selectedItem}
          onClose={() => setShowDetailsModal(false)}
          title="Item Details"
          icon={<EyeIcon className="h-5 w-5 text-cyan-600" />}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleEdit(selectedItem!);
                }}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Edit Item
              </button>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          }
        >
          {selectedItem && (
            <div className="p-6">
              {/* Type and Category */}
              <div className="flex justify-between items-start mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTypeColor(selectedItem.revenueExpenseType)}`}>
                  {getTypeIcon(selectedItem.revenueExpenseType)}
                  <span className="ml-1">{selectedItem.revenueExpenseType}</span>
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(selectedItem.revenueExpenseCategory)}`}>
                  <TagIcon className="h-4 w-4 mr-1" />
                  {selectedItem.revenueExpenseCategory.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Description */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-lg font-semibold text-gray-900">{selectedItem.description}</p>
              </div>

              {/* Amount and Date */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Amount</p>
                  <p className={`text-2xl font-bold ${selectedItem.revenueExpenseType === RevenueExpenseType.REVENUE ? 'text-green-600' : 'text-red-600'
                    }`}>
                    {selectedItem.amount.toFixed(2)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Transaction Date</p>
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(selectedItem.transactionDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Account</p>
                <div className="flex items-center">
                  <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                  <p className="text-lg font-semibold text-gray-900">
                    {accounts.find(a => a.id === (selectedItem.generalAccountId || selectedItem.generalAccount?.id))?.accountName || 'N/A'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Code: {accounts.find(a => a.id === (selectedItem.generalAccountId || selectedItem.generalAccount?.id))?.accountCode || 'N/A'}
                </p>
              </div>

              {/* Payment Details */}
              {(selectedItem.paymentMethod || selectedItem.referenceNumber) && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {selectedItem.paymentMethod && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedItem.paymentMethod}</p>
                    </div>
                  )}
                  {selectedItem.referenceNumber && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Reference Number</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedItem.referenceNumber}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ID */}
              {selectedItem.id && (
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500">ID: {selectedItem.id}</p>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Global Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          variant={confirmState.variant}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />

        {/* Hidden Print Voucher */}
        <div style={{ display: "none" }}>
          <div ref={voucherRef}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Expense/Revenue Voucher</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Type</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Category</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Description</th>
                  <th style={{ padding: '10px', textAlign: 'right', border: '1px solid #e5e7eb' }}>Amount</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Date</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Account</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Payment</th>
                  <th style={{ padding: '10px', textAlign: 'left', border: '1px solid #e5e7eb' }}>Ref#</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id}>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{i.revenueExpenseType}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{i.revenueExpenseCategory.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{i.description}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'right' }}>{i.amount.toFixed(2)}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{new Date(i.transactionDate).toLocaleDateString()}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{accounts.find(a => a.id === (i.generalAccountId || i.generalAccount?.id))?.accountName}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{i.paymentMethod}</td>
                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{i.referenceNumber}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Totals:</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', borderTop: '2px solid #000' }}>
                    Revenue: {items.filter(i => i.revenueExpenseType === RevenueExpenseType.REVENUE).reduce((sum, i) => sum + i.amount, 0).toFixed(2)}<br />
                    Expense: {items.filter(i => i.revenueExpenseType === RevenueExpenseType.EXPENSE).reduce((sum, i) => sum + i.amount, 0).toFixed(2)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExpenseRevenueItemPage;