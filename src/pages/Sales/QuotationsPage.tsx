import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PencilSquareIcon,
  TrashIcon,
  CalendarIcon,
  XMarkIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusCircleIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

type Status = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";

interface Product {
  id: number;
  name: string;
  price: number;
  availableStock: number;
}

interface QuotationItem {
  id?: number;
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  totalPrice: number;
}

interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Quotation {
  id: number;
  quoteNumber?: string;
  customer?: Customer;
  validUntil: string;
  status: Status;
  items: QuotationItem[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  remarks: string;
  createdAt?: string;
  referenceNumber?: string;
  quoteDate?: string;
  salesperson?: string;
  projectName?: string;
  subject?: string;
  termsConditions?: string;
}

interface LineItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
}

const statusColors: Record<Status, { bg: string; text: string; icon: React.ReactElement }> = {
  DRAFT: { bg: "bg-gray-100", text: "text-gray-800", icon: <DocumentTextIcon className="h-3 w-3 mr-1" /> },
  SENT: { bg: "bg-blue-100", text: "text-blue-800", icon: <ClockIcon className="h-3 w-3 mr-1" /> },
  ACCEPTED: { bg: "bg-green-100", text: "text-green-800", icon: <CheckCircleIcon className="h-3 w-3 mr-1" /> },
  REJECTED: { bg: "bg-red-100", text: "text-red-800", icon: <XCircleIcon className="h-3 w-3 mr-1" /> },
};

export default function QuotationsManager() {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const headers = { Authorization: `Bearer ${token}` };

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Bulk items modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [bulkSelectedItems, setBulkSelectedItems] = useState<{ product: Product; quantity: number }[]>([]);

  const handleToggleBulkItem = (product: Product) => {
    setBulkSelectedItems(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        return prev.filter(item => item.product.id !== product.id);
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const handleUpdateBulkQty = (productId: number, delta: number) => {
    setBulkSelectedItems(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const handleAddBulkItemsToQuote = () => {
    setLineItems(prev => {
      const updated = [...prev];
      // Filter out any default row that is empty (productId === 0)
      const cleaned = updated.filter(item => item.productId !== 0);
      bulkSelectedItems.forEach(bulkItem => {
        const existsIdx = cleaned.findIndex(item => item.productId === bulkItem.product.id);
        if (existsIdx >= 0) {
          cleaned[existsIdx].quantity += bulkItem.quantity;
        } else {
          cleaned.push({
            productId: bulkItem.product.id,
            quantity: bulkItem.quantity,
            unitPrice: bulkItem.product.price,
            discount: 0,
            tax: 0
          });
        }
      });
      return cleaned;
    });
    setIsBulkModalOpen(false);
    setBulkSelectedItems([]);
    setBulkSearchQuery("");
  };

  const [form, setForm] = useState({
    customerId: 0,
    validUntil: new Date().toISOString().split("T")[0],
    status: "DRAFT" as Status,
    remarks: "",
    quoteNumber: "",
    referenceNumber: "",
    quoteDate: new Date().toISOString().split("T")[0],
    salesperson: "",
    projectName: "",
    subject: "",
    termsConditions: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [globalAdjustment, setGlobalAdjustment] = useState<number>(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const res = await fetch("/v1/api/sales/quotations", { headers });
      if (res.ok) setQuotations(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/v1/api/sales/customers", { headers });
      if (res.ok) setCustomers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("/v1/api/sales/products", { headers });
      if (res.ok) setProducts(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchQuotationDetails = async (id: number) => {
    try {
      const res = await fetch(`/v1/api/sales/quotations/${id}`, { headers });
      if (res.ok) return await res.json();
    } catch (err) { console.error(err); }
    return null;
  };

  const addLineItem = () =>
    setLineItems(prev => [...prev, { productId: 0, quantity: 1, unitPrice: 0, discount: 0, tax: 0 }]);

  const removeLineItem = (i: number) =>
    setLineItems(prev => prev.filter((_, idx) => idx !== i));

  const updateLineItem = (i: number, field: keyof LineItem, value: number) => {
    setLineItems(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "productId") {
        const p = products.find(p => p.id === value);
        if (p) next[i].unitPrice = p.price;
      }
      return next;
    });
  };

  const calcItemTotals = (item: LineItem) => {
    const total = item.quantity * item.unitPrice;
    const discAmt = (total * item.discount) / 100;
    const subtotal = total - discAmt;
    const taxAmt = (subtotal * item.tax) / 100;
    return { totalPrice: total, discountAmount: discAmt, taxAmount: taxAmt, grandTotal: subtotal + taxAmt };
  };

  const calcTotals = () =>
    lineItems.reduce((acc, item) => {
      const t = calcItemTotals(item);
      return { totalAmount: acc.totalAmount + t.totalPrice, discountAmount: acc.discountAmount + t.discountAmount, taxAmount: acc.taxAmount + t.taxAmount, grandTotal: acc.grandTotal + t.grandTotal };
    }, { totalAmount: 0, discountAmount: 0, taxAmount: 0, grandTotal: 0 });

  const openEditModal = async (q: Quotation) => {
    setEditingId(q.id);
    setLoading(true);
    const full = await fetchQuotationDetails(q.id);
    if (full?.items?.length) {
      setForm({
        customerId: full.customer?.id || 0, validUntil: full.validUntil, status: full.status, remarks: full.remarks || "",
        quoteNumber: full.quoteNumber || "", referenceNumber: full.referenceNumber || "", quoteDate: full.quoteDate || new Date().toISOString().split("T")[0],
        salesperson: full.salesperson || "", projectName: full.projectName || "", subject: full.subject || "", termsConditions: full.termsConditions || ""
      });
      setLineItems(full.items.map((i: any) => ({ productId: i.product.id, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, tax: i.tax })));
    } else {
      setForm({
        customerId: q.customer?.id || 0, validUntil: q.validUntil, status: q.status, remarks: q.remarks || "",
        quoteNumber: q.quoteNumber || "", referenceNumber: q.referenceNumber || "", quoteDate: q.quoteDate || new Date().toISOString().split("T")[0],
        salesperson: q.salesperson || "", projectName: q.projectName || "", subject: q.subject || "", termsConditions: q.termsConditions || ""
      });
      setLineItems([]);
    }
    setLoading(false);
    setIsOpen(true);
  };

  const saveQuotation = async () => {
    if (!form.customerId || !form.validUntil) { setError("Please select a customer and valid until date"); return; }
    if (!lineItems.length) { setError("Please add at least one product"); return; }
    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.productId) { setError(`Please select a product for line item ${i + 1}`); return; }
      const p = products.find(p => p.id === item.productId);
      if (p && item.quantity > p.availableStock) { setError(`Line item ${i + 1}: Insufficient stock for ${p.name}. Available: ${p.availableStock}`); return; }
    }
    setLoading(true); setError(null);
    const totals = calcTotals();
    const payload = {
      validUntil: form.validUntil, status: form.status, remarks: form.remarks,
      quoteNumber: form.quoteNumber, referenceNumber: form.referenceNumber, quoteDate: form.quoteDate,
      salesperson: form.salesperson, projectName: form.projectName, subject: form.subject,
      items: lineItems.map(item => { const t = calcItemTotals(item); return { product: { id: item.productId }, quantity: item.quantity, unitPrice: item.unitPrice, discount: item.discount, tax: item.tax, totalPrice: t.totalPrice }; }),
      ...totals,
    };
    try {
      const url = editingId ? `/v1/api/sales/quotations/${editingId}` : `/v1/api/sales/quotations/customer/${form.customerId}`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        const data = await res.json();
        setQuotations(prev => editingId ? prev.map(q => q.id === editingId ? data : q) : [data, ...prev]);
        setIsOpen(false); resetForm();
      } else {
        const e = await res.json();
        setError(e.message || "Failed to save quotation");
      }
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const promptDelete = (id: number) => { setDeletingId(id); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const res = await fetch(`/v1/api/sales/quotations/${deletingId}`, { method: "DELETE", headers });
      if (res.ok) setQuotations(prev => prev.filter(q => q.id !== deletingId));
      else alert("Failed to delete quotation");
    } catch { alert("Network error."); }
    finally { setDeletingId(null); }
  };

  const resetForm = () => {
    setForm({
      customerId: 0, validUntil: new Date().toISOString().split("T")[0], status: "DRAFT", remarks: "",
      quoteNumber: "", referenceNumber: "", quoteDate: new Date().toISOString().split("T")[0],
      salesperson: "", projectName: "", subject: "", termsConditions: ""
    });
    setLineItems([]); setEditingId(null); setError(null);
    setUploadedFiles([]); setGlobalDiscount(0); setGlobalAdjustment(0);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(file => file.size <= 10 * 1024 * 1024);
      if (newFiles.length !== validFiles.length) alert("Some files exceed 10MB limit.");
      setUploadedFiles(prev => [...prev, ...validFiles].slice(0, 3));
    }
  };
  const removeFile = (index: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== index));

  const stats = {
    total: quotations.length,
    draft: quotations.filter(q => q.status === "DRAFT").length,
    accepted: quotations.filter(q => q.status === "ACCEPTED").length,
    rejected: quotations.filter(q => q.status === "REJECTED").length,
  };

  const totals = calcTotals();

  const handleViewQuotation = (id: number) => {
    navigate(`/quote-view/${id}`);
  };

  const columns: ColumnDef<Quotation>[] = [
    {
      key: "quoteNumber", label: "Quote #", sortable: true,
      render: (row) => <span className="text-sm font-medium text-cyan-600">{row.quoteNumber || "DRAFT"}</span>,
    },
    {
      key: "customer", label: "Customer", sortable: true,
      render: (row) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{row.customer?.name || "—"}</div>
          {row.customer?.email && <div className="text-xs text-gray-500">{row.customer.email}</div>}
        </div>
      ),
    },
    {
      key: "validUntil", label: "Valid Until", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-900">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          {new Date(row.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </div>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[row.status].bg} ${statusColors[row.status].text}`}>
          {statusColors[row.status].icon}{row.status}
        </span>
      ),
    },
    {
      key: "grandTotal", label: "Grand Total", sortable: true,
      className: "text-right", headerClassName: "text-right",
      render: (row) => <span className="text-sm font-semibold text-gray-900">${row.grandTotal.toFixed(2)}</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleViewQuotation(row.id)} title="View"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <EyeIcon className="h-4 w-4" />
          </button>
          <button onClick={() => openEditModal(row)} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(row.id)} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];


  if (isOpen) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <PageMeta title={editingId ? "Edit Quotation" : "Create New Quotation"} description="Manage your Sales Quotations" />

        <div className="bg-gradient-to-br from-white via-slate-50/50 to-slate-100 dark:from-gray-900 dark:via-gray-950/30 dark:to-gray-950 rounded-3xl border border-slate-200/60 dark:border-gray-800/80 shadow-xl shadow-slate-100/50 dark:shadow-none p-8 space-y-8 animate-fadeIn relative overflow-hidden">
          {/* Top decorative gradient glow accent */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />

          <div className="flex justify-between items-center border-b border-slate-200/50 pb-5">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <span className="p-2 bg-cyan-500/10 rounded-xl text-cyan-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </span>
                {editingId ? "Edit Quote" : "New Quote"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">Configure quotation details and customer info</p>
            </div>
            <button
              onClick={() => { setIsOpen(false); resetForm(); }}
              className="h-10 w-10 rounded-full border border-slate-200/60 hover:border-cyan-500/30 dark:border-gray-800 text-slate-400 hover:text-cyan-600 flex items-center justify-center hover:bg-cyan-500/5 hover:rotate-90 transition-all duration-300"
              title="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={e => { e.preventDefault(); saveQuotation(); }} className="space-y-8">
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="flex flex-col gap-6 mb-12 w-full max-w-4xl">
                {/* Customer Row */}
                <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 text-[13px] font-bold text-slate-500 uppercase tracking-wider mt-3 transition-colors group-focus-within:text-blue-600">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <div className="flex-1 max-w-2xl">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 max-w-[320px]">
                        <div className="flex shadow-sm rounded-xl overflow-hidden transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-500/20">
                          <select name="customerId" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: Number(e.target.value) }))}
                            required disabled={!!editingId}
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 border-r-0 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 disabled:bg-gray-100 text-[15px] font-medium text-slate-800 transition-colors truncate">
                            <option value={0}>Select Customer</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <button type="button" className="bg-blue-600 text-white px-4 py-2.5 hover:bg-blue-700 flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </button>
                          <div className="flex items-center justify-center px-4 border border-l-0 border-slate-200 bg-white">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-sm">₹</span>
                              INR
                            </span>
                          </div>
                        </div>
                        {form.customerId > 0 && (
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <p className="text-[11px] text-slate-400 font-bold mb-1 tracking-wider">BILLING ADDRESS</p>
                              <button type="button" className="text-blue-600 hover:text-blue-800 text-[13px] font-medium transition-colors">New Address</button>
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-400 font-bold mb-1 tracking-wider">SHIPPING ADDRESS</p>
                              <button type="button" className="text-blue-600 hover:text-blue-800 text-[13px] font-medium transition-colors">New Address</button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="hidden sm:block mt-1">
                        <button type="button" className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-[14px] font-semibold hover:bg-slate-50 hover:border-slate-300 shadow-sm flex items-center gap-2 transition-all">
                          {customers.find(c => c.id === form.customerId)?.name || "Customer"}'s Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote Number */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 text-[13px] font-bold text-slate-500 uppercase tracking-wider transition-colors group-focus-within:text-blue-600">
                    Quote# <span className="text-red-500">*</span>
                  </label>
                  <div className="flex-1 max-w-2xl">
                    <div className="flex max-w-[320px] relative shadow-sm rounded-xl">
                      <input type="text" value={form.quoteNumber} onChange={e => setForm(f => ({ ...f, quoteNumber: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all pr-10" placeholder="QT-000001" required />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700 transition-colors bg-white/80 rounded p-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reference Number */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 text-[13px] font-bold text-slate-500 uppercase tracking-wider transition-colors group-focus-within:text-blue-600">Reference#</label>
                  <div className="flex-1 max-w-2xl">
                    <input type="text" value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                      className="max-w-[320px] w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all shadow-sm" />
                  </div>
                </div>

                {/* Dates */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 text-[13px] font-bold text-slate-500 uppercase tracking-wider transition-colors group-focus-within:text-blue-600">
                    Quote Date <span className="text-red-500">*</span>
                  </label>
                  <div className="flex-1 max-w-2xl flex flex-wrap gap-4 sm:gap-6 items-center">
                    <div className="w-[320px]">
                      <DatePicker
                        selected={form.quoteDate ? new Date(form.quoteDate) : null}
                        onChange={date => setForm(f => ({ ...f, quoteDate: date ? date.toISOString().split("T")[0] : "" }))}
                        dateFormat="dd/MM/yyyy" placeholderText="dd/MM/yyyy"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all shadow-sm" required />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="text-[13px] font-bold text-slate-500 uppercase tracking-wider">Expiry Date</label>
                      <div className="w-[180px]">
                        <DatePicker
                          selected={form.validUntil ? new Date(form.validUntil) : null}
                          onChange={date => setForm(f => ({ ...f, validUntil: date ? date.toISOString().split("T")[0] : "" }))}
                          dateFormat="dd/MM/yyyy" placeholderText="dd/MM/yyyy"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salesperson */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 text-[13px] font-bold text-slate-500 uppercase tracking-wider transition-colors group-focus-within:text-blue-600">Salesperson</label>
                  <div className="flex-1 max-w-2xl">
                    <div className="max-w-[320px] relative shadow-sm rounded-xl">
                      <select value={form.salesperson} onChange={e => setForm(f => ({ ...f, salesperson: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all appearance-none pr-10 cursor-pointer">
                        <option value="" className="text-slate-400">Select Salesperson</option>
                        <option value="Abi">Abi</option>
                      </select>
                      {form.salesperson && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, salesperson: "" }))} className="absolute right-10 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-white/80 rounded p-0.5 transition-colors">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Project Name */}
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 text-[13px] font-bold text-slate-500 uppercase tracking-wider transition-colors group-focus-within:text-blue-600">Project Name</label>
                  <div className="flex-1 max-w-2xl">
                    <div className="max-w-[320px] relative shadow-sm rounded-xl">
                      <select value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all appearance-none pr-10 cursor-pointer">
                        <option value="" className="text-slate-400">Select a project</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subject */}
                <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 group">
                  <label className="md:w-48 shrink-0 flex items-center gap-1.5 text-[13px] font-bold text-slate-500 uppercase tracking-wider mt-3 transition-colors group-focus-within:text-blue-600">
                    Subject
                    <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  </label>
                  <div className="flex-1 max-w-2xl">
                    <textarea value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      className="max-w-[320px] w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-[15px] font-medium text-slate-800 transition-all shadow-sm resize-none" rows={2} placeholder="Sample Purchase"></textarea>
                  </div>
                </div>
              </div>              {/* Item Table section */}
              <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="p-3 border-b border-gray-200 bg-gray-50/80">
                  <h4 className="text-[13px] font-bold text-gray-800 uppercase tracking-wider">Item Table</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-white border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 min-w-[250px] border-r border-gray-100">Item Details</th>
                        <th className="px-3 py-2 w-24 text-right border-r border-gray-100">Quantity</th>
                        <th className="px-3 py-2 w-32 text-right border-r border-gray-100">
                          <div className="flex items-center justify-end gap-1">
                            Rate
                            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          </div>
                        </th>
                        <th className="px-3 py-2 w-32 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lineItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-sm text-gray-500">
                            No items added. Click "Add New Row" to start.
                          </td>
                        </tr>
                      )}
                      {lineItems.map((item, i) => {
                        const itemAmount = item.quantity * item.unitPrice;
                        return (
                          <tr key={i} className="bg-white hover:bg-gray-50/50 group transition-colors">
                            <td className="px-3 py-2 align-top border-r border-gray-100 relative">
                              <div className="flex gap-2 relative">
                                <div className="flex-1 space-y-1 pr-10">
                                  <select value={item.productId} onChange={e => updateLineItem(i, "productId", Number(e.target.value))}
                                    className="w-full text-[13px] font-medium text-gray-900 bg-transparent border-0 border-transparent focus:ring-0 p-1 -ml-1 cursor-pointer transition-colors appearance-none" required>
                                    <option value={0} className="text-gray-400 font-normal">Type or click to select an item.</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  {item.productId > 0 && (
                                    <input type="text" placeholder="Add a description to your item"
                                      className="w-full text-[11px] text-gray-500 bg-gray-50 border border-transparent hover:border-gray-200 focus:bg-white focus:border-blue-500 rounded p-1 transition-colors" />
                                  )}
                                </div>
                                <div className="opacity-0 group-hover:opacity-100 absolute right-0 top-1 flex items-center gap-1 transition-opacity">
                                  <button type="button" className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  </button>
                                  <button type="button" onClick={() => removeLineItem(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top text-right border-r border-gray-100">
                              <input type="number" value={item.quantity} onChange={e => updateLineItem(i, "quantity", Number(e.target.value))}
                                className="w-full text-right bg-transparent border-0 border-transparent focus:ring-0 p-1 text-[13px] font-medium text-gray-900" min="1" />
                              <span className="block text-[10px] text-gray-500 mt-0.5 mr-1">box</span>
                            </td>
                            <td className="px-3 py-2 align-top text-right border-r border-gray-100">
                              <input type="number" value={item.unitPrice} onChange={e => updateLineItem(i, "unitPrice", Number(e.target.value))}
                                className="w-full text-right bg-transparent border-0 border-transparent focus:ring-0 p-1 text-[13px] font-medium text-gray-900" min="0" step="0.01" />
                              <button type="button" className="text-[9px] text-blue-500 hover:text-blue-700 mt-0.5 mr-1 transition-colors">Recent Transactions</button>
                            </td>
                            <td className="px-3 py-2 align-top text-right bg-white">
                              <div className="font-semibold text-gray-900 text-[13px] p-1">{itemAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 mb-12">
                {/* Left side actions and notes */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex rounded-md shadow-sm">
                      <button type="button" onClick={addLineItem}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-l-md transition-colors">
                        <PlusCircleIcon className="w-3.5 h-3.5 text-blue-600" />
                        Add New Row
                      </button>
                      <button type="button"
                        className="inline-flex items-center px-1.5 py-1.5 text-[13px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-l-0 border-blue-100 rounded-r-md transition-colors">
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <button type="button" onClick={() => setIsBulkModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[13px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-md shadow-sm transition-colors">
                      <PlusCircleIcon className="w-3.5 h-3.5 text-blue-600" />
                      Add Items in Bulk
                    </button>
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Notes</label>
                    <textarea name="remarks" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                      rows={3} placeholder="Looking forward for your business."
                      className="w-full max-w-[400px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-[13px] resize-y transition-all" />
                  </div>
                </div>

                {/* Right side totals block */}
                <div className="w-full lg:w-[380px] bg-gray-50/60 rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="grid grid-cols-[110px_1fr_90px] gap-y-3.5 items-center">
                    {/* Row 1: Sub Total */}
                    <div className="text-[13px] font-bold text-gray-900">Sub Total</div>
                    <div></div>
                    <div className="text-[13px] font-bold text-gray-900 text-right">
                      {totals.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    {/* Row 2: Discount */}
                    <div className="text-[13px] text-slate-500">Discount</div>
                    <div>
                      <div className="inline-flex items-stretch h-[28px] shadow-sm rounded transition-shadow focus-within:ring-2 focus-within:ring-blue-100">
                        <input type="number" value={globalDiscount} onChange={(e) => setGlobalDiscount(Number(e.target.value))} className="w-[50px] px-1 text-center text-[13px] font-medium text-gray-900 border border-gray-200 border-r-0 rounded-l focus:outline-none focus:border-blue-500 bg-white transition-colors" />
                        <div className="flex items-center relative border border-gray-200 rounded-r bg-gray-50 hover:bg-gray-100 transition-colors z-10">
                          <select className="h-full py-0.5 pl-1.5 pr-5 text-[13px] font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer z-10 relative">
                            <option>%</option>
                            <option>$</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="text-[13px] text-slate-500 text-right">
                      -{((totals.totalAmount * globalDiscount) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>

                    {/* Row 3: TDS / TCS */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                        <input type="radio" name="taxType" className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500" defaultChecked />
                        <span className="font-semibold text-blue-600">TDS</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                        <input type="radio" name="taxType" className="w-3 h-3 text-gray-400 border-gray-300 focus:ring-blue-500" />
                        <span className="font-semibold">TCS</span>
                      </label>
                    </div>
                    <div>
                      <div className="relative inline-block w-[110px]">
                        <input type="text" className="w-full p-1 pl-1.5 pr-8 text-[12px] border border-gray-200 rounded bg-white focus:outline-none text-gray-700 cursor-pointer" defaultValue="Commission" readOnly />
                        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5 leading-tight">Brokerage 2%</div>
                    </div>
                    <div className="text-[13px] text-gray-500 text-right flex items-center justify-end gap-1">
                      -{((totals.totalAmount * 0.02)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>

                    {/* Row 4: Adjustment */}
                    <div>
                      <input type="text" className="w-[85px] p-1 px-1.5 text-[12px] text-gray-600 border border-dashed border-gray-300 rounded bg-transparent focus:outline-none focus:bg-white" defaultValue="Adjustment" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="number" value={globalAdjustment} onChange={(e) => setGlobalAdjustment(Number(e.target.value))} className="w-[50px] p-1 text-center text-[13px] font-medium text-gray-900 border border-gray-200 rounded bg-white focus:outline-none focus:border-blue-500" />
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="text-[13px] text-gray-500 text-right">
                      {globalAdjustment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-5 pt-4 border-t border-gray-200">
                    <span className="text-[15px] font-bold text-gray-900">Total ( $ )</span>
                    <span className="text-[15px] font-bold text-gray-900">
                      {(totals.totalAmount - (totals.totalAmount * globalDiscount / 100) - (totals.totalAmount * 0.02) + globalAdjustment).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions and Attachments */}
              <div className="flex flex-col lg:flex-row gap-8 mb-8 border-t border-gray-200 pt-8 mt-2">
                <div className="flex-1">
                  <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2">Terms & Conditions</label>
                  <textarea value={form.termsConditions} onChange={e => setForm(f => ({ ...f, termsConditions: e.target.value }))} rows={4} placeholder="Enter the terms and conditions of your business to be displayed in your transaction" className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-[13px] resize-y transition-all text-gray-700 shadow-sm"></textarea>
                </div>
                <div className="w-full lg:w-[380px]">
                  <label className="block text-[13px] font-bold text-slate-500 uppercase tracking-wider mb-2">Attach File(s) to Quote</label>
                  <div className="inline-flex rounded-lg shadow-sm mb-2">
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-l-lg hover:bg-gray-50 focus:outline-none transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Upload File
                    </button>
                    <button type="button" className="inline-flex items-center px-2.5 py-2 text-gray-500 bg-white border border-l-0 border-gray-200 rounded-r-lg hover:bg-gray-50 focus:outline-none transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <p className="text-[12px] text-gray-400 mt-1 mb-3">You can upload a maximum of 3 files, 10MB each</p>
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {uploadedFiles.map((file, i) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-[12px] text-gray-600 truncate">{file.name}</span>
                          </div>
                          <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Email Communications & Additional Fields */}
              <div className="flex flex-col gap-6 mb-8 mt-2">
                <div>
                  <h4 className="text-[13px] font-bold text-gray-800 mb-3">Email Communications</h4>
                  <div className="flex items-center gap-4">
                    <button type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-blue-600 bg-white border border-dashed border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                      <PlusCircleIcon className="w-4 h-4" />
                      Add New
                    </button>
                    <div className="flex items-center gap-2 text-[13px] text-gray-700 font-medium">
                      <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      No contact persons found.
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[13px] text-gray-500">
                    <span className="font-bold text-gray-700">Additional Fields:</span> Start adding custom fields for your quotes by going to <span className="italic">Settings ➔ Quotes</span>.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => { setIsOpen(false); resetForm(); }} disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                <button type="submit" disabled={loading}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {editingId ? "Updating..." : "Creating..."}
                    </span>
                  ) : (editingId ? "Update Quotation" : "Create Quotation")}
                </button>
              </div>
            </form>
          </div>

        {/* Bulk items modal */}
        {isBulkModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="w-[90vw] max-w-5xl h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Select Items in Bulk
                </h3>
                <button
                  onClick={() => { setIsBulkModalOpen(false); setBulkSelectedItems([]); setBulkSearchQuery(""); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 flex divide-x divide-gray-200 overflow-hidden min-h-0">
                {/* Left Pane: Search & Available Items */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
                  <div className="relative mb-5 shrink-0">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      placeholder="Type to search or scan the barcode of the item"
                      value={bulkSearchQuery}
                      onChange={(e) => setBulkSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-sm transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
                    {(() => {
                      const filtered = products.filter(p => p.name.toLowerCase().includes(bulkSearchQuery.toLowerCase()));
                      if (filtered.length === 0) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4">
                              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <p className="text-sm font-semibold text-slate-500">No results found. Try a different keyword.</p>
                          </div>
                        );
                      }
                      return filtered.map(product => {
                        const isSelected = bulkSelectedItems.some(item => item.product.id === product.id);
                        return (
                          <div
                            key={product.id}
                            onClick={() => handleToggleBulkItem(product)}
                            className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 select-none ${isSelected
                                ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20'
                                : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                                }`}>
                                {isSelected && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-xs font-bold text-slate-500">${product.price.toFixed(2)}</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${product.availableStock > 10
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : product.availableStock > 0
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-rose-50 text-rose-700'
                                    }`}>
                                    {product.availableStock} Box Available
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Right Pane: Selected Items list & adjustment */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0 bg-slate-50/40">
                  <div className="flex items-center justify-between shrink-0 mb-4 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Selected Items</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-extrabold rounded-full">
                        {bulkSelectedItems.length}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      Total Quantity: {bulkSelectedItems.reduce((acc, item) => acc + item.quantity, 0)}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 min-h-0">
                    {bulkSelectedItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-4 border border-dashed border-slate-200">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <p className="text-sm font-semibold text-slate-400">Click the item names from the left pane to select them</p>
                      </div>
                    ) : (
                      bulkSelectedItems.map(item => (
                        <div key={item.product.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow transition-shadow select-none">
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</p>
                            <p className="text-xs font-bold text-slate-400 mt-1">${(item.product.price * item.quantity).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Quantity adjuster */}
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-8">
                              <button
                                type="button"
                                onClick={() => handleUpdateBulkQty(item.product.id, -1)}
                                className="px-2.5 h-full hover:bg-slate-100 text-slate-500 font-bold transition-colors"
                              >
                                -
                              </button>
                              <span className="w-9 text-center text-sm font-semibold text-slate-700 bg-white border-x border-slate-200 h-full flex items-center justify-center">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateBulkQty(item.product.id, 1)}
                                className="px-2.5 h-full hover:bg-slate-100 text-slate-500 font-bold transition-colors"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleBulkItem(item.product)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-rose-50 transition-colors"
                              title="Remove"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={handleAddBulkItemsToQuote}
                  disabled={bulkSelectedItems.length === 0}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold text-[14px] shadow-sm transition-all duration-200 shrink-0"
                >
                  Add Items
                </button>
                <button
                  type="button"
                  onClick={() => { setIsBulkModalOpen(false); setBulkSelectedItems([]); setBulkSearchQuery(""); }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[14px] shadow-sm transition-colors shrink-0"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Sales Quotations" description="Manage your Sales Quotations" />
      <PageBreadcrumb pageTitle="Sales Quotations" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          <AddButton label="New Quotation" onClick={() => { resetForm(); setIsOpen(true); }} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Quotations" value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Draft" value={stats.draft} gradient="from-gray-50 to-slate-50" borderColor="border-gray-200" labelColor="text-gray-600" />
          <StatsCard label="Accepted" value={stats.accepted} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Rejected" value={stats.rejected} gradient="from-red-50 to-pink-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        {/* Table */}
        <ReusableTable<Quotation>
          data={quotations}
          columns={columns}
          loading={loading && !isOpen}
          onRowClick={(row) => handleViewQuotation(row.id)}
          searchable
          searchPlaceholder="Search by quote number, customer, or remarks..."
          pageSize={10}
          defaultSortKey="createdAt"
          defaultSortOrder="desc"
          toolbar={
            <select
              onChange={() => {/* filter handled via search */ }}
              className="px-4 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white min-w-[160px]"
              defaultValue=""
            >
              <option value="">All Statuses</option>
              {(["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as Status[]).map(s =>
                <option key={s} value={s}>{s}</option>
              )}
            </select>
          }
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <CurrencyDollarIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No quotations found</p>
              <button onClick={() => { resetForm(); setIsOpen(true); }} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Create your first quotation →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Quotation"
        subText="Are you sure you want to delete this quotation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />



      {/* View Details Modal */}
      {showDetailsModal && selectedQuotation && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl w-full max-w-4xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
              <h3 className="text-xl font-semibold text-gray-900">Quotation Details</h3>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-500 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h4 className="text-2xl font-bold text-gray-900">{selectedQuotation.quoteNumber || "DRAFT"}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    Created on {new Date(selectedQuotation.createdAt || "").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedQuotation.status].bg} ${statusColors[selectedQuotation.status].text}`}>
                  {statusColors[selectedQuotation.status].icon}{selectedQuotation.status}
                </span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h5 className="font-medium text-gray-700 mb-2">Customer Information</h5>
                <p className="text-gray-900">{selectedQuotation.customer?.name}</p>
                {selectedQuotation.customer?.email && <p className="text-sm text-gray-600 mt-1">{selectedQuotation.customer.email}</p>}
                {selectedQuotation.customer?.phone && <p className="text-sm text-gray-600">{selectedQuotation.customer.phone}</p>}
              </div>
              <div className="mb-6">
                <h5 className="font-medium text-gray-700 mb-3">Line Items</h5>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Product", "Qty", "Unit Price", "Discount", "Tax", "Total"].map(h => (
                          <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-500 ${h !== "Product" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedQuotation.items.map((item, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.product.name}</td>
                          <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-right">${item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-right">{item.discount}%</td>
                          <td className="px-4 py-2 text-sm text-right">{item.tax}%</td>
                          <td className="px-4 py-2 text-sm font-medium text-right">${item.totalPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Subtotal:</span><span className="font-medium">${selectedQuotation.totalAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Discount:</span><span className="font-medium text-red-600">-${selectedQuotation.discountAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Tax:</span><span className="font-medium">${selectedQuotation.taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-semibold border-t border-gray-300 pt-2 mt-2">
                  <span className="text-gray-900">Grand Total:</span>
                  <span className="text-cyan-600">${selectedQuotation.grandTotal.toFixed(2)}</span>
                </div>
              </div>
              {selectedQuotation.remarks && (
                <div className="mb-6">
                  <h5 className="font-medium text-gray-700 mb-2">Remarks</h5>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedQuotation.remarks}</p>
                </div>
              )}
              <div className="flex items-center text-sm text-gray-500">
                <CalendarIcon className="h-4 w-4 mr-2" />
                Valid until: {new Date(selectedQuotation.validUntil).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-3 rounded-b-xl flex justify-end gap-3">
              <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">Close</button>
              <button onClick={() => { setShowDetailsModal(false); openEditModal(selectedQuotation); }}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors">Edit Quotation</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk items modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="w-[90vw] max-w-5xl h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Select Items in Bulk
              </h3>
              <button
                onClick={() => { setIsBulkModalOpen(false); setBulkSelectedItems([]); setBulkSearchQuery(""); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex divide-x divide-gray-200 overflow-hidden min-h-0">
              {/* Left Pane: Search & Available Items */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
                <div className="relative mb-5 shrink-0">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Type to search or scan the barcode of the item"
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-sm transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-0">
                  {(() => {
                    const filtered = products.filter(p => p.name.toLowerCase().includes(bulkSearchQuery.toLowerCase()));
                    if (filtered.length === 0) {
                      return (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                          </div>
                          <p className="text-sm font-semibold text-slate-500">No results found. Try a different keyword.</p>
                        </div>
                      );
                    }
                    return filtered.map(product => {
                      const isSelected = bulkSelectedItems.some(item => item.product.id === product.id);
                      return (
                        <div
                          key={product.id}
                          onClick={() => handleToggleBulkItem(product)}
                          className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all duration-200 select-none ${isSelected
                              ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20'
                              : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                              }`}>
                              {isSelected && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs font-bold text-slate-500">${product.price.toFixed(2)}</span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${product.availableStock > 10
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : product.availableStock > 0
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}>
                                  {product.availableStock} Box Available
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Right Pane: Selected Items list & adjustment */}
              <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0 bg-slate-50/40">
                <div className="flex items-center justify-between shrink-0 mb-4 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">Selected Items</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-extrabold rounded-full">
                      {bulkSelectedItems.length}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    Total Quantity: {bulkSelectedItems.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 min-h-0">
                  {bulkSelectedItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 mb-4 border border-dashed border-slate-200">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-400">Click the item names from the left pane to select them</p>
                    </div>
                  ) : (
                    bulkSelectedItems.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow transition-shadow select-none">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.product.name}</p>
                          <p className="text-xs font-bold text-slate-400 mt-1">${(item.product.price * item.quantity).toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Quantity adjuster */}
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden h-8">
                            <button
                              type="button"
                              onClick={() => handleUpdateBulkQty(item.product.id, -1)}
                              className="px-2.5 h-full hover:bg-slate-100 text-slate-500 font-bold transition-colors"
                            >
                              -
                            </button>
                            <span className="w-9 text-center text-sm font-semibold text-slate-700 bg-white border-x border-slate-200 h-full flex items-center justify-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateBulkQty(item.product.id, 1)}
                              className="px-2.5 h-full hover:bg-slate-100 text-slate-500 font-bold transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleBulkItem(item.product)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-rose-50 transition-colors"
                            title="Remove"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleAddBulkItemsToQuote}
                disabled={bulkSelectedItems.length === 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold text-[14px] shadow-sm transition-all duration-200 shrink-0"
              >
                Add Items
              </button>
              <button
                type="button"
                onClick={() => { setIsBulkModalOpen(false); setBulkSelectedItems([]); setBulkSearchQuery(""); }}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[14px] shadow-sm transition-colors shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}