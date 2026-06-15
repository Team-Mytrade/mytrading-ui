import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  XCircleIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  EyeIcon,
  ReceiptPercentIcon,
  CurrencyDollarIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const API_URL = "/v1/api/invoice/tax-details";
const INVOICE_API = "/v1/api/invoices";
const TAX_TYPE_API = "/v1/api/invoice/tax-types"

export type TaxCategoryType = "INPUT" | "OUTPUT";

interface Invoice {
  id: number;
  invoiceNumber: string;
}

interface TaxType {
  id: number;
  taxName: string;
}

interface TaxDetail {
  id?: number;
  taxCode: string;
  taxDescription: string;
  taxRate: number;
  taxAmount: number;
  taxCatagory: TaxCategoryType;
  taxType?: { id: number; taxName?: string };
  invoice?: { id: number; invoiceNumber?: string };
}

const PAGE_SIZE = 10;

const TaxDetailPage: React.FC = () => {
  const [items, setItems] = useState<TaxDetail[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [form, setForm] = useState<TaxDetail>({
    taxCode: "",
    taxDescription: "",
    taxRate: 0,
    taxAmount: 0,
    taxCatagory: "INPUT",
    invoice: undefined
  });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof TaxDetail>("taxCode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<TaxDetail | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch Taxxtype 
  const loadTaxType = async () => {
    try {
      const tt = await axios.get(TAX_TYPE_API);
      console.log("TaxTypes:", tt.data);
      setTaxTypes(tt.data);
    } catch (error) {
      console.error("Failed to load Tax types", error);
    }
  };

  const loadData = async () => {
    try {
      const [res, inv] = await Promise.all([axios.get(API_URL), axios.get(INVOICE_API)]);
      setItems(Array.isArray(res.data) ? res.data : []);
      setInvoices(Array.isArray(inv.data) ? inv.data : []);
    } catch (err) {
      console.error(err);
      alert("Failed to load data");
    }
  };

  useEffect(() => {
    loadData();
    loadTaxType();
  }, []);

  const handleChange = (key: keyof TaxDetail, value: any) => {
    setForm(prev => {
      let updated = { ...prev, [key]: value };
      if (key === "taxRate") {
        updated.taxAmount = Number(value) * 100; // Example calculation - adjust as needed
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, form);
      } else {
        await axios.post(API_URL, form);
      }
      loadData();
      loadTaxType();
      clearForm();
    } catch (err) {
      console.error(err);
      alert("Save failed");
    }
  };

  const handleEdit = (item: TaxDetail) => {
    setForm({ ...item });
    setShowForm(true);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this Tax Detail?")) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      loadData();
      loadTaxType();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  const handleViewDetails = (item: TaxDetail) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  const clearForm = () => {
    setForm({
      taxCode: "",
      taxDescription: "",
      taxRate: 0,
      taxAmount: 0,
      taxCatagory: "INPUT",
      invoice: undefined
    });
    setShowForm(false);
  };

  const exportExcel = () => {
    const exportData = items.map(i => ({
      'Tax Code': i.taxCode,
      'Description': i.taxDescription,
      'Rate': `${i.taxRate}%`,
      'Amount': i.taxAmount.toFixed(2),
      'Category': i.taxCatagory,
      'Invoice': i.invoice?.invoiceNumber || '',
      'Tax Type': i.taxType?.taxName || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TaxDetails");
    XLSX.writeFile(wb, `TaxDetails_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Tax Details Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    autoTable(doc, {
      head: [["Code", "Description", "Rate", "Amount", "Category", "Invoice", "Tax Type"]],
      body: items.map(i => [
        i.taxCode,
        i.taxDescription,
        `${i.taxRate}%`,
        i.taxAmount.toFixed(2),
        i.taxCatagory,
        i.invoice?.invoiceNumber || "",
        i.taxType?.taxName || ""
      ]),
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    doc.save(`TaxDetails_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Filtering & Sorting
  const filtered = items.filter((item) => {
    const matchesSearch = [
      item.taxCode,
      item.taxDescription,
      item.taxCatagory,
      item.invoice?.invoiceNumber,
      item.taxType?.taxName
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = selectedCategory ? item.taxCatagory === selectedCategory : true;

    return matchesSearch && matchesCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];
    
    if (sortKey === "taxRate" || sortKey === "taxAmount") {
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

  const handleSort = (field: keyof TaxDetail) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof TaxDetail }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ? 
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : 
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  const getCategoryColor = (category: TaxCategoryType) => {
    switch (category) {
      case "INPUT":
        return "bg-blue-100 text-blue-800";
      case "OUTPUT":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryIcon = (category: TaxCategoryType) => {
    switch (category) {
      case "INPUT":
        return <ArrowDownIcon className="h-4 w-4 text-blue-500" />;
      case "OUTPUT":
        return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
      default:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <>
      <PageMeta title="Tax Details" description="Manage tax details for invoices" />
      <PageBreadcrumb pageTitle="Tax Details" />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tax details..."
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
              label="Add Tax Detail"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Categories</option>
                  <option value="INPUT">Input</option>
                  <option value="OUTPUT">Output</option>
                </select>
              </div>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory("")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Tax Details</p>
            <p className="text-2xl font-semibold text-gray-900">{items.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Input Tax</p>
            <p className="text-2xl font-semibold text-blue-600">
              {items.filter(i => i.taxCatagory === "INPUT").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Output Tax</p>
            <p className="text-2xl font-semibold text-green-600">
              {items.filter(i => i.taxCatagory === "OUTPUT").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Tax Amount</p>
            <p className="text-2xl font-semibold text-cyan-600">
              {items.reduce((sum, i) => sum + (i.taxAmount || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'taxCode', label: 'Code' },
                    { key: 'taxDescription', label: 'Description' },
                    { key: 'taxRate', label: 'Rate' },
                    { key: 'taxAmount', label: 'Amount' },
                    { key: 'taxCatagory', label: 'Category' },
                    { key: null, label: 'Tax Type' },
                    { key: null, label: 'Invoice' },
                    { key: null, label: 'Actions' },
                  ].map((column, index) => (
                    <th
                      key={index}
                      onClick={() => column.key && handleSort(column.key as keyof TaxDetail)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                    >
                      <span className="flex items-center">
                        {column.label}
                        {column.key && <SortIcon column={column.key as keyof TaxDetail} />}
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
                        <div className="flex items-center">
                          <ReceiptPercentIcon className="h-5 w-5 text-gray-400 mr-2" />
                          <span className="text-sm font-mono font-medium text-gray-900">
                            {item.taxCode}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{item.taxDescription}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-cyan-600">
                          {item.taxRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-gray-900">
                          <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {item.taxAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(item.taxCatagory)}`}>
                          {getCategoryIcon(item.taxCatagory)}
                          <span className="ml-1">{item.taxCatagory}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {item.taxType?.taxName || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {item.invoice?.invoiceNumber || '-'}
                        </span>
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
                                    handleViewDetails(item);
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
                                    handleEdit(item);
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
                                    handleDelete(item.id);
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
                        <ReceiptPercentIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No tax details found</p>
                        <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
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

        {/* Tax Detail Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {form.id ? "Edit Tax Detail" : "Add New Tax Detail"}
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
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="e.g., GST-18"
                      value={form.taxCode}
                      onChange={e => handleChange("taxCode", e.target.value)}
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Rate (%) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-8"
                        placeholder="e.g., 18"
                        value={form.taxRate}
                        step="0.01"
                        onChange={e => handleChange("taxRate", Number(e.target.value))}
                        required
                      />
                      <span className="absolute right-3 top-2 text-gray-500">%</span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Enter tax description"
                      value={form.taxDescription}
                      onChange={e => handleChange("taxDescription", e.target.value)}
                      required
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={form.taxCatagory}
                      onChange={e => handleChange("taxCatagory", e.target.value as TaxCategoryType)}
                    >
                      <option value="INPUT">Input Tax</option>
                      <option value="OUTPUT">Output Tax</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Type
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={form.taxType?.id || 0}
                      onChange={e => handleChange("taxType", e.target.value ? { id: Number(e.target.value) } : undefined)}
                    >
                      <option value={0}>Select Tax Type</option>
                      {taxTypes.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.taxName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={form.invoice?.id || ""}
                      onChange={e => handleChange("invoice", e.target.value ? { id: Number(e.target.value) } : undefined)}
                    >
                      <option value="">Select Invoice</option>
                      {invoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 focus:ring-2 focus:ring-cyan-500 focus:border-transparent pl-7"
                        value={form.taxAmount}
                        disabled
                      />
                      <CurrencyDollarIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Auto-calculated from rate</p>
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
                    {form.id ? "Update Tax Detail" : "Create Tax Detail"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tax Detail Details Modal */}
        {showDetailsModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Tax Detail Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                {/* Category Badge */}
                <div className="flex justify-end mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(selectedItem.taxCatagory)}`}>
                    {getCategoryIcon(selectedItem.taxCatagory)}
                    <span className="ml-1">{selectedItem.taxCatagory}</span>
                  </span>
                </div>

                {/* Code and Description */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Tax Code</p>
                    <p className="text-lg font-semibold font-mono text-gray-900">
                      {selectedItem.taxCode}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedItem.taxDescription}
                    </p>
                  </div>
                </div>

                {/* Rate and Amount */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Tax Rate</p>
                    <p className="text-2xl font-bold text-cyan-600">
                      {selectedItem.taxRate}%
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Tax Amount</p>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedItem.taxAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Tax Type and Invoice */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {selectedItem.taxType && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Tax Type</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedItem.taxType.taxName}
                      </p>
                    </div>
                  )}
                  {selectedItem.invoice && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500 mb-1">Invoice</p>
                      <div className="flex items-center">
                        <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedItem.invoice.invoiceNumber}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ID */}
                {selectedItem.id && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500">ID: {selectedItem.id}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleEdit(selectedItem);
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Edit Tax Detail
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

export default TaxDetailPage;