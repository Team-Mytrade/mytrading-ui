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
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  TagIcon,
  ClockIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  CalendarIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Modal from "../../components/common/Modal";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

/* ----------------------------------------------------
   API ENDPOINT (Update later)
---------------------------------------------------- */
const API_PAYMENT_TERMS = "/v1/api/invoice/payment-terms";

/* ----------------------------------------------------
   Interfaces
---------------------------------------------------- */
interface PaymentTerm {
  id?: number;
  termCode: string;
  description: string;
  dueDays: number;
}

/* ----------------------------------------------------
   Component
---------------------------------------------------- */
const PaymentTermPage: React.FC = () => {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof PaymentTerm>("termCode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<PaymentTerm | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  const ITEMS_PER_PAGE = 10;

  const emptyTerm: PaymentTerm = {
    termCode: "",
    description: "",
    dueDays: 0,
  };

  const [form, setForm] = useState<PaymentTerm>(emptyTerm);

  /* ----------------------------------------------------
     Load data
  ---------------------------------------------------- */
  const loadData = async () => {
    try {
      const res = await axios.get(API_PAYMENT_TERMS);
      setTerms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load payment terms:", err);
      ToasterService.error("Failed to load payment terms");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ----------------------------------------------------
     Helpers
  ---------------------------------------------------- */
  const handleChange = (key: keyof PaymentTerm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (term: PaymentTerm) => {
    setEditingId(term.id!);
    setForm({ ...term });
    setShowForm(true);
  };

  const handleViewDetails = (term: PaymentTerm) => {
    setSelectedTerm(term);
    setShowDetailsModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!form.termCode) {
      ToasterService.error("Term code is required");
      return;
    }

    if (!form.description) {
      ToasterService.error("Description is required");
      return;
    }

    if (form.dueDays <= 0) {
      ToasterService.error("Due days must be greater than 0");
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${API_PAYMENT_TERMS}/${editingId}`, form);
        ToasterService.success("Payment term updated successfully");
      } else {
        await axios.post(API_PAYMENT_TERMS, form);
        ToasterService.success("Payment term created successfully");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyTerm);
      loadData();
    } catch (err: any) {
      console.error("Failed to save payment term:", err);
      if (err.response) {
        ToasterService.error(`Error: ${err.response.data.message || err.response.statusText}`);
      } else {
        ToasterService.error("Failed to save payment term");
      }
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this payment term? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_PAYMENT_TERMS}/${id}`);
      ToasterService.success("Payment term deleted successfully");
      loadData();
    } catch (err: any) {
      console.error("Failed to delete payment term:", err);
      ToasterService.error(err.response?.data?.message || "Failed to delete payment term");
    }
  };

  /* ----------------------------------------------------
     Export functions
  ---------------------------------------------------- */
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Payment Terms Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    autoTable(doc, {
      head: [["Term Code", "Description", "Due Days"]],
      body: terms.map(t => [
        t.termCode,
        t.description,
        t.dueDays.toString(),
      ]),
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`PaymentTerms_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const exportData = terms.map(t => ({
      'Term Code': t.termCode,
      'Description': t.description,
      'Due Days': t.dueDays,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PaymentTerms");
    XLSX.writeFile(wb, `PaymentTerms_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  /* ----------------------------------------------------
     Search, Sort, Pagination
  ---------------------------------------------------- */
  const filtered = terms.filter((t) => {
    const matchesSearch = [
      t.termCode,
      t.description
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    return matchesSearch;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "dueDays") {
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

  const handleSort = (field: keyof PaymentTerm) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof PaymentTerm }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ?
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> :
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  /* ----------------------------------------------------
     Render
  ---------------------------------------------------- */
  return (
    <>
      <PageMeta title="Payment Terms" description="Manage payment terms" />
      <PageBreadcrumb pageTitle="Payment Terms" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by term code or description..."
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
              label="Add Payment Term"
              onClick={() => {
                setForm(emptyTerm);
                setEditingId(null);
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Days Range</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards with Icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Terms</p>
                <p className="text-2xl font-semibold text-gray-900">{terms.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Due Days</p>
                <p className="text-2xl font-semibold text-cyan-600">
                  {terms.length ? Math.round(terms.reduce((sum, t) => sum + t.dueDays, 0) / terms.length) : 0}
                </p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-full">
                <BanknotesIcon className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Max Due Days</p>
                <p className="text-2xl font-semibold text-purple-600">
                  {terms.length ? Math.max(...terms.map(t => t.dueDays)) : 0}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <ArrowUpIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Min Due Days</p>
                <p className="text-2xl font-semibold text-green-600">
                  {terms.length ? Math.min(...terms.map(t => t.dueDays)) : 0}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ArrowDownIcon className="h-6 w-6 text-green-600" />
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
                      { key: 'termCode', label: 'Term Code' },
                      { key: 'description', label: 'Description' },
                      { key: 'dueDays', label: 'Due Days' },
                      { key: null, label: 'Actions' },
                    ].map((column, index) => (
                      <th
                        key={index}
                        onClick={() => column.key && handleSort(column.key as keyof PaymentTerm)}
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                      >
                        <span className="flex items-center">
                          {column.label}
                          {column.key && <SortIcon column={column.key as keyof PaymentTerm} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginated.length > 0 ? (
                    paginated.map((term) => (
                      <tr
                        key={term.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(term)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <TagIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-mono font-medium text-gray-900">
                              {term.termCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{term.description}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="font-medium text-cyan-600">{term.dueDays}</span>
                            <span className="ml-1 text-gray-500">days</span>
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
                                      handleViewDetails(term);
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
                                      handleEdit(term);
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
                                      handleDelete(term.id!);
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
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                          <p className="text-gray-500 text-sm mb-2">No payment terms found</p>
                          <p className="text-gray-400 text-xs">Try adjusting your search or add a new payment term</p>
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
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">First</span>
                        <span>First</span>
                      </button>
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Previous</span>
                        <span>Previous</span>
                      </button>

                      {/* Page Numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
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
                            aria-current={page === pageNum ? "page" : undefined}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Next</span>
                        <span>Next</span>
                      </button>
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="sr-only">Last</span>
                        <span>Last</span>
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
          onClose={() => { setForm(emptyTerm); setEditingId(null); setShowForm(false); }}
          title={editingId ? "Edit Payment Term" : "Add New Payment Term"}
          icon={<TagIcon className="h-5 w-5 text-cyan-600" />}
          size="lg"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setForm(emptyTerm); setEditingId(null); setShowForm(false); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="payment-term-form"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                {editingId ? "Update Term" : "Create Term"}
              </button>
            </div>
          }
        >
          <form id="payment-term-form" onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Term Code <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="e.g., NET30, NET15"
                  value={form.termCode}
                  onChange={(e) => handleChange("termCode", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="e.g., Net 30 Days"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Days <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent pr-16"
                    placeholder="30"
                    value={form.dueDays}
                    onChange={(e) => handleChange("dueDays", Number(e.target.value))}
                    required
                  />
                  <span className="absolute right-3 top-2 text-gray-500 text-sm">days</span>
                </div>
              </div>
            </div>
          </form>
        </Modal>

        {/* Details Modal */}
        <Modal
          isOpen={showDetailsModal && !!selectedTerm}
          onClose={() => setShowDetailsModal(false)}
          title="Payment Term Details"
          icon={<TagIcon className="h-5 w-5 text-cyan-600" />}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDetailsModal(false); if (selectedTerm) handleEdit(selectedTerm); }}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Edit Term
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
          {selectedTerm && (
            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Term Code</p>
                <div className="flex items-center">
                  <TagIcon className="h-6 w-6 text-gray-400 mr-2" />
                  <p className="text-2xl font-bold font-mono text-gray-900">{selectedTerm.termCode}</p>
                </div>
              </div>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-lg font-semibold text-gray-900">{selectedTerm.description}</p>
              </div>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Due Days</p>
                <div className="flex items-center">
                  <CalendarIcon className="h-6 w-6 text-gray-400 mr-2" />
                  <p className="text-2xl font-bold text-cyan-600">{selectedTerm.dueDays}</p>
                  <span className="ml-2 text-gray-600">days</span>
                </div>
              </div>
              {selectedTerm.id && (
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-500">ID: {selectedTerm.id}</p>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Confirm Delete Dialog */}
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

export default PaymentTermPage;