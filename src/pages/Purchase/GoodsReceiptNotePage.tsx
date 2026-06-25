import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ArchiveBoxIcon,
  CalendarIcon,
  DocumentTextIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { 
  FloatingDatePicker, 
  FloatingSelect1, 
  FloatingInput,
  FloatingTextarea 
} from "../../components/inputfeild/FloatingInput";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface PurchaseOrder { id: number; poNumber: string; }
interface GoodsReceipt {
  id?: number; purchaseOrderId: number | ""; receiptDate: string;
  receivedQuantity: number; remarks: string;
}

const GRN_API = "/v1/api/purchase/grns";
const PO_API  = "/v1/api/purchase/purchase-orders";

// ─────────────────────────────────────────────────────────────────────────────

const GoodsReceiptPage: React.FC = () => {
  const [grns, setGrns]                     = useState<GoodsReceipt[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]               = useState(false);
  const [showForm, setShowForm]             = useState(false);

  const emptyForm: GoodsReceipt = { purchaseOrderId: "", receiptDate: new Date().toISOString().split("T")[0], receivedQuantity: 1, remarks: "" };
  const [form, setForm] = useState<GoodsReceipt>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingGrn, setDeletingGrn]         = useState<GoodsReceipt | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [grnRes, poRes] = await Promise.all([
        axios.get<GoodsReceipt[]>(GRN_API),
        axios.get<PurchaseOrder[]>(PO_API),
      ]);
      setGrns(grnRes.data); setPurchaseOrders(poRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleChange = (key: keyof GoodsReceipt, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };
  const openCreatePopup = () => { setForm(emptyForm); setShowForm(true); };

  const handleEdit = (grn: GoodsReceipt) => {
    setForm({ ...grn, receiptDate: grn.receiptDate.split("T")[0] ?? grn.receiptDate });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { purchaseOrderId: Number(form.purchaseOrderId), receiptDate: form.receiptDate, receivedQuantity: Number(form.receivedQuantity), remarks: form.remarks };
    try {
      if (form.id) await axios.put(`${GRN_API}/${form.id}`, payload);
      else         await axios.post(GRN_API, payload);
      loadData(); resetForm();
    } catch (err) { console.error("Error saving GRN:", err); }
  };

  const promptDelete = (grn: GoodsReceipt) => { setDeletingGrn(grn); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingGrn?.id) return;
    try { await axios.delete(`${GRN_API}/${deletingGrn.id}`); loadData(); }
    catch (err) { console.error(err); }
    setDeletingGrn(null);
  };

  // helper to resolve PO number
  const getPoLabel = (poId: number | "") => {
    const po = purchaseOrders.find(p => p.id === poId);
    return po ? `PO-${po.poNumber}` : String(poId);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalQty = grns.reduce((s, g) => s + (g.receivedQuantity || 0), 0);
  const stats = {
    total:    grns.length,
    totalQty,
    avgQty:   grns.length > 0 ? Math.round(totalQty / grns.length) : 0,
    pos:      new Set(grns.map(g => g.purchaseOrderId).filter(Boolean)).size,
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<GoodsReceipt>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <HashtagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "purchaseOrderId", label: "Purchase Order", sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{getPoLabel(row.purchaseOrderId)}</span>
        </div>
      ),
    },
    {
      key: "receiptDate", label: "Receipt Date", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "receivedQuantity", label: "Quantity", sortable: true,
      render: (_, v) => (
        <span className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
          {String(v)}
        </span>
      ),
    },
    {
      key: "remarks", label: "Remarks",
      render: (_, v) => <span className="text-sm text-gray-500">{String(v) || "—"}</span>,
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

  // Convert purchase orders to format expected by FloatingSelect1
  const purchaseOrderOptions = purchaseOrders.map(po => ({
    id: po.id,
    name: `PO-${po.poNumber}`
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Goods Receipt Notes (GRN)" description="Goods Receipt Notes (GRN)" />
      <PageBreadcrumb pageTitle="Goods Receipt Notes (GRN)" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Goods Receipt Notes</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage goods receipt notes and track inventory</p>
          </div> */}
          <AddButton label="Create GRN" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total GRNs"    value={stats.total}    gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Total Qty"     value={stats.totalQty} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Avg Qty / GRN" value={stats.avgQty}   gradient="from-purple-50 to-pink-50"   borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label="Unique POs"    value={stats.pos}      gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
        </div>

        {/* GRN popup */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
              <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
              <div className="relative my-8 w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {form.id ? "Edit GRN" : "Create New GRN"}
                  </h3>
                  <button onClick={resetForm} className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    {/* Purchase Order Select with empty option */}
                    <FloatingSelect1 
                      label="Purchase Order" 
                      value={form.purchaseOrderId} 
                      options={purchaseOrderOptions} 
                      onChange={e => handleChange("purchaseOrderId", e.target.value === "" ? "" : Number(e.target.value))} 
                      required
                      emptyOptionLabel=""
                    />
                    
                    {/* Receipt Date Picker */}
                    <FloatingDatePicker 
                      label="Receipt Date" 
                      value={form.receiptDate} 
                      onChange={e => handleChange("receiptDate", e.target.value)} 
                      required 
                    />
                    
                    {/* Received Quantity - Using FloatingInput with type="number" */}
                    <FloatingInput 
                      label="Received Quantity" 
                      type="number" 
                      min={1} 
                      value={form.receivedQuantity} 
                      onChange={e => handleChange("receivedQuantity", Number(e.target.value))} 
                      required 
                    />
                  </div>
                  
                  {/* Remarks - Using FloatingTextarea */}
                  <div className="mb-4">
                    <FloatingTextarea 
                      label="Remarks" 
                      value={form.remarks} 
                      onChange={e => handleChange("remarks", e.target.value)} 
                      rows={3}
                      placeholder="Add any notes or comments about this receipt..."
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={resetForm}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit"
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                      {form.id ? "Update GRN" : "Create GRN"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<GoodsReceipt>
          data={grns}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by PO number, remarks, or date..."
          searchFields={["remarks", "receiptDate"]}
          pageSize={5}
          defaultSortKey="receiptDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ArchiveBoxIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No GRN records found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Create your first GRN →
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
        innerText="Delete GRN"
        subText="Are you sure you want to delete this goods receipt note? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default GoodsReceiptPage;