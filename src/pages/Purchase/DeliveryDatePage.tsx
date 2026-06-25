import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  TruckIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { 
  FloatingDatePicker, 
  FloatingSelect1 
} from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

/* ── Types ───────────────────────────────────────────────────────────────────*/
interface Vendor        { id: number; name: string; }
interface PurchaseOrder { id: number; poNumber: string; }
interface Delivery {
  id?: number; deliveryDate: string; vendorId: number | "";
  purchaseOrderId: number | ""; vendor: any; purchaseOrder: any;
}

/* ── APIs ────────────────────────────────────────────────────────────────────*/
const API_URL    = "/v1/api/purchase/deliveries";
const VENDOR_API = "/v1/api/purchase/vendors";
const PO_API     = "/v1/api/purchase/purchase-orders";

// ─────────────────────────────────────────────────────────────────────────────

const DeliveryPage: React.FC = () => {
  const [deliveries, setDeliveries]         = useState<Delivery[]>([]);
  const [vendors, setVendors]               = useState<Vendor[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]               = useState(false);
  const [showForm, setShowForm]             = useState(false);

  const emptyForm: Delivery = { deliveryDate: "", vendorId: "", purchaseOrderId: "", vendor: "", purchaseOrder: "" };
  const [form, setForm] = useState<Delivery>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingDelivery, setDeletingDelivery] = useState<Delivery | null>(null);

  useEffect(() => {
    fetchDeliveries(); fetchVendors(); fetchPurchaseOrders();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try { const res = await axios.get(API_URL); setDeliveries(res.data); }
    catch { console.error("Failed to load deliveries"); }
    finally { setLoading(false); }
  };

  const fetchVendors = async () => {
    try { const res = await axios.get(VENDOR_API); setVendors(res.data); }
    catch { console.error("Failed to load vendors"); }
  };

  const fetchPurchaseOrders = async () => {
    try { const res = await axios.get(PO_API); setPurchaseOrders(res.data); }
    catch { console.error("Failed to load purchase orders"); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleChange = (key: keyof Delivery, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };
  const openCreatePopup = () => { setForm(emptyForm); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { deliveryDate: form.deliveryDate, vendor: form.vendorId ? { id: form.vendorId } : null, purchaseOrder: form.purchaseOrderId ? { id: form.purchaseOrderId } : null };
    try {
      if (form.id) await axios.put(`${API_URL}/${form.id}`, payload);
      else         await axios.post(API_URL, payload);
      fetchDeliveries(); resetForm();
    } catch { console.error("Save failed"); }
  };

  const handleEdit = (d: any) => {
    setForm({ id: d.id, deliveryDate: d.deliveryDate, vendorId: d.vendor?.id || "", purchaseOrderId: d.purchaseOrder?.id || "", vendor: d.vendor, purchaseOrder: d.purchaseOrder });
    setShowForm(true);
  };

  const promptDelete = (d: Delivery) => { setDeletingDelivery(d); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingDelivery?.id) return;
    try { await axios.delete(`${API_URL}/${deletingDelivery.id}`); fetchDeliveries(); }
    catch { console.error("Delete failed"); }
    setDeletingDelivery(null);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const today     = new Date().toISOString().split("T")[0];
  const thisMonth = new Date().toISOString().slice(0, 7);
  const stats = {
    total:      deliveries.length,
    today:      deliveries.filter(d => d.deliveryDate === today).length,
    thisMonth:  deliveries.filter(d => d.deliveryDate?.startsWith(thisMonth)).length,
    vendors:    new Set(deliveries.map(d => d.vendor?.id).filter(Boolean)).size,
  };

  // Convert vendors to format expected by FloatingSelect1
  const vendorOptions = vendors.map(v => ({
    id: v.id,
    name: v.name
  }));

  // Convert purchase orders to format expected by FloatingSelect1
  const purchaseOrderOptions = purchaseOrders.map(po => ({
    id: po.id,
    name: po.poNumber
  }));

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Delivery>[] = [
    {
      key: "deliveryDate", label: "Delivery Date", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "vendor", label: "Vendor",
      render: (row) => (
        <div className="flex items-center gap-2">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{row.vendor?.name || "—"}</span>
        </div>
      ),
    },
    {
      key: "purchaseOrder", label: "Purchase Order",
      render: (row) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-900">{row.purchaseOrder?.poNumber || "—"}</span>
        </div>
      ),
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Delivery" description="Delivery Management" />
      <PageBreadcrumb pageTitle="Delivery" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Delivery Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage delivery records and track shipments</p>
          </div> */}
          <AddButton label="Add Delivery" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Deliveries" value={stats.total}     gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Today"             value={stats.today}    gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="This Month"        value={stats.thisMonth} gradient="from-purple-50 to-pink-50"  borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label="Unique Vendors"    value={stats.vendors}  gradient="from-orange-50 to-yellow-50" borderColor="border-orange-100" labelColor="text-orange-600" />
        </div>

        {/* Delivery popup */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
              <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
              <div className="relative my-8 w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {form.id ? "Edit Delivery" : "Add New Delivery"}
                  </h3>
                  <button onClick={resetForm} className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    {/* Vendor Select */}
                    <FloatingSelect1 
                      label="Vendor" 
                      value={form.vendorId} 
                      options={vendorOptions} 
                      onChange={e => handleChange("vendorId", e.target.value === "" ? "" : Number(e.target.value))} 
                      required
                      emptyOptionLabel=""
                    />
                    
                    {/* Purchase Order Select */}
                    <FloatingSelect1 
                      label="Purchase Order" 
                      value={form.purchaseOrderId} 
                      options={purchaseOrderOptions} 
                      onChange={e => handleChange("purchaseOrderId", e.target.value === "" ? "" : Number(e.target.value))} 
                      required
                      emptyOptionLabel=""
                    />
                    
                    {/* Delivery Date Picker */}
                    <FloatingDatePicker 
                      label="Delivery Date" 
                      value={form.deliveryDate} 
                      onChange={e => handleChange("deliveryDate", e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={resetForm}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit"
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                      {form.id ? "Update Delivery" : "Add Delivery"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Delivery>
          data={deliveries}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by delivery date..."
          searchFields={["deliveryDate"]}
          pageSize={5}
          defaultSortKey="deliveryDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <TruckIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No delivery records found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first delivery →
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
        innerText="Delete Delivery"
        subText={`Are you sure you want to delete this delivery record? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default DeliveryPage;
