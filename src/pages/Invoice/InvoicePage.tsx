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
  CalendarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  BuildingOfficeIcon,
  UserIcon,
  TagIcon,
  ReceiptPercentIcon,
  ClockIcon,
  MapPinIcon,
  CreditCardIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ToasterService } from "../../Services/ToasterService";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

/* API ENDPOINTS */
const API_INVOICES = "/v1/api/invoice/invoices";
const API_CUSTOMERS = "/v1/api/invoice/customers";
const API_TAX_TYPES = "/v1/api/invoice/tax-types";
const API_PAYMENT_TERMS = "/v1/api/invoice/payment-terms";
const API_PRODUCTS_BY_CATEGORY = "/v1/api/invoice/products/by-category";
const API_CATEGORIES = "/v1/api/invoice/categories";

/* Type Definitions */
interface Customer { id: number; name: string; email?: string; phone?: string; }
interface Category { id: number; name: string; }
interface Product { id: number; name: string; category?: Category; unitPrice?: number; taxRate?: number; }
interface TaxType { id: number; taxName: string; taxRate: number; }
interface PaymentTerm { id: number; termCode: string; description?: string; }
interface LineItem {
  product?: Product;
  categoryId?: number;
  category: { id: number };
  productId?: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  taxRate?: number;
}
interface TaxDetail { taxTypeId: number; taxRate: number; taxableAmount: number; taxAmount: number; }
interface Invoice {
  id?: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  customer: { id: number };
  paymentTerm?: { id: number };
  billingAddress: string;
  shippingAddress: string;
  lineItems: LineItem[];
  taxDetails: TaxDetail[];
  subTotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  status: string;
}

const PAGE_SIZE = 10;

const InvoicePage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<{ [key: number]: Product[] }>({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Invoice>("invoiceDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

  const emptyInvoice: Invoice = {
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    currency: "USD",
    customer: { id: 0 },
    paymentTerm: undefined,
    billingAddress: "",
    shippingAddress: "",
    lineItems: [],
    taxDetails: [],
    subTotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0,
    amountPaid: 0,
    balance: 0,
    status: "DRAFT",
  };

  const [form, setForm] = useState<Invoice>(emptyInvoice);

  /* Load Initial Data */
  const loadData = async () => {
    try {
      const [invRes, custRes, taxRes, termRes, catRes] = await Promise.all([
        axios.get(API_INVOICES),
        axios.get(API_CUSTOMERS),
        axios.get(API_TAX_TYPES),
        axios.get(API_PAYMENT_TERMS),
        axios.get(API_CATEGORIES),
      ]);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      setCustomers(Array.isArray(custRes.data) ? custRes.data : []);
      setTaxTypes(Array.isArray(taxRes.data) ? taxRes.data : []);
      setTerms(Array.isArray(termRes.data) ? termRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (err) {
      console.error("Error loading data:", err);
      ToasterService.error("Failed to load data");
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleChange = (key: keyof Invoice, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* Line Item Handlers */
  const addLineItem = () => {
    setForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, {
        categoryId: 0,
        category: { id: 0 },
        productId: 0,
        product: undefined,
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        total: 0
      }]
    }));
  };

  const removeLineItem = (i: number) => {
    setForm(prev => {
      const updated = prev.lineItems.filter((_, idx) => idx !== i);
      recalcTotals(updated, prev.taxDetails);
      return { ...prev, lineItems: updated };
    });
  };

  const recalcTotals = (items: LineItem[], taxes: TaxDetail[]) => {
    const subTotal = items.reduce((sum, i) => sum + (i.quantity ?? 0) * (i.unitPrice ?? 0), 0);
    const totalDiscount = items.reduce((sum, i) => sum + (i.discount ?? 0), 0);
    const totalTax = taxes.reduce((sum, t) => sum + (t.taxAmount ?? 0), 0);
    const grandTotal = subTotal - totalDiscount + totalTax;
    setForm(prev => ({
      ...prev,
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal,
      balance: grandTotal - prev.amountPaid
    }));
  };

  const updateLineItem = (i: number, changes: Partial<LineItem>) => {
    setForm(prev => {
      const updated = [...prev.lineItems];
      updated[i] = { ...updated[i], ...changes };
      updated[i].total = (updated[i].quantity ?? 1) * (updated[i].unitPrice ?? 0) - (updated[i].discount ?? 0);
      recalcTotals(updated, prev.taxDetails);
      return { ...prev, lineItems: updated };
    });
  };

  const handleCategoryChange = async (i: number, categoryId: number) => {
    let products: Product[] = [];
    if (categoryId && !productsByCategory[categoryId]) {
      const res = await axios.get(`${API_PRODUCTS_BY_CATEGORY}/${categoryId}`);
      products = Array.isArray(res.data) ? res.data : [];
      setProductsByCategory(prev => ({ ...prev, [categoryId]: products }));
    } else {
      products = productsByCategory[categoryId] || [];
    }

    updateLineItem(i, { categoryId, productId: 0, product: undefined, unitPrice: 0, taxRate: 0 });
  };

  const handleProductChange = (i: number, productId: number) => {
    const lineItem = form.lineItems[i];
    const productList = productsByCategory[lineItem.categoryId || 0] || [];
    const product = productList.find(p => p.id === productId);
    updateLineItem(i, { productId, product, unitPrice: product?.unitPrice ?? 0, taxRate: product?.taxRate ?? 0 });
  };

  /* Tax Details */
  const addTaxDetail = () => {
    setForm(prev => ({
      ...prev,
      taxDetails: [...prev.taxDetails, {
        taxTypeId: 0,
        taxRate: 0,
        taxableAmount: 0,
        taxAmount: 0
      }]
    }));
  };

  const updateTaxDetail = (i: number, changes: Partial<TaxDetail>) => {
    setForm(prev => {
      const updated = [...prev.taxDetails];
      updated[i] = { ...updated[i], ...changes };
      updated[i].taxAmount = updated[i].taxableAmount * (updated[i].taxRate / 100);
      recalcTotals(prev.lineItems, updated);
      return { ...prev, taxDetails: updated };
    });
  };

  const removeTaxDetail = (i: number) => {
    setForm(prev => {
      const updated = prev.taxDetails.filter((_, idx) => idx !== i);
      recalcTotals(prev.lineItems, updated);
      return { ...prev, taxDetails: updated };
    });
  };

  /* Edit / Submit / Delete */
  const handleEdit = async (inv: Invoice) => {
    setEditingId(inv.id!);
    const mappedLineItems = await Promise.all(
      inv.lineItems.map(async (item) => {
        const catId = item.categoryId || item.product?.category?.id || 0;
        if (catId && !productsByCategory[catId]) {
          const res = await axios.get(`${API_PRODUCTS_BY_CATEGORY}/${catId}`);
          setProductsByCategory(prev => ({ ...prev, [catId]: Array.isArray(res.data) ? res.data : [] }));
        }
        const productList = productsByCategory[catId] || [];
        const product = productList.find(p => p.id === item.productId) || item.product;
        return { ...item, categoryId: catId, productId: item.productId || product?.id, product };
      })
    );
    setForm({ ...inv, lineItems: mappedLineItems });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.customer.id) {
      ToasterService.error("Customer is required");
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${API_INVOICES}/${editingId}`, form);
        ToasterService.success("Invoice updated successfully");
      } else {
        await axios.post(API_INVOICES, form);
        ToasterService.success("Invoice created successfully");
      }
      resetForm();
      loadData();
    } catch (err: any) {
      console.error("Error saving invoice:", err);
      if (err.response) {
        ToasterService.error(`Error: ${err.response.data.message || err.response.statusText}`);
      } else {
        ToasterService.error("Failed to save invoice");
      }
    }
  };

  const resetForm = () => {
    setForm(emptyInvoice);
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Are you sure you want to delete this invoice? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await axios.delete(`${API_INVOICES}/${id}`);
      ToasterService.success("Invoice deleted successfully");
      loadData();
    } catch (err: any) {
      console.error("Error deleting invoice:", err);
      ToasterService.error(err.response?.data?.message || "Failed to delete invoice");
    }
  };

  const handleViewDetails = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailsModal(true);
  };

  /* Export PDF / Excel */
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Invoice List", 14, 14);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const safeBody = invoices.map((inv) => [
      inv.invoiceNumber || "",
      customers.find((c) => c.id === inv.customer.id)?.name || "",
      inv.invoiceDate || "",
      inv.status || "",
      `${inv.currency} ${inv.grandTotal?.toFixed(2) ?? "0.00"}`,
    ]);

    autoTable(doc, {
      head: [["Invoice #", "Customer", "Date", "Status", "Total"]],
      body: safeBody,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    doc.save(`Invoices_${new Date().toISOString().split('T')[0]}.pdf`);
    setShowExportMenu(false);
  };

  const exportExcel = () => {
    const exportData = invoices.map(inv => ({
      'Invoice #': inv.invoiceNumber,
      'Customer': customers.find((c) => c.id === inv.customer.id)?.name || '',
      'Date': inv.invoiceDate,
      'Due Date': inv.dueDate,
      'Status': inv.status,
      'Subtotal': inv.subTotal,
      'Tax': inv.totalTax,
      'Total': inv.grandTotal,
      'Amount Paid': inv.amountPaid,
      'Balance': inv.balance
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `Invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  /* Filtering / Sorting / Pagination */
  const filtered = invoices.filter((i) => {
    const matchesSearch = [
      i.invoiceNumber,
      customers.find(c => c.id === i.customer.id)?.name,
      i.status
    ].some(text => text?.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = selectedStatus ? i.status === selectedStatus : true;

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

    if (sortKey === "grandTotal" || sortKey === "subTotal") {
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

  const handleSort = (field: keyof Invoice) => {
    if (sortKey === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: keyof Invoice }) => {
    if (sortKey !== column) return null;
    return sortOrder === "asc" ?
      <ArrowUpIcon className="h-3 w-3 inline ml-1" /> :
      <ArrowDownIcon className="h-3 w-3 inline ml-1" />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "OVERDUE": return "bg-red-100 text-red-800";
      case "DRAFT": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID": return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case "PENDING": return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      case "OVERDUE": return <ExclamationCircleIcon className="h-4 w-4 text-red-600" />;
      case "DRAFT": return <DocumentTextIcon className="h-4 w-4 text-gray-600" />;
      default: return <TagIcon className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <>
      <PageMeta title="Invoices" description="Manage your invoices" />
      <PageBreadcrumb pageTitle="Invoices" />

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
                placeholder="Search invoices..."
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
            {!showForm && (
              <AddButton
                label="Create Invoice"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    ...emptyInvoice,
                    invoiceDate: new Date().toISOString().split('T')[0]
                  });
                  setShowForm(true);
                }}
              />
            )}
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
                  <option value="DRAFT">Draft</option>
                  <option value="PAID">Paid</option>
                  <option value="UNPAID">Un Paid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="SENT">Sent</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="VOID">Void</option>
                  <option value="OTHER">Other</option>
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

        {/* Stats Cards with Icons */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Total Invoices" value={invoices.length} gradient="from-blue-50 to-white" borderColor="border-blue-100" labelColor="text-blue-700" icon={<DocumentDuplicateIcon className="h-6 w-6 text-blue-600" />} />
          <StatsCard label="Total Amount" value={invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0).toFixed(2)} gradient="from-cyan-50 to-white" borderColor="border-cyan-100" labelColor="text-cyan-700" icon={<BanknotesIcon className="h-6 w-6 text-cyan-600" />} />
          <StatsCard label="Paid" value={invoices.filter(inv => inv.status === "PAID").length} gradient="from-green-50 to-white" borderColor="border-green-100" labelColor="text-green-700" icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />} />
          <StatsCard label="Pending" value={invoices.filter(inv => inv.status === "PENDING").length} gradient="from-yellow-50 to-white" borderColor="border-yellow-100" labelColor="text-yellow-700" icon={<ClockIcon className="h-6 w-6 text-yellow-600" />} />
        </div>

        {/* Invoice Table */}
        {!showForm && (
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: 'invoiceNumber', label: 'Invoice #' },
                      { key: null, label: 'Customer' },
                      { key: 'invoiceDate', label: 'Date' },
                      { key: 'dueDate', label: 'Due Date' },
                      { key: 'grandTotal', label: 'Total' },
                      { key: 'status', label: 'Status' },
                      { key: null, label: 'Actions' },
                    ].map((column, index) => (
                      <th
                        key={index}
                        onClick={() => column.key && handleSort(column.key as keyof Invoice)}
                        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.key ? 'cursor-pointer hover:bg-gray-100' : ''
                          }`}
                      >
                        <span className="flex items-center">
                          {column.label}
                          {column.key && <SortIcon column={column.key as keyof Invoice} />}
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
                            <span className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">
                              {customers.find((c) => c.id === inv.customer.id)?.name}
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
                            {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm font-medium text-gray-900">
                            <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-1" />
                            {Number(inv.grandTotal ?? 0).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(inv.status)}`}>
                            {getStatusIcon(inv.status)}
                            <span className="ml-1">{inv.status}</span>
                          </span>
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
                                      handleViewDetails(inv);
                                    }}
                                    className={`${active ? "bg-gray-50" : ""
                                      } w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                  >
                                    <DocumentTextIcon className="h-4 w-4 text-blue-600" />
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
                                      handleDelete(inv.id!);
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
                          <p className="text-gray-500 text-sm mb-2">No invoices found</p>
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
        )}

        {/* Invoice Form Modal */}
        <Modal
          isOpen={showForm}
          onClose={resetForm}
          title={editingId ? "Edit Invoice" : "Create New Invoice"}
          icon={<DocumentTextIcon className="h-5 w-5 text-cyan-600" />}
          size="5xl"
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="invoice-form"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                {editingId ? "Update Invoice" : "Create Invoice"}
              </button>
            </div>
          }
        >
          <form id="invoice-form" onSubmit={handleSubmit} className="p-6">
            {/* Basic Information */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-2 text-cyan-600" />
                Basic Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    selected={form.invoiceDate ? new Date(form.invoiceDate) : null}
                    onChange={(date) => handleChange("invoiceDate", date ? date.toISOString().split('T')[0] : "")}
                    dateFormat="yyyy-MM-dd"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <DatePicker
                    selected={form.dueDate ? new Date(form.dueDate) : null}
                    onChange={(date) => handleChange("dueDate", date ? date.toISOString().split('T')[0] : "")}
                    dateFormat="yyyy-MM-dd"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <BuildingOfficeIcon className="h-5 w-5 mr-2 text-cyan-600" />
                Customer Information
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.customer.id}
                    onChange={(e) => handleChange("customer", { id: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    required
                  >
                    <option value={0}>Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Term
                  </label>
                  <select
                    value={form.paymentTerm?.id || ""}
                    onChange={(e) => handleChange("paymentTerm", e.target.value ? { id: Number(e.target.value) } : undefined)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Select Payment Term</option>
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>{t.termCode}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <MapPinIcon className="h-5 w-5 mr-2 text-cyan-600" />
                Addresses
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Address
                  </label>
                  <textarea
                    value={form.billingAddress}
                    onChange={(e) => handleChange("billingAddress", e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Enter billing address..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Shipping Address
                  </label>
                  <textarea
                    value={form.shippingAddress}
                    onChange={(e) => handleChange("shippingAddress", e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Enter shipping address..."
                  />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900 flex items-center">
                  <TagIcon className="h-5 w-5 mr-2 text-cyan-600" />
                  Line Items
                </h4>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="px-3 py-1 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {form.lineItems.map((item, i) => {
                  const categoryId = item.categoryId || 0;
                  const productList = categoryId ? productsByCategory[categoryId] || [] : [];
                  return (
                    <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Category</label>
                          <select
                            value={item.categoryId || 0}
                            onChange={e => handleCategoryChange(i, Number(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                          >
                            <option value={0}>Select Category</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Product</label>
                          <select
                            value={item.productId || 0}
                            onChange={e => handleProductChange(i, Number(e.target.value))}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                            disabled={!item.categoryId}
                          >
                            <option value={0}>Select Product</option>
                            {productList.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Qty</label>
                          <input
                            type="number"
                            value={item.quantity}
                            min={1}
                            onChange={e => updateLineItem(i, { quantity: Number(e.target.value) })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Price</label>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={e => updateLineItem(i, { unitPrice: Number(e.target.value) })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Discount</label>
                          <input
                            type="number"
                            value={item.discount}
                            onChange={e => updateLineItem(i, { discount: Number(e.target.value) })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                          />
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Total</label>
                            <span className="text-sm font-medium text-gray-900">
                              {(item.total ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLineItem(i)}
                            className="p-2 text-red-600 hover:text-red-800"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tax Details */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900 flex items-center">
                  <ReceiptPercentIcon className="h-5 w-5 mr-2 text-cyan-600" />
                  Tax Details
                </h4>
                <button
                  type="button"
                  onClick={addTaxDetail}
                  className="px-3 py-1 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Tax
                </button>
              </div>

              <div className="space-y-3">
                {form.taxDetails.map((tax, i) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Tax Type</label>
                        <select
                          value={tax.taxTypeId}
                          onChange={e => updateTaxDetail(i, { taxTypeId: Number(e.target.value) })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                        >
                          <option value={0}>Select Tax Type</option>
                          {taxTypes.map((t) => (
                            <option key={t.id} value={t.id}>{t.taxName} ({t.taxRate}%)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Rate %</label>
                        <input
                          type="number"
                          value={tax.taxRate}
                          onChange={e => updateTaxDetail(i, { taxRate: Number(e.target.value) })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Taxable Amount</label>
                        <input
                          type="number"
                          value={tax.taxableAmount}
                          onChange={e => updateTaxDetail(i, { taxableAmount: Number(e.target.value) })}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                        />
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tax Amount</label>
                          <span className="text-sm font-medium text-gray-900">
                            {tax.taxAmount.toFixed(2)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTaxDetail(i)}
                          className="p-2 text-red-600 hover:text-red-800"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <CreditCardIcon className="h-5 w-5 mr-2 text-cyan-600" />
                Payment Summary
              </h4>
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium text-gray-900">{form.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Discount:</span>
                      <span className="font-medium text-red-600">-{form.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Tax:</span>
                      <span className="font-medium text-green-600">+{form.totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total:</span>
                      <span className="text-cyan-600">{form.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-600">Amount Paid:</label>
                      <input
                        type="number"
                        value={form.amountPaid}
                        onChange={e => handleChange("amountPaid", Number(e.target.value))}
                        className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm text-right"
                      />
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="font-medium text-gray-700">Balance:</span>
                      <span className={`font-bold ${form.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {form.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Modal>

        {/* Invoice Details Modal */}
        <Modal
          isOpen={showDetailsModal && !!selectedInvoice}
          onClose={() => setShowDetailsModal(false)}
          title="Invoice Details"
          icon={<DocumentTextIcon className="h-5 w-5 text-cyan-600" />}
          size="4xl"
          footer={
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  handleEdit(selectedInvoice!);
                }}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Edit Invoice
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
          {selectedInvoice && (
            <div className="p-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{selectedInvoice.invoiceNumber}</h4>
                  <p className="text-sm text-gray-500">
                    Issued: {new Date(selectedInvoice.invoiceDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  {selectedInvoice.dueDate && (
                    <p className="text-sm text-gray-500">
                      Due: {new Date(selectedInvoice.dueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  )}
                </div>
                <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedInvoice.status)}`}>
                  {getStatusIcon(selectedInvoice.status)}
                  <span className="ml-1">{selectedInvoice.status}</span>
                </span>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Customer</p>
                  <p className="text-base font-medium text-gray-900">
                    {customers.find(c => c.id === selectedInvoice.customer.id)?.name}
                  </p>
                </div>
                {selectedInvoice.paymentTerm && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Payment Terms</p>
                    <p className="text-base text-gray-900">
                      {terms.find(t => t.id === selectedInvoice.paymentTerm?.id)?.termCode}
                    </p>
                  </div>
                )}
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {selectedInvoice.billingAddress && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Billing Address</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedInvoice.billingAddress}</p>
                  </div>
                )}
                {selectedInvoice.shippingAddress && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Shipping Address</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedInvoice.shippingAddress}</p>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="mb-6">
                <h5 className="text-md font-medium text-gray-900 mb-3">Line Items</h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Discount</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedInvoice.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {item.product?.name || `Product #${item.productId}`}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.discount.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tax Details */}
              {selectedInvoice.taxDetails.length > 0 && (
                <div className="mb-6">
                  <h5 className="text-md font-medium text-gray-900 mb-3">Tax Details</h5>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tax Type</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Rate</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Taxable Amount</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Tax Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedInvoice.taxDetails.map((tax, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {taxTypes.find(t => t.id === tax.taxTypeId)?.taxName || `Tax #${tax.taxTypeId}`}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{tax.taxRate}%</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{tax.taxableAmount.toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-gray-900 text-right">{tax.taxAmount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900">{selectedInvoice.subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Discount:</span>
                      <span className="text-red-600">-{selectedInvoice.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Tax:</span>
                      <span className="text-green-600">+{selectedInvoice.totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Grand Total:</span>
                      <span className="text-cyan-600">{selectedInvoice.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Amount Paid:</span>
                      <span className="text-gray-900">{selectedInvoice.amountPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-700">Balance:</span>
                      <span className={selectedInvoice.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                        {selectedInvoice.balance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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

export default InvoicePage;
