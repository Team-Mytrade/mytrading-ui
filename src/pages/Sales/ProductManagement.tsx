import React, { useState, useEffect } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CubeIcon,
  TagIcon,
  CurrencyDollarIcon,
  ArchiveBoxIcon,
  // EyeIcon,
} from "@heroicons/react/24/outline";
import axios from 'axios';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { CUSTOMER_UTILS } from '../../config/constants';
import { Link, useNavigate } from 'react-router-dom';
import { AddButton } from '../../components/common/AddButton';
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";

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

const getStockStatus = (stock: number) => {
  if (stock > 10) return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  if (stock > 0)  return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
  return           { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
};

const getProductColor = (name: string) => {
  const pool = [
    'from-cyan-500 to-blue-500',
    'from-purple-500 to-pink-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-indigo-500 to-purple-500',
    'from-red-500 to-pink-500',
  ];
  return pool[name.charCodeAt(0) % pool.length];
};

const ProductManagement: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [formData, setFormData] = useState({
    categoryId: '', name: '', price: '', availableStock: ''
  });
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<{ categoryId: number; productId: number } | null>(null);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedCategoryFilter === 'all') {
      fetchProducts();
    } else if (selectedCategoryFilter) {
      fetchProductsByCategory(selectedCategoryFilter);
    } else {
      setProducts([]);
    }
  }, [selectedCategoryFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/v1/api/sales/products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get("/v1/api/sales/categories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductsByCategory = async (categoryId: string) => {
    try {
      setLoading(true);
      const res = await axios.get(`/v1/api/sales/products/${categoryId}/category`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await axios.put(
          `/v1/api/sales/products/${editingProductId}/product`,
          { name: formData.name, price: parseFloat(formData.price), availableStock: parseInt(formData.availableStock) },
          { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `/v1/api/sales/products/${formData.categoryId}/category`,
          { name: formData.name, price: parseFloat(formData.price), availableStock: parseInt(formData.availableStock) },
          { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
        );
      }
      await fetchProducts();
      if (selectedCategoryFilter !== 'all') await fetchProductsByCategory(selectedCategoryFilter);
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Operation failed.');
    }
  };

  // Opens delete popup — does NOT delete yet
  const promptDelete = (categoryId: number, productId: number) => {
    setDeletingProduct({ categoryId, productId });
    setShowDeletePopup(true);
  };

  // Called when user confirms inside popup
  const confirmDelete = async () => {
    if (!deletingProduct) return;
    try {
      await axios.delete(
        `/v1/api/sales/category/${deletingProduct.categoryId}/products/${deletingProduct.productId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchProducts();
      if (selectedCategoryFilter !== 'all') await fetchProductsByCategory(selectedCategoryFilter);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingProduct(null);
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      categoryId: product.category.id.toString(),
      name: product.name,
      price: product.price.toString(),
      availableStock: product.availableStock.toString(),
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

  // ── Column definitions ──────────────────────────────────────────────────────
  const columns: ColumnDef<Product>[] = [
    {
      key: 'sku',
      label: 'SKU',
      sortable: true,
      render: (_, value) => (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {String(value)}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 flex-shrink-0 rounded-lg bg-gradient-to-br ${getProductColor(row.name)} flex items-center justify-center text-white font-semibold text-sm`}>
            {row.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (row) => (
        <Link
          to="/sales-categories"
          className="text-sm text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <TagIcon className="h-4 w-4" />
          {row.category.name}
        </Link>
      ),
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1">
          <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">
            {CUSTOMER_UTILS.CURRENCY}{row.price.toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      key: 'availableStock',
      label: 'Stock',
      sortable: true,
      render: (row) => {
        const status = getStockStatus(row.availableStock);
        return (
          <div className="flex items-center gap-2">
            <ArchiveBoxIcon className="h-4 w-4 text-gray-400" />
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
              {status.label} ({row.availableStock})
            </span>
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      headerClassName: '!text-right pr-8',
      className: 'text-right',
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigate(`/sales/products/view/${row.id}`)}
            title="View"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            {/* <EyeIcon className="h-4 w-4" /> */}
          </button>
          <button
            onClick={() => handleEdit(row)}
            title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => promptDelete(row.category.id, row.id)}
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
      <PageMeta title="Products" description="Manage your products" />
      <PageBreadcrumb pageTitle="Products" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-8">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton label="Add Product" onClick={openAddModal} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <StatsCard
            label="Total Products"
            value={products.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="In Stock"
            value={products.filter(p => p.availableStock > 10).length}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="Low Stock"
            value={products.filter(p => p.availableStock > 0 && p.availableStock <= 10).length}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
          />
          <StatsCard
            label="Out of Stock"
            value={products.filter(p => p.availableStock === 0).length}
            gradient="from-red-50 to-pink-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
          />
        </div>

        {/* Table */}
        <ReusableTable<Product>
          data={products}
          columns={columns}
          loading={loading}
          onRowClick={(row) => navigate(`/sales/products/view/${row.id}`)}
          searchable
          searchPlaceholder="Search by name, SKU, or category..."
          searchFields={["name", "sku"]}
          pageSize={10}
          defaultSortKey="name"
          toolbar={
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-4 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all bg-white min-w-[180px]"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          }
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <CubeIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No products found</p>
              <button
                onClick={openAddModal}
                className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
              >
                Add your first product →
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
        innerText="Delete Product"
        subText="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Form modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-[slide-up_0.25s_ease-out]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? 'Edit Product' : 'Add New Product'}
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {isEditMode ? 'Update product details' : 'Create a new product'}
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter product name"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CurrencyDollarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Stock <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <ArchiveBoxIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    value={formData.availableStock}
                    onChange={(e) => setFormData({ ...formData, availableStock: e.target.value })}
                    placeholder="0"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  {isEditMode ? 'Update Product' : 'Add Product'}
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
      `}</style>
    </>
  );
};

export default ProductManagement;