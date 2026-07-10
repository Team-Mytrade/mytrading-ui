import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";

// ─── Types ────────────────────────────────────────────────────────────────────

// Server-controlled audit fields — never rendered as inputs, only carried
// through silently on edit/submit so they don't get wiped out.
interface AuditFields {
  id?: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: number;
}

const STATUS_OPTIONS = ["DRAFT", "ISSUED", "CANCELLED"]; // TODO: confirm actual values with backend

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     "bg-gray-100  text-gray-600 border-gray-200/60",
  ISSUED:    "bg-green-100 text-green-800 border-green-200/60",
  CANCELLED: "bg-red-100   text-red-800 border-red-200/60",
};

interface GoodsIssueItem extends AuditFields {
  productId: number;
  quantity: number;
  goodsIssue: string; // TODO: confirm with backend what this field represents
}

interface GoodsIssueForm extends AuditFields {
  issueNo?: string; // assumed backend-generated; read-only when editing
  issueDate: string;
  deliveryNoteId: number;
  status: string;
  items: GoodsIssueItem[];
}

interface GoodsIssueRecord extends GoodsIssueForm {
  id: number;
  deliveryNoteNumber?: string; // denormalized label for table display, if API returns it
}

interface DeliveryNoteOption { id: number; noteNumber?: string; }
interface ProductOption { id: number; name: string; }

const emptyItem = (): GoodsIssueItem => ({
  productId: 0,
  quantity: 0,
  goodsIssue: "",
});

const emptyForm = (): GoodsIssueForm => ({
  issueDate: "",
  deliveryNoteId: 0,
  status: "DRAFT",
  items: [emptyItem()],
});

const API_URL            = "/v1/api/delivery/goods-issues";
const DELIVERY_NOTES_URL = "/v1/api/delivery/delivery-notes"; 
const PRODUCTS_URL       = "/v1/api/inventory/products";      

const getTenantIdFromToken = (token: string) => {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded?.tenantId || null;
  } catch {
    return null;
  }
};

const getTenantId = () => {
  try {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (user?.tenantId) return user.tenantId;
    }
    const token = localStorage.getItem("accessToken");
    if (token) return getTenantIdFromToken(token);
    return null;
  } catch {
    return null;
  }
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const GoodsIssuePage: React.FC = () => {
  const [form, setForm] = useState<GoodsIssueForm>(emptyForm());

  const [records, setRecords]           = useState<GoodsIssueRecord[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteOption[]>([]);
  const [products, setProducts]         = useState<ProductOption[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const [search, setSearch]             = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | DRAFT | ISSUED | CANCELLED
  const [showFilters, setShowFilters]   = useState(false);

  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingRecord, setDeletingRecord]   = useState<GoodsIssueRecord | null>(null);

  const token = localStorage.getItem("accessToken");
  const tenantId = getTenantId();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // ---------- Data loading ----------
  useEffect(() => {
    loadGoodsIssues();
    loadDeliveryNotes();
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while the modal is open
  useEffect(() => {
    document.body.style.overflow = showForm ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showForm]);

  const loadGoodsIssues = async () => {
    setLoading(true);
    try {
      const res = await axios.get<GoodsIssueRecord[]>(API_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setRecords(res.data);
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to load goods issues");
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryNotes = async () => {
    try {
      const res = await axios.get<DeliveryNoteOption[]>(DELIVERY_NOTES_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setDeliveryNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await axios.get<ProductOption[]>(PRODUCTS_URL, {
        headers: authHeaders,
        params: tenantId ? { tenantId } : {},
      });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const noteLabel = (id: number) =>
    deliveryNotes.find(n => n.id === id)?.noteNumber ?? `#${id}`;

  // ---------- Form field helpers ----------
  const handleChange = <K extends keyof GoodsIssueForm>(key: K, value: GoodsIssueForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm(emptyForm());
    setShowForm(false);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  // ---------- Items array helpers ----------
  const addItem = () =>
    setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }));

  const removeItem = (index: number) =>
    setForm(prev => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((_, i) => i !== index) : prev.items,
    }));

  const updateItem = <K extends keyof GoodsIssueItem>(index: number, key: K, value: GoodsIssueItem[K]) =>
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));

  // ---------- CRUD handlers ----------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.issueDate || !form.deliveryNoteId) {
      ToasterService.error("Please fill in all required fields");
      return;
    }
    if (form.items.some(i => !i.productId || i.quantity <= 0)) {
      ToasterService.error("Every item needs a product and a quantity greater than 0");
      return;
    }

    setSaving(true);

    // Audit fields are spread through silently, never edited via inputs.
    const payload: GoodsIssueForm = { ...form };

    try {
      if (form.id) {
        await axios.put(`${API_URL}/${form.id}`, payload, { headers: authHeaders });
        ToasterService.success("Goods issue updated successfully!");
      } else {
        await axios.post(API_URL, payload, { headers: authHeaders });
        ToasterService.success("Goods issue added successfully!");
      }
      await loadGoodsIssues();
      resetForm();
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to save goods issue");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: GoodsIssueRecord) => {
    setForm({
      // audit fields carried through silently
      id: record.id,
      createdDate: record.createdDate,
      updatedDate: record.updatedDate,
      createdBy: record.createdBy,
      tenantId: record.tenantId,

      issueNo: record.issueNo,
      issueDate: record.issueDate,
      deliveryNoteId: record.deliveryNoteId,
      status: record.status,
      items: record.items.length > 0 ? record.items.map(i => ({ ...i })) : [emptyItem()],
    });
    setShowForm(true);
  };

  const handleDelete = (record: GoodsIssueRecord) => {
    setDeletingRecord(record);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    try {
      await axios.delete(`${API_URL}/${deletingRecord.id}`, { headers: authHeaders });
      ToasterService.success("Goods issue deleted successfully!");
      setRecords(prev => prev.filter(r => r.id !== deletingRecord.id));
    } catch (err) {
      console.error(err);
      ToasterService.error("Failed to delete goods issue");
    } finally {
      setShowDeletePopup(false);
      setDeletingRecord(null);
    }
  };

  // ---------- Derived: search + filter ----------
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const term = search.toLowerCase();
      const matchesSearch =
        (r.issueNo ?? "").toLowerCase().includes(term) ||
        (r.deliveryNoteNumber ?? noteLabel(r.deliveryNoteId)).toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term);

      const matchesFilter = activeFilter === "ALL" || r.status === activeFilter;

      return matchesSearch && matchesFilter;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, search, activeFilter, deliveryNotes]);

  const stats = useMemo(() => ({
    total:     records.length,
    draft:     records.filter(r => r.status === "DRAFT").length,
    issued:    records.filter(r => r.status === "ISSUED").length,
    cancelled: records.filter(r => r.status === "CANCELLED").length,
  }), [records]);

  // ---------- Table columns ----------
  const columns: ColumnDef<GoodsIssueRecord>[] = [
    {
      key: "issueNo",
      label: "Issue No.",
      sortable: true,
      headerClassName: "w-[22%] text-left",
      className: "w-[22%]",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <DocumentTextIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <span className="text-sm font-semibold text-slate-900 truncate">{r.issueNo || "—"}</span>
        </div>
      ),
    },
    {
      key: "issueDate",
      label: "Issue Date",
      sortable: true,
      headerClassName: "w-[18%] text-left",
      className: "w-[18%]",
      render: (r) => (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarDaysIcon className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <span className="font-medium">{r.issueDate}</span>
        </div>
      ),
    },
    {
      key: "deliveryNoteNumber",
      label: "Delivery Note",
      headerClassName: "w-[20%] text-left",
      className: "w-[20%]",
      render: (r) => (
        <span className="text-sm text-slate-600 truncate">
          {r.deliveryNoteNumber ?? noteLabel(r.deliveryNoteId)}
        </span>
      ),
    },
    {
      key: "items",
      label: "Items",
      headerClassName: "w-[12%] text-left",
      className: "w-[12%]",
      render: (r) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/40">
          <ClipboardDocumentListIcon className="h-3.5 w-3.5 text-cyan-600 opacity-80" />
          {r.items?.length ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      headerClassName: "w-[13%] text-left",
      className: "w-[13%]",
      render: (r) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
          {r.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[15%] text-right pr-4",
      className: "w-[15%] text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => handleEdit(r)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit Goods Issue"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(r)}
            className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
            title="Delete Goods Issue"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  // ---------- Render ----------
  return (
    <>
      <PageMeta title="Goods Issue" description="Manage goods issue documents" />
      <PageBreadcrumb pageTitle="Goods Issue" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton label="Add Goods Issue" onClick={handleAddNew} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Goods Issues"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Draft"
            value={stats.draft}
            gradient="from-gray-50 to-slate-50"
            borderColor="border-gray-200"
            labelColor="text-gray-500"
          />
          <StatsCard
            label="Issued"
            value={stats.issued}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Cancelled"
            value={stats.cancelled}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:flex-1 sm:max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by issue number, delivery note, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex h-full w-full items-center justify-end gap-3 sm:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg border p-2 flex items-center justify-center transition-colors h-[40px] w-[40px] ${
                showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-slide-down">
            <div className="flex flex-wrap gap-4">
              <div className="w-full min-w-0 sm:flex-1 sm:min-w-[200px]">
                <FloatingSelect
                  label="Filter by Status"
                  name="filter"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  includeEmptyOption={false}
                  className="!mb-0"
                  options={[
                    { id: "ALL", name: "All Statuses" },
                    ...STATUS_OPTIONS.map(s => ({ id: s, name: s })),
                  ]}
                />
              </div>
              {activeFilter !== "ALL" && (
                <button
                  onClick={() => setActiveFilter("ALL")}
                  className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<GoodsIssueRecord>
          data={filteredRecords}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="issueDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <ClipboardDocumentListIcon className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 text-sm mb-2">No goods issues found</p>
              {search || activeFilter !== "ALL" ? (
                <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
              ) : (
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                >
                  Create your first goods issue
                </button>
              )}
            </div>
          }
        />

        {/* Add / Edit Modal — portal, matches CRM segment modal style */}
        {showForm &&
          createPortal(
            <div
              key="goods-issue-modal"
              className="fixed inset-0 z-50 flex items-start justify-center bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto p-4 sm:items-center"
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto animate-slide-up">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {form.id ? "Edit Goods Issue" : "Create New Goods Issue"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {form.id ? "Update this goods issue's details" : "Record a new goods issue document"}
                    </p>
                  </div>
                  <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 max-h-[75vh] overflow-y-auto">
                  <div className="space-y-4 pt-2">

                    {/* Issue No. — read-only, backend-generated. Only shown when editing. */}
                    {form.id && (
                      <FloatingInput
                        label="Issue No."
                        name="issueNo"
                        value={form.issueNo ?? ""}
                        onChange={() => {}}
                        disabled
                      />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FloatingInput
                        label="Issue Date"
                        name="issueDate"
                        type="date"
                        value={form.issueDate}
                        onChange={(e) => handleChange("issueDate", e.target.value)}
                        required
                      />

                      <FloatingSelect
                        label="Delivery Note"
                        name="deliveryNoteId"
                        value={form.deliveryNoteId ? String(form.deliveryNoteId) : ""}
                        onChange={(e) => handleChange("deliveryNoteId", Number(e.target.value))}
                        includeEmptyOption
                        required
                        options={deliveryNotes.map(d => ({ id: String(d.id), name: d.noteNumber ?? `#${d.id}` }))}
                      />
                    </div>

                    {/* Status — defaults to DRAFT on create, disabled there since
                        transitions are handled via separate actions elsewhere. */}
                    <FloatingSelect
                      label="Status"
                      name="status"
                      value={form.status}
                      onChange={(e) => handleChange("status", e.target.value)}
                      includeEmptyOption={false}
                      disabled={!form.id}
                      options={STATUS_OPTIONS.map(s => ({ id: s, name: s }))}
                    />
                  </div>

                  {/* Items */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-900">
                        Items <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={addItem}
                        className="inline-flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700"
                      >
                        <PlusIcon className="h-4 w-4" />
                        Add Item
                      </button>
                    </div>

                    <div className="space-y-3">
                      {form.items.map((item, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr_auto] gap-3 items-end bg-gray-50 border border-gray-200 rounded-lg p-3"
                        >
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                            <select
                              value={item.productId}
                              onChange={(e) => updateItem(index, "productId", Number(e.target.value))}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                            >
                              <option value={0} disabled>Select product</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                            <input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                              required
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
                            <input
                              type="text"
                              value={item.goodsIssue}
                              onChange={(e) => updateItem(index, "goodsIssue", e.target.value)}
                              placeholder="e.g. remarks / location"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            disabled={form.items.length === 1}
                            title={form.items.length === 1 ? "At least one item is required" : "Remove item"}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 !mb-0 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm disabled:opacity-60"
                    >
                      {saving ? "Saving..." : form.id ? "Update Goods Issue" : "Create Goods Issue"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Goods Issue"
        subText={`Are you sure you want to delete "${deletingRecord?.issueNo ?? "this goods issue"}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingRecord(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.25s ease-out; }
      `}</style>
    </>
  );
};

export default GoodsIssuePage;
