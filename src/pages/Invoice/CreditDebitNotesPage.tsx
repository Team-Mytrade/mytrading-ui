import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  UserIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  TagIcon,
  CreditCardIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Note {
  id: number;
  noteNumber: string;
  date: string;
  customer: string;
  amount: number;
  remarks?: string;
}

const ITEMS_PER_PAGE = 8;

const API_ENDPOINTS = {
  credit: '/v1/api/invoice/credit-notes',
  debit: '/v1/api/invoice/debit-notes',
};

const CreditDebitNotesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'credit' | 'debit'>('credit');

  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof Note>('noteNumber');
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [formData, setFormData] = useState<Omit<Note, 'id'>>({
    noteNumber: '',
    date: new Date().toISOString().slice(0, 10),
    customer: '',
    amount: 0,
    remarks: '',
  });

  // Fetch notes from backend
  const fetchNotes = async () => {
    try {
      const res = await axios.get<Note[]>(API_ENDPOINTS[activeTab]);
      setNotes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed fetching notes:', error);
      alert('Failed to load notes.');
    }
  };

  useEffect(() => {
    fetchNotes();
    setSearch('');
    setSortKey('noteNumber');
    setSortOrder('asc');
    setPage(1);
  }, [activeTab]);

  // Filter notes
  const filtered = notes.filter(note => {
    const matchesSearch = [
      note.noteNumber,
      note.customer,
      note.remarks
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    return matchesSearch;
  });

  // Sort notes
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "date") {
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

  // Pagination
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSort = (field: keyof Note) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof Note }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ? 
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : 
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  // Form handlers
  const openAddForm = () => {
    setFormData({
      noteNumber: '',
      date: new Date().toISOString().slice(0, 10),
      customer: '',
      amount: 0,
      remarks: '',
    });
    setEditingNote(null);
    setShowForm(true);
  };

  const openEditForm = (note: Note) => {
    setFormData({
      noteNumber: note.noteNumber,
      date: note.date.slice(0, 10),
      customer: note.customer,
      amount: note.amount,
      remarks: note.remarks || '',
    });
    setEditingNote(note);
    setShowForm(true);
  };

  const handleViewDetails = (note: Note) => {
    setSelectedNote(note);
    setShowDetailsModal(true);
  };

  const handleFormChange = <K extends keyof Omit<Note, 'id'>>(field: K, value: Omit<Note, 'id'>[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async () => {
    if (!formData.noteNumber || !formData.customer || !formData.date) {
      alert('Please fill in required fields.');
      return;
    }
    try {
      if (editingNote) {
        await axios.put(`${API_ENDPOINTS[activeTab]}/${editingNote.id}`, formData);
      } else {
        await axios.post(API_ENDPOINTS[activeTab], formData);
      }
      setShowForm(false);
      fetchNotes();
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save note.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      await axios.delete(`${API_ENDPOINTS[activeTab]}/${id}`);
      fetchNotes();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete note.');
    }
  };

  // Export functions
  const exportPDF = () => {
    // Implementation similar to other components
    console.log('Export PDF');
  };

  const exportExcel = () => {
    // Implementation similar to other components
    console.log('Export Excel');
  };

  const getNoteIcon = () => {
    return activeTab === 'credit' 
      ? <BanknotesIcon className="h-5 w-5 text-green-500" />
      : <CreditCardIcon className="h-5 w-5 text-red-500" />;
  };

  const getNoteColor = () => {
    return activeTab === 'credit'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  return (
    <>
      <PageMeta 
        title={`${activeTab === 'credit' ? 'Credit' : 'Debit'} Notes`} 
        description={`Manage ${activeTab} notes`} 
      />
      <PageBreadcrumb pageTitle={`${activeTab === 'credit' ? 'Credit' : 'Debit'} Notes`} />
      
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by note number, customer, or remarks..."
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
              label={`Add ${activeTab === 'credit' ? 'Credit' : 'Debit'} Note`}
              onClick={openAddForm}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('credit')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'credit'
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BanknotesIcon className="h-5 w-5" />
                Credit Notes
              </div>
            </button>
            <button
              onClick={() => setActiveTab('debit')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'debit'
                  ? 'border-cyan-500 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5" />
                Debit Notes
              </div>
            </button>
          </nav>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="flex gap-2">
                  <DatePicker
                    placeholderText="From"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                  <DatePicker
                    placeholderText="To"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Range</label>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Notes</p>
            <p className="text-2xl font-semibold text-gray-900">{notes.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Total Amount</p>
            <p className="text-2xl font-semibold text-cyan-600">
              ${notes.reduce((sum, note) => sum + note.amount, 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Average Amount</p>
            <p className="text-2xl font-semibold text-purple-600">
              ${notes.length ? (notes.reduce((sum, note) => sum + note.amount, 0) / notes.length).toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-600">Filtered Results</p>
            <p className="text-2xl font-semibold text-gray-900">{filtered.length}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'noteNumber', label: 'Note Number' },
                    { key: 'date', label: 'Date' },
                    { key: 'customer', label: 'Customer' },
                    { key: 'amount', label: 'Amount' },
                    { key: null, label: 'Remarks' },
                    { key: null, label: 'Actions' },
                  ].map((column, index) => (
                    <th
                      key={index}
                      onClick={() => column.key && handleSort(column.key as keyof Note)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                    >
                      <span className="flex items-center">
                        {column.label}
                        {column.key && <SortIcon column={column.key as keyof Note} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length > 0 ? (
                  paginated.map((note) => (
                    <tr 
                      key={note.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(note)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getNoteIcon()}
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            {note.noteNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(note.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
                          {note.customer}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-cyan-600">
                          <CurrencyDollarIcon className="h-4 w-4 text-cyan-400 mr-1" />
                          {note.amount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {note.remarks || '-'}
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
                                    handleViewDetails(note);
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
                                    openEditForm(note);
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
                                    handleDelete(note.id);
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
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <DocumentTextIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No {activeTab} notes found</p>
                        <p className="text-gray-400 text-xs">Try adjusting your search or add a new note</p>
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
            <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingNote ? `Edit ${activeTab === 'credit' ? 'Credit' : 'Debit'} Note` : `Add ${activeTab === 'credit' ? 'Credit' : 'Debit'} Note`}
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.noteNumber}
                      onChange={e => handleFormChange('noteNumber', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="e.g., CN-001"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      selected={formData.date ? new Date(formData.date) : null}
                      onChange={(date) => handleFormChange('date', date ? date.toISOString().split('T')[0] : "")}
                      dateFormat="yyyy-MM-dd"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customer}
                      onChange={e => handleFormChange('customer', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      placeholder="Enter customer name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={formData.amount}
                        onChange={e => handleFormChange('amount', Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 pl-7"
                        required
                      />
                      <CurrencyDollarIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Remarks
                    </label>
                    <textarea
                      value={formData.remarks}
                      onChange={e => handleFormChange('remarks', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      rows={3}
                      placeholder="Enter any additional remarks..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFormSubmit}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                  >
                    {editingNote ? 'Update Note' : 'Create Note'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedNote && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {activeTab === 'credit' ? 'Credit' : 'Debit'} Note Details
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-6">
                {/* Type Badge */}
                <div className="flex justify-end mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getNoteColor()}`}>
                    {getNoteIcon()}
                    <span className="ml-1">{activeTab === 'credit' ? 'Credit Note' : 'Debit Note'}</span>
                  </span>
                </div>

                {/* Note Number */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Note Number</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedNote.noteNumber}</p>
                </div>

                {/* Customer and Date */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Customer</p>
                    <div className="flex items-center">
                      <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-lg font-semibold text-gray-900">{selectedNote.customer}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Date</p>
                    <div className="flex items-center">
                      <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(selectedNote.date).toLocaleDateString('en-US', {
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
                  <p className="text-sm text-gray-500 mb-1">Amount</p>
                  <p className="text-2xl font-bold text-cyan-600">
                    ${selectedNote.amount.toFixed(2)}
                  </p>
                </div>

                {/* Remarks */}
                {selectedNote.remarks && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Remarks</p>
                    <p className="text-gray-900">{selectedNote.remarks}</p>
                  </div>
                )}

                {/* ID */}
                {selectedNote.id && (
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-500">ID: {selectedNote.id}</p>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    openEditForm(selectedNote);
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Edit Note
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

export default CreditDebitNotesPage;