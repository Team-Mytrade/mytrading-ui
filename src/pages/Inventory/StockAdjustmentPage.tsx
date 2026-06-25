import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    PencilSquareIcon,
    TrashIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    XCircleIcon,
    ArrowPathIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    PrinterIcon,
    ChartBarIcon,
    ArrowUpIcon as ArrowUpIconSolid,
    ArrowDownIcon as ArrowDownIconSolid,
    ClipboardDocumentCheckIcon,
    ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";
import { ToasterService } from "../../Services/ToasterService";

interface Product {
    id: number;
    name: string;
    sku?: string;
    currentStock?: number;
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
    productId?: number;
    expiryDate?: string;
    quantity?: number;
}

interface SerialNumber {
    id: number;
    serial: string;
    batchId?: number;
    productId?: number;
    status?: "AVAILABLE" | "SOLD" | "DAMAGED";
}

enum AdjustmentType {
    POSITIVE = "POSITIVE",
    NEGATIVE = "NEGATIVE",
}

interface StockAdjustment {
    id: number;
    adjustmentDate: string;
    reason: string;
    quantity: number;
    adjustmentType: AdjustmentType;
    product?: Product;
    warehouse?: Warehouse;
    batch?: Batch;
    serialNumber?: SerialNumber;
    reference?: string;
    approvedBy?: string;
    approvedAt?: string;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

const API_URL = "/v1/api/inventory";
const PAGE_SIZE = 10;

const StockAdjustmentManager: React.FC = () => {
    const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
    const [filteredSerialNumbers, setFilteredSerialNumbers] = useState<SerialNumber[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [typeFilter, setTypeFilter] = useState<"All" | "POSITIVE" | "NEGATIVE">("All");
    const [dateFromFilter, setDateFromFilter] = useState<string>("");
    const [dateToFilter, setDateToFilter] = useState<string>("");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustment | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [adjustmentToDelete, setAdjustmentToDelete] = useState<StockAdjustment | null>(null);

    const [form, setForm] = useState({
        adjustmentDate: new Date().toISOString().split('T')[0],
        reason: "",
        quantity: "",
        adjustmentType: AdjustmentType.POSITIVE,
        productId: "",
        warehouseId: "",
        batchId: "",
        serialNumberId: "",
        reference: "",
    });

    // Fetch all initial data
    useEffect(() => {
        fetchAllData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchAdjustments(),
                fetchProducts(),
                fetchWarehouses(),
                fetchAllBatches(),
                fetchAllSerialNumbers(),
            ]);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdjustments = async () => {
        try {
            const response = await axios.get(`${API_URL}/stock-adjustments`);
            setAdjustments(response.data);
        } catch (err) {
            console.error("Failed to load stock adjustments", err);
            ToasterService.error("Failed to load stock adjustments");
            setAdjustments([]);
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

    const fetchAllBatches = async () => {
        try {
            await axios.get(`${API_URL}/batches`);
        } catch (err) {
            console.error("Failed to load batches", err);
            ToasterService.error("Failed to load batches");
        }
    };

    const fetchAllSerialNumbers = async () => {
        try {
            await axios.get(`${API_URL}/serial-numbers`);
        } catch (err) {
            console.error("Failed to load serial numbers", err);
            ToasterService.error("Failed to load serial numbers");
        }
    };

    // Fetch batches by product ID
    const fetchBatchesByProduct = async (productId: number) => {
        try {
            const response = await axios.get(`${API_URL}/batches/product/${productId}`);
            setFilteredBatches(response.data);
            return response.data;
        } catch (err) {
            console.error("Failed to load batches for product", err);
            setFilteredBatches([]);
            return [];
        }
    };

    // Fetch serial numbers by batch ID
    const fetchSerialNumbersByBatch = async (batchId: number) => {
        try {
            const response = await axios.get(`${API_URL}/serial-numbers/batch/${batchId}`);
            setFilteredSerialNumbers(response.data);
            return response.data;
        } catch (err) {
            console.error("Failed to load serial numbers for batch", err);
            setFilteredSerialNumbers([]);
            return [];
        }
    };

    // Check stock availability for negative adjustments
    const checkStockAvailability = async (productId: number, warehouseId: number, batchId: number | null, quantity: number): Promise<boolean> => {
        try {
            const response = await axios.get(`${API_URL}/stock/availability`, {
                params: {
                    productId,
                    warehouseId,
                    batchId: batchId || undefined,
                },
            });
            const availableStock = response.data.availableQuantity || 0;
            if (availableStock < quantity) {
                ToasterService.warning(`Insufficient stock. Only ${availableStock} units available.`);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Failed to check stock availability", err);
            // If API fails, allow the adjustment but show warning
            ToasterService.warning("Unable to verify stock availability. Please verify manually.");
            return true;
        }
    };

    const clearForm = () => {
        setForm({
            adjustmentDate: new Date().toISOString().split('T')[0],
            reason: "",
            quantity: "",
            adjustmentType: AdjustmentType.POSITIVE,
            productId: "",
            warehouseId: "",
            batchId: "",
            serialNumberId: "",
            reference: "",
        });
        setFilteredBatches([]);
        setFilteredSerialNumbers([]);
        setEditingId(null);
        setShowForm(false);
    };

    const handleChange = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleProductChange = async (productId: string) => {
        setForm(prev => ({ ...prev, productId, batchId: "", serialNumberId: "" }));
        if (productId) {
            const batchesData = await fetchBatchesByProduct(Number(productId));
            setFilteredBatches(batchesData);
        } else {
            setFilteredBatches([]);
            setFilteredSerialNumbers([]);
        }
    };

    const handleBatchChange = async (batchId: string) => {
        setForm(prev => ({ ...prev, batchId, serialNumberId: "" }));
        if (batchId) {
            const serialsData = await fetchSerialNumbersByBatch(Number(batchId));
            setFilteredSerialNumbers(serialsData);
        } else {
            setFilteredSerialNumbers([]);
        }
    };

    const buildPayload = () => ({
        adjustmentDate: form.adjustmentDate,
        reason: form.reason,
        quantity: Number(form.quantity),
        adjustmentType: form.adjustmentType,
        product: form.productId ? { id: Number(form.productId) } : null,
        warehouse: form.warehouseId ? { id: Number(form.warehouseId) } : null,
        batch: form.batchId ? { id: Number(form.batchId) } : null,
        serialNumber: form.serialNumberId ? { id: Number(form.serialNumberId) } : null,
        reference: form.reference || undefined,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!form.productId) {
            ToasterService.warning("Please select a product");
            return;
        }
        if (!form.warehouseId) {
            ToasterService.warning("Please select a warehouse");
            return;
        }
        if (!form.quantity || Number(form.quantity) <= 0) {
            ToasterService.warning("Please enter a valid quantity (greater than 0)");
            return;
        }
        if (!form.reason.trim()) {
            ToasterService.warning("Please provide a reason for the adjustment");
            return;
        }

        const quantity = Number(form.quantity);

        // For negative adjustments, check stock availability
        if (form.adjustmentType === AdjustmentType.NEGATIVE) {
            const hasStock = await checkStockAvailability(
                Number(form.productId),
                Number(form.warehouseId),
                form.batchId ? Number(form.batchId) : null,
                quantity
            );
            if (!hasStock) return;
        }

        setIsSubmitting(true);
        try {
            if (editingId) {
                await axios.put(`${API_URL}/stock-adjustments/${editingId}`, buildPayload());
                ToasterService.success("Stock adjustment updated successfully");
            } else {
                await axios.post(`${API_URL}/stock-adjustments`, buildPayload());
                ToasterService.success("Stock adjustment created successfully");
            }
            await fetchAdjustments();
            clearForm();
        } catch (err: unknown) {
            const errorMessage = axios.isAxiosError(err)
                ? err.response?.data?.message || "Save failed"
                : "Save failed";
            ToasterService.error(errorMessage);
            console.error("Save failed", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (adj: StockAdjustment) => {
        setEditingId(adj.id);
        setForm({
            adjustmentDate: adj.adjustmentDate?.split('T')[0] || new Date().toISOString().split('T')[0],
            reason: adj.reason || "",
            quantity: adj.quantity?.toString() || "",
            adjustmentType: adj.adjustmentType || AdjustmentType.POSITIVE,
            productId: adj.product?.id?.toString() || "",
            warehouseId: adj.warehouse?.id?.toString() || "",
            batchId: adj.batch?.id?.toString() || "",
            serialNumberId: adj.serialNumber?.id?.toString() || "",
            reference: adj.reference || "",
        });
        
        // Load related data for the selected product and batch
        if (adj.product?.id) {
            fetchBatchesByProduct(adj.product.id);
        }
        if (adj.batch?.id) {
            fetchSerialNumbersByBatch(adj.batch.id);
        }
        
        setShowForm(true);
    };

    const handleDelete = async () => {
        if (!adjustmentToDelete) return;
        try {
            await axios.delete(`${API_URL}/stock-adjustments/${adjustmentToDelete.id}`);
            ToasterService.success("Stock adjustment deleted successfully");
            await fetchAdjustments();
        } catch (err: unknown) {
            const errorMessage = axios.isAxiosError(err)
                ? err.response?.data?.message || "Delete failed"
                : "Delete failed";
            ToasterService.error(errorMessage);
        } finally {
            setAdjustmentToDelete(null);
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Stock Adjustment Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Adjustments: ${filteredAdjustments.length}`, 14, 28);

        autoTable(doc, {
            head: [["Date", "Product", "Warehouse", "Type", "Quantity", "Reason"]],
            body: filteredAdjustments.map(a => [
                new Date(a.adjustmentDate).toLocaleDateString(),
                a.product?.name || "-",
                a.warehouse?.name || "-",
                a.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out",
                `${a.adjustmentType === "POSITIVE" ? "+" : "-"}${a.quantity}`,
                a.reason || "-"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Stock_Adjustments_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredAdjustments.map(a => ({
            'Date': new Date(a.adjustmentDate).toLocaleDateString(),
            'Product': a.product?.name || "-",
            'Product SKU': a.product?.sku || "-",
            'Warehouse': a.warehouse?.name || "-",
            'Warehouse Code': a.warehouse?.code || "-",
            'Batch Number': a.batch?.batchNumber || "-",
            'Serial Number': a.serialNumber?.serial || "-",
            'Adjustment Type': a.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out",
            'Quantity': a.quantity,
            'Net Change': a.adjustmentType === "POSITIVE" ? `+${a.quantity}` : `-${a.quantity}`,
            'Reason': a.reason || "-",
            'Reference': a.reference || "-",
            'Approved By': a.approvedBy || "-",
            'Created By': a.createdBy || "-",
            'Created At': a.createdAt ? new Date(a.createdAt).toLocaleString() : "-",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Adjustments");
        XLSX.writeFile(wb, `Stock_Adjustments_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filteredAdjustments = useMemo(() => {
        return adjustments.filter(a => {
            const matchesType = typeFilter === "All" || a.adjustmentType === typeFilter;
            
            let matchesDateRange = true;
            if (dateFromFilter) {
                matchesDateRange = matchesDateRange && new Date(a.adjustmentDate) >= new Date(dateFromFilter);
            }
            if (dateToFilter) {
                matchesDateRange = matchesDateRange && new Date(a.adjustmentDate) <= new Date(dateToFilter);
            }
            return matchesType && matchesDateRange;
        });
    }, [adjustments, typeFilter, dateFromFilter, dateToFilter]);

    // Calculate stats from real data
    const totalAdjustments = adjustments.length;
    const positiveAdjustments = adjustments.filter(a => a.adjustmentType === "POSITIVE").length;
    const negativeAdjustments = adjustments.filter(a => a.adjustmentType === "NEGATIVE").length;
    const totalQuantityAdded = adjustments
        .filter(a => a.adjustmentType === "POSITIVE")
        .reduce((sum, a) => sum + a.quantity, 0);
    const totalQuantityRemoved = adjustments
        .filter(a => a.adjustmentType === "NEGATIVE")
        .reduce((sum, a) => sum + a.quantity, 0);
    const netChange = totalQuantityAdded - totalQuantityRemoved;

    // Status badge configuration
    const getTypeBadge = (type: AdjustmentType) => {
        if (type === "POSITIVE") {
            return "bg-green-100 text-green-800 border-green-200";
        }
        return "bg-red-100 text-red-800 border-red-200";
    };

    const getTypeIcon = (type: AdjustmentType) => {
        if (type === "POSITIVE") {
            return <ArrowUpIconSolid className="h-3 w-3 mr-1" />;
        }
        return <ArrowDownIconSolid className="h-3 w-3 mr-1" />;
    };

    const tableColumns: ColumnDef<StockAdjustment>[] = [
        {
            key: "adjustmentDate",
            label: "Date",
            sortable: true,
            render: (adjustment) => (
                <div>
                    <p className="text-sm font-medium text-gray-900">
                        {new Date(adjustment.adjustmentDate).toLocaleDateString()}
                    </p>
                    {adjustment.createdAt && (
                        <p className="text-xs text-gray-500">
                            {new Date(adjustment.createdAt).toLocaleTimeString()}
                        </p>
                    )}
                </div>
            ),
        },
        {
            key: "product",
            label: "Product",
            render: (adjustment) => (
                <div>
                    <p className="text-sm font-medium text-gray-900">{adjustment.product?.name || "N/A"}</p>
                    <p className="text-xs text-gray-500">{adjustment.product?.sku || "No SKU"}</p>
                </div>
            ),
        },
        {
            key: "warehouse",
            label: "Warehouse",
            render: (adjustment) => (
                <div>
                    <p className="text-sm text-gray-900">{adjustment.warehouse?.name || "N/A"}</p>
                    <p className="text-xs text-gray-500">{adjustment.warehouse?.code || "No code"}</p>
                </div>
            ),
        },
        {
            key: "adjustmentType",
            label: "Type",
            sortable: true,
            render: (adjustment) => (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTypeBadge(adjustment.adjustmentType)}`}>
                    {getTypeIcon(adjustment.adjustmentType)}
                    {adjustment.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out"}
                </span>
            ),
        },
        {
            key: "quantity",
            label: "Quantity",
            sortable: true,
            render: (adjustment) => (
                <span className={`text-sm font-semibold ${adjustment.adjustmentType === "POSITIVE" ? "text-green-600" : "text-red-600"}`}>
                    {adjustment.adjustmentType === "POSITIVE" ? "+" : "-"}{adjustment.quantity}
                </span>
            ),
        },
        {
            key: "reason",
            label: "Reason",
            sortable: true,
            render: (adjustment) => (
                <div>
                    <p className="text-sm text-gray-700 line-clamp-2">{adjustment.reason || "-"}</p>
                    {adjustment.reference && (
                        <p className="text-xs text-gray-500 mt-1">Ref: {adjustment.reference}</p>
                    )}
                </div>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "!text-right pr-8",
            className: "text-right",
            render: (adjustment) => (
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedAdjustment(adjustment);
                            setViewModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="View Details"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleEdit(adjustment)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                        title="Edit Stock Adjustment"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setAdjustmentToDelete(adjustment);
                            setShowDeletePopup(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        title="Delete Stock Adjustment"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    const tableToolbar = (
        <div className="flex items-center gap-2 relative">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    disabled={filteredAdjustments.length === 0}
                    title="Export"
                >
                    <DocumentArrowDownIcon className="h-5 w-5" />
                </button>
                {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-44 bg-white shadow-lg rounded-lg border border-gray-200 z-50">
                        <button
                            type="button"
                            onClick={exportPDF}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                            Export PDF
                        </button>
                        <button
                            type="button"
                            onClick={exportExcel}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                            <TableCellsIcon className="h-4 w-4 text-green-600" />
                            Export Excel
                        </button>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => window.print()}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                disabled={filteredAdjustments.length === 0}
                title="Print"
            >
                <PrinterIcon className="h-5 w-5" />
            </button>

            <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors ${showFilters ? "bg-cyan-50 border-cyan-300 text-cyan-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                title="Filters"
            >
                <ExclamationTriangleIcon className="h-5 w-5" />
            </button>

            <button
                type="button"
                onClick={fetchAllData}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                title="Refresh"
            >
                <ArrowPathIcon className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
            </button>
        </div>
    );

    return (
        <>
            <PageMeta title="Stock Adjustment" description="Manage inventory stock adjustments" />
            <PageBreadcrumb pageTitle="Stock Adjustment" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <div className="flex items-center gap-4">
                        {/* <div>
                            <h1 className="text-2xl font-bold text-gray-900">Stock Adjustment</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Track stock in and stock out adjustments
                            </p>
                        </div> */}
                    </div>

                    <AddButton
                        label="Add Adjustment"
                        onClick={() => {
                            clearForm();
                            setShowForm(true);
                        }}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        label="Total Adjustments"
                        value={totalAdjustments}
                        gradient="from-cyan-50 to-blue-50"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-600"
                        icon={<ClipboardDocumentCheckIcon className="h-6 w-6 text-cyan-600" />}
                    />
                    <StatsCard
                        label="Stock In"
                        value={positiveAdjustments}
                        gradient="from-emerald-50 to-teal-50"
                        borderColor="border-emerald-100"
                        labelColor="text-emerald-600"
                        icon={<ArrowUpIcon className="h-6 w-6 text-emerald-600" />}
                    />
                    <StatsCard
                        label="Stock Out"
                        value={negativeAdjustments}
                        gradient="from-rose-50 to-red-50"
                        borderColor="border-rose-100"
                        labelColor="text-rose-600"
                        icon={<ArrowDownIcon className="h-6 w-6 text-rose-600" />}
                    />
                    <StatsCard
                        label="Net Change"
                        value={`${netChange >= 0 ? "+" : ""}${netChange.toLocaleString()}`}
                        gradient="from-amber-50 to-orange-50"
                        borderColor="border-amber-100"
                        labelColor="text-amber-600"
                        icon={<ChartBarIcon className="h-6 w-6 text-amber-600" />}
                    />
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">Adjustment Type</label>
                                <select
                                    value={typeFilter}
                                    onChange={e => setTypeFilter(e.target.value as "All" | "POSITIVE" | "NEGATIVE")}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                >
                                    <option value="All">All Types</option>
                                    <option value="POSITIVE">Stock In</option>
                                    <option value="NEGATIVE">Stock Out</option>
                                </select>
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">From Date</label>
                                <input
                                    type="date"
                                    value={dateFromFilter}
                                    onChange={e => setDateFromFilter(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium text-gray-700 mb-1.5">To Date</label>
                                <input
                                    type="date"
                                    value={dateToFilter}
                                    onChange={e => setDateToFilter(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                                />
                            </div>
                            {(typeFilter !== "All" || dateFromFilter || dateToFilter) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTypeFilter("All");
                                        setDateFromFilter("");
                                        setDateToFilter("");
                                    }}
                                    className="self-end px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={clearForm}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    {editingId ? "Edit Stock Adjustment" : "Add Stock Adjustment"}
                                                </h3>
                                                <button
                                                    onClick={clearForm}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Adjustment Date</label>
                                                    <input
                                                        type="date"
                                                        value={form.adjustmentDate}
                                                        onChange={e => handleChange("adjustmentDate", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Product</label>
                                                        <select
                                                            value={form.productId}
                                                            onChange={e => handleProductChange(e.target.value)}
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
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Batch (Optional)</label>
                                                        <select
                                                            value={form.batchId}
                                                            onChange={e => handleBatchChange(e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            disabled={!form.productId}
                                                        >
                                                            <option value="">Select Batch</option>
                                                            {filteredBatches.map(b => (
                                                                <option key={b.id} value={b.id}>
                                                                    {b.batchNumber} {b.expiryDate ? `(Exp: ${new Date(b.expiryDate).toLocaleDateString()})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Serial Number (Optional)</label>
                                                        <select
                                                            value={form.serialNumberId}
                                                            onChange={e => handleChange("serialNumberId", e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            disabled={!form.batchId}
                                                        >
                                                            <option value="">Select Serial Number</option>
                                                            {filteredSerialNumbers.map(sn => (
                                                                <option key={sn.id} value={sn.id}>
                                                                    {sn.serial} {sn.status ? `(${sn.status})` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Adjustment Type</label>
                                                        <select
                                                            value={form.adjustmentType}
                                                            onChange={e => handleChange("adjustmentType", e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        >
                                                            <option value="POSITIVE">Stock In (Positive)</option>
                                                            <option value="NEGATIVE">Stock Out (Negative)</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                                        <input
                                                            type="number"
                                                            value={form.quantity}
                                                            onChange={e => handleChange("quantity", e.target.value)}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="1"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Reference (Optional)</label>
                                                    <input
                                                        type="text"
                                                        value={form.reference}
                                                        onChange={e => handleChange("reference", e.target.value)}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="PO #, Invoice #, or other reference"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                                                    <textarea
                                                        value={form.reason}
                                                        onChange={e => handleChange("reason", e.target.value)}
                                                        rows={3}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="Why is this adjustment needed?"
                                                        required
                                                    />
                                                </div>
                                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>Note:</strong> Stock adjustments affect inventory levels. 
                                                        Positive adjustments increase stock, negative adjustments decrease stock.
                                                        {form.adjustmentType === "NEGATIVE" && " Ensure sufficient stock is available before making negative adjustments."}
                                                    </p>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        ) : (
                                            editingId ? "Update" : "Create"
                                        )}
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

                <ReusableTable<StockAdjustment>
                    data={filteredAdjustments}
                    columns={tableColumns}
                    loading={loading}
                    searchable
                    searchPlaceholder="Search stock adjustments by reason, reference, or quantity..."
                    searchFields={["reason", "reference", "quantity"]}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="adjustmentDate"
                    defaultSortOrder="desc"
                    toolbar={tableToolbar}
                    onRowClick={(adjustment) => {
                        setSelectedAdjustment(adjustment);
                        setViewModalOpen(true);
                    }}
                    emptyState={
                        <div className="flex flex-col items-center justify-center">
                            <ClipboardDocumentCheckIcon className="h-10 w-10 text-gray-400 mb-2" />
                            <p className="text-gray-500 text-sm mb-1">No stock adjustments found</p>
                            <button
                                type="button"
                                onClick={() => {
                                    clearForm();
                                    setShowForm(true);
                                }}
                                className="mt-1 text-cyan-600 hover:text-cyan-700 text-xs font-medium"
                            >
                                Create your first adjustment
                            </button>
                        </div>
                    }
                />

                {/* View Details Modal */}
                {viewModalOpen && selectedAdjustment && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Stock Adjustment Details
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
                                                        <p className="text-xs text-gray-500">Adjustment Date</p>
                                                        <p className="text-sm text-gray-700">{new Date(selectedAdjustment.adjustmentDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Type</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${getTypeBadge(selectedAdjustment.adjustmentType)}`}>
                                                            {getTypeIcon(selectedAdjustment.adjustmentType)}
                                                            {selectedAdjustment.adjustmentType === "POSITIVE" ? "Stock In" : "Stock Out"}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Product</p>
                                                        <p className="text-sm font-medium text-gray-900">{selectedAdjustment.product?.name || "N/A"}</p>
                                                        {selectedAdjustment.product?.sku && (
                                                            <p className="text-xs text-gray-500 mt-1">SKU: {selectedAdjustment.product.sku}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Warehouse</p>
                                                        <p className="text-sm text-gray-700">{selectedAdjustment.warehouse?.name || "N/A"}</p>
                                                        {selectedAdjustment.warehouse?.code && (
                                                            <p className="text-xs text-gray-500 mt-1">Code: {selectedAdjustment.warehouse.code}</p>
                                                        )}
                                                    </div>
                                                    {selectedAdjustment.batch && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Batch Number</p>
                                                            <p className="text-sm font-mono text-gray-700">{selectedAdjustment.batch.batchNumber}</p>
                                                            {selectedAdjustment.batch.expiryDate && (
                                                                <p className="text-xs text-gray-500 mt-1">Expires: {new Date(selectedAdjustment.batch.expiryDate).toLocaleDateString()}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {selectedAdjustment.serialNumber && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Serial Number</p>
                                                            <p className="text-sm font-mono text-gray-700">{selectedAdjustment.serialNumber.serial}</p>
                                                            {selectedAdjustment.serialNumber.status && (
                                                                <p className="text-xs text-gray-500 mt-1">Status: {selectedAdjustment.serialNumber.status}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs text-gray-500">Quantity</p>
                                                        <p className={`text-sm font-medium ${selectedAdjustment.adjustmentType === "POSITIVE" ? "text-green-600" : "text-red-600"}`}>
                                                            {selectedAdjustment.adjustmentType === "POSITIVE" ? "+" : "-"}{selectedAdjustment.quantity}
                                                        </p>
                                                    </div>
                                                    {selectedAdjustment.reference && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Reference</p>
                                                            <p className="text-sm text-gray-700">{selectedAdjustment.reference}</p>
                                                        </div>
                                                    )}
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">Reason</p>
                                                        <p className="text-sm text-gray-700">{selectedAdjustment.reason || "—"}</p>
                                                    </div>
                                                    {selectedAdjustment.approvedBy && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Approved By</p>
                                                            <p className="text-sm text-gray-700">{selectedAdjustment.approvedBy}</p>
                                                            {selectedAdjustment.approvedAt && (
                                                                <p className="text-xs text-gray-500 mt-1">{new Date(selectedAdjustment.approvedAt).toLocaleString()}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    {selectedAdjustment.createdBy && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Created By</p>
                                                            <p className="text-sm text-gray-700">{selectedAdjustment.createdBy}</p>
                                                        </div>
                                                    )}
                                                    {selectedAdjustment.createdAt && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Created At</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedAdjustment.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedAdjustment.adjustmentType === "NEGATIVE" && (
                                                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                                    <p className="text-sm text-yellow-800">
                                                        <strong>Stock Out Adjustment:</strong> This adjustment decreased inventory levels.
                                                        Ensure this was intended and properly documented.
                                                    </p>
                                                </div>
                                            )}
                                            {selectedAdjustment.adjustmentType === "POSITIVE" && (
                                                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                                    <p className="text-sm text-green-800">
                                                        <strong>Stock In Adjustment:</strong> This adjustment increased inventory levels.
                                                        Verify that the stock was physically received.
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
                                            handleEdit(selectedAdjustment);
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
                    innerText="Delete Stock Adjustment"
                    subText={
                        adjustmentToDelete
                            ? `Are you sure you want to delete ${adjustmentToDelete.adjustmentType === "POSITIVE" ? "stock in" : "stock out"} adjustment for "${adjustmentToDelete.product?.name || "Unknown Product"}" (${adjustmentToDelete.quantity} units)? This action cannot be undone.`
                            : "Are you sure you want to delete this stock adjustment?"
                    }
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    onConfirm={handleDelete}
                    onCancel={() => setAdjustmentToDelete(null)}
                    confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                />
            </div>
        </>
    );
};

export default StockAdjustmentManager;

