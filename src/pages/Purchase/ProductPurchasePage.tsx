import React, { SetStateAction, useEffect, useState } from "react";
import axios from "axios";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CubeIcon,
  TagIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { AddButton } from "../../components/common/AddButton";
import { CUSTOMER_UTILS } from "../../config/constants";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { 
  FloatingInput, 
  FloatingTextarea, 
  FloatingSelect1 
} from "../../components/inputfeild/FloatingInput";

interface Product {
  categoryId: SetStateAction<number | null>;
  id: number; sku: string; name: string; unitOfMeasure: string;
  description: string; price: number; active: boolean; categoryName: string;
}

interface Category { id: number; name: string; }

const API_URL      = "/v1/api/purchase/products";
const CATEGORY_API = "/v1/api/purchase/categories";

const UOM_OPTIONS = ["PIECES","BOX","PACK","KILOGRAM","GRAM","LITRE","MILLILITRE","METER","CENTIMETER","MILLIMETER","DOZEN","BAG","ROLL","OTHER"];

// Convert UOM options to format expected by FloatingSelect1
const uomOptions = UOM_OPTIONS.map(uom => ({
  id: uom,
  name: uom
}));

// ─────────────────────────────────────────────────────────────────────────────

const ProductPurchasePage: React.FC = () => {
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);

  // Form fields
  const [sku, setSku]                     = useState("");
  const [name, setName]                   = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [description, setDescription]     = useState("");
  const [price, setPrice]                 = useState<number>(0);
  const [active, setActive]               = useState(true);
  const [categoryId, setCategoryId]       = useState<number | null>(null);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try { const res = await axios.get<Product[]>(API_URL); setProducts(res.data); }
    catch { console.error("Failed to load products."); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try { const res = await axios.get<Category[]>(CATEGORY_API); setCategories(res.data); }
    catch { console.error("Failed to load categories."); }
  };

  // Convert categories to format expected by FloatingSelect1
  const categoryOptions = categories.map(cat => ({
    id: cat.id,
    name: cat.name
  }));

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const clearForm = () => { setSku(""); setName(""); setUnitOfMeasure(""); setDescription(""); setPrice(0); setActive(true); setCategoryId(null); setEditingId(null); setShowForm(false); };

  const openCreatePopup = () => {
    setSku("");
    setName("");
    setUnitOfMeasure("");
    setDescription("");
    setPrice(0);
    setActive(true);
    setCategoryId(null);
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { sku, name, unitOfMeasure, description, price, active, categoryId };
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, payload);
      else           await axios.post(API_URL, payload);
      fetchProducts(); clearForm();
    } catch { console.error("Save failed."); }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id); setSku(p.sku); setName(p.name);
    setUnitOfMeasure(p.unitOfMeasure); setDescription(p.description || "");
    setPrice(p.price); setActive(p.active); setCategoryId(p.categoryId as number);
    setShowForm(true);
  };

  const promptDelete = (p: Product) => { setDeletingProduct(p); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    try { await axios.delete(`${API_URL}/${deletingProduct.id}`); fetchProducts(); }
    catch { console.error("Delete failed."); }
    setDeletingProduct(null);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:      products.length,
    active:     products.filter(p => p.active).length,
    inactive:   products.filter(p => !p.active).length,
    categories: new Set(products.map(p => p.categoryName).filter(Boolean)).size,
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Product>[] = [
    {
      key: "sku", label: "SKU", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <TagIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "name", label: "Name", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-2">
          <CubeIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{String(v)}</span>
        </div>
      ),
    },
    {
      key: "unitOfMeasure", label: "UOM", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v)}</span>,
    },
    {
      key: "description", label: "Description",
      render: (_, v) => <span className="text-sm text-gray-600 truncate max-w-[160px] block">{String(v) || "—"}</span>,
    },
    {
      key: "price", label: "Price", sortable: true,
      render: (_, v) => (
        <div className="flex items-center gap-1">
          <CurrencyDollarIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{CUSTOMER_UTILS.CURRENCY}{Number(v).toFixed(2)}</span>
        </div>
      ),
    },
    {
      key: "categoryName", label: "Category", sortable: true,
      render: (_, v) => <span className="text-sm text-gray-700">{String(v) || "—"}</span>,
    },
    {
      key: "active", label: "Active", sortable: true,
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {row.active ? <><CheckCircleIcon className="h-3 w-3 mr-1" />Yes</> : <><XCircleIcon className="h-3 w-3 mr-1" />No</>}
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
      <PageMeta title="Products" description="Purchase products details" />
      <PageBreadcrumb pageTitle="Products" />

      <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-6">

        {/* Header */}
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          {/* <div>
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage purchase product catalogue</p>
          </div> */}
          <AddButton label="Add Product" onClick={openCreatePopup} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Products" value={stats.total}      gradient="from-cyan-50 to-blue-50"     borderColor="border-cyan-100"   labelColor="text-cyan-600" />
          <StatsCard label="Active"          value={stats.active}    gradient="from-green-50 to-emerald-50" borderColor="border-green-100"  labelColor="text-green-600" />
          <StatsCard label="Inactive"        value={stats.inactive}  gradient="from-red-50 to-pink-50"      borderColor="border-red-100"    labelColor="text-red-600" />
          <StatsCard label="Categories"      value={stats.categories} gradient="from-purple-50 to-pink-50"  borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        {/* Product popup */}
        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20">
              <div className="fixed inset-0 bg-black/50" onClick={clearForm} />
              <div className="relative my-8 w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingId ? "Edit Product" : "Add New Product"}
                  </h3>
                  <button onClick={clearForm} className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
                    {/* SKU - Readonly */}
                    <div className="relative">
                      <FloatingInput 
                        label="SKU" 
                        value={sku} 
                        onChange={e => setSku(e.target.value)} 
                        readOnly
                        disabled
                        className="cursor-not-allowed bg-gray-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">Auto-generated</p>
                    </div>
                    
                    {/* Product Name */}
                    <FloatingInput 
                      label="Product Name" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      required 
                    />
                    
                    {/* Unit of Measure */}
                    <FloatingSelect1 
                      label="Unit of Measure" 
                      value={unitOfMeasure} 
                      options={uomOptions} 
                      onChange={e => setUnitOfMeasure(e.target.value)} 
                      required
                      emptyOptionLabel=""
                    />
                    
                    {/* Price */}
                    <FloatingInput 
                      label="Price" 
                      type="number" 
                      value={price} 
                      onChange={e => setPrice(parseFloat(e.target.value))} 
                      required 
                      min={0}
                      step={0.01}
                    />
                    
                    {/* Category */}
                    <FloatingSelect1 
                      label="Category" 
                      value={categoryId?.toString() || ""} 
                      options={categoryOptions} 
                      onChange={e => setCategoryId(e.target.value === "" ? null : Number(e.target.value))} 
                      emptyOptionLabel=""
                    />
                    
                    {/* Active Status Checkbox - Styled as floating style */}
                    <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="active-status" 
                        checked={active} 
                        onChange={e => setActive(e.target.checked)}
                        className="h-4 w-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500" 
                      />
                      <label htmlFor="active-status" className="text-sm font-medium text-gray-700">
                        Active Product
                      </label>
                    </div>
                  </div>
                  
                  {/* Description */}
                  <div className="mb-4">
                    <FloatingTextarea 
                      label="Description" 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      rows={3}
                      placeholder="Enter product description..."
                    />
                  </div>
                  
                  <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <button type="button" onClick={clearForm}
                      className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button type="submit"
                      className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors">
                      {editingId ? "Update Product" : "Add Product"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <ReusableTable<Product>
          data={products}
          columns={columns}
          loading={loading}
          searchable
          searchPlaceholder="Search by name or SKU..."
          searchFields={["name", "sku", "categoryName"]}
          pageSize={5}
          defaultSortKey="name"
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <CubeIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No products found</p>
              <button onClick={openCreatePopup} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
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
        subText={`Are you sure you want to delete "${deletingProduct?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default ProductPurchasePage;