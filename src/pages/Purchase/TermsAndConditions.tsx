import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface Terms { id: number; title: string; content: string; active: boolean; }

// ── Helper — OUTSIDE component ────────────────────────────────────────────────
const getStatusBadgeClass = (active: boolean) =>
  active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800";

const API_URL = "/v1/api/purchase/terms";

// ─────────────────────────────────────────────────────────────────────────────

const TermsAndConditionsPage: React.FC = () => {
  const [terms, setTerms]         = useState<Terms[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState({ title: "", content: "", active: true });

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingTerm, setDeletingTerm]       = useState<Terms | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try { const res = await axios.get<Terms[]>(API_URL); setTerms(res.data); }
    catch (err) { console.error("Error loading data:", err); }
    finally { setLoading(false); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleChange = (key: keyof typeof form, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => { setForm({ title: "", content: "", active: true }); setEditingId(null); setShowForm(false); };
  const openCreatePopup = () => { setForm({ title: "", content: "", active: true }); setEditingId(null); setShowForm(true); };

  const handleEdit = (term: Terms) => {
    setEditingId(term.id);
    setForm({ title: term.title, content: term.content, active: term.active });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, form);
      else           await axios.post(API_URL, form);
      loadData(); resetForm();
    } catch (err) { console.error("Error submitting form:", err); }
  };

  const promptDelete = (term: Terms) => { setDeletingTerm(term); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingTerm) return;
    try { await axios.delete(`${API_URL}/${deletingTerm.id}`); loadData(); }
    catch (err) { console.error("Error deleting terms:", err); }
    setDeletingTerm(null);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:    terms.length,
    active:   terms.filter(t => t.active).length,
    inactive: terms.filter(t => !t.active).length,
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Terms>[] = [
    {
      key: "title", label: "Title", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "content", label: "Content",
      render: (_, v) => (
        <span className="text-sm text-gray-600 truncate max-w-[220px] block">
          {String(v).length > 60 ? `${String(v).substring(0, 60)}...` : String(v)}
        </span>
      ),
    },
    {
      key: "active", label: "Status", sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(row.active)}`}>
          {row.active ? <><CheckCircleIcon className="h-3 w-3 mr-1" />Active</> : <><XCircleIcon className="h-3 w-3 mr-1" />Inactive</>}
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Terms & Conditions" description="Manage Terms & Conditions" />
      <PageBreadcrumb pageTitle="Terms & Conditions" />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Terms & Conditions</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage terms & conditions</p>
          </div> */}
          <AddButton label="Create Terms & Conditions" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard label="Total"    value={stats.total}    gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Active"   value={stats.active}   gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Inactive" value={stats.inactive} gradient="from-gray-50 to-slate-50"    borderColor="border-gray-200"   labelColor="text-gray-600" />
        </div>

        {/* Terms popup */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
              <div className="fixed inset-0 bg-black/50" onClick={resetForm} />
              <div className="relative my-8 w-full max-w-3xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingId ? "Edit Terms & Conditions" : "Create Terms & Conditions"}
                  </h3>
                  <button onClick={resetForm} className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="space-y-4 mb-6">
                    {/* Title Input */}
                    <FloatingInput 
                      label="Title" 
                      value={form.title} 
                      onChange={e => handleChange("title", e.target.value)} 
                      required 
                      name="title" 
                    />
                    
                    {/* Content Textarea */}
                    <div>
                      <FloatingTextarea 
                        label="Terms & Conditions Content" 
                        value={form.content} 
                        onChange={e => handleChange("content", e.target.value)} 
                        required 
                        name="content" 
                        rows={6} 
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter the full terms and conditions content</p>
                    </div>
                    
                    {/* Active Status Checkbox - Styled as Floating Input style */}
                    <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="active-status" 
                        checked={form.active} 
                        onChange={e => handleChange("active", e.target.checked)}
                        className="h-4 w-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                      />
                      <label htmlFor="active-status" className="text-sm font-medium text-gray-700">
                        Active Status
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={resetForm}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit"
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                      {editingId ? "Update" : "Save"} Terms & Conditions
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Terms>
          data={terms}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by title or content..."
          searchFields={["title", "content"]}
          pageSize={5}
          defaultSortKey="title"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No terms & conditions found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Create your first entry →
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
        innerText="Delete Terms & Conditions"
        subText={`Are you sure you want to delete "${deletingTerm?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default TermsAndConditionsPage;