import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  EllipsisVerticalIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  BuildingOfficeIcon,
  TagIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  EyeIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  CheckBadgeIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

// =======================================================
// Enums
// =======================================================

export enum AccountType {
  ASSET = "ASSET",
  LIABILITY = "LIABILITY",
  EQUITY = "EQUITY",
  INCOME = "INCOME",
  EXPENSE = "EXPENSE"
}

export enum Currency {
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
  JPY = "JPY",
  AUD = "AUD",
  CAD = "CAD",
  CHF = "CHF",
  CNY = "CNY",
  SEK = "SEK",
  NZD = "NZD",
  INR = "INR",
  BRL = "BRL",
  ZAR = "ZAR",
  MXN = "MXN",
  RUB = "RUB",
  KRW = "KRW",
  SGD = "SGD",
  NOK = "NOK",
  TRY = "TRY",
  DKK = "DKK",
  PLN = "PLN"
}

// =======================================================
// TypeScript Types
// =======================================================

export interface GeneralAccount {
  id: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  isActive: boolean;
  description?: string;
  currency?: Currency;
  openingBalance: number;
  parentAccount?: GeneralAccount | null;
  allowTransactions: boolean;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Form Data Structure
interface GeneralAccountForm {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  isActive: boolean;
  description: string;
  currency: Currency;
  openingBalance: number;
  parentAccountId: number | null;
  allowTransactions: boolean;
}

// =======================================================
// API
// =======================================================

const API_URL = "/v1/api/invoice/general-accounts";
const PAGE_SIZE = 10;

// =======================================================
// Component
// =======================================================

const GeneralAccountPage: React.FC = () => {
  const [data, setData] = useState<GeneralAccount[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof GeneralAccount>("accountCode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<AccountType | "">("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GeneralAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<GeneralAccount | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  const [formData, setFormData] = useState<GeneralAccountForm>({
    accountCode: "",
    accountName: "",
    accountType: AccountType.ASSET,
    isActive: true,
    description: "",
    currency: Currency.USD,
    openingBalance: 0,
    parentAccountId: null,
    allowTransactions: true,
  });

  // =======================================================
  // Load Accounts
  // =======================================================

  const loadData = async () => {
    try {
      const res = await axios.get(API_URL);
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading accounts:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // =======================================================
  // CRUD
  // =======================================================

  const openAddForm = () => {
    setEditing(null);
    setFormData({
      accountCode: "",
      accountName: "",
      accountType: AccountType.ASSET,
      isActive: true,
      description: "",
      currency: Currency.USD,
      openingBalance: 0,
      parentAccountId: null,
      allowTransactions: true,
    });
    setFormOpen(true);
  };

  const openEditForm = (account: GeneralAccount) => {
    setEditing(account);
    setFormData({
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      isActive: account.isActive,
      description: account.description || "",
      currency: account.currency || Currency.USD,
      openingBalance: account.openingBalance,
      parentAccountId: account.parentAccount?.id ?? null,
      allowTransactions: account.allowTransactions,
    });
    setFormOpen(true);
  };

  const handleViewDetails = (account: GeneralAccount) => {
    setSelectedAccount(account);
    setShowDetailsModal(true);
  };

  const handleSave = async () => {
    if (!formData.accountCode || !formData.accountName) {
      ToasterService.error("Account Code & Account Name are required.");
      return;
    }

    try {
      if (editing) {
        await axios.put(`${API_URL}/${editing.id}`, formData);
      } else {
        await axios.post(API_URL, formData);
      }
      setFormOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      ToasterService.error("Error saving account");
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this account? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Account deleted successfully");
      loadData();
    } catch (err: any) {
      console.error(err);
      ToasterService.error(err.response?.data?.message || "Failed to delete account");
    }
  };

  // =======================================================
  // Export: Excel
  // =======================================================

  const exportToExcel = () => {
    const sheetData = data.map((a) => ({
      Code: a.accountCode,
      Name: a.accountName,
      Type: a.accountType,
      Currency: a.currency || Currency.USD,
      Active: a.isActive ? "Yes" : "No",
      Parent: a.parentAccount?.accountName || "-",
      'Opening Balance': a.openingBalance,
      'Allow Transactions': a.allowTransactions ? "Yes" : "No",
      Description: a.description || "",
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "General Accounts");
    XLSX.writeFile(wb, `GeneralAccounts_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  // =======================================================
  // Export: PDF
  // =======================================================

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("General Accounts Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const tableColumn = ["Code", "Name", "Type", "Curr", "Active", "Parent", "Opening Balance"];
    const tableRows = data.map((a) => [
      a.accountCode,
      a.accountName,
      a.accountType,
      a.currency || Currency.USD,
      a.isActive ? "Yes" : "No",
      a.parentAccount?.accountName || "-",
      a.openingBalance.toFixed(2),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`GeneralAccounts_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  }

  const filtered = data.filter((a) => {
    const matchesSearch = [
      a.accountName,
      a.accountCode,
      a.accountType,
      a.currency,
      a.parentAccount?.accountName
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType ? a.accountType === selectedType : true;

    return matchesSearch && matchesType;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "openingBalance") {
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

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const handleSort = (field: keyof GeneralAccount) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof GeneralAccount }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ?
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> :
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  const getTypeColor = (type: AccountType) => {
    switch (type) {
      case AccountType.ASSET:
        return "bg-blue-100 text-blue-800";
      case AccountType.LIABILITY:
        return "bg-yellow-100 text-yellow-800";
      case AccountType.EQUITY:
        return "bg-purple-100 text-purple-800";
      case AccountType.INCOME:
        return "bg-green-100 text-green-800";
      case AccountType.EXPENSE:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.ASSET:
        return <CurrencyDollarIcon className="h-4 w-4 text-blue-500" />;
      case AccountType.LIABILITY:
        return <TagIcon className="h-4 w-4 text-yellow-500" />;
      case AccountType.EQUITY:
        return <BuildingOfficeIcon className="h-4 w-4 text-purple-500" />;
      case AccountType.INCOME:
        return <DocumentTextIcon className="h-4 w-4 text-green-500" />;
      case AccountType.EXPENSE:
        return <CurrencyDollarIcon className="h-4 w-4 text-red-500" />;
      default:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <>
      <PageMeta title="General Accounts" description="Manage general ledger accounts" />
      <PageBreadcrumb pageTitle="General Accounts" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search accounts..."
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
            {/* Export Menu */}
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
                    onClick={exportToPDF}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                  >
                    <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                    PDF
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                  >
                    <TableCellsIcon className="h-4 w-4 text-green-600" />
                    Excel
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
              label="Add Account"
              onClick={openAddForm}
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as AccountType)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Types</option>
                  {Object.values(AccountType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              {selectedType && (
                <button
                  onClick={() => setSelectedType("")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
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
                <p className="text-sm text-gray-600">Total Accounts</p>
                <p className="text-2xl font-semibold text-gray-900">{data.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Accounts</p>
                <p className="text-2xl font-semibold text-green-600">
                  {data.filter(a => a.isActive).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckBadgeIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Parent Accounts</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {data.filter(a => !a.parentAccount).length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <UserGroupIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sub-Accounts</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {data.filter(a => a.parentAccount).length}
                </p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-full">
                <UsersIcon className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Table - Showing only most important information */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'accountCode', label: 'Code' },
                    { key: 'accountName', label: 'Name' },
                    { key: 'accountType', label: 'Type' },
                    { key: 'isActive', label: 'Status' },
                    { key: 'openingBalance', label: 'Balance' },
                    { key: null, label: 'Actions' },
                  ].map((column, index) => (
                    <th
                      key={index}
                      onClick={() => column.key && handleSort(column.key as keyof GeneralAccount)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                        }`}
                    >
                      <span className="flex items-center">
                        {column.label}
                        {column.key && <SortIcon column={column.key as keyof GeneralAccount} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length > 0 ? (
                  paginated.map((account) => (
                    <tr
                      key={account.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(account)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">
                          {account.accountCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{account.accountName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getTypeIcon(account.accountType)}
                          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(account.accountType)}`}>
                            {account.accountType}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {account.isActive ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {account.openingBalance.toFixed(2)} {account.currency || Currency.USD}
                        </span>
                      </td>
                      {/* Update the Actions column in the table */}
                      <td className="px-6 py-4 whitespace-nowrap text-right relative">
                        <Menu as="div" className="relative inline-block text-left">
                          <Menu.Button
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                          </Menu.Button>

                          {/* Use Portal to render dropdown outside the table container */}
                          <Menu.Items
                            className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]"
                            style={{ position: 'absolute', zIndex: 9999 }}
                          >
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(account);
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
                                    openEditForm(account);
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
                                    handleDelete(account.id);
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
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No accounts found</p>
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
                    Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(page * PAGE_SIZE, filtered.length)}
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

        {/* Account Form Modal */}
        <Modal
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          title={editing ? "Edit Account" : "Add New Account"}
          icon={<BuildingOfficeIcon className="h-5 w-5 text-cyan-600" />}
          size="lg"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="general-account-form"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                {editing ? "Update Account" : "Create Account"}
              </button>
            </div>
          }
        >
          <form id="general-account-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="e.g., 1000"
                    value={formData.accountCode}
                    onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="e.g., Cash"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Type
                  </label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as AccountType })}
                  >
                    {Object.values(AccountType).map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value as Currency })}
                  >
                    {Object.values(Currency).map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Account
                </label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  value={formData.parentAccountId ?? ""}
                  onChange={(e) => setFormData({
                    ...formData,
                    parentAccountId: e.target.value ? parseInt(e.target.value) : null,
                  })}
                >
                  <option value="">No Parent (Top Level Account)</option>
                  {data.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountCode} - {acc.accountName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opening Balance
                </label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  placeholder="0.00"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  rows={3}
                  placeholder="Enter account description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span className="ml-2 text-sm text-gray-700">Active</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                    checked={formData.allowTransactions}
                    onChange={(e) => setFormData({ ...formData, allowTransactions: e.target.checked })}
                  />
                  <span className="ml-2 text-sm text-gray-700">Allow Transactions</span>
                </label>
              </div>
            </div>
          </form>
        </Modal>

        {/* Account Details Modal */}
        <Modal
          isOpen={showDetailsModal && !!selectedAccount}
          onClose={() => setShowDetailsModal(false)}
          title="Account Details"
          icon={<EyeIcon className="h-5 w-5 text-cyan-600" />}
          size="2xl"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  openEditForm(selectedAccount!);
                }}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Edit Account
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
          {selectedAccount && (
            <div className="p-6">
              {/* Status Badge */}
              <div className="flex justify-end mb-4">
                {selectedAccount.isActive ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Inactive
                  </span>
                )}
              </div>

              {/* Account Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Account Code</p>
                  <p className="text-lg font-semibold font-mono text-gray-900">
                    {selectedAccount.accountCode}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Account Name</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedAccount.accountName}
                  </p>
                </div>
              </div>

              {/* Type and Currency */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Account Type</p>
                  <div className="flex items-center">
                    {getTypeIcon(selectedAccount.accountType)}
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(selectedAccount.accountType)}`}>
                      {selectedAccount.accountType}
                    </span>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Currency</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedAccount.currency || Currency.USD}
                  </p>
                </div>
              </div>

              {/* Parent Account */}
              {selectedAccount.parentAccount && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Parent Account</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedAccount.parentAccount.accountName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Code: {selectedAccount.parentAccount.accountCode}
                  </p>
                </div>
              )}

              {/* Financial Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Opening Balance</p>
                  <p className="text-xl font-bold text-cyan-600">
                    {selectedAccount.openingBalance.toFixed(2)} {selectedAccount.currency || Currency.USD}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Allow Transactions</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedAccount.allowTransactions ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedAccount.description && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Description</p>
                  <p className="text-gray-900">{selectedAccount.description}</p>
                </div>
              )}

              {/* Metadata */}
              {(selectedAccount.createdAt || selectedAccount.updatedAt) && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                    {selectedAccount.createdAt && (
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(selectedAccount.createdAt).toLocaleString()}
                      </div>
                    )}
                    {selectedAccount.updatedAt && (
                      <div>
                        <span className="font-medium">Updated:</span>{' '}
                        {new Date(selectedAccount.updatedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
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
      </div>
    </>
  );
};

export default GeneralAccountPage;