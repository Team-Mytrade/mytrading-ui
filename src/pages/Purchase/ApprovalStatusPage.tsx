import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  UserIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { 
  FloatingInput, 
  FloatingDatePicker, 
  FloatingSelect1 
} from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

/* ── Types ───────────────────────────────────────────────────────────────────*/
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

interface Approval {
  id?: number; status: ApprovalStatus; approvedBy: string;
  approvalDate: string; purchaseOrderId?: number; poNumber?: string;
}

interface PurchaseOrder { id: number; poNumber?: string; }

/* ── Status config — OUTSIDE component ──────────────────────────────────────*/
const getStatusStyle = (status: string) => {
  switch (status?.toUpperCase()) {
    case "APPROVED": return { cls: "bg-green-100 text-green-800", Icon: CheckCircleIcon };
    case "REJECTED": return { cls: "bg-red-100 text-red-800",   Icon: XCircleIcon };
    default:         return { cls: "bg-yellow-100 text-yellow-800", Icon: ClockIcon };
  }
};

const API_URL = "/v1/api/purchase/approval-status";
const PO_API  = "/v1/api/purchase/purchase-orders";

// ─────────────────────────────────────────────────────────────────────────────

const ApprovalPage: React.FC = () => {
  const [approvals, setApprovals]           = useState<Approval[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading]               = useState(false);
  const [showForm, setShowForm]             = useState(false);

  const emptyForm: Approval = { status: "PENDING", approvedBy: "", approvalDate: "", purchaseOrderId: undefined };
  const [form, setForm] = useState<Approval>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup]   = useState(false);
  const [deletingApproval, setDeletingApproval] = useState<Approval | null>(null);

  useEffect(() => { fetchApprovals(); fetchPurchaseOrders(); }, []);

  const fetchApprovals = async () => {
    setLoading(true);
    try { const res = await axios.get<Approval[]>(API_URL); setApprovals(res.data); }
    catch { console.error("Failed to fetch approvals"); }
    finally { setLoading(false); }
  };

  const fetchPurchaseOrders = async () => {
    try { const res = await axios.get<PurchaseOrder[]>(PO_API); setPurchaseOrders(res.data); }
    catch { console.error("Failed to fetch purchase orders"); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleChange = (key: keyof Approval, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };
  const openCreatePopup = () => { setForm(emptyForm); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, purchaseOrder: form.purchaseOrderId ? { id: form.purchaseOrderId } : null };
      if (form.id) await axios.put(`${API_URL}/${form.id}/${form.status}`);
      else         await axios.post(API_URL, payload);
      fetchApprovals(); resetForm();
    } catch (err) { console.error("Failed to save approval:", err); }
  };

  const handleEdit = (a: Approval) => {
    setForm({ id: a.purchaseOrderId, status: a.status, approvedBy: a.approvedBy, approvalDate: a.approvalDate, purchaseOrderId: a.purchaseOrderId });
    setShowForm(true);
  };

  const promptDelete = (a: Approval) => { setDeletingApproval(a); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingApproval?.id) return;
    try { await axios.delete(`${API_URL}/${deletingApproval.id}`); fetchApprovals(); }
    catch { console.error("Delete failed"); }
    setDeletingApproval(null);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:    approvals.length,
    pending:  approvals.filter(a => a.status === "PENDING").length,
    approved: approvals.filter(a => a.status === "APPROVED").length,
    rejected: approvals.filter(a => a.status === "REJECTED").length,
  };

  // Convert purchase orders to format expected by FloatingSelect1
  const purchaseOrderOptions = purchaseOrders.map(po => ({
    id: po.id,
    name: po.poNumber || `PO-${po.id}`
  }));

  // Status options for FloatingSelect1
  const statusOptions = [
    { id: "PENDING", name: "PENDING" },
    { id: "APPROVED", name: "APPROVED" },
    { id: "REJECTED", name: "REJECTED" }
  ];

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Approval>[] = [
    {
      key: "poNumber", label: "Purchase Order", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (row) => {
        const { cls, Icon } = getStatusStyle(row.status);
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            <Icon className="h-3 w-3 mr-1" />{row.status}
          </span>
        );
      },
    },
    {
      key: "approvedBy", label: "Approved By", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{String(v) || "—"}</span>
        </div>
      ),
    },
    {
      key: "approvalDate", label: "Approval Date", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">
            {v ? new Date(String(v)).toLocaleString() : "—"}
          </span>
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
      <PageMeta title="Approvals" description="Manage Purchase Order Approvals" />
      <PageBreadcrumb pageTitle="Approvals" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage purchase order approval statuses</p>
          </div> */}
          <AddButton label="Add Approval" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total"    value={stats.total}    gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Pending"  value={stats.pending}  gradient="from-yellow-50 to-orange-50" borderColor="border-yellow-100" labelColor="text-yellow-600" />
          <StatsCard label="Approved" value={stats.approved} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Rejected" value={stats.rejected} gradient="from-red-50 to-pink-50"      borderColor="border-red-100"    labelColor="text-red-600" />
        </div>

        {/* Approval popup */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
              <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
              <div className="relative my-8 w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {form.id ? "Update Approval" : "Add Approval"}
                  </h3>
                  <button onClick={resetForm} className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Purchase Order Select */}
                    <FloatingSelect1 
                      label="Purchase Order" 
                      value={form.purchaseOrderId?.toString() || ""} 
                      options={purchaseOrderOptions} 
                      onChange={e => handleChange("purchaseOrderId", e.target.value === "" ? "" : Number(e.target.value))} 
                      required
                      emptyOptionLabel=""
                    />
                    
                    {/* Status Select */}
                    <FloatingSelect1 
                      label="Status" 
                      value={form.status} 
                      options={statusOptions} 
                      onChange={e => handleChange("status", e.target.value as ApprovalStatus)} 
                      required
                      emptyOptionLabel=""
                    />
                    
                    {/* Approved By Input */}
                    <FloatingInput 
                      label="Approved By" 
                      name="approvedBy" 
                      type="text" 
                      value={form.approvedBy}
                      onChange={e => handleChange("approvedBy", e.target.value)} 
                      required 
                    />
                    
                    {/* Approval Date Picker */}
                    <FloatingDatePicker 
                      label="Approval Date" 
                      name="approvalDate" 
                      value={form.approvalDate}
                      onChange={e => handleChange("approvalDate", e.target.value)} 
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
                      {form.id ? "Update Approval" : "Save Approval"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Approval>
          data={approvals}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by PO number, approver, or status..."
          searchFields={["poNumber", "approvedBy", "status"]}
          pageSize={5}
          defaultSortKey="approvalDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircleIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No approvals found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first approval →
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
        innerText="Delete Approval"
        subText="Are you sure you want to delete this approval record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default ApprovalPage;
