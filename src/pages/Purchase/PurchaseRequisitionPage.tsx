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
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import {
  FloatingDatePicker,
  FloatingInput as SharedFloatingInput,
  FloatingSelect1,
} from "../../components/inputfeild/FloatingInput";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Option       { id: number | string; name: string; }
interface Requester    { userId: string; fullName: string; }
interface Product      { id: number; name: string; categoryId: number; }
interface ItemUI       { categoryId: number | ""; productId: number | ""; quantity: number; unitOfMeasure: string; remarks: string; }
interface RequisitionUI { id?: number; notes: string; requiredByDate: string; status: string; departmentId: number | ""; requesterId: string | ""; items: ItemUI[]; }

type UserResponse =
  | Requester[]
  | { data?: Requester[]; content?: Requester[] };

// ── FloatingInput — OUTSIDE component ────────────────────────────────────────
interface FloatingInputProps {
  type: "text" | "date" | "number" | "select";
  label: string; value: any; onChange: (e: any) => void;
  required?: boolean; min?: number; disabled?: boolean; options?: Option[];
}

const FloatingInput: React.FC<FloatingInputProps> = ({ type, label, value, onChange, required, min, disabled, options = [] }) => {
  const hasValue = value !== "" && value !== null && value !== undefined;

  return (
    <div className="mb-4">
      {type === "select" ? (
        <div className="relative">
          <select
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className="peer h-[52px] w-full rounded-lg border border-gray-300 bg-white px-3 pb-1 pt-5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <option value="">Select {label}</option>
            {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
          </select>
          <label
            className={[
              "pointer-events-none absolute left-3 z-10 bg-white px-1 transition-all",
              hasValue
                ? "top-0 -translate-y-1/2 text-xs font-medium text-cyan-600"
                : "top-1/2 -translate-y-1/2 text-sm text-gray-500",
            ].join(" ")}
          >
            {label}{required && <span className="ml-1 text-red-500">*</span>}
          </label>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input type={type} value={value} onChange={onChange} required={required} min={min} disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-100 disabled:cursor-not-allowed" />
        </>
      )}
    </div>
  );
};

// ── Status style — OUTSIDE component ─────────────────────────────────────────
const getStatusStyle = (status: string) => {
  switch (status) {
    case "APPROVED": return "bg-green-100 text-green-800";
    case "REJECTED": return "bg-red-100 text-red-800";
    default:         return "bg-yellow-100 text-yellow-800";
  }
};

// ── API URLs ──────────────────────────────────────────────────────────────────
const API            = "/v1/api/purchase/purchase-requisitions";
const CATEGORY_API   = "/v1/api/purchase/categories";
const PRODUCT_API    = "/v1/api/purchase/products";
const DEPARTMENT_API = "/v1/api/purchase/department";
const USER_API       = "/v1/api/user/getAll";

// ─────────────────────────────────────────────────────────────────────────────

const PurchaseRequisitionPage: React.FC = () => {
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [departments, setDepartments]   = useState<Option[]>([]);
  const [requesters, setRequesters]     = useState<Option[]>([]);
  const [categories, setCategories]     = useState<Option[]>([]);
  const [products, setProducts]         = useState<Product[]>([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [showForm, setShowForm]         = useState(false);

  const emptyForm: RequisitionUI = { notes: "", requiredByDate: new Date().toISOString().split("T")[0], status: "DRAFT", departmentId: "", requesterId: "", items: [] };
  const [form, setForm] = useState<RequisitionUI>(emptyForm);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingReq, setDeletingReq]         = useState<any | null>(null);

  useEffect(() => {
    fetchMasterData();
    loadRequisitions();
  }, []);

  const fetchMasterData = async () => {
    try {
      const [deptRes, userRes, catRes, prodRes] = await Promise.all([
        axios.get(DEPARTMENT_API), axios.get(USER_API),
        axios.get(CATEGORY_API),  axios.get(PRODUCT_API),
      ]);
      const rawUsers = userRes.data as UserResponse;
      const users = Array.isArray(rawUsers)
        ? rawUsers
        : Array.isArray(rawUsers?.data)
          ? rawUsers.data
          : Array.isArray(rawUsers?.content)
            ? rawUsers.content
            : [];

      setDepartments(deptRes.data);
      setRequesters(
        users
          .map((u) => ({
            id: u.userId || "",
            name: u.fullName?.trim() || u.userId,
          }))
          .filter((u) => u.id && u.name)
      );
      setCategories(catRes.data);
      setProducts(prodRes.data);
    } catch (err) { console.error("Error loading master data:", err); }
  };

  const loadRequisitions = async () => {
    setLoading(true);
    try { const res = await axios.get(API); setRequisitions(res.data); }
    catch (err) { console.error("Error loading requisitions:", err); }
    finally { setLoading(false); }
  };

  // ── Form helpers ─────────────────────────────────────────────────────────
  const addItem = () => setForm({ ...form, items: [...form.items, { categoryId: "", productId: "", quantity: 1, unitOfMeasure: "PCS", remarks: "" }] });
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const getProducts = (catId: number | "") => products.filter(p => p.categoryId === catId);
  const updateItem = (index: number, field: keyof ItemUI, value: any) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    if (field === "categoryId") items[index].productId = "";
    setForm({ ...form, items });
  };

  const parseNumberSelectValue = (value: string): number | "" =>
    value === "" ? "" : Number(value);

  const validateForm = () => {
    if (!form.notes.trim()) {
      ToasterService.error("Notes are required");
      return false;
    }
    if (!form.requiredByDate) {
      ToasterService.error("Required by date is required");
      return false;
    }
    if (form.departmentId === "") {
      ToasterService.error("Please select a department");
      return false;
    }
    if (!form.requesterId) {
      ToasterService.error("Please select a requester");
      return false;
    }
    if (form.items.length === 0) {
      ToasterService.error("Please add at least one item");
      return false;
    }

    for (const [index, item] of form.items.entries()) {
      if (item.categoryId === "") {
        ToasterService.error(`Please select a category for item ${index + 1}`);
        return false;
      }
      if (item.productId === "") {
        ToasterService.error(`Please select a product for item ${index + 1}`);
        return false;
      }
      if (!item.quantity || item.quantity < 1) {
        ToasterService.error(`Quantity must be at least 1 for item ${index + 1}`);
        return false;
      }
      if (!item.unitOfMeasure.trim()) {
        ToasterService.error(`Unit of measure is required for item ${index + 1}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      notes: form.notes, requiredByDate: form.requiredByDate, status: form.status,
      department: { id: form.departmentId }, requester: { userId: form.requesterId },
      items: form.items.map(i => ({ category: { id: i.categoryId }, product: { id: i.productId }, quantity: i.quantity, unitOfMeasure: i.unitOfMeasure, remarks: i.remarks })),
    };

    try {
      setSaving(true);
      if (form.id) { await axios.put(`${API}/${form.id}`, payload); }
      else          { await axios.post(API, payload); }
      ToasterService.success(form.id ? "Requisition updated successfully" : "Requisition created successfully");
      resetForm();
      loadRequisitions();
    } catch (err: any) {
      console.error("Error saving:", err);
      ToasterService.error(err.response?.data?.message || "Failed to save requisition");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (req: any) => {
    setForm({
      id: req.id, notes: req.notes, requiredByDate: req.requiredByDate, status: req.status,
      departmentId: req.department.id, requesterId: req.requester.userId,
      items: req.items.map((i: any) => ({ categoryId: i.category.id, productId: i.product.id, quantity: i.quantity, unitOfMeasure: i.unitOfMeasure, remarks: i.remarks })),
    });
    setShowForm(true);
  };

  const promptDelete = (req: any) => { setDeletingReq(req); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingReq) return;
    try { await axios.delete(`${API}/${deletingReq.id}`); loadRequisitions(); }
    catch (err) { console.error("Error deleting:", err); }
    setDeletingReq(null);
  };

  const resetForm = () => { setForm(emptyForm); setShowForm(false); };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total:    requisitions.length,
    draft:    requisitions.filter(r => r.status === "DRAFT").length,
    approved: requisitions.filter(r => r.status === "APPROVED").length,
    rejected: requisitions.filter(r => r.status === "REJECTED").length,
  };

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnDef<any>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (_, v) => <span className="text-sm font-medium text-gray-900">#{String(v)}</span>,
    },
    {
      key: "notes", label: "Notes", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700 truncate max-w-xs block">{String(v) || "—"}</span>,
    },
    {
      key: "requiredByDate", label: "Required Date", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v)}</span>,
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (_, v) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(String(v))}`}>
          {String(v)}
        </span>
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Purchase Requisition" description="Manage purchase requisitions" />
      <PageBreadcrumb pageTitle="Purchase Requisition" />

      <div className="w-full max-w-none px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Requisitions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and track purchase requisitions</p>
          </div> */}
          <AddButton label="Add New Requisition" onClick={() => setShowForm(true)} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total"    value={stats.total}    gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Draft"    value={stats.draft}    gradient="from-yellow-50 to-orange-50" borderColor="border-yellow-100" labelColor="text-yellow-600" />
          <StatsCard label="Approved" value={stats.approved} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Rejected" value={stats.rejected} gradient="from-red-50 to-pink-50"      borderColor="border-red-100"    labelColor="text-red-600" />
        </div>

        {/* Table */}
        <ReusableTable
          data={requisitions}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by notes or status..."
          searchFields={["notes", "status"]}
          pageSize={10}
          defaultSortKey="id"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No requisitions found</p>
              <button onClick={() => setShowForm(true)} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first requisition →
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
        innerText="Delete Requisition"
        subText={`Are you sure you want to delete requisition #${deletingReq?.id}? This action cannot be undone.`}
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
            <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {form.id ? "Edit Requisition" : "Create New Requisition"}
                </h3>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-4">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <SharedFloatingInput label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} required />
                  <FloatingDatePicker label="Required By Date" value={form.requiredByDate} onChange={e => setForm({ ...form, requiredByDate: e.target.value })} required />
                  <FloatingSelect1 label="Department" value={form.departmentId} options={departments} onChange={e => setForm({ ...form, departmentId: parseNumberSelectValue(e.target.value) })} required emptyOptionLabel="" />
                  <FloatingSelect1 label="Requester" value={form.requesterId} options={requesters} onChange={e => setForm({ ...form, requesterId: e.target.value })} required emptyOptionLabel="" />
                </div>

                {/* Items */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-gray-800">Items</h4>
                    <button type="button" onClick={addItem}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors text-sm">
                      <PlusIcon className="h-4 w-4" />Add Item
                    </button>
                  </div>

                  <div className="space-y-4">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-700 text-sm">Item #{idx + 1}</span>
                          <button type="button" onClick={() => removeItem(idx)}
                            className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium transition-colors">
                            <TrashIcon className="h-3.5 w-3.5" />Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <FloatingSelect1 label="Category" value={item.categoryId} options={categories} onChange={e => updateItem(idx, "categoryId", parseNumberSelectValue(e.target.value))} required emptyOptionLabel="" />
                          <FloatingSelect1 label="Product" value={item.productId} options={getProducts(item.categoryId)} onChange={e => updateItem(idx, "productId", parseNumberSelectValue(e.target.value))} required disabled={!item.categoryId} emptyOptionLabel="" />
                          <SharedFloatingInput type="number" label="Quantity" value={item.quantity} min={1} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} required />
                          <SharedFloatingInput label="Unit of Measure" value={item.unitOfMeasure} onChange={e => updateItem(idx, "unitOfMeasure", e.target.value)} required />
                        </div>
                        <div className="mt-2">
                          <SharedFloatingInput label="Remarks" value={item.remarks} onChange={e => updateItem(idx, "remarks", e.target.value)} />
                        </div>
                      </div>
                    ))}
                    {form.items.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                        <p className="text-gray-500 text-sm">No items added yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click "Add Item" to start adding items</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={resetForm}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={saving}
                    className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                    {saving ? "Saving..." : `${form.id ? "Update" : "Create"} Requisition`}
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

export default PurchaseRequisitionPage;
