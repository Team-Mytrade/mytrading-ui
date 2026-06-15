import React, { useState, useEffect } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { Menu } from "@headlessui/react";
import axios from 'axios';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { useNavigate } from "react-router-dom";

interface Category {
  id: number;
  name: string;
  prefix: string;
  description: string;
}

// prefix min 3
const API_URL = "/v1/api/inventory/categories";
const PAGE_SIZE = 10;

const InventoryCategoryPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    prefix: '',
    description: ''
  });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Category>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!token) {
      alert("Token Expired. Please login to view this page");
      navigate("/auth/login");
      return;
    }
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        API_URL,
        formData,
        {
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200 || response.status === 201) {
        alert('Category added successfully!');
        await fetchCategories();
        closeModal();
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Failed to add category.');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `${API_URL}/${editingCategoryId}`,
        formData,
        {
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.status === 200) {
        alert('Category updated successfully!');
        await fetchCategories();
        closeModal();
      }
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category.');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const response = await axios.delete(
        `${API_URL}/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.status === 200) {
        await fetchCategories();
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleEdit = (category: Category) => {
    setFormData({
      name: category.name,
      prefix: category.prefix,
      description: category.description
    });
    setEditingCategoryId(category.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({ name: '', prefix: '', description: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', prefix: '', description: '' });
    setEditingCategoryId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isEditMode) {
      handleUpdateCategory(e);
    } else {
      handleAddCategory(e);
    }
  };

  const handleSort = (key: keyof Category) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const filtered = categories.filter((c) =>
    [c.name, c.prefix, c.description].some((field) =>
      field && field.toLowerCase().includes(search.toLowerCase())
    )
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortKey] ?? '';
    const valB = b[sortKey] ?? '';
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    return 0;
  });

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <>
      <PageMeta title="Inventory Categories" description="Manage your categories" />
      <PageBreadcrumb pageTitle="Inventory Categories" />

      <div className="max-w-6xl mx-auto p-6">


        {/* Search + Add */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 w-1/3"
          />

          <button
            className="btn btn-primary add-btn"
             onClick={openAddModal}
          >
            <i className="fas fa-plus"></i> Add Category
          </button>
        </div>

        {/* Table */}
        <div className="shadow border border-gray-200 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { key: 'name' as keyof Category, label: 'Name' },
                  { key: 'prefix' as keyof Category, label: 'Prefix' },
                  { key: 'description' as keyof Category, label: 'Description' }
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      {sortKey === key &&
                        (sortOrder === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                ))}
                
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 overflow-auto">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-cyan-600">
                    Loading categories...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-500">
                    No categories found.
                  </td>
                </tr>
              ) : (
                paginated.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{category.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-800 font-semibold text-sm">
                        {category.prefix}
                      </span>
                    </td>
                    <td className="px-6 py-4">{category.description}</td>
                    <td className="px-6 py-4 text-right">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="p-1 rounded hover:bg-gray-100">
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </Menu.Button>

                        <Menu.Items className="absolute right-0 mt-1 w-52 bg-white shadow-lg border rounded-md z-50">
                          {/* Edit Category */}
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleEdit(category)}
                                className={`${
                                  active ? "bg-gray-100" : ""
                                } w-full text-left px-3 py-2 flex items-center gap-2 text-cyan-600`}
                              >
                                <PencilSquareIcon className="h-4 w-4" /> Edit Category
                              </button>
                            )}
                          </Menu.Item>

                          {/* Delete Category */}
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleDeleteCategory(category.id)}
                                className={`${
                                  active ? "bg-gray-100" : ""
                                } w-full text-left px-3 py-2 flex items-center gap-2 text-red-600`}
                              >
                                <TrashIcon className="h-4 w-4" /> Delete Category
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Menu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 rounded ${
                  page === i + 1
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow w-full max-w-2xl mx-4">
              <div className="flex items-start justify-between p-5 border-b rounded-t">
                <h3 className="text-xl font-semibold">
                  {isEditMode ? 'Edit Category' : 'Add Category'}
                </h3>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:bg-gray-200 hover:text-gray-900 rounded-lg p-1.5"
                >
                  ✖
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 gap-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Prefix</label>
                  <input
                    type="text"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2 border rounded"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    className="bg-cyan-600 text-white px-5 py-2 rounded-lg"
                  >
                    {isEditMode ? 'Update' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="bg-gray-200 px-5 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default InventoryCategoryPage;