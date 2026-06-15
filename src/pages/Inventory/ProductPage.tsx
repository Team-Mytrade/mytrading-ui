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
import { CUSTOMER_UTILS } from '../../config/constants';
import { Link } from 'react-router';

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  availableStock: number;
  category: {
    id: number;
    name: string;
  };
}

interface Category {
  id: number;
  name: string;
}

const PAGE_SIZE = 10;

const ProductPage: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    categoryId: '',
    name: '',
    price: '',
    availableStock: ''
  });
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCategoryFilter === 'all') {
      fetchProducts();
    } else if (selectedCategoryFilter) {
      fetchProductsByCategory(selectedCategoryFilter);
    } else{
      setProducts([]);
    }
  }, [selectedCategoryFilter]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get("/v1/api/invetory/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };
  const fetchCategories = async () => {
    try {
      const response = await axios.get("/v1/api/inventory/categories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProductsByCategory = async (categoryId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/v1/api/inventory/products/${categoryId}/category`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products by category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `/v1/api/inventory/products/${formData.categoryId}/category`,
        {
          name: formData.name,
          price: parseFloat(formData.price),
          availableStock: parseInt(formData.availableStock)
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 200 || response.status === 201) {
        alert('Product added successfully!');
        fetchProducts();
        if (selectedCategoryFilter) {
          await fetchProductsByCategory(selectedCategoryFilter);
        }
        closeModal();
      }
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product.');
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `/v1/api/inventory/products/${editingProductId}/product`,
        {
          name: formData.name,
          price: parseFloat(formData.price),
          availableStock: parseInt(formData.availableStock)
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        alert('Product updated successfully!');
        if (selectedCategoryFilter) {
          await fetchProductsByCategory(selectedCategoryFilter);
        }
        closeModal();
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product.');
    }
  };

  const handleDeleteProduct = async (categoryId: number, productId: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      const response = await axios.delete(
        `/v1/api/inventory/category/${categoryId}/products/${productId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.status === 200) {
        alert('Product deleted successfully!');
        if (selectedCategoryFilter) {
          await fetchProductsByCategory(selectedCategoryFilter);
        }
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      categoryId: product.category.id.toString(),
      name: product.name,
      price: product.price.toString(),
      availableStock: product.availableStock.toString()
    });
    setEditingProductId(product.id);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({ categoryId: '', name: '', price: '', availableStock: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ categoryId: '', name: '', price: '', availableStock: '' });
    setEditingProductId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (isEditMode) {
      handleUpdateProduct(e);
    } else {
      handleAddProduct(e);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const filtered = products.filter((p) =>
    [p.name, p.category.name, p.sku].some((field) =>
      field && field.toLowerCase().includes(search.toLowerCase())
    )
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = getNestedValue(a, sortKey) ?? '';
    const valB = getNestedValue(b, sortKey) ?? '';
    
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortOrder === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
    return 0;
  });

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleClick= (id: number) => {
    
  }

  return (
    <>
      <PageMeta title="Products" description="Manage your products" />
      <PageBreadcrumb pageTitle="Products" />

      <div className="max-w-6xl mx-auto p-6">


        {/* Search + Category Filter + Add */}
        <div className="flex justify-between items-center mb-4 gap-4">
          <div className="flex gap-4 flex-1">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 min-w-[200px]"
            >
              <option value="all">All</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 flex-1"
            />
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg"
          >
            <PlusIcon className="h-5 w-5" /> Add Product
          </button>
        </div>

        {/* Table */}
        <div className="shadow border border-gray-200 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { key: 'sku', label: 'SKU' },
                  { key: 'name', label: 'Product Name' },
                  { key: 'category.name', label: 'Category' },
                  { key: 'price', label: 'Price' },
                  { key: 'availableStock', label: 'Stock' }
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
                  <td colSpan={6} className="text-center py-12 text-cyan-600">
                    Loading products...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500">
                    {selectedCategoryFilter ? 'No products found.' : 'Please select a category to view products.'}
                  </td>
                </tr>
              ) : (
                paginated.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">{product.sku}</td>
                    <td className="px-6 py-4">{product.name}</td>
                    <td className="px-6 py-4"> <Link to="/sales-categories" >{product.category.name}</Link></td>
                    <td className="px-6 py-4 font-semibold">{CUSTOMER_UTILS.CURRENCY}{product.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
                        product.availableStock > 10
                          ? 'bg-green-100 text-green-800'
                          : product.availableStock > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {product.availableStock} units
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="p-1 rounded hover:bg-gray-100">
                          <EllipsisVerticalIcon className="h-5 w-5" />
                        </Menu.Button>

                        <Menu.Items className="absolute right-0 mt-1 w-52 bg-white shadow-lg border rounded-md z-50">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleEdit(product)}
                                className={`${
                                  active ? "bg-gray-100" : ""
                                } w-full text-left px-3 py-2 flex items-center gap-2 text-cyan-600`}
                              >
                                <PencilSquareIcon className="h-4 w-4" /> Edit Product
                              </button>
                            )}
                          </Menu.Item>

                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleDeleteProduct(product.category.id, product.id)}
                                className={`${
                                  active ? "bg-gray-100" : ""
                                } w-full text-left px-3 py-2 flex items-center gap-2 text-red-600`}
                              >
                                <TrashIcon className="h-4 w-4" /> Delete Product
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
                  {isEditMode ? 'Edit Product' : 'Add Product'}
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
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Product Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Available Stock</label>
                  <input
                    type="number"
                    value={formData.availableStock}
                    onChange={(e) => setFormData({ ...formData, availableStock: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
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

export default ProductPage;