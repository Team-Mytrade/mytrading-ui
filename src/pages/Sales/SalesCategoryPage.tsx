import React, { useState, useEffect } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  TagIcon,
  DocumentTextIcon,
  CubeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import axios from "axios";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { useNavigate } from "react-router-dom";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup"; // adjust path
import Statscard from "../../components/common/Statscard"; // adjust path

interface SalesCategory {
  id: number;
  name: string;
  prefix: string;
  description: string;
}

const API_URL = "/v1/api/sales/categories";

const avatarGradient = (name: string) => {
  const pool = [
    "from-cyan-500 to-blue-500",
    "from-purple-500 to-pink-500",
    "from-green-500 to-emerald-500",
    "from-yellow-500 to-orange-500",
    "from-indigo-500 to-purple-500",
    "from-red-500 to-pink-500",
  ];
  return pool[name.charCodeAt(0) % pool.length];
};

const SalesCategories: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");

  const [categories, setCategories] = useState<SalesCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", prefix: "", description: "" });

  // Delete popup state
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      alert("Token Expired. Please login.");
      navigate("/auth/login");
      return;
    }
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await axios.put(`${API_URL}/${editingId}`, formData, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(API_URL, formData, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
      }
      await fetchCategories();
      closeForm();
    } catch (err) {
      console.error(err);
      alert("Operation failed.");
    }
  };

  // Opens the delete popup — does NOT delete yet
  const promptDelete = (id: number) => {
    setDeletingId(id);
    setShowDeletePopup(true);
  };

  // Called when user confirms inside the popup
  const confirmDelete = async () => {
    if (deletingId === null) return;
    try {
      await axios.delete(`${API_URL}/${deletingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchCategories();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setIsEditMode(false);
    setFormData({ name: "", prefix: "", description: "" });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (cat: SalesCategory) => {
    setIsEditMode(true);
    setFormData({ name: cat.name, prefix: cat.prefix, description: cat.description });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormData({ name: "", prefix: "", description: "" });
    setEditingId(null);
  };

  const columns: ColumnDef<SalesCategory>[] = [
    {
      key: "name",
      label: "Category Name",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div
            className={`h-9 w-9 flex-shrink-0 rounded-lg bg-gradient-to-br ${avatarGradient(
              row.name
            )} flex items-center justify-center text-white font-semibold text-sm`}
          >
            {row.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: "prefix",
      label: "Prefix",
      sortable: true,
      render: (_, value) => (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
          {String(value)}
        </span>
      ),
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
      render: (_, value) => (
        <div className="flex items-start gap-2 max-w-xs">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          <span className="text-gray-600 line-clamp-2 text-sm">
            {String(value) || "No description"}
          </span>
        </div>
      ),
    },
    /* {
      key: "products",
      label: "Products",
      render: () => (
        <div className="flex items-center gap-2 text-gray-500">
          <CubeIcon className="h-4 w-4" />
          <span>0</span>
        </div>
      ),
    }, */
    {
      key: "actions",
      label: "Actions",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigate(`/sales/categories/view/${row.id}`)}
            title="View"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
          </button>
          <button
            onClick={() => openEdit(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => promptDelete(row.id)}
            title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Sales Categories" description="Manage your sales categories" />
      <PageBreadcrumb pageTitle="Sales Categories" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8 -mt-[125px] flex justify-end">
          <AddButton onClick={openAdd} label="Add Category" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Statscard
            label="Total Categories"
            value={categories.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <Statscard
            label="Active"
            value={categories.length}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <Statscard
            label="Total Products"
            value={0}
            gradient="from-emerald-50 to-teal-50"
            borderColor="border-emerald-100"
            labelColor="text-emerald-600"
          />
        </div>

        {/* Table */}
        <ReusableTable<SalesCategory>
          data={categories}
          columns={columns}
          loading={isLoading}
          onRowClick={(row) => navigate(`/sales/categories/view/${row.id}`)}
          searchable
          searchPlaceholder="Search by name, prefix, or description..."
          searchFields={["name", "prefix", "description"]}
          pageSize={10}
          defaultSortKey="name"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <TagIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No categories yet</p>
              <button
                onClick={openAdd}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Add your first category →
              </button>
            </div>
          }
        />
      </div>

      {/* ── Delete confirmation popup ── */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Category"
        subText="Are you sure you want to delete this category? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* ── Form modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-[slide-up_0.25s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? "Edit Category" : "Add New Category"}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditMode ? "Update category details" : "Create a new sales category"}
                </p>
              </div>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter category name"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prefix <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 ml-2">(min 3 characters)</span>
                </label>
                <input
                  type="text"
                  value={formData.prefix}
                  onChange={(e) =>
                    setFormData({ ...formData, prefix: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., ELEC"
                  required
                  minLength={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter category description..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  {isEditMode ? "Update" : "Add Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
};

export default SalesCategories;
