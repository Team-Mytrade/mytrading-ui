import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    EllipsisVerticalIcon,
    PencilSquareIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    BuildingOfficeIcon,
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
import { Menu } from "@headlessui/react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { ToasterService } from "../../Services/ToasterService";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";

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
    const [sortKey, setSortKey] = useState<keyof ReorderItem>("product");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
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

    const handleSort = (field: keyof ReorderItem) => {
        if (sortKey === field) setSortOrder(o => o === "asc" ? "desc" : "asc");
        else { setSortKey(field); setSortOrder("asc"); }
    };

    const SortIcon = ({ col }: { col: keyof ReorderItem }) =>
        sortKey !== col ? null : sortOrder === "asc" ? <ArrowUpIcon className="h-3 w-3 inline ml-1" /> : <ArrowDownIcon className="h-3 w-3 inline ml-1" />;

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

    const sorted = [...filtered].sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (valA == null && valB == null) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === "string" && typeof valB === "string") {
            return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (typeof valA === "number" && typeof valB === "number") {
            return sortOrder === "asc" ? valA - valB : valB - valA;
        }

        return 0;
    });

    const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

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
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Items</p>
                                <p className="text-2xl font-semibold text-gray-900">{totalItems}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-full">
                                <CubeIcon className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Reorder Needed</p>
                                <p className="text-2xl font-semibold text-red-600">{reorderNeeded}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-full">
                                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Stock OK</p>
                                <p className="text-2xl font-semibold text-green-600">{okItems}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-full">
                                <CheckCircleIcon className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Stock</p>
                                <p className="text-2xl font-semibold text-purple-600">{totalStock.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-full">
                                <ChartBarIcon className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
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
                                onChange={e => { setSearch(e.target.value); setPage(1); }}
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
                                    onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
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
                <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-visible">
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        { key: "product", label: "Product" },
                                        { key: "currentStock", label: "Current Stock" },
                                        { key: "reorderLevel", label: "Reorder Level" },
                                        { key: null, label: "Status" },
                                        { key: null, label: "Stock Level" },
                                        { key: null, label: "Actions" },
                                    ].map((col, i) => (
                                        <th
                                            key={i}
                                            onClick={() => col.key && handleSort(col.key as keyof ReorderItem)}
                                            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${col.key ? "cursor-pointer hover:bg-gray-100" : ""
                                                }`}
                                        >
                                            <span className="flex items-center">
                                                {col.label}
                                                {col.key && <SortIcon col={col.key as keyof ReorderItem} />}
                                            </span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                                                <p className="text-gray-500 text-sm">Loading reorder items...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : paginated.length > 0 ? paginated.map(item => {
                                    const percentage = getStockPercentage(item.currentStock, item.reorderLevel);
                                    const isReorderNeeded = item.currentStock <= item.reorderLevel;
                                    return (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setSelectedItem(item);
                                                setViewModalOpen(true);
                                            }}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-cyan-100 flex items-center justify-center mr-3">
                                                        <CubeIcon className="h-4 w-4 text-cyan-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{item.product}</div>
                                                        {item.productSKU && (
                                                            <div className="text-xs text-gray-500 mt-0.5">SKU: {item.productSKU}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm font-medium ${isReorderNeeded ? "text-red-600" : "text-green-600"}`}>
                                                    {item.currentStock}
                                                </span>
                                                {item.unit && <span className="text-xs text-gray-400 ml-1">{item.unit}</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm text-gray-600">{item.reorderLevel}</span>
                                                {item.unit && <span className="text-xs text-gray-400 ml-1">{item.unit}</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(item.currentStock, item.reorderLevel)}`}>
                                                    {getStatusIcon(item.currentStock, item.reorderLevel)}
                                                    {getStatusText(item.currentStock, item.reorderLevel)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap w-48">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${isReorderNeeded ? "bg-red-500" : "bg-green-500"}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 min-w-[45px]">
                                                        {Math.min(Math.round(percentage), 100)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right relative" onClick={e => e.stopPropagation()}>
                                                <Menu as="div" className="relative inline-block text-left">
                                                    <Menu.Button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                                        <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
                                                    </Menu.Button>
                                                    <Menu.Items className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-gray-200 z-[100]">
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedItem(item);
                                                                        setViewModalOpen(true);
                                                                    }}
                                                                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                                >
                                                                    <EyeIcon className="h-4 w-4 text-blue-600" />
                                                                    View Details
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={() => handleEdit(item)}
                                                                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-700`}
                                                                >
                                                                    <PencilSquareIcon className="h-4 w-4 text-cyan-600" />
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    onClick={() => handleDelete(item.id, item.product)}
                                                                    className={`${active ? "bg-gray-50" : ""} w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600`}
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </Menu.Items>
                                                </Menu>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center">
                                                <CubeIcon className="h-12 w-12 text-gray-400 mb-3" />
                                                <p className="text-gray-500 text-sm mb-2">No reorder items found</p>
                                                <p className="text-gray-400 text-xs">Click "Add Item" to create one</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                                        <span className="font-medium">
                                            {Math.min(page * PAGE_SIZE, filtered.length)}
                                        </span>{' '}
                                        of <span className="font-medium">{filtered.length}</span> results
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setPage(1)}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            First
                                        </button>
                                        <button
                                            onClick={() => setPage(Math.max(1, page - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum: number;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (page <= 3) {
                                                pageNum = i + 1;
                                            } else if (page >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = page - 2 + i;
                                            }
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setPage(pageNum)}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === pageNum
                                                            ? "z-10 bg-cyan-50 border-cyan-500 text-cyan-600"
                                                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                        <button
                                            onClick={() => setPage(totalPages)}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Last
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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
