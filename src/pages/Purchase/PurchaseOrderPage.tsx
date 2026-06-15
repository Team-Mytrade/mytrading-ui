import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import {
  FloatingDatePicker,
  FloatingInput,
  FloatingSelect1,
} from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

/* ── Interfaces ──────────────────────────────────────────────────────────────*/
interface Vendor       { id: number; name: string; }
interface Terms        { id: number; title: string; }
interface Requisition  { id: number; notes: string; }
interface Category     { id: number; name: string; }
interface Product      { id: number; name: string; categoryId: number; }

interface LineItemUI {
  categoryId: number | ""; productId: number | ""; quantity: number;
  unitPrice: number; remarks: string; totalPrice: number;
}

interface PurchaseOrder {
  poNumber: string; id?: number; orderDate: string; expectedDeliveryDate: string;
  status: string; approvalStatus: string; vendor?: Vendor;
  requisition?: Requisition; termsAndConditions?: Terms;
  items: LineItemUI[]; totalAmount: number;
}

/* ── Status style — OUTSIDE component ───────────────────────────────────────*/
const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    case "APPROVED": return "bg-green-100 text-green-800";
    case "REJECTED": return "bg-red-100 text-red-800";
    case "PENDING":  return "bg-yellow-100 text-yellow-800";
    case "DRAFT":    return "bg-gray-100 text-gray-800";
    default:         return "bg-blue-100 text-blue-800";
  }
};

const API_BASE = "/v1/api/purchase/purchase-orders";

/* ─────────────────────────────────────────────────────────────────────────── */

const PurchaseOrderPage: React.FC = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors]         = useState<Vendor[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [terms, setTerms]             = useState<Terms[]>([]);
  const [showForm, setShowForm]       = useState(false);
  const [loading, setLoading]         = useState(true);

  const emptyForm: PurchaseOrder = { poNumber: "", orderDate: "", expectedDeliveryDate: "", status: "DRAFT", approvalStatus: "PENDING", items: [], totalAmount: 0 };
  const [form, setForm] = useState<PurchaseOrder>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingPO, setDeletingPO]           = useState<PurchaseOrder | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, r, c, p, t, po] = await Promise.all([
        axios.get<Vendor[]>("/v1/api/purchase/vendors"),
        axios.get<Requisition[]>("/v1/api/purchase/purchase-requisitions"),
        axios.get<Category[]>("/v1/api/purchase/categories"),
        axios.get<Product[]>("/v1/api/purchase/products"),
        axios.get<Terms[]>("/v1/api/purchase/terms"),
        axios.get<PurchaseOrder[]>(API_BASE),
      ]);
      setVendors(v.data); setRequisitions(r.data); setCategories(c.data);
      setProducts(p.data); setTerms(t.data); setPurchaseOrders(po.data);
    } catch (e) { console.error("Error loading data:", e); }
    finally { setLoading(false); }
  };

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleChange = (key: keyof PurchaseOrder, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { categoryId: "", productId: "", quantity: 1, unitPrice: 0, remarks: "", totalPrice: 0 }] }));

  const updateItem = (index: number, field: keyof LineItemUI, value: any) => {
    const updated = [...form.items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "categoryId") updated[index].productId = "";
    updated[index].totalPrice = Number(updated[index].quantity) * Number(updated[index].unitPrice);
    const total = updated.reduce((s, i) => s + i.totalPrice, 0);
    setForm(prev => ({ ...prev, items: updated, totalAmount: total }));
  };

  const removeItem = (index: number) => {
    const updated = form.items.filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, items: updated, totalAmount: updated.reduce((s, i) => s + i.totalPrice, 0) }));
  };

  const getProductsByCategory = (catId: number | "") => products.filter(p => p.categoryId === catId);

  const handleEdit = (po: PurchaseOrder) => {
    setForm({ ...po, items: po.items.map((i: any) => ({ categoryId: i.category?.id || "", productId: i.product?.id || "", quantity: i.quantity, unitPrice: i.unitPrice, remarks: i.remarks, totalPrice: i.quantity * i.unitPrice })) });
    setShowForm(true);
  };

  const openCreatePopup = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, vendor: form.vendor ? { id: form.vendor.id } : undefined, requisition: form.requisition ? { id: form.requisition.id } : undefined, termsAndConditions: form.termsAndConditions ? { id: form.termsAndConditions.id } : undefined, items: form.items.map(i => ({ category: { id: Number(i.categoryId) }, product: { id: Number(i.productId) }, quantity: i.quantity, unitPrice: i.unitPrice, remarks: i.remarks })) };
    try {
      if (form.id) await axios.put(`${API_BASE}/${form.id}`, payload);
      else         await axios.post(API_BASE, payload);
      await loadData(); resetForm();
    } catch (e) { console.error("Error saving:", e); }
  };

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  const promptDelete = (po: PurchaseOrder) => { setDeletingPO(po); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingPO?.id) return;
    try { await axios.delete(`${API_BASE}/${deletingPO.id}`); loadData(); }
    catch (e) { console.error("Error deleting:", e); }
    setDeletingPO(null);
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total:    purchaseOrders.length,
    draft:    purchaseOrders.filter(p => p.approvalStatus === "DRAFT" || p.approvalStatus === "PENDING").length,
    approved: purchaseOrders.filter(p => p.approvalStatus === "APPROVED").length,
    total$:   purchaseOrders.reduce((s, p) => s + (p.totalAmount || 0), 0),
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      key: "poNumber", label: "PO Number", sortable: true,
      render: (_, v) => <span className="text-sm font-medium text-gray-900 truncate max-w-[120px] block">{String(v)}</span>,
    },
    {
      key: "vendor", label: "Vendor", sortable: false,
      render: (row) => <span className="text-sm text-gray-700">{row.vendor?.name || "—"}</span>,
    },
    {
      key: "orderDate", label: "Order Date", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v)}</span>,
    },
    {
      key: "totalAmount", label: "Total", sortable: true,
      render: (_, v) => <span className="text-sm font-medium text-gray-900">${Number(v).toFixed(2)}</span>,
    },
    {
      key: "approvalStatus", label: "Status", sortable: true,
      render: (_, v) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(String(v))}`}>
          {String(v)}
        </span>
      ),
    },
    {
      key: "expectedDeliveryDate", label: "Expected", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v) || "—"}</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8", className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => handleEdit(row)} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(row)} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Purchase Orders" description="Manage your purchase orders" />
      <PageBreadcrumb pageTitle="Purchase Orders" />

      <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage purchase orders</p>
          </div> */}
          <AddButton label="Create Purchase Order" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Orders"  value={stats.total}                  gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Pending/Draft" value={stats.draft}                  gradient="from-yellow-50 to-orange-50" borderColor="border-yellow-100" labelColor="text-yellow-600" />
          <StatsCard label="Approved"      value={stats.approved}               gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Total Value"   value={`$${stats.total$.toFixed(2)}`} gradient="from-purple-50 to-pink-50"   borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        {/* Table */}
        <ReusableTable<PurchaseOrder>
          data={purchaseOrders}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by PO number, vendor, or status..."
          searchFields={["poNumber", "approvalStatus"]}
          pageSize={10}
          defaultSortKey="orderDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No purchase orders found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Create your first purchase order →
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
        innerText="Delete Purchase Order"
        subText={`Are you sure you want to delete PO "${deletingPO?.poNumber}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
            <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
            <div className="relative w-full max-w-3xl xl:max-w-4xl bg-white rounded-xl shadow-2xl my-8">
              <div className="flex items-center justify-between px-4 py-4 sm:px-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {form.id ? "Edit Purchase Order" : "Create Purchase Order"}
                </h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-6 max-h-[80vh] overflow-y-auto">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  <FloatingDatePicker label="Order Date"             value={form.orderDate}            onChange={e => handleChange("orderDate", e.target.value)}            required />
                  <FloatingDatePicker label="Expected Delivery Date" value={form.expectedDeliveryDate} onChange={e => handleChange("expectedDeliveryDate", e.target.value)} required />
                  <FloatingSelect1 label="Vendor"               value={form.vendor?.id || ""}                   onChange={e => handleChange("vendor", vendors.find(v => v.id === Number(e.target.value)))}           options={vendors} emptyOptionLabel="" />
                  <FloatingSelect1 label="Requisition"          value={form.requisition?.id || ""}              onChange={e => handleChange("requisition", requisitions.find(r => r.id === Number(e.target.value)))} options={requisitions.map(r => ({ id: r.id, name: r.notes }))} emptyOptionLabel="" />
                  <FloatingSelect1 label="Terms & Conditions"   value={form.termsAndConditions?.id || ""}       onChange={e => handleChange("termsAndConditions", terms.find(t => t.id === Number(e.target.value)))} options={terms.map(t => ({ id: t.id, name: t.title }))} emptyOptionLabel="" />
                </div>

                {/* Line Items */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">Line Items</h4>
                    <button type="button" onClick={addItem}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                      <PlusIcon className="h-4 w-4" />Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-700 text-sm">Item #{idx + 1}</span>
                          <button type="button" onClick={() => removeItem(idx)}
                            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors">
                            <TrashIcon className="h-3.5 w-3.5" />Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
                          <FloatingSelect1 
                            label="Category" 
                            value={item.categoryId} 
                            options={categories} 
                            onChange={e => updateItem(idx, "categoryId", e.target.value === "" ? "" : Number(e.target.value))} 
                            emptyOptionLabel=""
                          />
                          <FloatingSelect1 
                            label="Product"  
                            value={item.productId}  
                            options={getProductsByCategory(item.categoryId)} 
                            onChange={e => updateItem(idx, "productId", e.target.value === "" ? "" : Number(e.target.value))} 
                            disabled={!item.categoryId}
                            emptyOptionLabel=""
                          />
                          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-3 min-w-0">
                            <FloatingInput label="Qty"        type="number" value={item.quantity}   onChange={e => updateItem(idx, "quantity",   Number(e.target.value))} min={1} required />
                            <FloatingInput label="Unit Price" type="number" value={item.unitPrice}  onChange={e => updateItem(idx, "unitPrice",  Number(e.target.value))} min={0} required />
                          </div>
                          <FloatingInput label="Total Price" type="number" value={item.totalPrice} disabled />
                        </div>
                        <div className="mt-2">
                          <FloatingInput label="Remarks" value={item.remarks} onChange={e => updateItem(idx, "remarks", e.target.value)} />
                        </div>
                      </div>
                    ))}
                    {form.items.length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="text-gray-500 text-sm">No items added yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Add Item" to start adding line items</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-end mb-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-lg font-semibold text-gray-800">
                      Total Amount: ${form.totalAmount.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Calculated automatically based on line items</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={resetForm}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit"
                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                    {form.id ? "Update" : "Create"} Purchase Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PurchaseOrderPage;
