import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BuildingOfficeIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { ListingPdfExportButton } from "../../components/common/export";
import FilterPopover from "../../components/common/filter";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import DynamicPopup from "../../components/common/Popup";
import PaginatedPopup from "../../components/common/unpopup";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

interface Product {
  id: number;
  productName: string;
  productSku?: string;
}

interface Warehouse {
  id: number;
  name: string;
  code?: string;
}

interface StockLevel {
  id: number;
  quantity: number;
  reserved: number;
  available: number;
  product?: Product;
  warehouse?: Warehouse;
  createdAt?: string;
  updatedAt?: string;
}

type StockLevelForm = {
  quantity: string;
  reserved: string;
  productId: string;
  warehouseId: string;
};

const API_URL = "/v1/api/inventory";
const PRODUCT_URL = "/v1/api/purchase/products";
const PAGE_SIZE = 10;

const emptyForm: StockLevelForm = {
  quantity: "",
  reserved: "",
  productId: "",
  warehouseId: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function getStockStatus(available: number, quantity: number) {
  if (quantity === 0) return { color: "bg-gray-50 text-gray-600 border-gray-200", label: "No Stock", icon: <XCircleIcon className="h-3 w-3 mr-1" /> };
  const percentage = (available / quantity) * 100;
  if (percentage <= 20) return { color: "bg-red-50 text-red-700 border-red-200", label: "Low Stock", icon: <ExclamationTriangleIcon className="h-3 w-3 mr-1" /> };
  if (percentage <= 50) return { color: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Medium Stock", icon: <ChartBarIcon className="h-3 w-3 mr-1" /> };
  return { color: "bg-green-50 text-green-700 border-green-200", label: "Healthy Stock", icon: <CheckBadgeIcon className="h-3 w-3 mr-1" /> };
}

// Helper function to generate stock details as string for DynamicPopup
function getStockDetailsText(stock: StockLevel): string {
  if (!stock) return "No stock details available";
  
  const status = getStockStatus(stock.available, stock.quantity);
  const utilization = stock.quantity > 0 
    ? `${Math.round((stock.reserved / stock.quantity) * 100)}%` 
    : "0%";
  
  let details = `Product: ${stock.product?.productName || "N/A"}`;
  if (stock.product?.productSku) {
    details += `\nSKU: ${stock.product.productSku}`;
  }
  details += `\nWarehouse: ${stock.warehouse?.name || "N/A"}`;
  if (stock.warehouse?.code) {
    details += ` (${stock.warehouse.code})`;
  }
  details += `\n\nTotal Quantity: ${stock.quantity}`;
  details += `\nReserved: ${stock.reserved}`;
  details += `\nAvailable: ${stock.available}`;
  details += `\nUtilization: ${utilization}`;
  details += `\nStatus: ${status.label}`;
  if (stock.updatedAt) {
    details += `\nLast Updated: ${new Date(stock.updatedAt).toLocaleString()}`;
  }
  if (status.label === "Low Stock") {
    details += `\n\n⚠️ Low Stock Alert: This item has low stock levels. Consider replenishing soon.`;
  }
  
  return details;
}

const StockLevelsManager: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<StockLevelForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [originalQuantity, setOriginalQuantity] = useState(0);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProductId, setFilterProductId] = useState("");
  const [filterWarehouseId, setFilterWarehouseId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [deletingStock, setDeletingStock] = useState<StockLevel | null>(null);
  const [viewingStock, setViewingStock] = useState<StockLevel | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchStockLevels();
    fetchProducts();
    fetchWarehouses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStockLevels = async () => {
    try {
      setLoading(true);
      const res = await axios.get<StockLevel[]>(`${API_URL}/stock-levels`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setStockLevels(data);
      if (data.length === 0) ToasterService.noData("No stock levels found");
    } catch (error) {
      ToasterService.error("Failed to load stock levels", getErrorMessage(error, "Please try again."));
      setStockLevels([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get<Product[]>(PRODUCT_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setProducts(data);
    } catch (error) {
      ToasterService.error("Failed to load products", getErrorMessage(error, "Please try again."));
    }
  };

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get<Warehouse[]>(`${API_URL}/warehouses`, { headers });
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.content || (res.data as any)?.data || [];
      setWarehouses(data);
    } catch (error) {
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const computedAvailable = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const reserved = Number(form.reserved) || 0;
    return Math.max(quantity - reserved, 0);
  }, [form.quantity, form.reserved]);

  const buildPayload = () => {
    const desiredQuantity = Number(form.quantity) || 0;
    const desiredReserved = Number(form.reserved) || 0;
    const productId = Number(form.productId) || 0;

    return {
      id: editingId || 0,
      quantity: editingId ? desiredQuantity - originalQuantity : desiredQuantity,
      reserved: desiredReserved,
      available: computedAvailable,
      productId,
      warehouse: { id: Number(form.warehouseId) },
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const quantity = Number(form.quantity) || 0;
    const reserved = Number(form.reserved) || 0;

    if (quantity <= 0) {
      ToasterService.error("Invalid quantity", "Quantity must be greater than 0.");
      return;
    }
    if (reserved < 0) {
      ToasterService.error("Invalid reserved", "Reserved quantity cannot be negative.");
      return;
    }
    if (reserved > quantity) {
      ToasterService.error("Invalid reserved", "Reserved quantity cannot exceed total quantity.");
      return;
    }
    if (!form.productId) {
      ToasterService.error("Required field missing", "Product selection is required.");
      return;
    }
    if (!form.warehouseId) {
      ToasterService.error("Required field missing", "Warehouse selection is required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const quantityDelta = editingId ? quantity - originalQuantity : quantity;
      
      if (editingId) {
        await axios.put(`${API_URL}/stock-levels/${editingId}?delta=${quantityDelta}`, payload, { headers });
        ToasterService.success("Stock level updated");
      } else {
        await axios.post(`${API_URL}/stock-levels`, payload, { headers });
        ToasterService.success("Stock level created");
      }
      
      closeForm();
      fetchStockLevels();
    } catch (error) {
      ToasterService.error("Failed to save stock level", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setOriginalQuantity(0);
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (stock: StockLevel) => {
    setEditingId(stock.id);
    setOriginalQuantity(stock.quantity || 0);
    setForm({
      quantity: String(stock.quantity || 0),
      reserved: String(stock.reserved || 0),
      productId: String(stock.product?.id || ""),
      warehouseId: String(stock.warehouse?.id || ""),
    });
    setShowFormModal(true);
  };

  const openView = (stock: StockLevel) => {
    setViewingStock(stock);
    setShowViewModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setOriginalQuantity(0);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deletingStock) return;

    try {
      await axios.delete(`${API_URL}/stock-levels/${deletingStock.id}`, { headers });
      ToasterService.success("Stock level deleted");
      setStockLevels((current) => current.filter((item) => item.id !== deletingStock.id));
    } catch (error) {
      ToasterService.error("Failed to delete stock level", getErrorMessage(error, "Please try again."));
    } finally {
      setDeletingStock(null);
    }
  };

  const filteredStockLevels = useMemo(() => {
    const term = searchableText(search);

    return stockLevels.filter((stock) => {
      if (filterProductId && String(stock.product?.id || "") !== filterProductId) return false;
      if (filterWarehouseId && String(stock.warehouse?.id || "") !== filterWarehouseId) return false;
      
      const status = getStockStatus(stock.available, stock.quantity);
      if (filterStatus && status.label !== filterStatus) return false;

      if (!term) return true;

      const haystack = [
        stock.product?.productName,
        stock.product?.productSku,
        stock.warehouse?.name,
        stock.warehouse?.code,
        stock.quantity,
        stock.reserved,
        stock.available,
        status.label,
        stock.id,
      ]
        .map(searchableText)
        .filter(Boolean)
        .join(" ");

      return haystack.includes(term);
    });
  }, [stockLevels, search, filterProductId, filterWarehouseId, filterStatus]);

  const resetFilters = () => {
    setFilterProductId("");
    setFilterWarehouseId("");
    setFilterStatus("");
  };

  const stats = useMemo(
    () => ({
      totalStock: stockLevels.reduce((sum, s) => sum + s.quantity, 0),
      totalAvailable: stockLevels.reduce((sum, s) => sum + s.available, 0),
      totalReserved: stockLevels.reduce((sum, s) => sum + s.reserved, 0),
      lowStockCount: stockLevels.filter(s => {
        if (s.quantity === 0) return true;
        const percentage = (s.available / s.quantity) * 100;
        return percentage <= 20;
      }).length,
    }),
    [stockLevels]
  );

  const productOptions = useMemo(() => {
    return products.map((product) => ({
      id: String(product.id),
      name: product.productName,
    }));
  }, [products]);

  const warehouseOptions = useMemo(() => {
    return warehouses.map((warehouse) => ({
      id: String(warehouse.id),
      name: warehouse.code ? `${warehouse.name} (${warehouse.code})` : warehouse.name,
    }));
  }, [warehouses]);

  const statusOptions = useMemo(() => {
    return [
      { id: "Low Stock", name: "Low Stock" },
      { id: "Medium Stock", name: "Medium Stock" },
      { id: "Healthy Stock", name: "Healthy Stock" },
    ];
  }, []);

  const columns: ColumnDef<StockLevel>[] = [
    {
      key: "product",
      label: "Product",
      sortable: true,
      sortValueGetter: (stock) => stock.product?.productName || "",
      render: (stock) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
            <CubeIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {stock.product?.productName || "N/A"}
            </div>
            {stock.product?.productSku && (
              <div className="text-xs text-slate-500">SKU: {stock.product.productSku}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "warehouse",
      label: "Warehouse",
      sortable: true,
      sortValueGetter: (stock) => stock.warehouse?.name || "",
      render: (stock) => (
        <div className="flex items-center gap-2">
          <BuildingOfficeIcon className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-700">
            {stock.warehouse?.name || "N/A"}
          </span>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "Total Qty",
      sortable: true,
      render: (stock) => (
        <span className="text-sm font-medium text-slate-900">{stock.quantity}</span>
      ),
    },
    {
      key: "reserved",
      label: "Reserved",
      sortable: true,
      render: (stock) => (
        <span className="text-sm text-yellow-600">{stock.reserved}</span>
      ),
    },
    {
      key: "available",
      label: "Available",
      sortable: true,
      render: (stock) => (
        <span className="text-sm font-bold text-green-600">{stock.available}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      sortValueGetter: (stock) => getStockStatus(stock.available, stock.quantity).label,
      render: (stock) => {
        const status = getStockStatus(stock.available, stock.quantity);
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border ${status.color}`}>
            {status.icon}
            {status.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (stock) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openView(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
            title="View Details"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => openEdit(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeletingStock(stock)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Stock Levels" description="Monitor and manage inventory stock levels" />
      <PageBreadcrumb pageTitle="Stock Levels" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Stock Level" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Stock"
            value={stats.totalStock.toLocaleString()}
            icon={<CubeIcon />}
          />
          <StatsCard
            label="Available Stock"
            value={stats.totalAvailable.toLocaleString()}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckBadgeIcon />}
          />
          <StatsCard
            label="Reserved Stock"
            value={stats.totalReserved.toLocaleString()}
            gradient="from-yellow-50 to-amber-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-700"
            icon={<ChartBarIcon />}
          />
          <StatsCard
            label="Low Stock Items"
            value={stats.lowStockCount}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<ExclamationTriangleIcon />}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product, SKU, or warehouse..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ListingPdfExportButton
              title="Stock Levels"
              subtitle="Filtered stock level listing"
              reportLabel="Stock Levels Report"
              data={filteredStockLevels}
              fileName="Stock_Levels"
              disabled={loading}
              metadata={(rows) => [
                { label: "Total", value: rows.length },
                { label: "Search", value: search || "None" },
                { label: "Total Stock", value: rows.reduce((sum, s) => sum + s.quantity, 0) },
              ]}
              columns={[
                { key: "product", header: "Product" },
                { key: "warehouse", header: "Warehouse" },
                { key: "quantity", header: "Total Qty" },
                { key: "reserved", header: "Reserved" },
                { key: "available", header: "Available" },
                { key: "status", header: "Status" },
              ]}
            />
            <FilterPopover
              title="Filter Stock Levels"
              buttonLabel="Filters"
              widthClassName="w-[21rem] sm:w-[23rem]"
              showFooter={false}
            >
              <div className="space-y-3">
                <FloatingSelect
                  label="Product"
                  name="filterProductId"
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  options={productOptions}
                />
                <FloatingSelect
                  label="Warehouse"
                  name="filterWarehouseId"
                  value={filterWarehouseId}
                  onChange={(e) => setFilterWarehouseId(e.target.value)}
                  options={warehouseOptions}
                />
                <FloatingSelect
                  label="Stock Status"
                  name="filterStatus"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  options={statusOptions}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredStockLevels}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="available"
          defaultSortOrder="desc"
          onRowClick={openView}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CubeIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No stock levels found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first stock level
              </button>
            </div>
          }
        />
      </div>

      {/* Form Modal */}
      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Stock Level" : "Add Stock Level"}
        subtitle="Enter stock level details"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Stock Level" : "Create Stock Level"}
        tabs={[
          {
            label: "Details",
            fields: [
              <FloatingSelect
                key="productId"
                label="Product"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                options={productOptions}
                required
              />,
              <FloatingSelect
                key="warehouseId"
                label="Warehouse"
                name="warehouseId"
                value={form.warehouseId}
                onChange={handleChange}
                options={warehouseOptions}
                required
              />,
            ],
          },
          {
            label: "Quantities",
            fields: [
              <FloatingInput
                key="quantity"
                label="Total Quantity"
                name="quantity"
                type="number"
                value={form.quantity}
                onChange={handleChange}
                required
              />,
              <FloatingInput
                key="reserved"
                label="Reserved Quantity"
                name="reserved"
                type="number"
                value={form.reserved}
                onChange={handleChange}
                required
              />,
              <div key="available" className="relative">
                <FloatingInput
                  label="Available Quantity"
                  name="available"
                  type="number"
                  value={computedAvailable}
                  onChange={() => {}}
                  disabled
                />
                <p className="mt-1 text-xs text-gray-500">
                  Automatically calculated as Total Quantity − Reserved Quantity
                </p>
              </div>,
            ],
          },
        ]}
      />

      {/* View Details Modal */}
      <DynamicPopup
        isPopupOpen={showViewModal && !!viewingStock}
        setIsPopupOpen={(open: boolean) => {
          if (!open) {
            setShowViewModal(false);
            setViewingStock(null);
          }
        }}
        icon={<CubeIcon className="h-6 w-6 text-cyan-600" />}
        iconBg="bg-cyan-100"
        innerText="Stock Level Details"
        subText={viewingStock ? getStockDetailsText(viewingStock) : "No stock details available"}
        confirmLabel="Edit"
        cancelLabel="Close"
        onConfirm={() => {
          if (viewingStock) {
            setShowViewModal(false);
            openEdit(viewingStock);
          }
        }}
        onCancel={() => {
          setShowViewModal(false);
          setViewingStock(null);
        }}
        confirmBtnClass="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white"
      />

      {/* Delete Confirmation Modal */}
      <DynamicPopup
        isPopupOpen={!!deletingStock}
        setIsPopupOpen={(open: boolean) => {
          if (!open) setDeletingStock(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Stock Level"
        subText={
          deletingStock
            ? `Are you sure you want to delete the stock level for "${deletingStock.product?.productName || "this item"}" at "${deletingStock.warehouse?.name || "this warehouse"}"? This action cannot be undone.`
            : "Are you sure you want to delete this stock level?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeletingStock(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default StockLevelsManager;