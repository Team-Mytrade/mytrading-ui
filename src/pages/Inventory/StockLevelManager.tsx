import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    PencilSquareIcon,
    TrashIcon,
    FunnelIcon,
    BuildingOfficeIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CubeIcon,
    PrinterIcon,
    ChartBarIcon,
    ExclamationTriangleIcon,
    CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AddButton } from "../../components/common/AddButton";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";

interface Product {
    id: number;
    name: string;
    sku?: string;
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

interface StockLevelRow extends StockLevel {
    productName: string;
    productSku: string;
    warehouseName: string;
    warehouseCode: string;
    statusLabel: string;
}

const API_URL = "/v1/api/inventory";
const PAGE_SIZE = 10;

const StockLevelsManager: React.FC = () => {
    const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [productFilter, setProductFilter] = useState<string>("");
    const [warehouseFilter, setWarehouseFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Low Stock" | "Medium Stock" | "Healthy Stock">("All");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedStock, setSelectedStock] = useState<StockLevel | null>(null);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deletingStock, setDeletingStock] = useState<StockLevel | null>(null);

    const [form, setForm] = useState({
        quantity: "",
        reserved: "",
        available: "",
        productId: "",
        warehouseId: "",
    });

    useEffect(() => {
        fetchStockLevels();
        fetchProducts();
        fetchWarehouses();
    }, []);

    const fetchStockLevels = async () => {
        try {
            const response = await axios.get(`${API_URL}/stock-levels`);
            setStockLevels(response.data);
        } catch (err) {
            console.error("Failed to load stock levels", err);
            ToasterService.error("Failed to load stock levels");
            setStockLevels([]);
        }
    };

    const fetchProducts = async () => {
        try {
            const response = await axios.get(`${API_URL}/products`);
            setProducts(response.data);
        } catch (err) {
            console.error("Failed to load products", err);
            ToasterService.error("Failed to load products");
            setProducts([]);
        }
    };

    const fetchWarehouses = async () => {
        try {
            const response = await axios.get(`${API_URL}/warehouses`);
            setWarehouses(response.data);
        } catch (err) {
            console.error("Failed to load warehouses", err);
            ToasterService.error("Failed to load warehouses");
            setWarehouses([]);
        }
    };

    const clearForm = () => {
        setForm({
            quantity: "",
            reserved: "",
            available: "",
            productId: "",
            warehouseId: "",
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleChange = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const buildPayload = () => ({
        quantity: Number(form.quantity),
        reserved: Number(form.reserved),
        available: Number(form.available),
        product: form.productId ? { id: Number(form.productId) } : null,
        warehouse: form.warehouseId ? { id: Number(form.warehouseId) } : null,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Auto-calculate available if not manually set
        let available = Number(form.available);
        if (!form.available) {
            available = Number(form.quantity) - Number(form.reserved);
        }

        const payload = {
            ...buildPayload(),
            available,
        };

        try {
            if (editingId) {
                await axios.put(`${API_URL}/stock-levels/${editingId}`, payload);
                ToasterService.success("Stock level updated successfully");
            } else {
                await axios.post(`${API_URL}/stock-levels`, payload);
                ToasterService.success("Stock level created successfully");
            }
            await fetchStockLevels();
            clearForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleEdit = (stock: StockLevel) => {
        setEditingId(stock.id);
        setForm({
            quantity: stock.quantity?.toString() || "",
            reserved: stock.reserved?.toString() || "",
            available: stock.available?.toString() || "",
            productId: stock.product?.id?.toString() || "",
            warehouseId: stock.warehouse?.id?.toString() || "",
        });
        setShowForm(true);
    };

    const confirmDelete = async () => {
        if (!deletingStock) return;
        try {
            await axios.delete(`${API_URL}/stock-levels/${deletingStock.id}`);
            ToasterService.success("Stock level deleted successfully");
            await fetchStockLevels();
            setShowDeletePopup(false);
            setDeletingStock(null);
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const promptDelete = (stock: StockLevel) => {
        setDeletingStock(stock);
        setShowDeletePopup(true);
    };

    const openCreateStockLevel = () => {
        clearForm();
        setShowForm(true);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Stock Levels Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Records: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Product", "Warehouse", "Total Qty", "Reserved", "Available", "Status"]],
            body: filtered.map(s => {
                const status = getStockStatus(s.available, s.quantity);
                return [
                    s.product?.name || "-",
                    s.warehouse?.name || "-",
                    s.quantity.toString(),
                    s.reserved.toString(),
                    s.available.toString(),
                    status.label,
                ];
            }),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Stock_Levels_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(s => {
            const status = getStockStatus(s.available, s.quantity);
            return {
                'Product': s.product?.name || "-",
                'Product SKU': s.product?.sku || "-",
                'Warehouse': s.warehouse?.name || "-",
                'Warehouse Code': s.warehouse?.code || "-",
                'Total Quantity': s.quantity,
                'Reserved Quantity': s.reserved,
                'Available Quantity': s.available,
                'Stock Status': status.label,
                'Utilization Rate': `${Math.round((s.reserved / s.quantity) * 100)}%`,
                'Last Updated': s.updatedAt ? new Date(s.updatedAt).toLocaleDateString() : "",
            };
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Levels");
        XLSX.writeFile(wb, `Stock_Levels_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const getStockStatus = (available: number, quantity: number) => {
        if (quantity === 0) return { color: "bg-gray-100 text-gray-600", label: "No Stock", icon: <XCircleIcon className="h-3 w-3 mr-1" /> };
        const percentage = (available / quantity) * 100;
        if (percentage <= 20) return { color: "bg-red-100 text-red-800", label: "Low Stock", icon: <ExclamationTriangleIcon className="h-3 w-3 mr-1" /> };
        if (percentage <= 50) return { color: "bg-yellow-100 text-yellow-800", label: "Medium Stock", icon: <ChartBarIcon className="h-3 w-3 mr-1" /> };
        return { color: "bg-green-100 text-green-800", label: "Healthy Stock", icon: <CheckBadgeIcon className="h-3 w-3 mr-1" /> };
    };

    const filtered = stockLevels.filter((s) => {
        const matchesProduct = productFilter ? s.product?.name === productFilter : true;
        const matchesWarehouse = warehouseFilter ? s.warehouse?.name === warehouseFilter : true;
        
        let matchesStatus = true;
        if (statusFilter !== "All") {
            const status = getStockStatus(s.available, s.quantity);
            matchesStatus = status.label === statusFilter;
        }
        
        return matchesProduct && matchesWarehouse && matchesStatus;
    });

    // Calculate stats from real data
    const totalStock = stockLevels.reduce((sum, s) => sum + s.quantity, 0);
    const totalReserved = stockLevels.reduce((sum, s) => sum + s.reserved, 0);
    const totalAvailable = stockLevels.reduce((sum, s) => sum + s.available, 0);
    const lowStockCount = stockLevels.filter(s => {
        if (s.quantity === 0) return true;
        const percentage = (s.available / s.quantity) * 100;
        return percentage <= 20;
    }).length;

    // Get unique values for filters
    const uniqueProducts = [...new Set(stockLevels.map(s => s.product?.name).filter(Boolean))];
    const uniqueWarehouses = [...new Set(stockLevels.map(s => s.warehouse?.name).filter(Boolean))];

    const tableData: StockLevelRow[] = filtered.map((stock) => {
        const status = getStockStatus(stock.available, stock.quantity);
        return {
            ...stock,
            productName: String(stock.product?.name ?? ""),
            productSku: String(stock.product?.sku ?? ""),
            warehouseName: String(stock.warehouse?.name ?? ""),
            warehouseCode: String(stock.warehouse?.code ?? ""),
            statusLabel: status.label,
        };
    });

    const columns: ColumnDef<StockLevelRow>[] = [
        {
            key: "productName",
            label: "Product",
            sortable: true,
            render: (stock) => (
                <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                        <CubeIcon className="h-3.5 w-3.5 text-cyan-600" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900 leading-tight">
                            {stock.product?.name || "N/A"}
                        </div>
                        {stock.product?.sku && (
                            <div className="text-xs text-gray-500 mt-0.5">SKU: {stock.product.sku}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: "warehouseName",
            label: "Warehouse",
            sortable: true,
            render: (stock) => (
                <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                        <div className="text-sm text-gray-900">{stock.warehouse?.name || "N/A"}</div>
                        {stock.warehouse?.code && (
                            <div className="text-xs text-gray-500">{stock.warehouse.code}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: "quantity",
            label: "Total Qty",
            sortable: true,
            render: (stock) => (
                <span className="text-sm font-medium text-gray-900">{stock.quantity}</span>
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
            key: "statusLabel",
            label: "Status",
            sortable: true,
            render: (stock) => {
                const status = getStockStatus(stock.available, stock.quantity);
                return (
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${status.color}`}>
                        {status.icon}
                        {status.label}
                    </span>
                );
            },
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (stock) => (
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedStock(stock);
                            setViewModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="View Details"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleEdit(stock)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                        title="Edit Stock Level"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => promptDelete(stock)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        title="Delete Stock Level"
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
            <PageBreadcrumb pageTitle="Stock Levels Manager" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton onClick={openCreateStockLevel} label="Add Stock Level" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatsCard label="Total Stock" value={totalStock.toLocaleString()} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
                    <StatsCard label="Available Stock" value={totalAvailable.toLocaleString()} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
                    <StatsCard label="Reserved Stock" value={totalReserved.toLocaleString()} gradient="from-yellow-50 to-amber-50" borderColor="border-yellow-100" labelColor="text-yellow-700" />
                    <StatsCard label="Low Stock Items" value={lowStockCount} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                                <select
                                    value={productFilter}
                                    onChange={e => setProductFilter(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Products</option>
                                    {uniqueProducts.map(product => (
                                        <option key={product} value={product}>{product}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                                <select
                                    value={warehouseFilter}
                                    onChange={e => setWarehouseFilter(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Warehouses</option>
                                    {uniqueWarehouses.map(warehouse => (
                                        <option key={warehouse} value={warehouse}>{warehouse}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value as any)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Low Stock">Low Stock</option>
                                    <option value="Medium Stock">Medium Stock</option>
                                    <option value="Healthy Stock">Healthy Stock</option>
                                </select>
                            </div>
                            {(productFilter || warehouseFilter || statusFilter !== "All") && (
                                <button
                                    onClick={() => {
                                        setProductFilter("");
                                        setWarehouseFilter("");
                                        setStatusFilter("All");
                                    }}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Stock Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={clearForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                {editingId ? "Edit Stock Level" : "Add Stock Level"}
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Product</label>
                                                    <select
                                                        value={form.productId}
                                                        onChange={e => handleChange("productId", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="">Select Product</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Warehouse</label>
                                                    <select
                                                        value={form.warehouseId}
                                                        onChange={e => handleChange("warehouseId", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="">Select Warehouse</option>
                                                        {warehouses.map(w => (
                                                            <option key={w.id} value={w.id}>{w.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Total Quantity</label>
                                                        <input
                                                            type="number"
                                                            value={form.quantity}
                                                            onChange={e => {
                                                                handleChange("quantity", e.target.value);
                                                                // Auto-calculate available if not manually set
                                                                if (!form.available && form.reserved) {
                                                                    const available = Number(e.target.value) - Number(form.reserved);
                                                                    handleChange("available", available.toString());
                                                                }
                                                            }}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="0"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Reserved Quantity</label>
                                                        <input
                                                            type="number"
                                                            value={form.reserved}
                                                            onChange={e => {
                                                                handleChange("reserved", e.target.value);
                                                                // Auto-calculate available if not manually set
                                                                if (!form.available && form.quantity) {
                                                                    const available = Number(form.quantity) - Number(e.target.value);
                                                                    handleChange("available", available.toString());
                                                                }
                                                            }}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="0"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Available Quantity</label>
                                                    <input
                                                        type="number"
                                                        value={form.available}
                                                        onChange={e => handleChange("available", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        min="0"
                                                        placeholder="Auto-calculated if left empty"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Leave empty to auto-calculate from Total - Reserved</p>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        onClick={handleSubmit}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {editingId ? "Update" : "Create"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearForm}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!showForm && (
                    <ReusableTable<StockLevelRow>
                        data={tableData}
                        columns={columns}
                        searchable
                        searchPlaceholder="Search by product, SKU, or warehouse..."
                        searchFields={["productName", "productSku", "warehouseName", "warehouseCode", "statusLabel"]}
                        pageSize={PAGE_SIZE}
                        defaultSortKey="available"
                        toolbar={
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                        disabled={stockLevels.length === 0}
                                    >
                                        <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                            <button onClick={exportPDF} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                                                <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                                Export PDF
                                            </button>
                                            <button onClick={exportExcel} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50">
                                                <TableCellsIcon className="h-4 w-4 text-green-600" />
                                                Export Excel
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => window.print()} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors" disabled={stockLevels.length === 0}>
                                    <PrinterIcon className="h-5 w-5 text-gray-600" />
                                </button>
                                <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border ${showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"}`}>
                                    <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
                                </button>
                                <button onClick={fetchStockLevels} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                                    <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        }
                        emptyState={
                            <div className="flex flex-col items-center py-4">
                                <div className="h-14 w-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                    <CubeIcon className="h-7 w-7 text-gray-400" />
                                </div>
                                <p className="text-gray-500 text-sm font-medium mb-1.5">No stock levels found</p>
                                <button onClick={openCreateStockLevel} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                                    Add your first stock level
                                </button>
                            </div>
                        }
                    />
                )}

                {/* View Details Modal */}
                {viewModalOpen && selectedStock && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Stock Level Details
                                                </h3>
                                                <button
                                                    onClick={() => setViewModalOpen(false)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Product</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedStock.product?.name || "N/A"}</p>
                                                        {selectedStock.product?.sku && (
                                                            <p className="text-xs text-gray-500 mt-1">SKU: {selectedStock.product.sku}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Warehouse</p>
                                                        <p className="text-sm text-gray-700">{selectedStock.warehouse?.name || "N/A"}</p>
                                                        {selectedStock.warehouse?.code && (
                                                            <p className="text-xs text-gray-500 mt-1">Code: {selectedStock.warehouse.code}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Total Quantity</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedStock.quantity}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Reserved Quantity</p>
                                                        <p className="text-sm text-yellow-600">{selectedStock.reserved}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Available Quantity</p>
                                                        <p className="text-sm font-bold text-green-600">{selectedStock.available}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Utilization Rate</p>
                                                        <p className="text-sm text-gray-700">
                                                            {selectedStock.quantity > 0 
                                                                ? `${Math.round((selectedStock.reserved / selectedStock.quantity) * 100)}%`
                                                                : "0%"}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">Stock Status</p>
                                                        <div className="mt-1">
                                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStockStatus(selectedStock.available, selectedStock.quantity).color}`}>
                                                                {getStockStatus(selectedStock.available, selectedStock.quantity).icon}
                                                                {getStockStatus(selectedStock.available, selectedStock.quantity).label}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {selectedStock.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Last Updated</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedStock.updatedAt || selectedStock.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {getStockStatus(selectedStock.available, selectedStock.quantity).label === "Low Stock" && (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800">
                                                        <strong>Low Stock Alert:</strong> This item has low stock levels. Consider replenishing soon.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewModalOpen(false);
                                            handleEdit(selectedStock);
                                        }}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        <PencilSquareIcon className="h-4 w-4 mr-2" />
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:w-auto sm:text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DynamicPopup
                    isPopupOpen={showDeletePopup}
                    setIsPopupOpen={setShowDeletePopup}
                    icon={<TrashIcon className="h-6 w-6 text-red-600" />}
                    iconBg="bg-red-100"
                    innerText="Delete Stock Level"
                    subText={deletingStock ? `Are you sure you want to delete stock level for "${deletingStock.product?.name || "this item"}" at "${deletingStock.warehouse?.name || "this warehouse"}"? This action cannot be undone.` : "Are you sure you want to delete this stock level?"}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={confirmDelete}
                    onCancel={() => setDeletingStock(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default StockLevelsManager;

