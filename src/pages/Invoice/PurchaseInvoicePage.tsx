import React, { useEffect, useState } from "react";
import axios from "axios";
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
  BuildingOfficeIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  TagIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ReceiptPercentIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const BASE_URL = "/v1/api/invoice/purchase-invoices";
const ITEMS_PER_PAGE = 6;

type Status = "OPEN" | "PARTIALLY_PAID" | "PAID";

interface Vendor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

interface PurchaseInvoice {
  id?: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  purchaseInvoiceStatus: Status;
  vendor: Vendor;
  currency: string;
  referenceNumber: string;
  notes: string;
}

// ---------------- COMPONENT ----------------
const PurchaseInvoicePage: React.FC = () => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof PurchaseInvoice>("invoiceDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [status, setStatus] = useState<Status>("OPEN");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  // ---------------- LOAD DATA ----------------
  useEffect(() => {
    loadInvoices();
    loadVendors();
  }, []);

  const loadInvoices = async () => {
    try {
      const res = await axios.get(BASE_URL);
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    }
  };

  const loadVendors = async () => {
    try {
      const res = await axios.get("/v1/api/invoice/vendors");
      setVendors(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load vendors:", err);
    }
  };

  // ---------------- RESET FORM ----------------
  const clearForm = () => {
    setInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate("");
    setTotalAmount(0);
    setStatus("OPEN");
    setVendorId("");
    setCurrency("USD");
    setReferenceNumber("");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  };

  // ---------------- CREATE / UPDATE ----------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: PurchaseInvoice = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      totalAmount,
      purchaseInvoiceStatus: status,
      vendor: vendors.find((v) => v.id === vendorId)!,
      currency,
      referenceNumber,
      notes,
    };

    try {
      if (editingId) {
        await axios.put(`${BASE_URL}/${editingId}`, payload);
      } else {
        await axios.post(BASE_URL, payload);
      }

      loadInvoices();
      clearForm();
    } catch (err) {
      console.error("Failed to save invoice:", err);
      alert("Failed to save invoice");
    }
  };

  // ---------------- EDIT ----------------
  const handleEdit = (inv: PurchaseInvoice) => {
    setInvoiceNumber(inv.invoiceNumber);
    setInvoiceDate(inv.invoiceDate.split('T')[0]);
    setDueDate(inv.dueDate.split('T')[0]);
    setTotalAmount(inv.totalAmount);
    setStatus(inv.purchaseInvoiceStatus);
    setVendorId(inv.vendor?.id ?? "");
    setCurrency(inv.currency);
    setReferenceNumber(inv.referenceNumber);
    setNotes(inv.notes);

    setEditingId(inv.id!);
    setShowForm(true);
  };

  // ---------------- VIEW DETAILS ----------------
  const handleViewDetails = (inv: PurchaseInvoice) => {
    setSelectedInvoice(inv);
    setShowDetailsModal(true);
  };

  // ---------------- DELETE ----------------
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await axios.delete(`${BASE_URL}/${id}`);
      loadInvoices();
    } catch (err) {
      console.error("Failed to delete invoice:", err);
      alert("Failed to delete invoice");
    }
  };

  // ---------------- EXPORT FUNCTIONS ----------------
  const exportPDF = () => {
    // Implementation similar to other components
    console.log('Export PDF');
  };

  const exportExcel = () => {
    // Implementation similar to other components
    console.log('Export Excel');
  };

  // ---------------- SORT / SEARCH / FILTER / PAGINATION ----------------
  const filtered = invoices.filter((inv) => {
    const matchesSearch = [
      inv.invoiceNumber,
      inv.vendor?.name,
      inv.referenceNumber,
      inv.notes
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = selectedStatus ? inv.purchaseInvoiceStatus === selectedStatus : true;

    return matchesSearch && matchesStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "invoiceDate" || sortKey === "dueDate") {
      const dateA = new Date(valA as string).getTime();
      const dateB = new Date(valB as string).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (sortKey === "totalAmount") {
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

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSort = (field: keyof PurchaseInvoice) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof PurchaseInvoice }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ? 
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : 
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-800";
      case "PARTIALLY_PAID":
        return "bg-yellow-100 text-yellow-800";
      case "OPEN":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case "PAID":
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "PARTIALLY_PAID":
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case "OPEN":
        return <ReceiptPercentIcon className="h-4 w-4 text-blue-500" />;
      default:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <>
      <PageMeta title="Purchase Invoices" description="Manage purchase invoices" />
      <PageBreadcrumb pageTitle="Purchase Invoices" />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by invoice #, vendor, or reference..."
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
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={exportPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={exportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <TableCellsIcon className="h-5 w-5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border ${
                showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
            </button>
            <AddButton
              label="Add Invoice"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
              {selectedStatus && (
                <button
                  onClick={() => setSelectedStatus("")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Total Invoices" value={invoices.length} gradient="from-blue-50 to-white" borderColor="border-blue-100" labelColor="text-blue-700" icon={<DocumentTextIcon className="h-6 w-6 text-blue-600" />} />
          <StatsCard label="Total Amount" value={`$${invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toFixed(2)}`} gradient="from-cyan-50 to-white" borderColor="border-cyan-100" labelColor="text-cyan-700" icon={<CurrencyDollarIcon className="h-6 w-6 text-cyan-600" />} />
          <StatsCard label="Paid" value={invoices.filter(inv => inv.purchaseInvoiceStatus === "PAID").length} gradient="from-green-50 to-white" borderColor="border-green-100" labelColor="text-green-700" icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />} />
          <StatsCard label="Open" value={invoices.filter(inv => inv.purchaseInvoiceStatus === "OPEN").length} gradient="from-blue-50 to-white" borderColor="border-blue-100" labelColor="text-blue-700" icon={<ReceiptPercentIcon className="h-6 w-6 text-blue-600" />} />
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'invoiceNumber', label: 'Invoice #' },
                    { key: null, label: 'Vendor' },
                    { key: 'invoiceDate', label: 'Invoice Date' },
                    { key: 'dueDate', label: 'Due Date' },
                    { key: 'totalAmount', label: 'Amount' },
                    { key: null, label: 'Currency' },
                    { key: 'purchaseInvoiceStatus', label: 'Status' },
                    { key: null, label: 'Actions' },
                  ].map((column, index) => (
                    <th
                      key={index}
                      onClick={() => column.key && handleSort(column.key as keyof PurchaseInvoice)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                    >
                      <span className="flex items-center">
                        {column.label}
                        {column.key && <SortIcon column={column.key as keyof PurchaseInvoice} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length > 0 ? (
                  paginated.map((inv) => (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(inv)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm font-medium text-gray-900">
                            {inv.invoiceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {inv.vendor?.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(inv.invoiceDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(inv.dueDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {inv.totalAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{inv.currency}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(inv.purchaseInvoiceStatus)}
                          <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(inv.purchaseInvoiceStatus)}`}>
                            {inv.purchaseInvoiceStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Menu as="div" className="relative inline-block text-left">
                          <Menu.Button 
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                          </Menu.Button>
                          <Menu.Items className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                            <Menu.Item>
                              {({ active }) => (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(inv);
                                  }}
                                  className={`${
                                    active ? "bg-gray-50" : ""
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
                                    handleEdit(inv);
                                  }}
                                  className={`${
                                    active ? "bg-gray-50" : ""
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
                                    handleDelete(inv.id!);
                                  }}
                                  className={`${
                                    active ? "bg-gray-50" : ""
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
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No purchase invoices found</p>
                        <p className="text-gray-400 text-xs">Try adjusting your search or add a new invoice</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
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
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === pageNum
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

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingId ? "Edit Purchase Invoice" : "Add New Purchase Invoice"}
                </h3>
                <button
                  onClick={clearForm}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., PO-2024-001"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vendor <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={vendorId}
                      onChange={(e) => setVendorId(Number(e.target.value))}
                      required
                    >
                      <option value="">Select Vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      selected={invoiceDate ? new Date(invoiceDate) : null}
                      onChange={(date) => setInvoiceDate(date ? date.toISOString().split('T')[0] : "")}
                      dateFormat="yyyy-MM-dd"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Due Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      selected={dueDate ? new Date(dueDate) : null}
                      onChange={(date) => setDueDate(date ? date.toISOString().split('T')[0] : "")}
                      dateFormat="yyyy-MM-dd"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 pl-7"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(parseFloat(e.target.value))}
                        required
                      />
                      <CurrencyDollarIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as Status)}
                    >
                      <option value="OPEN">Open</option>
                      <option value="PARTIALLY_PAID">Partially Paid</option>
                      <option value="PAID">Paid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reference Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., REF-001"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any additional notes..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    type="button"
                    onClick={clearForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    {editingId ? "Update Invoice" : "Create Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Purchase Invoice Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                {/* Status Badge */}
                <div className="flex justify-end mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedInvoice.purchaseInvoiceStatus)}`}>
                    {getStatusIcon(selectedInvoice.purchaseInvoiceStatus)}
                    <span className="ml-2">{selectedInvoice.purchaseInvoiceStatus.replace('_', ' ')}</span>
                  </span>
                </div>

                {/* Invoice Number */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedInvoice.invoiceNumber}</p>
                </div>

                {/* Vendor */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Vendor</p>
                  <div className="flex items-center">
                    <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <p className="text-lg font-semibold text-gray-900">{selectedInvoice.vendor?.name}</p>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Invoice Date</p>
                    <div className="flex items-center">
                      <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(selectedInvoice.invoiceDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Due Date</p>
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(selectedInvoice.dueDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Amount */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                  <p className="text-3xl font-bold text-cyan-600">
                    {selectedInvoice.currency} {selectedInvoice.totalAmount.toFixed(2)}
                  </p>
                </div>

                {/* Reference Number */}
                {selectedInvoice.referenceNumber && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Reference Number</p>
                    <p className="text-lg font-semibold text-gray-900">{selectedInvoice.referenceNumber}</p>
                  </div>
                )}

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Notes</p>
                    <p className="text-gray-900">{selectedInvoice.notes}</p>
                  </div>
                )}

                {/* ID */}
                {selectedInvoice.id && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500">ID: {selectedInvoice.id}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleEdit(selectedInvoice);
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Edit Invoice
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PurchaseInvoicePage;
