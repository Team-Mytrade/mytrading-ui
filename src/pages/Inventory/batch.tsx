import React, { useEffect, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    PencilSquareIcon,
    TrashIcon,
    FunnelIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    HomeIcon,
    CalendarIcon,
    PrinterIcon,
    BeakerIcon,
    ExclamationTriangleIcon,
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
    location?: string;
}

interface Batch {
    id: number;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    product?: Product;
    warehouse?: Warehouse;
    quantity?: number;
    createdAt?: string;
    updatedAt?: string;
}

interface BatchRow extends Batch {
    productName: string;
    warehouseName: string;
    statusLabel: string;
    manufacturingDateLabel: string;
    expiryDateLabel: string;
}

const API_URL = "/v1/api/inventory";
const PAGE_SIZE = 10;

const BatchManager: React.FC = () => {
    const [batches, setBatches] = useState<Batch[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [productFilter, setProductFilter] = useState<string>("");
    const [warehouseFilter, setWarehouseFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);

    const [form, setForm] = useState({
        batchNumber: "",
        manufacturingDate: "",
        expiryDate: "",
        productId: "",
        warehouseId: "",
        quantity: 0,
    });

    useEffect(() => {
        fetchBatches();
        fetchProducts();
        fetchWarehouses();
    }, []);

    const fetchBatches = async () => {
        try {
            const response = await axios.get(`${API_URL}/batches`);
            setBatches(response.data);
        } catch (err) {
            console.error("Failed to load batches", err);
            ToasterService.error("Failed to load batches");
            setBatches([]);
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
            batchNumber: "",
            manufacturingDate: "",
            expiryDate: "",
            productId: "",
            warehouseId: "",
            quantity: 0,
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleChange = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const buildPayload = () => ({
        id: editingId || 0,
        batchNumber: form.batchNumber,
        manufacturingDate: form.manufacturingDate,
        expiryDate: form.expiryDate,
        productId: Number(form.productId) || 0,
        warehouse: form.warehouseId
            ? {
                id: Number(form.warehouseId),
                name: warehouses.find((item) => item.id === Number(form.warehouseId))?.name || "",
                code: warehouses.find((item) => item.id === Number(form.warehouseId))?.code || "",
            }
            : null,
        inspections: [],
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (editingId) {
                await axios.put(`${API_URL}/batches/${editingId}`, buildPayload());
                ToasterService.success("Batch updated successfully");
            } else {
                await axios.post(`${API_URL}/batches`, buildPayload());
                ToasterService.success("Batch created successfully");
            }
            await fetchBatches();
            clearForm();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleEdit = (batch: Batch) => {
        setEditingId(batch.id);
        setForm({
            batchNumber: batch.batchNumber,
            manufacturingDate: batch.manufacturingDate.split('T')[0],
            expiryDate: batch.expiryDate.split('T')[0],
            productId: batch.product?.id?.toString() || "",
            warehouseId: batch.warehouse?.id?.toString() || "",
            quantity: batch.quantity || 0,
        });
        setShowForm(true);
    };

    const confirmDelete = async () => {
        if (!deletingBatch) return;
        try {
            await axios.delete(`${API_URL}/batches/${deletingBatch.id}`);
            ToasterService.success("Batch deleted successfully");
            await fetchBatches();
            setShowDeletePopup(false);
            setDeletingBatch(null);
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const promptDelete = (batch: Batch) => {
        setDeletingBatch(batch);
        setShowDeletePopup(true);
    };

    const openCreateBatch = () => {
        clearForm();
        setShowForm(true);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Batches Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Batches: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Batch Number", "Product", "Warehouse", "Mfg Date", "Expiry Date", "Status", "Quantity"]],
            body: filtered.map(b => [
                b.batchNumber,
                b.product?.name || "-",
                b.warehouse?.name || "-",
                new Date(b.manufacturingDate).toLocaleDateString(),
                new Date(b.expiryDate).toLocaleDateString(),
                new Date(b.expiryDate) < new Date() ? "Expired" : "Active",
                b.quantity?.toString() || "-",
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Batches_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(b => ({
            'Batch Number': b.batchNumber,
            'Product': b.product?.name || "-",
            'Warehouse': b.warehouse?.name || "-",
            'Manufacturing Date': new Date(b.manufacturingDate).toLocaleDateString(),
            'Expiry Date': new Date(b.expiryDate).toLocaleDateString(),
            'Status': new Date(b.expiryDate) < new Date() ? "Expired" : "Active",
            'Quantity': b.quantity || "-",
            'Created At': b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Batches");
        XLSX.writeFile(wb, `Batches_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = batches.filter((b) => {
        const matchesProduct = productFilter ? b.product?.name === productFilter : true;
        const matchesWarehouse = warehouseFilter ? b.warehouse?.name === warehouseFilter : true;
        return matchesProduct && matchesWarehouse;
    });

    // Calculate stats from real data
    const totalBatches = batches.length;
    const expiredBatches = batches.filter(b => new Date(b.expiryDate) < new Date()).length;
    const expiringSoon = batches.filter(b => {
        const expiry = new Date(b.expiryDate);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }).length;
    const totalQuantity = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);

    // Get unique values for filters
    const uniqueProducts = [...new Set(batches.map(b => b.product?.name).filter(Boolean))];
    const uniqueWarehouses = [...new Set(batches.map(b => b.warehouse?.name).filter(Boolean))];

    // Status badge component
    const getStatusBadge = (expiryDate: string) => {
        const expiry = new Date(expiryDate);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

        if (expiry < today) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-red-100 text-red-800">
                    <XCircleIcon className="h-3 w-3 mr-1" />
                    Expired
                </span>
            );
        } else if (daysUntilExpiry <= 30) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-yellow-100 text-yellow-800">
                    <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                    Expiring Soon
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-green-100 text-green-800">
                <CheckCircleIcon className="h-3 w-3 mr-1" />
                Active
            </span>
        );
    };

    const getBatchStatus = (expiryDate: string) => {
        const expiry = new Date(expiryDate);
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24));

        if (expiry < today) return "Expired";
        if (daysUntilExpiry <= 30) return "Expiring Soon";
        return "Active";
    };

    const tableData: BatchRow[] = filtered.map((batch) => ({
        ...batch,
        productName: String(batch.product?.name ?? ""),
        warehouseName: String(batch.warehouse?.name ?? ""),
        statusLabel: getBatchStatus(batch.expiryDate),
        manufacturingDateLabel: batch.manufacturingDate ? new Date(batch.manufacturingDate).toLocaleDateString() : "-",
        expiryDateLabel: batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString() : "-",
    }));

    const columns: ColumnDef<BatchRow>[] = [
        {
            key: "batchNumber",
            label: "Batch Number",
            sortable: true,
            render: (batch) => (
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                        <BeakerIcon className="h-3.5 w-3.5 text-cyan-600" />
                    </div>
                    <span className="text-xs font-mono text-gray-700">{batch.batchNumber}</span>
                </div>
            ),
        },
        {
            key: "productName",
            label: "Product",
            sortable: true,
            render: (batch) => (
                <div>
                    <div className="text-xs font-medium text-gray-900">{batch.product?.name || "-"}</div>
                    {batch.product?.sku && <div className="text-xs text-gray-500">{batch.product.sku}</div>}
                </div>
            ),
        },
        {
            key: "warehouseName",
            label: "Warehouse",
            sortable: true,
            render: (batch) => (
                <div className="flex items-center gap-1.5">
                    <HomeIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-xs text-gray-900">{batch.warehouse?.name || "-"}</span>
                </div>
            ),
        },
        {
            key: "manufacturingDateLabel",
            label: "Mfg Date",
            sortable: true,
            render: (batch) => (
                <div className="flex items-center gap-1.5 text-xs text-gray-700">
                    <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0" />
                    {new Date(batch.manufacturingDate).toLocaleDateString()}
                </div>
            ),
        },
        {
            key: "expiryDateLabel",
            label: "Expiry Date",
            sortable: true,
            render: (batch) => (
                <span className={`text-xs ${new Date(batch.expiryDate) < new Date() ? "text-red-600 font-medium" : "text-gray-700"}`}>
                    {new Date(batch.expiryDate).toLocaleDateString()}
                </span>
            ),
        },
        {
            key: "statusLabel",
            label: "Status",
            sortable: true,
            render: (batch) => getStatusBadge(batch.expiryDate),
        },
        {
            key: "quantity",
            label: "Quantity",
            sortable: true,
            render: (batch) => (
                <span className="text-xs font-medium text-gray-900">{batch.quantity ?? "-"}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (batch) => (
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedBatch(batch);
                            setViewModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="View Details"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleEdit(batch)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                        title="Edit Batch"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => promptDelete(batch)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        title="Delete Batch"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Batch Manager" description="Manage product batches and expiry tracking" />
            <PageBreadcrumb pageTitle="Batch Manager" />

            <div className="w-full max-w-none px-0 sm:px-0 lg:px-0 py-6 space-y-5">
                <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
                    <AddButton onClick={openCreateBatch} label="Add Batch" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <StatsCard label="Total Batches" value={totalBatches} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
                    <StatsCard label="Total Quantity" value={totalQuantity.toLocaleString()} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
                    <StatsCard label="Expired Batches" value={expiredBatches} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
                    <StatsCard label="Expiring Soon" value={expiringSoon} gradient="from-yellow-50 to-amber-50" borderColor="border-yellow-100" labelColor="text-yellow-700" />
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-3">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Product</label>
                                <select
                                    value={productFilter}
                                    onChange={e => setProductFilter(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Products</option>
                                    {uniqueProducts.map(product => (
                                        <option key={product} value={product}>{product}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Warehouse</label>
                                <select
                                    value={warehouseFilter}
                                    onChange={e => setWarehouseFilter(e.target.value)}
                                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">All Warehouses</option>
                                    {uniqueWarehouses.map(warehouse => (
                                        <option key={warehouse} value={warehouse}>{warehouse}</option>
                                    ))}
                                </select>
                            </div>
                            {(productFilter || warehouseFilter) && (
                                <button
                                    onClick={() => {
                                        setProductFilter("");
                                        setWarehouseFilter("");
                                    }}
                                    className="self-end mb-1 text-xs text-red-600 hover:text-red-800"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Batch Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-16 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={clearForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-6 sm:align-middle sm:max-w-md sm:w-full">
                                <div className="bg-white px-4 pt-4 pb-3 sm:p-5 sm:pb-3">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <h3 className="text-base leading-6 font-medium text-gray-900 mb-3">
                                                {editingId ? "Edit Batch" : "Add New Batch"}
                                            </h3>
                                            <form onSubmit={handleSubmit} className="space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Batch Number</label>
                                                    <input
                                                        type="text"
                                                        value={form.batchNumber}
                                                        onChange={e => handleChange("batchNumber", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2.5 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="e.g., BATCH-001"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Product</label>
                                                    <select
                                                        value={form.productId}
                                                        onChange={e => handleChange("productId", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2.5 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="">Select Product</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Warehouse</label>
                                                    <select
                                                        value={form.warehouseId}
                                                        onChange={e => handleChange("warehouseId", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2.5 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    >
                                                        <option value="">Select Warehouse</option>
                                                        {warehouses.map(w => (
                                                            <option key={w.id} value={w.id}>{w.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700">Manufacturing Date</label>
                                                        <input
                                                            type="date"
                                                            value={form.manufacturingDate}
                                                            onChange={e => handleChange("manufacturingDate", e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2.5 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-700">Expiry Date</label>
                                                        <input
                                                            type="date"
                                                            value={form.expiryDate}
                                                            onChange={e => handleChange("expiryDate", e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2.5 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700">Quantity</label>
                                                    <input
                                                        type="number"
                                                        value={form.quantity}
                                                        onChange={e => handleChange("quantity", Number(e.target.value))}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-2.5 py-1.5 text-sm focus:ring-cyan-500 focus:border-cyan-500"
                                                        min="0"
                                                    />
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-2.5 sm:px-5 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        onClick={handleSubmit}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-3.5 py-1.5 bg-cyan-600 text-sm font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto"
                                    >
                                        {editingId ? "Update" : "Create"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={clearForm}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3.5 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!showForm && (
                    <ReusableTable<BatchRow>
                        data={tableData}
                        columns={columns}
                        searchable
                        searchPlaceholder="Search by batch number, product, or warehouse..."
                        searchFields={["batchNumber", "productName", "warehouseName", "statusLabel", "manufacturingDateLabel", "expiryDateLabel"]}
                        pageSize={PAGE_SIZE}
                        defaultSortKey="batchNumber"
                        toolbar={
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowExportMenu(!showExportMenu)}
                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                        disabled={batches.length === 0}
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
                                <button onClick={() => window.print()} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors" disabled={batches.length === 0}>
                                    <PrinterIcon className="h-5 w-5 text-gray-600" />
                                </button>
                                <button onClick={() => setShowFilters(!showFilters)} className={`p-2 rounded-lg border ${showFilters ? "bg-cyan-50 border-cyan-300" : "border-gray-300 hover:bg-gray-50"}`}>
                                    <FunnelIcon className={`h-5 w-5 ${showFilters ? "text-cyan-600" : "text-gray-600"}`} />
                                </button>
                                <button onClick={fetchBatches} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors">
                                    <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                        }
                        emptyState={
                            <div className="flex flex-col items-center py-4">
                                <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-2.5">
                                    <BeakerIcon className="h-6 w-6 text-gray-400" />
                                </div>
                                <p className="text-gray-500 text-sm font-medium mb-1.5">No batches found</p>
                                <button onClick={openCreateBatch} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                                    Add your first batch
                                </button>
                            </div>
                        }
                    />
                )}

                {/* View Details Modal */}
                {viewModalOpen && selectedBatch && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-16 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-6 sm:align-middle sm:max-w-md sm:w-full">
                                <div className="bg-white px-4 pt-4 pb-3 sm:p-5 sm:pb-3">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-3">
                                                <h3 className="text-base leading-6 font-medium text-gray-900">
                                                    Batch Details
                                                </h3>
                                                <button
                                                    onClick={() => setViewModalOpen(false)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <div className="mb-5 p-3 bg-gray-50 rounded-lg">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Batch Number</p>
                                                        <p className="text-sm font-mono font-medium text-gray-900">{selectedBatch.batchNumber}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Product</p>
                                                        <p className="text-sm text-gray-700">{selectedBatch.product?.name || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Warehouse</p>
                                                        <p className="text-sm text-gray-700">{selectedBatch.warehouse?.name || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Quantity</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedBatch.quantity || "-"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Manufacturing Date</p>
                                                        <p className="text-sm text-gray-700">{new Date(selectedBatch.manufacturingDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Expiry Date</p>
                                                        <p className={`text-sm ${new Date(selectedBatch.expiryDate) < new Date() ? "text-red-600 font-medium" : "text-gray-700"}`}>
                                                            {new Date(selectedBatch.expiryDate).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        <div className="mt-1">{getStatusBadge(selectedBatch.expiryDate)}</div>
                                                    </div>
                                                    {selectedBatch.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Created At</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedBatch.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {new Date(selectedBatch.expiryDate) < new Date() && (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800">
                                                        <strong>Expired Batch:</strong> This batch has expired and should not be used for inventory.
                                                    </p>
                                                </div>
                                            )}
                                            {new Date(selectedBatch.expiryDate) > new Date() && new Date(selectedBatch.expiryDate).getTime() - new Date().getTime() <= 30 * 24 * 60 * 60 * 1000 && (
                                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                                    <p className="text-sm text-yellow-800">
                                                        <strong>Expiring Soon:</strong> This batch will expire within 30 days. Consider prioritizing its usage.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-2.5 sm:px-5 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewModalOpen(false);
                                            handleEdit(selectedBatch);
                                        }}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-3.5 py-1.5 bg-cyan-600 text-sm font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto"
                                    >
                                        <PencilSquareIcon className="h-4 w-4 mr-2" />
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewModalOpen(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-3.5 py-1.5 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:w-auto"
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
                    innerText="Delete Batch"
                    subText={deletingBatch ? `Are you sure you want to delete batch "${deletingBatch.batchNumber}"? This action cannot be undone.` : "Are you sure you want to delete this batch?"}
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={confirmDelete}
                    onCancel={() => setDeletingBatch(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default BatchManager;

