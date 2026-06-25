import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    CheckCircleIcon,
    XCircleIcon,
    DocumentArrowDownIcon,
    TableCellsIcon,
    EyeIcon,
    CubeIcon,
    ExclamationTriangleIcon,
    PrinterIcon,
    DocumentTextIcon,
    ChartBarIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";

interface ReorderItem {
    id: number;
    product: string;
    productId?: number;
    productSKU?: string;
    currentStock: number;
    reorderLevel: number;
    maxStock?: number;
    unit?: string;
    supplier?: string;
    leadTime?: number;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

const API_URL = "/v1/api/inventory/reorder-levels";
const PAGE_SIZE = 10;

const ReorderLevelPage: React.FC = () => {
    const [items, setItems] = useState<ReorderItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<"All" | "Reorder" | "OK">("All");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ReorderItem | null>(null);
    const { confirmState, confirm, handleConfirm, handleCancel } = useConfirmDialog();

    const [form, setForm] = useState({
        product: "",
        currentStock: 0,
        reorderLevel: 0,
        maxStock: 0,
        unit: "",
        supplier: "",
        leadTime: 0,
        notes: "",
    });

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL);
            setItems(response.data);
        } catch (err) {
            console.error("Failed to load reorder items", err);
            ToasterService.error("Failed to load reorder items");
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!form.product.trim()) {
            ToasterService.warning("Please enter product name");
            return;
        }
        if (form.currentStock < 0) {
            ToasterService.warning("Current stock must be 0 or greater");
            return;
        }
        if (form.reorderLevel < 0) {
            ToasterService.warning("Reorder level must be 0 or greater");
            return;
        }

        try {
            if (editingId !== null) {
                await axios.put(`${API_URL}/${editingId}`, form);
                ToasterService.success("Reorder level updated successfully");
            } else {
                await axios.post(API_URL, form);
                ToasterService.success("Reorder level created successfully");
            }
            await fetchItems();
            resetForm();
            setShowForm(false);
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Save failed");
        }
    };

    const handleEdit = (item: ReorderItem) => {
        setEditingId(item.id);
        setForm({
            product: item.product,
            currentStock: item.currentStock,
            reorderLevel: item.reorderLevel,
            maxStock: item.maxStock || 0,
            unit: item.unit || "",
            supplier: item.supplier || "",
            leadTime: item.leadTime || 0,
            notes: item.notes || "",
        });
        setShowForm(true);
    };

    const handleDelete = async (id: number, product: string) => {
        const ok = await confirm({
            message: `Are you sure you want to delete reorder level for "${product}"? This action cannot be undone.`,
            confirmLabel: "Delete",
            variant: "danger",
        });
        if (!ok) return;

        try {
            await axios.delete(`${API_URL}/${id}`);
            ToasterService.success("Reorder level deleted successfully");
            await fetchItems();
        } catch (err: any) {
            ToasterService.error(err.response?.data?.message || "Delete failed");
        }
    };

    const resetForm = () => {
        setForm({
            product: "",
            currentStock: 0,
            reorderLevel: 0,
            maxStock: 0,
            unit: "",
            supplier: "",
            leadTime: 0,
            notes: "",
        });
        setEditingId(null);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reorder Level Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`Total Items: ${filtered.length}`, 14, 28);

        autoTable(doc, {
            head: [["Product", "Current Stock", "Reorder Level", "Status", "Unit"]],
            body: filtered.map(i => [
                i.product,
                i.currentStock.toString(),
                i.reorderLevel.toString(),
                i.currentStock <= i.reorderLevel ? "Reorder Needed" : "OK",
                i.unit || "-"
            ]),
            startY: 35,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [6, 182, 212] },
        });
        doc.save(`Reorder_Levels_${new Date().toISOString().split("T")[0]}.pdf`);
        setShowExportMenu(false);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filtered.map(i => ({
            'Product': i.product,
            'Product SKU': i.productSKU || "-",
            'Current Stock': i.currentStock,
            'Reorder Level': i.reorderLevel,
            'Max Stock': i.maxStock || "-",
            'Status': i.currentStock <= i.reorderLevel ? "Reorder Needed" : "OK",
            'Unit': i.unit || "-",
            'Supplier': i.supplier || "-",
            'Lead Time (Days)': i.leadTime || "-",
            'Notes': i.notes || "-",
            'Created At': i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "-",
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reorder Levels");
        XLSX.writeFile(wb, `Reorder_Levels_${new Date().toISOString().split("T")[0]}.xlsx`);
        setShowExportMenu(false);
    };

    const filtered = useMemo(() => {
        return items.filter(i => {
            const matchesSearch = i.product.toLowerCase().includes(search.toLowerCase()) ||
                (i.productSKU?.toLowerCase().includes(search.toLowerCase()) || false) ||
                (i.supplier?.toLowerCase().includes(search.toLowerCase()) || false);
            
            let matchesStatus = true;
            if (statusFilter === "Reorder") {
                matchesStatus = i.currentStock <= i.reorderLevel;
            } else if (statusFilter === "OK") {
                matchesStatus = i.currentStock > i.reorderLevel;
            }
            
            return matchesSearch && matchesStatus;
        });
    }, [items, search, statusFilter]);

    // Calculate stats from real data
    const totalItems = items.length;
    const reorderNeeded = items.filter(i => i.currentStock <= i.reorderLevel).length;
    const okItems = items.filter(i => i.currentStock > i.reorderLevel).length;
    const totalStock = items.reduce((sum, i) => sum + i.currentStock, 0);

    // Status badge configuration
    const getStatusBadge = (currentStock: number, reorderLevel: number) => {
        if (currentStock <= reorderLevel) {
            return "bg-red-100 text-red-800 border-red-200";
        }
        return "bg-green-100 text-green-800 border-green-200";
    };

    const getStatusIcon = (currentStock: number, reorderLevel: number) => {
        if (currentStock <= reorderLevel) {
            return <ExclamationTriangleIcon className="h-3 w-3 mr-1" />;
        }
        return <CheckCircleIcon className="h-3 w-3 mr-1" />;
    };

    const getStatusText = (currentStock: number, reorderLevel: number) => {
        if (currentStock <= reorderLevel) {
            return "Reorder Needed";
        }
        return "OK";
    };

    const getStockPercentage = (currentStock: number, reorderLevel: number) => {
        if (currentStock <= 0) return 0;
        const percentage = (currentStock / reorderLevel) * 100;
        return Math.min(percentage, 100);
    };

    const tableColumns: ColumnDef<ReorderItem>[] = [
        {
            key: "product",
            label: "Product",
            sortable: true,
            headerClassName: "w-[30%] text-left",
            className: "w-[30%]",
            render: (item) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <CubeIcon className="h-4 w-4 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 truncate leading-snug">{item.product}</div>
                        {item.productSKU && (
                            <div className="text-xs text-slate-500 truncate mt-0.5">SKU: {item.productSKU}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: "currentStock",
            label: "Current Stock",
            sortable: true,
            headerClassName: "w-[15%] text-left",
            className: "w-[15%]",
            render: (item) => {
                const isReorderNeeded = item.currentStock <= item.reorderLevel;
                return (
                    <span className={`text-sm font-semibold ${isReorderNeeded ? "text-red-600" : "text-green-600"}`}>
                        {item.currentStock}
                        {item.unit && <span className="text-xs text-slate-400 ml-1 font-medium">{item.unit}</span>}
                    </span>
                );
            },
        },
        {
            key: "reorderLevel",
            label: "Reorder Level",
            sortable: true,
            headerClassName: "w-[15%] text-left",
            className: "w-[15%]",
            render: (item) => (
                <span className="text-sm font-medium text-slate-600">
                    {item.reorderLevel}
                    {item.unit && <span className="text-xs text-slate-400 ml-1">{item.unit}</span>}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            sortValueGetter: (item) => getStatusText(item.currentStock, item.reorderLevel),
            headerClassName: "w-[18%] text-left",
            className: "w-[18%]",
            render: (item) => (
                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadge(item.currentStock, item.reorderLevel)}`}>
                    {getStatusIcon(item.currentStock, item.reorderLevel)}
                    {getStatusText(item.currentStock, item.reorderLevel)}
                </span>
            ),
        },
        {
            key: "stockLevel",
            label: "Stock Level",
            sortable: true,
            sortValueGetter: (item) => getStockPercentage(item.currentStock, item.reorderLevel),
            headerClassName: "w-[16%] text-left",
            className: "w-[16%]",
            render: (item) => {
                const percentage = getStockPercentage(item.currentStock, item.reorderLevel);
                const isReorderNeeded = item.currentStock <= item.reorderLevel;
                return (
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-full min-w-[80px] rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${isReorderNeeded ? "bg-red-500" : "bg-green-500"}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-slate-500 min-w-[38px]">
                            {Math.min(Math.round(percentage), 100)}%
                        </span>
                    </div>
                );
            },
        },
        {
            key: "actions",
            label: "Actions",
            sortable: false,
            headerClassName: "w-[6%] text-right pr-4",
            className: "w-[6%] text-right",
            render: (item) => (
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedItem(item);
                            setViewModalOpen(true);
                        }}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600"
                        title="View Details"
                    >
                        <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
                        title="Edit Reorder Level"
                    >
                        <PencilSquareIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.product)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        title="Delete Reorder Level"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            ),
        },
    ];

    return (
        <>
            <PageMeta title="Reorder Level Management" description="Manage inventory reorder levels" />
            <PageBreadcrumb pageTitle="Reorder Level" />

            <div className="max-w-7xl mx-auto p-6">
                <div className="mb-8 -mt-[125px] flex justify-end">
                    <AddButton
                        label="Add Item"
                        onClick={() => {
                            resetForm();
                            setShowForm(true);
                        }}
                    />
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatsCard
                        label="Total Items"
                        value={totalItems}
                        gradient="from-cyan-50 to-blue-50"
                        borderColor="border-cyan-100"
                        labelColor="text-cyan-600"
                        icon={<CubeIcon />}
                    />
                    <StatsCard
                        label="Reorder Needed"
                        value={reorderNeeded}
                        gradient="from-red-50 to-rose-50"
                        borderColor="border-red-100"
                        labelColor="text-red-600"
                        icon={<ExclamationTriangleIcon />}
                    />
                    <StatsCard
                        label="Stock OK"
                        value={okItems}
                        gradient="from-green-50 to-emerald-50"
                        borderColor="border-green-100"
                        labelColor="text-green-600"
                        icon={<CheckCircleIcon />}
                    />
                    <StatsCard
                        label="Total Stock"
                        value={totalStock.toLocaleString()}
                        gradient="from-purple-50 to-pink-50"
                        borderColor="border-purple-100"
                        labelColor="text-purple-600"
                        icon={<ChartBarIcon />}
                    />
                </div>

                {/* Toolbar */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by product, SKU, or supplier..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                disabled={items.length === 0}
                            >
                                <DocumentArrowDownIcon className="h-5 w-5 text-gray-600" />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-50">
                                    <button
                                        onClick={exportPDF}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <DocumentArrowDownIcon className="h-4 w-4 text-red-600" />
                                        Export PDF
                                    </button>
                                    <button
                                        onClick={exportExcel}
                                        className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50"
                                    >
                                        <TableCellsIcon className="h-4 w-4 text-green-600" />
                                        Export Excel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Print Button */}
                        <button
                            onClick={() => window.print()}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                            disabled={items.length === 0}
                        >
                            <PrinterIcon className="h-5 w-5 text-gray-600" />
                        </button>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg border ${showFilters ? 'bg-cyan-50 border-cyan-300' : 'border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <FunnelIcon className={`h-5 w-5 ${showFilters ? 'text-cyan-600' : 'text-gray-600'}`} />
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={fetchItems}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={e => setStatusFilter(e.target.value as any)}
                                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="All">All Items</option>
                                    <option value="Reorder">Reorder Needed</option>
                                    <option value="OK">Stock OK</option>
                                </select>
                            </div>
                            {statusFilter !== "All" && (
                                <button
                                    onClick={() => setStatusFilter("All")}
                                    className="self-end mb-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Table */}
                <ReusableTable
                    data={filtered}
                    columns={tableColumns}
                    pageSize={PAGE_SIZE}
                    defaultSortKey="product"
                    defaultSortOrder="asc"
                    loading={loading}
                    onRowClick={(item) => {
                        setSelectedItem(item);
                        setViewModalOpen(true);
                    }}
                    emptyState={
                        <div className="flex flex-col items-center justify-center py-12">
                            <CubeIcon className="h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-gray-500 text-sm mb-2">No reorder items found</p>
                            <p className="text-gray-400 text-xs">Click "Add Item" to create one</p>
                        </div>
                    }
                />

                {/* View Details Modal */}
                {viewModalOpen && selectedItem && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setViewModalOpen(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    Reorder Level Details
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
                                                        <p className="text-sm font-medium text-gray-900">{selectedItem.product}</p>
                                                        {selectedItem.productSKU && (
                                                            <p className="text-xs text-gray-500 mt-1">SKU: {selectedItem.productSKU}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Status</p>
                                                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusBadge(selectedItem.currentStock, selectedItem.reorderLevel)}`}>
                                                            {getStatusIcon(selectedItem.currentStock, selectedItem.reorderLevel)}
                                                            {getStatusText(selectedItem.currentStock, selectedItem.reorderLevel)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Current Stock</p>
                                                        <p className={`text-sm font-medium ${selectedItem.currentStock <= selectedItem.reorderLevel ? "text-red-600" : "text-green-600"}`}>
                                                            {selectedItem.currentStock} {selectedItem.unit || ""}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Reorder Level</p>
                                                        <p className="text-sm text-gray-700">{selectedItem.reorderLevel} {selectedItem.unit || ""}</p>
                                                    </div>
                                                    {(selectedItem?.maxStock ?? 0) > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Max Stock</p>
                                                            <p className="text-sm text-gray-700">
                                                                {selectedItem?.maxStock} {selectedItem?.unit || ""}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {selectedItem.supplier && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Supplier</p>
                                                            <p className="text-sm text-gray-700">{selectedItem.supplier}</p>
                                                        </div>
                                                    )}
                                                    {selectedItem.leadTime && selectedItem.leadTime > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-500">Lead Time</p>
                                                            <p className="text-sm text-gray-700">{selectedItem.leadTime} days</p>
                                                        </div>
                                                    )}
                                                    {selectedItem.notes && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Notes</p>
                                                            <p className="text-sm text-gray-700">{selectedItem.notes}</p>
                                                        </div>
                                                    )}
                                                    <div className="col-span-2">
                                                        <p className="text-xs text-gray-500">Stock Level</p>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${selectedItem.currentStock <= selectedItem.reorderLevel ? "bg-red-500" : "bg-green-500"}`}
                                                                    style={{ width: `${getStockPercentage(selectedItem.currentStock, selectedItem.reorderLevel)}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {Math.min(Math.round(getStockPercentage(selectedItem.currentStock, selectedItem.reorderLevel)), 100)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {selectedItem.createdAt && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs text-gray-500">Last Updated</p>
                                                            <p className="text-sm text-gray-600">{new Date(selectedItem.updatedAt || selectedItem.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {selectedItem.currentStock <= selectedItem.reorderLevel && (
                                                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                                                    <p className="text-sm text-red-800">
                                                        <strong>Reorder Alert:</strong> Current stock is at or below reorder level. 
                                                        Please consider placing a purchase order for {selectedItem.product}.
                                                        {selectedItem.supplier && ` Recommended supplier: ${selectedItem.supplier}`}
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
                                            handleEdit(selectedItem);
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

                {/* Add/Edit Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowForm(false)}></div>
                            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    {editingId ? "Edit Reorder Level" : "Add Reorder Item"}
                                                </h3>
                                                <button
                                                    onClick={() => setShowForm(false)}
                                                    className="text-gray-400 hover:text-gray-500"
                                                >
                                                    <XCircleIcon className="h-6 w-6" />
                                                </button>
                                            </div>

                                            <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        Product Name <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={form.product}
                                                        onChange={e => setForm({ ...form, product: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="Enter product name"
                                                        required
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Current Stock <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={form.currentStock}
                                                            onChange={e => setForm({ ...form, currentStock: Number(e.target.value) })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="0"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Reorder Level <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={form.reorderLevel}
                                                            onChange={e => setForm({ ...form, reorderLevel: Number(e.target.value) })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="0"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Max Stock (Optional)</label>
                                                        <input
                                                            type="number"
                                                            value={form.maxStock || ''}
                                                            onChange={e => setForm({ ...form, maxStock: Number(e.target.value) })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Unit (Optional)</label>
                                                        <input
                                                            type="text"
                                                            value={form.unit}
                                                            onChange={e => setForm({ ...form, unit: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            placeholder="e.g., pcs, kg, box"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Supplier (Optional)</label>
                                                        <input
                                                            type="text"
                                                            value={form.supplier}
                                                            onChange={e => setForm({ ...form, supplier: e.target.value })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700">Lead Time (Days)</label>
                                                        <input
                                                            type="number"
                                                            value={form.leadTime || ''}
                                                            onChange={e => setForm({ ...form, leadTime: Number(e.target.value) })}
                                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                            min="0"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Notes (Optional)</label>
                                                    <textarea
                                                        value={form.notes}
                                                        onChange={e => setForm({ ...form, notes: e.target.value })}
                                                        rows={2}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-cyan-500 focus:border-cyan-500"
                                                        placeholder="Additional notes..."
                                                    />
                                                </div>
                                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>Note:</strong> Items with current stock at or below reorder level will trigger reorder alerts.
                                                    </p>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        onClick={handleSave}
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {editingId ? "Update" : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={confirmState.isOpen}
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmLabel={confirmState.confirmLabel}
                    cancelLabel={confirmState.cancelLabel}
                    variant={confirmState.variant}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            </div>
        </>
    );
};

export default ReorderLevelPage;
