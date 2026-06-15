import { useEffect, useMemo, useState, Fragment } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ShoppingBagIcon,
  CurrencyRupeeIcon,
  BuildingStorefrontIcon,
  UserIcon,
  CubeIcon,
  ArchiveBoxIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import { Transition, Dialog } from "@headlessui/react";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { BackButton } from "../../components/common/BackButton";

interface Customer {
  id: number;
  name?: string;
  companyName?: string;
}

interface SalesChannel {
  id: number;
  name: string;
}

interface SalesOrder {
  id: number;
  customer: Customer;
  totalAmount: number;
  salesChannel: SalesChannel;
  paid: boolean;
  orderDate?: string;
  status?: string;
}

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  availableStock: number;
  category?: Category;
}

interface SalesOrderItem {
  id?: number | string | undefined;
  salesOrder: SalesOrder;
  product: Product;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const BASE_URL = "/v1/api/sales/sales-order-items";

type ProductRow = {
  id?: number;
  categoryId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  stockWarning?: string;
};

const StockBadge = ({ stock }: { stock: number }) => {
  if (stock > 10) return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      <CheckCircleSolid className="h-3 w-3 mr-1" />{stock}
    </span>
  );
  if (stock > 0) return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
      <ClockIcon className="h-3 w-3 mr-1" />{stock}
    </span>
  );
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      <XCircleIcon className="h-3 w-3 mr-1" />0
    </span>
  );
};

export default function SalesOrderItemsPage() {
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [productsByCategory, setProductsByCategory] = useState<Record<number, Product[]>>({});

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SalesOrderItem | null>(null);
  const [viewItem, setViewItem] = useState<SalesOrderItem | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingId, setDeletingId] = useState<number | undefined>(undefined);

  const emptyForm = { salesOrderId: 0, customerId: 0, totalAmount: 0, salesChannelId: 0, paid: false };
  const [form, setForm] = useState(emptyForm);

  const emptyProductRow = (): ProductRow => ({
    categoryId: 0, productId: 0, quantity: 1, unitPrice: 0, totalPrice: 0, stockWarning: "",
  });
  const [productRows, setProductRows] = useState<ProductRow[]>([emptyProductRow()]);

  // Stats
  const stats = useMemo(() => ({
    totalItems: items.length,
    totalValue: items.reduce((s, i) => s + i.totalPrice, 0),
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    lowStock: items.filter(i => i.product.availableStock < 10).length,
  }), [items]);

  // ── Data fetching ─────────────────────────────────────────────────────────

  useEffect(() => { fetchAll(); fetchDropdowns(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(BASE_URL);
      if (!res.ok) throw new Error();
      setItems(await res.json());
    } catch { console.error("Failed to load items"); }
    finally { setLoading(false); }
  };

  const fetchDropdowns = async () => {
    try {
      const [catRes, ordersRes, channelsRes] = await Promise.all([
        fetch("/v1/api/sales/categories"),
        fetch("/v1/api/sales/sales-orders"),
        fetch("/v1/api/sales/channels"),
      ]);
      setCategories(await catRes.json());
      setSalesOrders(await ordersRes.json());
      setChannels(await channelsRes.json());
    } catch { console.error("Failed to load dropdowns"); }
  };

  const fetchProductsForCategory = async (categoryId: number) => {
    if (!categoryId) return [];
    if (productsByCategory[categoryId]) return productsByCategory[categoryId];
    try {
      const res = await fetch(`/v1/api/sales/products/${categoryId}/category`);
      const data: Product[] = await res.json();
      setProductsByCategory(prev => ({ ...prev, [categoryId]: data }));
      return data;
    } catch {
      setProductsByCategory(prev => ({ ...prev, [categoryId]: [] }));
      return [];
    }
  };

  const addProductRow = () => setProductRows(p => [...p, emptyProductRow()]);
  const removeProductRow = (i: number) => setProductRows(p => p.length === 1 ? p : p.filter((_, idx) => idx !== i));

  const handleCategoryChange = async (i: number, categoryId: number) => {
    const newRows = [...productRows];
    newRows[i] = { ...emptyProductRow(), categoryId };
    setProductRows(newRows);
    await fetchProductsForCategory(categoryId);
  };

  const handleProductChange = (i: number, productId: number) => {
    const products = productsByCategory[productRows[i].categoryId] || [];
    const p = products.find(x => x.id === productId);
    setProductRows(prev => {
      const n = [...prev];
      n[i] = {
        ...n[i],
        productId,
        unitPrice: p?.price ?? 0,
        totalPrice: (p?.price ?? 0) * n[i].quantity,
        stockWarning: p && n[i].quantity > p.availableStock ? `⚠️ Insufficient stock! Available: ${p.availableStock}` : ""
      };
      return n;
    });
  };

  const handleQuantityChange = (i: number, quantity: number) => {
    if (quantity < 1) quantity = 1;
    setProductRows(prev => {
      const n = [...prev];
      const products = productsByCategory[n[i].categoryId] || [];
      const p = products.find(x => x.id === n[i].productId);
      n[i] = {
        ...n[i],
        quantity,
        totalPrice: (p?.price ?? n[i].unitPrice) * quantity,
        stockWarning: p && quantity > p.availableStock ? `⚠️ Insufficient stock! Available: ${p.availableStock}` : ""
      };
      return n;
    });
  };

  const updateProductStock = async (categoryId: number, productId: number, newStock: number) => {
    try {
      const products = productsByCategory[categoryId] || [];
      const p = products.find(x => x.id === productId);
      if (!p) return;

      const payload = { ...p, availableStock: newStock };
      await fetch(`/v1/api/sales/category/${categoryId}/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setProductsByCategory(prev => ({
        ...prev,
        [categoryId]: prev[categoryId]?.map(prod =>
          prod.id === productId ? { ...prod, availableStock: newStock } : prod
        ) || []
      }));
    } catch { console.error("Failed to update stock"); }
  };

  const handleCreate = async () => {
    if (productRows.some(r => !r.productId)) {
      alert("Please select product for all rows.");
      return;
    }

    if (!form.salesOrderId) {
      alert("Please select a sales order.");
      return;
    }

    for (const row of productRows) {
      const products = productsByCategory[row.categoryId] || [];
      const p = products.find(x => x.id === row.productId);
      if (!p) {
        alert("Product data missing.");
        return;
      }
      if (row.quantity > p.availableStock) {
        alert(`Insufficient stock for ${p.name}. Available: ${p.availableStock}`);
        return;
      }
    }

    try {
      const selectedOrder = salesOrders.find(o => o.id === form.salesOrderId);
      if (!selectedOrder) throw new Error("Sales order not found");

      const payload = productRows.map(row => ({
        salesOrder: {
          id: form.salesOrderId,
          customer: { id: form.customerId },
          totalAmount: form.totalAmount,
          salesChannel: { id: form.salesChannelId },
          paid: form.paid
        },
        product: { id: row.productId },
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalPrice: row.totalPrice,
      }));

      const bulkRes = await fetch(`${BASE_URL}/bulk`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!bulkRes.ok) {
        for (const row of payload) {
          const res = await fetch(BASE_URL, {
            method: "POST",
            body: JSON.stringify(row)
          });
          if (!res.ok) throw new Error("Failed to create");
        }
      }

      for (const row of productRows) {
        const products = productsByCategory[row.categoryId] || [];
        const p = products.find(x => x.id === row.productId);
        if (p) {
          await updateProductStock(row.categoryId, row.productId, p.availableStock - row.quantity);
        }
      }

      await fetchAll();
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Failed to create order items");
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem?.id) return;

    const row = productRows[0];
    const products = productsByCategory[row.categoryId] || [];
    const p = products.find(x => x.id === row.productId);
    if (!p) {
      alert("Product data missing.");
      return;
    }

    const diff = row.quantity - selectedItem.quantity;
    if (diff > 0 && diff > p.availableStock) {
      alert(`Insufficient stock! Available: ${p.availableStock}`);
      return;
    }

    try {
      const payload = {
        salesOrder: {
          id: form.salesOrderId,
          customer: { id: form.customerId },
          totalAmount: form.totalAmount,
          salesChannel: { id: form.salesChannelId },
          paid: form.paid
        },
        product: { id: row.productId },
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalPrice: row.totalPrice,
      };

      const res = await fetch(`${BASE_URL}/${selectedItem.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error();

      await updateProductStock(row.categoryId, row.productId, p.availableStock - diff);
      await fetchAll();
      closeModal();
    } catch {
      alert("Failed to update order item");
    }
  };

  const promptDelete = (id?: number) => {
    if (!id) return;
    setDeletingId(id);
    setShowDeletePopup(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      const itemToDelete = items.find(i => i.id === deletingId);
      if (!itemToDelete) return;

      const res = await fetch(`${BASE_URL}/${deletingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();

      const categoryId = itemToDelete.product.category?.id;
      if (categoryId) {
        await updateProductStock(categoryId, itemToDelete.product.id, itemToDelete.product.availableStock + itemToDelete.quantity);
      }

      await fetchAll();
      setShowDeletePopup(false);
    } catch {
      alert("Failed to delete order item");
    } finally {
      setDeletingId(undefined);
      setShowDeletePopup(false);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditMode(false);
    setSelectedItem(null);
    setProductRows([emptyProductRow()]);
    setShowModal(true);
  };

  const openEdit = async (item: SalesOrderItem) => {
    const categoryId = item.product.category?.id || 0;
    setForm({
      salesOrderId: item.salesOrder.id,
      customerId: item.salesOrder.customer.id,
      totalAmount: item.salesOrder.totalAmount,
      salesChannelId: item.salesOrder.salesChannel.id,
      paid: item.salesOrder.paid
    });

    if (categoryId) {
      await fetchProductsForCategory(categoryId);
    }

    setProductRows([{
      id: Number(item.id),
      categoryId,
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      stockWarning: ""
    }]);

    setEditMode(true);
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditMode(false);
    setSelectedItem(null);
    setForm(emptyForm);
    setProductRows([emptyProductRow()]);
  };

  const columns: ColumnDef<SalesOrderItem>[] = [
    {
      key: "id", label: "ID", sortable: true,
      render: (row) => <span className="text-sm font-medium text-gray-900">#{row.id}</span>,
    },
    {
      key: "product", label: "Product", sortable: true,
      render: (row) => <span className="text-sm font-medium text-gray-900">{row.product?.name}</span>,
    },
    {
      key: "stock", label: "Stock",
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => <StockBadge stock={row.product.availableStock} />,
    },
    {
      key: "quantity", label: "Qty", sortable: true,
      className: "text-center",
      headerClassName: "text-center",
      render: (row) => <span className="text-sm font-medium text-gray-900">{row.quantity}</span>,
    },
    {
      key: "unitPrice", label: "Unit Price", sortable: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (row) => <span className="text-sm text-gray-900">₹ {row.unitPrice.toFixed(2)}</span>,
    },
    {
      key: "totalPrice", label: "Total", sortable: true,
      className: "text-right",
      headerClassName: "text-right",
      render: (row) => <span className="text-sm font-semibold text-gray-900">₹ {row.totalPrice.toFixed(2)}</span>,
    },
    {
      key: "actions", label: "Actions",
      headerClassName: "!text-right pr-8",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setViewItem(row); setShowViewModal(true); }} title="View"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <EyeIcon className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(row)} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(Number(row.id))} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Sales Order Items" description="Manage your Sales Order Items" />
      {!showModal && <PageBreadcrumb pageTitle="Sales Order Items" />}

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {showModal ? (
          /* Create/Edit Modal View */
          <div className="space-y-8">
            {/* Sales Order Info */}
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/50 p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2 mb-5">
                <span className="px-3 py-1 bg-cyan-500/10 rounded-full text-[11px] font-bold text-cyan-700 uppercase tracking-wider">
                  Step 1
                </span>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Sales Order Information
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Sales Order <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                      <BuildingStorefrontIcon className="h-5 w-5" />
                    </div>
                    <select
                      value={form.salesOrderId}
                      onChange={(e) => {
                        const order = salesOrders.find((o) => o.id === Number(e.target.value));
                        if (order) {
                          setForm({
                            ...form,
                            salesOrderId: order.id,
                            customerId: order.customer.id,
                            totalAmount: order.totalAmount,
                            salesChannelId: order.salesChannel.id,
                            paid: order.paid,
                          });
                        } else {
                          setForm({ ...form, salesOrderId: 0, customerId: 0 });
                        }
                      }}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium transition-all duration-300"
                      required
                    >
                      <option value={0}>Select Sales Order</option>
                      {salesOrders.map((o) => (
                        <option key={o.id} value={o.id}>
                          Order #{o.id} — {o.customer.name || o.customer.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Order Total Amount
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                      <CurrencyRupeeIcon className="h-5 w-5" />
                    </div>
                    <input
                      type="number"
                      value={form.totalAmount}
                      onChange={(e) => setForm({ ...form, totalAmount: Number(e.target.value) })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium transition-all duration-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Sales Channel
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-500 transition-colors">
                      <BuildingStorefrontIcon className="h-5 w-5" />
                    </div>
                    <select
                      value={form.salesChannelId}
                      onChange={(e) => setForm({ ...form, salesChannelId: Number(e.target.value) })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-medium transition-all duration-300"
                    >
                      <option value={0}>Select Channel</option>
                      {channels.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-3 px-4 py-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl cursor-pointer w-full transition-all duration-200">
                    <input
                      type="checkbox"
                      checked={form.paid}
                      onChange={(e) => setForm({ ...form, paid: e.target.checked })}
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500/30 border-slate-300 rounded transition-all cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-700">Mark as Paid</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Product Information */}
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/50 p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2 mb-5">
                <span className="px-3 py-1 bg-teal-500/10 rounded-full text-[11px] font-bold text-teal-700 uppercase tracking-wider">
                  Step 2
                </span>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Product Information
                </h4>
              </div>

              <div className="space-y-5">
                {productRows.map((row, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-slate-200/50 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative group animate-fadeIn"
                  >
                    {productRows.length > 1 && (
                      <button
                        onClick={() => removeProductRow(i)}
                        className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Remove Product"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                      <div className="col-span-12 lg:col-span-3">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                          Category
                        </label>
                        <select
                          value={row.categoryId}
                          onChange={(e) => handleCategoryChange(i, Number(e.target.value))}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-semibold transition-all duration-200"
                        >
                          <option value={0}>Select Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 lg:col-span-3">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                          Product
                        </label>
                        <select
                          value={row.productId}
                          onChange={(e) => handleProductChange(i, Number(e.target.value))}
                          disabled={!row.categoryId}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                        >
                          <option value={0}>Select Product</option>
                          {(productsByCategory[row.categoryId] || []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.availableStock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-12 lg:col-span-2">
                        <label className="block text-[10px] font-extrcabold text-slate-400 uppercase tracking-wider mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => handleQuantityChange(i, Number(e.target.value))}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 text-sm font-semibold transition-all duration-200"
                        />
                      </div>

                      <div className="col-span-12 lg:col-span-2">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                          Unit Price
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <CurrencyRupeeIcon className="h-4 w-4" />
                          </div>
                          <input
                            type="number"
                            value={row.unitPrice}
                            readOnly
                            className="w-full pl-8 pr-3 py-2.5 bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 text-sm font-semibold outline-none cursor-default"
                          />
                        </div>
                      </div>

                      <div className="col-span-12 lg:col-span-2">
                        <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                          Total Price
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-cyan-600">
                            <CurrencyRupeeIcon className="h-4 w-4" />
                          </div>
                          <input
                            type="number"
                            value={row.totalPrice}
                            readOnly
                            className="w-full pl-8 pr-3 py-2.5 bg-cyan-500/5 border border-cyan-500/20 rounded-xl text-cyan-700 font-extrabold text-sm outline-none cursor-default"
                          />
                        </div>
                      </div>

                      {row.stockWarning && (
                        <div className="col-span-12 animate-fadeIn mt-2">
                          <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold">
                            <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />
                            <span>{row.stockWarning}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={addProductRow}
                  type="button"
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-cyan-500/5 to-cyan-500/10 hover:from-cyan-500/15 hover:to-cyan-500/20 text-cyan-700 border border-cyan-500/10 rounded-xl transition-all duration-200 font-extrabold text-xs uppercase tracking-wider shadow-sm hover:shadow"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Another Product
                </button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-gradient-to-br from-cyan-500/5 via-teal-500/5 to-emerald-500/5 rounded-3xl border border-cyan-500/20 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                  <CurrencyRupeeIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    Order Value Summary
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Calculated total value of selected items</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 divide-x divide-cyan-500/10">
                <div className="px-4">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Total Items Value
                  </p>
                  <p className="text-3xl font-black text-cyan-600 tracking-tight">
                    ₹{productRows.reduce((s, r) => s + (Number(r.totalPrice) || 0), 0).toFixed(2)}
                  </p>
                </div>
                <div className="px-8">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                    Total Products
                  </p>
                  <p className="text-3xl font-black text-slate-800 tracking-tight">
                    {productRows.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3.5 pt-5 border-t border-slate-200/50">
              <button
                type="button"
                onClick={closeModal}
                className="px-6 py-3 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors font-bold text-xs uppercase tracking-wider shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={editMode ? handleUpdate : handleCreate}
                disabled={productRows.some((r) => !!r.stockWarning) || !form.salesOrderId}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 via-cyan-600 to-teal-600 hover:from-cyan-600 hover:via-cyan-700 hover:to-teal-700 text-white font-extrabold rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-600/40 transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-xs uppercase tracking-wider"
              >
                {editMode ? "Update Item" : "Create Items"}
              </button>
            </div>
          </div>
        ) : (
          /* Standard List View */
          <>
            {/* Header */}
            <div className="rounded-xl border border-gray-200 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <BackButton />
                </div>
                <AddButton label="Add Order Item" onClick={openCreate} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <StatsCard
                label="Total Items"
                value={stats.totalItems}
                gradient="from-cyan-50 to-blue-50"
                borderColor="border-cyan-100"
                labelColor="text-cyan-600"
              />
              <StatsCard
                label="Total Value"
                value={`₹${stats.totalValue.toLocaleString()}`}
                gradient="from-green-50 to-emerald-50"
                borderColor="border-green-100"
                labelColor="text-green-600"
              />
              <StatsCard
                label="Total Quantity"
                value={stats.totalQuantity}
                gradient="from-purple-50 to-pink-50"
                borderColor="border-purple-100"
                labelColor="text-purple-600"
              />
              <StatsCard
                label="Low Stock Items"
                value={stats.lowStock}
                gradient="from-yellow-50 to-orange-50"
                borderColor="border-yellow-100"
                labelColor="text-yellow-600"
              />
            </div>

            {/* Table */}
            <ReusableTable<SalesOrderItem>
              data={items}
              columns={columns}
              loading={loading}
              searchable
              searchPlaceholder="Search by customer, product, or ID..."
              pageSize={10}
              defaultSortKey="id"
              defaultSortOrder="desc"
              emptyState={
                <div className="flex flex-col items-center py-4">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingBagIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-2">No order items found</p>
                  <button onClick={openCreate} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                    Add your first order item →
                  </button>
                </div>
              }
            />
          </>
        )}
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Order Item"
        subText="Are you sure you want to delete this order item? Stock will be restored."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* View Modal */}
      <Transition show={showViewModal} as={Fragment}>
        <Dialog onClose={() => setShowViewModal(false)} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
                  <div className="flex justify-between items-center p-6 border-b">
                    <Dialog.Title className="text-xl font-semibold text-gray-900">Order Item Details</Dialog.Title>
                    <button onClick={() => setShowViewModal(false)} className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  {viewItem && (
                    <div className="p-6">
                      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4 mb-6 border border-cyan-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Item ID</span>
                          <span className="text-lg font-semibold text-gray-900">#{viewItem.id}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                            <ShoppingBagIcon className="h-4 w-4" />Order Info
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">Customer:</span>
                              <span className="font-medium text-gray-900">
                                {viewItem.salesOrder?.customer?.name || viewItem.salesOrder?.customer?.companyName || "—"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <BuildingStorefrontIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">Channel:</span>
                              <span className="font-medium text-gray-900">{viewItem.salesOrder?.salesChannel?.name || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {viewItem.salesOrder?.paid ?
                                <CheckCircleSolid className="h-4 w-4 text-green-500" /> :
                                <XCircleIcon className="h-4 w-4 text-red-500" />
                              }
                              <span className="text-gray-600">Payment:</span>
                              <span className="font-medium">{viewItem.salesOrder?.paid ? "Paid" : "Unpaid"}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                            <CubeIcon className="h-4 w-4" />Product Info
                          </h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2">
                              <CubeIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">Product:</span>
                              <span className="font-medium text-gray-900">{viewItem.product?.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <ArchiveBoxIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">Stock:</span>
                              <StockBadge stock={viewItem.product.availableStock} />
                            </div>
                            <div className="flex items-center gap-2">
                              <CurrencyRupeeIcon className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-600">Unit Price:</span>
                              <span className="font-medium text-gray-900">₹ {viewItem.unitPrice.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Quantity</p>
                              <p className="text-lg font-semibold">{viewItem.quantity}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Unit Price</p>
                              <p className="text-lg font-semibold">₹ {viewItem.unitPrice.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Total</p>
                              <p className="text-lg font-semibold text-cyan-600">₹ {viewItem.totalPrice.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end">
                    <button
                      onClick={() => setShowViewModal(false)}
                      className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}