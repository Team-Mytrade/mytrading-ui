import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  BuildingOffice2Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { FloatingInput } from "../../components/inputfeild/FloatingInput";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

interface Department { id: number; name: string; }

const API_URL = "/v1/api/purchase/department";

// ─────────────────────────────────────────────────────────────────────────────

const DepartmentPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [name, setName]               = useState("");

  // Delete popup
  const [showDeletePopup, setShowDeletePopup]   = useState(false);
  const [deletingDept, setDeletingDept]         = useState<Department | null>(null);

  useEffect(() => { fetchDepartments(); }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    try { const res = await axios.get<Department[]>(API_URL); setDepartments(res.data); }
    catch { console.error("Failed to load departments."); }
    finally { setLoading(false); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const clearForm = () => { setName(""); setEditingId(null); setShowForm(false); };
  const openCreatePopup = () => { setName(""); setEditingId(null); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, { name });
      else           await axios.post(API_URL, { name });
      fetchDepartments(); clearForm();
    } catch { console.error("Save failed."); }
  };

  const handleEdit = (d: Department) => { setEditingId(d.id); setName(d.name); setShowForm(true); };

  const promptDelete = (d: Department) => { setDeletingDept(d); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingDept) return;
    try { await axios.delete(`${API_URL}/${deletingDept.id}`); fetchDepartments(); }
    catch { console.error("Delete failed."); }
    setDeletingDept(null);
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Department>[] = [
    {
      key: "name", label: "Department Name", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
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
      <PageMeta title="Departments" description="Manage departments" />
      <PageBreadcrumb pageTitle="Departments" />

      <div className="w-full px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
            <p className="text-sm text-gray-500 mt-0.5">Create and manage departments</p>
          </div> */}
          <AddButton label="Add Department" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard label="Total Departments" value={departments.length} gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="This Page"          value={Math.min(5, departments.length)} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
          <StatsCard label="Filtered Results"   value={departments.length} gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
        </div>

        {/* Department popup */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
              <div className="fixed inset-0 bg-black/50" onClick={clearForm} />
              <div className="relative my-8 w-full max-w-xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingId ? "Edit Department" : "Add Department"}
                  </h3>
                  <button onClick={clearForm} className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-6">
                  <div className="mb-4">
                    <FloatingInput label="Department Name" value={name} onChange={e => setName(e.target.value)} required name="departmentName" />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={clearForm}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit"
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                      {editingId ? "Update Department" : "Add Department"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Department>
          data={departments}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search department..."
          searchFields={["name"]}
          pageSize={5}
          defaultSortKey="name"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BuildingOffice2Icon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No departments found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first department →
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
        innerText="Delete Department"
        subText={`Are you sure you want to delete "${deletingDept?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default DepartmentPage;
