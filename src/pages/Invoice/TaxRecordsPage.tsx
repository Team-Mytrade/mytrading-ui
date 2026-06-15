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
  CheckCircleIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  EyeIcon,
  ReceiptPercentIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  ShoppingCartIcon,
  TruckIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  DocumentIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ToasterService } from "../../Services/ToasterService";

// API endpoints
const TAX_RECORD_API = "/v1/api/invoice/tax-record";
const TAX_TYPE_API = "/v1/api/invoice/tax-types";

// Enums
export enum TransactionType {
  SALE = "SALE",
  PURCHASE = "PURCHASE",
  OTHER = "OTHER"
}

export enum SourceModule {
  SALES_INVOICE = "SALES_INVOICE",
  PURCHASE_INVOICE = "PURCHASE_INVOICE",
  CREDIT_NOTE = "CREDIT_NOTE",
  DEBIT_NOTE = "DEBIT_NOTE",
  ADJUSTMENT_NOTE = "ADJUSTMENT_NOTE",
  OTHER = "OTHER"
}

interface TaxType {
  id: number;
  taxName: string;
  taxRate: number;
}

interface TaxRecord {
  id?: number;
  transactionType: TransactionType;
  sourceModule: SourceModule;
  taxType?: TaxType;
  taxableAmount: number;
  taxAmount: number;
  transactionDate: string;
}

// Payload interface with correct structure (only required fields - sourceId removed)
interface TaxRecordPayload {
  sourceModule: SourceModule;
  transactionType: TransactionType;
  taxTypeId: number;
  taxableAmount: number;
  transactionDate: string;
}

const PAGE_SIZE = 10;

// Helper to safely extract array from various API response shapes
function extractArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.content)) return data.content;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.records)) return data.records;
  if (data && Array.isArray(data.result)) return data.result;
  if (data && Array.isArray(data.results)) return data.results;
  console.warn("Could not extract array from response:", data);
  return [];
}

const TaxRecordPage: React.FC = () => {
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{
    transactionType: TransactionType;
    sourceModule: SourceModule;
    taxTypeId: number;
    taxableAmount: number;
    transactionDate: string;
  }>({
    transactionType: TransactionType.SALE,
    sourceModule: SourceModule.SALES_INVOICE,
    taxTypeId: 0,
    taxableAmount: 0,
    transactionDate: new Date().toISOString().split('T')[0],
  });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof TaxRecord>("transactionDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedRecord, setSelectedRecord] = useState<TaxRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  /* -------------------- Load Data -------------------- */
  const loadData = async () => {
    console.log("Loading data...");
    try {
      const [taxTypeRes, recordsRes] = await Promise.all([
        axios.get(TAX_TYPE_API),
        axios.get(TAX_RECORD_API + "/report"),
      ]);

      console.log("Tax Types raw response:", taxTypeRes.data);
      console.log("Tax Records raw response:", recordsRes.data);

      // Safely extract arrays from any response shape
      const taxTypesArray = extractArray<TaxType>(taxTypeRes.data);
      const recordsArray = extractArray<TaxRecord>(recordsRes.data);

      console.log("Tax Types parsed:", taxTypesArray);
      console.log("Tax Records parsed:", recordsArray);

      setTaxTypes(taxTypesArray);
      setRecords(recordsArray);
    } catch (err) {
      console.error("Failed to load data", err);
      ToasterService.error("Failed to load data");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* -------------------- Form Handlers -------------------- */
  const handleChange = (key: string, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!form.taxTypeId || form.taxTypeId === 0) {
      ToasterService.error("Please select a tax type");
      return;
    }

    if (form.taxableAmount <= 0) {
      ToasterService.error("Taxable amount must be greater than 0");
      return;
    }

    if (!form.transactionDate) {
      ToasterService.error("Transaction date is required");
      return;
    }

    // Create payload with correct structure (sourceId removed)
    const payload: TaxRecordPayload = {
      sourceModule: form.sourceModule,
      transactionType: form.transactionType,
      taxTypeId: form.taxTypeId,
      taxableAmount: form.taxableAmount,
      transactionDate: form.transactionDate
    };

    console.log("Submitting payload:", payload);

    try {
      if (editingId) {
        await axios.put(`${TAX_RECORD_API}/${editingId}`, payload);
        ToasterService.success("Tax record updated successfully");
      } else {
        await axios.post(TAX_RECORD_API, payload);
        ToasterService.success("Tax record created successfully");
      }
      clearForm();
      loadData();
    } catch (err: any) {
      console.error("Save failed", err);
      if (err.response) {
        ToasterService.error(`Error: ${err.response.data.message || err.response.statusText}`);
      } else {
        ToasterService.error("Save failed");
      }
    }
  };

  const handleEdit = (r: TaxRecord) => {
    setForm({
      transactionType: r.transactionType,
      sourceModule: r.sourceModule,
      taxTypeId: r.taxType?.id || 0,
      taxableAmount: r.taxableAmount,
      transactionDate: r.transactionDate.split('T')[0],
    });
    setEditingId(r.id || null);
    setShowForm(true);
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this Tax Record?")) return;
    try {
      await axios.delete(`${TAX_RECORD_API}/${id}`);
      ToasterService.success("Tax record deleted successfully");
      loadData();
    } catch (err) {
      console.error("Delete failed", err);
      ToasterService.error("Delete failed");
    }
  };

  const handleViewDetails = (record: TaxRecord) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };

  const clearForm = () => {
    setForm({
      transactionType: TransactionType.SALE,
      sourceModule: SourceModule.SALES_INVOICE,
      taxTypeId: 0,
      taxableAmount: 0,
      transactionDate: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
    setShowForm(false);
  };

  /* -------------------- Export Handlers -------------------- */
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Tax Records Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    autoTable(doc, {
      head: [["ID", "Type", "Module", "Tax Type", "Taxable", "Tax Amount", "Date"]],
      body: records.map(r => [
        r.id ?? "",
        r.transactionType ?? "",
        r.sourceModule ?? "",
        r.taxType?.taxName ?? "",
        (r.taxableAmount ?? 0).toFixed(2),
        (r.taxAmount ?? 0).toFixed(2),
        r.transactionDate ? new Date(r.transactionDate).toLocaleDateString() : ""
      ]),
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });

    doc.save(`TaxRecords_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const exportData = records.map(r => ({
      ID: r.id,
      'Transaction Type': r.transactionType,
      'Source Module': r.sourceModule,
      'Tax Type': r.taxType?.taxName || "",
      'Tax Rate': r.taxType?.taxRate ? `${(r.taxType.taxRate * 100).toFixed(2)}%` : "",
      'Taxable Amount': r.taxableAmount,
      'Tax Amount': r.taxAmount,
      'Transaction Date': r.transactionDate ? new Date(r.transactionDate).toLocaleDateString() : "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TaxRecords");
    XLSX.writeFile(wb, `TaxRecords_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  /* -------------------- Filtering & Sorting -------------------- */
  const filtered = records.filter((record) => {
    const matchesSearch = [
      record.id?.toString(),
      record.transactionType,
      record.sourceModule,
      record.taxType?.taxName
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType ? record.transactionType === selectedType : true;
    const matchesModule = selectedModule ? record.sourceModule === selectedModule : true;

    return matchesSearch && matchesType && matchesModule;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];

    if (sortKey === "transactionDate") {
      const dateA = new Date(valA as string).getTime();
      const dateB = new Date(valB as string).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }

    if (sortKey === "taxableAmount" || sortKey === "taxAmount") {
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

  const handleSort = (field: keyof TaxRecord) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof TaxRecord }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ?
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> :
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  const getTransactionTypeIcon = (type: TransactionType) => {
    switch (type) {
      case TransactionType.SALE:
        return <ShoppingCartIcon className="h-4 w-4 text-green-500" />;
      case TransactionType.PURCHASE:
        return <TruckIcon className="h-4 w-4 text-blue-500" />;
      case TransactionType.OTHER:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
      default:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTransactionTypeColor = (type: TransactionType) => {
    switch (type) {
      case TransactionType.SALE:
        return "bg-green-100 text-green-800";
      case TransactionType.PURCHASE:
        return "bg-blue-100 text-blue-800";
      case TransactionType.OTHER:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSourceModuleIcon = (module: SourceModule) => {
    switch (module) {
      case SourceModule.SALES_INVOICE:
        return <DocumentTextIcon className="h-4 w-4 text-purple-500" />;
      case SourceModule.PURCHASE_INVOICE:
        return <DocumentTextIcon className="h-4 w-4 text-orange-500" />;
      case SourceModule.CREDIT_NOTE:
        return <CreditCardIcon className="h-4 w-4 text-green-500" />;
      case SourceModule.DEBIT_NOTE:
        return <CreditCardIcon className="h-4 w-4 text-red-500" />;
      case SourceModule.ADJUSTMENT_NOTE:
        return <AdjustmentsHorizontalIcon className="h-4 w-4 text-yellow-500" />;
      case SourceModule.OTHER:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
      default:
        return <TagIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSourceModuleColor = (module: SourceModule) => {
    switch (module) {
      case SourceModule.SALES_INVOICE:
        return "bg-purple-100 text-purple-800";
      case SourceModule.PURCHASE_INVOICE:
        return "bg-orange-100 text-orange-800";
      case SourceModule.CREDIT_NOTE:
        return "bg-green-100 text-green-800";
      case SourceModule.DEBIT_NOTE:
        return "bg-red-100 text-red-800";
      case SourceModule.ADJUSTMENT_NOTE:
        return "bg-yellow-100 text-yellow-800";
      case SourceModule.OTHER:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSelectedTaxRate = () => {
    const selectedTax = taxTypes.find(t => t.id === form.taxTypeId);
    return selectedTax?.taxRate || 0;
  };

  const calculatedTaxAmount = form.taxableAmount * getSelectedTaxRate();

  return (
    <>
      <PageMeta title="Tax Records" description="Manage tax records" />
      <PageBreadcrumb pageTitle="Tax Records" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tax records..."
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
              label="Add Tax Record"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Types</option>
                  {Object.values(TransactionType).map((type) => (
                    <option key={type} value={type}>{type.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Module</label>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">All Modules</option>
                  {Object.values(SourceModule).map((module) => (
                    <option key={module} value={module}>{module.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              {(selectedType || selectedModule) && (
                <button
                  onClick={() => {
                    setSelectedType("");
                    setSelectedModule("");
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
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-semibold text-gray-900">{records.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sales Tax</p>
                <p className="text-2xl font-semibold text-green-600">
                  {records.filter(r => r.transactionType === TransactionType.SALE).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <ShoppingCartIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Purchase Tax</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {records.filter(r => r.transactionType === TransactionType.PURCHASE).length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <TruckIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tax Amount</p>
                <p className="text-2xl font-semibold text-cyan-600">
                  {records.reduce((sum, r) => sum + (r.taxAmount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-cyan-100 rounded-full">
                <BanknotesIcon className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Table - sourceId removed */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'id', label: 'ID' },
                    { key: 'transactionType', label: 'Type' },
                    { key: 'sourceModule', label: 'Module' },
                    { key: null, label: 'Tax Type' },
                    { key: 'taxableAmount', label: 'Taxable' },
                    { key: 'taxAmount', label: 'Tax Amount' },
                    { key: 'transactionDate', label: 'Date' },
                    { key: null, label: 'Actions' },
                  ].map((column, index) => (
                    <th
                      key={index}
                      onClick={() => column.key && handleSort(column.key as keyof TaxRecord)}
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                        }`}
                    >
                      <span className="flex items-center">
                        {column.label}
                        {column.key && <SortIcon column={column.key as keyof TaxRecord} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length > 0 ? (
                  paginated.map((record) => (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(record)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-medium text-gray-900">
                          #{record.id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeColor(record.transactionType)}`}>
                          {getTransactionTypeIcon(record.transactionType)}
                          <span className="ml-1">{record.transactionType.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getSourceModuleColor(record.sourceModule)}`}>
                          {getSourceModuleIcon(record.sourceModule)}
                          <span className="ml-1">{record.sourceModule.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ReceiptPercentIcon className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">
                            {record.taxType?.taxName || '-'}
                          </span>
                          {record.taxType?.taxRate && (
                            <span className="ml-1 text-xs text-gray-500">
                              ({(record.taxType.taxRate * 100).toFixed(2)}%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {record.taxableAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-medium text-cyan-600">
                          <CurrencyDollarIcon className="h-4 w-4 text-cyan-400 mr-1" />
                          {record.taxAmount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <CalendarIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {new Date(record.transactionDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
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
                                    handleViewDetails(record);
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
                                    handleEdit(record);
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
                                    handleDelete(record.id);
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
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <ReceiptPercentIcon className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm mb-2">No tax records found</p>
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

        {/* Tax Record Form Modal - sourceId removed */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingId ? "Edit Tax Record" : "Add New Tax Record"}
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
                      Transaction Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={form.transactionType}
                      onChange={e => handleChange("transactionType", e.target.value as TransactionType)}
                      required
                    >
                      {Object.values(TransactionType).map((type) => (
                        <option key={type} value={type}>{type.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Source Module <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={form.sourceModule}
                      onChange={e => handleChange("sourceModule", e.target.value as SourceModule)}
                      required
                    >
                      {Object.values(SourceModule).map((module) => (
                        <option key={module} value={module}>{module.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction Date <span className="text-red-500">*</span>
                    </label>
                    <DatePicker
                      selected={form.transactionDate ? new Date(form.transactionDate) : null}
                      onChange={(date) => handleChange("transactionDate", date ? date.toISOString().split('T')[0] : "")}
                      dateFormat="yyyy-MM-dd"
                      wrapperClassName="w-full"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      value={form.taxTypeId || ""}
                      onChange={e => handleChange("taxTypeId", Number(e.target.value))}
                      required
                    >
                      <option value="">Select Tax Type</option>
                      {taxTypes.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.taxName} ({(t.taxRate * 100).toFixed(2)}%)
                        </option>
                      ))}
                    </select>
                    {taxTypes.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">No tax types available. Please create tax types first.</p>
                    )}
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Taxable Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 pl-7"
                        placeholder="0.00"
                        value={form.taxableAmount}
                        step="0.01"
                        min="0.01"
                        onChange={e => handleChange("taxableAmount", Number(e.target.value))}
                        required
                      />
                      <CurrencyDollarIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tax Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 pl-7"
                        value={calculatedTaxAmount.toFixed(2)}
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
                    {editingId ? "Update Tax Record" : "Create Tax Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tax Record Details Modal - sourceId removed */}
        {showDetailsModal && selectedRecord && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">Tax Record Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6">
                {/* ID and Type */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Record ID</p>
                    <p className="text-2xl font-bold text-gray-900">#{selectedRecord.id}</p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getTransactionTypeColor(selectedRecord.transactionType)}`}>
                    {getTransactionTypeIcon(selectedRecord.transactionType)}
                    <span className="ml-1">{selectedRecord.transactionType.replace('_', ' ')}</span>
                  </span>
                </div>

                {/* Source Module */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Source Module</p>
                  <div className="flex items-center">
                    {getSourceModuleIcon(selectedRecord.sourceModule)}
                    <span className={`ml-2 px-2 py-1 text-sm font-medium rounded-full ${getSourceModuleColor(selectedRecord.sourceModule)}`}>
                      {selectedRecord.sourceModule.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Tax Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Tax Type</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ReceiptPercentIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedRecord.taxType?.taxName || 'N/A'}
                      </p>
                    </div>
                    {selectedRecord.taxType?.taxRate && (
                      <span className="text-sm font-medium text-cyan-600">
                        {(selectedRecord.taxType.taxRate * 100).toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Financial Info */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Taxable Amount</p>
                    <p className="text-xl font-bold text-gray-900">
                      {selectedRecord.taxableAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Tax Amount</p>
                    <p className="text-xl font-bold text-cyan-600">
                      {selectedRecord.taxAmount.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Date */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Transaction Date</p>
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(selectedRecord.transactionDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-3 rounded-b-lg flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleEdit(selectedRecord);
                  }}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Edit Record
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

export default TaxRecordPage;